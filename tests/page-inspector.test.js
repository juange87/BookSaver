import assert from 'node:assert/strict';
import { test } from 'node:test';

import { buildPageInspectorSummary } from '../public/page-inspector.js';

test('buildPageInspectorSummary returns an empty state without a page', () => {
  const summary = buildPageInspectorSummary(null);

  assert.equal(summary.hasPage, false);
  assert.equal(summary.title, 'Sin página seleccionada');
  assert.deepEqual(summary.badges, []);
  assert.equal(summary.status, 'Elige una página para revisar su estado y estructura.');
});

test('buildPageInspectorSummary summarizes a reviewed text page with chapter structure', () => {
  const summary = buildPageInspectorSummary({
    number: 12,
    reviewed: true,
    editorial: {
      imageMode: 'text',
      chapterStart: true,
      chapterTitle: 'Capítulo primero',
      chapterEnd: true,
      chapterHeaderMode: 'auto'
    }
  });

  assert.equal(summary.hasPage, true);
  assert.equal(summary.title, 'Página 12');
  assert.equal(summary.status, 'Revisada · Texto OCR');
  assert.deepEqual(summary.badges, [
    'Inicio: Capítulo primero',
    'Fin de capítulo',
    'Cabecera auto'
  ]);
});

test('buildPageInspectorSummary makes image pages explicit', () => {
  const summary = buildPageInspectorSummary({
    number: 4,
    reviewed: false,
    editorial: {
      imageMode: 'image'
    }
  });

  assert.equal(summary.status, 'Pendiente · Imagen EPUB');
  assert.deepEqual(summary.badges, ['Imagen EPUB']);
});

test('buildPageInspectorSummary includes warning and marker counts from caller context', () => {
  const summary = buildPageInspectorSummary(
    {
      number: 8,
      reviewed: false,
      editorial: {
        imageMode: 'text',
        partStart: true,
        partTitle: 'Parte II'
      }
    },
    {
      needsReview: true,
      qualityFlagCount: 2,
      markerCount: 1,
      hasCrop: true,
      rotation: 90,
      hasCropSuggestion: true
    }
  );

  assert.equal(summary.status, 'Pendiente · Texto OCR · 3 avisos');
  assert.deepEqual(summary.badges, [
    'Pendiente',
    'Parte: Parte II',
    '2 avisos de captura',
    '1 marcador',
    'Recortada',
    'Recorte sugerido',
    'Giro 90°'
  ]);
});
