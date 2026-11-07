# Plan de construcción y decisiones aceptadas

## Alcance

AppBuilderDev será un constructor visual de aplicaciones internas para usuarios de negocio, con capacidades progresivas para desarrolladores. El inventario es la primera aplicación de referencia. Se trabaja en los dos repositorios existentes y en la rama `build/inventario`, sin publicar cambios en main.

Base de requisitos: catálogo RF de inventario v1 elaborado con el equipo; investigación A.5_HITO1 y TAIS Segunda Unidad. Las decisiones posteriores del propietario sustituyen las propuestas anteriores que entren en conflicto.

## Decisiones vigentes

1. Se elimina la sincronización bidireccional con código. El árbol JSON es el contrato entre Design y Runtime; no se reconstruyen cambios externos sobre el editor.
2. Cada organización tiene un único proyecto, restricción también en base de datos. Un usuario puede participar en organizaciones distintas mediante invitación.
3. Cantidades e importes usan enteros seguros. Moneda PEN: 1050 centavos se presentan como S/ 10.50. No hay redondeo automático ni aceptación de más de dos decimales. Los límites de los campos monetarios se configuran en centavos.
4. Solo el propietario publica, gestiona acceso y archiva/restaura. Editor: diseño, borradores, entidades y registros. Lector: consulta. Estos son roles de construcción; E2 añade permisos operativos independientes.
5. Base estable para el piloto: SQLite con WAL, claves foráneas y transacciones, sesiones en servidor, aislamiento por proyecto, revisiones optimistas, instantánea publicada, desactivación de registros, registro de acciones y copia verificada mediante la API de backup de SQLite. Un único proceso de backend.
6. Figma e IA quedan fuera del alcance. No se crean integraciones para ninguno.

## Primera entrega implementada

| Familia RF | Resultado verificable                                                                                                                                                                                                                                                                    |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| B01–B04    | Registro e inicio/cierre de sesión; organización con proyecto privado; invitaciones por correo destinatario y enlace de 72 horas; propietario/editor/lector; revocación de acceso.                                                                                                       |
| B05–B07    | Entidades y campos de texto, entero, dinero, booleano, fecha, selección y relación; obligatoriedad, unicidad y límites; relaciones dentro del proyecto. Identificadores y tipos ya guardados se conservan.                                                                               |
| B08–B09    | Servicios propios generados para listar, consultar, crear, actualizar y desactivar. Búsqueda, filtros exactos, orden y paginación. El listado visual ofrece filtro de la primera relación o selección; la API admite los campos declarados.                                              |
| B10–B14    | Páginas existentes y navegación publicada; formulario, listado y detalle conectados por entidad; crear/editar y desactivar; selección de registro compartida; carga, vacío, error y confirmación. La configuración libre de acciones y enlaces arbitrarios entre campos queda pendiente. |
| B15–B16    | Guardado de borrador separado de publicación, publicación exclusiva del propietario, conservación de versión publicada y rechazo de revisiones obsoletas. Validación de componentes y entidades al publicar.                                                                             |
| I01–I02    | Plantilla inicial atómica de categorías, unidades y productos; SKU único, relaciones y precio en centavos. Catálogos y productos se administran mediante los mismos servicios.                                                                                                           |

No se afirma cobertura completa de todos los RF: el control fino por campo, las acciones visuales libres y futuras extensiones todavía requieren trabajo. E2 añade los permisos operativos específicos del inventario.

## Criterios de aceptación de esta entrega

- Una organización ajena no puede leer ni escribir recursos de otra, incluso con un identificador conocido.
- La invitación coincide con el correo, caduca y se consume una sola vez. Un lector no escribe; un editor no publica.
- Los datos inválidos no se guardan. Relaciones y unicidad se comprueban en el servidor.
- Una revisión antigua obtiene 409 y no sobrescribe cambios. No hay colaboración en tiempo real todavía.
- El borrador no cambia Runtime. Publicar incluye las definiciones relacionadas y bloquea cambios incompatibles de esas entidades.
- Un formulario publicado guarda y refresca el listado mediante los servicios reales.
- La copia de seguridad abre correctamente y conserva usuarios, entidades, borradores y publicaciones.
- Se preservan los archivos JSON anteriores. No se atribuyen datos preexistentes a una organización sin una migración explícita posterior.

## E2 · Inventario operativo implementado

Entradas, salidas y ajustes con transacciones, enteros, saldo no negativo, idempotencia, historial inmutable, mínimos y permisos operativos independientes. Se puede publicar el componente Inventory y usar la aplicación sin acceso de construcción. Véase [alcance, operación y compatibilidad](inventory-operations.md). RF-B28 comenzó con los servicios predeterminados y E3-A incorpora composición de pasos permitidos, como se describe a continuación.

## E3-A · Servicios propios configurables implementados

Diseñador de entradas, consultas por ID, condiciones, creaciones y actualizaciones con transacciones; expresiones de suma/resta seguras; simulación que revierte todas sus escrituras; publicación exclusiva del propietario; versiones inmutables, selección de versión anterior e impacto de dependencias. El componente ServiceForm consume el contrato capturado por la página y confirma reintentos de forma idempotente. Véase [guía de servicios configurables](configurable-services.md).

## E3-B · Conexiones externas de lectura implementadas

Conexiones GET HTTPS con entradas tipadas y proyección de respuestas, pruebas/producción con URL y credenciales separadas, cifrado en backend, controles de red y límites. El propietario comprueba producción antes de publicar y las páginas capturan contratos versionados mediante ApiQuery. Los ambientes de este bloque corresponden a conexiones externas, no a datos locales aislados. Véase [guía de conexiones](external-connections.md).

## Próximas entregas en orden

2. **E3, siguiente bloque · Importación y evolución:** migración explícita y revisable de los datos anteriores. E3-B ya cubre conexiones externas de lectura, ambientes de conexión y gateway. Los ambientes completos con datos/despliegues separados y conectores de escritura continúan pendientes.
3. **E4 · Reglas y flujos:** condiciones, fórmulas con enteros y escala explícita, aprobaciones y componentes avanzados para desarrolladores.
4. **E5 · Equipo:** presencia y edición simultánea con resolución de conflictos, comentarios, historial recuperable y módulos reutilizables.
5. **E6 · Inventario avanzado:** varios almacenes, transferencias, lotes, códigos de barras e importaciones de datos. No incluye Figma.

## Límites conocidos del piloto

Hasta 50 entidades por proyecto, 30 campos por entidad, 5000 registros por entidad y 100 páginas por proyecto. Los listados filtran y ordenan dentro del proceso; no es una solución de gran volumen. No hay envío automático de correo, verificación de correo ni recuperación de contraseña. El registro se usa en un piloto controlado. No hay ejecución de código libre, tareas programadas de negocio, flujos con ramificaciones ni alta disponibilidad. Los permisos de aplicación cubren inventario y ejecución por rol de servicios publicados; los permisos individuales por servicio o campo siguen pendientes.

El backend autoriza el acceso en cada solicitud; ocultar controles no es la medida de seguridad. No se debe habilitar la API legacy en un entorno compartido. Para una siguiente apertura pública hacen falta verificación de identidad/correo, recuperación de cuenta, operación administrada y una revisión de seguridad de despliegue.
