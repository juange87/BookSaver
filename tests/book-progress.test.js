import assert from 'node:assert/strict';
import { test } from 'node:test';

import { buildBookProgress } from '../src/lib/book-progress.js';

function page(number, overrides = {}) {
  return {
    id: `page-${String(number).padStart(4, '0')}`,
    number,
    status: 'ocr-complete',
    reviewed: false,
    ocrLanguage: 'spa',
    text: '',
    updatedAt: `2026-06-2${number}T10:00:00.000Z`,
    editorial: {
      imageMode: 'text',
      partStart: false,
      partTitle: '',
      chapterStart: false,
      chapterTitle: '',
      chapterEnd: false,
      chapterHeaderMode: 'none'
    },
    ...overrides,
    editorial: {
      imageMode: 'text',
      partStart: false,
      partTitle: '',
      chapterStart: false,
      chapterTitle: '',
      chapterEnd: false,
      chapterHeaderMode: 'none',
      ...(overrides.editorial || {})
    }
  };
}

test('buildBookProgress summarizes local book progress and pending problems', () => {
  const progress = buildBookProgress({
    metadata: {
      title: 'Libro en marcha',
      language: 'es',
      updatedAt: '2026-06-20T09:00:00.000Z',
      cover: { mode: 'none' }
    },
    pages: [
      page(1, { text: 'Texto revisado', reviewed: true }),
      page(2, { text: 'Texto pendiente', reviewed: false }),
      page(3, { editorial: { imageMode: 'image' }, reviewed: true })
    ],
    checkedAt: '2026-06-21T10:00:00.000Z'
  });

  assert.equal(progress.pageCount, 3);
  assert.equal(progress.textPageCount, 2);
  assert.equal(progress.imagePageCount, 1);
  assert.equal(progress.reviewedPageCount, 2);
  assert.equal(progress.pendingReviewCount, 1);
  assert.equal(progress.reviewedPercent, 67);
  assert.equal(progress.pendingProblemCount > 0, true);
  assert.equal(progress.exportStatus, 'needs-attention');
  assert.equal(progress.updatedAt, '2026-06-23T10:00:00.000Z');
});

test('buildBookProgress differentiates ready and draft books deterministically', () => {
  const ready = buildBookProgress({
    metadata: {
      title: 'Listo',
      language: 'es',
      cover: { mode: 'page', pageId: 'page-0001' }
    },
    pages: [page(1, { text: 'Texto final', reviewed: true })],
    checkedAt: '2026-06-21T10:00:00.000Z'
  });
  const draft = buildBookProgress({
    metadata: { title: 'Borrador', language: 'es', cover: { mode: 'none' } },
    pages: [],
    checkedAt: '2026-06-21T10:00:00.000Z'
  });

  assert.deepEqual(
    [ready.exportStatus, draft.exportStatus],
    ['ready', 'empty']
  );
  assert.deepEqual(
    [ready.reviewedPercent, draft.reviewedPercent],
    [100, 0]
  );
});
