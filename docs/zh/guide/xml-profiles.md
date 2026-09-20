# XML 校验与转换

此功能从 3.1.2 起提供。普通 `.xml` 文件仍使用文本预览；需要 XSD 校验和 XSLT 文档视图时，才安装并显式启用此能力。

## 接入

安装可选引擎，并从已安装的包复制运行资源：

```sh
npm install @file-viewer/web @file-viewer/renderer-text xmllint-wasm@5.3.0 xslt-polyfill@1.0.29
npx --no-install file-viewer-xml-assets public/file-viewer/xml
```

复制工具检查引擎版本，生成 SHA-256 清单，不自动下载或安装依赖。运行时文件和许可证由自己的站点提供，普通文本入口和 Full 包不会加载这些引擎。

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
      labels: { viewSource: '查看源码', viewRendered: '查看文档', diagnostics: 'XML 诊断' },
      onDiagnostic: diagnostic => console.info(diagnostic)
    }
  }
})
// 应用不再需要这次注册时，调用 disableProfiles()。
```

转换成功后可在文档和原始源码间切换，不会重新下载或解析原文件。`xml.initialView: 'source'` 可让源码默认可见。诊断回调可选，不参与决定校验结果。

## 配置文件

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

资源路径相对于配置文件 URL 解析。也可直接传入 `xml.profiles` 和 `xml.baseUrl`，但不能同时设置 `profilesUrl`。每项启用的检查都必须通过，且只能有一个匹配项。无匹配、多项匹配、配置损坏、XSD 校验失败、资源不可用或转换失败时，均保留原始 XML 并显示诊断。可以只启用 XSD，或只检查根元素和命名空间；至少需要启用一项检查。

XSD 使用 `xmllint-wasm` 的 libxml2，XSLT 1.0 使用 `xslt-polyfill` 的 libxslt，在 Worker 中运行，不依赖浏览器原生 `XSLTProcessor`。样式表应输出 HTML。禁止 XSD/XSLT 的外部导入与包含、`document()`、扩展指令、DTD 和外部实体；部署前将依赖整理为经过审查的独立文件。

## 限制与隔离

配置、样式表和引擎资源必须使用同源 HTTP(S)，不允许重定向。引擎地址只能由应用设置，不能由 XML 文件指定。输出经过清理后放入禁用脚本、禁用同源权限的 iframe，不执行应用代码，也不加载外部资源。

默认上限也是硬上限：XML 4 MiB、单个 schema/样式表 2 MiB、输出 8 MiB、32 项配置、总资源 16 MiB。可通过 `xml.limits` 调低。默认超时 15 秒，`timeoutMs` 最多设为 60 秒；超时、取消或卸载时会终止 Worker。每个 WASM 引擎的线性内存最多 64 MiB。超限或不支持的文件回退到源码，不伪造校验成功。

CSP 需允许同源资源、blob Worker 和 WASM 编译。部署到子目录时，保持 JavaScript、WASM 和许可证文件的相对位置，并调整上述两个引擎 URL。Demo 提供有效发票和校验失败发票，分别验证文档视图与源码回退。
