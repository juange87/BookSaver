# Roadmap de nuevas features de BookSaver

Última revisión: 2026-06-15

## Resumen ejecutivo

BookSaver ya tiene una base de producto sólida para un MVP local-first: permite crear libros, capturar o importar páginas, ejecutar OCR local, revisar texto, marcar estructura editorial y exportar EPUB3. La versión actual del repositorio está en `1.2.0` y el historial reciente muestra tres grandes bloques ya completados: captura móvil, mejora de fiabilidad OCR y empaquetado/actualización de releases.

El siguiente tramo del producto debería concentrarse en reducir fricción de revisión, aumentar la calidad de captura/OCR antes de exportar, y preparar una distribución más confiable para personas no técnicas, manteniendo los principios ya establecidos: datos locales, flujo no destructivo, EPUB como salida principal y ausencia de nube/telemetría por defecto.

## Trabajo ya realizado

### Producto y experiencia principal

- Interfaz web local con flujo de creación de libro, captura, revisión y exportación.
- Captura desde cámara del navegador.
- Captura desde móvil mediante URL temporal en la misma red local.
- Importación de fotos desde una carpeta local o bandeja de importación.
- Revisión página a página con texto OCR editable.
- Marcado editorial por página: partes, capítulos, página como imagen, cabecera de capítulo, fin de capítulo y portada.
- Recorte rectangular no destructivo por página.
- Exportación EPUB3 con navegación (`nav.xhtml`) e índice visible.
- Flujo de portada desde página del libro o imagen externa.
- Botón de reporte de errores hacia GitHub con datos básicos de soporte.

### OCR y calidad de texto

- OCR local con Apple Vision en macOS.
- Tesseract como motor compatible en Windows/Linux y fallback opcional.
- Selección de idioma OCR por libro.
- Reconstrucción básica de layout: párrafos, encabezados, saltos, guiones y bloques de lectura.
- Modo `local-improved` con perfiles locales.
- Modo `consensus` para doble motor cuando Apple Vision y Tesseract están disponibles.
- Modo `ai-advanced` opcional y explícito, con clave local y confirmación antes de enviar una página fuera del equipo.
- Persistencia de metadatos de OCR: proveedor, estrategia, confianza, puntuación de calidad, candidatos y necesidad de revisión.

### Persistencia y arquitectura local-first

- Datos reales fuera del repositorio, en la carpeta de datos del sistema:
  - macOS: `~/Library/Application Support/BookSaver`
  - Windows: `%LocalAppData%\BookSaver`
  - Linux: `~/.local/share/BookSaver` o `$XDG_DATA_HOME/BookSaver`
- Migración desde almacenamiento legado dentro del proyecto.
- Separación entre código de la app y biblioteca del usuario.
- Conservación de capturas originales.
- Generación de EPUB como artefacto, no como fuente de verdad.

### Distribución y mantenimiento

- Paquetes portables con runtime de Node incluido para macOS Apple Silicon, macOS Intel y Windows.
- Workflow de GitHub Actions para adjuntar paquetes a releases.
- Autoactualización guiada para instalaciones descargadas como ZIP cuando existe una release compatible.
- Scripts de arranque simples para macOS y Windows.
- README principal en castellano y README resumido en inglés.

### Calidad técnica observada

- Stack ligero: Node.js moderno con módulos ES nativos, servidor HTTP local y tests con `node:test`.
- Suite automatizada repartida en 13 archivos de test, cubriendo almacenamiento, EPUB, OCR, consenso OCR, captura móvil, autoactualización, settings, portapapeles y layout.
- Reglas de agente documentadas en `AGENTS.md`: local-first, sin nube/telemetría sin aprobación, copias portables y copy de interfaz en castellano.

## Principios para el roadmap

1. Mantener BookSaver como producto local-first: ninguna feature debe requerir cuentas, nube, analíticas ni sincronización remota para funcionar.
2. Reducir tiempo de corrección manual: priorizar ayudas de revisión, detección de problemas y mejoras de calidad antes de añadir formatos secundarios.
3. Proteger el material original: toda mejora de imagen/OCR debe ser reversible o regenerable.
4. Hacer la app más fácil para personas no técnicas: instalación, actualización, diagnóstico y recuperación deben ser guiados.
5. Evitar features que compliquen el MVP sin validar: colaboración en nube, marketplace, base de datos opaca o reescritura nativa completa no deberían entrar todavía.

## Roadmap priorizado

### P0 — Siguiente release: confianza antes de exportar

Objetivo: que el usuario sepa si su libro está listo antes de generar el EPUB y pueda corregir los problemas más importantes con menos esfuerzo.

#### 1. Checklist de preparación del libro

Crear una vista de estado del libro con señales claras:

- Páginas sin OCR.
- Páginas con OCR de baja confianza.
- Páginas no revisadas.
- Capítulos sin título.
- Saltos de parte/capítulo incoherentes.
- Falta de portada.
- Idioma OCR y metadatos básicos incompletos.

Valor: convierte la exportación en un flujo guiado en vez de depender de que el usuario revise manualmente cada página.

Criterio de aceptación sugerido:

- Antes de exportar, BookSaver muestra una lista accionable de advertencias y permite saltar directamente a la página problemática.

#### 2. Cola de revisión inteligente

Añadir una cola que ordene las páginas por prioridad de revisión:

1. OCR fallido o vacío.
2. OCR con baja confianza.
3. Páginas sin revisar.
4. Páginas con cambios estructurales pendientes.

Valor: reduce el tiempo necesario para revisar libros grandes.

Criterio de aceptación sugerido:

- El usuario puede pulsar “Siguiente problema” y avanzar por las páginas que más necesitan intervención.

#### 3. Validación EPUB previa y posterior

Mejorar la confianza del export:

- Previsualización del índice antes de exportar.
- Resumen de metadatos incluidos.
- Validación estructural del EPUB generado.
- Mensajes de error legibles si falta una imagen, portada o archivo interno.

Valor: evita que el primer control de calidad ocurra en Kindle/Kobo después de exportar.

Criterio de aceptación sugerido:

- Tras exportar, la app confirma ruta, tamaño, número de capítulos y estado de validación.

#### 4. Backups locales del proyecto de libro

Añadir exportación/importación de un “paquete BookSaver” local que incluya:

- Metadatos del libro.
- Capturas originales.
- OCR revisado.
- Layout y estructura editorial.
- Portada y recortes.

Valor: permite mover un proyecto entre equipos o hacer copia de seguridad sin introducir nube.

Criterio de aceptación sugerido:

- Un libro exportado como paquete local puede reimportarse y mantener páginas, texto revisado, portada y estructura.

### P1 — Mejorar captura y OCR asistido

Objetivo: elevar la calidad inicial de las páginas para que el usuario tenga que corregir menos.

#### 5. Control de calidad de captura

Añadir avisos automáticos durante captura/importación:

- Imagen borrosa.
- Página demasiado oscura.
- Bordes de página no detectables.
- Página girada.
- Reflejos o zonas quemadas.
- Resolución insuficiente.

Valor: corregir una foto mala en el momento es más barato que arreglar OCR después.

Criterio de aceptación sugerido:

- Al importar/capturar, BookSaver marca páginas sospechosas y explica la causa en castellano.

#### 6. Recorte y enderezado asistidos

Evolucionar el recorte manual hacia ayudas semiautomáticas:

- Detección inicial de bordes.
- Enderezado simple.
- Aplicar recorte similar a un rango de páginas.
- Comparación antes/después sin destruir la imagen original.

Valor: mejora OCR y estética del EPUB sin abandonar el principio no destructivo.

Criterio de aceptación sugerido:

- El usuario puede aceptar/rechazar un recorte sugerido y revertirlo en cualquier momento.

#### 7. Diccionario y correcciones recurrentes

Añadir herramientas de corrección textual pensadas para libros:

- Diccionario local por libro.
- Reemplazos recurrentes (“rn” → “m”, nombres propios, términos inventados).
- Lista de palabras sospechosas.
- Atajos de teclado para aceptar/corregir.

Valor: especialmente útil en novelas, libros antiguos o textos con nombres propios.

Criterio de aceptación sugerido:

- El usuario puede definir reemplazos locales y aplicarlos de forma revisable, no destructiva, a páginas seleccionadas.

#### 8. Proveedores OCR avanzados configurables

Generalizar el modo de IA avanzada para no depender de un único proveedor:

- Mantener OCR local como default.
- Permitir proveedores configurables bajo confirmación explícita por página o lote.
- Mostrar coste/privacidad estimada antes de enviar.
- Guardar procedencia del OCR en metadatos.

Valor: conserva la privacidad por defecto pero permite máxima calidad en páginas difíciles.

Criterio de aceptación sugerido:

- La app soporta al menos dos adaptadores configurables sin exponer claves en el navegador.

### P1 — Experiencia de biblioteca y continuidad

Objetivo: que BookSaver sea cómodo cuando el usuario ya tiene varios libros en marcha.

#### 9. Dashboard de biblioteca local

Crear una vista inicial con todos los libros y su progreso:

- Número de páginas.
- Porcentaje revisado.
- Última actualización.
- Estado de exportación.
- Problemas pendientes.
- Filtros por “en captura”, “en revisión”, “listo para exportar” y “exportado”.

Valor: convierte BookSaver en una biblioteca de proyectos, no solo en un editor de un libro cada vez.

Criterio de aceptación sugerido:

- Al abrir la app, el usuario entiende qué libro debe continuar y por qué.

#### 10. Historial local de exportaciones

Registrar exportaciones por libro:

- Fecha y versión de BookSaver.
- Nombre del archivo EPUB.
- Metadatos usados.
- Número de páginas/capítulos.
- Advertencias activas al exportar.

Valor: permite comparar versiones y saber qué se envió a un lector.

Criterio de aceptación sugerido:

- Cada libro muestra sus exportaciones anteriores y permite abrir la carpeta del artefacto.

#### 11. Plantillas de metadatos y estilos EPUB

Añadir personalización controlada:

- Autor, colección, editorial, idioma, descripción e identificadores.
- Plantillas de estilo: simple, clásico, compacto, imagen + texto.
- Opción de incluir página escaneada, texto limpio o ambos.

Valor: mejora el resultado final sin convertir BookSaver en un maquetador complejo.

Criterio de aceptación sugerido:

- El usuario puede elegir una plantilla y ver una previsualización corta antes de exportar.

### P2 — Distribución robusta para usuarios no técnicos

Objetivo: que instalar, actualizar y diagnosticar BookSaver sea tan simple como usarlo.

#### 12. Firma/notarización y experiencia de instalación

Mejorar confianza de paquetes:

- Firma y notarización de macOS cuando el proyecto esté listo para distribución pública.
- Instalador o acceso directo más claro en Windows.
- Pantalla de primer arranque con diagnóstico de OCR.
- Guía de instalación de Tesseract más automatizada en Windows.

Valor: reduce errores de instalación y avisos de seguridad que asustan a usuarios no técnicos.

Criterio de aceptación sugerido:

- Un usuario no técnico puede descargar, abrir y verificar compatibilidad OCR sin usar terminal.

#### 13. Diagnóstico local exportable

Añadir un reporte local de diagnóstico que el usuario pueda copiar al abrir una issue:

- Sistema operativo.
- Versión de BookSaver.
- Motores OCR detectados.
- Idiomas Tesseract instalados.
- Modo de instalación.
- Último error relevante, sin incluir contenido de libros ni rutas sensibles completas.

Valor: acelera soporte sin telemetría.

Criterio de aceptación sugerido:

- El usuario puede copiar un diagnóstico sanitizado desde `Compatibilidad y ayuda`.

### P2 — Capacidades avanzadas, solo después de validar el MVP

Objetivo: explorar crecimiento sin romper la simplicidad actual.

#### 14. Flujo de lotes para libros largos

- Importación masiva con detección de duplicados.
- Reordenación por fecha, nombre o arrastrar/soltar múltiple.
- Acciones por rango: OCR, marcar revisado, recortar, rotar, exportar subconjunto.

#### 15. Soporte mejorado para contenido complejo

- Notas al pie.
- Imágenes intercaladas.
- Tablas simples.
- Poemas o texto con saltos de línea significativos.
- Páginas preliminares y apéndices.

#### 16. Internacionalización progresiva

- Mantener castellano como idioma principal de la UI.
- Añadir estructura para traducciones si el proyecto busca usuarios fuera de España/LatAm.
- Alinear README inglés con el README principal.

#### 17. Integración con herramientas locales externas

- Apertura directa del EPUB en un lector local instalado.
- Validación opcional con herramientas externas si están disponibles.
- Exportación de texto limpio por capítulos para revisión en editores externos.

## Orden recomendado de ejecución

1. Checklist de preparación del libro.
2. Cola de revisión inteligente.
3. Validación EPUB previa/posterior.
4. Backup local del proyecto.
5. Control de calidad de captura.
6. Recorte/enderezado asistido.
7. Dashboard de biblioteca local.
8. Historial de exportaciones.
9. Diccionario y correcciones recurrentes.
10. Plantillas de metadatos y estilos EPUB.
11. Distribución robusta y diagnóstico local.
12. Capacidades avanzadas de lotes y contenido complejo.

## Métricas de éxito sugeridas

Estas métricas deben calcularse localmente y mostrarse al usuario o usarse en tests; no requieren telemetría remota.

- Porcentaje de páginas revisadas por libro.
- Número de advertencias pendientes antes de exportar.
- Tiempo estimado ahorrado por acciones de lote.
- Número de páginas con OCR de baja confianza.
- Exportaciones válidas generadas por libro.
- Reintentos de OCR por página y mejora de puntuación.

## Riesgos y decisiones pendientes

- IA/OCR avanzado: debe seguir siendo opt-in por página o por lote claramente confirmado.
- Calidad de captura: la detección automática puede dar falsos positivos; la UI debe permitir ignorar avisos.
- EPUB complejo: soportar tablas/notas al pie puede aumentar mucho la complejidad; conviene validarlo con libros reales antes de generalizar.
- Distribución pública: firma/notarización y Windows installer implican decisiones de coste, certificados y mantenimiento.
- Backups locales: deben evitar incluir exports generados innecesariamente o duplicar datos demasiado grandes sin avisar.

## Fuera de roadmap por ahora

- Cuentas de usuario y sincronización cloud.
- Analíticas o telemetría remota.
- Colaboración en tiempo real.
- Reescritura completa como app nativa.
- Base de datos opaca que sustituya la estructura editable en carpetas.
- Publicación o distribución de contenido protegido.

## Próximo paso recomendado

Convertir el bloque P0 en issues o tarjetas Kanban pequeñas. La primera feature a implementar debería ser el checklist de preparación del libro, porque usa datos que la app ya genera y desbloquea mejoras posteriores: cola inteligente, validación de exportación, dashboard de biblioteca e historial de calidad.
