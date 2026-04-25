import assert from 'node:assert/strict';
import { mkdtemp, rm, stat } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';

import {
  clearAiOcrSettings,
  loadAiOcrSettings,
  readAiOcrApiKey,
  saveAiOcrSettings
} from '../src/lib/app-settings.js';

test('loadAiOcrSettings reports an unconfigured default state', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'booksaver-settings-'));

  try {
    const settings = await loadAiOcrSettings(root, { env: {} });

    assert.deepEqual(settings, {
      configured: false,
      source: null,
      model: 'gpt-5.4-mini',
      maskedApiKey: null,
      canEditKey: true
    });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('saveAiOcrSettings persists a local key without exposing it publicly', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'booksaver-settings-'));

  try {
    const saved = await saveAiOcrSettings(root, {
      apiKey: '  sk-test-abcdefghijklmnopqrstuvwxyz  ',
      model: 'gpt-5.5'
    }, { env: {} });

    assert.equal(saved.configured, true);
    assert.equal(saved.source, 'local');
    assert.equal(saved.model, 'gpt-5.5');
    assert.equal(saved.maskedApiKey, 'sk-t...wxyz');
    assert.equal(await readAiOcrApiKey(root, { env: {} }), 'sk-test-abcdefghijklmnopqrstuvwxyz');
    assert.equal((await stat(path.join(root, 'settings.json'))).mode & 0o777, 0o600);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('environment API key overrides local settings in public state', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'booksaver-settings-'));

  try {
    await saveAiOcrSettings(root, {
      apiKey: 'sk-local-abcdefghijklmnopqrstuvwxyz',
      model: 'gpt-5.4-mini'
    }, { env: {} });

    const settings = await loadAiOcrSettings(root, {
      env: {
        OPENAI_API_KEY: 'sk-env-abcdefghijklmnopqrstuvwxyz',
        BOOKSAVER_AI_OCR_MODEL: 'gpt-5.5'
      }
    });

    assert.equal(settings.configured, true);
    assert.equal(settings.source, 'env');
    assert.equal(settings.model, 'gpt-5.5');
    assert.equal(settings.maskedApiKey, 'sk-e...wxyz');
    assert.equal(settings.canEditKey, false);
    assert.equal(
      await readAiOcrApiKey(root, {
        env: { OPENAI_API_KEY: 'sk-env-abcdefghijklmnopqrstuvwxyz' }
      }),
      'sk-env-abcdefghijklmnopqrstuvwxyz'
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('clearAiOcrSettings removes the local key', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'booksaver-settings-'));

  try {
    await saveAiOcrSettings(root, {
      apiKey: 'sk-local-abcdefghijklmnopqrstuvwxyz',
      model: 'gpt-5.5'
    }, { env: {} });

    const cleared = await clearAiOcrSettings(root, { env: {} });

    assert.equal(cleared.configured, false);
    assert.equal(await readAiOcrApiKey(root, { env: {} }), null);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
