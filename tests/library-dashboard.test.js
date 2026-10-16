import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  filterLibraryProjects,
  formatLibrarySummaryLine,
  libraryCardCover,
  progressStatusLabel,
  summarizeLibraryDashboard
} from '../public/library-dashboard.js';

test('summarizeLibraryDashboard aggregates local project progress', () => {
  const summary = summarizeLibraryDashboard([
    {
      progress: {
        pageCount: 10,
        reviewedPercent: 80,
        pendingProblemCount: 2,
        exportStatus: 'needs-attention'
      }
    },
    {
      progress: {
        pageCount: 5,
        reviewedPercent: 100,
        pendingProblemCount: 0,
        exportStatus: 'ready'
      }
    }
  ]);

  assert.deepEqual(summary, {
    bookCount: 2,
    pageCount: 15,
    averageReviewedPercent: 90,
    pendingProblemCount: 2,
    readyCount: 1,
    attentionCount: 1
  });
});

test('progressStatusLabel returns Spanish labels for dashboard cards', () => {
  assert.equal(progressStatusLabel('ready'), 'Listo para exportar');
  assert.equal(progressStatusLabel('needs-attention'), 'Revisar antes de exportar');
  assert.equal(progressStatusLabel('empty'), 'Sin páginas');
});

test('filterLibraryProjects supports continuity dashboard filters', () => {
  const projects = [
    { id: 'capture', progress: { exportStatus: 'empty' } },
    { id: 'review', progress: { exportStatus: 'needs-attention' } },
    { id: 'ready', progress: { exportStatus: 'ready' } },
    { id: 'exported', progress: { exportStatus: 'exported' } }
  ];

  assert.deepEqual(filterLibraryProjects(projects, 'capture').map((project) => project.id), ['capture']);
  assert.deepEqual(filterLibraryProjects(projects, 'review').map((project) => project.id), ['review']);
  assert.deepEqual(filterLibraryProjects(projects, 'ready').map((project) => project.id), ['ready']);
  assert.deepEqual(filterLibraryProjects(projects, 'exported').map((project) => project.id), ['exported']);
});

test('formatLibrarySummaryLine pluralizes books and keeps all key figures', () => {
  assert.equal(
    formatLibrarySummaryLine({ bookCount: 1, pageCount: 15, averageReviewedPercent: 73, pendingProblemCount: 0 }),
    '1 libro · 15 páginas · 73 % revisado · 0 problemas'
  );
  assert.equal(
    formatLibrarySummaryLine({ bookCount: 2, pageCount: 1, averageReviewedPercent: 0, pendingProblemCount: 1 }),
    '2 libros · 1 página · 0 % revisado · 1 problema'
  );
});

test('libraryCardCover returns null without a cover and a versioned url otherwise', () => {
  assert.deepEqual(libraryCardCover({ id: 'p1' }), { url: null });
  assert.deepEqual(libraryCardCover({ id: 'p1', cover: { mode: 'none' } }), { url: null });
  assert.deepEqual(
    libraryCardCover({ id: 'p1', cover: { mode: 'page', pageId: 'x', updatedAt: '2026-10-15T10:00:00Z' } }),
    { url: '/api/projects/p1/cover/image?2026-10-15T10%3A00%3A00Z' }
  );
  assert.deepEqual(
    libraryCardCover({ id: 'p 2', cover: { mode: 'upload' }, updatedAt: 'v1' }),
    { url: '/api/projects/p%202/cover/image?v1' }
  );
});
