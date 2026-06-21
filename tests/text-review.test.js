import assert from 'node:assert/strict';
import { test } from 'node:test';

import { findSuspiciousWords } from '../src/lib/text-review.js';

test('findSuspiciousWords flags OCR-like mixed digits and symbols with context', () => {
  const findings = findSuspiciousWords({
    text: 'El cabal1ero vio a Dulcinea y una palabra_con_ruido.',
    dictionary: { terms: ['Dulcinea'] }
  });

  assert.deepEqual(findings.map((item) => item.word), ['cabal1ero', 'palabra_con_ruido']);
  assert.match(findings[0].reason, /digitos/i);
  assert.match(findings[0].context, /El cabal1ero vio/);
});

test('findSuspiciousWords ignores accepted dictionary terms', () => {
  const findings = findSuspiciousWords({
    text: 'Cabal1ero Cabal1ero',
    dictionary: { terms: ['Cabal1ero'] }
  });

  assert.deepEqual(findings, []);
});
