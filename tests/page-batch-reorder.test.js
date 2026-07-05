import assert from 'node:assert/strict';
import { test } from 'node:test';

import { movePageSelection, sortPageIdsBySource } from '../public/page-batch-reorder.js';

test('movePageSelection moves selected pages together while preserving relative order', () => {
  const pageIds = ['page-0001', 'page-0002', 'page-0003', 'page-0004'];

  assert.deepEqual(movePageSelection(pageIds, ['page-0002', 'page-0004'], 'start'), [
    'page-0002',
    'page-0004',
    'page-0001',
    'page-0003'
  ]);
  assert.deepEqual(movePageSelection(pageIds, ['page-0002', 'page-0004'], 'end'), [
    'page-0001',
    'page-0003',
    'page-0002',
    'page-0004'
  ]);
});

test('movePageSelection inserts selected pages before or after an anchor page', () => {
  const pageIds = ['page-0001', 'page-0002', 'page-0003', 'page-0004'];

  assert.deepEqual(
    movePageSelection(pageIds, ['page-0002', 'page-0004'], {
      mode: 'before',
      anchorId: 'page-0003'
    }),
    ['page-0001', 'page-0002', 'page-0004', 'page-0003']
  );
  assert.deepEqual(
    movePageSelection(pageIds, ['page-0002', 'page-0004'], {
      mode: 'after',
      anchorId: 'page-0003'
    }),
    ['page-0001', 'page-0003', 'page-0002', 'page-0004']
  );
});

test('sortPageIdsBySource orders pages by capture date or source file name', () => {
  const pages = [
    {
      id: 'page-0001',
      number: 1,
      source: { fileName: 'IMG_010.png', captureMs: 3000 }
    },
    {
      id: 'page-0002',
      number: 2,
      source: { fileName: 'IMG_002.png', captureMs: 1000 }
    },
    {
      id: 'page-0003',
      number: 3,
      source: { fileName: 'IMG_001.png', captureMs: 2000 }
    }
  ];

  assert.deepEqual(sortPageIdsBySource(pages, 'date'), ['page-0002', 'page-0003', 'page-0001']);
  assert.deepEqual(sortPageIdsBySource(pages, 'name'), ['page-0003', 'page-0002', 'page-0001']);
});
