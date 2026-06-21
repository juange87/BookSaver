# Formato de paquete BookSaver v1

Estado: especificacion inicial para `BS-P0-007`.

## Objetivo

Un paquete BookSaver permite mover o respaldar un proyecto de libro sin nube,
cuentas ni servicios externos. El paquete conserva los datos fuente editables:
metadatos, capturas originales, OCR revisado, layout, portada, recortes y
estructura editorial. Los EPUB generados siguen siendo artefactos y se excluyen
por defecto.

## Contenedor

- Extension recomendada: `.booksaver.zip`.
- Formato fisico: ZIP normal, inspeccionable con herramientas del sistema.
- Codificacion de textos JSON/TXT: UTF-8.
- Version del formato: `1`.

## Raiz del paquete

```text
booksaver-package.json
metadata.json
pages.json
pages/
  page-0001/
    original.jpg
    ocr.txt
    ocr.tsv
    layout.json
  page-0002/
    original.png
    ocr.txt
    ocr.tsv
    layout.json
cover/
  uploaded-cover.jpg
checksums.sha256
```

`booksaver-package.json` es el manifiesto del paquete y debe incluir:

```json
{
  "format": "booksaver-package",
  "version": 1,
  "createdAt": "2026-06-21T00:00:00Z",
  "sourceApp": "BookSaver",
  "projectId": "mi-libro",
  "title": "Mi libro",
  "pageCount": 2,
  "includes": {
    "metadata": true,
    "pages": true,
    "ocrText": true,
    "layout": true,
    "cover": true,
    "exports": false
  }
}
```

## Incluido

- `metadata.json`: metadatos del libro, notas, idioma OCR y configuracion de
  portada.
- `pages.json`: orden de paginas, estado de revision, recortes, rotacion,
  estructura editorial y referencias relativas a archivos.
- `pages/<page-id>/original.*`: captura original preservada para cada pagina.
- `pages/<page-id>/ocr.txt`: texto OCR revisado o editado por el usuario.
- `pages/<page-id>/ocr.tsv`: salida OCR estructurada cuando exista.
- `pages/<page-id>/layout.json`: layout usado por la exportacion EPUB cuando
  exista.
- `cover/*`: portada subida por el usuario cuando la portada no sea una pagina
  del libro.
- `checksums.sha256`: hash SHA-256 de cada archivo incluido, con rutas relativas.

## Excluido por defecto

- `exports/` y cualquier `.epub` generado.
- `inbox/` y carpetas de importacion temporal.
- Previsualizaciones, caches de OCR, imagenes preparadas para EPUB y otros
  derivados que puedan reconstruirse desde los datos fuente.
- Credenciales locales, claves API, logs y configuracion global de la app.

Si en el futuro se permite incluir EPUBs, debe ser una opcion explicita del
usuario y el manifiesto debe marcar `"exports": true`.

## Reglas de rutas

- Todas las rutas dentro de JSON deben ser relativas a la raiz del paquete.
- No se permiten rutas absolutas ni segmentos `..`.
- Al importar, BookSaver debe rechazar entradas ZIP que intenten escribir fuera
  del destino local.
- Si el `projectId` ya existe, la importacion debe crear un identificador nuevo
  o pedir confirmacion antes de sobreescribir; nunca debe sobrescribir de forma
  silenciosa.

## Validacion minima

Antes de importar, BookSaver debe comprobar:

- `booksaver-package.json` existe y contiene `format: "booksaver-package"` y
  `version: 1`.
- `metadata.json` y `pages.json` existen y son JSON validos.
- Cada pagina declarada en `pages.json` tiene su `original.*`.
- Los archivos referenciados por `pages.json` existen o se marcan como ausentes
  con un error accionable.
- Los hashes de `checksums.sha256` coinciden cuando el archivo de checksums esta
  presente.

## Aviso de tamano

La exportacion debe calcular el tamano estimado antes de empaquetar. Si supera
`500 MB`, BookSaver debe avisar de que el paquete puede tardar en generarse o
copiarse, pero puede continuar si el usuario confirma.

## Compatibilidad futura

Las versiones futuras deben incrementar `version` cuando cambie el contrato de
lectura. Un importador v1 puede rechazar versiones mayores con un mensaje claro:
`Este paquete usa una version de BookSaver mas nueva. Actualiza la app antes de importarlo.`
