// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  bindEpubViewportMedia,
  resolveEpubOrientationMedia,
  type EpubMediaRendition,
} from '../packages/renderers/ebook/src/epub-viewport-media';

afterEach(() => vi.unstubAllGlobals());

describe('issue #300 EPUB viewport media', () => {
  it('preserves compound, negated and unrelated media conditions', () => {
    const query = 'screen and (orientation: portrait) and (min-width: 400px), not all and (orientation: landscape)';
    expect(resolveEpubOrientationMedia(query, true)).toBe(
      'screen and (min-width: 0px) and (min-width: 400px), not all and (width: 0px)',
    );
    expect(resolveEpubOrientationMedia(query, false)).toBe(
      'screen and (width: 0px) and (min-width: 400px), not all and (min-width: 0px)',
    );
    expect(resolveEpubOrientationMedia('(not (ORIENTATION : LANDSCAPE)) or (hover: hover)', false))
      .toBe('(not (min-width: 0px)) or (hover: hover)');
    expect(resolveEpubOrientationMedia('(prefers-color-scheme: dark)', true))
      .toBe('(prefers-color-scheme: dark)');
  });

  const setup = () => {
    let width = 900;
    let height = 600;
    let onResize = () => {};
    const observe = vi.fn();
    const disconnect = vi.fn();
    vi.stubGlobal('ResizeObserver', class {
      constructor(callback: () => void) { onResize = callback; }
      observe = observe;
      disconnect = disconnect;
    });
    const viewport = document.createElement('div');
    Object.defineProperties(viewport, {
      clientWidth: { get: () => width },
      clientHeight: { get: () => height },
    });
    const register = vi.fn();
    const deregister = vi.fn();
    let contents: Array<{ document: Document }> = [];
    const rendition: EpubMediaRendition = {
      getContents: () => contents,
      hooks: { content: { register, deregister } },
    };
    const cleanup = bindEpubViewportMedia(rendition, viewport);
    const load = (sheets: unknown[]) => {
      const contentDocument = { styleSheets: sheets } as unknown as Document;
      const content = { document: contentDocument };
      contents.push(content);
      register.mock.calls[0][0](content);
      return content;
    };
    return {
      cleanup, disconnect, observe, viewport, register, deregister, load,
      unload: () => { contents = []; },
      resize: (nextWidth: number, nextHeight: number) => {
        width = nextWidth;
        height = nextHeight;
        onResize();
      },
    };
  };

  it('updates nested media, stylesheet media and imports from their original queries', () => {
    const harness = setup();
    const sheetMedia = { mediaText: 'screen and (orientation: portrait)' };
    const nestedMedia = { mediaText: '(orientation: landscape) and (min-width: 400px)' };
    const importMedia = { mediaText: '(orientation: portrait)' };
    const importedMedia = { mediaText: '(orientation: landscape)' };
    const imported = { media: { mediaText: '' }, cssRules: [{ media: importedMedia }] };
    harness.load([{
      media: sheetMedia,
      cssRules: [
        { cssRules: [{ media: nestedMedia }] },
        { media: importMedia, styleSheet: imported },
      ],
    }]);
    expect(sheetMedia.mediaText).toBe('screen and (width: 0px)');
    expect(nestedMedia.mediaText).toBe('(min-width: 0px) and (min-width: 400px)');
    expect(importMedia.mediaText).toBe('(width: 0px)');
    expect(importedMedia.mediaText).toBe('(min-width: 0px)');

    harness.resize(600, 900);
    expect(sheetMedia.mediaText).toBe('screen and (min-width: 0px)');
    expect(nestedMedia.mediaText).toBe('(width: 0px) and (min-width: 400px)');
    expect(importMedia.mediaText).toBe('(min-width: 0px)');
    expect(importedMedia.mediaText).toBe('(width: 0px)');
    harness.resize(900, 600);
    expect(sheetMedia.mediaText).toBe('screen and (width: 0px)');
    harness.cleanup();
  });

  it('skips unreadable cross-origin rules without abandoning subsequent local sheets', () => {
    const harness = setup();
    const media = { mediaText: '(orientation: landscape)' };
    harness.load([
      { media: { mediaText: '' }, get cssRules() { throw { name: 'SecurityError' }; } },
      { media: { mediaText: '' }, cssRules: [{ media }] },
    ]);
    expect(media.mediaText).toBe('(min-width: 0px)');
    harness.cleanup();
  });

  it('ignores hidden viewports, treats square viewports as portrait and releases observers/hooks', () => {
    const harness = setup();
    const media = { mediaText: '(orientation: landscape)' };
    harness.load([{ media: { mediaText: '' }, cssRules: [{ media }] }]);
    harness.resize(0, 900);
    expect(media.mediaText).toBe('(min-width: 0px)');
    harness.resize(600, 600);
    expect(media.mediaText).toBe('(width: 0px)');
    harness.unload();
    harness.resize(900, 600);
    expect(media.mediaText).toBe('(width: 0px)');
    harness.cleanup();
    expect(harness.observe).toHaveBeenCalledWith(harness.viewport);
    expect(harness.disconnect).toHaveBeenCalledOnce();
    expect(harness.deregister).toHaveBeenCalledWith(harness.register.mock.calls[0][0]);
  });
});
