import assert from 'node:assert/strict';
import { test } from 'node:test';

import { buildLayoutFromTsv, buildLayoutFromVision, layoutToText, textToBlocks } from '../src/lib/layout.js';

const SAMPLE_TSV = `level\tpage_num\tblock_num\tpar_num\tline_num\tword_num\tleft\ttop\twidth\theight\tconf\ttext
1\t1\t0\t0\t0\t0\t0\t0\t1000\t1400\t-1\t
5\t1\t1\t1\t1\t1\t300\t100\t40\t20\t95\tEl
5\t1\t1\t1\t1\t2\t350\t100\t70\t20\t95\tmiedo,
5\t1\t1\t1\t1\t3\t430\t100\t80\t20\t95\tme
5\t1\t1\t1\t1\t4\t520\t100\t80\t20\t95\tdijo
5\t1\t1\t1\t2\t1\t300\t130\t80\t20\t95\tmi
5\t1\t1\t1\t2\t2\t390\t130\t110\t20\t95\tpadre
5\t1\t1\t1\t2\t3\t510\t130\t120\t20\t95\tuna
5\t1\t1\t1\t2\t4\t640\t130\t60\t20\t95\tvez
5\t1\t1\t2\t1\t1\t420\t210\t70\t20\t92\tESPERA.
5\t1\t1\t2\t1\t2\t500\t210\t80\t20\t92\tCORRE.
5\t1\t1\t3\t1\t1\t300\t290\t80\t20\t93\tLas
5\t1\t1\t3\t1\t2\t390\t290\t120\t20\t93\tpalabras
5\t1\t1\t3\t1\t3\t520\t290\t90\t20\t93\tapenas
5\t1\t1\t3\t2\t1\t330\t320\t70\t20\t93\tson
5\t1\t1\t3\t2\t2\t410\t320\t120\t20\t93\tvisibles
`;

test('buildLayoutFromTsv reconstructs paragraphs and centered text', () => {
  const layout = buildLayoutFromTsv(SAMPLE_TSV);

  assert.equal(layout.blocks.length, 3);
  assert.equal(layout.blocks[0].type, 'paragraph');
  assert.equal(layout.blocks[0].text, 'El miedo, me dijo mi padre una vez');
  assert.equal(layout.blocks[1].type, 'heading');
  assert.equal(layout.blocks[1].text, 'ESPERA. CORRE.');
  assert.equal(layout.blocks[2].text, 'Las palabras apenas son visibles');
});

test('layoutToText returns reviewable text with paragraph breaks', () => {
  const layout = buildLayoutFromTsv(SAMPLE_TSV);

  assert.equal(
    layoutToText(layout),
    'El miedo, me dijo mi padre una vez\n\nESPERA. CORRE.\n\nLas palabras apenas son visibles'
  );
});

test('textToBlocks keeps plain edited text exportable', () => {
  assert.deepEqual(textToBlocks('UNO\n\nDos lineas\ncon corte'), [
    { type: 'heading', text: 'UNO', indent: true },
    { type: 'paragraph', text: 'Dos lineas con corte', indent: true }
  ]);
});

test('buildLayoutFromVision reconstructs OCR observations', () => {
  const layout = buildLayoutFromVision({
    page: { width: 1000, height: 1400 },
    lines: [
      { text: 'EL TITULO', left: 420, top: 120, width: 160, height: 22, confidence: 98 },
      { text: 'Primer parrafo con texto', left: 300, top: 220, width: 360, height: 20, confidence: 96 },
      { text: 'que sigue en otra linea.', left: 300, top: 252, width: 320, height: 20, confidence: 96 }
    ]
  });

  assert.equal(layout.source, 'apple-vision');
  assert.equal(layout.blocks[0].type, 'heading');
  assert.equal(layout.blocks[1].text, 'Primer parrafo con texto que sigue en otra linea.');
});
