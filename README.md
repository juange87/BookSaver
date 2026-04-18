# BookSaver

BookSaver is a local-first tool for digitizing old physical books into readable
ebooks.

The goal is to let a user capture pages with a high-quality camera, keep the
captures ordered, extract text with OCR, review the result, and export a clean
EPUB that can be used on Kobo or sent to Kindle.

## MVP Goal

The first version should prove the complete book-saving loop:

1. Create a book project with title, author, language, and optional notes.
2. Select a camera source, ideally an iPhone exposed to macOS through
   Continuity Camera.
3. Capture pages one by one and store the original images locally.
4. Show the captured pages in order, with basic delete and reorder actions.
5. Run OCR on captured pages.
6. Let the user review and edit recognized text.
7. Export an EPUB containing the recognized text and basic metadata.

## Product Principles

- Local-first: book images and OCR output should stay on the user's machine by
  default.
- Recoverable: original page captures should be kept so OCR can be rerun later.
- Simple capture flow: taking the next page should be fast and hard to mess up.
- EPUB first: generate a standard EPUB suitable for Kobo and Kindle conversion
  flows.
- Extensible capture: start with web camera capture, but keep room for a native
  macOS or iOS capture path if higher resolution is needed.

## Early Architecture Direction

The initial implementation is expected to be a local web app:

- Frontend: camera preview, capture controls, page review, OCR editor, export UI.
- Local backend: project storage, image persistence, OCR pipeline, EPUB builder.
- Storage: one folder per book project, with images, OCR text, metadata, and
  generated exports.

This keeps the MVP fast to build while still allowing a later native shell
through Electron, Tauri, or a dedicated macOS/iOS companion.

## Current MVP

The repository now contains a dependency-free local web app:

- `src/server.js`: local HTTP server and API.
- `public/`: browser UI for camera capture, page review, OCR, and EPUB export.
- `src/lib/storage.js`: project folders, page image storage, OCR text storage,
  watched inbox imports, OCR text storage, and export orchestration.
- `src/lib/ocr.js`: local OCR adapter using the `tesseract` command when
  available, with Apple Vision as the preferred local OCR engine on macOS.
- `src/lib/layout.js`: rebuilds cleaner reading structure from Tesseract TSV
  coordinates or Apple Vision bounding boxes.
- `src/lib/epub.js`: minimal EPUB3 generator.
- `scripts/vision-ocr.swift`: native Apple Vision helper used for local macOS
  OCR.

Generated book data is stored in `books/`, which is ignored by git.

## Running Locally

Start the app:

```sh
npm start
```

Then open:

```text
http://127.0.0.1:5173
```

Create a book, press **Activar iPhone**, and capture pages. The app first asks
for camera permission, then looks for a camera whose browser label looks like an
iPhone or Continuity Camera device. If the iPhone is not listed:

- Make sure both devices use the same Apple Account.
- Enable Wi-Fi and Bluetooth on both devices.
- Keep the iPhone near the Mac, locked, stable, and with the rear camera facing
  the book.
- Connect it by USB if the wireless option does not appear.
- Confirm that Continuity Camera is enabled in iOS Settings.

The camera selector still allows choosing another camera manually when needed.

If Continuity Camera does not appear in the browser, use **Importar fotos** as a
fallback: take photos with the iPhone Camera app, transfer them to the Mac, and
import them into the current book. JPEG and PNG files are stored directly. Other
image formats are converted to JPEG by the browser when supported.

## iPhone Inbox Folder

For higher quality, use the iPhone camera normally and move the photos to a Mac
folder with AirDrop, Image Capture, Photos export, or iCloud Photos. Then set
that folder in **Bandeja iPhone**.

Every new book gets its own default inbox folder inside the project workspace:
`inbox/<book-id>`. You can use that folder directly, or press **Seleccionar
carpeta** to choose another Mac folder without typing the path manually.

BookSaver can:

- scan the folder on demand with **Revisar carpeta**;
- keep watching it when **Vigilar automaticamente** is enabled;
- import only new files;
- append imported files in chronological order using their file modification
  date;
- convert HEIC/HEIF files to JPEG with macOS `sips`;
- keep the source path and timestamp for duplicate detection.

The selected folder path is still shown in the UI so you can confirm which
folder is being scanned.

## OCR Notes

OCR runs locally. On macOS, BookSaver uses Apple Vision first. If Apple Vision is
not available or fails for a page, it falls back to Tesseract.

Apple Vision runs on the user's Mac and supports accurate recognition with
language correction. It usually works better than Tesseract for photos taken with
an iPhone.

Tesseract and the `tesseract-lang` package are also available on this machine,
including Spanish language data (`spa`).

BookSaver asks OCR engines for positioned output, not only plain text. Tesseract
provides TSV; Apple Vision provides bounding boxes. The app uses those
coordinates to rebuild a cleaner reading structure:

- join lines that belong to the same paragraph;
- keep real paragraph breaks;
- detect short centered lines and headings;
- remove artificial line breaks from the photographed page;
- remove hyphenation caused by line endings;
- export semantic HTML into the EPUB.

If a page text is edited manually, BookSaver keeps that edited text and marks the
automatic layout as stale. Export then falls back to paragraph-based formatting
for that page.

## EPUB Structure

Each captured page has an **Estructura EPUB** section in the editor. From there,
BookSaver can:

- mark a page as the beginning of a part and add that part to the EPUB index;
- mark a page as image-only so the original capture is embedded in the EPUB;
- mark chapter starts and optional chapter ends;
- name chapters;
- use the chapter start capture as a header image;
- try to auto-crop a chapter header from the top of the capture when OCR layout
  data is available;
- keep an auto-updated visible chapter index inside the EPUB;
- write EPUB navigation metadata through `nav.xhtml` for reader table-of-contents
  support.

If no explicit end is marked, a chapter ends right before the next chapter start.
Pages before the first named chapter are exported under an automatic **Inicio**
section so no capture is lost.

Each page can also store a non-destructive crop rectangle. The original capture
is kept, but the crop is used when rerunning OCR and when exporting image pages
to the EPUB. This helps remove desk edges, neighboring pages, or stray words
outside the book area.

To force Tesseract instead of Apple Vision for debugging:

```sh
BOOKSAVER_OCR_ENGINE=tesseract npm start
```

## Legal Note

BookSaver is intended for personal preservation of books the user owns, public
domain works, or content the user has permission to digitize. It should not be
used to distribute copyrighted material without authorization.
