import assert from 'node:assert/strict';
import { test } from 'node:test';

import { buildBookSnapshot, snapshotSummary } from '../src/lib/book-snapshots.js';

test('buildBookSnapshot stores editable state without absolute source paths', () => {
  const snapshot = buildBookSnapshot({
    createdAt: '2026-07-05T10:00:00.000Z',
    reason: 'delete-page',
    metadata: {
      id: 'libro-local',
      title: 'Libro local',
      language: 'es',
      inbox: {
        path: '/Users/example/Library/Application Support/BookSaver/inbox/libro-local',
        watch: true
      }
    },
    pages: [
      {
        id: 'page-0001',
        number: 1,
        image: 'pages/page-0001/original.png',
        text: 'pages/page-0001/ocr.txt',
        layout: 'pages/page-0001/layout.json',
        source: {
          path: '/Users/example/Desktop/IMG_0001.png',
          fileName: 'IMG_0001.png',
          fingerprint: '/Users/example/Desktop/IMG_0001.png:100:200',
          preservedOriginal: 'pages/page-0001/original.png'
        },
        ocrText: 'Texto revisado',
        layoutData: { blocks: [{ type: 'paragraph', text: 'Texto revisado' }] }
      }
    ],
    summary: {
      affectedPageIds: ['page-0001']
    }
  });

  assert.equal(snapshot.version, 1);
  assert.equal(snapshot.reason, 'delete-page');
  assert.equal(snapshot.metadata.inbox.path, '');
  assert.equal(snapshot.pages[0].image, 'pages/page-0001/original.png');
  assert.equal(snapshot.pages[0].ocrText, 'Texto revisado');
  assert.deepEqual(snapshot.pages[0].layoutData.blocks[0], {
    type: 'paragraph',
    text: 'Texto revisado'
  });
  assert.equal(snapshot.pages[0].source.path, undefined);
  assert.equal(snapshot.pages[0].source.fingerprint, undefined);
  assert.equal(JSON.stringify(snapshot).includes('/Users/example'), false);

  assert.deepEqual(snapshotSummary(snapshot), {
    id: snapshot.id,
    reason: 'delete-page',
    createdAt: '2026-07-05T10:00:00.000Z',
    pageCount: 1,
    affectedPageIds: ['page-0001']
  });
});
