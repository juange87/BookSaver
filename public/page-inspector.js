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
