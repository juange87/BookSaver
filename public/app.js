const state = {
  projects: [],
  project: null,
  selectedPageId: null,
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
  cameraButton: document.querySelector('#cameraButton'),
  iphoneCameraButton: document.querySelector('#iphoneCameraButton'),
  cameraSelect: document.querySelector('#cameraSelect'),
  cameraInfo: document.querySelector('#cameraInfo'),
  cameraDevicesList: document.querySelector('#cameraDevicesList'),
  cameraDiagnosticsHint: document.querySelector('#cameraDiagnosticsHint'),
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
  editorialStatus: document.querySelector('#editorialStatus'),
  pageImageModeInput: document.querySelector('#pageImageModeInput'),
  partStartInput: document.querySelector('#partStartInput'),
  partTitleInput: document.querySelector('#partTitleInput'),
  chapterStartInput: document.querySelector('#chapterStartInput'),
  chapterTitleInput: document.querySelector('#chapterTitleInput'),
  chapterHeaderModeInput: document.querySelector('#chapterHeaderModeInput'),
  chapterEndInput: document.querySelector('#chapterEndInput'),
  saveEditorialButton: document.querySelector('#saveEditorialButton'),
  cropStatus: document.querySelector('#cropStatus'),
  saveCropButton: document.querySelector('#saveCropButton'),
  clearCropButton: document.querySelector('#clearCropButton'),
  saveTextButton: document.querySelector('#saveTextButton'),
  deletePageButton: document.querySelector('#deletePageButton'),
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

function buildChapterIndex(pages) {
  const chapters = [];
  let current = null;
  let chapterNumber = 0;

  for (const page of pages) {
    const editorial = pageEditorial(page);
    if (!current || (editorial.chapterStart && current.pages.length > 0)) {
      if (editorial.chapterStart) {
        chapterNumber += 1;
      }
      const sectionNumber = chapters.length + 1;
      current = {
        title: chapterTitleForPage(page, chapterNumber || sectionNumber, sectionNumber),
        startPage: page.number,
        pages: []
      };
      chapters.push(current);
    }

    current.pages.push(page);
    current.endPage = page.number;

    if (editorial.chapterEnd) {
      current = null;
    }
  }

  return chapters;
}

function buildBookIndexItems(pages) {
  const chapters = buildChapterIndex(pages);
  const items = [];
  let partNumber = 0;

  for (const chapter of chapters) {
    let chapterAdded = false;

    for (const page of chapter.pages) {
      const editorial = pageEditorial(page);
      if (editorial.partStart) {
        partNumber += 1;
        items.push({
          type: 'part',
          title: partTitleForPage(page, partNumber),
          page: page.number
        });
      }

      if (!chapterAdded) {
        items.push({
          type: 'chapter',
          title: chapter.title,
          startPage: chapter.startPage,
          endPage: chapter.endPage
        });
        chapterAdded = true;
      }
    }
  }

  return items;
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

async function loadProject(projectId) {
  const { project } = await api(`/api/projects/${projectId}`);
  const selectedPageId = state.selectedPageId;
  state.project = project;
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
  const badges = [];

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
      const pageRange =
        itemData.startPage === itemData.endPage
          ? `pag. ${itemData.startPage}`
          : `pags. ${itemData.startPage}-${itemData.endPage}`;
      item.textContent = `${itemData.title} · ${pageRange}`;
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

  for (const page of pages) {
    const item = document.createElement('button');
    item.type = 'button';
    item.className = `page-item ${page.id === state.selectedPageId ? 'selected' : ''}`;
    item.addEventListener('click', async () => {
      state.selectedPageId = page.id;
      render();
      await loadSelectedPageText();
    });

    const image = document.createElement('img');
    image.alt = `Pagina ${page.number}`;
    image.src = `/api/projects/${state.project.id}/pages/${page.id}/image?${page.updatedAt}`;

    const body = document.createElement('span');
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
    els.pagesList.append(item);
  }
}

function renderEditor() {
  const page = currentPage();
  const hasPage = Boolean(page);

  els.ocrButton.disabled = !hasPage || state.busy;
  els.saveTextButton.disabled = !hasPage || state.busy;
  els.deletePageButton.disabled = !hasPage || state.busy;
  els.ocrText.disabled = !hasPage || state.busy;

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

function renderCamera() {
  const active = Boolean(state.stream);
  els.captureButton.disabled = !active || !state.project || state.busy;
  els.importPhotosButton.disabled = !state.project || state.busy;
  els.cameraButton.disabled = state.busy;
  els.iphoneCameraButton.disabled = state.busy;
  els.cameraSelect.disabled = state.busy || state.devices.length === 0;
  els.cameraStage.classList.toggle('active', active);
  els.cameraInfo.textContent = active
    ? `${els.video.videoWidth || '-'} x ${els.video.videoHeight || '-'}`
    : 'Camara apagada';
  renderCameraDiagnostics();
}

function renderInbox() {
  const inbox = state.project?.inbox || {};
  const hasProject = Boolean(state.project);
  const path = inbox.path || '';

  if (document.activeElement !== els.inboxPathInput) {
    els.inboxPathInput.value = path;
  }

  els.inboxWatchInput.checked = Boolean(inbox.watch);
  els.inboxPathInput.disabled = !hasProject || state.busy;
  els.inboxWatchInput.disabled = !hasProject || state.busy;
  els.selectInboxButton.disabled = !hasProject || state.busy;
  els.saveInboxButton.disabled = !hasProject || state.busy;
  els.scanInboxButton.disabled = !hasProject || state.busy || !path;

  if (!hasProject) {
    els.inboxStatus.textContent = 'Crea o abre un libro para configurar la bandeja.';
    return;
  }

  if (!path) {
    els.inboxStatus.textContent = 'Configura una carpeta para importar fotos del iPhone.';
    return;
  }

  const mode = inbox.watch ? 'vigilancia activa' : 'revision manual';
  const lastScan = inbox.lastScanAt ? new Date(inbox.lastScanAt).toLocaleString() : 'sin revisar';
  const imported = inbox.lastImportedCount ?? 0;
  const skipped = inbox.lastSkippedCount ?? 0;
  const unsupported = inbox.lastUnsupportedCount ?? 0;
  const errors = inbox.lastErrorCount ?? 0;
  els.inboxStatus.textContent = `${mode}. Ultima revision: ${lastScan}. Importadas: ${imported}. Ya conocidas: ${skipped}. No soportadas: ${unsupported}. Errores: ${errors}.`;
}

function render() {
  renderProjects();
  renderPages();
  renderEditor();
  renderCamera();
  renderInbox();

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

  const iphoneCamera = findIphoneCamera();
  if (iphoneCamera) {
    els.cameraDiagnosticsHint.textContent = `Detectado iPhone: ${iphoneCamera.label}.`;
  } else if (!hasCameraLabels()) {
    els.cameraDiagnosticsHint.textContent =
      'Pulsa Buscar iPhone para pedir permiso y desbloquear los nombres de camaras.';
  } else {
    els.cameraDiagnosticsHint.textContent =
      'El navegador no esta viendo ninguna camara con nombre de iPhone o Continuity Camera.';
  }
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
        'No veo una camara de iPhone. Bloquea y acerca el iPhone, activa Continuity Camera y vuelve a pulsar Usar iPhone.'
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

function stopCamera() {
  if (state.stream) {
    for (const track of state.stream.getTracks()) {
      track.stop();
    }
  }
  state.stream = null;
  els.video.srcObject = null;
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

  setBusy(true);

  try {
    const { page: nextPage } = await api(`/api/projects/${state.project.id}/pages/${page.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ text: els.ocrText.value })
    });
    Object.assign(page, nextPage);
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

  setBusy(true);

  try {
    const { page: nextPage } = await api(
      `/api/projects/${state.project.id}/pages/${page.id}/editorial`,
      {
        method: 'PATCH',
        body: JSON.stringify({
          imageMode: els.pageImageModeInput.checked ? 'image' : 'text',
          partStart: els.partStartInput.checked,
          partTitle: els.partTitleInput.value,
          chapterStart: els.chapterStartInput.checked,
          chapterTitle: els.chapterTitleInput.value,
          chapterHeaderMode: els.chapterHeaderModeInput.value,
          chapterEnd: els.chapterEndInput.checked
        })
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

async function persistCurrentPageStateForExport() {
  const page = currentPage();
  if (!page) {
    return;
  }

  let dirty = false;
  const editorialDraft = editorialDraftFromInputs();

  if (!sameEditorial(pageEditorial(page), pageEditorial({ editorial: editorialDraft }))) {
    const { page: nextPage } = await api(
      `/api/projects/${state.project.id}/pages/${page.id}/editorial`,
      {
        method: 'PATCH',
        body: JSON.stringify(editorialDraft)
      }
    );
    Object.assign(page, nextPage);
    dirty = true;
  }

  const draftCrop = normalizeCrop(state.cropPageId === page.id ? state.draftCrop : page.crop);
  if (!sameCrop(page.crop, draftCrop)) {
    const { page: nextPage } = await api(`/api/projects/${state.project.id}/pages/${page.id}/crop`, {
      method: 'PATCH',
      body: JSON.stringify({ crop: draftCrop })
    });
    Object.assign(page, nextPage);
    state.cropPageId = page.id;
    state.draftCrop = pageCrop(nextPage);
    dirty = true;
  }

  if (dirty) {
    await refreshProject();
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
    state.project.pages = pages;
    state.selectedPageId = pages[0]?.id || null;
    await loadSelectedPageText();
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
    await persistCurrentPageStateForExport();
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
els.projectSelect.addEventListener('change', () => loadProject(els.projectSelect.value));
els.cameraButton.addEventListener('click', startIphoneCamera);
els.iphoneCameraButton.addEventListener('click', startIphoneCamera);
els.cameraSelect.addEventListener('change', startSelectedCamera);
els.captureButton.addEventListener('click', capturePage);
els.importPhotosButton.addEventListener('click', () => els.photoImportInput.click());
els.photoImportInput.addEventListener('change', () => importPhotos(els.photoImportInput.files));
els.selectInboxButton.addEventListener('click', selectInboxFolder);
els.saveInboxButton.addEventListener('click', saveInbox);
els.scanInboxButton.addEventListener('click', scanInbox);
els.ocrButton.addEventListener('click', runOcrForPage);
els.saveTextButton.addEventListener('click', saveText);
els.saveEditorialButton.addEventListener('click', saveEditorial);
els.saveCropButton.addEventListener('click', saveCrop);
els.clearCropButton.addEventListener('click', clearCrop);
els.partStartInput.addEventListener('change', updateEditorialControlState);
els.chapterStartInput.addEventListener('change', updateEditorialControlState);
els.deletePageButton.addEventListener('click', deletePage);
els.exportButton.addEventListener('click', exportEpub);
els.video.addEventListener('loadedmetadata', renderCamera);
els.selectedImage.addEventListener('load', renderCropOverlay);
els.imageReviewFrame.addEventListener('pointerdown', beginCropDrag);
els.imageReviewFrame.addEventListener('pointermove', updateCropDrag);
els.imageReviewFrame.addEventListener('pointerup', endCropDrag);
els.imageReviewFrame.addEventListener('pointercancel', endCropDrag);
els.ocrText.addEventListener('input', () => renderFormattedPreview(null, els.ocrText.value));

document.addEventListener('keydown', (event) => {
  const editing = ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName);
  if (event.code === 'Space' && !editing) {
    event.preventDefault();
    capturePage();
  }
});

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
