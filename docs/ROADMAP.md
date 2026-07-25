# Roadmap de nuevas features de BookSaver

Última revisión: 2026-07-25

## Resumen ejecutivo

BookSaver ya cubre el MVP local-first para digitalizar libros físicos: crear
libros, capturar o importar páginas, ejecutar OCR local o avanzado bajo
confirmación, revisar texto, marcar estructura editorial, aplicar ajustes de
imagen no destructivos, gestionar una biblioteca local y exportar EPUB3.

La exploración del repositorio muestra que el roadmap anterior P0/P1 está
completado. El siguiente tramo ya no debería centrarse en "hacer posible" el
flujo principal, sino en ampliar los tipos de captura e importación que puede
absorber, hacer el OCR espacialmente revisable y ofrecer más salidas locales sin
perder las capturas originales.

La revisión exploratoria de 2026-07-25 prioriza dobles páginas, documentos
multipágina, PDF buscable y revisión OCR por regiones. Distribución pública,
firma/notarización e instaladores quedan aplazados por decisión de producto.

## Trabajo ya realizado

### Producto y experiencia principal

- Interfaz web local con vistas de biblioteca, captura, revisión y exportación.
- Captura desde cámara del navegador y captura móvil temporal en la misma red.
- Importación de fotos desde carpeta local o bandeja de entrada.
- Revisión página a página con texto OCR editable.
- Marcado editorial por página: partes, capítulos, página como imagen, cabecera
  de capítulo, fin de capítulo y portada.
- Reordenado básico de páginas una a una.
- Recorte, rotación y enderezado no destructivos por página.
- Exportación EPUB3 con navegación (`nav.xhtml`) e índice visible.
- Paquete local `.booksaver.zip` para mover o respaldar proyectos.
- Dashboard local de biblioteca con progreso, filtros e historial de exportación.
- Búsqueda local dentro del libro, marcadores por página, historial de texto y
  vista de lectura continua con salto al editor.
- Previsualización de importación masiva desde bandeja antes de retirar archivos
  de la carpeta origen.

### OCR, revisión y calidad

- OCR local con Apple Vision en macOS.
- Tesseract como motor compatible en Windows/Linux y fallback opcional.
- Modos OCR `local-improved`, `consensus` y `ai-advanced`.
- Adaptadores OCR avanzados configurables con clave local y confirmación explícita.
- Persistencia de procedencia OCR: estrategia, proveedor, modelo, confianza,
  candidatos y necesidad de revisión.
- Checklist de preparación antes de exportar.
- Cola de revisión inteligente con acción "Siguiente problema".
- Detección de calidad de captura y avisos ignorables.
- Detección de recorte sugerido, comparación antes/después y aplicación de
  recorte a rangos.
- Diccionario local por libro, reemplazos revisables y cola de palabras dudosas.

### Persistencia y arquitectura local-first

- Datos reales fuera del repositorio, en la carpeta de datos del sistema:
  - macOS: `~/Library/Application Support/BookSaver`
  - Windows: `%LocalAppData%\BookSaver`
  - Linux: `~/.local/share/BookSaver` o `$XDG_DATA_HOME/BookSaver`
- Migración desde almacenamiento legado dentro del proyecto.
- Separación entre código de la app y biblioteca del usuario.
- Conservación de capturas originales.
- Snapshots locales de recuperación y papelera local para páginas eliminadas.
- EPUBs y paquetes como artefactos, no como fuente de verdad.

### Distribución y mantenimiento

- Paquetes portables con runtime de Node incluido para macOS Apple Silicon,
  macOS Intel y Windows.
- Workflow de GitHub Actions para adjuntar paquetes a releases.
- Autoactualización guiada para instalaciones descargadas como ZIP.
- Scripts de arranque simples para macOS y Windows.
- README principal en castellano y README resumido en inglés.

### Calidad técnica observada

- Stack ligero: Node.js moderno con módulos ES nativos, servidor HTTP local y
  tests con `node:test`.
- Suite automatizada amplia en `tests/`, cubriendo almacenamiento, EPUB, OCR,
  consenso OCR, captura móvil, autoactualización, settings, portapapeles,
  dashboard, revisión textual y ajustes de imagen.
- Superficies grandes (`public/app.js`, `src/lib/storage.js`, `src/lib/epub.js`)
  que recomiendan añadir nuevas features como módulos pequeños y testeables.
- Reglas de agente documentadas en `AGENTS.md`: local-first, sin nube/telemetría
  sin aprobación, copias portables y copy de interfaz en castellano.

## Principios para el roadmap

1. Mantener BookSaver local-first: ninguna feature debe requerir cuentas, nube,
   analíticas ni sincronización remota para funcionar.
2. Proteger el trabajo del usuario: las acciones destructivas o masivas deben
   tener confirmación, snapshot, papelera o recuperación clara.
3. Reducir tiempo de revisión manual con navegación, búsqueda, marcadores,
   filtros y acciones por lotes verificables.
4. Preservar capturas originales; toda mejora de imagen/OCR debe ser reversible,
   derivada o regenerable.
5. Hacer la app más fácil para personas no técnicas: instalación, diagnóstico y
   recuperación deben ser guiados.
6. Evitar complejidad no validada: colaboración cloud, marketplace, base de datos
   opaca o reescritura nativa completa siguen fuera de alcance.

## Roadmap priorizado

### P0 — Recuperación local y seguridad del trabajo

Objetivo: que el usuario pueda experimentar, corregir y usar acciones masivas
sin miedo a perder horas de revisión.

#### 1. Snapshots locales antes de cambios de riesgo

Crear snapshots ligeros del proyecto antes de acciones destructivas o masivas:

- Borrado de página.
- Reordenado de páginas.
- Aplicación de recorte por rango.
- OCR por lote.
- Reemplazos recurrentes aplicados a varias páginas.
- Importación masiva desde carpeta.

Valor: protege el trabajo local sin introducir nube ni base de datos opaca.

Criterio de aceptación sugerido:

- Antes de una acción de riesgo, BookSaver guarda un snapshot local con metadatos,
  páginas, texto OCR y referencias a capturas originales, y lo muestra en el
  historial de recuperación.

#### 2. Restaurar snapshots locales

Permitir volver a un snapshot completo o inspeccionarlo antes de restaurar:

- Lista de snapshots por libro.
- Resumen de fecha, motivo, páginas afectadas y tamaño.
- Restauración confirmada del estado editable.
- Conservación de snapshots recientes con límite configurable o fijo.

Valor: convierte errores humanos en recuperables y hace más seguras las acciones
por lote.

Criterio de aceptación sugerido:

- Un snapshot creado antes de borrar o reordenar páginas puede restaurarse y
  recuperar orden, texto, portada y estructura.

#### 3. Papelera local de páginas borradas

Mover páginas eliminadas a una papelera del proyecto en vez de borrarlas al
instante:

- Restaurar página eliminada.
- Vaciar papelera con confirmación.
- Excluir papelera de EPUBs y paquetes por defecto.

Valor: resuelve el error más común de edición sin obligar a restaurar todo el
libro.

Criterio de aceptación sugerido:

- Al borrar una página, desaparece del libro activo pero puede restaurarse desde
  la papelera local mientras no se vacíe.

### P1 — Navegación y revisión textual más rápida

Objetivo: que revisar un libro largo sea más parecido a trabajar con un editor:
buscar, marcar, comparar y moverse por intención.

#### 4. Búsqueda global dentro del libro

Añadir búsqueda local en todo el OCR revisado:

- Buscar texto exacto en todas las páginas.
- Mostrar página, fragmento contextual y número de coincidencias.
- Saltar a la página y resaltar la primera coincidencia.
- Filtrar por páginas revisadas, pendientes o con aviso.

Valor: permite encontrar nombres, términos dudosos, capítulos y errores
recurrentes sin recorrer página por página.

Criterio de aceptación sugerido:

- El usuario busca una palabra y puede saltar desde cada resultado a la página
  correspondiente sin enviar texto fuera del equipo.

#### 5. Marcadores y etiquetas locales por página

Permitir marcar páginas con etiquetas de revisión:

- Favorito.
- Revisar después.
- Problema de OCR.
- Problema de imagen.
- Duda editorial.
- Nota breve local por página.

Valor: complementa la cola automática con intención humana y ayuda en sesiones
largas de revisión.

Criterio de aceptación sugerido:

- Una página puede tener etiquetas y nota local; la biblioteca y la lista de
  páginas permiten filtrar por esas marcas.

#### 6. Historial de texto y OCR por página

Guardar revisiones de texto cuando se sobrescribe OCR o se aplican cambios
masivos:

- Versión anterior del texto.
- Origen del cambio: OCR, edición manual, reemplazo, palabra dudosa.
- Comparación sencilla antes/después.
- Restaurar texto de una versión anterior sin tocar la imagen original.

Valor: permite probar OCR avanzado o reemplazos grandes sin perder una corrección
manual buena.

Criterio de aceptación sugerido:

- Después de releer OCR en una página editada, BookSaver conserva la versión
  anterior y permite restaurarla.

#### 7. Vista de lectura continua revisable

Crear una vista de lectura del libro completo antes de exportar:

- Lectura por capítulos usando el mismo orden que el EPUB.
- Indicadores de página original y saltos de capítulo.
- Salto rápido a la página editable.
- Avisos visibles cuando una página está pendiente o usa imagen.

Valor: captura errores de ritmo, capítulos y texto que no se ven en la edición
aislada página a página.

Criterio de aceptación sugerido:

- El usuario puede leer una previsualización continua local y saltar desde un
  fragmento al editor de la página correspondiente.

#### 8. Exportar texto limpio por capítulos

Estado actual: implementada.

Generar archivos locales de texto o Markdown por capítulo:

- Nombres de archivo comprensibles y ordenados.
- Separación por capítulos igual a la previsualización/exportación EPUB.
- Exclusión de páginas marcadas como imagen pura, salvo nota explícita.
- Historial local de exportación auxiliar.

Valor: permite revisar en editores externos sin sustituir el OCR editable como
fuente de verdad.

Criterio de aceptación sugerido:

- BookSaver genera una carpeta con capítulos `.txt` o `.md` y el orden coincide
  con la navegación EPUB prevista.

Evidencia actual:

- La app genera `exports/texto-limpio/` con archivos `.txt` numerados por
  capítulo desde el mismo modelo de navegación que usa EPUB.
- Las páginas marcadas como imagen pura no se vuelcan como texto.
- El historial local distingue esta exportación auxiliar de los EPUBs y no
  cambia el OCR editable como fuente de verdad.

### P1 — Importación y lotes para libros largos

Objetivo: mejorar el flujo cuando el usuario trabaja con cientos de fotos.

#### 9. Previsualización de importación masiva

Estado actual: implementada.

Antes de mover archivos desde la bandeja, mostrar una previsualización:

- Archivos detectados y orden esperado.
- Posibles duplicados.
- Archivos no soportados.
- Fechas de captura cuando existan.
- Confirmación antes de retirar archivos de la carpeta origen.

Valor: evita sorpresas al importar sesiones grandes desde móvil o cámara.

Criterio de aceptación sugerido:

- El usuario puede revisar qué se importará y cancelar sin modificar la bandeja.

Evidencia actual:

- `GET /api/projects/:id/inbox/preview` devuelve candidatos ordenados, fechas,
  tamaño y archivos no soportados sin mover la carpeta origen.
- La UI de captura separa "Revisar carpeta" de "Importar" y permite cancelar la
  previsualización.
- `tests/storage.test.js` cubre escaneo seco y confirmación usando los mismos
  IDs de candidatos.

#### 10. Detección de duplicados más visible

Estado actual: implementada.

Convertir el salto silencioso de duplicados en una ayuda explícita:

- Duplicados exactos por huella.
- Duplicados sospechosos por nombre/tamaño/fecha cercana.
- Acción "ignorar", "importar de todos modos" o "ver página existente".

Valor: evita páginas repetidas sin borrar nada automáticamente.

Criterio de aceptación sugerido:

- Durante importación masiva, los duplicados aparecen como decisiones visibles
  y ninguna captura se elimina sin confirmación.

Evidencia actual:

- La previsualización de bandeja marca duplicados exactos por huella local y
  posibles duplicados por nombre, tamaño o fecha cercana.
- La UI permite ignorar la candidata, importarla de todos modos o saltar a la
  página existente.
- La importación no retira archivos duplicados saltados; sólo limpia la carpeta
  origen cuando una imagen se importa realmente.
- `tests/storage.test.js` cubre duplicados exactos, sospechosos e importación
  explícita de un duplicado.

#### 11. Reordenado múltiple de páginas

Estado actual: implementada.

Ampliar el reordenado actual de una página a selección múltiple:

- Selección de varias páginas.
- Mover al inicio, al final, antes/después de otra página.
- Ordenar por fecha de captura o nombre de archivo cuando existan.
- Snapshot previo automático.

Valor: acelera la limpieza de sesiones de captura desordenadas.

Criterio de aceptación sugerido:

- El usuario selecciona varias páginas, las mueve en bloque y puede recuperar el
  orden anterior mediante snapshot.

Evidencia actual:

- La lista de páginas permite seleccionar varias capturas visibles y moverlas al
  inicio, final, antes o después de una página de referencia.
- La app puede ordenar todas las páginas por fecha de captura o nombre de
  archivo cuando esos datos existen.
- Cada reordenado confirmado reutiliza `reorderPages`, que crea snapshot local
  antes de escribir el nuevo orden.
- `tests/page-batch-reorder.test.js` cubre cálculo de orden por selección,
  referencia, fecha y nombre.

#### 12. Acciones por rango de páginas

Estado actual: implementada.

Generalizar el patrón de recorte por rango a más acciones:

- OCR por rango.
- Marcar revisadas/no revisadas por rango.
- Rotar por rango.
- Aplicar o limpiar etiquetas por rango.
- Exportar subconjunto local para revisión.

Valor: reduce trabajo repetitivo en libros largos sin sacrificar confirmación ni
recuperación.

Criterio de aceptación sugerido:

- El usuario elige rango, acción y confirmación; BookSaver muestra cuántas
  páginas cambiarán y crea snapshot antes de aplicar.

Evidencia actual:

- El editor incluye un panel de acciones por rango para OCR local, marcar
  revisadas, rotar, aplicar recorte y exportar un EPUB parcial.
- Las acciones persistentes por rango pasan por confirmación y snapshots locales
  (`mark-reviewed-range`, `rotate-range` o `crop-range`).
- La exportación EPUB acepta `fromPage/toPage` y genera archivos con sufijo
  `paginas-X-Y`.
- `tests/storage.test.js` cubre marcado, rotación y exportación parcial por
  rango.

### P4 — Distribución pública aplazada

La firma/notarización de macOS, el instalador Windows, la guía específica de
Tesseract en Windows y el diagnóstico de primer arranque no son prioritarios en
este ciclo. Se conservan para reactivarlos solo cuando exista una decisión
explícita de distribuir a usuarios no técnicos.

#### 13. Firma/notarización y experiencia de instalación

- Decidir coste y momento de firma/notarización macOS.
- Preparar un acceso inicial claro en Windows.
- Guiar la instalación local de Tesseract.
- Mostrar compatibilidad OCR sin exigir terminal.

#### 14. Diagnóstico local exportable

- Sistema operativo y versión de BookSaver.
- Motores e idiomas OCR detectados.
- Modo de instalación y último error relevante.
- Exclusión estricta de texto de libros y rutas sensibles.

### P2 — Herramientas locales externas

Objetivo: integrarse con herramientas del equipo del usuario sin depender de
servicios externos.

#### 15. Abrir EPUB en lector local

Estado actual: implementada.

- Tras exportar, intentar abrir el EPUB con la app local asociada.
- Mostrar mensaje claro si el sistema no tiene lector compatible.
- No usar servicios externos ni rutas hardcodeadas.

Evidencia actual:

- El historial de exportaciones y el dialogo de resultado permiten abrir el EPUB
  con la aplicacion local asociada.
- El backend usa comandos locales (`open`, `explorer.exe`, `xdg-open`) y no
  contacta servicios externos.
- Si el sistema no puede abrir el archivo, la app devuelve un mensaje accionable
  sobre instalar o asociar un lector EPUB.

#### 16. Validación externa opcional

Estado actual: implementada.

- Detectar validadores locales instalados si existen.
- Ejecutarlos de forma opcional.
- Mostrar resultado junto a la validación interna.

Evidencia actual:

- BookSaver detecta `epubcheck` local mediante `--version`.
- El historial de exportaciones permite ejecutar la validación externa bajo
  demanda y muestra el último resultado sin bloquear exportaciones.
- Si EPUBCheck no existe o no está en `PATH`, la exportación sigue funcionando y
  el usuario recibe un mensaje claro.

#### 17. Exportaciones auxiliares locales

- Texto limpio por capítulos.
- Manifiesto JSON de estructura del libro.
- Copia de portada ajustada.

### P0 — Nuevo ciclo: entradas reales de libros

Objetivo: aceptar capturas y documentos que hoy requieren preparación manual
fuera de BookSaver.

#### 18. Detectar y dividir capturas de doble página

Añadir un flujo no destructivo para fotografías que contienen las dos páginas de
un libro abierto:

- Detectar candidatos por proporción, márgenes y posible canal central.
- Previsualizar las mitades izquierda y derecha antes de confirmar.
- Permitir corregir manualmente la línea de división.
- Crear dos páginas derivadas conservando la captura doble original.
- Elegir el orden de lectura según la dirección del libro.

Valor: reduce a la mitad las capturas necesarias cuando se fotografía un libro
abierto y evita preparar imágenes externamente.

Criterio de aceptación sugerido:

- Una captura doble puede convertirse en dos páginas ordenadas y restaurables
  sin modificar ni eliminar el archivo original.

#### 19. Importar PDF y TIFF multipágina

Extender la previsualización de importación:

- Aceptar PDF de imagen, PDF con capa de texto y TIFF multipágina.
- Mostrar número de páginas, tamaño estimado y orden antes de importar.
- Extraer cada página como captura original o derivado reproducible.
- Reutilizar texto existente solo después de mostrar su procedencia.
- Cancelar sin escribir datos parciales.

Valor: permite continuar proyectos provenientes de escáneres, archivos antiguos
o aplicaciones móviles sin convertir cada página manualmente.

Criterio de aceptación sugerido:

- Un PDF o TIFF multipágina se importa en orden, conserva el documento fuente y
  deja trazable qué páginas y texto se derivaron de él.

### P1 — OCR espacial y revisión visual

Objetivo: relacionar cada corrección de texto con la zona exacta de la captura.

#### 20. Persistir geometría y confianza del OCR

Normalizar una representación portable de bloques, líneas y palabras:

- Coordenadas relativas a la imagen original o a la variante aplicada.
- Confianza por palabra o línea cuando el motor la proporcione.
- Motor, variante y fecha que originaron la geometría.
- Migración segura para páginas que solo tienen texto plano.
- Exclusión de claves, datos temporales y rutas absolutas.

Valor: crea una base común para superponer OCR, revisar regiones y exportar
formatos espaciales sin acoplar el proyecto a Tesseract o Apple Vision.

Criterio de aceptación sugerido:

- Una página conserva texto y cajas OCR portables después de cerrar y volver a
  abrir el proyecto, sin alterar la captura original.

#### 21. Superponer OCR y releer una región

Construir sobre la geometría persistida:

- Mostrar bloques o palabras sobre la imagen con un modo activable.
- Resaltar zonas de baja confianza.
- Seleccionar un rectángulo y ejecutar OCR local solo sobre esa región.
- Previsualizar el reemplazo antes de aplicarlo.
- Guardar historial de texto y snapshot cuando el cambio afecte a varias líneas.

Valor: evita releer una página completa y perder correcciones buenas por un error
localizado.

Criterio de aceptación sugerido:

- El usuario selecciona una zona dudosa, compara el resultado local y decide si
  sustituye únicamente el texto asociado.

#### 22. Sugerir estructura editorial desde el layout

Usar reglas locales explicables para proponer, no aplicar automáticamente:

- Cabeceras de capítulo por tamaño, centrado, separación y posición.
- Números de página y cabeceras repetidas que conviene excluir.
- Párrafos, versos o bloques que requieren conservar saltos.
- Inicio de preliminares, apéndices o partes como candidatos.
- Aceptación individual o por rango con previsualización.

Valor: aprovecha información espacial ya calculada para reducir marcado manual
sin introducir un modelo remoto ni decisiones opacas.

Criterio de aceptación sugerido:

- Cada sugerencia muestra la regla que la produjo y solo modifica estructura
  después de confirmación.

#### 23. Investigar corrección de perspectiva y curvatura

Antes de implementar una transformación compleja:

- Reunir capturas propias o de dominio público con perspectiva trapezoidal,
  curvatura junto al lomo y luz desigual.
- Comparar corrección por cuatro puntos, malla manual y detección automática.
- Medir mejora OCR, artefactos y tiempo de interacción.
- Definir un formato de transformación derivada y reversible.

Valor: el enderezado angular actual no corrige la deformación propia de páginas
fotografiadas en libros gruesos.

Criterio de decisión sugerido:

- Un informe recomienda una primera versión concreta o documenta por qué debe
  seguir fuera de alcance.

### P1 — Nuevas salidas locales y fiabilidad

Objetivo: reutilizar el mismo proyecto editable para lectura, archivo y
diagnóstico sin convertir los artefactos en fuente de verdad.

#### 24. Exportar PDF buscable y PDF/A opcional

Añadir una salida que conserve la apariencia de las páginas:

- Imagen visible por página y capa de texto buscable alineada.
- Metadatos, idioma y orden compartidos con EPUB.
- PDF estándar como salida base.
- PDF/A solo cuando una herramienta local compatible pueda validarlo.
- Resumen de validación e historial de exportación.

Valor: complementa EPUB con un formato de facsímil útil para archivo, impresión y
búsqueda.

Criterio de aceptación sugerido:

- El PDF permite buscar texto y mantiene el orden y las imágenes del proyecto;
  la ausencia de herramientas PDF/A no bloquea la exportación estándar.

#### 25. Comprobar integridad y reparar índices locales

Añadir una inspección de salud del proyecto:

- Detectar imágenes, OCR o metadatos referenciados que falten.
- Detectar carpetas huérfanas y artefactos temporales interrumpidos.
- Verificar que los originales requeridos por snapshots y papelera existen.
- Proponer reparaciones conservadoras con snapshot previo.
- Generar un informe sin texto privado ni rutas completas.

Valor: hace visible la corrupción parcial antes de exportar o restaurar y refuerza
la promesa local-first.

Criterio de aceptación sugerido:

- Un proyecto manipulado en tests produce hallazgos deterministas y ninguna
  reparación destructiva se aplica sin confirmación.

#### 26. Asistente de accesibilidad EPUB

Ampliar el checklist de exportación con:

- Idioma de publicación y títulos descriptivos.
- Orden de lectura y jerarquía de encabezados.
- Navegación por páginas cuando se conserven números impresos.
- Texto alternativo o marcado decorativo para imágenes.
- Metadatos de accesibilidad solo cuando estén respaldados por el contenido.

Valor: ayuda a generar EPUB más navegables y evita declarar accesibilidad que no
se ha comprobado.

Criterio de aceptación sugerido:

- El checklist distingue errores, recomendaciones y afirmaciones que requieren
  revisión humana antes de añadir metadatos de accesibilidad.

### P2 — Productividad opcional

Objetivo: acelerar sesiones largas después de validar las bases anteriores.

#### 27. Captura automática cuando la página esté estable

Prototipar en el navegador:

- Medir movimiento, nitidez y estabilidad durante unos fotogramas.
- Mostrar cuenta atrás cancelable antes de capturar.
- Evitar duplicados cuando no se detecte un cambio de página suficiente.
- Mantener siempre un modo manual y procesar localmente los fotogramas.

Valor: permite sujetar y pasar páginas sin tocar el teclado o el teléfono en cada
captura.

Criterio de decisión sugerido:

- El prototipo mide falsos positivos y consumo en escritorio y móvil antes de
  convertirse en feature estable.

#### 28. Exportar OCR espacial interoperable

Cuando exista geometría normalizada:

- Exportar hOCR como primera salida portable.
- Evaluar ALTO XML solo si hay un consumidor real.
- Incluir resolución, cajas, confianza y referencia a la captura.
- Validar XML/HTML y no incluir rutas absolutas.

Valor: permite continuar investigación, archivo o corrección en herramientas
externas sin sustituir el formato editable de BookSaver.

Criterio de aceptación sugerido:

- La exportación hOCR representa el mismo texto, orden y coordenadas que la
  revisión visual de BookSaver.

### P3 — Exploración aplazada

Objetivo: mantener visibles ideas que necesitan muestras o una decisión de
producto, sin mezclarlas con la cola ejecutable.

#### 29. Soporte mejorado para contenido complejo

- Notas al pie.
- Imágenes intercaladas.
- Tablas simples.
- Poemas o texto con saltos de línea significativos.
- Páginas preliminares y apéndices.

Primero debe reunirse un conjunto pequeño de libros reales y documentar qué
casos justifican implementación. Parte de esta exploración puede apoyarse en la
geometría OCR y las sugerencias de estructura de los puntos 20 y 22.

#### 30. Internacionalización progresiva

- Mantener castellano como idioma principal de la UI.
- Diseñar una estructura mínima para textos traducibles solo si se busca público
  fuera de España/LatAm.
- Alinear README inglés con el README principal cuando cambie la promesa de
  producto.

## Fuentes de la exploración 2026-07-25

La investigación tomó como referencias primarias:

- [ScanTailor Advanced](https://github.com/4lex4/scantailor-advanced), que
  consolida división de páginas, selección de contenido, corrección de
  curvatura, procesamiento por lotes y revisión visual de desviaciones.
- [OCRmyPDF](https://ocrmypdf.readthedocs.io/en/stable/), que documenta PDF
  buscable, PDF/A opcional y pasos derivados como rotación, limpieza y
  enderezado, manteniendo separados original y resultado.
- [Formatos de salida de Tesseract](https://tesseract-ocr.github.io/tessdoc/Command-Line-Usage.html),
  que incluyen PDF buscable, TSV y hOCR con cajas y confianza.
- [EPUB Accessibility 1.1](https://www.w3.org/TR/epub-a11y-11/), recomendación
  W3C sobre navegación, metadatos y conformidad accesible.
- [Guías de preservación de la Library of Congress](https://www.loc.gov/preservation/care/scan.html),
  que refuerzan minimizar presión y manipulación del libro durante la captura.

Estas referencias no implican copiar sus arquitecturas ni añadir dependencias
obligatorias. Sirven para identificar patrones maduros que BookSaver puede
adaptar a su modelo local, reversible y basado en carpetas.

## Orden recomendado de ejecución

1. Detectar capturas dobles y previsualizar su división (`BS-P3-001`).
2. Implementar la división no destructiva (`BS-P3-002`).
3. Elegir el extractor e implementar importación PDF/TIFF multipágina
   (`BS-P3-003` y `BS-P3-004`).
4. Persistir geometría OCR (`BS-P3-005`) y usarla en revisión por regiones
   (`BS-P3-006`).
5. Desarrollar en paralelo el PDF buscable (`BS-P3-007` y `BS-P3-008`) y la
   comprobación de integridad local (`BS-P3-009`).
6. Añadir accesibilidad EPUB y sugerencias editoriales cuando sus bases estén
   estables.
7. Ejecutar como prototipos medidos, no como features comprometidas, curvatura y
   captura automática.

## Métricas de éxito sugeridas

Estas métricas deben calcularse localmente y mostrarse al usuario o usarse en
tests; no requieren telemetría remota.

- Porcentaje de páginas revisadas por libro.
- Número de advertencias pendientes antes de exportar.
- Número de snapshots disponibles y última acción recuperable.
- Tiempo estimado ahorrado por acciones de lote.
- Número de páginas con OCR de baja confianza.
- Exportaciones válidas generadas por libro.
- Reintentos de OCR por página y mejora de puntuación.
- Coincidencias resueltas mediante búsqueda o etiquetas.
- Capturas dobles divididas sin corrección posterior.
- Regiones releídas sin sobrescribir correcciones ajenas a la selección.
- Documentos multipágina importados sin preparación externa.
- PDFs buscables generados y validados localmente.
- Proyectos con comprobación de integridad sin hallazgos críticos.

## Riesgos y decisiones pendientes

- Recuperación: los snapshots no deben duplicar capturas completas si basta con
  referenciarlas; hay que controlar tamaño y política de retención.
- Acciones por lote: deben crear snapshot previo y explicar el alcance antes de
  aplicar cambios.
- Búsqueda: debe trabajar sobre OCR local y no convertirse en indexación opaca o
  servicio persistente innecesario.
- IA/OCR avanzado: debe seguir siendo opt-in por página o lote claramente
  confirmado.
- Geometría OCR: toda coordenada debe indicar qué variante y transformación de
  imagen usa para no superponer cajas desplazadas.
- División y corrección geométrica: los resultados son derivados; la captura
  original y la línea o malla usada deben conservarse.
- Importación multipágina: PDF puede contener texto o imágenes ya procesadas; la
  procedencia debe ser visible y nunca confundirse con revisión manual.
- PDF/PDF-A: PDF buscable puede ser interno, pero PDF/A debe declararse solo si
  pasa una validación local compatible.
- EPUB complejo: soportar tablas/notas al pie puede aumentar mucho la
  complejidad; conviene validarlo con libros reales antes de generalizar.
- Accesibilidad: no añadir afirmaciones de conformidad automáticas que requieran
  evaluación humana.
- Distribución pública: queda aplazada; firma/notarización e instaladores implican
  coste, certificados y mantenimiento.

## Fuera de roadmap por ahora

- Cuentas de usuario y sincronización cloud.
- Analíticas o telemetría remota.
- Colaboración en tiempo real.
- Reescritura completa como app nativa.
- Base de datos opaca que sustituya la estructura editable en carpetas.
- Publicación o distribución de contenido protegido.

## Próximo paso recomendado

Empezar por la detección y previsualización de capturas de doble página
(`BS-P3-001`). Es una mejora visible, acotada y reversible que aprovecha el
sistema existente de importación, ajustes de imagen y snapshots sin exigir una
nueva dependencia externa.
