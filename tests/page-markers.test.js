import assert from 'node:assert/strict';
import { test } from 'node:test';

import { filterPagesByMarkerTag, normalizePageMarkers, PAGE_MARKER_TAGS } from '../src/lib/page-markers.js';

test('normalizePageMarkers keeps known unique tags and a short note', () => {
  const markers = normalizePageMarkers({
    tags: ['favorite', 'unknown', 'ocr-problem', 'favorite'],
    note: `  ${'nota '.repeat(120)}`
  });

  assert.deepEqual(markers.tags, ['favorite', 'ocr-problem']);
  assert.equal(markers.note.length, 500);
});

test('normalizePageMarkers accepts legacy marker-like page fields', () => {
  const markers = normalizePageMarkers({
    markerTags: ['review-later'],
    markerNote: 'Mirar margen'
  });

  assert.deepEqual(markers, {
    tags: ['review-later'],
    note: 'Mirar margen'
  });
});

test('filterPagesByMarkerTag filters by allowed marker tags only', () => {
  const pages = [
    { id: 'page-0001', markers: { tags: ['favorite'], note: '' } },
    { id: 'page-0002', markers: { tags: ['image-problem'], note: '' } },
    { id: 'page-0003', markers: { tags: [], note: '' } }
  ];

  assert.deepEqual(filterPagesByMarkerTag(pages, 'favorite').map((page) => page.id), ['page-0001']);
  assert.deepEqual(filterPagesByMarkerTag(pages, 'all').map((page) => page.id), [
    'page-0001',
    'page-0002',
    'page-0003'
  ]);
  assert.deepEqual(filterPagesByMarkerTag(pages, 'bad-tag').map((page) => page.id), [
    'page-0001',
    'page-0002',
    'page-0003'
  ]);
});

test('PAGE_MARKER_TAGS documents the expected local marker set', () => {
  assert.deepEqual(PAGE_MARKER_TAGS, [
    'favorite',
    'review-later',
    'ocr-problem',
    'image-problem',
    'editorial-question'
  ]);
});
