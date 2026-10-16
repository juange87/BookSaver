import assert from 'node:assert/strict';
import { test } from 'node:test';

import { startCaptureSession, summarizeCaptureSession } from '../public/capture-session.js';

const page = (id, number) => ({ id, number });

test('startCaptureSession records existing page ids', () => {
  assert.deepEqual(startCaptureSession([page('a', 1), page('b', 2)]), { baselineIds: ['a', 'b'] });
  assert.deepEqual(startCaptureSession(undefined), { baselineIds: [] });
});

test('summarizeCaptureSession reports nothing without a session or new pages', () => {
  const empty = { count: 0, newPageIds: [], firstPageId: null, contiguous: false, range: null };
  assert.deepEqual(summarizeCaptureSession(null, [page('a', 1)]), empty);
  assert.deepEqual(summarizeCaptureSession({ baselineIds: ['a'] }, [page('a', 1)]), empty);
});

test('summarizeCaptureSession finds pages appended during the session', () => {
  const session = { baselineIds: ['a', 'b'] };
  const summary = summarizeCaptureSession(session, [page('a', 1), page('b', 2), page('c', 3), page('d', 4)]);
  assert.deepEqual(summary, {
    count: 2,
    newPageIds: ['c', 'd'],
    firstPageId: 'c',
    contiguous: true,
    range: { start: 3, end: 4 }
  });
});

test('summarizeCaptureSession flags new pages that are no longer consecutive', () => {
  const session = { baselineIds: ['a', 'b'] };
  const summary = summarizeCaptureSession(session, [page('c', 1), page('a', 2), page('b', 3), page('d', 4)]);
  assert.equal(summary.count, 2);
  assert.equal(summary.firstPageId, 'c');
  assert.equal(summary.contiguous, false);
  assert.equal(summary.range, null);
});

test('summarizeCaptureSession ignores deleted baseline pages', () => {
  const session = { baselineIds: ['a', 'b'] };
  const summary = summarizeCaptureSession(session, [page('a', 1), page('c', 2)]);
  assert.deepEqual(summary.newPageIds, ['c']);
  assert.deepEqual(summary.range, { start: 2, end: 2 });
});
