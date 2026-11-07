# E3-A · Servicios propios configurables

Esta entrega amplía RF-B28 con composición visual de pasos y añade una primera parte de E3: contratos publicados estables, simulación, impacto y selección de versiones anteriores. Las conexiones externas, ambientes, secretos e importación de datos legacy no forman parte de este bloque.

## Recorrido

1. Crear entidades y sus campos en **Datos**. Sus validaciones se reutilizan en los servicios.
2. En **Servicios → Servicios configurables**, elegir la entidad inicial y una plantilla: crear un registro o descontar una cantidad numérica.
3. Definir nombre e identificador estable. Configurar las entradas del formulario, si los operadores podrán ejecutar y los pasos de la transacción.
4. En **Entradas**, se admiten texto, entero, importe, booleano, fecha, selección y relación. Los importes del formulario se convierten exactamente a centavos. Los parámetros desconocidos se rechazan.
5. En **Pasos**, consultar un registro por ID, comprobar una condición, crear registros o actualizar un registro de un paso anterior. Reordenar con las flechas. Solo se pueden referenciar pasos anteriores; los identificadores deben ser únicos.
6. En **Resultado**, elegir exactamente qué campos recibirá el usuario de la aplicación. Los datos intermedios y las definiciones de los pasos no forman parte del contrato enviado a Runtime.
7. Guardar el borrador y pulsar **Simular**. La simulación usa datos reales dentro de una transacción que siempre se revierte, incluidos registros y auditoría. No crea una ejecución confirmada.
8. El propietario publica una versión. Añadir `ServiceForm` a una página, seleccionar el servicio en **Conexión de servicio** y publicar la página.
9. La página captura la versión predeterminada del servicio y sus entradas. Un borrador nuevo o publicar la versión 2 no modifica una página ya vinculada a la versión 1. Para cambiarla, volver a publicar la página.

## Valores y condiciones

Los valores pueden proceder de una entrada, un campo/identificador/revisión de un registro de un paso anterior, un valor fijo o el identificador del usuario que ejecuta. Se pueden sumar o restar enteros mediante expresiones anidadas, con un máximo de seis niveles. No hay JavaScript, SQL, `eval`, HTTP, multiplicaciones o divisiones configurables.

Las comparaciones admiten igualdad, diferencia y orden numérico. Una condición falsa detiene y revierte el servicio con el mensaje configurado. No hay bifurcación con rama alternativa todavía. Crear/actualizar aplica las validaciones de la entidad: obligatoriedad, tipos, límites, selección, unicidad y relaciones dentro del proyecto. Un registro inactivo no se puede consultar para actualizarlo.

Los importes y cantidades se almacenan como enteros seguros. En las expresiones se comprueba el tipo base (texto, número, booleano o vacío); no se convierten automáticamente escalas o unidades. Una constante monetaria debe expresarse en centavos. El resultado numérico se devuelve como entero; el autor debe identificar su unidad en el nombre del resultado. Fechas, opciones, referencias y límites se vuelven a validar al escribir.

## Transacciones y reintentos

Todo ocurre en una transacción SQLite `IMMEDIATE`: lectura, condiciones, creaciones/actualizaciones, resultado confirmado y auditoría. Las escrituras de cada paso usan el mismo almacenamiento y sus revisiones. Si un paso, validación o cálculo falla, ninguna escritura del servicio permanece. Una operación que necesite actualizar otra vez el mismo registro debe usar el resultado del paso actualizado para conservar la revisión vigente.

Cada ejecución lleva `operationId` (UUID), `version` e `input`. Un reintento con el mismo identificador, servicio, versión, autor y contenido devuelve el resultado anterior. Reutilizar ese identificador para otra solicitud devuelve 409. La aplicación conserva la solicitud pendiente por proyecto, usuario, servicio y versión en `sessionStorage`; tras una respuesta perdida o recarga, reintenta esa misma solicitud y bloquea una nueva hasta confirmarla. Esta recuperación se comparte con el inventario, conservando su formato de solicitudes pendientes.

Solo se guardan ejecuciones confirmadas. El constructor puede consultar las últimas veinte, con autor, fecha y resultado público. No se conserva un historial independiente de errores fallidos ni de simulaciones.

## Permisos

- Propietario y editor pueden guardar borradores y simular. El lector del builder solo consulta.
- Solo el propietario publica servicios, cambia su versión predeterminada y los activa/desactiva.
- Los administradores de aplicación ejecutan servicios activos publicados. Los operadores ejecutan únicamente si el propietario habilitó esa capacidad. Los usuarios de consulta no ejecutan escrituras.
- Además del permiso de la versión solicitada, se aplica la política de la versión predeterminada actual. Si una publicación nueva retira ejecución a operadores, estos no pueden eludirla llamando una versión anterior. Volver a seleccionar una versión anterior es una decisión explícita del propietario.
- Las invitaciones operativas existentes también permiten usar estos servicios, aunque el proyecto no tenga inventario activado. No otorgan acceso al diseñador, a los borradores ni al CRUD genérico de entidades.
- Las opciones de una entrada de relación se limitan al proyecto, registros activos e identificador/etiqueta. La búsqueda se hace únicamente sobre esa etiqueta. La publicación protege los campos y el campo de etiqueta de las entidades relacionadas para evitar cambios silenciosos del contrato.

El permiso de operador es por proyecto y contrato de servicio, no por usuario individual ni por campo. Si el servicio debe restringir un registro al usuario que ejecuta, el autor debe expresar esa condición, por ejemplo comparando un campo de propietario con el valor **Usuario que ejecuta**. Las opciones de relación no tienen filtros por propietario en esta entrega.

## Versiones e impacto

Las versiones publicadas son inmutables. Cambiar la predeterminada permite volver a una versión anterior para nuevas vinculaciones; las páginas existentes mantienen la versión capturada hasta republicarse. **Desactivar servicio** bloquea todas sus versiones, incluidas las usadas por páginas existentes.

**Ver impacto y versiones** muestra páginas que lo utilizan, versiones vinculadas y entidades protegidas. Las entidades que participan en versiones publicadas conservan sus campos y su campo de etiqueta; se rechazan cambios incompatibles en esta entrega. No hay eliminación de versiones ni migración automática de esquemas. Una versión anterior que se mantenga publicada continúa protegiendo sus dependencias.

## API

Base `/api/v1/projects/{projectId}`. Sesión, aislamiento y autorización se comprueban en servidor. Las mutaciones requieren la cabecera de la aplicación.

| Ruta                                                 | Método     | Uso                                                  |
| ---------------------------------------------------- | ---------- | ---------------------------------------------------- |
| `/operations`                                        | GET / POST | Listar servicios del builder / crear borrador        |
| `/operations/{id}`                                   | PUT        | Actualizar borrador con revisión                     |
| `/operations/{id}`                                   | PATCH      | Activación o versión predeterminada, con revisión    |
| `/operations/{id}/publish`                           | POST       | Publicar borrador con revisión                       |
| `/operations/{id}/simulate`                          | POST       | Simular borrador guardado con revisión e input       |
| `/operations/{id}/access?version=1`                  | GET        | Permiso actual y contrato público de esa versión     |
| `/operations/{id}/execute`                           | POST       | Ejecutar versión con operationId e input             |
| `/operations/{id}/options/{entrada}?version=1&q=...` | GET        | Opciones públicas de una entrada de relación         |
| `/operations/{id}/draft-options/{entrada}?q=...`     | GET        | Opciones para simular desde el builder               |
| `/operations/{id}/impact`                            | GET        | Páginas y entidades dependientes, solo builder       |
| `/operations/{id}/runs`                              | GET        | Últimas veinte ejecuciones confirmadas, solo builder |

Los formularios de ejecución reciben solo `id`, nombre, versión, entradas y permiso de operadores. El backend mantiene el grafo completo. Las respuestas de ejecución incluyen únicamente el resultado declarado y datos de identificación de la ejecución.

## Migración, límites y siguientes bloques

Se agregan `operations`, `operation_versions`, `operation_runs` y `operations_schema_version=1`. Se mantienen en versión 1 los esquemas base e inventario. La apertura de una base E2 agrega las tablas sin reescribir registros, sesiones, páginas o movimientos. No se importa ningún JSON anterior. Las copias verificadas incluyen las nuevas tablas.

Antes de actualizar un entorno compartido, obtener una copia verificada. Desplegar API, Design y Runtime de la misma entrega. Para volver al checkpoint E2, detener escrituras y conservar la base actual completa; las tablas nuevas no se deben borrar. E2 no reconoce `ServiceForm` ni ofrece ejecución de estos servicios. Si se restaura una copia previa se perdería la visibilidad de ejecuciones posteriores a la copia; mantener primero una copia de la base actual y seguir el procedimiento de recuperación.

Límites del piloto: 30 servicios por proyecto, 20 entradas, 20 pasos, 20 campos de resultado, 20 versiones por servicio y 5000 ejecuciones confirmadas por servicio. Se mantienen los límites de entidades, registros y un único proceso de API. No hay dependencias nuevas.

Pendientes de E3: conexiones externas con secretos únicamente en backend, ambientes separados, gateway/control de contratos externos e importación explícita de los datos anteriores. Pendientes posteriores: ramas de flujo, tareas asíncronas, fórmulas avanzadas, permisos por campo y colaboración en tiempo real. IA, Figma y sincronización bidireccional siguen fuera de alcance.
