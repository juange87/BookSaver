import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  candidateSummary,
  pickBestOcrCandidate,
  scoreOcrResult,
  shouldEscalateOcr
} from '../src/lib/ocr-quality.js';

function candidate(overrides = {}) {
  return {
    id: 'tesseract:psm4',
    provider: 'local',
    engine: 'tesseract',
    profile: 'psm4',
    text: 'Este es un texto de prueba con varias palabras reconocidas correctamente.',
    layout: {
      lines: [
        { text: 'Este es un texto de prueba', confidence: 91 },
        { text: 'con varias palabras reconocidas correctamente.', confidence: 88 }
      ],
      blocks: [
        {
          type: 'paragraph',
          text: 'Este es un texto de prueba con varias palabras reconocidas correctamente.',
          confidence: 89.5
        }
      ]
    },
    warning: null,
    status: 'ocr-complete',
    ...overrides
  };
}

test('scoreOcrResult rewards confidence, useful text, and normal character mix', () => {
  const strong = scoreOcrResult(candidate());
  const weak = scoreOcrResult(
    candidate({
      text: 'l | 1 0 ? ?',
      layout: {
        lines: [{ text: 'l | 1 0 ? ?', confidence: 28 }],
        blocks: [{ type: 'paragraph', text: 'l | 1 0 ? ?', confidence: 28 }]
      }
    })
  );

  assert.equal(strong.needsReview, false);
  assert.equal(weak.needsReview, true);
  assert.ok(strong.qualityScore > weak.qualityScore);
  assert.ok(strong.confidence > weak.confidence);
});

test('pickBestOcrCandidate selects the highest quality candidate', () => {
  const best = pickBestOcrCandidate([
    candidate({ id: 'tesseract:psm6', text: 'Texto corto', layout: { lines: [], blocks: [] } }),
    candidate({ id: 'apple-vision:original' })
  ]);

  assert.equal(best.id, 'apple-vision:original');
  assert.equal(best.quality.needsReview, false);
});

test('pickBestOcrCandidate rejects high-confidence vertical line geometry', () => {
  const text =
    'Emissa. Callidus. Eidhin. Aequa y Lanistia. Hasta Ulciscor. Pero conocéis una forma de impedirlo.';
  const normal = candidate({
    id: 'apple-vision:original',
    engine: 'apple-vision',
    profile: 'original',
    text,
    layout: {
      page: { width: 4032, height: 3024 },
      lines: [
        {
          text: 'Emissa. Callidus. Eidhin. Aequa y Lanistia. Hasta Ulciscor.',
          left: 760,
          top: 150,
          width: 2960,
          height: 80,
          confidence: 98
        },
        {
          text: 'Pero conocéis una forma de impedirlo.',
          left: 760,
          top: 320,
          width: 2980,
          height: 80,
          confidence: 98
        }
      ],
      blocks: [{ type: 'paragraph', text, confidence: 98 }]
    }
  });
  const rotatedVariant = candidate({
    id: 'apple-vision:contrast',
    engine: 'apple-vision',
    profile: 'contrast',
    text,
    layout: {
      page: { width: 4032, height: 3024 },
      lines: [
        {
          text: 'Emissa. Callidus. Eidhin. Aequa y Lanistia. Hasta Ulciscor.',
          left: 205,
          top: 228,
          width: 105,
          height: 2221,
          confidence: 100
        },
        {
          text: 'Pero conocéis una forma de impedirlo.',
          left: 411,
          top: 215,
          width: 135,
          height: 2240,
          confidence: 100
        }
      ],
      blocks: [{ type: 'paragraph', text, confidence: 100 }]
    }
  });

  const rotatedScore = scoreOcrResult(rotatedVariant);
  const best = pickBestOcrCandidate([normal, rotatedVariant]);

  assert.equal(rotatedScore.needsReview, true);
  assert.equal(best.id, 'apple-vision:original');
});

test('shouldEscalateOcr marks weak local results for another pass', () => {
  const result = candidate({
    text: '???',
    layout: {
      lines: [{ text: '???', confidence: 12 }],
      blocks: [{ type: 'paragraph', text: '???', confidence: 12 }]
    }
  });

  assert.equal(shouldEscalateOcr(result), true);
});

test('candidateSummary omits full text but keeps useful diagnostics', () => {
  const summary = candidateSummary(candidate({ id: 'local:test-profile' }));

  assert.deepEqual(summary, {
    id: 'local:test-profile',
    provider: 'local',
    engine: 'tesseract',
    profile: 'psm4',
    model: null,
    confidence: 89.5,
    qualityScore: summary.qualityScore,
    textLength: 73,
    warning: null
  });
  assert.equal(Object.hasOwn(summary, 'text'), false);
});
