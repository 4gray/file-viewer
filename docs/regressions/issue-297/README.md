# GitHub #297: BPMN diagram and source views

## Inputs and scope

- [Issue #297](https://github.com/flyfish-dev/file-viewer/issues/297) requests BPMN
  source/diagram views with diagram zoom.
- [Original pizza attachment](https://github.com/user-attachments/files/32370040/pizza.bpmn.txt)
  from the issue is downloaded with `gh` and kept outside tracked files. It
  exercises pools, lanes, message/sequence flows, gateways, events and labels.
  The browser regression verifies every BPMN DI shape/edge reference rather than
  checking only that an SVG exists. No redistribution license is assumed for it.
- `packages/renderers/drawing/test/fixtures/simple-process.bpmn` is independently
  constructed, marked CC0-1.0, and suitable for public demos. Its adjacent README
  records provenance. The public fixture is also included in the renderer package.
- The optional `/bpmn` entry exports `bpmnRenderer`, `createBpmnRenderer`,
  `renderFileViewerBpmn` and their types. Its renderer id is `bpmn`, package is
  `@file-viewer/renderer-drawing`, and `presets` is empty. Ordinary drawing and Full
  keep their existing format lists. Catalog, Demo and release-map integration is
  owned by the integrating task.

## Reproduce

Run from the repository root after the integrator has installed workspace dependencies.
The test uses the repository's Playwright browsers and viewer-demo's esbuild.

```sh
gh api https://github.com/user-attachments/files/32370040/pizza.bpmn.txt > /tmp/file-viewer-issue-297-pizza.bpmn
node packages/renderers/drawing/scripts/build-bpmn-styles.mjs
node_modules/.bin/tsc -b packages/renderers/drawing/tsconfig.json
node packages/renderers/drawing/scripts/build-bpmn-styles.mjs --check
node packages/renderers/drawing/test/issue-297-bpmn.browser.mjs /tmp/file-viewer-issue-297-pizza.bpmn
```

Without the final argument the browser script runs the redistributable/generated
fixtures only; that does not establish a successful pizza regression. The script
checks the real attachment hash when supplied. `BPMN_PIZZA_FILE` is an alternative
to the positional argument. `BPMN_EVIDENCE_DIR` selects the local evidence directory.

Current status, source revision, browser versions, input/output hashes and checks
belong in `.release/issue-297-bpmn/CURRENT.json`. Desktop and narrow-layout
screenshots are written beside it. Screenshots derived from the original pizza
attachment remain local. The committed document is a procedure, not a substitute
for current execution evidence. No release, deployment or iOS-device verification
is implied by the desktop Chromium/WebKit checks.

## Assertions

- The default drawing import excludes the BPMN runtime; the explicit entry loads
  the engine lazily. Both ESM splitting and standalone IIFE bundles render locally.
- Every DI shape and connection in the supplied files is present; the original
  bpmn.io watermark is visible, within the host, and not overlapped.
- Source text survives view switches, preserving XML, BOM, CRLF, Unicode,
  comments and script content. UTF-16 is decoded before a normalized render copy
  is handed to browser/moddle parsers; the original decoded source is retained.
- Toolbar, common zoom provider, wheel, pointer pan, actual-size and fit controls
  agree. Source font zoom is independent of the preserved diagram viewbox.
  Invalid zoom numbers are ignored and supported scale limits are enforced.
- Multiple diagrams can be selected, including queued changes and recovery from
  an empty first diagram. Partial imports expose warnings. Missing DI, empty
  planes, malformed/non-BPMN XML, DOCTYPE declarations and size-limit failures
  show an explanation and source when decoding was possible.
- Script tasks and markup-like labels remain data. External/variable SVG paints
  are removed only from the render copy; valid colors and transparent `none`
  remain usable. DTDs are rejected before native parsing. All external requests
  are blocked and counted, and a warmed runtime re-renders with networking offline.
- Initially hidden containers can become visible and fit. Negative diagram
  coordinates work. Manual zoom survives resize. Narrow layouts avoid horizontal
  page overflow; document paper stays separate from the viewer shell.
- Multiple viewers keep independent zoom. Disposing a replaced viewer preserves
  its successor. Repeated cancellation, disposal during a drag and idempotent
  `unmount()` leave no registered provider, mounted viewer, ResizeObserver or
  additional document/window input listeners.
- Official CSS is available inside Shadow DOM without a host CSS import. The
  generated source module also supports source aliases in the development Demo.

## Integration selectors and lifecycle

The main host is `.fv-bpmn`; `data-bpmn-status` is `loading`, `ready`,
`source-only` or `error`, and `data-bpmn-view` is `diagram` or `source`.
Buttons expose `data-bpmn-action="diagram|source|zoom-in|zoom-out|actual|fit"`.
Source is `.fv-bpmn-source`; the engine lives in `.fv-bpmn-diagram`.
Use `.fv-bpmn .djs-container svg .djs-element` for real diagram content, because
the upstream watermark itself also contains SVG.

`renderFileViewerBpmn(buffer, target, context?, options?)` returns an instance with
`ready`, `getSource()`, `getView()`, `setView()`, `getDiagrams()`,
`selectDiagram(id)` and async `unmount()`. The host needs a usable height. `ready`
settles after an import attempt; inspect the status for source-only/error cases.
`context.signal` cancels an instance, and the standard core zoom provider supplies
shared toolbar integration. Printing, HTML export, editing and process execution
are not advertised capabilities of this entry.

Upstream API and license sources were read through `gh` at `bpmn-io/bpmn-js`
tag `v18.28.0` and `bpmn-io/diagram-js` tag `v15.26.0`. The optional peer and
development dependency is pinned to `bpmn-js@18.28.0`. Its license requires the
intact bpmn.io watermark and must not be labeled MIT. The adapter's Apache-2.0
license and full upstream notices are documented separately in
`packages/renderers/drawing/THIRD_PARTY_NOTICES.md`.
