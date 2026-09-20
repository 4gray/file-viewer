import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import vm from 'node:vm'
import { limitXmlWasmMemory } from '../dist/xmlWasmMemory.js'

const require = createRequire(import.meta.url)
test('the pinned libxslt WASM factory really has a VM-enforced 64 MiB ceiling', async () => {
  const source = await readFile(require.resolve('xslt-polyfill/dist/xslt-wasm.js'), 'utf8')
  const context = vm.createContext({
    console, TextEncoder, TextDecoder, setTimeout, clearTimeout,
    WebAssembly: {
      ...WebAssembly,
      Instance: WebAssembly.Instance, RuntimeError: WebAssembly.RuntimeError,
      Module: class extends WebAssembly.Module {
        constructor(bytes) { super(limitXmlWasmMemory(bytes)) }
      }
    }
  })
  vm.runInContext(source, context)
  const engine = await context.createXSLTTransformModule()
  assert.equal(typeof engine._transform, 'function')
  const currentPages = engine.wasmMemory.buffer.byteLength / 65536
  assert.throws(() => engine.wasmMemory.grow(1025 - currentPages), RangeError)
  assert.equal(engine.wasmMemory.buffer.byteLength, currentPages * 65536)
  const pointer = engine._malloc(1024)
  assert.ok(pointer)
  engine._free(pointer)
})
