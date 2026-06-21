import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  analyzeImageMetadata,
  analyzeImageSample,
  captureQualityNeedsReview,
  normalizeImageQuality
} from '../src/lib/image-quality.js';

function sample({ width = 120, height = 180, luminance = 180, pattern = 'flat' } = {}) {
  const pixels = [];

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let value = luminance;
      if (pattern === 'checker') {
        value = (x + y) % 2 === 0 ? 30 : 230;
      }
      pixels.push(value, value, value, 255);
    }
  }

  return { width, height, pixels };
}

test('analyzeImageSample flags dark, blurred, low-resolution and landscape captures', () => {
  const quality = analyzeImageSample(
    sample({
      width: 900,
      height: 600,
      luminance: 35,
      pattern: 'flat'
    })
  );
  const codes = quality.flags.map((flag) => flag.code);

  assert.equal(quality.ok, false);
  assert.equal(captureQualityNeedsReview(quality), true);
  assert.ok(codes.includes('dark-capture'));
  assert.ok(codes.includes('blurred-capture'));
  assert.ok(codes.includes('low-resolution'));
  assert.ok(codes.includes('orientation-suspect'));
  assert.ok(quality.flags.every((flag) => flag.message));
});

test('analyzeImageSample accepts sharp portrait captures with enough resolution', () => {
  const quality = analyzeImageSample(
    sample({
      width: 1600,
      height: 2400,
      pattern: 'checker'
    })
  );

  assert.equal(quality.ok, true);
  assert.equal(quality.flags.length, 0);
  assert.equal(captureQualityNeedsReview(quality), false);
  assert.equal(quality.metrics.width, 1600);
  assert.equal(quality.metrics.height, 2400);
});

test('analyzeImageMetadata falls back to dimension-only checks', () => {
  const quality = analyzeImageMetadata({
    width: 800,
    height: 700,
    source: 'inbox'
  });

  assert.deepEqual(
    quality.flags.map((flag) => flag.code),
    ['low-resolution', 'orientation-suspect']
  );
  assert.equal(quality.source, 'inbox');
});

test('normalizeImageQuality keeps explicit ignored state and drops unknown flags', () => {
  const quality = normalizeImageQuality({
    source: 'camera',
    ignored: true,
    metrics: { width: 10, height: 20 },
    flags: [
      { code: 'dark-capture', severity: 'medium', message: 'Oscura' },
      { code: '', message: 'sin codigo' }
    ]
  });

  assert.equal(quality.ignored, true);
  assert.equal(quality.ok, true);
  assert.equal(quality.flags.length, 1);
  assert.equal(captureQualityNeedsReview(quality), false);
}
);
