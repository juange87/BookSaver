const token = decodeURIComponent(window.location.pathname.split('/').filter(Boolean).at(-1) || '');

const state = {
  sentFromDevice: 0,
  busy: false
};

const els = {
  captureButton: document.querySelector('#mobileCaptureButton'),
  photoInput: document.querySelector('#mobilePhotoInput'),
  status: document.querySelector('#mobileStatus'),
  counter: document.querySelector('#mobileCounter'),
  toast: document.querySelector('#toast')
};

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
    throw new Error(payload.error || 'No se pudo completar la acción.');
  }

  return payload;
}

function showToast(message) {
  els.toast.textContent = message;
  els.toast.classList.add('visible');
  window.clearTimeout(showToast.timeout);
  showToast.timeout = window.setTimeout(() => els.toast.classList.remove('visible'), 3600);
}

function setBusy(value) {
  state.busy = value;
  els.captureButton.disabled = value;
  els.captureButton.textContent = value ? 'Enviando...' : 'Capturar página';
}

function renderCounter(uploadedCount) {
  const localCount = state.sentFromDevice;
  els.counter.textContent = `${localCount} ${
    localCount === 1 ? 'página enviada' : 'páginas enviadas'
  } desde este móvil. Total de la sesión: ${uploadedCount}.`;
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

async function loadStatus() {
  const { mobileCapture } = await api(`/api/mobile-capture/${encodeURIComponent(token)}`);
  els.status.textContent = 'Listo. Cada foto se añadirá al final del libro abierto.';
  renderCounter(mobileCapture.uploadedCount);
}

async function uploadPhoto(file) {
  if (!file || state.busy) {
    return;
  }

  setBusy(true);
  try {
    const imageData = await fileToCaptureDataUrl(file);
    const { mobileCapture } = await api(`/api/mobile-capture/${encodeURIComponent(token)}/pages`, {
      method: 'POST',
      body: JSON.stringify({ imageData })
    });
    state.sentFromDevice += 1;
    els.status.textContent = 'Página enviada. Puedes capturar la siguiente.';
    renderCounter(mobileCapture.uploadedCount);
    showToast('Página añadida a BookSaver.');
  } catch (error) {
    els.status.textContent = error.message;
    showToast(error.message);
  } finally {
    els.photoInput.value = '';
    setBusy(false);
  }
}

els.captureButton.addEventListener('click', () => {
  els.photoInput.click();
});

els.photoInput.addEventListener('change', () => {
  uploadPhoto(els.photoInput.files?.[0]);
});

try {
  await loadStatus();
} catch (error) {
  els.status.textContent = error.message;
  els.captureButton.disabled = true;
  showToast(error.message);
}
