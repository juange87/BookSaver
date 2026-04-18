import { Buffer } from 'node:buffer';

import { textToBlocks } from './layout.js';

const XHTML_NS = 'http://www.w3.org/1999/xhtml';
const EPUB_NS = 'http://www.idpf.org/2007/ops';

const CRC_TABLE = new Uint32Array(256);

for (let i = 0; i < 256; i += 1) {
  let value = i;
  for (let bit = 0; bit < 8; bit += 1) {
    value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  }
  CRC_TABLE[i] = value >>> 0;
}

function crc32(buffer) {
  let value = 0xffffffff;
  for (const byte of buffer) {
    value = CRC_TABLE[(value ^ byte) & 0xff] ^ (value >>> 8);
  }
  return (value ^ 0xffffffff) >>> 0;
}

function dosDateTime(date = new Date()) {
  const year = Math.max(date.getFullYear(), 1980);
  const dosTime =
    (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2);
  const dosDate = ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
  return { dosTime, dosDate };
}

function writeUInt16(value) {
  const buffer = Buffer.alloc(2);
  buffer.writeUInt16LE(value);
  return buffer;
}

function writeUInt32(value) {
  const buffer = Buffer.alloc(4);
  buffer.writeUInt32LE(value >>> 0);
  return buffer;
}

export function createStoreZip(files) {
  const localChunks = [];
  const centralChunks = [];
  let offset = 0;
  const { dosTime, dosDate } = dosDateTime();

  for (const file of files) {
    const name = Buffer.from(file.name, 'utf8');
    const data = Buffer.isBuffer(file.data) ? file.data : Buffer.from(file.data, 'utf8');
    const checksum = crc32(data);

    const localHeader = Buffer.concat([
      writeUInt32(0x04034b50),
      writeUInt16(20),
      writeUInt16(0),
      writeUInt16(0),
      writeUInt16(dosTime),
      writeUInt16(dosDate),
      writeUInt32(checksum),
      writeUInt32(data.length),
      writeUInt32(data.length),
      writeUInt16(name.length),
      writeUInt16(0),
      name
    ]);

    localChunks.push(localHeader, data);

    const centralHeader = Buffer.concat([
      writeUInt32(0x02014b50),
      writeUInt16(20),
      writeUInt16(20),
      writeUInt16(0),
      writeUInt16(0),
      writeUInt16(dosTime),
      writeUInt16(dosDate),
      writeUInt32(checksum),
      writeUInt32(data.length),
      writeUInt32(data.length),
      writeUInt16(name.length),
      writeUInt16(0),
      writeUInt16(0),
      writeUInt16(0),
      writeUInt16(0),
      writeUInt32(0),
      writeUInt32(offset),
      name
    ]);

    centralChunks.push(centralHeader);
    offset += localHeader.length + data.length;
  }

  const centralDirectory = Buffer.concat(centralChunks);
  const endOfCentralDirectory = Buffer.concat([
    writeUInt32(0x06054b50),
    writeUInt16(0),
    writeUInt16(0),
    writeUInt16(files.length),
    writeUInt16(files.length),
    writeUInt32(centralDirectory.length),
    writeUInt32(offset),
    writeUInt16(0)
  ]);

  return Buffer.concat([...localChunks, centralDirectory, endOfCentralDirectory]);
}

export function escapeXml(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function htmlFromBlock(block, index) {
  const text = escapeXml(block.text);
  const firstClass = index === 0 ? ' first' : '';

  if (block.type === 'heading') {
    return `<h2>${text}</h2>`;
  }

  if (block.type === 'centered') {
    return `<p class="centered${firstClass}">${text}</p>`;
  }

  const indentClass = block.indent === false || index === 0 ? ' no-indent' : '';
  const className = `${indentClass}${firstClass}`.trim();
  return className ? `<p class="${className}">${text}</p>` : `<p>${text}</p>`;
}

function imageAlt(page, label = 'Pagina') {
  return `${label} ${page.number || page.id}`;
}

function fullImageAsset(page) {
  if (!page.imageData) {
    return null;
  }

  const extension = page.imageExtension === 'png' ? 'png' : 'jpg';
  return {
    id: `image-${page.id}`,
    href: `images/${page.id}.${extension}`,
    textHref: `../images/${page.id}.${extension}`,
    mediaType: extension === 'png' ? 'image/png' : 'image/jpeg',
    data: page.imageData
  };
}

function headerImageAsset(page) {
  if (!page.imageData) {
    return null;
  }

  if (page.editorial.chapterHeaderMode === 'auto' && page.headerImage?.data) {
    const extension = page.headerImage.extension === 'png' ? 'png' : 'jpg';
    return {
      id: `header-${page.id}`,
      href: `images/${page.id}-chapter-header.${extension}`,
      textHref: `../images/${page.id}-chapter-header.${extension}`,
      mediaType: extension === 'png' ? 'image/png' : 'image/jpeg',
      data: page.headerImage.data
    };
  }

  if (page.editorial.chapterHeaderMode === 'auto' || page.editorial.chapterHeaderMode === 'page') {
    return fullImageAsset(page);
  }

  return null;
}

function normalizeEpubPage(page, index) {
  const editorial = {
    imageMode: page.editorial?.imageMode === 'image' ? 'image' : 'text',
    partStart: Boolean(page.editorial?.partStart),
    partTitle: String(page.editorial?.partTitle || '').trim(),
    chapterStart: Boolean(page.editorial?.chapterStart),
    chapterEnd: Boolean(page.editorial?.chapterEnd),
    chapterTitle: String(page.editorial?.chapterTitle || '').trim(),
    chapterHeaderMode: ['auto', 'page'].includes(page.editorial?.chapterHeaderMode)
      ? page.editorial.chapterHeaderMode
      : 'none'
  };

  return {
    ...page,
    id: page.id || `page-${String(index + 1).padStart(4, '0')}`,
    number: page.number || index + 1,
    text: page.text || '',
    editorial
  };
}

function prepareImageAssets(pages) {
  const assets = new Map();

  for (const page of pages) {
    const pageImage = fullImageAsset(page);
    const chapterHeader = headerImageAsset(page);

    if (page.editorial.imageMode === 'image' && pageImage) {
      page.imageAsset = pageImage;
      assets.set(pageImage.href, pageImage);
    }

    if (page.editorial.chapterStart && chapterHeader) {
      page.headerImageAsset = chapterHeader;
      assets.set(chapterHeader.href, chapterHeader);
    }
  }

  return [...assets.values()];
}

function htmlFromTextPage(page, firstBlockOffset = 0) {
  const blocks = page.layout?.blocks?.length ? page.layout.blocks : textToBlocks(page.text);

  if (!blocks.length) {
    return ['<p class="empty-page">[Pagina sin texto revisado]</p>'];
  }

  return blocks.map((block, index) => htmlFromBlock(block, index + firstBlockOffset));
}

function htmlFromPage(page, options = {}) {
  const pageBreak = `<span id="${escapeXml(page.id)}" epub:type="pagebreak" title="${escapeXml(String(page.number || ''))}"></span>`;

  if (page.editorial.imageMode === 'image') {
    if (!page.imageAsset) {
      return [
        pageBreak,
        '<p class="empty-page">[Pagina marcada como imagen, pero no se encontro la captura]</p>'
      ];
    }

    return [
      pageBreak,
      `<figure class="image-page"><img src="${escapeXml(page.imageAsset.textHref)}" alt="${escapeXml(imageAlt(page))}" /></figure>`
    ];
  }

  return [pageBreak, ...htmlFromTextPage(page, options.firstText ? 0 : 1)];
}

function chapterTitleFor(page, chapterNumber, sectionNumber) {
  if (page?.editorial?.chapterStart) {
    return page.editorial.chapterTitle || `Capitulo ${chapterNumber}`;
  }

  return sectionNumber === 1 ? 'Inicio' : `Seccion ${sectionNumber}`;
}

function partTitleFor(page, partNumber) {
  return page?.editorial?.partTitle || `Parte ${partNumber}`;
}

function buildChapters(metadata, pages) {
  if (pages.length === 0) {
    return [
      {
        id: 'chapter-0001',
        title: metadata.title || 'Sin paginas',
        pages: [],
        empty: true
      }
    ];
  }

  const chapters = [];
  let current = null;
  let partNumber = 0;
  let chapterNumber = 0;

  function startChapter(page) {
    if (page.editorial.chapterStart) {
      chapterNumber += 1;
    }

    const sectionNumber = chapters.length + 1;
    current = {
      id: `chapter-${String(sectionNumber).padStart(4, '0')}`,
      title: chapterTitleFor(page, chapterNumber || sectionNumber, sectionNumber),
      pages: []
    };
    chapters.push(current);
  }

  for (const page of pages) {
    if (page.editorial.partStart) {
      partNumber += 1;
      page.editorial = {
        ...page.editorial,
        partTitle: partTitleFor(page, partNumber)
      };
    }

    if (!current || (page.editorial.chapterStart && current.pages.length > 0)) {
      startChapter(page);
    }

    current.pages.push(page);

    if (page.editorial.chapterEnd) {
      current = null;
    }
  }

  return chapters;
}

function chapterXhtml(metadata, chapter) {
  const body = [];

  if (chapter.empty) {
    body.push('<p class="empty-page">[Libro sin paginas]</p>');
  }

  let hasTextContent = false;

  for (const [index, page] of chapter.pages.entries()) {
    if (page.editorial.partStart) {
      body.push(
        `<h2 class="part-title" id="part-${escapeXml(page.id)}">${escapeXml(page.editorial.partTitle || 'Parte')}</h2>`
      );
    }

    if (index === 0 && page.editorial.chapterStart && page.headerImageAsset) {
      body.push(
        `<figure class="chapter-header"><img src="${escapeXml(page.headerImageAsset.textHref)}" alt="${escapeXml(imageAlt(page, 'Cabecera'))}" /></figure>`
      );
    }

    body.push(`<section class="source-page" id="source-${escapeXml(page.id)}">`);
    body.push(...htmlFromPage(page, { firstText: !hasTextContent }));
    body.push('</section>');

    if (page.editorial.imageMode !== 'image') {
      hasTextContent = true;
    }
  }

  return `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="${XHTML_NS}" xmlns:epub="${EPUB_NS}" xml:lang="${escapeXml(metadata.language)}" lang="${escapeXml(metadata.language)}">
  <head>
    <title>${escapeXml(chapter.title)}</title>
    <link rel="stylesheet" type="text/css" href="../styles.css" />
  </head>
  <body>
    <section epub:type="bodymatter chapter">
      <h1>${escapeXml(chapter.title)}</h1>
      ${body.join('\n      ')}
    </section>
  </body>
</html>`;
}

function buildNavigationItems(chapters) {
  const items = [];
  let partNumber = 0;

  for (const chapter of chapters) {
    if (chapter.empty) {
      items.push({
        type: 'chapter',
        title: chapter.title,
        href: `text/${chapter.id}.xhtml`
      });
      continue;
    }

    let chapterAdded = false;

    for (const page of chapter.pages) {
      if (page.editorial.partStart) {
        partNumber += 1;
        items.push({
          type: 'part',
          title: partTitleFor(page, partNumber),
          href: `text/${chapter.id}.xhtml#part-${page.id}`
        });
      }

      if (!chapterAdded) {
        items.push({
          type: 'chapter',
          title: chapter.title,
          href: `text/${chapter.id}.xhtml`
        });
        chapterAdded = true;
      }
    }
  }

  return items;
}

function navigationLinks(items, inTextFolder = false) {
  return items
    .map((item) => {
      const href = inTextFolder ? item.href.replace(/^text\//, '') : item.href;
      return `<li class="${item.type}-item"><a href="${href}">${escapeXml(item.title)}</a></li>`;
    })
    .join('\n        ');
}

function navXhtml(metadata, items) {
  const links = navigationLinks(items);

  return `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="${XHTML_NS}" xmlns:epub="${EPUB_NS}" xml:lang="${escapeXml(metadata.language)}" lang="${escapeXml(metadata.language)}">
  <head>
    <title>${escapeXml(metadata.title)} - Indice</title>
  </head>
  <body>
    <nav epub:type="toc" id="toc">
      <h1>Indice</h1>
      <ol>
        ${links}
      </ol>
    </nav>
  </body>
</html>`;
}

function tocPageXhtml(metadata, items) {
  return `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="${XHTML_NS}" xmlns:epub="${EPUB_NS}" xml:lang="${escapeXml(metadata.language)}" lang="${escapeXml(metadata.language)}">
  <head>
    <title>${escapeXml(metadata.title)} - Indice</title>
    <link rel="stylesheet" type="text/css" href="../styles.css" />
  </head>
  <body>
    <section epub:type="frontmatter toc">
      <h1>Indice</h1>
      <ol class="chapter-index">
        ${navigationLinks(items, true)}
      </ol>
    </section>
  </body>
</html>`;
}

function contentOpf(metadata, chapters, imageAssets, modified) {
  const manifestChapters = chapters
    .map(
      (chapter) =>
        `<item id="${chapter.id}" href="text/${chapter.id}.xhtml" media-type="application/xhtml+xml" />`
    )
    .join('\n    ');
  const manifestImages = imageAssets
    .map(
      (asset) =>
        `<item id="${asset.id}" href="${asset.href}" media-type="${asset.mediaType}" />`
    )
    .join('\n    ');
  const spineChapters = chapters.map((chapter) => `<itemref idref="${chapter.id}" />`).join('\n    ');

  return `<?xml version="1.0" encoding="utf-8"?>
<package xmlns="http://www.idpf.org/2007/opf" unique-identifier="book-id" version="3.0" xml:lang="${escapeXml(metadata.language)}">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="book-id">${escapeXml(metadata.id)}</dc:identifier>
    <dc:title>${escapeXml(metadata.title)}</dc:title>
    <dc:creator>${escapeXml(metadata.author || 'Autor desconocido')}</dc:creator>
    <dc:language>${escapeXml(metadata.language)}</dc:language>
    <meta property="dcterms:modified">${modified}</meta>
  </metadata>
  <manifest>
    <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav" />
    <item id="style" href="styles.css" media-type="text/css" />
    <item id="toc-page" href="text/indice.xhtml" media-type="application/xhtml+xml" />
    ${manifestChapters}
    ${manifestImages}
  </manifest>
  <spine>
    <itemref idref="toc-page" />
    ${spineChapters}
  </spine>
</package>`;
}

export function buildEpubFiles(metadata, pages) {
  const modified = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
  const sortedPages = pages.map(normalizeEpubPage);
  const imageAssets = prepareImageAssets(sortedPages);
  const chapters = buildChapters(metadata, sortedPages);
  const navigationItems = buildNavigationItems(chapters);

  return [
    {
      name: 'mimetype',
      data: 'application/epub+zip'
    },
    {
      name: 'META-INF/container.xml',
      data: `<?xml version="1.0" encoding="utf-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml" />
  </rootfiles>
</container>`
    },
    {
      name: 'OEBPS/styles.css',
      data: `body {
  font-family: serif;
  line-height: 1.45;
  margin: 1.2em;
}

h1 {
  font-size: 1.2em;
  margin-bottom: 1em;
  text-align: center;
}

p {
  margin: 0 0 0.8em;
  text-indent: 1em;
}

p.no-indent,
p.centered {
  text-indent: 0;
}

p.centered {
  text-align: center;
  margin: 1em 0;
}

p.first::first-letter {
  font-size: 1.8em;
  line-height: 0.9;
}

h2 {
  font-size: 1em;
  font-weight: 700;
  margin: 1em 0;
  text-align: center;
}

.part-title {
  break-before: page;
  font-size: 1.15em;
  margin: 1.2em 0;
  text-align: center;
  text-transform: uppercase;
}

.empty-page {
  color: #666;
  font-style: italic;
  text-indent: 0;
}

.chapter-index {
  line-height: 1.6;
}

.chapter-index .part-item {
  margin-top: 0.8em;
  font-weight: 700;
}

.chapter-index .chapter-item {
  margin-left: 1em;
}

.chapter-header {
  margin: 0 0 1.2em;
  text-align: center;
}

.chapter-header img {
  display: block;
  max-width: 100%;
  max-height: 35vh;
  margin: 0 auto;
  object-fit: contain;
}

.image-page {
  break-before: page;
  margin: 0;
  text-align: center;
}

.image-page img {
  display: block;
  max-width: 100%;
  max-height: 95vh;
  margin: 0 auto;
  object-fit: contain;
}

.source-page + .source-page {
  margin-top: 1em;
}`
    },
    {
      name: 'OEBPS/nav.xhtml',
      data: navXhtml(metadata, navigationItems)
    },
    {
      name: 'OEBPS/content.opf',
      data: contentOpf(metadata, chapters, imageAssets, modified)
    },
    {
      name: 'OEBPS/text/indice.xhtml',
      data: tocPageXhtml(metadata, navigationItems)
    },
    ...chapters.map((chapter) => ({
      name: `OEBPS/text/${chapter.id}.xhtml`,
      data: chapterXhtml(metadata, chapter)
    })),
    ...imageAssets.map((asset) => ({
      name: `OEBPS/${asset.href}`,
      data: asset.data
    }))
  ];
}

export function createEpubArchive(metadata, pages) {
  return createStoreZip(buildEpubFiles(metadata, pages));
}
