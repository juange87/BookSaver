import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  listAdvancedOcrAdapters,
  normalizeAdvancedOcrAdapter
} from '../src/lib/advanced-ocr.js';

test('listAdvancedOcrAdapters exposes two configurable OCR providers', () => {
  const adapters = listAdvancedOcrAdapters();

  assert.deepEqual(adapters.map((adapter) => adapter.id), ['openai', 'openai-compatible']);
  assert.equal(adapters.every((adapter) => adapter.requiresExplicitConfirmation), true);
  assert.equal(adapters.every((adapter) => adapter.exposesApiKey), false);
});

test('normalizeAdvancedOcrAdapter keeps compatible endpoints configurable', () => {
  const adapter = normalizeAdvancedOcrAdapter({
    provider: 'openai-compatible',
    model: 'vision-ocr',
    baseUrl: ' https://ocr.example.local/v1/responses '
  });

  assert.equal(adapter.provider, 'openai-compatible');
  assert.equal(adapter.model, 'vision-ocr');
  assert.equal(adapter.baseUrl, 'https://ocr.example.local/v1/responses');
  assert.equal(adapter.label, 'Compatible OpenAI');
});
