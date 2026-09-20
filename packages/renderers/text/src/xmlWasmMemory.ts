/**
 * Clamp the standard WASM memory section before compilation. xslt-polyfill's
 * SINGLE_FILE build defines (rather than imports) memory, so an Emscripten
 * wasmMemory option cannot constrain it. No instructions or data are changed.
 * Keep this function self-contained: it is serialized into the XSLT worker.
 */
export function limitXmlWasmMemory(input: BufferSource, maxPages = 1024): Uint8Array<ArrayBuffer> {
  const bytes = ArrayBuffer.isView(input)
    ? new Uint8Array(input.buffer, input.byteOffset, input.byteLength)
    : new Uint8Array(input)
  if (!Number.isSafeInteger(maxPages) || maxPages < 1 || maxPages > 1024) throw new Error('Invalid XML WASM memory limit.')
  if (bytes.length < 8 || ![0, 97, 115, 109, 1, 0, 0, 0].every((value, index) => bytes[index] === value)) {
    throw new Error('Invalid XML WASM module.')
  }
  let offset = 8
  const read = () => {
    let value = 0
    for (let index = 0; index < 5; index++) {
      if (offset >= bytes.length) throw new Error('Truncated WASM section.')
      const byte = bytes[offset++]
      if (index === 4 && byte > 15) throw new Error('Invalid WASM section integer.')
      value += (byte & 127) * 2 ** (index * 7)
      if (!(byte & 128)) return value
    }
    throw new Error('Invalid WASM section integer.')
  }
  const encode = (value: number) => {
    const output: number[] = []
    do {
      const byte = value % 128
      value = Math.floor(value / 128)
      output.push(byte | (value ? 128 : 0))
    } while (value)
    return output
  }
  const parts = [bytes.subarray(0, 8)]
  let foundMemory = false
  while (offset < bytes.length) {
    const start = offset
    const id = bytes[offset++]
    const length = read()
    const end = offset + length
    if (end > bytes.length) throw new Error('Truncated WASM section.')
    if (id !== 5) {
      parts.push(bytes.subarray(start, end))
    } else {
      if (foundMemory || read() !== 1) throw new Error('XML WASM requires exactly one defined memory.')
      foundMemory = true
      const flags = read()
      if (flags !== 0 && flags !== 1) throw new Error('Shared or memory64 XML WASM is not supported.')
      const initial = read()
      const maximum = flags === 1 ? read() : maxPages
      if (initial > maxPages || maximum < initial || offset !== end) throw new Error('Invalid XML WASM memory declaration.')
      const memory = [1, 1, ...encode(initial), ...encode(Math.min(maximum, maxPages))]
      parts.push(new Uint8Array([5, ...encode(memory.length), ...memory]))
    }
    offset = end
  }
  if (!foundMemory) throw new Error('XML WASM did not declare its own memory.')
  const output = new Uint8Array(parts.reduce((size, part) => size + part.length, 0))
  offset = 0
  for (const part of parts) { output.set(part, offset); offset += part.length }
  return output
}
