import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  normalizeCropSuggestion,
  suggestPageCropFromSample
} from '../src/lib/image-adjustments.js';

function borderedPageSample() {
  const width = 100;
  const height = 140;
  const pixels = [];

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const insidePage = x >= 12 && x <= 87 && y >= 10 && y <= 129;
      const value = insidePage ? 235 : 40;
      pixels.push(value, value, value, 255);
    }
  }

  return { width, height, pixels };
}

test('suggestPageCropFromSample proposes a crop around page-like borders', () => {
  const suggestion = suggestPageCropFromSample(borderedPageSample());

  assert.equal(suggestion.status, 'suggested');
  assert.equal(suggestion.source, 'border-detection');
  assert.ok(suggestion.confidence >= 0.6);
  assert.deepEqual(suggestion.crop, {
    left: 0.12,
    top: 0.0714,
    width: 0.76,
    height: 0.8571
  });
});

test('suggestPageCropFromSample returns null when borders are not reliable', () => {
  const pixels = Array.from({ length: 80 * 120 * 4 }, (_value, index) => (index + 1) % 4 === 0 ? 255 : 220);

  assert.equal(suggestPageCropFromSample({ width: 80, height: 120, pixels }), null);
});

test('normalizeCropSuggestion keeps accepted and rejected states bounded', () => {
  const accepted = normalizeCropSuggestion({
    status: 'accepted',
    crop: { left: 0.1, top: 0.2, width: 0.7, height: 0.6 },
    confidence: 1.4
  });
  const rejected = normalizeCropSuggestion({
    status: 'rejected',
    crop: { left: 0.1, top: 0.2, width: 0.7, height: 0.6 },
    confidence: -1
  });

  assert.equal(accepted.status, 'accepted');
  assert.equal(accepted.confidence, 1);
  assert.equal(rejected.status, 'rejected');
  assert.equal(rejected.confidence, 0);
});
