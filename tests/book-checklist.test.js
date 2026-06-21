import assert from 'node:assert/strict';
import { test } from 'node:test';

import { buildBookChecklist, buildReviewQueue } from '../src/lib/book-checklist.js';

function page(number, overrides = {}) {
  return {
    id: `page-${String(number).padStart(4, '0')}`,
    number,
    status: 'captured',
    reviewed: false,
    text: '',
    editorial: {
      imageMode: 'text',
      partStart: false,
      partTitle: '',
      chapterStart: false,
      chapterTitle: '',
      chapterEnd: false,
      chapterHeaderMode: 'none'
    },
    ...overrides,
    editorial: {
      imageMode: 'text',
      partStart: false,
      partTitle: '',
      chapterStart: false,
      chapterTitle: '',
      chapterEnd: false,
      chapterHeaderMode: 'none',
      ...(overrides.editorial || {})
    }
  };
}

test('buildBookChecklist returns deterministic actionable warnings for export readiness', () => {
  const check = buildBookChecklist({
    checkedAt: '2026-06-20T10:00:00.000Z',
    metadata: {
      id: 'book-1',
      title: 'Libro',
      language: 'es',
      cover: { mode: 'none' }
    },
    pages: [
      page(1),
      page(2, {
        status: 'ocr-complete',
        text: 'Texto dudoso',
        ocrLanguage: 'spa',
        ocrNeedsReview: true,
        ocrConfidence: 42,
        ocrQualityScore: 40
      }),
      page(3, {
        status: 'ocr-complete',
        text: 'Texto en otro idioma',
        ocrLanguage: 'eng'
      }),
      page(4, {
        editorial: {
          imageMode: 'image',
          partStart: true
        }
      }),
      page(5, {
        text: 'Inicio sin titulo',
        editorial: {
          chapterStart: true
        }
      }),
      page(6, {
        status: 'ocr-complete',
        text: 'Texto sin idioma OCR registrado'
      }),
      page(7, {
        text: 'Parte nueva dentro de capitulo abierto',
        editorial: {
          partStart: true,
          partTitle: 'Parte II'
        }
      })
    ]
  });

  assert.equal(check.ready, false);
  assert.equal(check.checkedAt, '2026-06-20T10:00:00.000Z');
  assert.deepEqual(
    check.warnings.map((warning) => warning.code),
    [
      'missing-cover',
      'missing-text',
      'low-confidence-ocr',
      'unreviewed-pages',
      'missing-ocr-language',
      'ocr-language-mismatch',
      'untitled-part',
      'untitled-chapter',
      'incoherent-structure'
    ]
  );

  for (const warning of check.warnings) {
    assert.equal(typeof warning.type, 'string');
    assert.equal(typeof warning.severity, 'string');
    assert.equal(typeof warning.message, 'string');
    assert.equal(typeof warning.action, 'string');
    assert.ok(warning.action.length > 10);
    assert.ok(warning.target?.kind);
  }

  assert.deepEqual(check.warnings.find((warning) => warning.code === 'missing-text').pages, [1]);
  assert.deepEqual(check.warnings.find((warning) => warning.code === 'low-confidence-ocr').pages, [2]);
  assert.deepEqual(check.warnings.find((warning) => warning.code === 'missing-ocr-language').pages, [6]);
  assert.deepEqual(check.warnings.find((warning) => warning.code === 'ocr-language-mismatch').pages, [3]);
  assert.deepEqual(check.warnings.find((warning) => warning.code === 'untitled-chapter').sections, [
    { type: 'chapter', page: 5, pageId: 'page-0005', title: '' }
  ]);
  assert.deepEqual(check.warnings.find((warning) => warning.code === 'incoherent-structure').pages, [7]);
});

test('buildBookChecklist reports incomplete title and OCR language metadata', () => {
  const check = buildBookChecklist({
    metadata: {
      title: 'Libro sin titulo',
      language: '',
      cover: { mode: 'page', pageId: 'page-0001' }
    },
    pages: [
      page(1, {
        text: 'Texto revisado',
        reviewed: true
      })
    ]
  });

  const metadataWarning = check.warnings.find((warning) => warning.code === 'metadata-incomplete');
  assert.ok(metadataWarning);
  assert.deepEqual(metadataWarning.fields, ['titulo', 'idioma OCR']);
  assert.equal(metadataWarning.scope, 'book');
  assert.equal(metadataWarning.action, 'Completa el titulo y el idioma OCR antes de exportar.');
});

test('buildBookChecklist is ready when cover, metadata, OCR and review signals are clean', () => {
  const check = buildBookChecklist({
    metadata: {
      title: 'Libro listo',
      language: 'es',
      cover: { mode: 'page', pageId: 'page-0001' }
    },
    pages: [
      page(1, {
        status: 'ocr-complete',
        text: 'Texto revisado',
        reviewed: true,
        ocrLanguage: 'spa',
        ocrConfidence: 95,
        ocrQualityScore: 88,
        editorial: {
          chapterStart: true,
          chapterTitle: 'Capitulo 1'
        }
      })
    ]
  });

  assert.equal(check.ready, true);
  assert.equal(check.warningCount, 0);
  assert.deepEqual(check.warnings, []);
});

test('buildReviewQueue prioritizes actionable page problems deterministically', () => {
  const queue = buildReviewQueue({
    pages: [
      page(1, {
        status: 'ocr-complete',
        text: 'Texto pendiente',
        reviewed: false
      }),
      page(2, {
        status: 'ocr-complete',
        text: 'Texto dudoso',
        reviewed: false,
        ocrNeedsReview: true,
        ocrConfidence: 42
      }),
      page(3),
      page(4, {
        status: 'ocr-complete',
        text: 'Texto con estructura pendiente',
        reviewed: true,
        layoutStale: true
      }),
      page(5, {
        status: 'ocr-complete',
        text: 'Texto listo',
        reviewed: true
      })
    ]
  });

  assert.equal(queue.ready, false);
  assert.equal(queue.itemCount, 4);
  assert.deepEqual(
    queue.items.map((item) => item.code),
    ['missing-text', 'low-confidence-ocr', 'unreviewed-page', 'structure-pending']
  );
  assert.deepEqual(
    queue.items.map((item) => item.page),
    [3, 2, 1, 4]
  );

  for (const item of queue.items) {
    assert.equal(typeof item.pageId, 'string');
    assert.equal(typeof item.severity, 'string');
    assert.equal(typeof item.reason, 'string');
    assert.equal(typeof item.action, 'string');
    assert.ok(item.action.length > 10);
  }
});

test('buildBookChecklist and buildReviewQueue include active capture quality warnings', () => {
  const page = {
    id: 'page-0001',
    number: 1,
    status: 'captured',
    text: '',
    quality: {
      ok: false,
      ignored: false,
      source: 'capture',
      metrics: { width: 900, height: 600 },
      flags: [
        {
          code: 'low-resolution',
          severity: 'high',
          message: 'La captura tiene poca resolucion para OCR fiable.',
          cause: 'Resolucion 900 x 600.'
        }
      ]
    }
  };

  const checklist = buildBookChecklist({
    metadata: {
      title: 'Libro',
      language: 'es',
      cover: { mode: 'page', pageId: 'page-0001' }
    },
    pages: [page]
  });
  const queue = buildReviewQueue({ pages: [page] });

  assert.ok(checklist.warnings.some((warning) => warning.code === 'capture-quality'));
  assert.equal(queue.items[0].code, 'capture-quality');
  assert.match(queue.items[0].reason, /calidad/i);
});

test('buildBookChecklist ignores capture quality warnings dismissed by the user', () => {
  const checklist = buildBookChecklist({
    metadata: {
      title: 'Libro',
      language: 'es',
      cover: { mode: 'page', pageId: 'page-0001' }
    },
    pages: [
      {
        id: 'page-0001',
        number: 1,
        status: 'captured',
        text: '',
        quality: {
          ok: true,
          ignored: true,
          flags: [
            {
              code: 'dark-capture',
              severity: 'high',
              message: 'La captura esta oscura.'
            }
          ]
        }
      }
    ]
  });

  assert.equal(checklist.warnings.some((warning) => warning.code === 'capture-quality'), false);
});

test('buildReviewQueue returns an empty ready queue when no page needs review', () => {
  const queue = buildReviewQueue({
    pages: [
      page(1, {
        status: 'ocr-complete',
        text: 'Texto revisado',
        reviewed: true,
        ocrConfidence: 96,
        ocrQualityScore: 91,
        editorial: {
          chapterStart: true,
          chapterTitle: 'Capitulo 1'
        }
      }),
      page(2, {
        text: '',
        reviewed: false,
        editorial: {
          imageMode: 'image'
        }
      })
    ]
  });

  assert.equal(queue.ready, true);
  assert.equal(queue.itemCount, 0);
  assert.deepEqual(queue.items, []);
  assert.equal(queue.summary, 'No quedan paginas pendientes de revision.');
});
