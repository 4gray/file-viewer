import { describe, expect, it } from 'vitest';
import { resolveEpubJs, resolveEpubNavigationHref } from '../packages/renderers/ebook/src/epub';

const createEpubFactory = () => {
  return function ePub() {
    return undefined;
  };
};

describe('epubjs module resolution', () => {
  it('unwraps nested default exports to find the callable factory', () => {
    const ePub = createEpubFactory();

    expect(resolveEpubJs({ default: ePub })).toBe(ePub);
    expect(resolveEpubJs({ default: { default: ePub } })).toBe(ePub);
  });
});

describe('EPUB navigation paths', () => {
  const spineHrefs = [
    'text/cover.xhtml',
    'text/chapter.xhtml',
    'appendix.xhtml',
  ];

  it('resolves links relative to a nested EPUB 3 navigation document', () => {
    expect(resolveEpubNavigationHref(
      'chapter.xhtml#start',
      'text/nav.xhtml',
      spineHrefs
    )).toBe('text/chapter.xhtml#start');
    expect(resolveEpubNavigationHref(
      '../appendix.xhtml?view=reader#notes',
      'text/nav.xhtml',
      spineHrefs
    )).toBe('appendix.xhtml?view=reader#notes');
  });

  it('preserves already OPF-relative and external links', () => {
    expect(resolveEpubNavigationHref(
      'text/chapter.xhtml#start',
      'text/nav.xhtml',
      spineHrefs
    )).toBe('text/chapter.xhtml#start');
    expect(resolveEpubNavigationHref(
      'https://example.test/chapter.xhtml',
      'text/nav.xhtml',
      spineHrefs
    )).toBe('https://example.test/chapter.xhtml');
  });

  it('leaves an unknown link untouched instead of inventing a spine target', () => {
    expect(resolveEpubNavigationHref(
      'missing.xhtml#start',
      'text/nav.xhtml',
      spineHrefs
    )).toBe('missing.xhtml#start');
  });
});
