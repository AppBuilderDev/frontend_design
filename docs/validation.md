# Validación · E1, E2 y servicios configurables E3-A

Verificado el 6 de noviembre de 2026 con Node 24.18.0. Se utilizaron bases temporales independientes de los datos locales.

| Comprobación            | Design                             | Runtime                     |
| ----------------------- | ---------------------------------- | --------------------------- |
| TypeScript y build Vite | Correcto                           | Correcto                    |
| ESLint                  | Sin errores ni advertencias        | Sin errores ni advertencias |
| Prettier                | Correcto                           | Correcto                    |
| Vitest                  | 32 pruebas correctas en 9 archivos | 3 pruebas correctas         |

**4 recorridos conjuntos de Playwright:**

1. Registro, organización, plantilla de inventario, relaciones, centavos, validación de importes, creación/edición de productos, consulta de servicios, componentes conectados, borrador, publicación y escritura desde Runtime.
2. Arrastre de Craft, historial, alineación y padding cero, comprobados también en Runtime.
3. Inventario operativo: activación, mínimos, entradas/salidas/ajustes, historial, respuesta perdida después de confirmar una escritura, recuperación tras recargar sin duplicación, operador sin acceso de construcción y revocación del permiso.
4. Servicios propios: diseñador de cuatro pasos (consultar, comprobar, actualizar, crear), simulación sin escrituras, publicación, ServiceForm, ejecución desde Runtime, pérdida de respuesta con reintento del mismo UUID, versión 2 sin alterar la página vinculada a versión 1, republicación de página y uso por un operador sin inventario activado ni permiso para consultar entidades.

Las pruebas del backend cubren aislamiento por proyecto, permisos de construcción y aplicación, invitaciones, revocación, revisión optimista y publicación exclusiva del propietario. Se comprueba que las versiones antiguas también respetan la política de operadores vigente, que las opciones relacionadas solo devuelven ID/etiqueta y que no se filtra la búsqueda por otros campos.

Se verifican transacciones con reversión completa: fallo en un paso posterior a una actualización no deja registros parciales; una simulación no conserva registros, auditoría o ejecuciones. Con saldo cinco y dos solicitudes simultáneas de cuatro, una se confirma y la otra se rechaza. Los reintentos idénticos devuelven el resultado anterior; cambiar el contenido con el mismo UUID se rechaza.

Se comprueban expresiones y referencias a pasos anteriores, tipos base, enteros seguros, desbordamiento, parámetros reservados, validaciones de escritura, relaciones y condiciones. Las versiones publicadas mantienen sus contratos; se rechazan cambios a los campos y al campo de etiqueta de entidades usadas por servicios publicados. El análisis de impacto identifica las páginas y versiones vinculadas. Se puede cambiar la versión predeterminada o desactivar todas las versiones.

El inventario mantiene sus movimientos inmutables, saldos no negativos, permisos, mínimos y correcciones justificadas. Su recuperación de solicitudes se extrajo a un mecanismo compartido con ServiceForm; el recorrido de desconexión de inventario se ejecutó otra vez después de la extracción y conservó el comportamiento.

Las pruebas de compatibilidad abren bases E1 y E2 sin reescribir cuentas, sesiones, entidades, registros, páginas ni movimientos; agregan las extensiones requeridas y rechazan versiones futuras incompatibles. Una copia verificada conserva movimientos, versiones de servicios y ejecuciones confirmadas. Se inspeccionaron capturas del diseñador y de los formularios publicados.

Los escenarios de `e2e/` se conservan como batería legacy y no forman parte de estos cuatro recorridos. Los JSON anteriores no se migraron ni sobrescribieron. No se han hecho pruebas de carga, alta disponibilidad o recuperación de producción. Vite conserva avisos no bloqueantes sobre anotaciones de Zod y tamaño del paquete de Design.

Pendientes de E3: APIs externas, ambientes, secretos en backend, gateway y migración explícita de datos anteriores. Siguen pendientes permisos por campo/usuario, flujos con ramas y colaboración en tiempo real. [Alcance y compatibilidad de servicios](configurable-services.md).
