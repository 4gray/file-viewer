# XML profile regression procedure

Use the synthetic files in `fixtures/issue-305/`; their provenance is recorded in
that directory. Do not substitute customer XML or upload documents to validators.

After the workspace owner installs the pinned optional dev dependencies and builds
core, run these commands from the repository root. No command here installs packages:

```sh
node node_modules/typescript/lib/tsc.js -b packages/renderers/text/tsconfig.json
node --test packages/renderers/text/test/*.test.mjs
node packages/renderers/text/test/issue-305-xml-profiles.browser.mjs
XML_PROFILE_BROWSER=webkit node packages/renderers/text/test/issue-305-xml-profiles.browser.mjs
XML_PROFILE_BUNDLE_FORMAT=iife XML_PROFILE_MINIFY=1 node packages/renderers/text/test/issue-305-xml-profiles.browser.mjs
XML_PROFILE_BROWSER=webkit XML_PROFILE_BUNDLE_FORMAT=iife XML_PROFILE_MINIFY=1 node packages/renderers/text/test/issue-305-xml-profiles.browser.mjs
node packages/renderers/text/bin/copy-xml-profile-assets.mjs /tmp/file-viewer-xml-assets
```

The browser test serves only local fixture and npm runtime files. It rejects
off-origin traffic, disables the browser's native `XSLTProcessor`, and invokes the
real libxml2/libxslt WASM factories. It checks:

- No registration or no XML configuration: no profile or engine downloads.
- Manifest-relative paths, both checks, root-only and XSD-only matching.
- Required XSD structure and decimal datatypes, unique matching and ambiguity.
- Safe fallback for malformed XML, schemas, stylesheets and WASM, redirects,
  external URLs, DTD/entities, schema dependencies and XSLT external reads.
- Encoded `document()` and dynamically constructed external reads inside WASM.
- Sanitized output with an opaque sandbox, no executable scripts, and no external fetches.
- Source/rendered/source state, original byte preservation, original UTF-16 text,
  retained diagnostics and no new downloads when switching.
- Byte limits on chunked downloads, output limits, profile count, total resource
  budget, worker timeout, cancellation during download/execution, and unmount.
- Worker termination and Blob URL revocation after every case.

An integration test's request guard must allow both `${origin}/` and
`blob:${origin}/`. WebKit routes same-origin Blob workers through Playwright's
request interception; rejecting every non-HTTP URL blocks the local worker before
its bootstrap executes. This produces `Blocked by Web Inspector` in the console
and an XML `engine-error` with `unknown worker error`, even when the compressed
bundle is valid. Keep rejecting other origins; allowing these local Blob URLs does
not enable external XML/XSLT reads inside the isolated worker.

`XML_PROFILE_SCREENSHOT=/absolute/path.png` captures the rendered view after a
source round trip and the iframe body in a separate image. Inspect the screenshot:
DOM assertions alone may miss a blank cross-process iframe compositor surface.
The source view covers an inert, still-laid-out iframe so switching back does not
destroy its layout or reload its cached output.

The asset test verifies output bytes, hashes, licenses and preservation of unrelated
destination files. The memory test compiles the actual pinned XSLT factory and
checks that the VM rejects growth past 64 MiB. Browser memory ceilings apply to
WASM linear memory, not the browser's entire JS/DOM/compositor process.

Desktop WebKit is a desktop-engine check, not iPhone evidence. Windows, iOS Simulator,
Webpack and a host application's Vite bundle need their own integration evidence;
these package tests do not claim to replace it. Firefox can be selected with
`XML_PROFILE_BROWSER=firefox` when its Playwright runtime is operational.

Integration API: `enableFileViewerXmlProfiles()` from
`@file-viewer/renderer-text/xml-profiles`. Runtime assets are copied by
`file-viewer-xml-assets`; the default layout is `xml/xmllint-browser.mjs`,
`xml/xmllint.wasm` and `xml/xslt-wasm.js` below the configured asset base.
The `xml` options/types live in core; there are no additions to the default format
or capability catalog. The engine packages remain optional peers.
