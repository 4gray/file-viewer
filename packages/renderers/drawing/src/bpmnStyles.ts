export const bpmnStyles: string = `
.fv-bpmn{--bpmn-bg:#f4f7fa;--bpmn-fg:#172033;--bpmn-border:#cbd5e1;--bpmn-button:#fff;display:flex;flex-direction:column;width:100%;height:100%;min-height:0;overflow:hidden;background:var(--bpmn-bg);color:var(--bpmn-fg);font:13px/1.5 sans-serif;isolation:isolate}
.fv-bpmn[data-theme=dark]{--bpmn-bg:#172033;--bpmn-fg:#e2e8f0;--bpmn-border:#475569;--bpmn-button:#243247}
@media(prefers-color-scheme:dark){.fv-bpmn[data-theme=system]{--bpmn-bg:#172033;--bpmn-fg:#e2e8f0;--bpmn-border:#475569;--bpmn-button:#243247}}
.fv-bpmn *{box-sizing:border-box}
.fv-bpmn [hidden]{display:none!important}
.fv-bpmn-toolbar{display:flex;flex:none;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:6px;padding:6px 10px;border-bottom:1px solid var(--bpmn-border)}
.fv-bpmn-modes,.fv-bpmn-zoom{display:flex;align-items:center;gap:4px}
.fv-bpmn button,.fv-bpmn select{min-width:30px;min-height:30px;border:1px solid var(--bpmn-border);border-radius:5px;padding:3px 8px;background:var(--bpmn-button);color:var(--bpmn-fg);font:inherit;cursor:pointer}
.fv-bpmn button[aria-pressed=true]{border-color:#0f766e;background:#0f766e;color:white}
.fv-bpmn button:focus-visible,.fv-bpmn select:focus-visible,.fv-bpmn pre:focus-visible{outline:2px solid #14b8a6;outline-offset:-2px}
.fv-bpmn button:disabled{opacity:.5;cursor:default}
.fv-bpmn select{min-width:0;max-width:min(220px,100%)}
.fv-bpmn-zoom output{min-width:45px;text-align:center;font-variant-numeric:tabular-nums}
.fv-bpmn-notice{flex:none;max-height:96px;overflow:auto;padding:8px 12px;border-bottom:1px solid var(--bpmn-border);white-space:pre-wrap;overflow-wrap:anywhere}
.fv-bpmn-stage{position:relative;flex:1;min-height:0;min-width:0;overflow:hidden}
.fv-bpmn-diagram{position:absolute;inset:0 0 var(--file-viewer-content-end-inset,0px);overflow:hidden;background:white;color:#172033;touch-action:none}
.fv-bpmn-source{position:absolute;inset:0;overflow:auto;margin:0;padding:12px;color:var(--bpmn-fg);font:13px/1.65 ui-monospace,monospace;white-space:pre;tab-size:2;overscroll-behavior:contain}
.fv-bpmn .djs-container>svg{display:block;max-width:none;height:100%}
.fv-bpmn .bjs-breadcrumbs{max-width:calc(100% - 40px)}
@media(max-width:480px){.fv-bpmn-toolbar{padding:4px 6px}.fv-bpmn button{padding:3px 6px}}
`;
