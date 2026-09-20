# GitHub #304: Patch 分栏与行高回归

报告：<https://github.com/flyfish-dev/file-viewer/issues/304>

本记录对应 2026-09-20 的本地验证，不代表已发布或线上已修复。手工修改范围为
`src/patch.ts`、本目录的 `issue-304-patch-layout.browser.mjs` 和本记录。

## 根因与修复

`diff2html.html` 只生成标记。原有内嵌 CSS 缺少 `.d2h-files-diff` 和
`.d2h-file-side-diff` 的分栏规则，两个普通块级元素因此上下堆叠。
外层 `.d2h-code-side-line` 的 `white-space: pre-wrap` 又把模板缩进和换行
显示成额外代码行。这不是宿主应用样式或清理器导致的问题。

修复在渲染器自身样式中定义等宽 flex 分栏，各栏允许局部横向滚动。
行包装器忽略模板空白，仅实际代码 span 保留 `white-space: pre`。
统一单行最小高度、表格单元格间距和随字体缩放的行号栏，使空源码行、插入/删除
补位行与普通行等高。长行保持单行，表格随内容扩展，滚到末尾后增删背景仍覆盖代码。
不修改 diff2html 的 `matching: 'lines'` 行匹配结果，不依赖全局或 CDN 样式。

## 实测证据

浏览器脚本用已安装的真实 diff2html 3.4.56、真实 Patch 渲染器、core 和清理器。
esbuild 只把该入口及其依赖打成内存中的浏览器脚本，不伪造 diff HTML，也不修改共享 dist。
Playwright Chromium 153.0.8010.12 在无应用 CSS 的页面执行。

样本包括报告内完整小样本、仓库 `apps/viewer-demo/public/example/change.patch`，
以及包含长行、Tab/空格缩进、空行、两侧补位和非位置对应行匹配的构造补丁。

| 1234px 容器，100% 缩放 | 普通 DOM | Shadow DOM |
| --- | --- | --- |
| 修复前普通代码行 | 84.125px | 84.125px |
| 修复前左右栏 | 上下堆叠 | 上下堆叠 |
| 修复后普通代码行 | 20.53125px | 20.53125px |
| 修复后左右栏 | 相邻，各 600px | 相邻，各 600px |

修复后 6 个样本/隔离组合共 60 组测量通过：48 组覆盖明暗主题和
60%、100%、150%、240% 缩放；12 组覆盖 390px 容器与跟随系统的明暗主题。
另实测长行横滚至末尾、行号不覆盖源码、增删背景、每对行的高度/位置、匹配语义和卸载清理。
没有浏览器异常或网络请求。390px 是桌面 Chromium 内的窄容器测试，不是 iOS 实机验证。

本地截图和逐行测量保存在 `/tmp/file-viewer-issue-304/`：

- `before.json` / `after.json`：被测源码、浏览器 bundle 的 SHA-256，基准提交、浏览器版本及几何数据。
- `light-before.png` / `shadow-before.png`：旧版堆叠与大行距。
- `shadow-synthetic-light-after.png`：修复后的基础布局。
- `shadow-edge-dark-after.png` / `shadow-edge-scrolled-after.png`：暗色、补位、长行及末尾滚动。

## 实际执行命令

以下命令均在仓库根目录执行；使用现成依赖，不需要安装或全仓构建。

```sh
gh issue view 304 --repo flyfish-dev/file-viewer --json number,title,body,comments,url,state,labels

# 读取固定旧提交的 patch.ts 到内存，验证旧缺陷确实存在；不切换工作区。
PATCH_LAYOUT_SOURCE_REF=ae490a58b900aff7d848869123e240d07f00a19b PATCH_LAYOUT_EXPECT_BROKEN=1 PATCH_LAYOUT_ARTIFACTS=/tmp/file-viewer-issue-304 node packages/renderers/text/test/issue-304-patch-layout.browser.mjs

# 同一固定旧源码执行正确布局断言：预期退出 1，6 个组合全部失败。
PATCH_LAYOUT_SOURCE_REF=ae490a58b900aff7d848869123e240d07f00a19b node packages/renderers/text/test/issue-304-patch-layout.browser.mjs

# 当前源码：退出 0，7/7 测试通过（含父测试），60 组测量。
PATCH_LAYOUT_ARTIFACTS=/tmp/file-viewer-issue-304 node packages/renderers/text/test/issue-304-patch-layout.browser.mjs

# 只检查 Patch 入口及其导入，不输出共享构建文件；退出 0。
node_modules/.bin/tsc --ignoreConfig --noEmit --strict --skipLibCheck --target ES2019 --module ESNext --moduleResolution Bundler --lib DOM,ES2020 packages/renderers/text/src/ambient.d.ts packages/renderers/text/src/patch.ts

# 现有 HTML 清理器回归：1/1 通过。
node --test packages/renderers/text/test/sanitize.test.mjs
```

## 整包构建边界

最初尝试 `pnpm --filter @file-viewer/renderer-text build`，当时共享工作区正在进行另一项
XML 开发，因 `src/text.ts` 引用尚未完成的 `FileViewerOptions.xml` 和 `./xml.js` 而失败。
不能将这次整包构建记录为通过。随后采用上述单入口构建、无输出类型检查和真实浏览器回归。

该次 pnpm 命令在执行脚本前还按共享工作区已变化的依赖清单触发了自动安装；执行后
`pnpm-lock.yaml` 和 `packages/renderers/text/dist/index.js` 有变化。后者包含并行 XML 入口的
构建结果。这些共享变化未回退，也未归入 #304 的手工修改范围；交付者合并时应与对应任务核对。

未执行 React/Vite 整应用生产构建、发布矩阵或线上回归；未提交、推送、改版本、发布，
也未评论或关闭 GitHub issue。浏览器回归脚本需显式运行，未为接入测试命令修改 package.json。
