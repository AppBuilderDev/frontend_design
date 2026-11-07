# Validación · E1 + inventario operativo E2

Verificado el 6 de noviembre de 2026, con Node 24.18.0. Las pruebas utilizan bases y cuentas temporales, separadas de los datos locales.

| Comprobación            | Design                             | Runtime                     |
| ----------------------- | ---------------------------------- | --------------------------- |
| TypeScript y build Vite | Correcto                           | Correcto                    |
| ESLint                  | Sin errores ni advertencias        | Sin errores ni advertencias |
| Prettier                | Correcto                           | Correcto                    |
| Vitest                  | 25 pruebas correctas en 8 archivos | 3 pruebas correctas         |

Recorridos Playwright conjuntos: **3 correctos**.

1. Registro, organización, plantilla de inventario, relaciones, precios en centavos, rechazo de decimales excesivos, creación/edición de productos, consulta de servicios, conexión de componentes en Craft, borrador, publicación y creación de datos desde Runtime.
2. Arrastre real de Craft, deshacer/rehacer, alineación y padding cero, con comprobación en Runtime.
3. Activación del inventario sobre productos existentes, mínimos, entradas/salidas/ajustes, historial, pérdida de respuesta después de confirmar una escritura, recuperación tras recargar y reintento con el mismo UUID sin duplicación. Publicación del componente Inventory, invitación de un operador sin acceso de construcción, ejecución desde Runtime, rechazo de ajustes no autorizados y revocación del permiso operativo.

Las pruebas del backend verifican:

- Aislamiento por organización, un proyecto por organización, invitaciones de un solo uso, permisos de construcción y publicación exclusiva del propietario.
- Permisos operativos independientes: administrador/operador/consulta, revocación y rechazo de escrituras directas a rutas ajenas al permiso concedido.
- Existencias iniciales cero; con saldo cinco y dos salidas simultáneas de cuatro, una se confirma y la otra se rechaza, conservando saldo uno.
- Reintentos idénticos devuelven el movimiento anterior; reutilizar el identificador con otro contenido se rechaza.
- Un fallo inyectado en la auditoría revierte movimiento y saldo completos; repetir después la operación permite confirmarla.
- Enteros exactos hasta el límite seguro, rechazo de cero/fracciones/cantidades inválidas, límites del saldo y prohibición de saldo negativo.
- Ajustes con saldo observado vigente y referencia al movimiento del mismo producto; movimientos inmutables también frente a escrituras directas en SQLite.
- Mínimo con revisión y aviso estrictamente por debajo; desactivación con historial conservado y ajustes excepcionales autorizados.
- Filtros por fecha/tipo/producto/usuario y paginación; validaciones de entidades y registros; estabilidad de publicación y conflictos de edición.
- Copia SQLite verificada que conserva movimientos y saldos. Apertura de una base E1 sin tablas operativas, conservando cuentas, sesiones, entidades, registros y página publicada; rechazo de una versión futura de inventario incompatible.

Se inspeccionaron capturas de las pantallas de datos, inventario de Design y aplicación publicada con un operador.

Los escenarios antiguos de `e2e/` permanecen como batería legacy y no forman parte de estos tres recorridos nuevos. No se modificaron ni importaron los JSON anteriores. No se han hecho pruebas de carga, alta disponibilidad o recuperación de un servidor de producción.

Vite conserva avisos no bloqueantes de anotaciones de Zod y tamaño del paquete de Design. Continúan pendientes el diseñador genérico de pasos transaccionales para cualquier servicio, permisos por campo, múltiples almacenes y colaboración en tiempo real. [Alcance y compatibilidad de E2](inventory-operations.md).
