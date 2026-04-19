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
en EPUB revisables. La app permite capturar páginas, importar fotos, ejecutar
OCR, corregir el texto y exportar un ebook con estructura de partes y capítulos.

Todo el flujo está pensado para funcionar en local: imágenes, OCR y EPUB se
quedan en tu ordenador.

## Índice

- [Vista rápida](#vista-rápida)
- [Estado del proyecto](#estado-del-proyecto)
- [Compatibilidad actual](#compatibilidad-actual)
- [Principios del proyecto](#principios-del-proyecto)
- [Qué incluye el MVP](#qué-incluye-el-mvp)
- [Instalación para personas no técnicas](#instalacion-personas-no-tecnicas)
- [Flujo recomendado con fotos del móvil](#flujo-recomendado-con-fotos-del-móvil)
- [Arranque local para desarrollo](#arranque-local-para-desarrollo)
- [OCR y formato](#ocr-y-formato)
- [Estructura EPUB](#estructura-epub)
- [Estructura del repositorio](#estructura-del-repositorio)
- [Tests](#tests)
- [Reportar errores](#reportar-errores)
- [Limitaciones conocidas del MVP](#limitaciones-conocidas-del-mvp)
- [Nota legal](#nota-legal)
- [Apoyar el proyecto](#apoyar-el-proyecto)

## Vista rápida

| Captura | OCR | Estructura | Exportación |
| --- | --- | --- | --- |
| Cámara del navegador o fotos importadas | Apple Vision en macOS, Tesseract en otros sistemas | Partes, capítulos, imágenes, recortes y portada | EPUB3 con índice navegable |

## Estado del proyecto

Este repositorio ya cubre un MVP funcional:

1. Crear un libro.
2. Capturar páginas o importar fotos.
3. Vigilar una carpeta de entrada para nuevas fotos.
4. Ejecutar OCR local.
5. Revisar texto y recortes.
6. Marcar capítulos, partes, imágenes y portada.
7. Exportar un EPUB con índice navegable.

## Compatibilidad actual

### macOS

- Es la plataforma más completa ahora mismo.
- Puede usar Apple Vision sin instalar nada extra para OCR.
- El selector nativo de carpetas está disponible.
- Tesseract es opcional como fallback.

### Windows

- El flujo general de la app funciona.
- El OCR depende de Tesseract, porque Apple Vision no existe en Windows.
- El selector nativo de carpetas ya está integrado.
- Se incluye `start-booksaver.bat` para arrancar la app con doble clic.

### Linux

- El flujo general puede funcionar.
- El OCR depende de Tesseract.
- La carpeta de importación todavía se indica pegando la ruta manualmente.

## Principios del proyecto

- Local-first: las imágenes, el OCR y los EPUB se quedan en tu máquina.
- No destructivo: se conserva la captura original de cada página.
- Portable: el proyecto debe funcionar aunque otra persona lo abra en otra ruta.
- EPUB primero: la salida está pensada para Kindle, Kobo y lectores compatibles.

## Qué incluye el MVP

- Captura desde navegador con cualquier cámara disponible.
- Importación de fotos desde una carpeta local.
- OCR local con Apple Vision en macOS y Tesseract como opción compatible entre plataformas.
- Reconstrucción básica de layout para mejorar párrafos, encabezados y saltos.
- Estructura editorial por página:
  - Página como imagen.
  - Inicio de parte y nombre de parte.
  - Inicio de capítulo, nombre y fin de capítulo.
  - Cabecera de capítulo desde la propia captura.
- Recorte no destructivo por página.
- Portada desde una página del libro o desde una imagen externa.
- Exportación EPUB3 con `nav.xhtml` e índice visible.

<a id="instalacion-personas-no-tecnicas"></a>
## Instalación para personas no técnicas

Esta sección está pensada para alguien que no usa Git ni programa normalmente.

### 1. Descargar BookSaver

La forma más sencilla es:

1. Abre [el repositorio en GitHub](https://github.com/juange87/BookSaver).
2. Pulsa el botón verde `Code`.
3. Pulsa `Download ZIP`.
4. Descomprime el ZIP en una carpeta fácil de encontrar, por ejemplo:
   - macOS: `Documentos/BookSaver`
   - Windows: `Documentos\BookSaver`

No hace falta usar `git clone` para probar la app.

### 2. Instalar Node.js

BookSaver necesita Node.js 22 o superior.

1. Abre la página oficial de Node.js:
   [nodejs.org](https://nodejs.org/en/download/package-manager)
2. Instala una versión LTS que sea 22 o superior.
3. Cuando termine, cierra y vuelve a abrir la terminal si ya la tenías abierta.

### 3. Preparar el OCR según tu sistema

#### En macOS

No necesitas instalar Apple Vision: viene con el sistema.

Si además quieres tener Tesseract como fallback:

```sh
brew install tesseract
brew install tesseract-lang
```

Según las fórmulas oficiales de Homebrew, `tesseract` solo trae por defecto
`eng`, `osd` y `snum`; para otros idiomas, como español, hace falta
`tesseract-lang`.

Referencias:

- [Homebrew: tesseract](https://formulae.brew.sh/formula/tesseract)
- [Homebrew: tesseract-lang](https://formulae.brew.sh/formula/tesseract-lang)

#### En Windows

Para que el OCR funcione en Windows hoy, necesitas Tesseract.

1. Sigue la instalación de Windows documentada por Tesseract:
   [tesseract-ocr/tessdoc](https://github.com/tesseract-ocr/tessdoc/blob/main/Installation.md)
2. Instala la versión de Windows recomendada allí, que actualmente apunta al
   instalador de UB Mannheim.
3. Asegúrate de que `tesseract.exe` queda accesible desde la variable `PATH`.

Después, comprueba la instalación abriendo `PowerShell` y ejecutando:

```powershell
tesseract --version
tesseract --list-langs
```

Si en la lista no aparece `spa`, instala o copia el idioma español dentro de la
carpeta `tessdata` de Tesseract. Como referencia oficial, los modelos de idioma
se publican en los repositorios de datos de Tesseract:

- [tesseract-ocr/tessdata](https://github.com/tesseract-ocr/tessdata)
- [tesseract-ocr/tessdata_fast](https://github.com/tesseract-ocr/tessdata_fast)

Ruta habitual en Windows:

```text
C:\Program Files\Tesseract-OCR\tessdata
```

### 4. Arrancar BookSaver

#### Opción fácil

- macOS: abre `start-booksaver.command`
- Windows: abre `start-booksaver.bat`

Esos archivos intentan abrir el navegador en:

```text
http://127.0.0.1:5173
```

#### Opción manual

Si prefieres hacerlo desde terminal:

1. Abre Terminal en macOS o PowerShell en Windows.
2. Entra en la carpeta de BookSaver.
3. Ejecuta:

```sh
npm start
```

Nota: en la versión actual no hace falta `npm install`, porque el proyecto no
tiene dependencias externas de Node.js.

### 5. Primer uso recomendado

1. Pulsa `Nuevo libro`.
2. Crea el título y el idioma OCR.
3. Importa fotos o activa la cámara.
4. Pulsa `Leer texto`.
5. Corrige el texto si hace falta.
6. Marca estructura y portada.
7. Pulsa `Exportar EPUB`.

## Flujo recomendado con fotos del móvil

La mejor calidad suele venir de hacer fotos reales con la app Cámara del móvil
y luego importarlas desde una carpeta local.

Flujo sugerido:

1. Crea un libro.
2. Abre la zona de importación por carpeta.
3. Elige o pega la carpeta donde vas a dejar las fotos.
4. Copia o mueve ahí las imágenes.
5. Pulsa `Revisar carpeta`.
6. Revisa texto, recortes, estructura y portada.
7. Exporta el EPUB.

## Arranque local para desarrollo

```sh
npm start
```

Después abre:

```text
http://127.0.0.1:5173
```

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
- **Portada**: puede salir de una página del propio libro o de una imagen subida.

El índice del EPUB se actualiza a partir de esas marcas.

## Estructura del repositorio

- `public/`: interfaz web local.
- `src/server.js`: servidor HTTP local y API.
- `src/lib/storage.js`: persistencia de libros, páginas, inbox y exportación.
- `src/lib/ocr.js`: adaptador OCR local y diagnóstico de compatibilidad.
- `src/lib/layout.js`: reconstrucción de bloques de lectura.
- `src/lib/epub.js`: generador EPUB.
- `scripts/vision-ocr.swift`: OCR nativo con Apple Vision.
- `start-booksaver.command`: arranque sencillo para macOS.
- `start-booksaver.bat`: arranque sencillo para Windows.
- `tests/`: pruebas automatizadas del MVP.

## Tests

Ejecuta la suite con:

```sh
npm test
```

Las pruebas actuales cubren:

- Almacenamiento de proyectos y páginas.
- Importación cronológica desde bandeja.
- Persistencia de estructura editorial, portada y recortes.
- Generación de EPUB.
- Reconstrucción básica del layout OCR.
- Selección de motor OCR por plataforma y diagnóstico de compatibilidad.

## Reportar errores

La propia interfaz incluye una sección `Compatibilidad y ayuda` con un botón
`Reportar error` que abre la creación de un issue en GitHub con datos básicos
del sistema ya rellenados.

Si prefieres abrirlo manualmente:

- [Crear issue en GitHub](https://github.com/juange87/BookSaver/issues/new)

## Limitaciones conocidas del MVP

- No hay aplicación nativa empaquetada todavía; ahora mismo es una web local.
- En Windows y Linux el OCR requiere Tesseract instalado.
- El selector nativo de carpetas está integrado en macOS y Windows.
- El OCR puede necesitar revisión manual en páginas complejas o deterioradas.
- El recorte es rectangular y manual.
- El flujo de Continuity Camera depende de que el navegador exponga el iPhone
  como dispositivo de vídeo.

## Nota legal

BookSaver está pensado para preservación personal de libros propios, obras de
dominio público o material que tengas permiso para digitalizar. No debe usarse
para distribuir contenido protegido sin autorización.

## Apoyar el proyecto

Si BookSaver te resulta útil y te apetece apoyar el tiempo invertido en el
proyecto, puedes hacerlo escaneando cualquiera de estos QR:

<table>
  <tr>
    <td align="center">
      <strong>PayPal</strong><br />
      <img src="docs/donations/paypal-qr.jpg" alt="QR de PayPal para apoyar BookSaver" width="220" />
    </td>
    <td align="center">
      <strong>Revolut</strong><br />
      <img src="docs/donations/revolut-qr.jpg" alt="QR de Revolut para apoyar BookSaver" width="220" />
    </td>
  </tr>
</table>

Gracias por ayudar a que BookSaver siga mejorando.
