import assert from 'node:assert/strict';
import { test } from 'node:test';

import { buildImageReviewModeState } from '../public/editor-image-review-mode.js';

test('buildImageReviewModeState keeps normal mode closed with an available page', () => {
  const state = buildImageReviewModeState({ expanded: false, hasPage: true });

  assert.equal(state.expanded, false);
  assert.equal(state.workspaceClass, '');
  assert.equal(state.buttonText, 'Ver página grande');
  assert.equal(state.buttonAriaPressed, 'false');
  assert.equal(state.buttonDisabled, false);
});

test('buildImageReviewModeState opens large page mode with a close action', () => {
  const state = buildImageReviewModeState({ expanded: true, hasPage: true });

  assert.equal(state.expanded, true);
  assert.equal(state.workspaceClass, 'large-page-mode');
  assert.equal(state.buttonText, 'Cerrar página grande');
  assert.equal(state.buttonAriaPressed, 'true');
  assert.equal(state.buttonDisabled, false);
});

test('buildImageReviewModeState disables large page mode without a page', () => {
  const state = buildImageReviewModeState({ expanded: true, hasPage: false });

  assert.equal(state.expanded, false);
  assert.equal(state.workspaceClass, '');
  assert.equal(state.buttonText, 'Ver página grande');
  assert.equal(state.buttonAriaPressed, 'false');
  assert.equal(state.buttonDisabled, true);
});
