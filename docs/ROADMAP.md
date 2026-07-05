# Roadmap de nuevas features de BookSaver

Última revisión: 2026-07-05

## Resumen ejecutivo

BookSaver ya cubre el MVP local-first para digitalizar libros físicos: crear
libros, capturar o importar páginas, ejecutar OCR local o avanzado bajo
confirmación, revisar texto, marcar estructura editorial, aplicar ajustes de
imagen no destructivos, gestionar una biblioteca local y exportar EPUB3.

La exploración del repositorio muestra que el roadmap anterior P0/P1 está
prácticamente completado. El siguiente tramo ya no debería centrarse en
"hacer posible" el flujo principal, sino en hacerlo más seguro y rápido para
libros reales largos: recuperación ante errores, búsqueda y navegación textual,
marcadores de revisión, historial de cambios, exportaciones auxiliares locales
y lotes mejor guiados.

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

### P2 — Distribución robusta para usuarios no técnicos

Objetivo: que instalar, actualizar y diagnosticar BookSaver sea tan simple como
usar el flujo principal.

#### 13. Firma/notarización y experiencia de instalación

Mejorar confianza de paquetes:

- Decidir coste y momento de firma/notarización macOS.
- Instalador o acceso directo más claro en Windows.
- Guía local para Tesseract en Windows.
- Pantalla de primer arranque con diagnóstico OCR.

Valor: reduce errores de instalación y avisos de seguridad que asustan a usuarios
no técnicos.

Criterio de aceptación sugerido:

- Un usuario no técnico puede descargar, abrir y verificar compatibilidad OCR sin
  usar terminal.

#### 14. Diagnóstico local exportable

Añadir un reporte local de diagnóstico que el usuario pueda copiar al abrir una
issue:

- Sistema operativo.
- Versión de BookSaver.
- Motores OCR detectados.
- Idiomas Tesseract instalados.
- Modo de instalación.
- Último error relevante, sin incluir contenido de libros ni rutas sensibles
  completas.

Valor: acelera soporte sin telemetría.

Criterio de aceptación sugerido:

- El usuario puede copiar un diagnóstico sanitizado desde `Compatibilidad y ayuda`.

### P2 — Herramientas locales externas

Objetivo: integrarse con herramientas del equipo del usuario sin depender de
servicios externos.

#### 15. Abrir EPUB en lector local

- Tras exportar, intentar abrir el EPUB con la app local asociada.
- Mostrar mensaje claro si el sistema no tiene lector compatible.
- No usar servicios externos ni rutas hardcodeadas.

#### 16. Validación externa opcional

- Detectar validadores locales instalados si existen.
- Ejecutarlos de forma opcional.
- Mostrar resultado junto a la validación interna.

#### 17. Exportaciones auxiliares locales

- Texto limpio por capítulos.
- Manifiesto JSON de estructura del libro.
- Copia de portada ajustada.

### P3 — Exploración con validación previa

Objetivo: decidir con ejemplos reales antes de añadir complejidad editorial o de
mercado.

#### 18. Soporte mejorado para contenido complejo

- Notas al pie.
- Imágenes intercaladas.
- Tablas simples.
- Poemas o texto con saltos de línea significativos.
- Páginas preliminares y apéndices.

Primero debe reunirse un conjunto pequeño de libros reales y documentar qué
casos justifican implementación.

#### 19. Internacionalización progresiva

- Mantener castellano como idioma principal de la UI.
- Diseñar una estructura mínima para textos traducibles solo si se busca público
  fuera de España/LatAm.
- Alinear README inglés con el README principal cuando cambie la promesa de
  producto.

## Orden recomendado de ejecución

1. Snapshots locales antes de cambios de riesgo.
2. Restaurar snapshots locales.
3. Papelera local de páginas borradas.
4. Búsqueda global dentro del libro.
5. Marcadores y etiquetas locales por página.
6. Historial de texto y OCR por página.
7. Vista de lectura continua revisable.
8. Exportar texto limpio por capítulos.
9. Previsualización de importación masiva.
10. Detección de duplicados más visible.
11. Reordenado múltiple de páginas.
12. Acciones por rango de páginas.
13. Diagnóstico local exportable.
14. Mejoras de instalación Windows/macOS.

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

## Riesgos y decisiones pendientes

- Recuperación: los snapshots no deben duplicar capturas completas si basta con
  referenciarlas; hay que controlar tamaño y política de retención.
- Acciones por lote: deben crear snapshot previo y explicar el alcance antes de
  aplicar cambios.
- Búsqueda: debe trabajar sobre OCR local y no convertirse en indexación opaca o
  servicio persistente innecesario.
- IA/OCR avanzado: debe seguir siendo opt-in por página o lote claramente
  confirmado.
- EPUB complejo: soportar tablas/notas al pie puede aumentar mucho la
  complejidad; conviene validarlo con libros reales antes de generalizar.
- Distribución pública: firma/notarización y Windows installer implican coste,
  certificados y mantenimiento.

## Fuera de roadmap por ahora

- Cuentas de usuario y sincronización cloud.
- Analíticas o telemetría remota.
- Colaboración en tiempo real.
- Reescritura completa como app nativa.
- Base de datos opaca que sustituya la estructura editable en carpetas.
- Publicación o distribución de contenido protegido.

## Próximo paso recomendado

Empezar por snapshots locales (`BS-P2-015`) antes de cualquier otra mejora
masiva. Es la pieza que reduce riesgo para papelera, restauración, reordenado
múltiple, OCR por rango y reemplazos amplios.
