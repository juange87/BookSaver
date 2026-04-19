# Roadmap de BookSaver

Ideas priorizadas para cerrar una primera versión sólida sin abrir demasiados
frentes a la vez.

Fecha de referencia: 2026-04-19

## Candidatas para cerrar v1

- [ ] Reordenar páginas desde la UI
  Impacto: alto.
  Motivo: en libros largos es muy fácil importar o capturar alguna página fuera
  de orden, y corregirlo debería ser rápido desde la interfaz.
  Nota técnica: el backend ya tiene soporte para reordenación, así que parece
  una mejora con buena relación impacto/esfuerzo.

- [ ] OCR por lotes con progreso
  Impacto: muy alto.
  Motivo: es la mejora más clara para libros de muchas páginas.
  Alcance sugerido: botón `Leer pendientes` o `Leer todo`, con estado visible
  de progreso y recuento de páginas completadas.

- [ ] Rotar páginas 90° izquierda/derecha
  Impacto: alto.
  Motivo: mejora capturas hechas con móvil, webcam o cámara USB, y además ayuda
  a que el OCR funcione mejor antes de editar el texto.

- [ ] Chequeo antes de exportar
  Impacto: medio-alto.
  Motivo: ayuda a cerrar libros con menos errores silenciosos.
  Alcance sugerido: avisar si hay páginas sin OCR, páginas con warning, portada
  sin definir o estructura editorial incompleta.

## Orden recomendado

1. Reordenar páginas desde la UI.
2. OCR por lotes con progreso.
3. Rotación de páginas.
4. Chequeo previo a exportación.

## Criterio para no alargar demasiado la v1

Antes de dar por cerrada la primera versión, intentar meter como máximo una o
dos de estas mejoras y dedicar el resto del tiempo a pulido, bugs, responsive y
facilidad de instalación para personas no técnicas.
