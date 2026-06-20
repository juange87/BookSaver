const DEFAULT_TITLE_PATTERN = /^libro sin t[ií]tulo$/iu;
const METADATA_LANGUAGE_PATTERN = /^[a-z]{2,3}(?:[-_][a-z0-9]{2,8})*$/iu;
const PAGE_IMAGE_MODES = new Set(['text', 'image']);
const CHAPTER_HEADER_MODES = new Set(['none', 'auto', 'page']);
const COVER_MODES = new Set(['none', 'page', 'upload']);
const OCR_CONFIDENCE_REVIEW_THRESHOLD = 70;
const OCR_QUALITY_REVIEW_THRESHOLD = 55;

const OCR_LANGUAGE_ALIASES = new Map([
  ['spa', 'es'],
  ['eng', 'en'],
  ['fra', 'fr'],
  ['fre', 'fr'],
  ['deu', 'de'],
  ['ger', 'de'],
  ['ita', 'it'],
  ['por', 'pt'],
  ['cat', 'ca'],
  ['glg', 'gl'],
  ['eus', 'eu'],
  ['baq', 'eu']
]);

function normalizeEditorial(input = {}) {
  const imageMode =
    input.imageMode === 'image' || input.imagePage === true || input.renderMode === 'image'
      ? 'image'
      : 'text';
  const partStart = Boolean(input.partStart);
  const partTitle = String(input.partTitle || '').trim();
  const chapterStart = Boolean(input.chapterStart);
  const chapterEnd = Boolean(input.chapterEnd);
  const chapterTitle = String(input.chapterTitle || '').trim();
  const rawHeaderMode = String(input.chapterHeaderMode || input.headerMode || 'none');
  const chapterHeaderMode =
    chapterStart && CHAPTER_HEADER_MODES.has(rawHeaderMode) ? rawHeaderMode : 'none';

  return {
    imageMode: PAGE_IMAGE_MODES.has(imageMode) ? imageMode : 'text',
    partStart,
    partTitle,
    chapterStart,
    chapterEnd,
    chapterTitle,
    chapterHeaderMode
  };
}

function normalizeCover(input = {}) {
  const rawMode = String(input.mode || 'none');
  return {
    mode: COVER_MODES.has(rawMode) ? rawMode : 'none',
    pageId: input.pageId || null,
    image: input.image || null
  };
}

function normalizeLanguage(value) {
  const language = String(value || '').trim().toLowerCase().replace('_', '-');

  if (!language || !METADATA_LANGUAGE_PATTERN.test(language)) {
    return null;
  }

  const primary = language.split('-')[0];
  return OCR_LANGUAGE_ALIASES.get(primary) || primary;
}

function pageNumber(page, index) {
  const number = Number(page?.number);
  return Number.isFinite(number) && number > 0 ? number : index + 1;
}

function pageText(page) {
  return String(page?.text ?? page?.ocrText ?? '');
}

function pageNeedsOcr(page) {
  return normalizeEditorial(page?.editorial || page).imageMode !== 'image';
}

function pageReviewed(page) {
  return Boolean(page?.reviewed);
}

function numericSignal(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function pageHasLowConfidenceOcr(page) {
  if (page?.ocrNeedsReview === true) {
    return true;
  }

  const confidence = numericSignal(page?.ocrConfidence);
  if (confidence !== null && confidence < OCR_CONFIDENCE_REVIEW_THRESHOLD) {
    return true;
  }

  const qualityScore = numericSignal(page?.ocrQualityScore);
  return qualityScore !== null && qualityScore < OCR_QUALITY_REVIEW_THRESHOLD;
}

function uniqueSortedNumbers(pageNumbers) {
  return Array.from(new Set((pageNumbers || []).map(Number).filter(Number.isFinite))).sort(
    (left, right) => left - right
  );
}

function summarizePageNumbers(pageNumbers, limit = 6) {
  const numbers = uniqueSortedNumbers(pageNumbers);

  if (!numbers.length) {
    return '';
  }

  const preview = numbers.slice(0, limit).join(', ');
  return numbers.length > limit ? `${preview}...` : preview;
}

function pageCountLabel(count) {
  return count === 1 ? '1 pagina' : `${count} paginas`;
}

function pagesMessage(pageNumbers) {
  return `pags. ${summarizePageNumbers(pageNumbers)}`;
}

function pageTarget(pageNumbers) {
  const pages = uniqueSortedNumbers(pageNumbers);
  return {
    kind: 'pages',
    pages,
    label: pages.length === 1 ? `Pagina ${pages[0]}` : `Paginas ${summarizePageNumbers(pages)}`
  };
}

function sectionTarget(sections, fallbackKind = 'sections') {
  const pages = uniqueSortedNumbers(sections.map((section) => section.page));
  return {
    kind: fallbackKind,
    pages,
    label: pages.length === 1 ? `Seccion en pagina ${pages[0]}` : `Secciones en paginas ${summarizePageNumbers(pages)}`
  };
}

function bookTarget(label) {
  return {
    kind: 'book',
    label
  };
}

function warning({
  code,
  type = code,
  severity,
  scope,
  count,
  pages = [],
  sections = [],
  fields = [],
  target,
  message,
  action
}) {
  return {
    code,
    type,
    severity,
    scope,
    count: count ?? (pages.length || sections.length || fields.length || 1),
    pages: uniqueSortedNumbers(pages),
    sections,
    fields,
    target,
    message,
    action
  };
}

function projectMetadataWarning(metadata) {
  const missingFields = [];
  const title = String(metadata?.title || '').trim();
  const language = String(metadata?.language || '').trim();

  if (!title || DEFAULT_TITLE_PATTERN.test(title)) {
    missingFields.push('titulo');
  }

  if (!normalizeLanguage(language)) {
    missingFields.push('idioma OCR');
  }

  if (!missingFields.length) {
    return null;
  }

  return warning({
    code: 'metadata-incomplete',
    type: 'metadata',
    severity: 'high',
    scope: 'book',
    fields: missingFields,
    target: bookTarget('Metadatos del libro'),
    message: `Faltan metadatos basicos del libro: ${missingFields.join(', ')}.`,
    action: 'Completa el titulo y el idioma OCR antes de exportar.'
  });
}

function detectStructureIssues(contexts) {
  const issues = [];
  let explicitChapterOpen = false;
  let explicitChapterStartPage = null;
  let openPart = null;
  let openPartHasChapter = false;

  for (const page of contexts) {
    const editorial = page.editorial;

    if (editorial.partStart) {
      if (openPart && !openPartHasChapter) {
        issues.push({
          type: 'part-without-chapter',
          page: openPart.page,
          pageId: openPart.pageId,
          title: openPart.title,
          message: `La parte iniciada en la pagina ${openPart.page} no contiene ningun capitulo marcado.`
        });
      }

      if (explicitChapterOpen && !editorial.chapterStart) {
        issues.push({
          type: 'part-start-inside-chapter',
          page: page.number,
          pageId: page.id,
          title: editorial.partTitle,
          message: `La pagina ${page.number} inicia una parte dentro del capitulo abierto en la pagina ${explicitChapterStartPage}.`
        });
      }

      openPart = {
        page: page.number,
        pageId: page.id,
        title: editorial.partTitle
      };
      openPartHasChapter = false;
    }

    if (editorial.chapterStart) {
      explicitChapterOpen = true;
      explicitChapterStartPage = page.number;
      if (openPart) {
        openPartHasChapter = true;
      }
    }

    if (editorial.chapterEnd) {
      if (!explicitChapterOpen && !editorial.chapterStart) {
        issues.push({
          type: 'chapter-end-without-start',
          page: page.number,
          pageId: page.id,
          title: editorial.chapterTitle,
          message: `La pagina ${page.number} marca fin de capitulo sin un inicio de capitulo explicito.`
        });
      }
      explicitChapterOpen = false;
      explicitChapterStartPage = null;
    }
  }

  if (openPart && !openPartHasChapter) {
    issues.push({
      type: 'part-without-chapter',
      page: openPart.page,
      pageId: openPart.pageId,
      title: openPart.title,
      message: `La parte iniciada en la pagina ${openPart.page} no contiene ningun capitulo marcado.`
    });
  }

  return issues;
}

function buildPageContexts(pages) {
  return (pages || []).map((page, index) => {
    const editorial = normalizeEditorial(page?.editorial || page);
    return {
      ...page,
      number: pageNumber(page, index),
      text: pageText(page),
      editorial,
      needsOcr: editorial.imageMode !== 'image',
      reviewed: pageReviewed(page)
    };
  });
}

export function buildBookChecklist({ metadata = {}, pages = [], checkedAt = new Date().toISOString() } = {}) {
  const contexts = buildPageContexts(pages);
  const warnings = [];
  const bookLanguage = normalizeLanguage(metadata.language);
  const metadataWarning = projectMetadataWarning(metadata);

  if (metadataWarning) {
    warnings.push(metadataWarning);
  }

  if (normalizeCover(metadata.cover || {}).mode === 'none') {
    warnings.push(
      warning({
        code: 'missing-cover',
        type: 'cover',
        severity: 'medium',
        scope: 'book',
        count: 1,
        target: bookTarget('Portada'),
        message: 'No hay portada configurada.',
        action: 'Elige una pagina como portada o sube una imagen de portada.'
      })
    );
  }

  const missingTextPages = [];
  const staleOcrPages = [];
  const ocrWarningPages = [];
  const lowConfidenceOcrPages = [];
  const unreviewedPages = [];
  const missingOcrLanguagePages = [];
  const mismatchOcrLanguagePages = [];
  const untitledPartSections = [];
  const untitledChapterSections = [];

  for (const page of contexts) {
    const text = page.text.trim();

    if (page.needsOcr && !text) {
      missingTextPages.push(page.number);
    }

    if (page.needsOcr && !page.reviewed && page.status === 'ocr-complete' && page.layoutStale) {
      staleOcrPages.push(page.number);
    }

    if (page.needsOcr && !page.reviewed && page.ocrWarning) {
      ocrWarningPages.push(page.number);
    }

    if (page.needsOcr && !page.reviewed && pageHasLowConfidenceOcr(page)) {
      lowConfidenceOcrPages.push(page.number);
    }

    if (page.needsOcr && !page.reviewed && text) {
      unreviewedPages.push(page.number);
    }

    if (page.needsOcr && !page.reviewed && page.status === 'ocr-complete') {
      const ocrLanguage = normalizeLanguage(page.ocrLanguage);
      if (!ocrLanguage) {
        missingOcrLanguagePages.push(page.number);
      } else if (bookLanguage && ocrLanguage !== bookLanguage) {
        mismatchOcrLanguagePages.push(page.number);
      }
    }

    if (page.editorial.partStart && !page.editorial.partTitle) {
      untitledPartSections.push({
        type: 'part',
        page: page.number,
        pageId: page.id,
        title: ''
      });
    }

    if (page.editorial.chapterStart && !page.editorial.chapterTitle) {
      untitledChapterSections.push({
        type: 'chapter',
        page: page.number,
        pageId: page.id,
        title: ''
      });
    }
  }

  if (missingTextPages.length) {
    warnings.push(
      warning({
        code: 'missing-text',
        type: 'pages-without-ocr',
        severity: 'high',
        scope: 'page',
        pages: missingTextPages,
        target: pageTarget(missingTextPages),
        message: `${pageCountLabel(missingTextPages.length)} no tienen texto OCR ni texto revisado (${pagesMessage(missingTextPages)}).`,
        action: 'Ejecuta OCR, pega texto revisado o marca la pagina como imagen si debe exportarse como captura.'
      })
    );
  }

  if (lowConfidenceOcrPages.length) {
    warnings.push(
      warning({
        code: 'low-confidence-ocr',
        type: 'low-confidence-ocr',
        severity: 'high',
        scope: 'page',
        pages: lowConfidenceOcrPages,
        target: pageTarget(lowConfidenceOcrPages),
        message: `${pageCountLabel(lowConfidenceOcrPages.length)} tienen OCR de baja confianza (${pagesMessage(lowConfidenceOcrPages)}).`,
        action: 'Revisa el texto, relanza OCR con otro modo o corrige manualmente esas paginas.'
      })
    );
  }

  if (unreviewedPages.length) {
    warnings.push(
      warning({
        code: 'unreviewed-pages',
        type: 'unreviewed-pages',
        severity: 'medium',
        scope: 'page',
        pages: unreviewedPages,
        target: pageTarget(unreviewedPages),
        message: `${pageCountLabel(unreviewedPages.length)} tienen texto pendiente de revision manual (${pagesMessage(unreviewedPages)}).`,
        action: 'Abre cada pagina, revisa el texto y marca la casilla Revisada.'
      })
    );
  }

  if (staleOcrPages.length) {
    warnings.push(
      warning({
        code: 'stale-ocr',
        type: 'stale-ocr',
        severity: 'high',
        scope: 'page',
        pages: staleOcrPages,
        target: pageTarget(staleOcrPages),
        message: `${pageCountLabel(staleOcrPages.length)} necesitan volver a leer texto tras cambios de recorte o giro (${pagesMessage(staleOcrPages)}).`,
        action: 'Vuelve a ejecutar OCR en esas paginas o marca el texto como revisado si ya esta corregido.'
      })
    );
  }

  if (ocrWarningPages.length) {
    warnings.push(
      warning({
        code: 'ocr-warning',
        type: 'ocr-warning',
        severity: 'medium',
        scope: 'page',
        pages: ocrWarningPages,
        target: pageTarget(ocrWarningPages),
        message: `${pageCountLabel(ocrWarningPages.length)} tienen avisos de OCR (${pagesMessage(ocrWarningPages)}).`,
        action: 'Lee el aviso de OCR, corrige la captura o valida manualmente el texto.'
      })
    );
  }

  if (missingOcrLanguagePages.length) {
    warnings.push(
      warning({
        code: 'missing-ocr-language',
        type: 'ocr-language',
        severity: 'medium',
        scope: 'page',
        pages: missingOcrLanguagePages,
        target: pageTarget(missingOcrLanguagePages),
        message: `${pageCountLabel(missingOcrLanguagePages.length)} no tienen idioma OCR registrado (${pagesMessage(missingOcrLanguagePages)}).`,
        action: 'Vuelve a ejecutar OCR para registrar el idioma usado o revisa manualmente el texto.'
      })
    );
  }

  if (mismatchOcrLanguagePages.length) {
    warnings.push(
      warning({
        code: 'ocr-language-mismatch',
        type: 'ocr-language',
        severity: 'medium',
        scope: 'page',
        pages: mismatchOcrLanguagePages,
        target: pageTarget(mismatchOcrLanguagePages),
        message: `${pageCountLabel(mismatchOcrLanguagePages.length)} tienen un idioma OCR distinto del idioma del libro (${pagesMessage(mismatchOcrLanguagePages)}).`,
        action: 'Comprueba el idioma del libro o vuelve a ejecutar OCR con el idioma correcto.'
      })
    );
  }

  if (untitledPartSections.length) {
    const pages = untitledPartSections.map((section) => section.page);
    warnings.push(
      warning({
        code: 'untitled-part',
        type: 'section-title',
        severity: 'medium',
        scope: 'section',
        pages,
        sections: untitledPartSections,
        target: sectionTarget(untitledPartSections, 'parts'),
        message: `${untitledPartSections.length} ${untitledPartSections.length === 1 ? 'parte no tiene titulo' : 'partes no tienen titulo'} (${pagesMessage(pages)}).`,
        action: 'Escribe el titulo de la parte o desmarca Inicio de parte.'
      })
    );
  }

  if (untitledChapterSections.length) {
    const pages = untitledChapterSections.map((section) => section.page);
    warnings.push(
      warning({
        code: 'untitled-chapter',
        type: 'section-title',
        severity: 'medium',
        scope: 'section',
        pages,
        sections: untitledChapterSections,
        target: sectionTarget(untitledChapterSections, 'chapters'),
        message: `${untitledChapterSections.length} ${untitledChapterSections.length === 1 ? 'inicio de capitulo no tiene titulo' : 'inicios de capitulo no tienen titulo'} (${pagesMessage(pages)}).`,
        action: 'Escribe el titulo del capitulo o desmarca Inicio de capitulo.'
      })
    );
  }

  const structureIssues = detectStructureIssues(contexts);
  if (structureIssues.length) {
    const pages = structureIssues.map((issue) => issue.page);
    warnings.push(
      warning({
        code: 'incoherent-structure',
        type: 'part-chapter-sequence',
        severity: 'medium',
        scope: 'section',
        pages,
        sections: structureIssues,
        target: sectionTarget(structureIssues),
        message: `${structureIssues.length} ${structureIssues.length === 1 ? 'salto de parte/capitulo parece incoherente' : 'saltos de parte/capitulo parecen incoherentes'} (${pagesMessage(pages)}).`,
        action: 'Revisa los marcadores Inicio de parte, Inicio de capitulo y Fin de capitulo en esas paginas.'
      })
    );
  }

  return {
    ready: warnings.length === 0,
    checkedAt,
    pageCount: contexts.length,
    warningCount: warnings.length,
    warnings,
    summary:
      warnings.length === 0
        ? 'Todo listo para exportar.'
        : `Hay ${warnings.length} ${warnings.length === 1 ? 'aviso' : 'avisos'} antes de exportar.`
  };
}
