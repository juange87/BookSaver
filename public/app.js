const state = {
  projects: [],
  project: null,
  system: null,
  selectedPageId: null,
  pageGroupOpen: {},
  stream: null,
  devices: [],
  draftCrop: null,
  cropPageId: null,
  cropDrag: null,
  busy: false
};

const els = {
  projectStatus: document.querySelector('#projectStatus'),
  projectSelect: document.querySelector('#projectSelect'),
  newProjectButton: document.querySelector('#newProjectButton'),
  exportButton: document.querySelector('#exportButton'),
  supportSummary: document.querySelector('#supportSummary'),
  supportFacts: document.querySelector('#supportFacts'),
  setupGuideLink: document.querySelector('#setupGuideLink'),
  reportIssueLink: document.querySelector('#reportIssueLink'),
  cameraButton: document.querySelector('#cameraButton'),
  iphoneCameraButton: document.querySelector('#iphoneCameraButton'),
  captureDescription: document.querySelector('#captureDescription'),
  cameraSelect: document.querySelector('#cameraSelect'),
  cameraInfo: document.querySelector('#cameraInfo'),
  cameraDevicesList: document.querySelector('#cameraDevicesList'),
  cameraDiagnosticsHint: document.querySelector('#cameraDiagnosticsHint'),
  iphoneHelpLine: document.querySelector('#iphoneHelpLine'),
  iphoneHelpCopy: document.querySelector('#iphoneHelpCopy'),
  video: document.querySelector('#video'),
  cameraEmpty: document.querySelector('#cameraEmpty'),
  cameraStage: document.querySelector('.camera-stage'),
  captureButton: document.querySelector('#captureButton'),
  importPhotosButton: document.querySelector('#importPhotosButton'),
  photoImportInput: document.querySelector('#photoImportInput'),
  inboxPathInput: document.querySelector('#inboxPathInput'),
  inboxWatchInput: document.querySelector('#inboxWatchInput'),
  selectInboxButton: document.querySelector('#selectInboxButton'),
  saveInboxButton: document.querySelector('#saveInboxButton'),
  scanInboxButton: document.querySelector('#scanInboxButton'),
  inboxStatus: document.querySelector('#inboxStatus'),
  pagesCount: document.querySelector('#pagesCount'),
  chapterIndex: document.querySelector('#chapterIndex'),
  pagesList: document.querySelector('#pagesList'),
  editorStatus: document.querySelector('#editorStatus'),
  imageReviewFrame: document.querySelector('#imageReviewFrame'),
  selectedImage: document.querySelector('#selectedImage'),
  cropOverlay: document.querySelector('#cropOverlay'),
  ocrButton: document.querySelector('#ocrButton'),
  ocrText: document.querySelector('#ocrText'),
  formattedPreview: document.querySelector('#formattedPreview'),
  coverStatus: document.querySelector('#coverStatus'),
  coverPreview: document.querySelector('#coverPreview'),
  coverPreviewEmpty: document.querySelector('#coverPreviewEmpty'),
  usePageAsCoverButton: document.querySelector('#usePageAsCoverButton'),
  uploadCoverButton: document.querySelector('#uploadCoverButton'),
  clearCoverButton: document.querySelector('#clearCoverButton'),
  coverUploadInput: document.querySelector('#coverUploadInput'),
  editorialStatus: document.querySelector('#editorialStatus'),
  pageImageModeInput: document.querySelector('#pageImageModeInput'),
  partStartInput: document.querySelector('#partStartInput'),
  partTitleInput: document.querySelector('#partTitleInput'),
  chapterStartInput: document.querySelector('#chapterStartInput'),
  chapterTitleInput: document.querySelector('#chapterTitleInput'),
  chapterHeaderModeInput: document.querySelector('#chapterHeaderModeInput'),
  chapterEndInput: document.querySelector('#chapterEndInput'),
  movePageFirstButton: document.querySelector('#movePageFirstButton'),
  movePageUpButton: document.querySelector('#movePageUpButton'),
  movePageDownButton: document.querySelector('#movePageDownButton'),
  movePageLastButton: document.querySelector('#movePageLastButton'),
  saveEditorialButton: document.querySelector('#saveEditorialButton'),
  cropStatus: document.querySelector('#cropStatus'),
  saveCropButton: document.querySelector('#saveCropButton'),
  clearCropButton: document.querySelector('#clearCropButton'),
  saveTextButton: document.querySelector('#saveTextButton'),
  deletePageButton: document.querySelector('#deletePageButton'),
  captureView: document.querySelector('#captureView'),
  projectDialog: document.querySelector('#projectDialog'),
  projectForm: document.querySelector('#projectForm'),
  cancelProjectButton: document.querySelector('#cancelProjectButton'),
  titleInput: document.querySelector('#titleInput'),
  authorInput: document.querySelector('#authorInput'),
  languageInput: document.querySelector('#languageInput'),
  notesInput: document.querySelector('#notesInput'),
  toast: document.querySelector('#toast')
};

const IPHONE_CAMERA_PATTERN = /iphone|continuity|continuidad|camara de|camera de|cámara de/i;

async function api(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload.error || 'No se pudo completar la accion.');
  }

  return payload;
}

function showToast(message) {
  els.toast.textContent = message;
  els.toast.classList.add('visible');
  window.clearTimeout(showToast.timeout);
  showToast.timeout = window.setTimeout(() => els.toast.classList.remove('visible'), 4200);
}

function pageStatus(page) {
  const labels = {
    captured: 'Capturada',
    'text-edited': 'Texto editado',
    'ocr-running': 'Leyendo texto',
    'ocr-complete': 'OCR listo',
    'ocr-error': 'OCR con error'
  };
  return labels[page.status] || page.status;
}

function ocrEngineLabel(engine) {
  if (engine === 'apple-vision') {
    return 'Apple Vision';
  }
  if (engine === 'tesseract') {
    return 'Tesseract';
  }
  return null;
}

function isMacSystem() {
  return state.system?.platform === 'darwin';
}

function folderPickerSupported() {
  return state.system?.folderPickerSupported !== false;
}

function summarizeTesseractLanguages(languages) {
  if (!languages?.length) {
    return 'Tesseract no está detectado.';
  }

  if (languages.length <= 8) {
    return `Idiomas Tesseract detectados: ${languages.join(', ')}.`;
  }

  const highlights = ['spa', 'eng', 'osd'].filter((language) => languages.includes(language));
  const extra = languages.filter((language) => !highlights.includes(language)).slice(0, 3);
  const preview = [...highlights, ...extra];
  const suffix = languages.length > preview.length ? `, ... (${languages.length} total)` : '';
  return `Idiomas Tesseract detectados: ${preview.join(', ')}${suffix}.`;
}

function pageEditorial(page) {
  const editorial = page?.editorial || {};
  const chapterHeaderMode = ['auto', 'page'].includes(editorial.chapterHeaderMode)
    ? editorial.chapterHeaderMode
    : 'none';

  return {
    imageMode: editorial.imageMode === 'image' ? 'image' : 'text',
    partStart: Boolean(editorial.partStart),
    partTitle: String(editorial.partTitle || '').trim(),
    chapterStart: Boolean(editorial.chapterStart),
    chapterEnd: Boolean(editorial.chapterEnd),
    chapterTitle: String(editorial.chapterTitle || '').trim(),
    chapterHeaderMode: editorial.chapterStart ? chapterHeaderMode : 'none'
  };
}

function projectCover(project) {
  const cover = project?.cover || {};
  const mode = cover.mode === 'page' ? 'page' : cover.mode === 'upload' ? 'upload' : 'none';

  return {
    mode,
    pageId: mode === 'page' ? String(cover.pageId || '') : null,
    updatedAt: mode === 'none' ? null : String(cover.updatedAt || project?.updatedAt || '')
  };
}

function clamp(value, min = 0, max = 1) {
  return Math.min(max, Math.max(min, value));
}

function normalizeCrop(crop) {
  if (!crop) {
    return null;
  }

  const left = clamp(Number(crop.left));
  const top = clamp(Number(crop.top));
  const width = clamp(Number(crop.width), 0, 1 - left);
  const height = clamp(Number(crop.height), 0, 1 - top);

  if (![left, top, width, height].every(Number.isFinite) || width < 0.03 || height < 0.03) {
    return null;
  }

  if (left <= 0.005 && top <= 0.005 && width >= 0.99 && height >= 0.99) {
    return null;
  }

  return {
    left: Number(left.toFixed(4)),
    top: Number(top.toFixed(4)),
    width: Number(width.toFixed(4)),
    height: Number(height.toFixed(4))
  };
}

function pageCrop(page) {
  return normalizeCrop(page?.crop);
}

function sameCrop(left, right) {
  return JSON.stringify(normalizeCrop(left)) === JSON.stringify(normalizeCrop(right));
}

function cropPercent(crop) {
  return `${Math.round(crop.left * 100)}%, ${Math.round(crop.top * 100)}%, ${Math.round(crop.width * 100)}% x ${Math.round(crop.height * 100)}%`;
}

function partTitleForPage(page, partNumber) {
  const editorial = pageEditorial(page);
  return editorial.partTitle || `Parte ${partNumber}`;
}

function chapterTitleForPage(page, chapterNumber, sectionNumber) {
  const editorial = pageEditorial(page);

  if (editorial.chapterStart) {
    return editorial.chapterTitle || `Capitulo ${chapterNumber}`;
  }

  return sectionNumber === 1 ? 'Inicio' : `Seccion ${sectionNumber}`;
}

function buildPageGroups(pages) {
  const groups = [];
  let currentChapter = null;
  let currentPart = null;
  let partNumber = 0;
  let chapterNumber = 0;
  let sectionNumber = 0;

  function closeCurrentChapter() {
    if (!currentChapter?.pages.length) {
      currentChapter = null;
      return;
    }

    if (currentPart) {
      currentPart.chapters.push(currentChapter);
      currentPart.pageCount += currentChapter.pages.length;
      currentPart.endPage = currentChapter.endPage;
    } else {
      groups.push(currentChapter);
    }

    currentChapter = null;
  }

  function startChapter(page) {
    const editorial = pageEditorial(page);
    if (editorial.chapterStart) {
      chapterNumber += 1;
    }
    sectionNumber += 1;

    return {
      type: 'chapter',
      key: `chapter:${page.id}`,
      title: chapterTitleForPage(page, chapterNumber || sectionNumber, sectionNumber),
      startPage: page.number,
      endPage: page.number,
      pages: []
    };
  }

  for (const page of pages) {
    const editorial = pageEditorial(page);

    if (editorial.partStart) {
      closeCurrentChapter();
      partNumber += 1;
      currentPart = {
        type: 'part',
        key: `part:${page.id}`,
        title: partTitleForPage(page, partNumber),
        startPage: page.number,
        endPage: page.number,
        pageCount: 0,
        leadPages: [],
        chapters: []
      };
      groups.push(currentPart);
    }

    if (editorial.chapterStart) {
      closeCurrentChapter();
      currentChapter = startChapter(page);
    } else if (!currentChapter) {
      const keepAsPartLead = currentPart && currentPart.chapters.length === 0;
      if (!keepAsPartLead) {
        currentChapter = startChapter(page);
      }
    }

    if (currentChapter) {
      currentChapter.pages.push(page);
      currentChapter.endPage = page.number;
    } else if (currentPart) {
      currentPart.leadPages.push(page);
      currentPart.pageCount += 1;
      currentPart.endPage = page.number;
    }

    if (editorial.chapterEnd) {
      closeCurrentChapter();
    }
  }

  closeCurrentChapter();
  return groups;
}

function buildBookIndexItems(pages) {
  const items = [];

  for (const group of buildPageGroups(pages)) {
    if (group.type === 'part') {
      items.push({
        type: 'part',
        title: group.title,
        page: group.startPage
      });

      for (const chapter of group.chapters) {
        items.push({
          type: 'chapter',
          title: chapter.title,
          startPage: chapter.startPage,
          endPage: chapter.endPage
        });
      }

      continue;
    }

    items.push({
      type: 'chapter',
      title: group.title,
      startPage: group.startPage,
      endPage: group.endPage
    });
  }

  return items;
}

function pageRangeLabel(startPage, endPage) {
  return startPage === endPage ? `pag. ${startPage}` : `pags. ${startPage}-${endPage}`;
}

function pagesCountLabel(count) {
  return `${count} ${count === 1 ? 'pagina' : 'paginas'}`;
}

function groupContainsPage(group, pageId) {
  if (!pageId) {
    return false;
  }

  if (group.type === 'part') {
    return (
      group.leadPages.some((page) => page.id === pageId) ||
      group.chapters.some((chapter) => groupContainsPage(chapter, pageId))
    );
  }

  return group.pages.some((page) => page.id === pageId);
}

function groupOpenState(key, fallback = false) {
  if (Object.prototype.hasOwnProperty.call(state.pageGroupOpen, key)) {
    return state.pageGroupOpen[key];
  }

  return fallback;
}

async function selectPage(pageId) {
  if (pageId === state.selectedPageId) {
    return;
  }

  try {
    await persistCurrentPageDraft();
  } catch (error) {
    showToast(error.message);
    return;
  }

  state.selectedPageId = pageId;
  render();
  await loadSelectedPageText();
}

function createPageItem(page) {
  const item = document.createElement('button');
  item.type = 'button';
  item.className = `page-item ${page.id === state.selectedPageId ? 'selected' : ''}`;
  item.dataset.pageId = page.id;
  item.addEventListener('click', async () => {
    await selectPage(page.id);
  });

  const image = document.createElement('img');
  image.alt = `Pagina ${page.number}`;
  image.src = `/api/projects/${state.project.id}/pages/${page.id}/image?${page.updatedAt}`;

  const body = document.createElement('span');
  body.className = 'page-item-meta';

  const title = document.createElement('strong');
  title.textContent = `Pagina ${page.number}`;

  const status = document.createElement('span');
  status.className = `status-${page.status}`;
  status.textContent = pageStatus(page);
  body.append(title, status);

  const badges = pageBadges(page);
  if (badges.length) {
    const metadata = document.createElement('span');
    metadata.className = 'page-badges';
    metadata.textContent = badges.join(' · ');
    body.append(metadata);
  }

  item.append(image, body);
  return item;
}

function createChapterGroup(chapter, options = {}) {
  const { nested = false, fallbackOpen = false } = options;
  const containsSelected = groupContainsPage(chapter, state.selectedPageId);
  const details = document.createElement('details');
  details.className = `page-group page-group-chapter${nested ? ' nested' : ''}`;
  details.open = containsSelected || groupOpenState(chapter.key, fallbackOpen);
  details.addEventListener('toggle', () => {
    state.pageGroupOpen[chapter.key] = details.open;
  });

  const summary = document.createElement('summary');
  summary.className = 'page-group-summary';

  const heading = document.createElement('span');
  heading.className = 'page-group-heading';

  const title = document.createElement('strong');
  title.textContent = chapter.title;

  const meta = document.createElement('span');
  meta.className = 'page-group-meta';
  meta.textContent = `${pagesCountLabel(chapter.pages.length)} · ${pageRangeLabel(chapter.startPage, chapter.endPage)}`;
  heading.append(title, meta);

  summary.append(heading);
  details.append(summary);

  const pages = document.createElement('div');
  pages.className = 'page-group-pages';

  for (const page of chapter.pages) {
    pages.append(createPageItem(page));
  }

  details.append(pages);
  return details;
}

function createPartGroup(part, fallbackOpen = false) {
  const containsSelected = groupContainsPage(part, state.selectedPageId);
  const details = document.createElement('details');
  details.className = 'page-group page-group-part';
  details.open = containsSelected || groupOpenState(part.key, fallbackOpen);
  details.addEventListener('toggle', () => {
    state.pageGroupOpen[part.key] = details.open;
  });

  const summary = document.createElement('summary');
  summary.className = 'page-group-summary';

  const heading = document.createElement('span');
  heading.className = 'page-group-heading';

  const title = document.createElement('strong');
  title.textContent = part.title;

  const meta = document.createElement('span');
  meta.className = 'page-group-meta';
  const metaParts = [];
  if (part.chapters.length) {
    metaParts.push(`${part.chapters.length} ${part.chapters.length === 1 ? 'capitulo' : 'capitulos'}`);
  }
  metaParts.push(pagesCountLabel(part.pageCount), pageRangeLabel(part.startPage, part.endPage));
  meta.textContent = metaParts.join(' · ');
  heading.append(title, meta);

  summary.append(heading);
  details.append(summary);

  if (part.leadPages.length) {
    const leadPages = document.createElement('div');
    leadPages.className = 'page-group-pages page-group-pages-inline';

    for (const page of part.leadPages) {
      leadPages.append(createPageItem(page));
    }

    details.append(leadPages);
  }

  if (part.chapters.length) {
    const chapters = document.createElement('div');
    chapters.className = 'page-subgroups';

    part.chapters.forEach((chapter, index) => {
      const chapterFallbackOpen = containsSelected
        ? groupContainsPage(chapter, state.selectedPageId)
        : !state.selectedPageId && index === 0;
      chapters.append(createChapterGroup(chapter, { nested: true, fallbackOpen: chapterFallbackOpen }));
    });

    details.append(chapters);
  }

  return details;
}

function editorialDraftFromInputs() {
  return {
    imageMode: els.pageImageModeInput.checked ? 'image' : 'text',
    partStart: els.partStartInput.checked,
    partTitle: els.partTitleInput.value,
    chapterStart: els.chapterStartInput.checked,
    chapterTitle: els.chapterTitleInput.value,
    chapterHeaderMode: els.chapterHeaderModeInput.value,
    chapterEnd: els.chapterEndInput.checked
  };
}

function sameEditorial(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function escapeHtml(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function textToPreviewBlocks(text) {
  return String(text || '')
    .replace(/\r\n/g, '\n')
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .map((paragraph, index) => ({
      type: paragraph.length <= 80 && paragraph === paragraph.toUpperCase() ? 'heading' : 'paragraph',
      text: paragraph,
      indent: index !== 0
    }));
}

function renderFormattedPreview(layout, text) {
  const blocks = layout?.blocks?.length ? layout.blocks : textToPreviewBlocks(text);

  if (!blocks.length) {
    els.formattedPreview.innerHTML = '<p class="empty-page">Sin texto para previsualizar.</p>';
    return;
  }

  els.formattedPreview.innerHTML = blocks
    .map((block, index) => {
      const escapedText = escapeHtml(block.text);
      if (block.type === 'heading') {
        return `<h3>${escapedText}</h3>`;
      }
      if (block.type === 'centered') {
        return `<p class="centered">${escapedText}</p>`;
      }
      const className = block.indent === false || index === 0 ? 'no-indent' : '';
      return `<p class="${className}">${escapedText}</p>`;
    })
    .join('');
}

function currentPage() {
  return state.project?.pages.find((page) => page.id === state.selectedPageId) || null;
}

function updateEditorialControlState() {
  const hasPage = Boolean(currentPage());
  const enabled = hasPage && !state.busy;
  const partStart = els.partStartInput.checked;
  const chapterStart = els.chapterStartInput.checked;
  const crop = normalizeCrop(state.draftCrop);

  els.pageImageModeInput.disabled = !enabled;
  els.partStartInput.disabled = !enabled;
  els.partTitleInput.disabled = !enabled || !partStart;
  els.chapterStartInput.disabled = !enabled;
  els.chapterEndInput.disabled = !enabled;
  els.chapterTitleInput.disabled = !enabled || !chapterStart;
  els.chapterHeaderModeInput.disabled = !enabled || !chapterStart;
  els.saveEditorialButton.disabled = !enabled;
  els.saveCropButton.disabled = !enabled || !crop;
  els.clearCropButton.disabled = !enabled || (!crop && !pageCrop(currentPage()));

  if (!partStart) {
    els.partTitleInput.value = '';
  }
  if (!chapterStart) {
    els.chapterHeaderModeInput.value = 'none';
  }
}

function setDraftCrop(crop) {
  state.draftCrop = normalizeCrop(crop);
  renderCropOverlay();
  updateEditorialControlState();
}

function renderCropOverlay() {
  const crop = normalizeCrop(state.draftCrop);

  if (!crop) {
    els.cropOverlay.hidden = true;
    els.cropStatus.textContent = currentPage()
      ? 'Arrastra sobre la imagen para elegir el area util.'
      : 'Elige una pagina para recortarla.';
    return;
  }

  els.cropOverlay.hidden = false;
  els.cropOverlay.style.left = `${crop.left * 100}%`;
  els.cropOverlay.style.top = `${crop.top * 100}%`;
  els.cropOverlay.style.width = `${crop.width * 100}%`;
  els.cropOverlay.style.height = `${crop.height * 100}%`;
  els.cropStatus.textContent = `Recorte preparado: ${cropPercent(crop)}.`;
}

function pointInImage(event) {
  const rect = els.selectedImage.getBoundingClientRect();

  if (!rect.width || !rect.height) {
    return null;
  }

  return {
    x: clamp((event.clientX - rect.left) / rect.width),
    y: clamp((event.clientY - rect.top) / rect.height)
  };
}

function cropFromPoints(start, end) {
  if (!start || !end) {
    return null;
  }

  const left = Math.min(start.x, end.x);
  const top = Math.min(start.y, end.y);
  const width = Math.abs(end.x - start.x);
  const height = Math.abs(end.y - start.y);
  return normalizeCrop({ left, top, width, height });
}

function setBusy(value) {
  state.busy = value;
  render();
}

async function loadProjects() {
  const { projects } = await api('/api/projects');
  state.projects = projects;

  if (!state.project && projects.length > 0) {
    await loadProject(projects[0].id);
  } else {
    render();
  }
}

async function loadSystemSupport() {
  try {
    const { system } = await api('/api/system');
    state.system = system;
    render();
  } catch (error) {
    els.supportSummary.textContent = `No se pudo leer la compatibilidad del sistema. ${error.message}`;
  }
}

async function loadProject(projectId) {
  const { project } = await api(`/api/projects/${projectId}`);
  const selectedPageId = state.selectedPageId;
  const projectChanged = state.project?.id !== project.id;
  state.project = project;
  if (projectChanged) {
    state.pageGroupOpen = {};
  }
  state.selectedPageId = project.pages.some((page) => page.id === selectedPageId)
    ? selectedPageId
    : project.pages[0]?.id || null;
  render();
  await loadSelectedPageText();
}

async function refreshProject() {
  if (!state.project) {
    return;
  }
  await loadProject(state.project.id);
}

function renderProjects() {
  els.projectSelect.innerHTML = '';

  if (state.projects.length === 0) {
    const option = document.createElement('option');
    option.textContent = 'Sin libros';
    option.value = '';
    els.projectSelect.append(option);
    els.projectSelect.disabled = true;
    return;
  }

  els.projectSelect.disabled = false;
  for (const project of state.projects) {
    const option = document.createElement('option');
    option.value = project.id;
    option.textContent = `${project.title} (${project.pageCount})`;
    option.selected = project.id === state.project?.id;
    els.projectSelect.append(option);
  }
}

function pageBadges(page) {
  const editorial = pageEditorial(page);
  const cover = projectCover(state.project);
  const badges = [];

  if (cover.mode === 'page' && cover.pageId === page.id) {
    badges.push('Portada');
  }
  if (editorial.partStart) {
    badges.push(editorial.partTitle ? `Parte: ${editorial.partTitle}` : 'Inicio de parte');
  }
  if (editorial.chapterStart) {
    badges.push(editorial.chapterTitle ? `Inicio: ${editorial.chapterTitle}` : 'Inicio de capitulo');
  }
  if (editorial.chapterEnd) {
    badges.push('Fin de capitulo');
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
  if (pageCrop(page)) {
    badges.push('Recortada');
  }

  return badges;
}

function renderChapterIndex() {
  const pages = state.project?.pages || [];
  els.chapterIndex.innerHTML = '';

  if (pages.length === 0) {
    const item = document.createElement('li');
    item.textContent = 'Sin paginas todavia.';
    els.chapterIndex.append(item);
    return;
  }

  for (const itemData of buildBookIndexItems(pages)) {
    const item = document.createElement('li');
    item.className = `${itemData.type}-index-item`;
    if (itemData.type === 'part') {
      item.textContent = `${itemData.title} · pag. ${itemData.page}`;
    } else {
      item.textContent = `${itemData.title} · ${pageRangeLabel(itemData.startPage, itemData.endPage)}`;
    }
    els.chapterIndex.append(item);
  }
}

function renderPages() {
  const pages = state.project?.pages || [];
  els.pagesCount.textContent = `${pages.length} ${pages.length === 1 ? 'captura' : 'capturas'}`;
  els.pagesList.innerHTML = '';
  renderChapterIndex();

  if (pages.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'muted';
    empty.textContent = 'Aun no hay paginas capturadas.';
    els.pagesList.append(empty);
    return;
  }

  const groups = buildPageGroups(pages);

  groups.forEach((group, index) => {
    const fallbackOpen = groupContainsPage(group, state.selectedPageId) || (!state.selectedPageId && index === 0);
    els.pagesList.append(
      group.type === 'part'
        ? createPartGroup(group, fallbackOpen)
        : createChapterGroup(group, { fallbackOpen })
    );
  });
}

function renderEditor() {
  const page = currentPage();
  const hasPage = Boolean(page);
  const pages = state.project?.pages || [];
  const pageIndex = hasPage ? pages.findIndex((item) => item.id === page.id) : -1;
  const canMoveBackward = hasPage && pageIndex > 0 && !state.busy;
  const canMoveForward = hasPage && pageIndex >= 0 && pageIndex < pages.length - 1 && !state.busy;

  els.ocrButton.disabled = !hasPage || state.busy;
  els.saveTextButton.disabled = !hasPage || state.busy;
  els.deletePageButton.disabled = !hasPage || state.busy;
  els.ocrText.disabled = !hasPage || state.busy;
  els.movePageFirstButton.disabled = !canMoveBackward;
  els.movePageUpButton.disabled = !canMoveBackward;
  els.movePageDownButton.disabled = !canMoveForward;
  els.movePageLastButton.disabled = !canMoveForward;

  if (!page) {
    els.editorStatus.textContent = 'Elige una pagina para revisar el texto.';
    els.editorialStatus.textContent = 'Elige una pagina para marcar su estructura EPUB.';
    els.selectedImage.classList.remove('visible');
    els.selectedImage.removeAttribute('src');
    els.ocrText.value = '';
    state.cropPageId = null;
    state.draftCrop = null;
    renderCropOverlay();
    els.pageImageModeInput.checked = false;
    els.partStartInput.checked = false;
    els.partTitleInput.value = '';
    els.chapterStartInput.checked = false;
    els.chapterTitleInput.value = '';
    els.chapterHeaderModeInput.value = 'none';
    els.chapterEndInput.checked = false;
    updateEditorialControlState();
    renderFormattedPreview(null, '');
    return;
  }

  const editorial = pageEditorial(page);
  if (state.cropPageId !== page.id) {
    state.cropPageId = page.id;
    state.draftCrop = pageCrop(page);
  }
  const engine = ocrEngineLabel(page.ocrEngine);
  els.editorStatus.textContent = `${pageStatus(page)}${engine ? ` - ${engine}` : ''}${
    page.ocrWarning ? ` - ${page.ocrWarning}` : ''
  }`;
  els.editorialStatus.textContent = editorial.chapterStart
    ? `Capitulo: ${editorial.chapterTitle || 'sin titulo todavia'}`
    : editorial.imageMode === 'image'
      ? 'Esta captura saldra como imagen en el EPUB.'
      : 'Texto normal en el EPUB.';
  els.pageImageModeInput.checked = editorial.imageMode === 'image';
  els.partStartInput.checked = editorial.partStart;
  els.partTitleInput.value = editorial.partTitle;
  els.chapterStartInput.checked = editorial.chapterStart;
  els.chapterTitleInput.value = editorial.chapterTitle;
  els.chapterHeaderModeInput.value = editorial.chapterHeaderMode;
  els.chapterEndInput.checked = editorial.chapterEnd;
  updateEditorialControlState();
  els.selectedImage.src = `/api/projects/${state.project.id}/pages/${page.id}/image?${page.updatedAt}`;
  els.selectedImage.alt = `Pagina ${page.number}`;
  els.selectedImage.classList.add('visible');
  renderCropOverlay();
  renderFormattedPreview(page.layoutData, els.ocrText.value);
}

function renderCover() {
  const project = state.project;
  const page = currentPage();
  const cover = projectCover(project);
  const coverPage = cover.mode === 'page' ? project?.pages.find((item) => item.id === cover.pageId) : null;
  const coverVersion =
    cover.mode === 'page'
      ? coverPage?.updatedAt || cover.updatedAt || project?.updatedAt || ''
      : cover.updatedAt || project?.updatedAt || '';

  els.uploadCoverButton.disabled = !project || state.busy;
  els.usePageAsCoverButton.disabled =
    !project || !page || state.busy || (cover.mode === 'page' && cover.pageId === page.id);
  els.clearCoverButton.disabled = !project || state.busy || cover.mode === 'none';

  if (!project) {
    els.usePageAsCoverButton.textContent = 'Usar página seleccionada';
  } else if (!page) {
    els.usePageAsCoverButton.textContent = 'Selecciona una página';
  } else if (cover.mode === 'page' && cover.pageId === page.id) {
    els.usePageAsCoverButton.textContent = 'La selección ya es portada';
  } else {
    els.usePageAsCoverButton.textContent = `Usar página ${page.number}`;
  }

  if (!project) {
    els.coverStatus.textContent = 'Crea o abre un libro para configurar la portada.';
    els.coverPreview.classList.remove('visible');
    els.coverPreview.removeAttribute('src');
    els.coverPreviewEmpty.hidden = false;
    return;
  }

  if (cover.mode === 'none') {
    els.coverStatus.textContent = 'Sin portada configurada todavía.';
    els.coverPreview.classList.remove('visible');
    els.coverPreview.removeAttribute('src');
    els.coverPreviewEmpty.hidden = false;
    return;
  }

  if (cover.mode === 'page') {
    els.coverStatus.textContent = `Portada actual: página ${coverPage?.number || cover.pageId}.`;
  } else {
    els.coverStatus.textContent = 'Portada actual: imagen externa.';
  }

  els.coverPreview.src = `/api/projects/${project.id}/cover/image?${encodeURIComponent(coverVersion)}`;
  els.coverPreview.classList.add('visible');
  els.coverPreviewEmpty.hidden = true;
}

function renderPlatformCopy() {
  els.cameraButton.textContent = 'Activar cámara';
  els.captureDescription.textContent = isMacSystem()
    ? 'Selecciona una webcam, cámara USB o el iPhone, encuadra la página y guarda cada toma en orden.'
    : 'Selecciona una webcam o cámara USB, encuadra la página y guarda cada toma en orden.';
  els.iphoneCameraButton.textContent = isMacSystem()
    ? findIphoneCamera()
      ? 'Usar iPhone'
      : 'Buscar iPhone'
    : 'Actualizar cámaras';
  els.iphoneHelpLine.hidden = !isMacSystem();
  if (isMacSystem()) {
    els.iphoneHelpCopy.textContent = 'Si quieres usar el iPhone y no aparece aquí, prueba esta misma URL en Safari o Chrome:';
  }
  els.selectInboxButton.textContent = folderPickerSupported() ? 'Seleccionar carpeta' : 'Selector en macOS';
}

function renderCamera() {
  const active = Boolean(state.stream);
  els.captureButton.disabled = !active || !state.project || state.busy;
  els.importPhotosButton.disabled = !state.project || state.busy;
  els.cameraButton.disabled = state.busy;
  els.iphoneCameraButton.disabled = state.busy;
  els.cameraSelect.disabled = state.busy || state.devices.length === 0;
  els.cameraStage.classList.toggle('active', active);
  if (active) {
    const resolution = `${els.video.videoWidth || '-'} x ${els.video.videoHeight || '-'}`;
    els.cameraInfo.textContent = `En uso: ${selectedCameraLabel()} · ${resolution}`;
  } else if (state.devices.length > 0) {
    els.cameraInfo.textContent = `Seleccionada: ${selectedCameraLabel()}`;
  } else {
    els.cameraInfo.textContent = 'Sin cámaras detectadas';
  }
  renderCameraDiagnostics();
}

function renderInbox() {
  const inbox = state.project?.inbox || {};
  const hasProject = Boolean(state.project);
  const path = inbox.path || '';
  const canPickFolder = folderPickerSupported();

  if (document.activeElement !== els.inboxPathInput) {
    els.inboxPathInput.value = path;
  }

  els.inboxWatchInput.checked = Boolean(inbox.watch);
  els.inboxPathInput.disabled = !hasProject || state.busy;
  els.inboxWatchInput.disabled = !hasProject || state.busy;
  els.selectInboxButton.disabled = !hasProject || state.busy || !canPickFolder;
  els.saveInboxButton.disabled = !hasProject || state.busy;
  els.scanInboxButton.disabled = !hasProject || state.busy || !path;

  if (!hasProject) {
    els.inboxStatus.textContent = 'Crea o abre un libro para configurar la bandeja.';
    return;
  }

  if (!path) {
    els.inboxStatus.textContent = canPickFolder
      ? 'Configura una carpeta para importar fotos desde el móvil o desde otra cámara.'
      : 'Pega la ruta de una carpeta local para importar fotos. En este sistema no hay selector nativo todavía.';
    return;
  }

  const mode = inbox.watch ? 'vigilancia activa' : 'revision manual';
  const lastScan = inbox.lastScanAt ? new Date(inbox.lastScanAt).toLocaleString() : 'sin revisar';
  const imported = inbox.lastImportedCount ?? 0;
  const skipped = inbox.lastSkippedCount ?? 0;
  const unsupported = inbox.lastUnsupportedCount ?? 0;
  const errors = inbox.lastErrorCount ?? 0;
  const pickerNote = canPickFolder ? '' : ' Ruta editable manualmente.';
  els.inboxStatus.textContent = `${mode}. Ultima revision: ${lastScan}. Importadas: ${imported}. Ya conocidas: ${skipped}. No soportadas: ${unsupported}. Errores: ${errors}.${pickerNote}`;
}

function renderSupportPanel() {
  if (!state.system) {
    els.supportSummary.textContent = 'Comprobando compatibilidad del sistema...';
    els.supportFacts.innerHTML = '';
    return;
  }

  els.setupGuideLink.href = state.system.links?.setupGuide || els.setupGuideLink.href;
  els.reportIssueLink.href = state.system.links?.reportIssue || els.reportIssueLink.href;
  els.supportSummary.textContent = state.system.summary;
  els.supportFacts.innerHTML = '';

  const facts = [
    `Sistema operativo: ${state.system.platformLabel}.`,
    `OCR por defecto: ${state.system.preferredEngineLabel}.`,
    state.system.appleVisionAvailable
      ? 'Apple Vision disponible en este equipo.'
      : 'Apple Vision no está disponible en este equipo.',
    summarizeTesseractLanguages(state.system.tesseractLanguages),
    folderPickerSupported()
      ? 'Selector nativo de carpetas disponible.'
      : 'Selector nativo de carpetas no disponible: pega la ruta manualmente.'
  ];

  for (const warning of state.system.warnings || []) {
    facts.push(warning);
  }

  for (const fact of facts) {
    const item = document.createElement('li');
    item.textContent = fact;
    els.supportFacts.append(item);
  }
}

function render() {
  renderPlatformCopy();
  renderProjects();
  renderPages();
  renderCover();
  renderEditor();
  renderCamera();
  renderInbox();
  renderSupportPanel();

  const pageCount = state.project?.pages.length || 0;
  els.projectStatus.textContent = state.project
    ? `${state.project.title} - ${pageCount} ${pageCount === 1 ? 'pagina' : 'paginas'}`
    : 'Sin libro abierto';
  els.exportButton.disabled = !state.project || pageCount === 0 || state.busy;
}

async function loadSelectedPageText() {
  const page = currentPage();
  if (!page) {
    renderEditor();
    return;
  }

  try {
    const { page: payload } = await api(`/api/projects/${state.project.id}/pages/${page.id}`);
    els.ocrText.value = payload.ocrText || '';
    Object.assign(page, payload);
    render();
  } catch (error) {
    showToast(error.message);
  }
}

async function refreshCameras() {
  if (!navigator.mediaDevices?.enumerateDevices) {
    els.cameraSelect.innerHTML = '<option>Camara no disponible</option>';
    state.devices = [];
    renderCameraDiagnostics();
    return;
  }

  const previousDeviceId =
    els.cameraSelect.value || state.stream?.getVideoTracks?.()[0]?.getSettings?.().deviceId || '';
  const devices = await navigator.mediaDevices.enumerateDevices();
  state.devices = devices.filter((device) => device.kind === 'videoinput');
  els.cameraSelect.innerHTML = '';

  if (state.devices.length === 0) {
    const option = document.createElement('option');
    option.textContent = 'No hay camaras';
    option.value = '';
    els.cameraSelect.append(option);
    renderCameraDiagnostics();
    return;
  }

  for (const [index, device] of state.devices.entries()) {
    const option = document.createElement('option');
    option.value = device.deviceId;
    option.textContent = device.label || `Camara ${index + 1}`;
    if (isIphoneCamera(device)) {
      option.textContent = `${option.textContent} - iPhone`;
    }
    els.cameraSelect.append(option);
  }

  const preferredDevice =
    state.devices.find((device) => device.deviceId === previousDeviceId) ||
    state.devices.find((device) => !isIphoneCamera(device)) ||
    state.devices[0];
  if (preferredDevice) {
    els.cameraSelect.value = preferredDevice.deviceId;
  }

  renderCameraDiagnostics();
}

function isIphoneCamera(device) {
  return IPHONE_CAMERA_PATTERN.test(device.label || '');
}

function hasCameraLabels() {
  return state.devices.some((device) => device.label);
}

function renderCameraDiagnostics() {
  els.cameraDevicesList.innerHTML = '';

  if (state.devices.length === 0) {
    const item = document.createElement('li');
    item.textContent = 'No hay camaras detectadas por este navegador.';
    els.cameraDevicesList.append(item);
  }

  for (const [index, device] of state.devices.entries()) {
    const item = document.createElement('li');
    const label = device.label || `Camara ${index + 1} (nombre oculto hasta dar permiso)`;
    const suffix = device.deviceId ? ` · id ${device.deviceId.slice(0, 8)}` : '';
    item.textContent = `${label}${suffix}`;

    if (isIphoneCamera(device)) {
      const match = document.createElement('span');
      match.className = 'iphone-match';
      match.textContent = ' · posible iPhone';
      item.append(match);
    }

    els.cameraDevicesList.append(item);
  }

  if (state.devices.length === 0) {
    els.cameraDiagnosticsHint.textContent = isMacSystem()
      ? 'No se han detectado cámaras. Conecta una webcam, una cámara USB o prueba con el iPhone mediante Continuity Camera.'
      : 'No se han detectado cámaras. Conecta una webcam o una cámara USB y vuelve a actualizar.';
    return;
  }

  if (!hasCameraLabels()) {
    els.cameraDiagnosticsHint.textContent =
      'Pulsa Activar cámara para conceder permiso al navegador y ver los nombres reales.';
    return;
  }

  if (!isMacSystem()) {
    els.cameraDiagnosticsHint.textContent =
      'Elige una cámara del listado y pulsa Activar cámara para empezar.';
    return;
  }

  const iphoneCamera = findIphoneCamera();
  els.cameraDiagnosticsHint.textContent = iphoneCamera
    ? `Lista preparada. También hemos detectado un iPhone: ${iphoneCamera.label}.`
    : 'Lista preparada. Si quieres usar el iPhone, desbloquéalo y pulsa Buscar iPhone.';
}

function findIphoneCamera() {
  return state.devices.find(isIphoneCamera) || null;
}

function selectedCameraLabel() {
  const selectedDevice = state.devices.find((device) => device.deviceId === els.cameraSelect.value);
  return selectedDevice?.label || 'camara seleccionada';
}

async function requestCameraLabels() {
  if (hasCameraLabels()) {
    return;
  }

  const permissionStream = await navigator.mediaDevices.getUserMedia({
    video: true,
    audio: false
  });

  for (const track of permissionStream.getTracks()) {
    track.stop();
  }
}

function cameraConstraints(deviceId) {
  return {
    video: {
      width: { ideal: 3840 },
      height: { ideal: 2160 },
      frameRate: { ideal: 30 },
      ...(deviceId ? { deviceId: { exact: deviceId } } : {})
    },
    audio: false
  };
}

async function openCamera(deviceId) {
  state.stream = await navigator.mediaDevices.getUserMedia(cameraConstraints(deviceId));
  els.video.srcObject = state.stream;
  await els.video.play();
}

async function startSelectedCamera() {
  if (!navigator.mediaDevices?.getUserMedia) {
    showToast('El navegador no permite acceder a la camara.');
    return;
  }

  stopCamera();
  setBusy(true);

  try {
    const deviceId = els.cameraSelect.value;
    await openCamera(deviceId);
    await refreshCameras();
    if (deviceId) {
      els.cameraSelect.value = deviceId;
    }
    showToast(`Camara lista: ${selectedCameraLabel()}.`);
  } catch (error) {
    state.stream = null;
    showToast(error.message);
  } finally {
    setBusy(false);
  }
}

async function startPrimaryCamera() {
  if (!navigator.mediaDevices?.getUserMedia) {
    showToast('El navegador no permite acceder a la camara.');
    return;
  }

  if (state.devices.length === 0) {
    await refreshCameras();
  }

  if (!els.cameraSelect.value && state.devices[0]) {
    els.cameraSelect.value = state.devices[0].deviceId;
  }

  if (!els.cameraSelect.value) {
    showToast('No se detectaron camaras en este navegador.');
    return;
  }

  await startSelectedCamera();
}

async function startIphoneCamera() {
  if (!navigator.mediaDevices?.getUserMedia) {
    showToast('El navegador no permite acceder a la camara.');
    return;
  }

  stopCamera();
  setBusy(true);

  try {
    await requestCameraLabels();
    await refreshCameras();

    const iphoneCamera = findIphoneCamera();
    if (!iphoneCamera) {
      showToast(
        'No veo un iPhone disponible. Desbloquéalo, acércalo al Mac, activa Continuity Camera y vuelve a pulsar Buscar iPhone.'
      );
      return;
    }

    els.cameraSelect.value = iphoneCamera.deviceId;
    await openCamera(iphoneCamera.deviceId);
    await refreshCameras();
    els.cameraSelect.value = iphoneCamera.deviceId;
    showToast(`Usando iPhone: ${iphoneCamera.label}.`);
  } catch (error) {
    state.stream = null;
    showToast(error.message);
  } finally {
    setBusy(false);
  }
}

async function handleCameraButtonClick() {
  await startPrimaryCamera();
}

async function handleSecondaryCameraButtonClick() {
  if (isMacSystem()) {
    await startIphoneCamera();
    return;
  }

  await refreshCameras();
  render();
  showToast(state.devices.length ? 'Camaras actualizadas.' : 'No se detectaron camaras.');
}

function stopCamera() {
  if (state.stream) {
    for (const track of state.stream.getTracks()) {
      track.stop();
    }
  }
  state.stream = null;
  els.video.srcObject = null;
}

function pageIdsWithMove(pageIds, fromIndex, toIndex) {
  if (
    fromIndex < 0 ||
    toIndex < 0 ||
    fromIndex >= pageIds.length ||
    toIndex >= pageIds.length ||
    fromIndex === toIndex
  ) {
    return pageIds;
  }

  const nextPageIds = [...pageIds];
  const [pageId] = nextPageIds.splice(fromIndex, 1);
  nextPageIds.splice(toIndex, 0, pageId);
  return nextPageIds;
}

function revealPageInList(pageId) {
  if (!pageId) {
    return;
  }

  requestAnimationFrame(() => {
    const item = els.pagesList.querySelector(`[data-page-id="${pageId}"]`);
    item?.scrollIntoView({
      block: 'nearest',
      behavior: 'smooth'
    });
  });
}

async function reorderSelectedPage(targetIndex) {
  const page = currentPage();
  const pages = state.project?.pages || [];

  if (!page || state.busy || pages.length <= 1) {
    return;
  }

  const currentIndex = pages.findIndex((item) => item.id === page.id);
  if (currentIndex < 0) {
    return;
  }

  const nextIndex = Math.max(0, Math.min(pages.length - 1, targetIndex));
  if (nextIndex === currentIndex) {
    return;
  }

  try {
    await persistCurrentPageDraft();
  } catch (error) {
    showToast(error.message);
    return;
  }

  setBusy(true);

  try {
    const pageIds = pageIdsWithMove(
      pages.map((item) => item.id),
      currentIndex,
      nextIndex
    );
    const { pages: reorderedPages } = await api(`/api/projects/${state.project.id}/pages`, {
      method: 'PATCH',
      body: JSON.stringify({ pageIds })
    });
    state.project = {
      ...state.project,
      pages: reorderedPages
    };
    render();
    revealPageInList(page.id);
    showToast(`Pagina movida a la posicion ${nextIndex + 1}.`);
  } catch (error) {
    showToast(error.message);
  } finally {
    setBusy(false);
  }
}

async function moveSelectedPageBy(delta) {
  const page = currentPage();
  const pages = state.project?.pages || [];

  if (!page || pages.length <= 1) {
    return;
  }

  const currentIndex = pages.findIndex((item) => item.id === page.id);
  await reorderSelectedPage(currentIndex + delta);
}

async function moveSelectedPageToStart() {
  await reorderSelectedPage(0);
}

async function moveSelectedPageToEnd() {
  const pages = state.project?.pages || [];
  await reorderSelectedPage(pages.length - 1);
}

async function capturePage() {
  if (!state.project || !state.stream || state.busy) {
    return;
  }

  const width = els.video.videoWidth;
  const height = els.video.videoHeight;

  if (!width || !height) {
    showToast('La camara aun no entrega imagen.');
    return;
  }

  setBusy(true);

  try {
    await persistCurrentPageDraft({ keepBusy: true });
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    context.drawImage(els.video, 0, 0, width, height);
    const imageData = canvas.toDataURL('image/jpeg', 0.95);
    const { page } = await api(`/api/projects/${state.project.id}/pages`, {
      method: 'POST',
      body: JSON.stringify({ imageData })
    });
    state.selectedPageId = page.id;
    await refreshProject();
    showToast('Pagina capturada.');
  } catch (error) {
    showToast(error.message);
  } finally {
    setBusy(false);
  }
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener('load', () => resolve(reader.result));
    reader.addEventListener('error', () => reject(reader.error));
    reader.readAsDataURL(file);
  });
}

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener('load', () => resolve(image));
    image.addEventListener('error', () => reject(new Error('No se pudo leer esta imagen.')));
    image.src = url;
  });
}

async function fileToCaptureDataUrl(file) {
  if (file.type === 'image/jpeg' || file.type === 'image/png') {
    return readFileAsDataUrl(file);
  }

  const objectUrl = URL.createObjectURL(file);

  try {
    const image = await loadImage(objectUrl);
    const canvas = document.createElement('canvas');
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const context = canvas.getContext('2d');
    context.drawImage(image, 0, 0);
    return canvas.toDataURL('image/jpeg', 0.95);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

async function importPhotos(files) {
  if (!state.project || state.busy) {
    return;
  }

  const imageFiles = Array.from(files).filter((file) => file.type.startsWith('image/'));

  if (imageFiles.length === 0) {
    showToast('Elige una o varias fotos.');
    return;
  }

  setBusy(true);

  try {
    await persistCurrentPageDraft({ keepBusy: true });
    let imported = 0;
    for (const file of imageFiles) {
      const imageData = await fileToCaptureDataUrl(file);
      const { page } = await api(`/api/projects/${state.project.id}/pages`, {
        method: 'POST',
        body: JSON.stringify({ imageData })
      });
      state.selectedPageId = page.id;
      imported += 1;
    }

    await refreshProject();
    showToast(`${imported} ${imported === 1 ? 'foto importada' : 'fotos importadas'}.`);
  } catch (error) {
    showToast(`${error.message} Si son HEIC, prueba a compartirlas como JPEG.`);
  } finally {
    els.photoImportInput.value = '';
    setBusy(false);
  }
}

async function updateInbox(showSuccess = true) {
  if (!state.project) {
    return;
  }

  const { project } = await api(`/api/projects/${state.project.id}/inbox`, {
    method: 'PATCH',
    body: JSON.stringify({
      path: els.inboxPathInput.value,
      watch: els.inboxWatchInput.checked
    })
  });
  state.project = project;
  await loadProjects();
  render();
  if (showSuccess) {
    showToast('Carpeta guardada.');
  }
}

async function saveInbox() {
  if (!state.project || state.busy) {
    return;
  }

  setBusy(true);

  try {
    await updateInbox(true);
  } catch (error) {
    showToast(error.message);
  } finally {
    setBusy(false);
  }
}

async function selectInboxFolder() {
  if (!state.project || state.busy) {
    return;
  }

  setBusy(true);

  try {
    const result = await api('/api/folder-picker', {
      method: 'POST',
      body: '{}'
    });
    els.inboxPathInput.value = result.path;
    await updateInbox(false);
    showToast('Carpeta seleccionada.');
  } catch (error) {
    showToast(error.message);
  } finally {
    setBusy(false);
  }
}

async function scanInbox() {
  if (!state.project || state.busy) {
    return;
  }

  setBusy(true);

  try {
    await persistCurrentPageDraft({ keepBusy: true });
    await updateInbox(false);
    const result = await api(`/api/projects/${state.project.id}/inbox/scan`, {
      method: 'POST',
      body: '{}'
    });
    state.project = result.project;
    const lastPage = result.importedPages.at(-1);
    if (lastPage) {
      state.selectedPageId = lastPage.id;
    }
    await loadProjects();
    render();
    await loadSelectedPageText();

    const pieces = [`${result.importedCount} nuevas`];
    if (result.skippedDuplicates) {
      pieces.push(`${result.skippedDuplicates} ya conocidas`);
    }
    if (result.unsupported.length) {
      pieces.push(`${result.unsupported.length} no soportadas`);
    }
    if (result.errors.length) {
      pieces.push(`${result.errors.length} con error`);
    }
    showToast(`Revision completa: ${pieces.join(', ')}.`);
  } catch (error) {
    showToast(error.message);
  } finally {
    setBusy(false);
  }
}

async function runOcrForPage() {
  const page = currentPage();
  if (!page || state.busy) {
    return;
  }

  setBusy(true);

  try {
    els.editorStatus.textContent = 'Leyendo texto...';
    const { page: nextPage } = await api(
      `/api/projects/${state.project.id}/pages/${page.id}/ocr`,
      { method: 'POST', body: '{}' }
    );
    Object.assign(page, nextPage);
    els.ocrText.value = nextPage.ocrText || '';
    renderFormattedPreview(nextPage.layoutData, nextPage.ocrText || '');
    showToast(nextPage.ocrWarning || 'Texto extraido.');
    await refreshProject();
  } catch (error) {
    showToast(error.message);
  } finally {
    setBusy(false);
  }
}

async function saveText() {
  const page = currentPage();
  if (!page || state.busy) {
    return;
  }

  const text = els.ocrText.value;
  setBusy(true);

  try {
    const { page: nextPage } = await api(`/api/projects/${state.project.id}/pages/${page.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ text })
    });
    Object.assign(page, nextPage);
    page.ocrText = text;
    page.layoutData = null;
    renderFormattedPreview(null, text);
    showToast('Texto guardado.');
    await refreshProject();
  } catch (error) {
    showToast(error.message);
  } finally {
    setBusy(false);
  }
}

async function saveEditorial() {
  const page = currentPage();
  if (!page || state.busy) {
    return;
  }

  const editorialDraft = editorialDraftFromInputs();
  setBusy(true);

  try {
    const { page: nextPage } = await api(
      `/api/projects/${state.project.id}/pages/${page.id}/editorial`,
      {
        method: 'PATCH',
        body: JSON.stringify(editorialDraft)
      }
    );
    Object.assign(page, nextPage);
    await refreshProject();
    showToast('Estructura EPUB guardada.');
  } catch (error) {
    showToast(error.message);
  } finally {
    setBusy(false);
  }
}

async function useSelectedPageAsCover() {
  const page = currentPage();
  if (!state.project || !page || state.busy) {
    return;
  }

  setBusy(true);

  try {
    await persistCurrentPageDraft({ keepBusy: true });
    const { project } = await api(`/api/projects/${state.project.id}/cover`, {
      method: 'PATCH',
      body: JSON.stringify({
        mode: 'page',
        pageId: page.id
      })
    });
    state.project = project;
    await loadProjects();
    render();
    showToast(`Portada actualizada con la pagina ${page.number}.`);
  } catch (error) {
    showToast(error.message);
  } finally {
    setBusy(false);
  }
}

async function uploadProjectCover(files) {
  if (!state.project || state.busy) {
    return;
  }

  const file = Array.from(files || []).find((item) => item.type.startsWith('image/'));
  if (!file) {
    showToast('Elige una imagen para la portada.');
    return;
  }

  setBusy(true);

  try {
    const imageData = await fileToCaptureDataUrl(file);
    const { project } = await api(`/api/projects/${state.project.id}/cover`, {
      method: 'POST',
      body: JSON.stringify({ imageData })
    });
    state.project = project;
    await loadProjects();
    render();
    showToast('Portada externa guardada.');
  } catch (error) {
    showToast(`${error.message} Si es HEIC, prueba a compartirla como JPEG.`);
  } finally {
    els.coverUploadInput.value = '';
    setBusy(false);
  }
}

async function clearProjectCover() {
  if (!state.project || state.busy) {
    return;
  }

  setBusy(true);

  try {
    const { project } = await api(`/api/projects/${state.project.id}/cover`, {
      method: 'PATCH',
      body: JSON.stringify({ mode: 'none' })
    });
    state.project = project;
    await loadProjects();
    render();
    showToast('Portada eliminada.');
  } catch (error) {
    showToast(error.message);
  } finally {
    setBusy(false);
  }
}

async function updatePageCrop(crop) {
  const page = currentPage();
  if (!page || state.busy) {
    return;
  }

  setBusy(true);

  try {
    const { page: nextPage } = await api(`/api/projects/${state.project.id}/pages/${page.id}/crop`, {
      method: 'PATCH',
      body: JSON.stringify({ crop })
    });
    Object.assign(page, nextPage);
    state.cropPageId = page.id;
    state.draftCrop = pageCrop(nextPage);
    await refreshProject();
    showToast(crop ? 'Recorte guardado.' : 'Recorte eliminado.');
  } catch (error) {
    showToast(error.message);
  } finally {
    setBusy(false);
  }
}

async function saveCrop() {
  const crop = normalizeCrop(state.draftCrop);
  if (!crop) {
    showToast('Arrastra sobre la imagen para preparar un recorte.');
    return;
  }

  await updatePageCrop(crop);
}

async function clearCrop() {
  state.draftCrop = null;
  renderCropOverlay();
  await updatePageCrop(null);
}

async function persistCurrentPageDraft(options = {}) {
  const { keepBusy = false } = options;
  const page = currentPage();
  if (!page) {
    return;
  }

  const textDraft = els.ocrText.value;
  const editorialDraft = editorialDraftFromInputs();
  const cropDraft = normalizeCrop(state.cropPageId === page.id ? state.draftCrop : page.crop);
  const textDirty = String(page.ocrText || '') !== String(textDraft);
  const editorialDirty = !sameEditorial(pageEditorial(page), pageEditorial({ editorial: editorialDraft }));
  const cropDirty = !sameCrop(page.crop, cropDraft);

  if (!textDirty && !editorialDirty && !cropDirty) {
    return;
  }

  if (!keepBusy) {
    setBusy(true);
  }

  try {
    if (textDirty) {
      const { page: nextPage } = await api(`/api/projects/${state.project.id}/pages/${page.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ text: textDraft })
      });
      Object.assign(page, nextPage);
      page.ocrText = textDraft;
      page.layoutData = null;
    }

    if (editorialDirty) {
      const { page: nextPage } = await api(
        `/api/projects/${state.project.id}/pages/${page.id}/editorial`,
        {
          method: 'PATCH',
          body: JSON.stringify(editorialDraft)
        }
      );
      Object.assign(page, nextPage);
    }

    if (cropDirty) {
      const { page: nextPage } = await api(`/api/projects/${state.project.id}/pages/${page.id}/crop`, {
        method: 'PATCH',
        body: JSON.stringify({ crop: cropDraft })
      });
      Object.assign(page, nextPage);
      state.cropPageId = page.id;
      state.draftCrop = pageCrop(nextPage);
    }

    await refreshProject();
  } finally {
    if (!keepBusy) {
      setBusy(false);
    }
  }
}

async function deletePage() {
  const page = currentPage();
  if (!page || state.busy) {
    return;
  }

  const confirmed = window.confirm(`Eliminar la pagina ${page.number}?`);
  if (!confirmed) {
    return;
  }

  setBusy(true);

  try {
    const { pages } = await api(`/api/projects/${state.project.id}/pages/${page.id}`, {
      method: 'DELETE'
    });
    state.selectedPageId = pages[0]?.id || null;
    await refreshProject();
    showToast('Pagina eliminada.');
  } catch (error) {
    showToast(error.message);
  } finally {
    setBusy(false);
  }
}

async function exportEpub() {
  if (!state.project || state.busy) {
    return;
  }

  setBusy(true);

  try {
    await persistCurrentPageDraft({ keepBusy: true });
    const { export: exported } = await api(`/api/projects/${state.project.id}/export`, {
      method: 'POST',
      body: '{}'
    });
    const link = document.createElement('a');
    link.href = exported.downloadUrl;
    link.download = exported.fileName;
    link.click();
    showToast(`EPUB generado: ${exported.fileName}`);
  } catch (error) {
    showToast(error.message);
  } finally {
    setBusy(false);
  }
}

async function createProject(event) {
  event.preventDefault();

  try {
    const payload = {
      title: els.titleInput.value,
      author: els.authorInput.value,
      language: els.languageInput.value,
      notes: els.notesInput.value
    };
    const { project } = await api('/api/projects', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    els.projectDialog.close();
    els.projectForm.reset();
    await loadProjects();
    await loadProject(project.id);
    showToast('Libro creado.');
  } catch (error) {
    showToast(error.message);
  }
}

function beginCropDrag(event) {
  const page = currentPage();
  if (!page || state.busy || !els.selectedImage.classList.contains('visible')) {
    return;
  }

  const start = pointInImage(event);
  if (!start) {
    return;
  }

  event.preventDefault();
  els.imageReviewFrame.setPointerCapture(event.pointerId);
  state.cropDrag = {
    pointerId: event.pointerId,
    start
  };
  setDraftCrop(null);
}

function updateCropDrag(event) {
  if (!state.cropDrag || event.pointerId !== state.cropDrag.pointerId) {
    return;
  }

  event.preventDefault();
  setDraftCrop(cropFromPoints(state.cropDrag.start, pointInImage(event)));
}

function endCropDrag(event) {
  if (!state.cropDrag || event.pointerId !== state.cropDrag.pointerId) {
    return;
  }

  updateCropDrag(event);
  state.cropDrag = null;

  if (els.imageReviewFrame.hasPointerCapture(event.pointerId)) {
    els.imageReviewFrame.releasePointerCapture(event.pointerId);
  }

  if (!state.draftCrop) {
    showToast('El recorte es demasiado pequeno.');
  }
}

els.newProjectButton.addEventListener('click', () => {
  els.projectDialog.showModal();
  els.titleInput.focus();
});

els.cancelProjectButton.addEventListener('click', () => {
  els.projectDialog.close();
});

els.projectForm.addEventListener('submit', createProject);
els.projectSelect.addEventListener('change', async () => {
  const nextProjectId = els.projectSelect.value;
  if (!nextProjectId || nextProjectId === state.project?.id) {
    return;
  }

  try {
    await persistCurrentPageDraft();
    await loadProject(nextProjectId);
  } catch (error) {
    showToast(error.message);
    els.projectSelect.value = state.project?.id || '';
  }
});
els.cameraButton.addEventListener('click', handleCameraButtonClick);
els.iphoneCameraButton.addEventListener('click', handleSecondaryCameraButtonClick);
els.cameraSelect.addEventListener('change', startSelectedCamera);
els.captureButton.addEventListener('click', capturePage);
els.importPhotosButton.addEventListener('click', () => els.photoImportInput.click());
els.photoImportInput.addEventListener('change', () => importPhotos(els.photoImportInput.files));
els.selectInboxButton.addEventListener('click', selectInboxFolder);
els.saveInboxButton.addEventListener('click', saveInbox);
els.scanInboxButton.addEventListener('click', scanInbox);
els.ocrButton.addEventListener('click', runOcrForPage);
els.saveTextButton.addEventListener('click', saveText);
els.usePageAsCoverButton.addEventListener('click', useSelectedPageAsCover);
els.uploadCoverButton.addEventListener('click', () => els.coverUploadInput.click());
els.coverUploadInput.addEventListener('change', () => uploadProjectCover(els.coverUploadInput.files));
els.clearCoverButton.addEventListener('click', clearProjectCover);
els.saveEditorialButton.addEventListener('click', saveEditorial);
els.saveCropButton.addEventListener('click', saveCrop);
els.clearCropButton.addEventListener('click', clearCrop);
els.partStartInput.addEventListener('change', updateEditorialControlState);
els.chapterStartInput.addEventListener('change', updateEditorialControlState);
els.movePageFirstButton.addEventListener('click', moveSelectedPageToStart);
els.movePageUpButton.addEventListener('click', () => moveSelectedPageBy(-1));
els.movePageDownButton.addEventListener('click', () => moveSelectedPageBy(1));
els.movePageLastButton.addEventListener('click', moveSelectedPageToEnd);
els.deletePageButton.addEventListener('click', deletePage);
els.exportButton.addEventListener('click', exportEpub);
els.video.addEventListener('loadedmetadata', renderCamera);
els.selectedImage.addEventListener('load', renderCropOverlay);
els.imageReviewFrame.addEventListener('pointerdown', beginCropDrag);
els.imageReviewFrame.addEventListener('pointermove', updateCropDrag);
els.imageReviewFrame.addEventListener('pointerup', endCropDrag);
els.imageReviewFrame.addEventListener('pointercancel', endCropDrag);
els.ocrText.addEventListener('input', () => renderFormattedPreview(null, els.ocrText.value));

function canUseCaptureShortcut(event) {
  if (event.defaultPrevented || event.repeat || event.code !== 'Space') {
    return false;
  }

  if (els.captureView.hidden || els.projectDialog.open) {
    return false;
  }

  const target = event.target;
  if (!(target instanceof HTMLElement)) {
    return true;
  }

  if (target.isContentEditable) {
    return false;
  }

  return !target.closest('button, input, textarea, select, [role="button"]');
}

document.addEventListener('keydown', (event) => {
  if (!canUseCaptureShortcut(event)) {
    return;
  }

  event.preventDefault();
  capturePage();
});

function activateTabGroup(buttonAttr) {
  const buttons = document.querySelectorAll(`[${buttonAttr}]`);
  const panels = new Map();

  for (const button of buttons) {
    const key = button.getAttribute(buttonAttr);
    const target = button.getAttribute('aria-controls');
    if (key && target) {
      panels.set(key, document.getElementById(target));
    }
  }

  for (const button of buttons) {
    button.addEventListener('click', () => {
      const selected = button.getAttribute(buttonAttr);
      for (const tab of buttons) {
        tab.setAttribute(
          'aria-selected',
          tab.getAttribute(buttonAttr) === selected ? 'true' : 'false'
        );
      }
      for (const [paneKey, panel] of panels) {
        if (panel) {
          panel.hidden = paneKey !== selected;
        }
      }
    });
  }
}

activateTabGroup('data-view-tab');
activateTabGroup('data-pane-tab');

await loadSystemSupport();
await refreshCameras();
await loadProjects();
render();

if (navigator.mediaDevices) {
  navigator.mediaDevices.addEventListener('devicechange', async () => {
    await refreshCameras();
    render();
  });
}

window.setInterval(async () => {
  const editing = [
    els.ocrText,
    els.inboxPathInput,
    els.partTitleInput,
    els.chapterTitleInput,
    els.chapterHeaderModeInput
  ].includes(document.activeElement);
  if (!state.project?.inbox?.watch || state.busy || editing) {
    return;
  }

  try {
    await refreshProject();
  } catch {
    // The next explicit user action will surface any persistent problem.
  }
}, 7000);
