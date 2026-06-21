import assert from 'node:assert/strict';
import { test } from 'node:test';

import { chooseNextReviewProblem, reviewProblemStatusText } from '../public/review-queue.js';

test('chooseNextReviewProblem starts with the first queued problem when current page is clean', () => {
  const result = chooseNextReviewProblem(
    {
      items: [
        { pageId: 'page-0002', page: 2, reason: 'OCR de baja confianza.' },
        { pageId: 'page-0001', page: 1, reason: 'Texto pendiente de revision.' }
      ]
    },
    'page-0003'
  );

  assert.equal(result.status, 'found');
  assert.equal(result.item.pageId, 'page-0002');
});

test('chooseNextReviewProblem advances past the current queued page', () => {
  const result = chooseNextReviewProblem(
    {
      items: [
        { pageId: 'page-0002', page: 2, reason: 'OCR de baja confianza.' },
        { pageId: 'page-0001', page: 1, reason: 'Texto pendiente de revision.' }
      ]
    },
    'page-0002'
  );

  assert.equal(result.status, 'found');
  assert.equal(result.item.pageId, 'page-0001');
  assert.equal(reviewProblemStatusText(result.item), 'Siguiente problema: pagina 1. Texto pendiente de revision.');
});

test('chooseNextReviewProblem reports an empty queue with a user-facing message', () => {
  const result = chooseNextReviewProblem({ items: [] }, 'page-0001');

  assert.equal(result.status, 'empty');
  assert.equal(result.item, null);
  assert.equal(result.message, 'No quedan problemas pendientes en la cola de revision.');
});
