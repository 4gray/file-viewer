import { registerXmlProfiles } from './xmlRegistration.js'

export type {
  FileViewerXmlProfile, FileViewerXmlManifest, FileViewerXmlOptions,
  FileViewerXmlDiagnostic, FileViewerXmlDiagnosticCode
} from '@file-viewer/core'
export type { FileViewerXmlRenderedInstance } from './xml.js'

/** Register the built-in WASM implementation. Loading and execution remain lazy. */
export function enableFileViewerXmlProfiles(): () => void {
  return registerXmlProfiles(() => import('./xml.js'))
}
