import assert from 'node:assert/strict'
import { fileViewerRenderers, resolveFileViewerRendererSelection } from '../dist/index.js'

for (const options of [{ formats: ['bpmn'] }, { preset: 'all', formats: ['bpmn'] }]) {
  const selection = resolveFileViewerRendererSelection(options)
  assert.deepEqual(selection.missing, [])
  assert.ok(selection.rendererIds.includes('bpmn'))
  assert.ok(selection.packages.includes('@file-viewer/renderer-drawing'))
  const plugin = fileViewerRenderers(options)
  const source = plugin.load(plugin.resolveId('virtual:file-viewer-renderers'))
  assert.match(source, /import \{ bpmnRenderer as renderer\d+ \} from '@file-viewer\/renderer-drawing\/bpmn'/)
}
for (const options of [{ preset: 'all' }, { formats: ['drawio'] }]) {
  const selection = resolveFileViewerRendererSelection(options)
  assert.ok(!selection.rendererIds.includes('bpmn'))
  const plugin = fileViewerRenderers(options)
  assert.doesNotMatch(plugin.load(plugin.resolveId('virtual:file-viewer-renderers')), /\/bpmn'/)
}
console.log('[bpmn-entry] Explicit BPMN imports its subpath; drawing and all remain unchanged.')
