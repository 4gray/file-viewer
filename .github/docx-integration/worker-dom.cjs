'use strict';
const fs = require('node:fs');
const path = require('node:path');

/** Bundle the already-pinned XML dependency into the classic Worker only.
 * Native browsers do not expose DOMParser/XMLSerializer in WorkerGlobalScope.
 * Static CommonJS wrappers avoid eval, network dependencies and main-thread DOM.
 */
function buildWorkerDomPrelude() {
  const manifest = require.resolve('@xmldom/xmldom/package.json');
  const root = path.dirname(manifest);
  const pkg = JSON.parse(fs.readFileSync(manifest, 'utf8'));
  if (pkg.version !== '0.9.12') throw new Error('Review the Worker XML runtime before changing its pinned version.');
  const license = fs.readFileSync(path.join(root, 'LICENSE'), 'utf8').replace(/\*\//g, '* /');
  const lib = path.join(root, 'lib');
  const entries = fs.readdirSync(lib).filter(name => name.endsWith('.js')).sort().map(name => {
    const id = './' + name.slice(0, -3);
    return `${JSON.stringify(id)}: function(require, module, exports) {\n${fs.readFileSync(path.join(lib,name),'utf8')}\n}`;
  });
  return `/*! @xmldom/xmldom ${pkg.version} - MIT\n${license}\n*/
(function(root) {
  if (typeof root.DOMParser === 'function' && typeof root.XMLSerializer === 'function') return;
  var modules = {${entries.join(',\n')}};
  var cache = Object.create(null);
  function load(id) {
    if (Object.prototype.hasOwnProperty.call(cache, id)) return cache[id].exports;
    if (!Object.prototype.hasOwnProperty.call(modules, id)) throw new Error('Unknown XML module: ' + id);
    var module = { exports: {} }; cache[id] = module;
    modules[id](load, module, module.exports);
    return module.exports;
  }
  var xml = load('./index');
  if (typeof root.DOMParser !== 'function') {
    root.DOMParser = class extends xml.DOMParser {
      constructor() {
        super({onError: function(level, message) {
          if (level !== 'warning') throw new Error('Invalid document XML: ' + message);
        }});
      }
      parseFromString(source, type) {
        // Office parts cannot require DTDs. Never resolve user-controlled entities.
        if (/<!DOCTYPE|<!ENTITY/i.test(String(source))) throw new Error('DTD declarations are not allowed in document XML.');
        return super.parseFromString(source, type);
      }
    };
  }
  if (typeof root.XMLSerializer !== 'function') root.XMLSerializer = xml.XMLSerializer;
})(self);\n`;
}
module.exports = { buildWorkerDomPrelude };
