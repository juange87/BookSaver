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

BookSaver es una herramienta local para rescatar libros fisicos y convertirlos
en EPUB revisables. La app permite capturar paginas, importar fotos tomadas con
el iPhone, ejecutar OCR, corregir el texto y exportar un ebook con estructura de
partes y capitulos.

## Vista rapida

| Captura | OCR | Estructura | Exportacion |
| --- | --- | --- | --- |
| Camara del Mac o fotos del iPhone | Apple Vision y Tesseract | Partes, capitulos, imagenes y recortes | EPUB3 con indice navegable |

## Estado

Este repositorio cierra un MVP funcional. El flujo completo que ya existe es:

1. crear un libro;
2. capturar paginas desde camara o importar fotos;
3. vigilar una carpeta de entrada para nuevas fotos del iPhone;
4. ejecutar OCR local;
5. revisar texto y recortar paginas;
6. marcar paginas como imagen, inicio de parte o inicio/fin de capitulo;
7. exportar un EPUB con indice navegable.

## Principios del proyecto

- Local-first: las imagenes, el OCR y los EPUB se quedan en tu maquina.
- No destructivo: se conserva la captura original de cada pagina.
- Portable: el proyecto debe funcionar aunque otra persona clone el repo en una
  ruta distinta de su ordenador.
- EPUB primero: la salida esta pensada para Kindle, Kobo y lectores compatibles.

## Que incluye el MVP

- Captura desde navegador con cualquier camara disponible en macOS.
- Soporte practico para iPhone mediante dos caminos:
  - Continuity Camera cuando el navegador la expone.
  - importacion de fotos reales desde una carpeta del Mac.
- Bandeja iPhone con carpeta configurable y revision manual de nuevo contenido.
- OCR local con Apple Vision en macOS y fallback a Tesseract.
- Reconstruccion basica de layout para mejorar parrafos, encabezados y saltos.
- Estructura editorial por pagina:
  - pagina como imagen;
  - inicio de parte y nombre de parte;
  - inicio de capitulo, nombre y fin de capitulo;
  - cabecera de capitulo desde la propia captura.
- Recorte no destructivo por pagina para limpiar bordes y texto ajeno.
- Exportacion EPUB3 con `nav.xhtml` e indice visible.

## Estructura del repositorio

- `public/`: interfaz web local.
- `src/server.js`: servidor HTTP local y API.
- `src/lib/storage.js`: persistencia de libros, paginas, inbox y exportacion.
- `src/lib/ocr.js`: adaptador OCR local.
- `src/lib/layout.js`: reconstruccion de bloques de lectura.
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

Abre despues:

```text
http://127.0.0.1:5173
```

## Flujo recomendado con iPhone

La mejor calidad suele venir de hacer fotos reales con la app Camara del
iPhone, pasarlas al Mac y dejar que BookSaver las importe desde una carpeta.

Flujo sugerido:

1. crea un libro;
2. abre la seccion **Bandeja iPhone**;
3. usa la carpeta por defecto o pulsa **Seleccionar carpeta**;
4. envia fotos a esa carpeta con AirDrop, Captura de Imagen, Fotos o iCloud;
5. pulsa **Revisar carpeta** para importar lo nuevo;
6. revisa texto, estructura y recortes;
7. exporta el EPUB.

## OCR y formato

BookSaver intenta usar OCR con posicionamiento, no solo texto plano. Con eso
reconstruye una lectura mas limpia:

- une lineas del mismo parrafo;
- conserva separaciones reales entre parrafos;
- detecta textos centrados y algunos encabezados;
- elimina cortes de linea artificiales;
- suaviza particiones por guion al final de linea.

Si editas el texto manualmente, la exportacion usa ese texto revisado como
fuente principal para esa pagina.

## Estructura EPUB

Cada pagina puede aportar metadatos editoriales:

- **Pagina como imagen**: incrusta la captura en el EPUB.
- **Inicio de parte**: crea una entrada de parte en el indice.
- **Inicio de capitulo**: crea una entrada de capitulo en el indice.
- **Cabecera de capitulo**: usa la captura completa o una cabecera extraida.
- **Fin de capitulo**: cierra el bloque actual antes del siguiente contenido.

El indice del EPUB se actualiza a partir de esas marcas.

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

- almacenamiento de proyectos y paginas;
- importacion cronologica desde bandeja;
- persistencia de estructura editorial y recortes;
- generacion EPUB;
- reconstruccion basica del layout OCR.
- autosave y recarga estable de metadatos editoriales.

## Limitaciones conocidas del MVP

- No hay shell nativo macOS; la app corre como web local.
- El OCR puede necesitar revision manual en paginas complejas o deterioradas.
- El recorte es rectangular y manual.
- El flujo de Continuity Camera depende de que el navegador exponga el iPhone
  como dispositivo de video.

## Nota legal

BookSaver esta pensado para preservacion personal de libros propios, obras de
dominio publico o material que tengas permiso para digitalizar. No debe usarse
para distribuir contenido protegido sin autorizacion.
