import assert from 'node:assert/strict';
import { test } from 'node:test';

import { searchBookText } from '../src/lib/book-search.js';

test('searchBookText finds case-insensitive matches by page', () => {
  const result = searchBookText(
    [
      { id: 'page-0001', number: 1, text: 'Don Quijote salio al camino. quijote volvio.' },
      { id: 'page-0002', number: 2, text: 'Sancho miro el cielo.' }
    ],
    'Quijote'
  );

  assert.equal(result.query, 'Quijote');
  assert.equal(result.totalMatches, 2);
  assert.deepEqual(
    result.pages.map((page) => [page.pageId, page.pageNumber, page.matchCount]),
    [['page-0001', 1, 2]]
  );
});

test('searchBookText returns readable context snippets', () => {
  const result = searchBookText(
    [{ id: 'page-0001', number: 1, text: 'Antes de la aventura aparece una palabra clave y despues sigue el texto.' }],
    'palabra clave',
    { contextLength: 12 }
  );

  assert.equal(result.pages[0].matches[0].excerpt, '...aparece una palabra clave y despues s...');
});

test('searchBookText skips image pages and pages without text', () => {
  const result = searchBookText(
    [
      { id: 'page-0001', number: 1, text: 'Texto visible', editorial: { imageMode: 'image' } },
      { id: 'page-0002', number: 2, text: '' },
      { id: 'page-0003', number: 3, text: 'Texto visible en OCR' }
    ],
    'visible'
  );

  assert.equal(result.totalMatches, 1);
  assert.deepEqual(result.pages.map((page) => page.pageId), ['page-0003']);
});

test('searchBookText treats empty searches as empty results', () => {
  const result = searchBookText([{ id: 'page-0001', number: 1, text: 'Texto' }], '   ');

  assert.deepEqual(result, {
    query: '',
    totalMatches: 0,
    pages: []
  });
});
