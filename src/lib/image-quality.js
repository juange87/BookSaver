const MIN_PAGE_MEGAPIXELS = 2;
const MIN_PAGE_SHORT_SIDE = 1000;
const DARK_BRIGHTNESS_THRESHOLD = 70;
const BLUR_EDGE_THRESHOLD = 8;
const LANDSCAPE_RATIO = 1.1;

const KNOWN_FLAG_CODES = new Set([
  'low-resolution',
  'dark-capture',
  'blurred-capture',
  'orientation-suspect'
]);

function now() {
  return new Date().toISOString();
}

function round(value, digits = 2) {
  const factor = 10 ** digits;
  return Math.round(Number(value || 0) * factor) / factor;
}

function numeric(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function flag(code, severity, message, cause) {
  return { code, severity, message, cause };
}

function dimensions(input = {}) {
  const width = Math.max(0, Math.round(numeric(input.width)));
  const height = Math.max(0, Math.round(numeric(input.height)));
  return { width, height };
}

function dimensionMetrics(input = {}) {
  const { width, height } = dimensions(input);
  const megapixels = round((width * height) / 1_000_000, 2);
  return {
    width,
    height,
    megapixels,
    orientation: width && height && width > height ? 'landscape' : 'portrait'
  };
}

function dimensionFlags(metrics) {
  const flags = [];
  const shortSide = Math.min(metrics.width, metrics.height);

  if (!metrics.width || !metrics.height || metrics.megapixels < MIN_PAGE_MEGAPIXELS || shortSide < MIN_PAGE_SHORT_SIDE) {
    flags.push(
      flag(
        'low-resolution',
        'high',
        'La captura tiene poca resolucion para OCR fiable.',
        `Resolucion ${metrics.width} x ${metrics.height}; objetivo minimo ${MIN_PAGE_SHORT_SIDE}px en el lado corto y ${MIN_PAGE_MEGAPIXELS} MP.`
      )
    );
  }

  if (metrics.width > metrics.height * LANDSCAPE_RATIO) {
    flags.push(
      flag(
        'orientation-suspect',
        'medium',
        'La captura parece apaisada para una pagina de libro.',
        'Comprueba que la pagina no este girada o que no se haya capturado una mesa mas ancha que el papel.'
      )
    );
  }

  return flags;
}

function luminanceAt(pixels, offset) {
  return 0.2126 * numeric(pixels[offset]) + 0.7152 * numeric(pixels[offset + 1]) + 0.0722 * numeric(pixels[offset + 2]);
}

function pixelMetrics({ width, height, pixels }) {
  const expectedLength = width * height * 4;
  const values = pixels && typeof pixels.length === 'number' ? pixels : [];

  if (!width || !height || values.length < expectedLength) {
    return {
      brightness: 0,
      contrast: 0,
      edgeScore: 0
    };
  }

  let sum = 0;
  let min = 255;
  let max = 0;
  let edgeTotal = 0;
  let edgeCount = 0;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const offset = (y * width + x) * 4;
      const value = luminanceAt(values, offset);
      sum += value;
      min = Math.min(min, value);
      max = Math.max(max, value);

      if (x > 0) {
        edgeTotal += Math.abs(value - luminanceAt(values, offset - 4));
        edgeCount += 1;
      }
      if (y > 0) {
        edgeTotal += Math.abs(value - luminanceAt(values, offset - width * 4));
        edgeCount += 1;
      }
    }
  }

  return {
    brightness: round(sum / (width * height), 1),
    contrast: round(max - min, 1),
    edgeScore: round(edgeCount ? edgeTotal / edgeCount : 0, 1)
  };
}

function normalizeFlag(input = {}) {
  const code = String(input.code || '').trim();
  if (!KNOWN_FLAG_CODES.has(code)) {
    return null;
  }

  return {
    code,
    severity: ['high', 'medium', 'low'].includes(input.severity) ? input.severity : 'medium',
    message: String(input.message || '').trim() || 'Aviso de calidad de captura.',
    cause: String(input.cause || '').trim()
  };
}

export function normalizeImageQuality(input = {}) {
  const metrics = {
    ...dimensionMetrics(input.metrics || input),
    ...(input.metrics || {})
  };
  const flags = (Array.isArray(input.flags) ? input.flags : [])
    .map(normalizeFlag)
    .filter(Boolean);
  const ignored = Boolean(input.ignored);

  return {
    checkedAt: input.checkedAt || now(),
    source: String(input.source || 'capture'),
    ok: ignored || flags.length === 0,
    ignored,
    metrics,
    flags
  };
}

export function analyzeImageMetadata(input = {}) {
  const metrics = dimensionMetrics(input);
  return normalizeImageQuality({
    checkedAt: input.checkedAt,
    source: input.source || 'capture',
    metrics,
    flags: dimensionFlags(metrics)
  });
}

export function analyzeImageSample(input = {}) {
  const metrics = {
    ...dimensionMetrics(input),
    ...pixelMetrics({
      width: Math.round(numeric(input.width)),
      height: Math.round(numeric(input.height)),
      pixels: input.pixels
    })
  };
  const flags = dimensionFlags(metrics);

  if (metrics.brightness < DARK_BRIGHTNESS_THRESHOLD) {
    flags.push(
      flag(
        'dark-capture',
        'high',
        'La captura esta demasiado oscura.',
        `Brillo medio ${metrics.brightness}; intenta iluminar mejor la pagina.`
      )
    );
  }

  if (metrics.edgeScore < BLUR_EDGE_THRESHOLD) {
    flags.push(
      flag(
        'blurred-capture',
        'medium',
        'La captura parece desenfocada o con poco detalle.',
        `Detalle local ${metrics.edgeScore}; estabiliza la camara o acerca mejor la pagina.`
      )
    );
  }

  return normalizeImageQuality({
    checkedAt: input.checkedAt,
    source: input.source || 'capture',
    metrics,
    flags
  });
}

export function captureQualityNeedsReview(quality) {
  const normalized = normalizeImageQuality(quality);
  return !normalized.ignored && normalized.flags.length > 0;
}

