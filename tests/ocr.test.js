import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  buildLocalOcrProfiles,
  buildOcrImageVariants,
  createReliableOcrResult,
  defaultOcrEngineForPlatform,
  inspectRuntimeSupport,
  normalizeOcrMode,
  platformLabel,
  summarizeOcrCapabilities,
  summarizeRuntimeSupport
} from '../src/lib/ocr.js';

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

test('normalizeOcrMode defaults to local improved OCR', () => {
  assert.equal(normalizeOcrMode(), 'local-improved');
  assert.equal(normalizeOcrMode('consensus'), 'consensus');
  assert.equal(normalizeOcrMode('ai-advanced'), 'ai-advanced');
  assert.equal(normalizeOcrMode('unexpected'), 'local-improved');
});

test('buildLocalOcrProfiles uses multiple Tesseract page segmentation profiles', () => {
  const profiles = buildLocalOcrProfiles({
    engine: 'tesseract',
    imagePath: '/tmp/page.jpg',
    language: 'spa'
  });

  assert.deepEqual(
    profiles.map((profile) => profile.id),
    ['tesseract:psm4', 'tesseract:psm6', 'tesseract:psm3']
  );
  assert.deepEqual(profiles[0].args.slice(0, 4), ['/tmp/page.jpg', 'stdout', '-l', 'spa']);
});

test('buildLocalOcrProfiles keeps Apple Vision single-pass until image variants exist', () => {
  const profiles = buildLocalOcrProfiles({
    engine: 'apple-vision',
    imagePath: '/tmp/page.jpg',
    language: 'es'
  });

  assert.deepEqual(profiles, [
    {
      id: 'apple-vision:original',
      engine: 'apple-vision',
      profile: 'original',
      imagePath: '/tmp/page.jpg',
      language: 'es'
    }
  ]);
});

test('createReliableOcrResult returns the best candidate with summaries', () => {
  const result = createReliableOcrResult({
    mode: 'local-improved',
    candidates: [
      {
        id: 'tesseract:weak',
        provider: 'local',
        engine: 'tesseract',
        profile: 'weak',
        text: '???',
        layout: { lines: [{ text: '???', confidence: 10 }], blocks: [] },
        status: 'ocr-complete'
      },
      {
        id: 'apple-vision:original',
        provider: 'local',
        engine: 'apple-vision',
        profile: 'original',
        text: 'Texto correcto con muchas palabras reconocidas para la pagina.',
        layout: {
          lines: [{ text: 'Texto correcto con muchas palabras reconocidas para la pagina.', confidence: 94 }],
          blocks: [
            {
              type: 'paragraph',
              text: 'Texto correcto con muchas palabras reconocidas para la pagina.',
              confidence: 94
            }
          ]
        },
        status: 'ocr-complete'
      }
    ]
  });

  assert.equal(result.engine, 'apple-vision');
  assert.equal(result.ocrStrategy, 'local-improved');
  assert.equal(result.ocrProvider, 'local');
  assert.equal(result.ocrNeedsReview, false);
  assert.equal(result.candidates.length, 2);
  assert.equal(Object.hasOwn(result.candidates[0], 'text'), false);
});

test('buildOcrImageVariants always includes the original image', () => {
  assert.deepEqual(
    buildOcrImageVariants({
      imagePath: '/tmp/page.jpg',
      platform: 'linux'
    }),
    [{ id: 'original', imagePath: '/tmp/page.jpg', profile: 'original' }]
  );
});

test('buildOcrImageVariants adds macOS derived variants for local preprocessing', () => {
  assert.deepEqual(
    buildOcrImageVariants({
      imagePath: '/tmp/page.jpg',
      outputDir: '/tmp/page-ocr',
      platform: 'darwin'
    }),
    [
      { id: 'original', imagePath: '/tmp/page.jpg', profile: 'original' },
      {
        id: 'contrast',
        imagePath: '/tmp/page-ocr/page-contrast.jpg',
        profile: 'contrast'
      },
      {
        id: 'sharpen',
        imagePath: '/tmp/page-ocr/page-sharpen.jpg',
        profile: 'sharpen'
      }
    ]
  );
});

test('summarizeOcrCapabilities keeps AI disabled without API key', () => {
  const capabilities = summarizeOcrCapabilities({
    platform: 'darwin',
    tesseractLanguages: ['spa'],
    hasOpenAiApiKey: false
  });

  assert.equal(capabilities.localImproved.available, true);
  assert.equal(capabilities.consensus.available, true);
  assert.equal(capabilities.aiAdvanced.available, false);
});

test('summarizeOcrCapabilities reports AI available only with API key', () => {
  const capabilities = summarizeOcrCapabilities({
    platform: 'darwin',
    tesseractLanguages: ['spa'],
    hasOpenAiApiKey: true
  });

  assert.equal(capabilities.aiAdvanced.available, true);
  assert.equal(capabilities.aiAdvanced.model, 'gpt-5.4-mini');
});

test('inspectRuntimeSupport accepts configured AI OCR settings', async () => {
  const support = await inspectRuntimeSupport({
    platform: 'darwin',
    tesseractLanguages: ['spa'],
    hasOpenAiApiKey: true,
    aiModel: 'gpt-5.5'
  });

  assert.equal(support.ocrCapabilities.aiAdvanced.available, true);
  assert.equal(support.ocrCapabilities.aiAdvanced.model, 'gpt-5.5');
});
