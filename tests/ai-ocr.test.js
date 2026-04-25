import assert from 'node:assert/strict';
import { test } from 'node:test';

import { buildAiOcrRequest, parseAiOcrResponse, runAiOcr } from '../src/lib/ai-ocr.js';

const tinyJpeg = Buffer.from('/9j/4AAQSkZJRgABAQAAAQABAAD/2w==', 'base64');

test('buildAiOcrRequest uses Responses API image input and store false', () => {
  const body = buildAiOcrRequest({
    imageBase64: tinyJpeg.toString('base64'),
    mime: 'image/jpeg',
    language: 'es',
    model: 'gpt-5.4-mini'
  });

  assert.equal(body.model, 'gpt-5.4-mini');
  assert.equal(body.store, false);
  assert.equal(body.input[0].content[1].type, 'input_image');
  assert.match(body.input[0].content[1].image_url, /^data:image\/jpeg;base64,/);
  assert.equal(body.input[0].content[1].detail, 'original');
  assert.equal(body.text.format.type, 'json_schema');
});

test('parseAiOcrResponse extracts structured OCR JSON', () => {
  const parsed = parseAiOcrResponse({
    output_text: JSON.stringify({
      text: 'Texto transcrito.',
      paragraphs: ['Texto transcrito.'],
      confidence: 0.93,
      warnings: []
    })
  });

  assert.equal(parsed.text, 'Texto transcrito.');
  assert.equal(parsed.confidence, 93);
  assert.equal(parsed.warnings.length, 0);
});

test('runAiOcr refuses to call network without explicit opt-in', async () => {
  await assert.rejects(
    runAiOcr({
      imagePath: '/tmp/page.jpg',
      language: 'es',
      allowCloud: false,
      apiKey: 'test-key',
      readFile: async () => tinyJpeg,
      fetchImpl: async () => {
        throw new Error('fetch should not be called');
      }
    }),
    /activarse de forma explicita/i
  );
});

test('runAiOcr calls OpenAI when opt-in and API key are present', async () => {
  const result = await runAiOcr({
    imagePath: '/tmp/page.jpg',
    language: 'es',
    allowCloud: true,
    apiKey: 'test-key',
    readFile: async () => tinyJpeg,
    fetchImpl: async (url, options) => {
      assert.equal(url, 'https://api.openai.com/v1/responses');
      assert.equal(options.headers.Authorization, 'Bearer test-key');
      return {
        ok: true,
        json: async () => ({
          output_text: JSON.stringify({
            text: 'Texto transcrito por IA.',
            paragraphs: ['Texto transcrito por IA.'],
            confidence: 0.91,
            warnings: []
          })
        })
      };
    }
  });

  assert.equal(result.provider, 'openai');
  assert.equal(result.engine, 'ai-advanced');
  assert.equal(result.model, 'gpt-5.4-mini');
  assert.equal(result.text, 'Texto transcrito por IA.');
});
