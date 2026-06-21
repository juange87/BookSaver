const CROP_STATUSES = new Set(['suggested', 'accepted', 'rejected']);

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function round(value, digits = 4) {
  const factor = 10 ** digits;
  return Math.round(Number(value || 0) * factor) / factor;
}

function luminanceAt(pixels, offset) {
  return 0.2126 * Number(pixels[offset] || 0) + 0.7152 * Number(pixels[offset + 1] || 0) + 0.0722 * Number(pixels[offset + 2] || 0);
}

function normalizeCrop(crop) {
  if (!crop) {
    return null;
  }

  const left = clamp(Number(crop.left), 0, 1);
  const top = clamp(Number(crop.top), 0, 1);
  const width = clamp(Number(crop.width), 0, 1 - left);
  const height = clamp(Number(crop.height), 0, 1 - top);

  if (![left, top, width, height].every(Number.isFinite) || width < 0.03 || height < 0.03) {
    return null;
  }

  return {
    left: round(left),
    top: round(top),
    width: round(width),
    height: round(height)
  };
}

export function normalizeCropSuggestion(input = {}) {
  const crop = normalizeCrop(input.crop);
  if (!crop) {
    return null;
  }

  return {
    status: CROP_STATUSES.has(input.status) ? input.status : 'suggested',
    source: String(input.source || 'border-detection'),
    confidence: round(clamp(Number(input.confidence), 0, 1), 3),
    crop,
    createdAt: input.createdAt || new Date().toISOString()
  };
}

export function suggestPageCropFromSample(input = {}) {
  const width = Math.max(0, Math.round(Number(input.width || 0)));
  const height = Math.max(0, Math.round(Number(input.height || 0)));
  const pixels = input.pixels && typeof input.pixels.length === 'number' ? input.pixels : [];

  if (!width || !height || pixels.length < width * height * 4) {
    return null;
  }

  let min = 255;
  let max = 0;
  const luminance = new Float32Array(width * height);

  for (let index = 0; index < width * height; index += 1) {
    const value = luminanceAt(pixels, index * 4);
    luminance[index] = value;
    min = Math.min(min, value);
    max = Math.max(max, value);
  }

  const contrast = max - min;
  if (contrast < 35) {
    return null;
  }

  const threshold = min + contrast * 0.45;
  const rowHits = new Array(height).fill(0);
  const colHits = new Array(width).fill(0);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (luminance[y * width + x] >= threshold) {
        rowHits[y] += 1;
        colHits[x] += 1;
      }
    }
  }

  const minRowPixels = width * 0.2;
  const minColPixels = height * 0.2;
  const top = rowHits.findIndex((count) => count >= minRowPixels);
  const bottom = rowHits.findLastIndex((count) => count >= minRowPixels);
  const left = colHits.findIndex((count) => count >= minColPixels);
  const right = colHits.findLastIndex((count) => count >= minColPixels);

  if (top < 0 || bottom <= top || left < 0 || right <= left) {
    return null;
  }

  const crop = normalizeCrop({
    left: left / width,
    top: top / height,
    width: (right - left + 1) / width,
    height: (bottom - top + 1) / height
  });
  if (!crop) {
    return null;
  }

  const margin = Math.min(crop.left, crop.top, 1 - crop.left - crop.width, 1 - crop.top - crop.height);
  if (margin < 0.015) {
    return null;
  }

  return normalizeCropSuggestion({
    status: 'suggested',
    source: 'border-detection',
    confidence: Math.min(1, (contrast / 255) * 0.8 + 0.2),
    crop
  });
}

