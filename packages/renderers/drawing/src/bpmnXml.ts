const BPMN_MODEL = 'http://www.omg.org/spec/BPMN/20100524/MODEL';
const BPMN_DI = 'http://www.omg.org/spec/BPMN/20100524/DI';
const COLOR_NAMESPACES = new Set([
  'http://bpmn.io/schema/bpmn/biocolor/1.0',
  'http://www.omg.org/spec/BPMN/non-normative/color/1.0',
]);

function prologHasDoctype(source: string) {
  let position = 0;
  while (position < source.length) {
    while (/\s/.test(source[position] || '') && position < source.length) position++;
    const endMarker = source.startsWith('<!--', position) ? '-->' : source.startsWith('<?', position) ? '?>' : null;
    if (!endMarker) return source.startsWith('<!DOCTYPE', position);
    const end = source.indexOf(endMarker, position + 2);
    if (end < 0) return false;
    position = end + endMarker.length;
  }
  return false;
}

export class BpmnInputError extends Error {
  constructor(public readonly code: 'invalidXml' | 'notBpmn' | 'doctype') {
    super(code);
  }
}

export function decodeBpmnSource(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  let encoding = 'utf-8';
  if ((bytes[0] === 0xff && bytes[1] === 0xfe) || (bytes[0] === 0x3c && bytes[1] === 0)) {
    encoding = 'utf-16le';
  } else if ((bytes[0] === 0xfe && bytes[1] === 0xff) || (bytes[0] === 0 && bytes[1] === 0x3c)) {
    encoding = 'utf-16be';
  } else {
    const header = new TextDecoder().decode(bytes.subarray(0, 256));
    const declaration = /^\uFEFF?<\?xml\s[^?]*encoding\s*=\s*['"]([^'"]+)['"]/i.exec(header);
    if (declaration) encoding = declaration[1];
  }
  return new TextDecoder(encoding, { fatal: true, ignoreBOM: true }).decode(buffer);
}

export function prepareBpmnXml(source: string, documentRef: Document) {
  const windowRef = documentRef.defaultView;
  if (!windowRef) throw new Error('BPMN preview requires a browser document.');
  // The bytes have already been decoded. DOMParser and moddle consume a string,
  // not the original encoding; retain its BOM/declaration only in the source view.
  const renderSource = source.replace(/^\uFEFF/, '').replace(
    /^(<\?xml\s[^?]*?encoding\s*=\s*)(['"])[^'"]+\2/i, '$1"UTF-8"',
  );
  // Reject DTDs before native parsing; strings in comments/CDATA are still data.
  if (prologHasDoctype(renderSource)) throw new BpmnInputError('doctype');
  const xml = new windowRef.DOMParser().parseFromString(renderSource, 'application/xml');
  if (xml.doctype) throw new BpmnInputError('doctype');
  if (['http://www.mozilla.org/newlayout/xml/parsererror.xml', 'http://www.w3.org/1999/xhtml'].some(
    namespace => xml.getElementsByTagNameNS(namespace, 'parsererror').length,
  )) {
    throw new BpmnInputError('invalidXml');
  }
  if (xml.documentElement.localName !== 'definitions' || xml.documentElement.namespaceURI !== BPMN_MODEL) {
    throw new BpmnInputError('notBpmn');
  }

  let removedColors = 0;
  const probe = documentRef.createElement('span');
  // Only color extensions can become SVG paint. Keep URL/variable paints out of
  // the render copy; the source tab always retains the untouched decoded input.
  for (const element of Array.from(xml.getElementsByTagName('*'))) {
    for (const attribute of Array.from(element.attributes)) {
      if (!COLOR_NAMESPACES.has(attribute.namespaceURI || '')) continue;
      probe.style.color = '';
      probe.style.color = attribute.value;
      if ((!probe.style.color && attribute.value.trim().toLowerCase() !== 'none') || /\\|(?:url|var|env)\s*\(/i.test(attribute.value)) {
        element.removeAttributeNode(attribute);
        removedColors++;
      }
    }
  }

  return {
    xml: removedColors ? new windowRef.XMLSerializer().serializeToString(xml) : renderSource,
    hasDiagram: Array.from(xml.documentElement.children).some(
      element => element.namespaceURI === BPMN_DI && element.localName === 'BPMNDiagram',
    ),
    removedColors,
  };
}
