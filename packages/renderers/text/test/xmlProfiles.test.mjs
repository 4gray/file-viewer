import assert from 'node:assert/strict'
import test from 'node:test'
import { JSDOM } from 'jsdom'
import { readXmlManifest } from '../dist/xmlProfiles.js'
import { parseSafeXml, resolveXmlLimits, sameOriginXmlUrl, xmlEngineText } from '../dist/xmlSafety.js'
import { enableFileViewerXmlProfiles } from '../dist/xml-profiles.js'
import { getXmlProfilesLoader } from '../dist/xmlRegistration.js'
import { limitXmlWasmMemory } from '../dist/xmlWasmMemory.js'

const profile = () => ({
  id: 'test', match: { rootNamespace: { enabled: true, root: 'r', namespace: '' } }, xslt: './style.xsl'
})

test('XML profiles require unique IDs and at least one explicitly enabled check', () => {
  assert.throws(() => readXmlManifest({ profiles: [{ ...profile(), match: {} }] }, 32), /at least one/)
  assert.throws(() => readXmlManifest({ profiles: [profile(), profile()] }, 32), /unique/)
  assert.throws(() => readXmlManifest({ profiles: [{ ...profile(), match: { xsd: { enabled: 'false' } } }] }, 32), /boolean/)
  assert.throws(() => readXmlManifest({ profiles: [profile()] }, 0), /bounded/)
  assert.throws(() => readXmlManifest({ profiles: [{ ...profile(), match: { xsd: { enabled: true } } }] }, 32), /xsd/)
  assert.equal(readXmlManifest({ profiles: [profile()] }, 32)[0].match.rootNamespace.namespace, '')
})

test('XML resource paths use the manifest directory and reject external or credential URLs', () => {
  assert.equal(sameOriginXmlUrl('../schema.xsd', 'https://host.test/p/manifests/profiles.json', 'https://host.test'), 'https://host.test/p/schema.xsd')
  for (const value of ['https://other.test/x', 'data:text/xml,x', 'file:///a', 'https://user@host.test/x', './x#fragment']) {
    assert.throws(() => sameOriginXmlUrl(value, 'https://host.test/', 'https://host.test'), /same-origin/)
  }
})

test('DTD, schema dependencies, and encoded XSLT document calls fail closed before engine execution', () => {
  const dom = new JSDOM('')
  const doc = dom.window.document
  try {
    assert.throws(() => parseSafeXml('<!DOCTYPE a [<!ENTITY x SYSTEM "https://other.test">]><a>&x;</a>', doc, 'xml'), /DTD/)
    assert.throws(() => parseSafeXml('<schema xmlns="http://www.w3.org/2001/XMLSchema"><include schemaLocation="a"/></schema>', doc, 'xsd'), /dependencies/)
    assert.throws(() => parseSafeXml('<s:stylesheet xmlns:s="http://www.w3.org/1999/XSL/Transform" version="1.0"><s:value-of select="docum&#101;nt(&apos;a&apos;)"/></s:stylesheet>', doc, 'xslt'), /document/)
    assert.throws(() => parseSafeXml('<r><broken></r>', doc, 'xml'), /Malformed/)
    assert.equal(parseSafeXml('<prefix:r xmlns:prefix="urn:test"/>', doc, 'xml').documentElement.localName, 'r')
  } finally { dom.window.close() }
})

test('limits cannot be disabled or exceed the built-in ceilings', () => {
  assert.equal(resolveXmlLimits({ limits: { maxXmlBytes: 1e9 } }).maxXmlBytes, 4 * 1024 * 1024)
  assert.equal(resolveXmlLimits({ limits: { maxXmlBytes: 1024 } }).maxXmlBytes, 1024)
  assert.throws(() => resolveXmlLimits({ limits: { maxProfiles: NaN } }), /Invalid/)
  assert.throws(() => resolveXmlLimits({ limits: { maxResourceBytes: 0 } }), /Invalid/)
})

test('only the engine copy changes the encoding declaration', () => {
  const original = '<?xml version="1.0" encoding="UTF-16"?><r>cafe</r>'
  assert.equal(xmlEngineText(original), original.replace('UTF-16', 'UTF-8'))
  assert.match(original, /UTF-16/)
})

test('explicit XML registration is lazy, reference counted and independently disposable', () => {
  assert.equal(getXmlProfilesLoader(), undefined)
  const first = enableFileViewerXmlProfiles()
  const second = enableFileViewerXmlProfiles()
  assert.equal(typeof getXmlProfilesLoader(), 'function')
  first()
  first()
  assert.equal(typeof getXmlProfilesLoader(), 'function')
  second()
  assert.equal(getXmlProfilesLoader(), undefined)
})

test('WASM memory maximum is enforced by the VM, including growth during execution', () => {
  // One memory (initial 1 page, maximum 32768 pages), exported as "memory".
  const bytes = new Uint8Array([0,97,115,109,1,0,0,0,5,6,1,1,1,128,128,2,7,10,1,6,109,101,109,111,114,121,2,0])
  const bounded = limitXmlWasmMemory(bytes, 2)
  assert.deepEqual(bytes.slice(8, 16), new Uint8Array([5,6,1,1,1,128,128,2]))
  const { memory } = new WebAssembly.Instance(new WebAssembly.Module(bounded)).exports
  assert.equal(memory.grow(1), 1)
  assert.throws(() => memory.grow(1), RangeError)
  assert.equal(memory.buffer.byteLength, 2 * 65536)
  assert.throws(() => limitXmlWasmMemory(bytes.subarray(0, 12)), /Truncated/)
})
