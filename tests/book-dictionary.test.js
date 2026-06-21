import assert from 'node:assert/strict';
import { test } from 'node:test';

import { normalizeBookDictionary, previewDictionaryReplacements } from '../src/lib/book-dictionary.js';

test('normalizeBookDictionary keeps unique sorted local terms', () => {
  const dictionary = normalizeBookDictionary({
    terms: [' Quijote ', 'quijote', 'Dulcinea', '', 'Sancho']
  });

  assert.deepEqual(dictionary.terms, ['Dulcinea', 'Quijote', 'Sancho']);
  assert.deepEqual(dictionary.replacements, []);
});

test('normalizeBookDictionary keeps editable replacement pairs', () => {
  const dictionary = normalizeBookDictionary({
    replacements: [
      { from: 'rn', to: 'm' },
      { from: '', to: 'x' },
      { from: 'teh', to: 'the' }
    ]
  });

  assert.deepEqual(dictionary.replacements, [
    { from: 'rn', to: 'm' },
    { from: 'teh', to: 'the' }
  ]);
});

test('previewDictionaryReplacements shows changed text and counts matches', () => {
  const preview = previewDictionaryReplacements('E1 rnundo tiene rnuchos errores.', [
    { from: 'rn', to: 'm' },
    { from: 'E1', to: 'El' }
  ]);

  assert.equal(preview.changed, true);
  assert.equal(preview.changeCount, 3);
  assert.equal(preview.text, 'El mundo tiene muchos errores.');
  assert.deepEqual(preview.replacements, [
    { from: 'rn', to: 'm', count: 2 },
    { from: 'E1', to: 'El', count: 1 }
  ]);
});
