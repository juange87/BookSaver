import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  filterLibraryProjects,
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
