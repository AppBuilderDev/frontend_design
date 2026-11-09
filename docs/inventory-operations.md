# E2 · Inventario operativo

## Cómo usarlo

1. Crear categorías, unidades y productos desde Datos o utilizar los ya creados en E1.
2. Abrir **Inventario** y, como propietario, conectar la entidad de productos, su nombre, SKU opcional y unidad relacionada opcional. Esta conexión es estable y las existencias comienzan en cero; no se interpreta ningún campo genérico como saldo anterior.
3. Seleccionar un producto y registrar una entrada con cantidad entera positiva y motivo. El servidor identifica al autor y registra su fecha.
4. Registrar salidas positivas: si no hay disponibilidad, no se confirma ningún cambio.
5. Para corregir diferencias, un administrador registra un ajuste con variación entera distinta de cero y motivo. El ajuste comprueba el saldo observado y puede referenciar el movimiento original del mismo producto. El original se conserva.
6. Configurar un mínimo por producto. El aviso aparece únicamente cuando el saldo es menor que ese mínimo.
7. Insertar el componente **Inventory** en una página y publicarla. La vista previa del editor permite consultar; las escrituras se realizan desde Runtime o desde la pantalla operativa de Design.

## Permisos independientes

El propietario siempre administra el inventario. Las demás personas necesitan permiso operativo explícito, aunque sean editores del builder.

| Permiso operativo           | Consultar existencias e historial | Entradas y salidas | Ajustes, mínimos y estado del producto |
| --------------------------- | --------------------------------- | ------------------ | -------------------------------------- |
| Consulta                    | Sí                                | No                 | No                                     |
| Operador                    | Sí                                | Sí                 | No                                     |
| Administrador de inventario | Sí                                | Sí                 | Sí                                     |

En **Equipo y proyecto**, el propietario puede asignar permisos operativos a miembros existentes o invitar a personas solo a usar la aplicación. Esas invitaciones no otorgan acceso de construcción, a la API genérica de entidades ni a la publicación. En el piloto, los usuarios operativos acceden al módulo de inventario; el control genérico de permisos por servicio y por campo de cualquier aplicación sigue pendiente.

Los accesos de construcción y de aplicación se revocan por separado. Retirar a un constructor no revoca implícitamente su permiso operativo; para retirar ambos se deben deshabilitar ambos accesos. Las invitaciones operativas duran 72 horas, se consumen una vez y requieren el correo destinatario. Solo el propietario administra estas asignaciones.

## Consistencia y reintentos

- Las existencias se calculan sumando movimientos inmutables. No existe una columna de stock editable ni un campo de saldo consumible por los servicios CRUD genéricos.
- Cada solicitud de movimiento incluye un UUID por intención. La misma operación y el mismo contenido devuelven el movimiento confirmado; cambiar el contenido o el autor con el mismo identificador se rechaza.
- Disponibilidad, validación del saldo observado, movimiento y auditoría se confirman dentro de una transacción SQLite `IMMEDIATE`. Si un paso falla se revierte todo. No se admiten cantidades fraccionarias, saldos negativos ni enteros fuera del rango seguro de JavaScript.
- El historial conserva producto, nombre/SKU al momento, variación, saldos anterior/resultante, motivo, usuario y fecha del servidor. Se filtra por producto, tipo, usuario y rango de días UTC, con paginación.
- El navegador conserva la solicitud pendiente en `sessionStorage`, separada por proyecto y usuario. Ante una respuesta perdida, ofrece reintentar el mismo UUID y bloquea nuevos movimientos de esa instancia mientras se confirma. La solicitud también se recupera al recargar esa pestaña. No se debe copiar una solicitud y asignarle otro UUID para simular un reintento.
- Desactivar un producto conserva sus movimientos e impide nuevas entradas y salidas. Solo un administrador puede registrar un ajuste justificado sobre un producto inactivo o reactivarlo. La ruta genérica de desactivación del catálogo también exige administración de inventario cuando está conectado.
- Cambios de mínimo y estado usan revisión optimista para evitar sobrescribir modificaciones recientes.

## Servicios

Base `/api/v1/projects/{projectId}`. Todos requieren sesión, autorización y cabecera de mutación de la aplicación.

| Ruta                               | Método     | Uso                                                            |
| ---------------------------------- | ---------- | -------------------------------------------------------------- |
| `/inventory/config`                | GET / POST | Consultar conexión / activarla como propietario                |
| `/inventory/access`                | GET        | Permiso operativo del usuario actual                           |
| `/inventory/stock`                 | GET        | Existencias, búsqueda, solo bajo mínimo e inactivos opcionales |
| `/inventory/movements`             | GET / POST | Historial / movimiento atómico e idempotente                   |
| `/inventory/products/{id}/minimum` | PUT        | Configurar mínimo con revisión                                 |
| `/inventory/products/{id}/status`  | PUT        | Desactivar/reactivar con revisión                              |
| `/inventory/actors`                | GET        | Usuarios con movimientos para filtrar el historial             |
| `/inventory/operations`            | GET        | Contratos y pasos permitidos de los servicios transaccionales  |
| `/application/members`             | GET        | Accesos operativos, para el propietario                        |
| `/application/members/{id}`        | PUT        | Asignar permiso o `none`                                       |
| `/application/invitations`         | POST       | Generar invitación de uso de aplicación                        |
| `/application/invitations/{id}`    | DELETE     | Cancelar invitación pendiente                                  |

Los contratos transaccionales de entrada/salida/ajuste se consultan desde **Servicios**. Son operaciones predeterminadas conectadas al catálogo elegido. Cubren el caso transaccional del inventario de RF-B28; E3-A añade un diseñador de pasos permitidos para servicios propios; consulta [servicios configurables](configurable-services.md). No se ejecuta código del usuario.

## Compatibilidad y reversión

La extensión agrega tablas e índices `inventory_*`, `application_members` y `application_invitations`; mantiene el esquema base E1 en versión 1 y utiliza una versión separada para inventario. No reescribe registros, páginas, cuentas ni archivos JSON anteriores. Se aplica al abrir la base con el nuevo backend. La conexión al catálogo requiere una acción explícita del propietario y no altera su esquema.

Antes de actualizar una base compartida, obtener una copia verificada con `npm run backup`. Desplegar API, Design y Runtime de la misma entrega. Para volver a E1, detener las escrituras y regresar ambos repositorios al checkpoint anterior; las tablas nuevas pueden conservarse. E1 no reconoce el componente Inventory ni ofrece permisos o rutas operativas. No eliminar tablas para volver atrás. Si se necesita restaurar la copia previa, mantener la base actual completa como evidencia: esa copia no incluye movimientos posteriores.

Las copias y el procedimiento general de recuperación de E1 también incluyen las tablas nuevas. No hay servidor nuevo ni dependencia adicional. Se mantiene un único proceso de API con disco local persistente; el historial se consulta dentro del proceso y se debe revisar capacidad antes de uso de gran volumen.

## Requisitos cubiertos y límites

E2 implementa RF-I03 a RF-I10 y los permisos operativos del inventario de RF-B17. RF-B28 queda cubierto para estas tres operaciones predeterminadas; E3-A añade composición de pasos permitidos para servicios propios. Continúan fuera de alcance almacenes múltiples, reservas, lotes, valorización/costo promedio, permisos genéricos por campo y flujos avanzados. IA y Figma siguen fuera; la etapa actual incorpora sincronizacion para el subconjunto TSX v1.
