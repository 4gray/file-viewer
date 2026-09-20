import {
  decodeFileViewerTextBuffer, resolveFileViewerAssetUrl,
  type FileViewerXmlDiagnostic, type FileViewerXmlOptions, type FileViewerXmlProfile
} from '@file-viewer/core'
import {
  checkXmlAbort, fetchXmlBytes, parseSafeXml, resolveXmlLimits, sameOriginXmlUrl,
  xmlEngineText, XmlProfileError
} from './xmlSafety.js'

export interface XmlProfileResult {
  profileId: string
  html: string
}

const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

export function readXmlManifest(value: unknown, maxProfiles: number): FileViewerXmlProfile[] {
  if (!record(value) || !Array.isArray(value.profiles) || value.profiles.length > maxProfiles) {
    throw new XmlProfileError('invalid-manifest', 'XML manifest must contain a bounded profiles array.')
  }
  const ids = new Set<string>()
  return value.profiles.map((candidate: unknown) => {
    if (!record(candidate) || typeof candidate.id !== 'string' || !candidate.id.trim() || candidate.id.length > 128 || ids.has(candidate.id)) {
      throw new XmlProfileError('invalid-manifest', 'XML profile IDs must be nonempty and unique.')
    }
    ids.add(candidate.id)
    const match = candidate.match
    if (!record(match)) throw new XmlProfileError('invalid-manifest', 'XML profiles require explicit enabled checks.')
    for (const key of ['rootNamespace', 'xsd']) {
      const check = match[key]
      if (check !== undefined && (!record(check) || typeof check.enabled !== 'boolean')) {
        throw new XmlProfileError('invalid-manifest', 'XML match checks require a boolean enabled field.')
      }
    }
    const rootCheck = match.rootNamespace as Record<string, unknown> | undefined
    const xsdCheck = match.xsd as Record<string, unknown> | undefined
    if (!rootCheck?.enabled && !xsdCheck?.enabled) {
      throw new XmlProfileError('invalid-manifest', 'Each XML profile must enable at least one check.')
    }
    if (rootCheck?.enabled && (typeof rootCheck.root !== 'string' || !rootCheck.root || typeof rootCheck.namespace !== 'string')) {
      throw new XmlProfileError('invalid-manifest', 'Root matching requires a root local name and namespace (which may be empty).')
    }
    for (const key of xsdCheck?.enabled ? ['xsd', 'xslt'] : ['xslt']) {
      if (typeof candidate[key] !== 'string' || !candidate[key] || (candidate[key] as string).length > 4096) {
        throw new XmlProfileError('invalid-manifest', `XML profile is missing a valid ${key} resource.`)
      }
    }
    return candidate as unknown as FileViewerXmlProfile
  })
}

export async function applyXmlProfiles(
  source: string,
  originalBytes: number,
  options: FileViewerXmlOptions,
  documentRef: Document,
  signal: AbortSignal,
  emit: (diagnostic: FileViewerXmlDiagnostic) => void
): Promise<XmlProfileResult | undefined> {
  checkXmlAbort(signal)
  const limits = resolveXmlLimits(options)
  if (originalBytes > limits.maxXmlBytes || new TextEncoder().encode(source).length > limits.maxXmlBytes) {
    throw new XmlProfileError('limit-exceeded', 'XML exceeds the profile processing byte limit.')
  }
  const doc = parseSafeXml(source, documentRef, 'xml')
  const origin = new URL(documentRef.URL).origin
  const resourceUrl = (value: string, base: string) => sameOriginXmlUrl(value, base, origin)
  let base = documentRef.baseURI
  const cache = new Map<string, Promise<Uint8Array>>()
  let totalBytes = 0
  const read = async (url: string, maxBytes = limits.maxResourceBytes) => {
    checkXmlAbort(signal)
    let pending = cache.get(url)
    if (!pending) {
      pending = fetchXmlBytes(url, Math.min(maxBytes, limits.maxTotalResourceBytes - totalBytes), signal).then(bytes => {
        totalBytes += bytes.length
        if (totalBytes > limits.maxTotalResourceBytes) throw new XmlProfileError('limit-exceeded', 'XML profile resources exceed the total byte limit.')
        return bytes
      })
      cache.set(url, pending)
    }
    const bytes = await pending
    if (bytes.length > maxBytes) throw new XmlProfileError('limit-exceeded', 'XML resource exceeds its byte limit.')
    return bytes
  }
  const readText = async (url: string) => {
    const bytes = await read(url)
    return decodeFileViewerTextBuffer(bytes.buffer as ArrayBuffer).text
  }
  try {
    let profiles: FileViewerXmlProfile[]
    if (options.profilesUrl !== undefined && options.profiles !== undefined) {
      throw new XmlProfileError('invalid-manifest', 'Use either profilesUrl or inline profiles, not both.')
    }
    if (options.profilesUrl !== undefined) {
      if (!options.profilesUrl) throw new XmlProfileError('invalid-manifest', 'profilesUrl must not be empty.')
      base = resourceUrl(options.profilesUrl, base)
      const bytes = await read(base, Math.min(limits.maxResourceBytes, 256 * 1024))
      let manifest: unknown
      try { manifest = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)) } catch {
        throw new XmlProfileError('invalid-manifest', 'XML profile manifest is not valid UTF-8 JSON.')
      }
      profiles = readXmlManifest(manifest, limits.maxProfiles)
    } else {
      if (options.baseUrl) base = resourceUrl(options.baseUrl, base)
      profiles = readXmlManifest({ profiles: options.profiles ?? [] }, limits.maxProfiles)
    }
    const runtimeUrl = (value: string | undefined, fallback: string) => resourceUrl(
      resolveFileViewerAssetUrl(value, fallback, { documentBaseUrl: documentRef.baseURI }), documentRef.baseURI
    )
    const accepted: FileViewerXmlProfile[] = []
    const engineXml = xmlEngineText(source)
    for (const profile of profiles) {
      checkXmlAbort(signal)
      const rootCheck = profile.match.rootNamespace
      if (rootCheck?.enabled && (doc.documentElement.localName !== rootCheck.root || (doc.documentElement.namespaceURI ?? '') !== rootCheck.namespace)) {
        emit({ code: 'root-mismatch', profileId: profile.id, message: 'Root element or namespace did not match.' })
        continue
      }
      if (profile.match.xsd?.enabled) {
        const schema = await readText(resourceUrl(profile.xsd!, base))
        parseSafeXml(schema, documentRef, 'xsd')
        const workerUrl = runtimeUrl(options.runtime?.xsdWorkerUrl, 'xml/xmllint-browser.mjs')
        const workerSource = new TextDecoder('utf-8', { fatal: true }).decode(await read(workerUrl, 4 * 1024 * 1024))
        const wasm = await read(resourceUrl('./xmllint.wasm', workerUrl), 4 * 1024 * 1024)
        const { validateXmlWithWasm } = await import('./xmlEngines.js')
        const validation = await validateXmlWithWasm(workerSource, wasm, engineXml, xmlEngineText(schema), signal)
        if (!validation.valid) {
          emit({ code: 'xsd-invalid', profileId: profile.id, message: validation.message?.slice(0, 4096) || 'XML Schema validation failed.' })
          continue
        }
      }
      accepted.push(profile)
    }
    checkXmlAbort(signal)
    if (accepted.length !== 1) {
      emit(accepted.length > 1
        ? { code: 'ambiguous-profile', message: `Multiple XML profiles matched: ${accepted.map(profile => profile.id).join(', ')}.` }
        : { code: 'no-match', message: 'No XML profile passed every enabled check.' })
      return undefined
    }
    const profile = accepted[0]
    const stylesheet = await readText(resourceUrl(profile.xslt, base))
    parseSafeXml(stylesheet, documentRef, 'xslt')
    const moduleUrl = runtimeUrl(options.runtime?.xsltModuleUrl, 'xml/xslt-wasm.js')
    const moduleSource = new TextDecoder('utf-8', { fatal: true }).decode(await read(moduleUrl, 4 * 1024 * 1024))
    const { transformXmlWithWasm } = await import('./xmlEngines.js')
    const result = await transformXmlWithWasm(moduleSource, engineXml, xmlEngineText(stylesheet), limits.maxOutputBytes, signal)
    checkXmlAbort(signal)
    if (typeof result.html !== 'string') throw new XmlProfileError('transform-error', 'XSLT returned no output.')
    emit({ code: 'profile-selected', profileId: profile.id, message: 'All enabled checks passed and XSLT transformation succeeded.' })
    return { profileId: profile.id, html: result.html }
  } finally {
    cache.clear()
  }
}
