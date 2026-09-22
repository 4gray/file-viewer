import { renderFileViewerSpreadsheet } from '../../packages/renderers/spreadsheet/src/index.js';
import { createFileViewerDomSearchController } from '@file-viewer/core';
Object.assign(globalThis, { spreadsheetTextCheck: { renderFileViewerSpreadsheet, createFileViewerDomSearchController } });
