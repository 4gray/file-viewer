# EPUB navigation relative-path regression (#292)

Public report: https://github.com/flyfish-dev/file-viewer/issues/292

The reporter-provided EPUB is not vendored. Its local verification SHA-256 is
`027fa05be3902e6747f49d9ee66e0b1e2c120db9a25d7dfce15440527f403a6c`.

## Root cause

`epubjs@0.3.93` exposes EPUB 3 navigation links relative to `nav.xhtml`, but
looks up sections relative to the OPF manifest. When a navigation document is
inside a subdirectory, a TOC entry such as `chapter.xhtml#start` must map to
the matching OPF-relative spine item, for example `text/chapter.xhtml#start`.
Passing the raw TOC link to `rendition.display()` caused `No Section Found`.

The renderer now resolves a navigation link against the nav/NCX document only
when that result names an existing spine item. Already OPF-relative links,
external URLs, and unknown links remain unchanged. TOC, previous, and next
actions also route rejections to the rendered error state rather than leaving
an unhandled browser Promise rejection.

## Regression coverage

```sh
pnpm test:epub-github-292
```

The unit gate covers nested nav paths, parent-directory resolution, fragments,
query strings, already OPF-relative links, external URLs, and unknown targets.
`verify:issue-browser-regressions:built` also creates a minimal nested-nav EPUB,
uploads it to the built Demo, verifies the first section, checks normalized TOC
targets, follows a second TOC entry, and rejects browser console errors. The
original public sample is verified locally through the actual Demo upload path
before release, without adding copyrighted content to the repository.
