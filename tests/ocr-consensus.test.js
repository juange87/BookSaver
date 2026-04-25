import assert from 'node:assert/strict';
import { test } from 'node:test';

import { buildConsensusResult, lineSimilarity } from '../src/lib/ocr-consensus.js';

function result(id, engine, lines) {
  return {
    id,
    provider: 'local',
    engine,
    profile: 'original',
    language: 'es',
    status: 'ocr-complete',
    text: lines.map((line) => line.text).join('\n'),
    layout: {
      lines,
      blocks: lines.map((line) => ({
        type: 'paragraph',
        text: line.text,
        confidence: line.confidence
      }))
    },
    warning: null
  };
}

test('lineSimilarity recognizes near-identical OCR lines', () => {
  assert.ok(lineSimilarity('El molino estaba quieto.', 'El molino estaba quieto') > 0.9);
  assert.ok(lineSimilarity('El molino estaba quieto.', 'zzzz xxxx') < 0.4);
});

test('buildConsensusResult chooses higher-confidence line when candidates differ slightly', () => {
  const consensus = buildConsensusResult([
    result('apple-vision:original', 'apple-vision', [
      { text: 'El molino estaba quleto.', confidence: 71, left: 0, top: 0, width: 100, height: 20 },
      { text: 'La tarde caia sobre el campo.', confidence: 88, left: 0, top: 30, width: 100, height: 20 }
    ]),
    result('tesseract:psm4', 'tesseract', [
      { text: 'El molino estaba quieto.', confidence: 92, left: 0, top: 0, width: 100, height: 20 },
      { text: 'La tarde caia sobre el campo.', confidence: 82, left: 0, top: 30, width: 100, height: 20 }
    ])
  ]);

  assert.equal(consensus.engine, 'consensus');
  assert.equal(consensus.text, 'El molino estaba quieto.\n\nLa tarde caia sobre el campo.');
  assert.equal(consensus.layout.source, 'ocr-consensus');
  assert.equal(consensus.status, 'ocr-complete');
});
