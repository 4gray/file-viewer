type EpubContents = { document: Document };

type EpubContentHook = {
  register(listener: (contents: EpubContents) => void): void;
  deregister(listener: (contents: EpubContents) => void): void;
};

export type EpubMediaRendition = {
  getContents(): EpubContents[];
  hooks: { content: EpubContentHook };
};

export const resolveEpubOrientationMedia = (query: string, portrait: boolean) => {
  return query.replace(/\(\s*orientation\s*:\s*(portrait|landscape)\s*\)/gi, (_, orientation: string) => {
    const matches = (orientation.toLowerCase() === 'portrait') === portrait;
    // Constant media features preserve surrounding AND / OR / NOT conditions.
    return matches ? '(min-width: 0px)' : '(width: 0px)';
  });
};

/** Keep orientation independent of an iframe whose height follows its content. */
export const bindEpubViewportMedia = (rendition: EpubMediaRendition, viewport: HTMLElement) => {
  const originals = new WeakMap<MediaList, string>();

  const updateContents = ({ document }: EpubContents) => {
    const { clientWidth: width, clientHeight: height } = viewport;
    if (!width || !height) {
      return;
    }
    const portrait = height >= width;
    const visited = new Set<CSSStyleSheet>();

    const updateMedia = (media: MediaList) => {
      const original = originals.get(media) ?? media.mediaText;
      const resolved = resolveEpubOrientationMedia(original, portrait);
      if (resolved !== original) {
        originals.set(media, original);
        if (media.mediaText !== resolved) {
          media.mediaText = resolved;
        }
      }
    };

    const visitRules = (rules: CSSRuleList) => {
      for (const rule of Array.from(rules)) {
        // Do not use instanceof: the rules belong to the chapter's iframe realm.
        if ('media' in rule) {
          updateMedia((rule as CSSMediaRule | CSSImportRule).media);
        }
        if ('styleSheet' in rule) {
          const sheet = (rule as CSSImportRule).styleSheet;
          if (sheet) visitSheet(sheet);
        } else if ('cssRules' in rule) {
          visitRules((rule as CSSGroupingRule).cssRules);
        }
      }
    };

    const visitSheet = (sheet: CSSStyleSheet) => {
      if (visited.has(sheet)) return;
      visited.add(sheet);
      updateMedia(sheet.media);
      try {
        visitRules(sheet.cssRules);
      } catch (error) {
        // Cross-origin sheets can be applied by the browser but not read via CSSOM.
        if (!error || (error as { name?: string }).name !== 'SecurityError') throw error;
      }
    };

    Array.from(document.styleSheets).forEach(visitSheet);
  };

  const update = () => rendition.getContents().forEach(updateContents);
  rendition.hooks.content.register(updateContents);
  const observer = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(update);
  observer?.observe(viewport);
  const hostWindow = viewport.ownerDocument.defaultView;
  if (!observer) hostWindow?.addEventListener('resize', update);

  return () => {
    observer?.disconnect();
    if (!observer) hostWindow?.removeEventListener('resize', update);
    rendition.hooks.content.deregister(updateContents);
  };
};
