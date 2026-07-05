import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  PAGE_TEXT_HISTORY_LIMIT,
  buildPageTextHistoryEntry,
  normalizePageTextHistory
} from '../src/lib/page-text-history.js';

test('buildPageTextHistoryEntry stores source and restorable text without image data', () => {
  const entry = buildPageTextHistoryEntry('Texto anterior', {
    source: 'ocr',
    createdAt: '2026-07-05T10:00:00.000Z',
    note: 'Antes de releer OCR'
  });

  assert.equal(entry.source, 'ocr');
  assert.equal(entry.text, 'Texto anterior');
  assert.equal(entry.note, 'Antes de releer OCR');
  assert.equal(Object.hasOwn(entry, 'image'), false);
});

test('normalizePageTextHistory keeps newest valid entries within retention', () => {
  const entries = Array.from({ length: PAGE_TEXT_HISTORY_LIMIT + 2 }, (_, index) => ({
    id: `history-${index}`,
    source: index % 2 ? 'manual-edit' : 'replacement',
    createdAt: new Date(Date.UTC(2026, 6, 5, 10, index)).toISOString(),
    text: `Texto ${index}`
  }));

  const history = normalizePageTextHistory(entries);

  assert.equal(history.length, PAGE_TEXT_HISTORY_LIMIT);
  assert.equal(history[0].text, `Texto ${PAGE_TEXT_HISTORY_LIMIT + 1}`);
  assert.equal(history.at(-1).text, 'Texto 2');
});

test('normalizePageTextHistory drops empty text entries and unknown sources', () => {
  const history = normalizePageTextHistory([
    { id: 'ok', source: 'restore', createdAt: '2026-07-05T10:00:00.000Z', text: 'Texto' },
    { id: 'empty', source: 'restore', createdAt: '2026-07-05T10:00:01.000Z', text: '' },
    { id: 'bad', source: 'other', createdAt: '2026-07-05T10:00:02.000Z', text: 'No' }
  ]);

  assert.deepEqual(history.map((entry) => entry.id), ['ok']);
});
