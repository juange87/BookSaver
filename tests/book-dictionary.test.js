import assert from 'node:assert/strict';
import { test } from 'node:test';

import { normalizeBookDictionary } from '../src/lib/book-dictionary.js';

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
