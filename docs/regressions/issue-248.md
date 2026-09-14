# Vue CLI 5 package-compilation regression (#248)

> **Maintainer-only commands:** this page contains complete-workspace release or verification examples that are not part of the public checkout. Public contributors should use the commands in `/README.md` or `/docs/guide/development.md`.

<!-- FILE_VIEWER_MAINTAINER_COMMANDS -->

Public report: https://github.com/flyfish-dev/file-viewer/issues/248

The reporter's DOCX and screenshots are not vendored. The screenshots are
retained only in the local verification fixture set.

## Root cause

The recorded Vue CLI 5 build failed before any DOCX code ran. It resolved
`@file-viewer/ppt@0.3.3`, whose package entry carried runtime-dynamic asset
URLs that made the TypeScript loader fail while generating declarations. The
failure therefore looked like a DOCX integration problem, but was a stale PPT
package-resolution defect.

`@file-viewer/ppt@0.3.4` makes those worker and font asset URLs static. The
published 3.1.0 package closure uses that version, so a clean Vue CLI 5,
TypeScript, and Element Plus consumer compiles without a bundler workaround.

## Regression coverage

```sh
pnpm verify:issue-consumer:build
pnpm verify:issue-consumer:browser
```

The browser gate creates a real `File`, checks revision-display modes and
cover rendering, resizes an Element Plus drawer, and repeats destroy/reopen
cycles while rejecting browser and network errors. A separate local fixture
installs the historical `@file-viewer/ppt@0.3.3` closure and must fail the same
Vue CLI compilation, proving that the current closure—not a caller
workaround—removes the original failure.
