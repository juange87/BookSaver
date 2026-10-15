# Revamp de la UI: workspace por libro

Fecha: 2026-10-15

## Contexto

La interfaz actual acumula capas de funcionalidad sin una jerarquía común:

- La topbar muestra seis botones con el mismo peso (`Nuevo libro`, `Importar
  paquete`, `Revisar exportación`, `Exportar paquete`, `Exportar texto`,
  `Exportar EPUB`) y mezcla acciones de biblioteca con acciones del libro
  abierto.
- El bloque "Compatibilidad y ayuda" se repite al pie de todas las vistas.
- En Editar, las acciones por rango y la búsqueda ocupan la parte superior y
  empujan la página hacia abajo; bajo la imagen hay unos doce botones apilados
  sin agrupar. La vista mide unos 2000 px de alto.
- Biblioteca mezcla el estado global con historial, snapshots y papelera del
  libro abierto.

El usuario trabaja de forma **intercalada**: captura un tramo, revisa, vuelve a
capturar, corrige estructura. Usa la app **tanto en portátil (1280–1440 px)
como en monitor grande (≥1920 px)**. Quiere mejorar a la vez la localización de
acciones, el flujo y el aspecto visual.

## Objetivo

Convertir la app en un **espacio de trabajo por libro**, con una Biblioteca
como pantalla de inicio, una tira de páginas siempre visible dentro del libro y
una estética editorial cálida y refinada, sin perder ninguna funcionalidad
existente.

Criterios de éxito:

1. Cada control actual tiene un sitio definido en la nueva UI (ver
   [Inventario](#inventario-de-controles)).
2. En 1440×900, el modo Página muestra imagen, texto e inspector sin scroll de
   página.
3. En 1280×800 el modo Página sigue siendo usable sin solapes (inspector
   plegado).
4. `npm test` pasa al final de cada fase.

## Decisiones aprobadas

| Tema | Decisión |
| --- | --- |
| Estructura | Shell C: workspace unificado con tira de páginas permanente y modos `＋ Añadir`, `Página`, `Lectura`. |
| Estética | A: editorial cálido refinado (papel, ámbar, serif en títulos), menos bordes, controles segmentados. |
| Modo Página | A: imagen y texto lado a lado, barra flotante de herramientas de imagen, inspector plegable. |
| Añadir y Biblioteca | Propuesta validada: fuentes como pestañas y rejilla de portadas. |
| Implementación | Enfoque 1: reestructuración incremental conservando los `id` del DOM, en cuatro fases con un commit (o más) por fase y una PR final. |
| Modo oscuro | Fuera de alcance. Los colores se definen como tokens para poder añadirlo después. |

## Principios de implementación

- **Se conservan los `id` existentes.** `app.js` resuelve unas 240 referencias
  en el registro `els` (`public/app.js:80-320`) y engancha 138 listeners. Los
  elementos se **mueven** en `index.html`; no se renombran. Si un elemento deja
  de existir, se elimina también su entrada en `els` y su listener.
- **Se conserva el mecanismo de vistas.** `data-view-tab` sigue usando los
  valores `library`, `capture`, `editor` y `reading`, junto con `showMainView`,
  `setActiveTab` y `activateTabGroup`. Cambian el marcado y las etiquetas, no
  los valores, así que los llamantes de `showMainView(...)` no se tocan.
- **La lógica nueva va en módulos puros** bajo `public/`, testeados con
  `node --test` igual que `page-inspector.js`. El DOM queda en `app.js`.
- **Sin cambios de backend.** No se tocan `src/server.js`, las rutas de la API,
  la persistencia ni las reglas de exportación EPUB.
- **Textos en castellano.** Al reescribir un texto se corrigen sus tildes
  (p. ej. "Aun no hay paginas" → "Aún no hay páginas"); no se hace una pasada
  global de tildes fuera de lo tocado.

## Sistema visual (tokens)

`styles.css` se reorganiza alrededor de variables en `:root`:

- **Color:** `--color-paper` (fondo, `#f6f1e8`), `--color-surface` (paneles,
  `#fbf8f2`), `--color-sheet` (campos y miniaturas, `#fffdf8`),
  `--color-line` (`#e6dccb`), `--color-ink` (`#2b2722`), `--color-ink-muted`
  (`#6f6352`), `--color-accent` (`#ad5713`), `--color-accent-soft`
  (`#f3e2cf`), `--color-ok`, `--color-warn`, `--color-danger`.
- **Tipografía:** `--font-display` (serif: "Iowan Old Style", Georgia) para
  títulos y el texto de lectura; `--font-ui` (system-ui) para controles.
  Escala `--text-xs` … `--text-xl`.
- **Espaciado y forma:** `--space-1` … `--space-6` (4 px de base),
  `--radius-sm` / `--radius-md` / `--radius-pill`, una sola sombra
  `--shadow-pop` para menús y paneles flotantes.
- **Componentes base:** botón primario (relleno ámbar), secundario (superficie
  y línea), fantasma (sin borde), control segmentado, chip/etiqueta, menú
  desplegable, panel lateral (drawer) y barra flotante.

Las tarjetas con borde grueso se sustituyen por superficies planas separadas
con `--color-line`. Solo hay un botón primario visible por zona.

## Estructura general (shell)

### Topbar en Biblioteca (`data-view="library"`)

`BookSaver` · `Biblioteca` · … · `Importar paquete` · **`＋ Nuevo libro`** · `⚙︎`

### Topbar en el workspace del libro (`capture` | `editor` | `reading`)

`← Biblioteca` · selector del libro (`#projectSelect`, con estilo de título) ·
`Libro` · control segmentado `＋ Añadir páginas | Página | Lectura` · … ·
`Buscar` · **`Exportar EPUB` + `▾`** · `⚙︎`

- `<body data-view="…">` se actualiza en `showMainView` y la CSS decide qué
  topbar se muestra.
- **Exportar:** botón dividido. El primario es `#exportButton` (Exportar EPUB).
  El menu `▾` contiene `#reviewExportButton` (Revisar exportación),
  `#exportTextButton` (Exportar texto) y `#exportPackageButton` (Exportar
  paquete).
- **`#projectStatus`** pasa a ser un texto secundario junto al selector del
  libro.
- **Sin libro abierto:** el workspace no es accesible y la app muestra la
  Biblioteca.

### Panel "Libro" (drawer derecho)

Un `<dialog>` con estilo de panel lateral que se abre con el botón `Libro`. Las
secciones se pliegan:

1. **Datos del libro:** botón "Editar metadatos" que abre `#metadataDialog`
   (hoy solo se abre desde los avisos de exportación).
2. **Portada:** `#coverSlot` completo (vista previa y sus tres botones).
3. **Índice EPUB:** `#chapterIndex`.
4. **Exportaciones:** `#openExportFolderButton`, `#exportHistoryStatus` y
   `#exportHistoryList`.
5. **Snapshots:** `#snapshotHistoryStatus` y `#snapshotHistoryList`.
6. **Papelera:** `#emptyTrashButton`, `#trashHistoryStatus` y
   `#trashHistoryList`.

`jumpToWarning` (`missing-cover`) abre el panel Libro en la sección Portada en
lugar de hacer scroll a `#coverSlot`.

### Panel "Ajustes" (drawer derecho, ⚙︎)

Contiene el contenido actual de `.support-panel`: `#supportSummary`,
`#supportFacts`, `#updateNotice` (con `#runUpdateButton` y
`#updateReleaseLink`), `#configureAiOcrButton`, `#checkUpdatesButton`,
`#setupGuideLink` y `#reportIssueLink`. El bloque deja de aparecer al pie de
las vistas. Si hay una actualización disponible, el botón ⚙︎ muestra un punto
de aviso.

### Búsqueda

El botón `Buscar` de la topbar abre un popover anclado bajo la topbar con
`#bookSearchForm`, `#bookSearchInput`, `#bookSearchButton`,
`#bookSearchStatus` y `#bookSearchResults`. Elegir un resultado navega como
hoy, cambia al modo Página y cierra el popover. `Esc` también lo cierra.

### Menús, popovers y drawers

Un helper DOM pequeño (`public/ui-popover.js`) gestiona abrir y cerrar con
`aria-expanded`, cierre con `Esc` o clic fuera, y devolución del foco al
disparador. Los drawers usan `<dialog>.showModal()`, como los diálogos
existentes.

## Tira de páginas (compartida por los tres modos)

La columna `.pages-panel` sale de `#editorView` y pasa a un contenedor de
workspace común, visible en `capture`, `editor` y `reading`.

- **Cabecera:** `#pagesCount` y los filtros de marcadores
  (`#pageMarkerFilters`) como chips compactos.
- **Lista:** `#pagesList`, con la agrupación actual por parte y capítulo
  (`renderPages`, `createPartGroup` y `createChapterGroup`). Cada fila
  (`createPageItem`) queda en miniatura, número, punto de estado y checkbox de
  selección. Los badges de texto pasan a tooltip (`title`).
- **Clic en una miniatura:** selecciona la página y, si el modo actual no es
  Página, cambia a Página.
- **Selección múltiple:** se mantiene el checkbox
  (`state.selectedBatchPageIds`). **Nuevo:** shift-clic en un checkbox
  selecciona el rango contiguo desde el último marcado.
- **Barra de selección contextual:** `#pageBatchToolbar` solo aparece cuando la
  selección no está vacía, encima del área de trabajo. Contiene:
  - `#pageBatchSummary`, `#selectVisiblePagesButton` y
    `#clearPageSelectionButton`.
  - Reordenado (`#pageBatchAnchorInput`, `#moveBatch*`).
  - Acciones por rango: `#rangeActionStartInput` y `#rangeActionEndInput`, que
    se rellenan con el mínimo y el máximo de la selección y siguen siendo
    editables, y `#rangeOcrButton`, `#rangeReviewedButton`,
    `#rangeRotateLeftButton`, `#rangeRotateRightButton`, `#rangeCropButton`,
    `#rangeExportButton` y `#rangeActionStatus`.
- **Ordenar** (`#sortPagesByDateButton`, `#sortPagesByNameButton`) pasa a un
  menú `⋯` en la cabecera de la tira.
- Las acciones por rango también se pueden abrir sin selección desde el menú
  `⋯` de la tira ("Acciones por rango…"), que muestra la barra con los campos
  vacíos.
- **Miniaturas:** siguen cargando `/api/projects/:id/pages/:id/image` como
  hoy, con `loading="lazy"`. No se crea un endpoint de miniaturas.

## Modo Página (`editor`)

### Barra de página

`Página N` · etiqueta de estado (`#editorStatus` resumido) · … · `‹ Anterior` ·
`Siguiente ›` · `#nextProblemButton` (Siguiente problema). `#reviewQueueStatus`
y `#batchOcrStatus` se muestran como texto de estado en esta barra cuando hay
contenido.

`‹ Anterior` y `Siguiente ›` son controles nuevos de navegación. Seleccionan la
página adyacente en el orden del libro, respetando el filtro de marcadores
activo.

### Panel de imagen

`#imageReviewFrame` (`#selectedImage` y `#cropOverlay`) ocupa la columna
izquierda. Tiene una **barra flotante** abajo y al centro:

- `#rotatePageLeftButton`, `#rotatePageRightButton`, `#saveCropButton`,
  `#clearCropButton`, `#compareAdjustmentButton`, `#toggleLargePageButton` y
  `⋯`.
- **Menú `⋯`:**
  - Enderezar: `#deskewAngleInput`, `#saveDeskewButton` y
    `#clearDeskewButton`.
  - Mover página: `#movePageFirstButton`, `#movePageUpButton`,
    `#movePageDownButton` y `#movePageLastButton`.
  - Aplicar recorte a rango: `#cropRangeStartInput`, `#cropRangeEndInput` y
    `#applyCropRangeButton`.
  - Separador, y `#deletePageButton` en estilo de peligro.
- `#cropStatus` y `#rotationStatus` se muestran como pie discreto bajo la
  imagen.
- `#adjustmentComparePanel` se superpone al panel de imagen cuando está activo.

### Panel de texto

La cabecera contiene el segmentado `Texto | Vista EPUB` (el `data-pane-tab`
existente), `#ocrModeInput` y `#ocrButton` (Leer texto) agrupados, un menú `▾`
con `#batchOcrPendingButton` y `#batchOcrAllButton`, y `#saveTextButton`
(primario). El cuerpo contiene `#ocrText` o `#formattedPreview`.

### Inspector

Se mantiene el diseño aprobado en
`docs/superpowers/specs/2026-07-06-editor-inspector-redesign-design.md`
(resumen, Estructura EPUB abierta por defecto, Calidad, Marcadores,
Diccionario e Historial en acordeones). Solo cambian la estética y el
comportamiento responsive.

## Modo Añadir páginas (`capture`)

El área de trabajo tiene un segmentado de fuentes (`data-capture-tab`):

1. **Cámara:** `#video` y `#cameraEmpty` a tamaño grande. Debajo van
   `#cameraSelect`, `#cameraButton`, `#iphoneCameraButton`, `#captureButton`
   (disparador circular) y `#captureHint`. `#cameraInfo` y
   `#cameraDiagnostics` (con `#cameraDevicesList`, `#cameraDiagnosticsHint` e
   `#iphoneHelpLine`) pasan a un `<details>` "¿No ves tu cámara?".
2. **Móvil:** `#mobileCaptureButton`, `#copyMobileCaptureUrlButton`,
   `#mobileCaptureUrl` y `#mobileCaptureStatus`.
3. **Carpeta y fotos:** `#importPhotosButton` (con `#photoImportInput`),
   `#inboxPathInput`, `#inboxWatchInput`, `#selectInboxButton`,
   `#saveInboxButton`, `#scanInboxButton`, `#inboxStatus` y
   `#inboxPreviewPanel` completo.

`#captureTitle` y `#captureDescription` se reducen a una línea de ayuda.

**Panel "Esta sesión"** (columna derecha): muestra cuántas páginas se han
añadido desde que se entró en el modo, con dos acciones: "Revisar las nuevas →"
(abre la primera página nueva en modo Página) y "Leer texto de las nuevas"
(rellena el rango con la primera y la última página nueva y ejecuta el OCR por
rango existente).

Las páginas nuevas se calculan **solo en estado de UI**: al entrar en el modo
se guarda el conjunto de `id` de página existentes, y son nuevas las que no
estaban en ese conjunto. No se persiste nada. Si no hay páginas nuevas, el
panel muestra solo una línea de ayuda. Captura, importación y bandeja añaden
siempre al final, así que las nuevas son normalmente contiguas. Si el usuario
las reordena durante la sesión y dejan de serlo, "Leer texto de las nuevas" se
desactiva con un aviso ("Las páginas nuevas ya no son consecutivas; usa
selección por rango"), en vez de leer páginas antiguas por error. La lógica vive en el módulo puro
`public/capture-session.js`.

## Modo Lectura (`reading`)

Se mantiene la funcionalidad (`#refreshReadingButton`, `#readingStatus`,
`#readingNavigation` y `#readingChapters`). Solo cambia la estética: columna
de lectura centrada con `--font-display` y avisos como chips. La tira de
páginas sigue visible a la izquierda.

## Biblioteca (`library`)

- **Cabecera:** "Tus libros", `#libraryStats` reducido a una línea de texto
  ("1 libro · 15 páginas · 73 % revisado · 0 problemas") y `#libraryFilters`
  como chips.
- **`#libraryList` como rejilla** de tarjetas. Cada tarjeta muestra la portada
  (`/api/projects/:id/cover/image` si existe; si no, un bloque de color con el
  título), el título, el autor, el número de páginas, una barra de progreso y
  el estado. Clic en la tarjeta → `openDashboardProject(id, 'editor')`. El
  botón secundario "Añadir páginas" → `openDashboardProject(id, 'capture')`.
- La última tarjeta es "＋ Nuevo libro" y abre `#projectDialog`, igual que
  `#newProjectButton`.
- El historial, los snapshots y la papelera **salen** de la Biblioteca (van al
  panel Libro).

## Comportamiento responsive

| Ancho | Tira | Área de trabajo | Inspector |
| --- | --- | --- | --- |
| ≥ 1440 px | 200 px fija | imagen y texto lado a lado | 280 px fijo |
| 1280–1439 px | 184 px fija | imagen y texto lado a lado | plegado: botón "Inspector" en la barra de página que lo abre como panel superpuesto |
| 1024–1279 px | 184 px fija | imagen arriba, texto debajo | plegado (igual) |
| < 1024 px | plegada: botón "Páginas" que la abre superpuesta | imagen arriba, texto debajo | plegado (igual) |

- **Añadir páginas:** el panel "Esta sesión" se apila bajo el área de captura
  por debajo de 1280 px.
- **Topbar:** por debajo de 1280 px, las etiquetas de `Buscar` y `Libro` pasan
  a solo icono (con `aria-label`).
- **Fuera de alcance:** el diseño para móvil. La captura desde el teléfono
  sigue en `public/mobile.html`.

El estado abierto o plegado de los paneles superpuestos es solo de UI y no se
persiste.

## Accesibilidad

- Los segmentados mantienen `role="tablist"`/`role="tab"` y `aria-selected`.
- Los menús y popovers usan `aria-haspopup`, `aria-expanded`, cierre con `Esc`
  y devolución del foco al disparador.
- Los botones solo-icono llevan `aria-label` en castellano.
- Se mantiene el atajo actual de la barra espaciadora para capturar.
- Contraste mínimo AA para texto sobre `--color-paper` y `--color-surface`.

## Fases (un commit o más por fase)

Cada fase deja la app funcional, pasa `npm test` y se verifica en el navegador
en 1440×900 y 1280×800.

### Fase 1 — Tokens, shell y paneles globales

- Reescribir la base de `styles.css` sobre tokens y componentes base.
- Nueva topbar con dos variantes y `body[data-view]`. Segmentado de modos con
  las etiquetas nuevas.
- Botón dividido Exportar con menú.
- Panel Ajustes (mover `.support-panel`).
- Panel Libro (mover portada, índice EPUB, historial, snapshots y papelera, y
  añadir el botón "Editar metadatos").
- `public/ui-popover.js` (helper de menús, popovers y drawers).
- Módulo puro `public/app-shell.js`: a partir de la vista y el proyecto
  calcula la variante de topbar, el modo activo, el estado habilitado de las
  acciones de exportación y el punto de aviso de actualización. Con tests en
  `tests/app-shell.test.js`.
- **Verificación:** todas las acciones de la topbar antigua siguen
  funcionando desde su nuevo sitio; los paneles Libro y Ajustes se abren y se
  cierran con teclado y ratón.

### Fase 2 — Workspace y modo Página

- Sacar `.pages-panel` a un contenedor de workspace común y rediseñar la fila
  de la tira.
- Shift-clic para seleccionar rangos. Barra de selección contextual
  (reordenado y acciones por rango) y menú `⋯` de la tira.
- Módulo puro `public/page-range-selection.js`: selección contigua con
  shift-clic y mínimo y máximo para Desde/Hasta. Con tests.
- Barra de página con anterior, siguiente y siguiente problema. El cálculo de
  la página adyacente con filtro va en `page-range-selection.js` o en un
  helper puro equivalente, con tests.
- Barra flotante de imagen y menú `⋯`; cabecera del panel de texto con OCR.
- Popover de búsqueda.
- Inspector plegable por debajo de 1440 px.
- **Verificación:** recortar, rotar, enderezar, mover, eliminar, OCR de página,
  OCR por lotes, acciones por rango, búsqueda, marcadores y estructura EPUB
  funcionan como antes. En 1440×900 no hay scroll de página en modo Página.

### Fase 3 — Modo Añadir páginas

- Segmentado de fuentes y reubicación de controles de cámara, móvil y carpeta.
- Panel "Esta sesión" con `public/capture-session.js` (tests en
  `tests/capture-session.test.js`).
- **Verificación:** activar cámara y capturar, importar fotos, activar la URL
  móvil, guardar y revisar la carpeta con previsualización de importación.
  Las páginas nuevas aparecen en la tira y en el panel de sesión.

### Fase 4 — Biblioteca, Lectura y limpieza

- Rejilla de tarjetas y cabecera compacta de Biblioteca.
- Estética de Lectura.
- Comportamiento responsive completo (tabla anterior).
- Eliminar las reglas CSS que hayan quedado muertas.
- **Verificación:** abrir un libro desde la tarjeta (modo Página) y desde
  "Añadir páginas" (modo Añadir); crear un libro; importar un paquete; probar
  los anchos 1920, 1440, 1280 y 1024.

## Inventario de controles

Lo que no aparece abajo se mantiene en su sitio, dentro de su panel, con la
estética nueva.

| Control actual | Destino |
| --- | --- |
| `#newProjectButton` | Topbar de Biblioteca (primario) y tarjeta "＋ Nuevo libro" |
| `#importPackageButton`, `#packageImportInput` | Topbar de Biblioteca |
| `#projectSelect`, `#projectStatus` | Topbar del workspace |
| `#exportButton` | Primario del botón dividido Exportar |
| `#reviewExportButton`, `#exportTextButton`, `#exportPackageButton` | Menú `▾` de Exportar |
| `data-view-tab` (4 pestañas) | `library` → "← Biblioteca"; `capture`/`editor`/`reading` → segmentado de modos |
| `.support-panel` y todo su contenido | Panel Ajustes |
| `#libraryStats`, `#libraryFilters`, `#libraryList` | Biblioteca (rediseño) |
| Historial de exportación, snapshots y papelera | Panel Libro |
| `#coverSlot` y botones, `#coverUploadInput` | Panel Libro → Portada |
| `#chapterIndex` | Panel Libro → Índice EPUB |
| `#pagesCount`, `#pageMarkerFilters`, `#pagesList` | Tira de páginas |
| `#pageBatchToolbar` y su contenido | Barra de selección contextual |
| `#sortPagesByDateButton`, `#sortPagesByNameButton` | Menú `⋯` de la tira |
| Bloque "Acciones por páginas" (`#rangeAction*`, `#range*Button`) | Barra de selección contextual |
| Bloque "Buscar en el libro" (`#bookSearch*`) | Popover de búsqueda en la topbar |
| `#ocrModeInput`, `#ocrButton` | Cabecera del panel de texto |
| `#batchOcrPendingButton`, `#batchOcrAllButton` | Menú `▾` de OCR en la cabecera del panel de texto |
| `#nextProblemButton`, `#editorStatus`, `#batchOcrStatus`, `#reviewQueueStatus` | Barra de página |
| `#rotatePage*Button`, `#saveCropButton`, `#clearCropButton`, `#compareAdjustmentButton`, `#toggleLargePageButton` | Barra flotante de imagen |
| `#deskewAngleInput`, `#saveDeskewButton`, `#clearDeskewButton` | Menú `⋯` de imagen → Enderezar |
| `#movePage*Button` | Menú `⋯` de imagen → Mover página |
| `#cropRangeStartInput`, `#cropRangeEndInput`, `#applyCropRangeButton` | Menú `⋯` de imagen → Aplicar recorte a rango |
| `#deletePageButton` | Menú `⋯` de imagen (peligro) |
| `#cropStatus`, `#rotationStatus` | Pie bajo la imagen |
| `#saveTextButton`, `#ocrText`, `#formattedPreview`, `data-pane-tab` | Panel de texto |
| Inspector completo (`#pageInspector*`, estructura, calidad, marcadores, diccionario, historial) | Inspector (sin cambios funcionales) |
| Controles de cámara (`#camera*`, `#iphone*`, `#captureButton`, `#captureHint`, `#video`, `#cameraEmpty`) | Añadir → pestaña Cámara |
| `#mobileCapture*`, `#copyMobileCaptureUrlButton` | Añadir → pestaña Móvil |
| `#importPhotosButton`, `#photoImportInput`, `#inbox*`, `#selectInboxButton`, `#saveInboxButton`, `#scanInboxButton`, `#inboxPreviewPanel` | Añadir → pestaña Carpeta y fotos |
| `#readingView` y su contenido | Modo Lectura |
| Diálogos (`#projectDialog`, `#metadataDialog`, `#exportChecklistDialog`, `#exportResultDialog`, `#aiOcrDialog`, `#aiOcrSettingsDialog`), `#toast` | Sin cambios funcionales; solo estética |

**Controles nuevos:** "← Biblioteca", botón `Libro`, botón ⚙︎, botón `Buscar`,
`▾` de Exportar, `▾` de OCR, `⋯` de imagen, `⋯` de tira, `‹ Anterior` /
`Siguiente ›`, botón "Inspector" (por debajo de 1440 px), botón "Páginas" (por
debajo de 1024 px), "Editar metadatos", y las acciones del panel "Esta sesión".

## Fuera de alcance

- Modo oscuro (solo se preparan los tokens).
- Diseño responsive para móvil y la página `public/mobile.html` / `mobile.js`.
- Cambios en `src/server.js`, rutas de la API, almacenamiento o exportación.
- Endpoint de miniaturas.
- Reescribir `app.js` en componentes o introducir un framework. Solo se extrae
  a módulos lo que se toca.
- Funcionalidades nuevas más allá de las listadas en "Controles nuevos" (p. ej.
  OCR automático al capturar, persistir el estado de los paneles).

## Riesgos

- **Listeners y referencias perdidas al mover nodos:** mover nodos no rompe
  `els` porque se resuelven por `id` al arrancar. El riesgo está en los
  elementos que se renderizan con `innerHTML` dentro de contenedores que
  cambian. Hay que verificar cada fase con el recorrido manual descrito.
- **`scrollIntoView` y foco hacia elementos ahora ocultos en drawers o menús**
  (p. ej. `#coverSlot`): hay que abrir el contenedor antes de enfocar.
- **CSS legado con selectores por estructura:** en la fase 4 se eliminan las
  reglas muertas tras comprobar que no tienen uso.
