import assert from 'node:assert/strict';
import { test } from 'node:test';

import { WORKSPACE_VIEWS, buildShellState, resolveView } from '../public/app-shell.js';

const project = (pageCount) => ({
  id: 'p1',
  title: 'La Fuerza de Pocos',
  pages: Array.from({ length: pageCount }, (_, index) => ({ id: `pg${index}` }))
});

test('WORKSPACE_VIEWS lists the book modes in order', () => {
  assert.deepEqual(WORKSPACE_VIEWS, ['capture', 'editor', 'reading']);
});

test('resolveView falls back to library when no book is open', () => {
  assert.equal(resolveView('editor', { hasProject: false }), 'library');
  assert.equal(resolveView('capture', { hasProject: false }), 'library');
  assert.equal(resolveView('library', { hasProject: false }), 'library');
});

test('resolveView keeps known views when a book is open and rejects unknown ones', () => {
  assert.equal(resolveView('reading', { hasProject: true }), 'reading');
  assert.equal(resolveView('library', { hasProject: true }), 'library');
  assert.equal(resolveView('nope', { hasProject: true }), 'library');
});

test('buildShellState uses the library topbar on library and workspace topbar on book modes', () => {
  assert.equal(buildShellState({ view: 'library', project: project(3) }).topbar, 'library');
  assert.equal(buildShellState({ view: 'editor', project: project(3) }).topbar, 'workspace');
});

test('buildShellState forces library when there is no project', () => {
  const shell = buildShellState({ view: 'editor', project: null });
  assert.equal(shell.view, 'library');
  assert.equal(shell.topbar, 'library');
  assert.equal(shell.exportDisabled, true);
  assert.equal(shell.bookStatus, 'Sin libro abierto');
});

test('buildShellState disables export for empty books and while busy', () => {
  assert.equal(buildShellState({ view: 'editor', project: project(0) }).exportDisabled, true);
  assert.equal(buildShellState({ view: 'editor', project: project(2), busy: true }).exportDisabled, true);
  assert.equal(buildShellState({ view: 'editor', project: project(2), busy: false }).exportDisabled, false);
});

test('buildShellState pluralizes the book status with accents', () => {
  assert.equal(buildShellState({ view: 'editor', project: project(1) }).bookStatus, '1 página');
  assert.equal(buildShellState({ view: 'editor', project: project(15) }).bookStatus, '15 páginas');
});

test('buildShellState raises the settings alert only when an update is available', () => {
  assert.equal(buildShellState({ view: 'library', project: null, system: null }).settingsAlert, false);
  assert.equal(
    buildShellState({ view: 'library', project: null, system: { update: { available: false } } }).settingsAlert,
    false
  );
  assert.equal(
    buildShellState({ view: 'library', project: null, system: { update: { available: true } } }).settingsAlert,
    true
  );
});
