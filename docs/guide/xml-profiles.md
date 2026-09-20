# XML validation and transformation

Available in 3.1.2 and later. Ordinary `.xml` files still use the text renderer. Install and explicitly enable profiles when your application needs XSD validation and an XSLT-generated document view.

## Setup

Install the optional engines and copy their assets from your installed packages:

```sh
npm install @file-viewer/web @file-viewer/renderer-text xmllint-wasm@5.3.0 xslt-polyfill@1.0.29
npx --no-install file-viewer-xml-assets public/file-viewer/xml
```

Serve the copied runtime files and licenses from your own origin. The copier checks engine versions and writes a SHA-256 manifest; it never downloads packages. Standard text and Full imports do not load these engines.

```ts
import { mountViewer } from '@file-viewer/web'
import { textRenderer } from '@file-viewer/renderer-text'
import { enableFileViewerXmlProfiles } from '@file-viewer/renderer-text/xml-profiles'

const disableProfiles = enableFileViewerXmlProfiles()
mountViewer(document.querySelector('#viewer'), {
  url: '/documents/invoice.xml',
  filename: 'invoice.xml',
  options: {
    renderers: [textRenderer],
    xml: {
      profilesUrl: '/profiles/profiles.json',
      runtime: {
        xsdWorkerUrl: '/file-viewer/xml/xmllint-browser.mjs',
        xsltModuleUrl: '/file-viewer/xml/xslt-wasm.js'
      },
      onDiagnostic: diagnostic => console.info(diagnostic)
    }
  }
})
// Call disableProfiles() when the application's registration is no longer needed.
```

The component has **View Source** and **View Rendered** buttons after a successful transformation. Toggling does not fetch or parse the original again. `xml.initialView: 'source'` keeps source visible initially. Diagnostic callbacks are optional and do not determine whether rendering succeeds.

## Profile manifest

```json
{
  "profiles": [{
    "id": "invoice-v1",
    "match": {
      "rootNamespace": { "enabled": true, "root": "invoice", "namespace": "urn:example:invoice:v1" },
      "xsd": { "enabled": true }
    },
    "xsd": "./invoice.xsd",
    "xslt": "./invoice.xsl"
  }]
}
```

Resource paths are relative to the manifest URL. Alternatively, supply `xml.profiles` with `xml.baseUrl`; do not also set `profilesUrl`. Every enabled check must pass, and exactly one profile must match. Zero matches, multiple matches, malformed configuration, failed validation, unavailable assets or a transformation error all leave the original XML visible with diagnostics. XSD-only and root/namespace-only profiles are supported; at least one check must be enabled.

XSD uses libxml2 through `xmllint-wasm`; XSLT 1.0 uses libxslt through `xslt-polyfill` in a Worker. It does not depend on the browser's native `XSLTProcessor`. Use HTML output in the stylesheet. XSD imports/includes, XSLT imports/includes, `document()`, extension instructions, DTDs and external entities are rejected. Flatten schemas and stylesheets into reviewed, self-contained resources before deployment.

## Limits and isolation

Resources must be same-origin HTTP(S), without redirects. Runtime URLs are application configuration, never taken from the XML document. The output is sanitized into a sandboxed iframe without scripts or same-origin access; it cannot execute application code or load external resources.

Defaults and hard ceilings are 4 MiB XML, 2 MiB per schema/stylesheet, 8 MiB output, 32 profiles and 16 MiB total fetched resources. `xml.limits` can lower these limits. `timeoutMs` defaults to 15 seconds and is capped at 60 seconds. Workers are terminated on timeout, cancellation and unmount. Each WASM engine has a 64 MiB linear-memory ceiling. Larger or unsupported documents fall back to source; no validation result is fabricated.

CSP must allow same-origin assets, blob Workers and WASM compilation. Keep the runtime JavaScript, WASM and license files together when deploying under a subpath, and update the two explicit URLs accordingly. The Demo includes a valid invoice and an invalid invoice to exercise both the rendered view and fallback.
