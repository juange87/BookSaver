# Editor Inspector Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reorganize the Editar view so page structure, review state, markers, quality, dictionary, suspicious words, and text history live in a permanent page inspector instead of hidden sub-tabs.

**Architecture:** Keep the existing vanilla HTML/CSS/JS app. Add one small pure helper module for inspector summaries, then move existing DOM controls into a right-side inspector using native `<details>` accordions. Preserve existing element IDs and backend routes so storage/API behavior does not change.

**Tech Stack:** Native ES modules, browser DOM APIs, CSS grid, native `<details>/<summary>`, `node:test`, existing local HTTP server.

---

## Scope Check

This plan implements only the approved spec at `docs/superpowers/specs/2026-07-06-editor-inspector-redesign-design.md`.

Included:

- Editar view layout.
- Permanent page inspector.
- `Estructura EPUB` open by default.
- Search and range actions moved to lower visual priority.
- Desktop and mobile responsive behavior.

Excluded:

- Capturar view redesign.
- iPhone local-network URL bug.
- API or data-model changes.
- New framework or build tooling.

## File Structure

- Create `public/page-inspector.js`: pure summary builder for the inspector header. No DOM access.
- Create `tests/page-inspector.test.js`: unit coverage for no page, reviewed text page, image page, warnings, and editorial badges.
- Modify `public/index.html`: remove the text/structure sub-tab shell, add `aside.page-inspector`, move existing controls into inspector sections while preserving IDs.
- Modify `public/app.js`: import the helper, add selector bindings for new inspector summary nodes, render inspector state, and adjust focus behavior that used to switch to the structure tab.
- Modify `public/styles.css`: three-column editor grid, sticky inspector, inspector summary, accordions, compact search/range panels, responsive stacking.

---

### Task 1: Add A Testable Inspector Summary Helper

**Files:**
- Create: `public/page-inspector.js`
- Create: `tests/page-inspector.test.js`

- [ ] **Step 1: Write the failing tests**

Create `tests/page-inspector.test.js`:

```js
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
```

- [ ] **Step 2: Run the failing test**

Run:

```sh
node --test tests/page-inspector.test.js
```

Expected: fail with `ERR_MODULE_NOT_FOUND` for `public/page-inspector.js`.

- [ ] **Step 3: Implement the helper**

Create `public/page-inspector.js`:

```js
function normalizedEditorial(page = {}) {
  const editorial = page.editorial || {};
  const imageMode = editorial.imageMode === 'image' ? 'image' : 'text';
  const chapterHeaderMode =
    editorial.chapterHeaderMode === 'auto' || editorial.chapterHeaderMode === 'page'
      ? editorial.chapterHeaderMode
      : 'none';

  return {
    imageMode,
    partStart: Boolean(editorial.partStart),
    partTitle: String(editorial.partTitle || '').trim(),
    chapterStart: Boolean(editorial.chapterStart),
    chapterTitle: String(editorial.chapterTitle || '').trim(),
    chapterEnd: Boolean(editorial.chapterEnd),
    chapterHeaderMode: editorial.chapterStart ? chapterHeaderMode : 'none'
  };
}

function plural(value, singular, pluralLabel) {
  return `${value} ${value === 1 ? singular : pluralLabel}`;
}

export function buildPageInspectorSummary(page, context = {}) {
  if (!page) {
    return {
      hasPage: false,
      title: 'Sin página seleccionada',
      status: 'Elige una página para revisar su estado y estructura.',
      badges: []
    };
  }

  const editorial = normalizedEditorial(page);
  const reviewed = Boolean(page.reviewed);
  const warningCount =
    (context.needsReview ? 1 : 0) + Number(context.qualityFlagCount || 0);
  const status = [
    reviewed ? 'Revisada' : 'Pendiente',
    editorial.imageMode === 'image' ? 'Imagen EPUB' : 'Texto OCR',
    warningCount ? plural(warningCount, 'aviso', 'avisos') : ''
  ].filter(Boolean);
  const badges = [];

  if (context.needsReview) {
    badges.push('Pendiente');
  }
  if (editorial.partStart) {
    badges.push(editorial.partTitle ? `Parte: ${editorial.partTitle}` : 'Inicio de parte');
  }
  if (editorial.chapterStart) {
    badges.push(editorial.chapterTitle ? `Inicio: ${editorial.chapterTitle}` : 'Inicio de capítulo');
  }
  if (editorial.chapterEnd) {
    badges.push('Fin de capítulo');
  }
  if (editorial.imageMode === 'image') {
    badges.push('Imagen EPUB');
  }
  if (editorial.chapterHeaderMode === 'auto') {
    badges.push('Cabecera auto');
  }
  if (editorial.chapterHeaderMode === 'page') {
    badges.push('Cabecera completa');
  }
  if (context.qualityFlagCount) {
    badges.push(plural(context.qualityFlagCount, 'aviso de captura', 'avisos de captura'));
  }
  if (context.markerCount) {
    badges.push(plural(context.markerCount, 'marcador', 'marcadores'));
  }
  if (context.hasCrop) {
    badges.push('Recortada');
  }
  if (context.hasCropSuggestion) {
    badges.push('Recorte sugerido');
  }
  if (context.rotation) {
    badges.push(`Giro ${context.rotation}°`);
  }

  return {
    hasPage: true,
    title: Number(page.number) ? `Página ${page.number}` : 'Página seleccionada',
    status: status.join(' · '),
    badges
  };
}
```

- [ ] **Step 4: Verify the helper test passes**

Run:

```sh
node --test tests/page-inspector.test.js
```

Expected: 4 passing tests.

- [ ] **Step 5: Commit**

Run:

```sh
git add public/page-inspector.js tests/page-inspector.test.js
git commit -m "test: add page inspector summary"
```

---

### Task 2: Move Existing Controls Into The Inspector Markup

**Files:**
- Modify: `public/index.html`

- [ ] **Step 1: Replace the editor sub-tab shell with a text-only main column**

In `public/index.html`, inside `<div class="review-column">`, remove the `<div class="editor-tabs" ...>` block and keep the text editor content directly as the central review column:

```html
<div class="review-column">
  <section id="textPane" class="editor-pane editor-pane-main" role="region" aria-labelledby="textPaneTitle">
    <div class="pane-heading">
      <div>
        <span class="eyebrow">Texto OCR</span>
        <h3 id="textPaneTitle">Texto y vista EPUB</h3>
      </div>
      <button id="saveTextButton" type="button" disabled>Guardar texto</button>
    </div>
    <div class="text-review">
      <textarea
        id="ocrText"
        placeholder="Aquí aparecerá el texto extraído..."
        disabled
      ></textarea>
      <div class="preview-panel">
        <span class="eyebrow">Vista EPUB</span>
        <div id="formattedPreview"></div>
      </div>
    </div>
  </section>
</div>
```

This preserves `textPane`, `saveTextButton`, `ocrText`, and `formattedPreview`.

- [ ] **Step 2: Add the right-side inspector after `review-column`**

Still inside `<div class="editor-workspace">`, add this sibling after `</div><!-- review-column -->`:

```html
<aside class="page-inspector" aria-labelledby="pageInspectorTitle">
  <section class="page-inspector-summary" aria-live="polite">
    <span class="eyebrow">Inspector</span>
    <h3 id="pageInspectorTitle">Sin página seleccionada</h3>
    <p id="pageInspectorStatus">Elige una página para revisar su estado y estructura.</p>
    <div id="pageInspectorBadges" class="page-inspector-badges"></div>
  </section>

  <details class="page-inspector-section" open>
    <summary>
      <span>Estructura EPUB</span>
      <small id="editorialStatus">Elige una página para marcar su estructura EPUB.</small>
    </summary>
    <div class="page-inspector-section-body">
      <div class="editorial-grid">
        <label class="checkbox-label review-checkbox">
          <input id="pageReviewedInput" type="checkbox" />
          Página revisada
        </label>
        <label class="checkbox-label">
          <input id="pageImageModeInput" type="checkbox" />
          Esta página es una imagen
        </label>
        <label class="checkbox-label">
          <input id="partStartInput" type="checkbox" />
          Inicio de parte
        </label>
        <label>
          Nombre de la parte
          <input id="partTitleInput" type="text" autocomplete="off" />
        </label>
        <label class="checkbox-label">
          <input id="chapterStartInput" type="checkbox" />
          Inicio de capítulo
        </label>
        <label>
          Nombre del capítulo
          <input id="chapterTitleInput" type="text" autocomplete="off" />
        </label>
        <label>
          Cabecera del capítulo
          <select id="chapterHeaderModeInput">
            <option value="none">Sin cabecera</option>
            <option value="auto">Auto desde esta captura</option>
            <option value="page">Usar captura completa</option>
          </select>
        </label>
        <label class="checkbox-label">
          <input id="chapterEndInput" type="checkbox" />
          Fin de capítulo
        </label>
      </div>
      <div class="editor-actions-row">
        <button id="saveEditorialButton" type="button" disabled>
          Guardar estructura
        </button>
      </div>
    </div>
  </details>

  <details class="page-inspector-section">
    <summary>
      <span>Calidad y ajustes</span>
      <small>Captura, OCR visual y recorte sugerido</small>
    </summary>
    <div class="page-inspector-section-body">
      <section id="qualityPanel" class="quality-panel" hidden>
        <div>
          <strong id="qualityTitle">Avisos de captura</strong>
          <ul id="qualityList"></ul>
        </div>
        <button id="ignoreQualityButton" type="button" class="subtle">
          Ignorar avisos
        </button>
      </section>
      <section id="cropSuggestionPanel" class="quality-panel" hidden>
        <div>
          <strong>Sugerencia de recorte</strong>
          <p id="cropSuggestionStatus">BookSaver ha detectado los bordes de la página.</p>
        </div>
        <div class="inline-actions">
          <button id="acceptCropSuggestionButton" type="button" class="ghost">
            Usar recorte
          </button>
          <button id="rejectCropSuggestionButton" type="button" class="subtle">
            Descartar
          </button>
        </div>
      </section>
    </div>
  </details>

  <details class="page-inspector-section">
    <summary>
      <span>Marcadores y notas</span>
      <small>Volver rápido a páginas importantes</small>
    </summary>
    <div class="page-inspector-section-body">
      <section class="markers-panel" aria-labelledby="markersTitle">
        <div>
          <span class="eyebrow">Marcadores</span>
          <h3 id="markersTitle">Notas de revisión</h3>
        </div>
        <div id="pageMarkerTags" class="marker-tags"></div>
        <label class="marker-note-label">
          Nota
          <textarea
            id="pageMarkerNote"
            rows="2"
            maxlength="500"
            placeholder="Detalle breve para volver aquí..."
            disabled
          ></textarea>
        </label>
        <div class="editor-actions-row">
          <button id="saveMarkersButton" type="button" class="ghost" disabled>
            Guardar marcadores
          </button>
        </div>
      </section>
    </div>
  </details>

  <details class="page-inspector-section">
    <summary>
      <span>Diccionario y dudas</span>
      <small>Vocabulario local y palabras sospechosas</small>
    </summary>
    <div class="page-inspector-section-body">
      <section class="dictionary-panel" aria-labelledby="dictionaryTitle">
        <div>
          <span class="eyebrow">Diccionario local</span>
          <h3 id="dictionaryTitle">Vocabulario del libro</h3>
        </div>
        <div class="dictionary-editor">
          <input
            id="dictionaryTermInput"
            type="text"
            placeholder="Nombre propio, término raro..."
            autocomplete="off"
          />
          <button id="addDictionaryTermButton" type="button" class="ghost" disabled>
            Añadir
          </button>
        </div>
        <ul id="dictionaryTermsList" class="dictionary-list"></ul>
        <div class="replacement-editor">
          <input
            id="replacementFromInput"
            type="text"
            placeholder="Buscar"
            autocomplete="off"
          />
          <input
            id="replacementToInput"
            type="text"
            placeholder="Reemplazar por"
            autocomplete="off"
          />
          <button id="addReplacementButton" type="button" class="ghost" disabled>
            Guardar par
          </button>
        </div>
        <ul id="replacementList" class="dictionary-list"></ul>
        <div class="replacement-actions">
          <button id="previewReplacementsButton" type="button" class="subtle" disabled>
            Previsualizar página
          </button>
          <button id="applyReplacementsButton" type="button" class="ghost" disabled>
            Aplicar a página
          </button>
        </div>
        <p id="replacementPreviewStatus" class="editor-status"></p>
      </section>

      <section class="suspicious-panel" aria-labelledby="suspiciousTitle">
        <div>
          <span class="eyebrow">Revisión rápida</span>
          <h3 id="suspiciousTitle">Palabras dudosas</h3>
        </div>
        <div class="suspicious-actions">
          <button id="scanSuspiciousButton" type="button" class="subtle" disabled>
            Buscar dudas
          </button>
          <button id="acceptSuspiciousButton" type="button" class="ghost" disabled>
            Aceptar
          </button>
          <button id="replaceSuspiciousButton" type="button" class="ghost" disabled>
            Corregir
          </button>
        </div>
        <p id="suspiciousStatus" class="editor-status">
          Busca palabras con dígitos, símbolos raros o patrones poco habituales.
        </p>
        <ol id="suspiciousList" class="suspicious-list"></ol>
      </section>
    </div>
  </details>

  <details class="page-inspector-section">
    <summary>
      <span>Historial de texto</span>
      <small>Versiones anteriores restaurables</small>
    </summary>
    <div class="page-inspector-section-body">
      <section class="text-history-panel" aria-labelledby="textHistoryTitle">
        <div>
          <span class="eyebrow">Historial local</span>
          <h3 id="textHistoryTitle">Versiones de texto</h3>
        </div>
        <p id="textHistoryStatus" class="editor-status">
          Elige una página para ver versiones anteriores.
        </p>
        <ol id="textHistoryList" class="text-history-list"></ol>
      </section>
    </div>
  </details>
</aside>
```

- [ ] **Step 3: Remove duplicated old panel markup**

Remove the original `structurePane`, `markers-panel`, `dictionary-panel`, `suspicious-panel`, `text-history-panel`, `qualityPanel`, and `cropSuggestionPanel` blocks from their old positions after moving them. Keep `adjustmentComparePanel` in the image column because it displays before/after images.

- [ ] **Step 4: Check HTML-sensitive selectors still exist**

Run:

```sh
rg -n "id=\"(pageInspectorTitle|pageInspectorStatus|pageInspectorBadges|pageReviewedInput|chapterEndInput|saveEditorialButton|ocrText|formattedPreview|qualityPanel|pageMarkerTags|dictionaryTermsList|suspiciousList|textHistoryList)\"" public/index.html
```

Expected: each ID appears exactly once.

- [ ] **Step 5: Commit**

Run:

```sh
git add public/index.html
git commit -m "refactor: add editor page inspector markup"
```

---

### Task 3: Style The Three-Column Editor And Inspector Accordions

**Files:**
- Modify: `public/styles.css`

- [ ] **Step 1: Update the editor workspace grid**

Replace the existing `.editor-workspace` block with:

```css
.editor-workspace {
  display: grid;
  grid-template-columns:
    minmax(280px, 0.72fr)
    minmax(520px, 1.42fr)
    minmax(300px, 0.86fr);
  gap: 18px;
  align-items: start;
}
```

- [ ] **Step 2: Add central pane heading and inspector styles**

Add after the `.editor-pane[hidden]` block:

```css
.editor-pane-main {
  padding: 0;
}

.pane-heading {
  display: flex;
  align-items: start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}

.pane-heading h3 {
  margin: 2px 0 0;
  font-family: var(--sans);
  font-size: 18px;
}

.page-inspector {
  position: sticky;
  top: 92px;
  display: grid;
  gap: 10px;
  align-self: start;
  min-width: 0;
}

.page-inspector-summary,
.page-inspector-section {
  border: 1px solid var(--line);
  border-radius: var(--radius-sm);
  background: var(--surface);
}

.page-inspector-summary {
  display: grid;
  gap: 8px;
  padding: 14px;
}

.page-inspector-summary h3 {
  margin: 0;
  font-family: var(--sans);
  font-size: 18px;
}

.page-inspector-summary p {
  margin: 0;
  color: var(--muted);
  font-size: 13px;
  line-height: 1.4;
}

.page-inspector-badges {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.page-inspector-badges span {
  padding: 4px 7px;
  border: 1px solid rgba(200, 116, 27, 0.25);
  border-radius: var(--radius-sm);
  color: var(--accent-strong);
  background: var(--accent-soft);
  font-size: 12px;
  font-weight: 650;
}

.page-inspector-section {
  overflow: hidden;
}

.page-inspector-section summary {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 3px;
  padding: 12px 14px;
  cursor: pointer;
  list-style: none;
}

.page-inspector-section summary::-webkit-details-marker {
  display: none;
}

.page-inspector-section summary span {
  color: var(--ink);
  font-weight: 750;
}

.page-inspector-section summary small {
  color: var(--muted);
  font-size: 12px;
  line-height: 1.35;
}

.page-inspector-section summary::after {
  content: "+";
  grid-row: 1 / span 2;
  grid-column: 2;
  align-self: center;
  justify-self: end;
  color: var(--muted);
  font-weight: 800;
}

.page-inspector-section[open] summary::after {
  content: "−";
}

.page-inspector-section-body {
  display: grid;
  gap: 12px;
  padding: 0 14px 14px;
}
```

- [ ] **Step 3: Make inspector internals compact**

Change `.editorial-grid` to:

```css
.editorial-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 10px;
  align-items: end;
}
```

Add:

```css
.page-inspector .quality-panel,
.page-inspector .markers-panel,
.page-inspector .dictionary-panel,
.page-inspector .suspicious-panel,
.page-inspector .text-history-panel {
  margin: 0;
  padding: 0;
  border: none;
  background: transparent;
  box-shadow: none;
}

.page-inspector .dictionary-editor,
.page-inspector .replacement-editor,
.page-inspector .suspicious-actions,
.page-inspector .replacement-actions {
  grid-template-columns: 1fr;
}
```

- [ ] **Step 4: Lower range/search visual priority**

Change `.book-search-panel, .range-actions-panel` to use a quieter background:

```css
.book-search-panel,
.range-actions-panel {
  display: grid;
  gap: 8px;
  padding: 10px 12px;
  border: 1px solid var(--line);
  border-radius: var(--radius-sm);
  background: var(--paper-soft);
}
```

- [ ] **Step 5: Update responsive rules**

In the `@media (max-width: 880px)` block, include `.page-inspector` in the static-position rule:

```css
.pages-panel,
.image-column,
.page-inspector {
  position: static;
  max-height: none;
  overflow: visible;
}
```

In the same block, `.editor-workspace` already becomes one column through the shared selector. Keep that behavior.

- [ ] **Step 6: Run CSS sanity checks**

Run:

```sh
rg -n "page-inspector|editor-pane-main|pane-heading" public/styles.css
```

Expected: all new classes are present.

- [ ] **Step 7: Commit**

Run:

```sh
git add public/styles.css
git commit -m "style: layout editor page inspector"
```

---

### Task 4: Wire App Rendering To The Inspector

**Files:**
- Modify: `public/app.js`

- [ ] **Step 1: Import the helper**

At the top of `public/app.js`, add:

```js
import { buildPageInspectorSummary } from './page-inspector.js';
```

- [ ] **Step 2: Bind new inspector elements**

Add to `const els = { ... }` near `editorStatus`:

```js
  pageInspectorTitle: document.querySelector('#pageInspectorTitle'),
  pageInspectorStatus: document.querySelector('#pageInspectorStatus'),
  pageInspectorBadges: document.querySelector('#pageInspectorBadges'),
```

- [ ] **Step 3: Add an inspector render function**

Add after `pageBadges(page)`:

```js
function renderPageInspector(page) {
  const markers = pageMarkers(page);
  const summary = buildPageInspectorSummary(page, {
    needsReview: page ? pageNeedsReview(page) : false,
    qualityFlagCount: activeQualityFlags(page).length,
    markerCount: markers.tags.length,
    hasCrop: Boolean(pageCrop(page)),
    hasCropSuggestion: page?.cropSuggestion?.status === 'suggested',
    rotation: pageRotation(page)
  });

  els.pageInspectorTitle.textContent = summary.title;
  els.pageInspectorStatus.textContent = summary.status;
  els.pageInspectorBadges.innerHTML = '';

  for (const badge of summary.badges) {
    const item = document.createElement('span');
    item.textContent = badge;
    els.pageInspectorBadges.append(item);
  }
}
```

- [ ] **Step 4: Call inspector rendering from `renderEditor()`**

Inside `renderEditor()`, in the `if (!page)` branch, add this before `return`:

```js
    renderPageInspector(null);
```

In the selected-page branch, after `const editorial = pageEditorial(page);`, add:

```js
  renderPageInspector(page);
```

- [ ] **Step 5: Update reading/export warning focus behavior**

Change `openReadingPage` so it no longer depends on hidden editor tabs:

```js
async function openReadingPage(target = {}) {
  if (!target.pageId || state.busy) {
    return;
  }

  showMainView('editor');
  await selectPage(target.pageId);

  const focusTarget = target.pane === 'structure' ? els.editorialStatus : els.ocrText;
  focusTarget?.focus?.();
}
```

Change the fallback in `warningFocusTarget`:

```js
  return warningIsSectionTarget(warning) ? els.editorialStatus : els.ocrText;
```

This line already exists; keep it because `editorialStatus` remains in the inspector summary for the structure accordion.

- [ ] **Step 6: Keep old tab activation harmless**

Leave `activateTabGroup('data-pane-tab');` in place. With no `[data-pane-tab]` buttons it attaches no listeners, and the function remains useful if future secondary tabs return.

- [ ] **Step 7: Run syntax and helper tests**

Run:

```sh
node --check public/app.js
node --test tests/page-inspector.test.js
```

Expected: syntax check exits 0; page inspector tests pass.

- [ ] **Step 8: Commit**

Run:

```sh
git add public/app.js
git commit -m "feat: render editor page inspector"
```

---

### Task 5: Verify Existing UI Controls Still Save Correctly

**Files:**
- Test via existing code and manual flow.

- [ ] **Step 1: Run focused automated tests**

Run:

```sh
node --test tests/page-inspector.test.js tests/storage.test.js
```

Expected: both suites pass. `tests/storage.test.js` confirms the editorial route still persists `chapterEnd`, review state, and image mode.

- [ ] **Step 2: Run full tests**

Run:

```sh
npm test
```

Expected: all tests pass.

- [ ] **Step 3: Run diff whitespace check**

Run:

```sh
git diff --check
```

Expected: no output.

- [ ] **Step 4: Commit if any test-only adjustment was needed**

If Task 5 required no code changes, skip this commit. If it required a test or selector fix, commit with:

```sh
git add public/app.js public/index.html public/styles.css tests/page-inspector.test.js
git commit -m "fix: preserve editor inspector interactions"
```

---

### Task 6: Browser QA For The Redesigned Editar View

**Files:**
- No committed source files unless QA finds a bug.

- [ ] **Step 1: Start the app**

Run:

```sh
npm start
```

Expected: local server starts at `http://127.0.0.1:5173`.

- [ ] **Step 2: Open the app and inspect the Editar view**

Use the Browser plugin if available. If unavailable, use Playwright according to `build-web-apps:frontend-testing-debugging`.

Flow under test:

```text
app loads -> open or create a local book -> Editar view -> select a page -> inspector shows Estructura EPUB open by default -> mark Fin de capítulo -> save structure
```

- [ ] **Step 3: Check desktop viewport**

Use a desktop viewport around `1440x1000`.

Expected:

- Three zones are visible: pages, central work, inspector.
- `Fin de capítulo` is visible in the right inspector without switching tabs.
- Text and image controls do not overlap.
- Search and range actions are less visually dominant than the page work area.

- [ ] **Step 4: Check mobile/narrow viewport**

Use a viewport around `390x844`.

Expected:

- Columns stack.
- Inspector appears below the main page work area.
- No button text clips outside its container.
- Accordions remain usable.

- [ ] **Step 5: Fix any QA findings**

For each visual bug found, make the smallest CSS/HTML/JS change that fixes it, then rerun:

```sh
node --check public/app.js
npm test
git diff --check
```

- [ ] **Step 6: Commit QA fixes**

If QA produced fixes, commit:

```sh
git add public/index.html public/app.js public/styles.css
git commit -m "fix: polish editor inspector layout"
```

---

### Task 7: Final Verification And Handoff

**Files:**
- No source changes expected.

- [ ] **Step 1: Confirm git status**

Run:

```sh
git status --short --branch
```

Expected: clean working tree.

- [ ] **Step 2: Confirm latest commits**

Run:

```sh
git log --oneline -n 8
```

Expected: includes the design commit, plan commit if committed, and implementation commits.

- [ ] **Step 3: Report verification**

Final report should include:

- User-visible change.
- Files changed.
- Test commands and results.
- Browser QA result and any untested flows.
- Note that Capturar/iPhone URL remains a separate follow-up.
