# Rediseño de la Vista Editar con Inspector Lateral

Fecha: 2026-07-06

## Contexto

La vista Editar acumula muchas herramientas en una misma superficie: lista de
páginas, acciones por rango, búsqueda, visor de imagen, recorte, rotación, OCR,
texto, vista EPUB, diccionario, palabras dudosas, marcadores, historial y
estructura EPUB. Esto hace que controles editoriales importantes, como `Fin de
capítulo`, queden escondidos dentro de una pestaña secundaria.

El rediseño se centra en ordenar la revisión editorial de una página. La pantalla
Capturar y el problema de URL local para iPhone quedan fuera de esta iteración y
deben tratarse como una tarea posterior.

## Objetivo

Reorganizar la vista Editar para que la página seleccionada tenga tres zonas
claras:

1. Navegación del libro a la izquierda.
2. Trabajo principal en el centro.
3. Inspector de página a la derecha.

El inspector debe hacer visible y predecible la edición de estructura EPUB,
incluido `Fin de capítulo`, sin esconderla detrás de pestañas.

## Diseño Aprobado

### Navegación Del Libro

La columna izquierda conserva:

- Lista de páginas.
- Filtros por marcadores.
- Índice EPUB.
- Portada.
- Acciones de reordenado en lote cuando corresponda.

Esta zona sirve para moverse por el libro y entender la posición de la página
actual.

### Trabajo Principal

La zona central se dedica a revisar la página seleccionada:

- Imagen de la página.
- Controles de imagen: recorte, rotación, enderezado, comparación y eliminación.
- Texto OCR editable.
- Vista EPUB de la página.
- Acción de guardar texto cerca del editor.

Las acciones por rango y la búsqueda local bajan de jerarquía visual. Deben
pasar a una banda compacta o panel plegable para no competir con la revisión de
la página actual.

### Inspector De Página

El inspector derecho es permanente en escritorio y se apila debajo del trabajo
principal en pantallas pequeñas.

Tiene un bloque fijo arriba:

- Página revisada.
- Tipo de página: texto o imagen.
- Número o posición de página.
- Resumen de avisos activos.
- Estado básico de cambios pendientes solo si puede calcularse con el estado de
  UI existente, sin añadir rutas ni persistencia nueva.

Debajo usa acordeones. El acordeón `Estructura EPUB` queda abierto por defecto y
contiene:

- Inicio de parte.
- Nombre de parte.
- Inicio de capítulo.
- Nombre de capítulo.
- Fin de capítulo.
- Cabecera del capítulo.

El resto de secciones quedan cerradas por defecto:

- Calidad y ajustes.
- Marcadores y notas.
- Diccionario y palabras dudosas.
- Historial de texto.

## Componentes

La implementación debería extraer estructura visual sin introducir framework
nuevo:

- `editor-workspace`: grid principal de la vista Editar.
- `page-inspector`: nueva columna derecha.
- `page-inspector-summary`: estado fijo de la página.
- `page-inspector-section`: acordeón reutilizable.
- Reubicación de controles existentes desde `structurePane`, marcadores,
  diccionario, palabras dudosas e historial hacia el inspector.

Los IDs existentes de inputs y botones deben conservarse siempre que sea
razonable para reducir cambios en `public/app.js` y mantener tests/handlers
actuales.

## Flujo De Datos

No se cambia el modelo de datos ni las rutas API en esta iteración. El inspector
usa el mismo estado actual:

- `pageEditorial(page)` para estructura EPUB.
- `pageReviewed(page)` para revisión.
- Estado de calidad, marcadores, diccionario, palabras dudosas e historial ya
  cargado por la vista.

Guardar estructura debe seguir usando la ruta existente:

- `PATCH /api/projects/:id/pages/:pageId/editorial`

Guardar texto, marcadores, diccionario, OCR y acciones de imagen mantienen sus
flujos actuales.

## Comportamiento Responsive

En escritorio:

- Tres columnas: páginas, trabajo principal e inspector.
- El inspector puede ser sticky para mantenerse visible al revisar texto largo.

En pantallas medianas o pequeñas:

- La lista de páginas y el inspector dejan de ser sticky.
- La vista se apila en una sola columna o dos columnas según el ancho.
- Los acordeones evitan que la página se convierta en una lista interminable.

## Errores Y Estados Vacíos

Cuando no hay página seleccionada:

- El centro muestra el estado vacío actual.
- El inspector muestra un mensaje corto: `Elige una página para revisar su
  estado y estructura.`
- Los controles del inspector quedan deshabilitados.

Cuando una página está marcada como imagen:

- El estado fijo debe decir claramente `Imagen`.
- Los controles de texto pueden permanecer deshabilitados o mostrar el aviso
  actual.
- La estructura EPUB sigue siendo editable si el flujo de exportación la usa.

## Plan De Pruebas

Pruebas automatizadas esperadas:

- `node --check public/app.js`
- `npm test`

Validación manual esperada:

- Abrir un libro con páginas.
- Seleccionar una página.
- Confirmar que `Fin de capítulo` es visible en el inspector sin cambiar de
  pestaña.
- Marcar `Inicio de capítulo`, `Fin de capítulo` y guardar estructura.
- Cambiar de página y confirmar que el inspector refleja el estado correcto.
- Probar ancho de escritorio y móvil para verificar que no hay solapes ni texto
  cortado.

Si se implementa con cambios significativos de DOM, conviene validar la vista en
navegador con screenshot antes/después.

## Fuera De Alcance

- Cambiar el modelo de datos editorial.
- Cambiar las rutas API.
- Rediseñar la vista Capturar.
- Corregir la URL local para iPhone.
- Crear una app móvil nueva.
- Introducir servicios externos o telemetría.

## Decisiones Aprobadas

- Prioridad: opción A del brainstorming, revisión editorial.
- Layout elegido: A3, inspector lateral permanente.
- Inspector elegido: completo.
- Organización elegida: estado fijo + acordeones.
- `Estructura EPUB` abierto por defecto.
- Búsqueda y acciones por rango bajan de protagonismo en esta iteración.
