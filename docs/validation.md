# Validación de la primera entrega · build/inventario

Verificado el 6 de noviembre de 2026, con Node 24.18.0 y una base temporal independiente de los datos locales.

| Comprobación                        | Design                             | Runtime                     |
| ----------------------------------- | ---------------------------------- | --------------------------- |
| Compilación TypeScript y build Vite | Correcta                           | Correcta                    |
| ESLint                              | Sin errores ni advertencias        | Sin errores ni advertencias |
| Formato Prettier                    | Correcto                           | Correcto                    |
| Vitest                              | 19 pruebas correctas en 7 archivos | 3 pruebas correctas         |

Recorridos Playwright conjuntos, lanzados desde Design: 2 correctos.

- Registro y organización privada, plantilla de inventario, relaciones, rechazo de más de dos decimales, creación y edición de productos, consulta del servicio, conexión de componentes en Craft, guardado de borrador, publicación y creación de datos desde Runtime.
- Arrastre real de Craft, deshacer/rehacer, alineación independiente del texto y padding cero, con comprobación del resultado en Runtime.

La batería de API verifica aislamiento entre organizaciones, restricción de un proyecto por organización, invitaciones de un solo uso, permisos editor/lector, revocación, archivado/restauración, validación, filtros, unicidad, revisión obsoleta, estabilidad de publicaciones, protección de esquemas y apertura de una copia consistente de SQLite. Se han inspeccionado las capturas de las pantallas de datos y de la aplicación publicada.

Los escenarios históricos bajo `e2e/` se conservan como prueba legacy y no forman parte de estos dos recorridos nuevos. Los JSON antiguos no se han migrado ni sobrescrito. No se han hecho pruebas de carga, despliegue público o recuperación de un servidor real.

Vite muestra avisos no bloqueantes sobre anotaciones de Zod y tamaño del paquete de Design. No impiden compilar. La capacidad de edición en tiempo real, movimientos de inventario, cálculo de stock y recuperación de cuenta siguen fuera de esta primera entrega.
