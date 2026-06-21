# Tareas BookSaver

Ultima revision: 2026-06-21

Fuente principal: `docs/ROADMAP.md`, ultima revision del roadmap: 2026-06-15.

Este archivo sustituye a `docs/booksaver_tareas.json` como backlog de trabajo. El JSON
original estaba alineado con el roadmap, pero mezclaba tareas de producto, tareas
historicas de PR/code review y mucho protocolo repetido. Para avanzar poco a poco,
este Markdown deja una cola mas legible para humanos y agentes: IDs estables,
estado real, dependencias claras, criterios de aceptacion y verificaciones esperadas.

## Criterio de formato

- Markdown es la fuente canonica para planificar y ejecutar.
- Las tareas de PR/revision ya ejecutadas quedan archivadas, no dentro de la cola viva.
- El protocolo de entrega se define una vez y no se repite en cada tarjeta.
- Cada tarea esta pensada para convertirse en una rama pequeña con tests propios.
- Cuando una tarea necesite un plan tecnico detallado, crear un plan especifico en
  `docs/superpowers/plans/` antes de tocar codigo.

## Estados

- `hecha`: ya aparece implementada en el repo actual.
- `siguiente`: primera tarea recomendada para ejecutar.
- `lista`: se puede ejecutar sin dependencia tecnica pendiente, pero no es la primera.
- `bloqueada`: depende de otra tarea o de una decision previa.
- `decision`: requiere investigar o decidir alcance antes de implementar.
- `archivada`: tarea historica u operativa que no debe ejecutarse como feature.

## Protocolo de ejecucion

1. Antes de empezar una tarea, revisar su fuente en el roadmap y el codigo cercano.
2. Si toca codigo, empezar por tests o por una verificacion automatizada concreta.
3. Mantener local-first: no introducir nube, cuentas, analiticas ni telemetria.
4. Preservar siempre capturas originales; las mejoras de OCR/imagen deben ser
   derivadas, reversibles o regenerables.
5. Mantener textos de UI en castellano.
6. Verificar con `npm test` cuando haya cambios de codigo. Para UI/camara/exportacion,
   anadir verificacion manual en navegador cuando sea posible.
7. No commitear, pushear ni abrir PR automaticamente salvo que el usuario lo pida
   explicitamente para esa tanda de trabajo.

## Orden recomendado inmediato

1. `BS-P1-001` - Analizar calidad de imagenes capturadas.
2. `BS-P1-002` - Mostrar avisos de calidad de captura.
3. `BS-P1-003` - Sugerir recorte por bordes de pagina.
4. `BS-P1-004` - Anadir enderezado simple reversible.
5. `BS-P1-005` - Aplicar recorte similar a rangos.

## Hecho y archivado

### BS-P0-001 - Calcular senales del checklist del libro

Estado: `hecha`

Fuente roadmap: P0.1, checklist de preparacion del libro.

Evidencia actual:

- `src/lib/book-checklist.js` calcula advertencias deterministas.
- `tests/book-checklist.test.js` cubre metadatos, portada, OCR, revision y estructura.
- `src/lib/storage.js` expone `inspectExport`.

### BS-P0-002 - Mostrar checklist antes de exportar

Estado: `hecha`

Fuente roadmap: P0.1, checklist de preparacion del libro.

Evidencia actual:

- `public/index.html` contiene el dialogo `exportChecklistDialog`.
- `public/app.js` renderiza avisos, acciones y saltos al punto corregible.
- `public/styles.css` contiene estilos del panel.

### BS-HIST-001 - Code review PR #1 checklist del libro

Estado: `archivada`

Motivo: tarea historica de revision de PR, no una feature pendiente del producto.

### BS-HIST-002 - Code review PR #2 panel checklist antes de exportar

Estado: `archivada`

Motivo: tarea historica de revision de PR, no una feature pendiente del producto.

### BS-HIST-003 - Revisar trabajo y definir roadmap

Estado: `archivada`

Motivo: el roadmap ya existe en `docs/ROADMAP.md`.

### BS-HIST-004 - Desglosar roadmap en tareas Kanban

Estado: `archivada`

Motivo: esta normalizacion reemplaza ese desglose inicial.

## P0 - Siguiente release: confianza antes de exportar

### BS-P0-003 - Ordenar cola de revision inteligente

Estado: `hecha`

Fuente roadmap: P0.2, cola de revision inteligente.

Dependencias: `BS-P0-001`.

Objetivo: generar una cola ordenada de paginas que necesitan intervencion, con una
razon visible para cada entrada.

Alcance:

- Priorizar OCR fallido o vacio.
- Despues OCR de baja confianza.
- Despues paginas sin revisar.
- Despues paginas con cambios estructurales pendientes.
- Devolver datos deterministas y testeables desde una funcion de libreria.

Criterios de aceptacion:

- La app puede pedir una cola de revision para un libro.
- Cada elemento incluye pagina, severidad, razon y accion sugerida.
- El orden respeta la prioridad definida en el roadmap.
- Hay tests para el orden y para los casos sin problemas.

Evidencia actual:

- `src/lib/book-checklist.js` expone `buildReviewQueue`.
- `src/lib/storage.js` expone `inspectReviewQueue`.
- `tests/book-checklist.test.js` cubre prioridad y cola vacia.
- `tests/storage.test.js` cubre cola generada desde texto persistido.

Verificacion esperada:

- `npm test`
- `node --check src/lib/book-checklist.js` o el nuevo modulo que contenga la cola.

### BS-P0-004 - Anadir boton "Siguiente problema"

Estado: `hecha`

Fuente roadmap: P0.2, cola de revision inteligente.

Dependencias: `BS-P0-003`.

Objetivo: permitir avanzar desde la pantalla de revision a la siguiente pagina
prioritaria y mostrar por que requiere intervencion.

Alcance:

- Boton visible en la revision de paginas.
- Navegacion al siguiente elemento de la cola.
- Mensaje claro cuando no quedan problemas.
- Texto de UI en castellano.

Criterios de aceptacion:

- El usuario pulsa "Siguiente problema" y llega a la siguiente pagina prioritaria.
- La UI muestra la causa de revision de esa pagina.
- Si la cola esta vacia, la app lo comunica sin error.
- La accion no modifica texto, imagenes ni estructura por si sola.

Evidencia actual:

- `public/index.html` muestra el boton `Siguiente problema` en la cabecera del editor.
- `public/app.js` persiste el borrador actual, consulta la cola y salta a la pagina prioritaria.
- `public/review-queue.js` contiene el helper testeable de navegacion de cola.
- `src/server.js` expone `GET /api/projects/:id/review/queue`.
- `tests/review-queue.test.js` cubre avance, primer problema y cola vacia.

Verificacion esperada:

- `npm test`
- `node --check public/app.js`
- Prueba manual en navegador con un libro que tenga al menos dos avisos distintos.

### BS-P0-005 - Previsualizar indice y metadatos de exportacion

Estado: `hecha`

Fuente roadmap: P0.3, validacion EPUB previa y posterior.

Dependencias: ninguna tecnica; recomendado despues de `BS-P0-004` por flujo de release.

Objetivo: mostrar antes de exportar el indice EPUB previsto y los metadatos que
entraran en el archivo final.

Alcance:

- Construir una previsualizacion desde los mismos datos que usa la exportacion.
- Mostrar capitulos, orden de navegacion y metadatos principales.
- No generar un EPUB solo para previsualizar.

Criterios de aceptacion:

- Antes de generar el EPUB, el usuario ve indice, orden y metadatos principales.
- La previsualizacion coincide con la estructura que usara el exportador.
- Los casos sin capitulos marcados tienen un mensaje accionable.

Verificacion esperada:

- `npm test`
- Test especifico para que la previsualizacion y el exportador usen el mismo orden.
- Prueba manual del dialogo de exportacion.

Evidencia actual:

- `src/lib/epub.js` expone `buildEpubPreview` usando el mismo modelo de capitulos
  y navegacion que el exportador.
- `src/lib/storage.js` expone `previewExport`.
- `src/server.js` expone `GET /api/projects/:id/export/preview`.
- `public/index.html` y `public/app.js` muestran metadatos e indice previsto en
  el dialogo previo a exportar.
- `tests/epub.test.js` y `tests/storage.test.js` cubren la previsualizacion.

### BS-P0-006 - Validar EPUB generado y mostrar resumen

Estado: `hecha`

Fuente roadmap: P0.3, validacion EPUB previa y posterior.

Dependencias: `BS-P0-005`.

Objetivo: despues de exportar, confirmar ruta, tamano, numero de capitulos y estado
estructural basico del EPUB.

Alcance:

- Validar que el EPUB contiene archivos internos esperados.
- Detectar faltas de imagen, portada o navegacion.
- Mostrar resumen legible en castellano.
- Mantener la validacion local y sin herramientas externas obligatorias.

Criterios de aceptacion:

- Tras exportar, la app muestra ruta, tamano, capitulos y estado de validacion.
- Los errores se expresan como mensajes accionables.
- Un EPUB valido generado por tests pasa la validacion.
- Un EPUB manipulado con un recurso faltante falla de forma determinista.

Verificacion esperada:

- `npm test`
- Test de EPUB valido y test de EPUB incompleto.
- Prueba manual exportando un libro pequeno.

Evidencia actual:

- `src/lib/epub.js` expone `validateEpubFiles`.
- `src/lib/storage.js` valida los archivos internos antes de escribir el EPUB y
  devuelve resumen de capitulos, paginas y navegacion.
- `public/index.html` y `public/app.js` muestran archivo, ruta local, tamano,
  capitulos y estado de validacion despues de exportar.
- `tests/epub.test.js` cubre EPUB valido y recurso faltante.
- `tests/storage.test.js` cubre el resumen devuelto por `exportEpub`.

### BS-P0-007 - Definir formato del paquete BookSaver

Estado: `hecha`

Fuente roadmap: P0.4, backups locales del proyecto de libro.

Dependencias: ninguna.

Objetivo: documentar el formato del paquete local de copia/traslado de libro antes
de implementarlo.

Alcance:

- Incluir metadatos, capturas originales, OCR revisado, layout, estructura editorial,
  portada y recortes.
- Excluir exports generados por defecto.
- Definir versionado del paquete.
- Definir aviso de tamano si el paquete puede ser grande.

Criterios de aceptacion:

- Existe una especificacion breve y verificable en `docs/`.
- La especificacion indica que se incluye, que se excluye y como versionar.
- La decision conserva el principio de datos locales y editables.

Verificacion esperada:

- Revision documental contra `AGENTS.md` y `docs/ROADMAP.md`.

Evidencia actual:

- `docs/booksaver_package_format.md` define el contenedor `.booksaver.zip`,
  manifiesto, archivos incluidos, exclusiones, versionado, reglas de rutas,
  validacion minima y aviso de tamano.

### BS-P0-008 - Exportar paquete local BookSaver

Estado: `hecha`

Fuente roadmap: P0.4, backups locales del proyecto de libro.

Dependencias: `BS-P0-007`.

Objetivo: exportar un libro como paquete local usando el formato definido.

Alcance:

- Preservar capturas originales.
- Incluir OCR revisado, portada, recortes y estructura editorial.
- No requerir nube, cuentas ni servicios externos.
- Evitar incluir EPUBs generados salvo que la especificacion lo permita de forma
  explicita.

Criterios de aceptacion:

- Un libro se exporta como paquete local.
- El paquete contiene los elementos definidos por la especificacion.
- Hay tests que inspeccionan el contenido del paquete.

Verificacion esperada:

- `npm test`
- Prueba manual con un libro con portada, recorte y OCR editado.

Evidencia actual:

- `src/lib/book-package.js` crea paquetes `.booksaver.zip` con manifiesto v1,
  checksums SHA-256 y validacion de rutas relativas.
- `src/lib/storage.js` expone `exportPackage` e inspeccion previa de tamano.
- `src/server.js` expone `GET /api/projects/:id/package/check`,
  `POST /api/projects/:id/package` y descarga en
  `GET /api/projects/:id/packages/:file`.
- `public/index.html` y `public/app.js` anaden el boton `Exportar paquete`.
- `tests/storage.test.js` verifica que el paquete incluye datos fuente y excluye
  EPUBs generados.

### BS-P0-009 - Importar paquete local BookSaver

Estado: `hecha`

Fuente roadmap: P0.4, backups locales del proyecto de libro.

Dependencias: `BS-P0-008`.

Objetivo: importar un paquete BookSaver y restaurar el proyecto en la biblioteca
local.

Alcance:

- Restaurar paginas, OCR revisado, portada, recortes y estructura editorial.
- Evitar sobreescritura accidental de proyectos existentes.
- Validar version/formato antes de importar.

Criterios de aceptacion:

- Un paquete exportado puede reimportarse.
- El libro importado conserva paginas, texto revisado, portada y estructura.
- Los paquetes invalidos fallan con mensajes claros.

Verificacion esperada:

- `npm test`
- Test round-trip exportar paquete -> importar paquete -> comparar datos esenciales.

Evidencia actual:

- `src/lib/storage.js` expone `importPackage`, crea un nuevo identificador si el
  proyecto original ya existe y restaura paginas, texto, portada, recortes y
  estructura.
- `src/server.js` expone `POST /api/packages/import`.
- `public/index.html` y `public/app.js` anaden `Importar paquete`.
- `tests/storage.test.js` cubre round-trip y rechazo de rutas no seguras.

## P1 - Mejorar captura y OCR asistido

### BS-P1-001 - Analizar calidad de imagenes capturadas

Estado: `hecha`

Fuente roadmap: P1.5, control de calidad de captura.

Dependencias: cierre del bloque P0 recomendado.

Objetivo: calcular flags locales de calidad para capturas e importaciones sin
modificar la imagen original.

Criterios de aceptacion:

- La app detecta desenfoque, oscuridad, resolucion insuficiente y orientacion sospechosa.
- Cada flag incluye causa explicita.
- La imagen original queda intacta.
- Hay tests para el analizador con fixtures sinteticos o datos controlados.

Evidencia actual:

- `src/lib/image-quality.js` calcula diagnosticos locales por dimensiones,
  brillo, detalle/desenfoque y orientacion sospechosa.
- `src/lib/storage.js` guarda el diagnostico como metadato derivado de pagina,
  sin modificar la captura original.
- `tests/image-quality.test.js` cubre fixtures sinteticos y
  `tests/storage.test.js` verifica la persistencia en paginas nuevas.

### BS-P1-002 - Mostrar avisos de calidad de captura

Estado: `hecha`

Fuente roadmap: P1.5, control de calidad de captura.

Dependencias: `BS-P1-001`.

Objetivo: mostrar avisos de calidad al capturar o importar paginas.

Criterios de aceptacion:

- La UI marca paginas sospechosas y explica la causa en castellano.
- El usuario puede ignorar un aviso sin borrar ni alterar la captura.
- Los avisos pueden alimentar el checklist o la cola de revision.

Evidencia actual:

- `src/lib/book-checklist.js` incorpora avisos `capture-quality` en el checklist
  y en la cola de revision.
- `src/lib/storage.js` permite ignorar/reactivar avisos por pagina con metadatos
  locales.
- `public/index.html`, `public/app.js` y `public/styles.css` muestran el panel
  de avisos de captura y conservan el archivo original al importar JPEG/PNG.
- `tests/book-checklist.test.js` y `tests/storage.test.js` cubren avisos activos
  e ignorados.

### BS-P1-003 - Sugerir recorte por bordes de pagina

Estado: `hecha`

Fuente roadmap: P1.6, recorte y enderezado asistidos.

Dependencias: cierre del bloque P0 recomendado.

Objetivo: detectar bordes de pagina y proponer un recorte inicial no destructivo.

Criterios de aceptacion:

- La app propone un recorte cuando detecta bordes suficientes.
- El usuario puede aceptar o rechazar la sugerencia.
- El recorte se guarda como metadata derivada, no como reemplazo de la captura.

Evidencia actual:

- `src/lib/image-adjustments.js` detecta bordes de pagina desde muestras de
  pixeles y normaliza sugerencias de recorte.
- `src/lib/storage.js` guarda `cropSuggestion` como metadato derivado y permite
  aceptarlo o rechazarlo sin alterar el original.
- `src/server.js`, `public/index.html` y `public/app.js` exponen la sugerencia
  en captura/importacion y en la revision de pagina.
- `tests/image-adjustments.test.js` y `tests/storage.test.js` cubren deteccion,
  aceptacion y rechazo.

### BS-P1-004 - Anadir enderezado simple reversible

Estado: `bloqueada`

Fuente roadmap: P1.6, recorte y enderezado asistidos.

Dependencias: `BS-P1-003`.

Objetivo: aplicar un ajuste simple de rotacion/enderezado reversible para mejorar OCR
y salida EPUB.

Criterios de aceptacion:

- El usuario puede aceptar, ajustar o revertir el enderezado.
- La captura original permanece intacta.
- El OCR puede marcarse como pendiente si el ajuste afecta al texto.

### BS-P1-005 - Aplicar recorte similar a rangos

Estado: `bloqueada`

Fuente roadmap: P1.6, recorte y enderezado asistidos.

Dependencias: `BS-P1-003`.

Objetivo: reutilizar un recorte en un rango de paginas para acelerar libros largos.

Criterios de aceptacion:

- El usuario selecciona un rango y confirma antes de aplicar.
- La operacion es reversible por pagina.
- No se aplican cambios sin confirmacion.

### BS-P1-006 - Comparar antes y despues del ajuste

Estado: `bloqueada`

Fuente roadmap: P1.6, recorte y enderezado asistidos.

Dependencias: `BS-P1-003`, `BS-P1-004`.

Objetivo: mostrar una comparacion visual antes/despues de recorte o enderezado.

Criterios de aceptacion:

- La UI permite comparar el ajuste antes de aceptarlo.
- El estado aceptado/rechazado queda claro.
- La comparacion no modifica la captura original.

### BS-P1-007 - Guardar diccionario local por libro

Estado: `bloqueada`

Fuente roadmap: P1.7, diccionario y correcciones recurrentes.

Dependencias: cierre del bloque P0 recomendado.

Objetivo: guardar vocabulario local asociado a un libro para mejorar revision textual.

Criterios de aceptacion:

- Cada libro puede tener un diccionario local editable.
- El diccionario no sale del equipo.
- Hay tests de persistencia.

### BS-P1-008 - Aplicar reemplazos recurrentes revisables

Estado: `bloqueada`

Fuente roadmap: P1.7, diccionario y correcciones recurrentes.

Dependencias: `BS-P1-007`.

Objetivo: aplicar reemplazos locales de forma revisable y no destructiva.

Criterios de aceptacion:

- El usuario define pares de reemplazo por libro.
- Puede previsualizar cambios antes de aplicarlos.
- La aplicacion por paginas seleccionadas queda cubierta por tests.

### BS-P1-009 - Revisar palabras sospechosas con atajos

Estado: `bloqueada`

Fuente roadmap: P1.7, diccionario y correcciones recurrentes.

Dependencias: `BS-P1-007`.

Objetivo: acelerar la revision de palabras dudosas con una cola y atajos de teclado.

Criterios de aceptacion:

- La app lista palabras sospechosas con contexto.
- El usuario puede aceptar o corregir con atajos.
- Los cambios siguen siendo editables.

### BS-P1-010 - Crear adaptadores OCR avanzados configurables

Estado: `bloqueada`

Fuente roadmap: P1.8, proveedores OCR avanzados configurables.

Dependencias: completar mejoras locales prioritarias de P0/P1.

Objetivo: desacoplar el OCR avanzado de un unico proveedor manteniendo local-first por
defecto.

Criterios de aceptacion:

- Hay al menos dos adaptadores configurables.
- Las claves no se exponen en navegador.
- Ningun envio externo ocurre sin confirmacion explicita.

### BS-P1-011 - Confirmar coste y privacidad del OCR avanzado

Estado: `bloqueada`

Fuente roadmap: P1.8, proveedores OCR avanzados configurables.

Dependencias: `BS-P1-010`.

Objetivo: mostrar coste/privacidad estimada antes de enviar paginas a OCR avanzado.

Criterios de aceptacion:

- El usuario ve una confirmacion clara por pagina o lote.
- La confirmacion indica que contenido saldra del equipo.
- El modo local sigue siendo el default.

### BS-P1-012 - Registrar procedencia del OCR avanzado

Estado: `bloqueada`

Fuente roadmap: P1.8, proveedores OCR avanzados configurables.

Dependencias: `BS-P1-010`.

Objetivo: guardar proveedor, modelo y estrategia de OCR en los metadatos de pagina.

Criterios de aceptacion:

- Cada resultado avanzado registra procedencia.
- La informacion aparece disponible para diagnostico y revision.
- No se guardan claves ni secretos.

## P1 - Biblioteca y continuidad

### BS-P1-013 - Calcular progreso de libros locales

Estado: `bloqueada`

Fuente roadmap: P1.9, dashboard de biblioteca local.

Dependencias: `BS-P0-001`; recomendado despues de completar P0 core.

Objetivo: calcular paginas, porcentaje revisado, ultima actualizacion, estado de
exportacion y problemas pendientes por libro.

Criterios de aceptacion:

- La libreria devuelve un resumen determinista por libro.
- Los problemas pendientes reutilizan el checklist.
- Hay tests con varios libros y estados.

### BS-P1-014 - Mostrar dashboard local de biblioteca

Estado: `bloqueada`

Fuente roadmap: P1.9, dashboard de biblioteca local.

Dependencias: `BS-P1-013`.

Objetivo: convertir la pantalla inicial en una vista de continuidad para elegir que
libro retomar.

Criterios de aceptacion:

- Al abrir la app, el usuario entiende que libro debe continuar y por que.
- Hay filtros por captura, revision, listo para exportar y exportado.
- La UI sigue siendo local y sin telemetria.

### BS-P1-015 - Persistir historial local de exportaciones

Estado: `bloqueada`

Fuente roadmap: P1.10, historial local de exportaciones.

Dependencias: `BS-P0-006`.

Objetivo: guardar un historial local de EPUBs generados por libro.

Criterios de aceptacion:

- Cada exportacion registra fecha, version, nombre de archivo, paginas/capitulos y
  advertencias activas.
- El historial no convierte el EPUB en fuente de verdad.
- Hay tests de persistencia.

### BS-P1-016 - Mostrar historial de exportaciones

Estado: `bloqueada`

Fuente roadmap: P1.10, historial local de exportaciones.

Dependencias: `BS-P1-015`.

Objetivo: mostrar exportaciones anteriores y permitir abrir la carpeta del artefacto
cuando el sistema lo permita.

Criterios de aceptacion:

- El libro muestra su historial de exportaciones.
- La UI indica version, fecha y advertencias.
- Si no se puede abrir carpeta local, muestra mensaje claro.

### BS-P1-017 - Editar metadatos EPUB ampliados

Estado: `bloqueada`

Fuente roadmap: P1.11, plantillas de metadatos y estilos EPUB.

Dependencias: `BS-P0-005`.

Objetivo: ampliar metadatos editables: coleccion, editorial, descripcion e
identificadores.

Criterios de aceptacion:

- Los nuevos campos se guardan por libro.
- El EPUB los incluye cuando corresponda.
- La previsualizacion de exportacion los muestra.

### BS-P1-018 - Anadir plantillas de estilo EPUB

Estado: `bloqueada`

Fuente roadmap: P1.11, plantillas de metadatos y estilos EPUB.

Dependencias: `BS-P0-005`.

Objetivo: ofrecer estilos controlados sin convertir BookSaver en maquetador complejo.

Criterios de aceptacion:

- Existen plantillas simple, clasico, compacto e imagen + texto.
- La eleccion se guarda por libro.
- El EPUB generado respeta la plantilla.

### BS-P1-019 - Previsualizar plantilla y modo de contenido

Estado: `bloqueada`

Fuente roadmap: P1.11, plantillas de metadatos y estilos EPUB.

Dependencias: `BS-P1-017`, `BS-P1-018`.

Objetivo: mostrar una previsualizacion corta de plantilla y modo de contenido antes
de exportar.

Criterios de aceptacion:

- El usuario ve una muestra antes de exportar.
- La muestra usa contenido real o sintetico seguro del libro actual.
- No genera EPUB para mostrar la previsualizacion.

## P2 - Distribucion robusta y soporte local

### BS-P2-001 - Decidir firma y notarizacion macOS

Estado: `decision`

Fuente roadmap: P2.12, firma/notarizacion e instalacion.

Dependencias: decision de distribucion publica y coste de certificados.

Objetivo: decidir cuando merece la pena firmar/notarizar paquetes macOS.

Criterios de aceptacion:

- Hay una nota documentada con coste, pasos y decision.
- No bloquea el MVP local mientras no sea necesario.

### BS-P2-002 - Mejorar instalacion inicial en Windows

Estado: `bloqueada`

Fuente roadmap: P2.12, firma/notarizacion e instalacion.

Dependencias: priorizacion de distribucion Windows.

Objetivo: hacer mas clara la apertura inicial en Windows para usuarios no tecnicos.

Criterios de aceptacion:

- El paquete ofrece acceso o arranque claro.
- Los errores comunes tienen mensajes en castellano.
- No requiere terminal para el flujo normal.

### BS-P2-003 - Guiar instalacion de Tesseract en Windows

Estado: `bloqueada`

Fuente roadmap: P2.12, firma/notarizacion e instalacion.

Dependencias: `BS-P2-002`.

Objetivo: mejorar la guia local para detectar o instalar Tesseract en Windows.

Criterios de aceptacion:

- La app explica que falta y como resolverlo.
- El diagnostico no envia datos fuera del equipo.
- El flujo sigue funcionando sin OCR si el usuario decide aplazarlo.

### BS-P2-004 - Anadir diagnostico OCR en primer arranque

Estado: `bloqueada`

Fuente roadmap: P2.12, firma/notarizacion e instalacion.

Dependencias: priorizacion de distribucion robusta.

Objetivo: mostrar compatibilidad OCR y acciones recomendadas en el primer arranque.

Criterios de aceptacion:

- El usuario ve motores detectados e idioma disponible.
- La pantalla no bloquea el uso basico de la app.
- Los mensajes estan en castellano.

### BS-P2-005 - Generar diagnostico local sanitizado

Estado: `bloqueada`

Fuente roadmap: P2.13, diagnostico local exportable.

Dependencias: `BS-P2-004`.

Objetivo: generar un reporte copiables para issues sin incluir contenido privado ni
rutas sensibles completas.

Criterios de aceptacion:

- El diagnostico incluye SO, version, motores OCR, idiomas y modo de instalacion.
- No incluye texto de libros, imagenes ni rutas completas.
- Hay tests de sanitizacion.

## P2 - Capacidades avanzadas

### BS-P2-006 - Detectar duplicados en importacion masiva

Estado: `bloqueada`

Fuente roadmap: P2.14, flujo de lotes para libros largos.

Dependencias: validar necesidad con libros largos reales.

Objetivo: marcar posibles duplicados durante importaciones masivas sin borrar nada.

Criterios de aceptacion:

- La app marca duplicados sospechosos.
- El usuario decide que conservar.
- No se elimina ninguna captura automaticamente.

### BS-P2-007 - Reordenar paginas en lote

Estado: `bloqueada`

Fuente roadmap: P2.14, flujo de lotes para libros largos.

Dependencias: validar necesidad con libros largos reales.

Objetivo: permitir reordenar multiples paginas por fecha, nombre o seleccion multiple.

Criterios de aceptacion:

- El usuario puede seleccionar varias paginas.
- Puede reordenar por fecha, por nombre o mediante arrastrar/soltar multiple.
- La operacion tiene confirmacion o deshacer claro.

### BS-P2-008 - Ejecutar acciones por rango de paginas

Estado: `bloqueada`

Fuente roadmap: P2.14, flujo de lotes para libros largos.

Dependencias: `BS-P2-007`.

Objetivo: ejecutar OCR, marcar revisado, recortar, rotar o exportar subconjunto por
rango de paginas.

Criterios de aceptacion:

- El usuario selecciona un rango y una accion.
- La app confirma antes de aplicar cambios.
- Las acciones conservan el principio no destructivo.

### BS-P2-009 - Validar alcance de contenido complejo

Estado: `decision`

Fuente roadmap: P2.15, soporte mejorado para contenido complejo.

Dependencias: ejemplos reales de libros con contenido complejo.

Objetivo: decidir que soporte merece prioridad para notas, imagenes, tablas, poemas,
preliminares y apendices.

Criterios de aceptacion:

- Hay una recomendacion documentada con ejemplos reales.
- La decision separa implementacion inmediata de trabajo aplazado.
- No se implementa complejidad sin validacion.

### BS-P2-010 - Disenar estructura de internacionalizacion

Estado: `bloqueada`

Fuente roadmap: P2.16, internacionalizacion progresiva.

Dependencias: decision de buscar usuarios fuera de Espana/LatAm.

Objetivo: preparar estructura tecnica minima para traducciones manteniendo castellano
como idioma principal.

Criterios de aceptacion:

- Existe una estructura clara para textos traducibles.
- La UI en castellano sigue funcionando.
- No se fuerza una traduccion completa del producto.

### BS-P2-011 - Alinear README ingles con el principal

Estado: `bloqueada`

Fuente roadmap: P2.16, internacionalizacion progresiva.

Dependencias: `BS-P2-010` o decision explicita de actualizar documentacion antes.

Objetivo: mantener el README ingles coherente con el README principal y el estado real
del producto.

Criterios de aceptacion:

- El README ingles no contradice el README principal.
- Resume capacidades y limitaciones actuales.
- Mantiene la promesa local-first.

### BS-P2-012 - Abrir EPUB en lector local

Estado: `bloqueada`

Fuente roadmap: P2.17, herramientas locales externas.

Dependencias: `BS-P0-006`.

Objetivo: permitir abrir el EPUB exportado en un lector local instalado cuando el
sistema lo permita.

Criterios de aceptacion:

- Tras exportar, el usuario puede intentar abrir el EPUB localmente.
- Si no hay lector compatible, recibe un mensaje claro.
- No se usa ningun servicio externo.

### BS-P2-013 - Integrar validacion externa opcional

Estado: `bloqueada`

Fuente roadmap: P2.17, herramientas locales externas.

Dependencias: `BS-P0-006`.

Objetivo: usar validadores locales externos si estan instalados, sin hacerlos requisito.

Criterios de aceptacion:

- La app detecta una herramienta compatible si existe.
- Puede ejecutarla opcionalmente y mostrar resultado.
- Si no existe, la exportacion sigue funcionando.

### BS-P2-014 - Exportar texto limpio por capitulos

Estado: `bloqueada`

Fuente roadmap: P2.17, herramientas locales externas.

Dependencias: `BS-P0-005`.

Objetivo: exportar texto limpio por capitulos para revision en editores externos.

Criterios de aceptacion:

- La app genera archivos locales con nombres comprensibles.
- El orden de capitulos coincide con la previsualizacion/exportacion.
- No sustituye el OCR editable como fuente de verdad.

## Notas de alineacion con el roadmap

- La lista cubre todos los bloques accionables del roadmap P0, P1 y P2.
- Se mantienen fuera de la cola las exclusiones explicitas: cuentas, cloud,
  telemetria, colaboracion en tiempo real, reescritura nativa completa y base de
  datos opaca.
- `BS-P1-010` a `BS-P1-012` se conservan como P1 porque estan en el roadmap, pero
  deben ejecutarse despues de las mejoras locales prioritarias para no romper la
  promesa local-first.
- Las tareas de contenido complejo y notarizacion son decisiones primero, no features
  directas, porque el propio roadmap las marca como riesgos de alcance.
