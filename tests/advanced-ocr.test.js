import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  buildAdvancedOcrConfirmation,
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

test('buildAdvancedOcrConfirmation summarizes cost and privacy before sending a page', () => {
  const confirmation = buildAdvancedOcrConfirmation({
    provider: 'openai-compatible',
    model: 'vision-ocr-pro',
    baseUrl: 'https://ocr.example.local/v1/responses',
    pageCount: 1
  });

  assert.equal(confirmation.requiresConfirmation, true);
  assert.equal(confirmation.sendsImagesOffDevice, true);
  assert.equal(confirmation.providerLabel, 'Compatible OpenAI');
  assert.match(confirmation.privacyNote, /sale de tu equipo/i);
  assert.match(confirmation.costNote, /puede tener coste/i);
  assert.match(confirmation.endpointLabel, /ocr\.example/);
});
