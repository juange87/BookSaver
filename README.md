# BookSaver

<p align="center">
  <img src="docs/assets/booksaver-header.png" alt="BookSaver banner" width="100%" />
</p>

<p align="center">
  <a href="docs/README.en.md">English README</a>
</p>

<p align="center">
  <img alt="Estado MVP" src="https://img.shields.io/badge/estado-MVP-1f8a63">
  <img alt="Local first" src="https://img.shields.io/badge/local--first-sin%20nube-157a8a">
  <img alt="OCR local" src="https://img.shields.io/badge/OCR-Apple%20Vision%20%2B%20Tesseract-d97745">
  <img alt="Salida" src="https://img.shields.io/badge/salida-EPUB3-162122">
</p>

BookSaver es una herramienta local para rescatar libros físicos y convertirlos
en EPUB revisables. La app permite capturar páginas, importar fotos tomadas con
el iPhone, ejecutar OCR, corregir el texto y exportar un ebook con estructura de
partes y capítulos.

## Vista rápida

| Captura | OCR | Estructura | Exportación |
| --- | --- | --- | --- |
| Cámara del Mac o fotos del iPhone | Apple Vision y Tesseract | Partes, capítulos, imágenes y recortes | EPUB3 con índice navegable |

## Estado

Este repositorio cierra un MVP funcional. El flujo completo que ya existe es:

1. Crear un libro.
2. Capturar páginas desde cámara o importar fotos.
3. Vigilar una carpeta de entrada para nuevas fotos del iPhone.
4. Ejecutar OCR local.
5. Revisar texto y recortar páginas.
6. Marcar páginas como imagen, inicio de parte o inicio/fin de capítulo.
7. Exportar un EPUB con índice navegable.

## Principios del proyecto

- Local-first: las imágenes, el OCR y los EPUB se quedan en tu máquina.
- No destructivo: se conserva la captura original de cada página.
- Portable: el proyecto debe funcionar aunque otra persona clone el repo en una
  ruta distinta de su ordenador.
- EPUB primero: la salida está pensada para Kindle, Kobo y lectores compatibles.

## Qué incluye el MVP

- Captura desde navegador con cualquier cámara disponible en macOS.
- Soporte práctico para iPhone mediante dos caminos:
  - Continuity Camera cuando el navegador la expone.
  - Importación de fotos reales desde una carpeta del Mac.
- Bandeja iPhone con carpeta configurable y revisión manual de nuevo contenido.
- OCR local con Apple Vision en macOS y fallback a Tesseract.
- Reconstrucción básica de layout para mejorar párrafos, encabezados y saltos.
- Estructura editorial por página:
  - Página como imagen.
  - Inicio de parte y nombre de parte.
  - Inicio de capítulo, nombre y fin de capítulo.
  - Cabecera de capítulo desde la propia captura.
- Recorte no destructivo por página para limpiar bordes y texto ajeno.
- Exportación EPUB3 con `nav.xhtml` e índice visible.

## Estructura del repositorio

- `public/`: interfaz web local.
- `src/server.js`: servidor HTTP local y API.
- `src/lib/storage.js`: persistencia de libros, páginas, inbox y exportación.
- `src/lib/ocr.js`: adaptador OCR local.
- `src/lib/layout.js`: reconstrucción de bloques de lectura.
- `src/lib/epub.js`: generador EPUB.
- `scripts/vision-ocr.swift`: OCR nativo con Apple Vision.
- `tests/`: pruebas automatizadas del MVP.

## Requisitos

- Node.js 22 o superior.
- macOS para usar Apple Vision y el selector nativo de carpetas.
- Tesseract es opcional, pero sirve como motor OCR alternativo.

## Arranque local

```sh
npm start
```

Abre después:

```text
http://127.0.0.1:5173
```

## Flujo recomendado con iPhone

La mejor calidad suele venir de hacer fotos reales con la app Cámara del
iPhone, pasarlas al Mac y dejar que BookSaver las importe desde una carpeta.

Flujo sugerido:

1. Crea un libro.
2. Abre la sección **Bandeja iPhone**.
3. Usa la carpeta por defecto o pulsa **Seleccionar carpeta**.
4. Envía fotos a esa carpeta con AirDrop, Captura de Imagen, Fotos o iCloud.
5. Pulsa **Revisar carpeta** para importar lo nuevo.
6. Revisa texto, estructura y recortes.
7. Exporta el EPUB.

## OCR y formato

BookSaver intenta usar OCR con posicionamiento, no solo texto plano. Con eso
reconstruye una lectura más limpia:

- Une líneas del mismo párrafo.
- Conserva separaciones reales entre párrafos.
- Detecta textos centrados y algunos encabezados.
- Elimina cortes de línea artificiales.
- Suaviza particiones por guion al final de línea.

Si editas el texto manualmente, la exportación usa ese texto revisado como
fuente principal para esa página.

## Estructura EPUB

Cada página puede aportar metadatos editoriales:

- **Página como imagen**: incrusta la captura en el EPUB.
- **Inicio de parte**: crea una entrada de parte en el índice.
- **Inicio de capítulo**: crea una entrada de capítulo en el índice.
- **Cabecera de capítulo**: usa la captura completa o una cabecera extraída.
- **Fin de capítulo**: cierra el bloque actual antes del siguiente contenido.

El índice del EPUB se actualiza a partir de esas marcas.

## Datos locales y git

Los datos reales del usuario no deben subirse al repositorio. Este proyecto ya
ignora por git:

- `books/`
- `inbox/`
- `.DS_Store`
- `*.log`

Eso incluye libros en proceso, capturas, OCR generado y EPUB exportados dentro
del workspace local.

## Tests

Ejecuta la suite con:

```sh
npm test
```

Las pruebas actuales cubren:

- Almacenamiento de proyectos y páginas.
- Importación cronológica desde bandeja.
- Persistencia de estructura editorial y recortes.
- Generación de EPUB.
- Reconstrucción básica del layout OCR.
- Guardado automático y recarga estable de metadatos editoriales.

## Limitaciones conocidas del MVP

- No hay shell nativo macOS; la app corre como web local.
- El OCR puede necesitar revisión manual en páginas complejas o deterioradas.
- El recorte es rectangular y manual.
- El flujo de Continuity Camera depende de que el navegador exponga el iPhone
  como dispositivo de vídeo.

## Nota legal

BookSaver está pensado para preservación personal de libros propios, obras de
dominio público o material que tengas permiso para digitalizar. No debe usarse
para distribuir contenido protegido sin autorización.
