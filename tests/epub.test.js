import assert from 'node:assert/strict';
import { test } from 'node:test';

import { buildEpubFiles, createEpubArchive, escapeXml } from '../src/lib/epub.js';

test('escapeXml escapes unsafe XML characters', () => {
  assert.equal(escapeXml('A&B <C> "D"'), 'A&amp;B &lt;C&gt; &quot;D&quot;');
});

test('buildEpubFiles puts the mimetype first', () => {
  const files = buildEpubFiles(
    { id: 'book-1', title: 'Libro', author: 'Autor', language: 'es' },
    [{ id: 'page-0001', text: 'Hola mundo' }]
  );

  assert.equal(files[0].name, 'mimetype');
  assert.equal(files[0].data, 'application/epub+zip');
  assert.ok(files.some((file) => file.name === 'OEBPS/content.opf'));
  assert.ok(files.some((file) => file.name === 'OEBPS/text/indice.xhtml'));
  assert.ok(files.some((file) => file.name === 'OEBPS/text/chapter-0001.xhtml'));
});

test('createEpubArchive creates a zip-like EPUB archive', () => {
  const archive = createEpubArchive(
    { id: 'book-1', title: 'Libro', author: 'Autor', language: 'es' },
    [{ id: 'page-0001', text: 'Hola mundo' }]
  );

  assert.equal(archive.readUInt32LE(0), 0x04034b50);
  assert.ok(archive.includes(Buffer.from('application/epub+zip')));
  assert.ok(archive.includes(Buffer.from('OEBPS/content.opf')));
});

test('buildEpubFiles exports semantic layout blocks', () => {
  const files = buildEpubFiles(
    { id: 'book-1', title: 'Libro', author: 'Autor', language: 'es' },
    [
      {
        id: 'page-0001',
        text: 'Texto plano',
        layout: {
          blocks: [
            { type: 'paragraph', text: 'Primer parrafo', indent: false },
            { type: 'heading', text: 'ESPERA. CORRE.' },
            { type: 'centered', text: 'Linea centrada' }
          ]
        }
      }
    ]
  );

  const page = files.find((file) => file.name === 'OEBPS/text/chapter-0001.xhtml').data;
  assert.match(page, /<p class="no-indent first">Primer parrafo<\/p>/);
  assert.match(page, /<h2>ESPERA\. CORRE\.<\/h2>/);
  assert.match(page, /<p class="centered">Linea centrada<\/p>/);
});

test('buildEpubFiles exports chapters, image pages and a live index', () => {
  const imageData = Buffer.from('fake image data');
  const files = buildEpubFiles(
    { id: 'book-1', title: 'Libro', author: 'Autor', language: 'es' },
    [
      {
        id: 'page-0001',
        number: 1,
        text: 'Arranque',
        imageData,
        imageExtension: 'jpg',
        imageMime: 'image/jpeg',
        editorial: {
          partStart: true,
          partTitle: 'Primera parte',
          chapterStart: true,
          chapterTitle: 'Capitulo uno',
          chapterHeaderMode: 'page'
        }
      },
      {
        id: 'page-0002',
        number: 2,
        text: '',
        imageData,
        imageExtension: 'png',
        imageMime: 'image/png',
        editorial: {
          imageMode: 'image',
          chapterEnd: true
        }
      },
      {
        id: 'page-0003',
        number: 3,
        text: 'Otro texto',
        editorial: {
          chapterStart: true,
          chapterTitle: 'Capitulo dos'
        }
      }
    ]
  );

  const nav = files.find((file) => file.name === 'OEBPS/nav.xhtml').data;
  const index = files.find((file) => file.name === 'OEBPS/text/indice.xhtml').data;
  const firstChapter = files.find((file) => file.name === 'OEBPS/text/chapter-0001.xhtml').data;
  const opf = files.find((file) => file.name === 'OEBPS/content.opf').data;

  assert.match(nav, /Capitulo uno/);
  assert.match(nav, /Primera parte/);
  assert.match(nav, /Capitulo dos/);
  assert.match(index, /href="chapter-0001.xhtml"/);
  assert.match(index, /href="chapter-0001.xhtml#part-page-0001"/);
  assert.match(firstChapter, /class="part-title"/);
  assert.match(firstChapter, /class="chapter-header"/);
  assert.match(firstChapter, /class="image-page"/);
  assert.match(firstChapter, /\.\.\/images\/page-0002\.png/);
  assert.match(opf, /id="toc-page"/);
  assert.ok(files.some((file) => file.name === 'OEBPS/images/page-0001.jpg'));
  assert.ok(files.some((file) => file.name === 'OEBPS/images/page-0002.png'));
});

test('buildEpubFiles includes a cover page and cover image when provided', () => {
  const coverData = Buffer.from('fake cover image');
  const files = buildEpubFiles(
    {
      id: 'book-1',
      title: 'Libro',
      author: 'Autor',
      language: 'es',
      cover: {
        imageData: coverData,
        imageExtension: 'png',
        imageMime: 'image/png'
      }
    },
    [{ id: 'page-0001', text: 'Hola mundo' }]
  );

  const coverPage = files.find((file) => file.name === 'OEBPS/text/cover.xhtml')?.data;
  const opf = files.find((file) => file.name === 'OEBPS/content.opf')?.data;

  assert.ok(files.some((file) => file.name === 'OEBPS/images/cover.png'));
  assert.match(coverPage, /\.\.\/images\/cover\.png/);
  assert.match(opf, /id="cover-image"/);
  assert.match(opf, /properties="cover-image"/);
  assert.match(opf, /meta name="cover" content="cover-image"/);
  assert.match(opf, /id="cover-page"/);
});
