import type {
  FileRenderContext,
  FileRenderHandler,
  FileViewerRendererPlugin,
  RendererDefinition,
} from '@file-viewer/core';

export type BpmnView = 'diagram' | 'source';

export interface BpmnViewerOptions {
  initialView?: BpmnView;
  /** Whole-input limit before decoding. Default: 20 MiB. */
  maxFileBytes?: number;
}

export interface BpmnDiagram {
  id: string;
  name: string;
}

export interface BpmnViewerInstance {
  $el: HTMLElement;
  /** Settles after import; invalid diagrams retain source and a visible error. */
  ready: Promise<void>;
  getSource(): string;
  getView(): BpmnView;
  setView(view: BpmnView): void;
  getDiagrams(): readonly BpmnDiagram[];
  selectDiagram(id: string): Promise<void>;
  unmount(): Promise<void>;
}

export const bpmnRendererDefinition: RendererDefinition = {
  id: 'bpmn',
  label: 'BPMN 2.0',
  category: 'drawing',
  extensions: ['bpmn'],
  packageName: '@file-viewer/renderer-drawing',
  presets: [],
  supportLevel: 'structured',
  status: 'experimental',
  capabilities: { zoom: 'provider', download: true, print: false, exportHtml: false, search: false },
  knownLimits: [
    'Diagram preview requires BPMN DI layout; source remains available without it.',
    'Read-only viewer; process scripts are never executed.',
    'The bpmn.io watermark must remain visible under the upstream license.',
  ],
};

export function createBpmnRenderer(
  options: BpmnViewerOptions = {},
): FileViewerRendererPlugin<FileRenderHandler<BpmnViewerInstance, HTMLDivElement>> {
  return {
    id: 'file-viewer-renderer-bpmn',
    label: 'Flyfish optional BPMN viewer',
    definitions: [bpmnRendererDefinition],
    handlers: [{
      rendererId: bpmnRendererDefinition.id,
      handler: (buffer, target, _type, context) => renderFileViewerBpmn(buffer, target, context, options),
    }],
  };
}

export async function renderFileViewerBpmn(
  buffer: ArrayBuffer,
  target: HTMLDivElement,
  context?: FileRenderContext,
  options: BpmnViewerOptions = {},
): Promise<BpmnViewerInstance> {
  const { renderBpmn } = await import('./bpmnRuntime.js');
  return renderBpmn(buffer, target, context, options);
}

export const bpmnRenderer = createBpmnRenderer();
export default bpmnRenderer;
