import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  adjacentPageId,
  extendSelection,
  selectionBounds
} from '../public/page-range-selection.js';

const ids = ['a', 'b', 'c', 'd', 'e'];
const pages = ids.map((id, index) => ({ id, number: index + 1 }));

test('extendSelection toggles only the target without an anchor', () => {
  assert.deepEqual([...extendSelection(ids, new Set(), null, 'c', true)], ['c']);
  assert.deepEqual([...extendSelection(ids, new Set(['c']), null, 'c', false)], []);
});

test('extendSelection selects the contiguous span from anchor to target in either direction', () => {
  assert.deepEqual([...extendSelection(ids, new Set(['b']), 'b', 'd', true)].sort(), ['b', 'c', 'd']);
  assert.deepEqual([...extendSelection(ids, new Set(['d']), 'd', 'b', true)].sort(), ['b', 'c', 'd']);
});

test('extendSelection keeps selections outside the span', () => {
  const result = extendSelection(ids, new Set(['a', 'c']), 'c', 'e', true);
  assert.deepEqual([...result].sort(), ['a', 'c', 'd', 'e']);
});

test('extendSelection clears a span when unchecking', () => {
  const result = extendSelection(ids, new Set(['a', 'b', 'c', 'd']), 'b', 'd', false);
  assert.deepEqual([...result].sort(), ['a']);
});

test('extendSelection ignores an anchor that is no longer in the list', () => {
  assert.deepEqual([...extendSelection(ids, new Set(), 'zz', 'c', true)], ['c']);
});

test('selectionBounds returns null for an empty selection', () => {
  assert.equal(selectionBounds(pages, new Set()), null);
});

test('selectionBounds returns min and max page numbers even when not contiguous', () => {
  assert.deepEqual(selectionBounds(pages, new Set(['b', 'e'])), { start: 2, end: 5 });
});

test('adjacentPageId moves within the visible list and stops at the edges', () => {
  assert.equal(adjacentPageId(pages, 'c', 1), 'd');
  assert.equal(adjacentPageId(pages, 'c', -1), 'b');
  assert.equal(adjacentPageId(pages, 'a', -1), null);
  assert.equal(adjacentPageId(pages, 'e', 1), null);
});

test('adjacentPageId starts at the first visible page when current is filtered out', () => {
  const visible = [pages[1], pages[3]];
  assert.equal(adjacentPageId(visible, 'c', 1), 'b');
  assert.equal(adjacentPageId(visible, null, -1), 'b');
  assert.equal(adjacentPageId([], 'c', 1), null);
});
