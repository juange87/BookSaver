# BookSaver

<p align="center">
  <img src="docs/assets/booksaver-header.png" alt="BookSaver banner" width="100%" />
</p>

<p align="center">
  <a href="docs/README.en.md">English README</a>
</p>

<p align="center">
  <img alt="Release 1.1.0" src="https://img.shields.io/badge/release-1.1.0-1f8a63">
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
- [Compatibilidad actual](#compatibilidad-actual)
- [Principios del proyecto](#principios-del-proyecto)
- [Qué incluye BookSaver](#qué-incluye-booksaver)
- [Instalación para personas no técnicas](#instalacion-personas-no-tecnicas)
- [Paquetes para distribución](#paquetes-para-distribucion)
- [Dónde guarda tus libros](#dónde-guarda-tus-libros)
- [Flujo recomendado con fotos del móvil](#flujo-recomendado-con-fotos-del-móvil)
- [Arranque local para desarrollo](#arranque-local-para-desarrollo)
- [OCR y formato](#ocr-y-formato)
- [Estructura EPUB](#estructura-epub)
- [Estructura del repositorio](#estructura-del-repositorio)
- [Tests](#tests)
- [Reportar errores](#reportar-errores)
- [Limitaciones actuales](#limitaciones-actuales)
- [Nota legal](#nota-legal)
- [Apoyar el proyecto](#apoyar-el-proyecto)

## Vista rápida

| Captura | OCR | Estructura | Exportación |
| --- | --- | --- | --- |
| Cámara del navegador o fotos importadas | Apple Vision en macOS, Tesseract en otros sistemas | Partes, capítulos, imágenes, recortes y portada | EPUB3 con índice navegable |

## Compatibilidad actual

### macOS

- Es la plataforma más completa ahora mismo.
- Puede usar Apple Vision sin instalar nada extra para OCR.
- El selector nativo de carpetas está disponible.
- Tesseract es opcional como fallback.
- Se puede distribuir como `.app` empaquetada con runtime incluido.

### Windows

- El flujo general de la app funciona.
- El OCR depende de Tesseract, porque Apple Vision no existe en Windows.
- El selector nativo de carpetas ya está integrado.
- Se puede distribuir como ZIP portátil con runtime incluido.
- Si la app viene de un ZIP descargado, puede autoactualizarse desde la interfaz.

### Linux

- El flujo general puede funcionar.
- El OCR depende de Tesseract.
- La carpeta de importación todavía se indica pegando la ruta manualmente.

## Principios del proyecto

- Local-first: las imágenes, el OCR y los EPUB se quedan en tu máquina.
- No destructivo: se conserva la captura original de cada página.
- Portable: el proyecto debe funcionar aunque otra persona lo abra en otra ruta.
- EPUB primero: la salida está pensada para Kindle, Kobo y lectores compatibles.

## Qué incluye BookSaver

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

La forma más sencilla es descargar un release ya empaquetado desde GitHub:

1. Abre [el repositorio en GitHub](https://github.com/juange87/BookSaver).
2. Entra en la sección `Releases`.
3. Descarga el archivo que corresponda a tu equipo:
   - macOS con Apple Silicon: `BookSaver-<versión>-macos-arm64.zip`
   - macOS con Intel: `BookSaver-<versión>-macos-x64.zip`
   - Windows: `BookSaver-<versión>-windows-x64.zip`
4. Descomprime el ZIP en una carpeta fácil de encontrar.

No hace falta usar `git clone`, instalar Node.js ni usar la terminal para
arrancar un release empaquetado.

### 2. Abrir la app

#### En macOS

- Abre `BookSaver.app`.
- Si macOS avisa de que la app no está firmada, haz clic derecho sobre la app,
  pulsa `Abrir` y confirma en el cuadro de seguridad.

#### En Windows

- Abre `start-booksaver.bat`.
- Se abrirá el navegador en `http://127.0.0.1:5173`.

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

### 4. Si descargaste el código fuente en vez del release

Solo necesitas esta parte si bajaste `Download ZIP` del repositorio o si estás
trabajando con el código fuente.

#### Instalar Node.js

BookSaver necesita Node.js 22 o superior.

1. Abre la página oficial de Node.js:
   [nodejs.org](https://nodejs.org/en/download/package-manager)
2. Instala una versión LTS que sea 22 o superior.
3. Cuando termine, cierra y vuelve a abrir la terminal si ya la tenías abierta.

#### Arrancar desde el código fuente

- macOS: abre `start-booksaver.command`
- Windows: abre `start-booksaver.bat`

También puedes hacerlo manualmente desde terminal:

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

La sección `Compatibilidad y ayuda` también puede avisarte si hay una versión
nueva. En instalaciones descargadas como ZIP, BookSaver puede descargarla y
reiniciar el servidor local por ti. Si la instalación viene de un paquete
oficial, intentará usar el asset empaquetado compatible con tu sistema en vez
del ZIP del código fuente.

## Paquetes para distribución

Si vas a publicar una release para otras personas, puedes generar los
artefactos empaquetados desde este repositorio:

```sh
npm run package:macos
npm run package:macos:x64
npm run package:windows
```

Los paquetes se generan en `dist/`:

- `BookSaver-<versión>-macos-arm64/BookSaver.app`
- `BookSaver-<versión>-macos-arm64.zip`
- `BookSaver-<versión>-macos-x64/BookSaver.app`
- `BookSaver-<versión>-macos-x64.zip`
- `BookSaver-<versión>-windows-x64/BookSaver/`
- `BookSaver-<versión>-windows-x64.zip`

El actualizador guiado busca precisamente esos nombres de archivo cuando una
release nueva está publicada en GitHub.

Si publicas una release en GitHub, el workflow `.github/workflows/release-packages.yml`
genera esos ZIPs y los adjunta automáticamente a la página de la release.

Qué hace el empaquetado:

- Descarga el runtime oficial de Node.js para cada plataforma objetivo.
- Copia la app dentro del paquete con su estructura portable.
- Evita incluir `books/`, `inbox/`, `.git` o `node_modules/`.
- Deja la app lista para abrirse sin instalar Node.js en el equipo final.

Notas importantes:

- El paquete de macOS es una `.app`, pero no está firmada ni notarizada.
- El paquete de Windows es portátil; no es un instalador `.msi`.
- El OCR en Windows sigue necesitando Tesseract instalado aparte.

## Dónde guarda tus libros

BookSaver ya no guarda `books/` e `inbox/` dentro de la carpeta descargada del
proyecto. Eso permite actualizar la app sin tocar tus libros.

Rutas por sistema:

- macOS: `~/Library/Application Support/BookSaver`
- Windows: `%LocalAppData%\BookSaver`
- Linux: `~/.local/share/BookSaver` o `$XDG_DATA_HOME/BookSaver`

Dentro de esa carpeta se crean:

- `books/`: proyectos, páginas, OCR y exportaciones
- `inbox/`: bandejas de importación por libro

Si ya usabas una versión anterior que guardaba datos junto al código,
BookSaver intentará moverlos automáticamente la primera vez que arranques esta
versión.

## Flujo recomendado con fotos del móvil

La mejor calidad suele venir de hacer fotos reales con la cámara trasera del
móvil. BookSaver ofrece dos formas locales de traerlas al libro.

### Captura móvil directa

1. Crea o abre un libro.
2. En `Captura desde el móvil`, pulsa `Activar captura móvil`.
3. Abre en el móvil la URL temporal que muestra BookSaver.
4. Pulsa `Capturar página` en el móvil y confirma la foto.
5. Cada foto se añade automáticamente al final del listado de páginas.
6. Cuando termines, pulsa `Desactivar captura móvil`.

El ordenador y el móvil deben estar en la misma red Wi-Fi. La URL usa un token
temporal y solo sirve para añadir páginas al libro activo; no sube nada a la
nube.

### Importación por carpeta

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

### Modos OCR

BookSaver usa OCR local por defecto:

- **Local mejorado**: prueba perfiles locales y elige el resultado con mejor confianza.
- **Doble motor**: si Apple Vision y Tesseract están disponibles, compara ambos y crea un resultado de consenso.
- **IA avanzada**: opción manual para enviar una página a OpenAI cuando aceptas que esa imagen salga de tu equipo.

El modo IA se puede activar desde `Compatibilidad y ayuda` con `Configurar IA OCR`,
o arrancando el servidor local con `OPENAI_API_KEY`. Si guardas la clave desde la
interfaz, BookSaver la conserva en el archivo local `settings.json` dentro de la
carpeta de datos del sistema, fuera del repositorio. La clave no se muestra de
nuevo completa en el navegador y cada página se envía solo después de una
confirmación explícita.

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
- `scripts/package-app.mjs`: generador de paquetes para distribución.
- `scripts/vision-ocr.swift`: OCR nativo con Apple Vision.
- `start-booksaver.command`: arranque sencillo para macOS.
- `start-booksaver.bat`: arranque sencillo para Windows.
- `tests/`: pruebas automatizadas.

Los datos reales del usuario no se guardan en el repo, sino en la carpeta de
datos del sistema explicada en [Dónde guarda tus libros](#dónde-guarda-tus-libros).

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

## Limitaciones actuales

- La app sigue siendo una web local empaquetada, no una aplicación nativa reescrita.
- En macOS el paquete distribuible todavía no está firmado ni notarizado.
- En Windows y Linux el OCR requiere Tesseract instalado.
- El selector nativo de carpetas está integrado en macOS y Windows.
- La autoactualización guiada está pensada para instalaciones descargadas como
  ZIP; si trabajas con un clon de Git, la actualización sigue siendo manual.
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
