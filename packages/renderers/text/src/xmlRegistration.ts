import type { FileRenderContext, FileViewerRenderedInstance } from '@file-viewer/core'

type XmlRenderer = (buffer: ArrayBuffer, target: HTMLDivElement, context?: FileRenderContext) => Promise<FileViewerRenderedInstance>
type XmlLoader = () => Promise<{ default: XmlRenderer }>
const key = Symbol.for('@file-viewer/renderer-text/xml-profiles')
const registry = globalThis as typeof globalThis & { [key]?: Map<symbol, XmlLoader> }

export function registerXmlProfiles(loader: XmlLoader): () => void {
  const registrations = registry[key] ??= new Map()
  const token = Symbol()
  registrations.set(token, loader)
  return () => { registrations.delete(token) }
}

export function getXmlProfilesLoader(): XmlLoader | undefined {
  return registry[key]?.values().next().value
}
