import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  root: fileURLToPath(new URL('../../../../', import.meta.url)),
  test: {
    environment: 'node',
    include: ['test/issue-300-epub-viewport-media.spec.ts', 'test/epubjs.spec.ts'],
  },
});
