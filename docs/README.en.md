# BookSaver

<p align="center">
  <img src="assets/booksaver-header.png" alt="BookSaver banner" width="100%" />
</p>

<p align="center">
  <a href="../README.md">README en castellano</a>
</p>

<p align="center">
  <img alt="MVP status" src="https://img.shields.io/badge/status-MVP-1f8a63">
  <img alt="Local first" src="https://img.shields.io/badge/local--first-no%20cloud-157a8a">
  <img alt="Local OCR" src="https://img.shields.io/badge/OCR-Apple%20Vision%20%2B%20Tesseract-d97745">
  <img alt="Output" src="https://img.shields.io/badge/output-EPUB3-162122">
</p>

BookSaver is a local-first tool for rescuing physical books and turning them
into reviewable EPUB files. It helps capture pages, import iPhone photos, run
OCR, clean the text, and export an ebook with parts and chapters.

## At a glance

| Capture | OCR | Structure | Export |
| --- | --- | --- | --- |
| Mac camera or imported iPhone photos | Apple Vision and Tesseract | Parts, chapters, image pages, and crops | EPUB3 with navigable index |

## Status

This repository currently represents a functional MVP. The implemented flow is:

1. create a book project;
2. capture pages or import existing photos;
3. watch an inbox folder for new iPhone images;
4. run local OCR;
5. review text and crop pages;
6. mark pages as images, part starts, or chapter starts/ends;
7. export an EPUB with a live table of contents.

## Project principles

- Local-first: images, OCR output, and EPUBs stay on the user's machine.
- Non-destructive: original captures are preserved.
- Portable: the repo should work when cloned into a different path on another
  computer.
- EPUB first: output is aimed at Kindle, Kobo, and compatible readers.

## MVP features

- Browser-based page capture from any camera exposed by macOS.
- Practical iPhone support through two paths:
  - Continuity Camera when the browser exposes it.
  - importing real photos from a Mac folder.
- iPhone inbox with configurable folder and manual refresh.
- Local OCR using Apple Vision on macOS with Tesseract fallback.
- Basic layout reconstruction for paragraphs, headings, and line breaks.
- Per-page editorial structure:
  - image-only page;
  - part start and part title;
  - chapter start, chapter title, and chapter end;
  - chapter header image from the page capture.
- Non-destructive per-page crop.
- EPUB3 export with `nav.xhtml` and a visible index page.

## Repository layout

- `public/`: local web UI.
- `src/server.js`: local HTTP server and API.
- `src/lib/storage.js`: projects, pages, inbox imports, and export orchestration.
- `src/lib/ocr.js`: local OCR adapter.
- `src/lib/layout.js`: reading-layout reconstruction.
- `src/lib/epub.js`: EPUB generator.
- `scripts/vision-ocr.swift`: native Apple Vision OCR helper.
- `tests/`: automated MVP tests.

## Requirements

- Node.js 22 or newer.
- macOS for Apple Vision and the native folder picker.
- Tesseract is optional and works as a fallback OCR engine.

## Run locally

```sh
npm start
```

Then open:

```text
http://127.0.0.1:5173
```

## Recommended iPhone workflow

The best quality usually comes from taking real photos with the iPhone Camera
app, moving them to the Mac, and letting BookSaver import them from a folder.

Suggested workflow:

1. create a book;
2. open the **Bandeja iPhone** section;
3. use the default folder or click **Seleccionar carpeta**;
4. send photos into that folder with AirDrop, Image Capture, Photos, or iCloud;
5. click **Revisar carpeta** to import new files;
6. review text, structure, and crops;
7. export the EPUB.

## OCR and formatting

BookSaver prefers OCR output with positional data, not just plain text. That
allows it to rebuild a cleaner reading structure:

- merge lines belonging to the same paragraph;
- keep real paragraph breaks;
- detect centered text and some headings;
- remove artificial line breaks;
- soften line-ending hyphenation artifacts.

If the user edits the text manually, export falls back to that reviewed text for
the affected page.

## Local data and git

Real user data must not be pushed to the repository. This project already keeps
these paths ignored by git:

- `books/`
- `inbox/`
- `.DS_Store`
- `*.log`

That covers in-progress books, imported captures, OCR output, and generated EPUB
files stored in the local workspace.

## Tests

Run the suite with:

```sh
npm test
```

Current tests cover storage, chronological inbox import, persistence of
editorial metadata and crops, EPUB generation, and basic OCR layout
reconstruction.

## Known MVP limits

- There is no native macOS shell yet; the app runs as a local web app.
- OCR still needs manual review on difficult or damaged pages.
- Cropping is rectangular and manual.
- Continuity Camera only works when the browser exposes the iPhone as a video
  device.

## Legal note

BookSaver is intended for personal preservation of books you own, public-domain
works, or material you are allowed to digitize. It should not be used to
distribute copyrighted content without authorization.
