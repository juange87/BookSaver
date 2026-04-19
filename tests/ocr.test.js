import assert from 'node:assert/strict';
import { test } from 'node:test';

import { defaultOcrEngineForPlatform, platformLabel, summarizeRuntimeSupport } from '../src/lib/ocr.js';

test('defaultOcrEngineForPlatform uses Apple Vision only on macOS', () => {
  assert.equal(defaultOcrEngineForPlatform('darwin'), 'apple-vision');
  assert.equal(defaultOcrEngineForPlatform('win32'), 'tesseract');
  assert.equal(defaultOcrEngineForPlatform('linux'), 'tesseract');
});

test('platformLabel returns friendly OS names', () => {
  assert.equal(platformLabel('darwin'), 'macOS');
  assert.equal(platformLabel('win32'), 'Windows');
  assert.equal(platformLabel('linux'), 'Linux');
  assert.equal(platformLabel('freebsd'), 'freebsd');
});

test('summarizeRuntimeSupport highlights missing OCR setup on Windows', () => {
  const support = summarizeRuntimeSupport({
    platform: 'win32',
    tesseractLanguages: []
  });

  assert.equal(support.preferredEngine, 'tesseract');
  assert.equal(support.appleVisionAvailable, false);
  assert.equal(support.tesseractInstalled, false);
  assert.equal(support.folderPickerSupported, true);
  assert.match(support.summary, /Windows necesita Tesseract/i);
  assert.ok(support.warnings.some((warning) => /Instala Tesseract/i.test(warning)));
});

test('summarizeRuntimeSupport reports a fully ready macOS runtime', () => {
  const support = summarizeRuntimeSupport({
    platform: 'darwin',
    tesseractLanguages: ['eng', 'spa']
  });

  assert.equal(support.preferredEngine, 'apple-vision');
  assert.equal(support.appleVisionAvailable, true);
  assert.equal(support.tesseractInstalled, true);
  assert.equal(support.folderPickerSupported, true);
  assert.equal(support.summary, 'macOS listo: Apple Vision y Tesseract disponibles.');
});
