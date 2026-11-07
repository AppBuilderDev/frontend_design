# Operación y recuperación del piloto

## Ejecución y persistencia

Node 24 LTS, npm y un proceso de API. SQLite se guarda en `server/data/platform.sqlite` o `PLATFORM_DB`. Los archivos `-wal` y `-shm` son parte de la operación normal; no copiar solo el archivo principal mientras la API está escribiendo. Mantener el directorio en disco local persistente, fuera del directorio de despliegue reemplazable. No usar una unidad de red ni iniciar varias réplicas de API sobre el mismo archivo.

El servicio escucha en loopback. Para desplegarlo, usar HTTPS y un proxy inverso que envíe `/api/v1` al backend, publique las SPA con fallback de rutas y comparta un host compatible con cookies. `NODE_ENV=production` activa cookies Secure. Mantener `ENABLE_LEGACY_API` desactivado. Las sesiones e invitaciones se guardan como hashes; las contraseñas usan scrypt y sal aleatoria. Las mutaciones requieren la cabecera de la aplicación y CORS restringe los orígenes. Hay límites de cuerpo, tiempos de solicitud e intentos de acceso.

## Copia verificada

Con la base creada, ejecutar desde Design:

```powershell
npm run backup
# O un destino nuevo concreto:
npm run backup -- D:/Respaldos/AppBuilderDev/copia-2026-11-06.sqlite
```

El comando utiliza el backup consistente de SQLite y `integrity_check`; termina con error si no puede verificarla. El destino debe ser distinto del origen. Proteger las copias con los mismos permisos del directorio de datos: contienen datos de clientes, hashes y sesiones. En Windows configurar permisos del directorio para la cuenta del servicio y administradores.

Propuesta de operación del piloto: ejecutar diariamente mediante el programador del sistema, conservar siete copias diarias y una copia fuera del equipo. **La programación y la retención no se instalan automáticamente**. El objetivo de pérdida máxima sería 24 horas si esa programación está activa y supervisada; no es una garantía ni un resultado medido.

## Restauración comprobable

1. Detener la API y confirmar que ya no acepta escrituras.
2. Preservar la base actual y sus archivos auxiliares en una carpeta de incidente. No sobrescribirlos ni mezclarlos con la copia.
3. Elegir una copia verificada y copiarla a un archivo nuevo, por ejemplo `D:/Datos/AppBuilderDev/restaurada.sqlite`.
4. Cambiar `PLATFORM_DB` a ese archivo nuevo e iniciar la API. No adjuntar archivos WAL o SHM de otra base.
5. Comprobar inicio de sesión, organización, entidades, datos, borrador y página publicada. Invalidar sesiones restauradas si hubo incidente de acceso: con la API detenida, eliminar las filas de `sessions` con una herramienta SQLite autorizada.
6. Si la validación falla, detener y regresar `PLATFORM_DB` al conjunto original completo. Mantener evidencias para el diagnóstico.

La prueba automatizada crea una base temporal, escribe y publica, realiza backup, abre la copia y verifica integridad, usuarios, entidades, revisión y publicación. No se ha medido todavía el tiempo de recuperación de un despliegue real.

## Compatibilidad y ampliaciones

Los JSON antiguos siguen en sus rutas originales. No hay importación automática ni pérdida de datos. La API anterior solo se habilita expresamente para consultar el modo local histórico, que carece de permisos por organización. La migración a la base nueva requiere identificar al propietario y al proyecto, revisar un ensayo y ejecutar una importación transaccional; esa herramienta está pendiente.

La versión inicial del esquema SQLite es 1. Los identificadores y tipos de campos no pueden eliminarse o cambiarse desde el piloto. Si una entidad está incluida en una publicación, se bloquean cambios a sus campos para mantener su contrato. En E3 se incorporarán evolución de esquemas, análisis de impacto y reversión sin retirar páginas.

## Extensión de inventario E2

El nuevo backend agrega las tablas operativas al abrir una base E1, sin reescribir sus registros. El inventario se conecta explícitamente y comienza con saldo cero. Antes de actualizar una base compartida, generar una copia verificada. Para volver a E1, detener las escrituras y conservar las tablas nuevas; no eliminarlas ni descartar movimientos posteriores a la copia. [Operación, servicios y compatibilidad de inventario](inventory-operations.md).

## Extensión de servicios E3-A

La API agrega tablas de servicios, versiones y ejecuciones sin reescribir la base E2. Obtener una copia verificada antes de actualizar un entorno compartido y desplegar ambos frontends junto al backend. Para volver al checkpoint anterior, detener escrituras y conservar la base actual completa; no borrar las tablas nuevas. El checkpoint E2 no reconoce ServiceForm ni sus servicios. [Compatibilidad, límites y recuperación](configurable-services.md).
