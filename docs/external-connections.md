# E3-B · Conexiones externas de lectura

Esta entrega permite configurar consultas GET a APIs HTTPS, separar URL/credenciales de pruebas y producción, validar contratos y publicarlos como `ApiQuery`. Completa el primer bloque de conexiones, gateway y secretos de E3. Los ambientes aquí son **configuraciones de conexiones externas**: no son bases de datos locales independientes ni despliegues separados de toda la aplicación.

## Preparación del servidor

En Design, con Node 24 LTS, ejecutar indicando los dominios reales autorizados:

```powershell
npm run connectors:setup -- api.proveedor.com otro.proveedor.com
```

El comando conserva la configuración existente, agrega los dominios y crea `CONNECTOR_MASTER_KEY` si falta. Escribe `.env` mediante un archivo temporal protegido y reemplazo, sin imprimir la clave. Si ya existe una clave, la conserva. No ejecutar este comando en un directorio diferente del backend esperado. Si una interrupción dejó `.env.connector.lock`, verificar que no haya otra preparación activa antes de retirar ese bloqueo y reintentar. Reiniciar la API después.

- `CONNECTOR_ALLOWED_HOSTS`: lista exacta de dominios ASCII o punycode, separados por comas. Sin comodines, URL, ruta o puerto alternativo. Si falta, no se permiten consultas externas.
- `CONNECTOR_MASTER_KEY`: 32 bytes aleatorios en base64. Solo backend; nunca usar un nombre `VITE_*`. También puede inyectarse mediante la configuración privada del servidor.
- Las conexiones públicas sin credencial pueden funcionar sin clave de cifrado. Guardar o abrir credenciales cifradas sí requiere la clave.
- `.env`, sus temporales y el bloqueo del preparador están excluidos de Git. En Windows, proteger el directorio con permisos para la cuenta del servicio y administradores.

**Conservar la clave fuera del repositorio y una copia protegida para recuperación.** La copia SQLite contiene credenciales cifradas y no puede abrirlas sin la misma clave. El comando de preparación no rota la clave maestra; cambiarla sin recifrar las credenciales existentes impide abrirlas. La rotación admitida en esta entrega es la de la credencial de cada conexión/ambiente.

## Crear y publicar

1. Abrir **Servicios → Conexiones externas → Crear conexión externa**.
2. Definir nombre, identificador estable, permisos de consulta y entradas. Las entradas se vinculan a parámetros de consulta remotos. No se interpolan en dominio o ruta.
3. Elegir respuesta de lista u objeto y su ruta, por ejemplo `items` o `data.items`; vacío significa raíz.
4. Declarar cada campo visible: identificador, etiqueta, tipo, ruta relativa y obligatoriedad. Las rutas usan segmentos separados por punto, sin expresiones o código.
5. Guardar el borrador. El propietario configura cada ambiente: origen HTTPS, ruta fija, autenticación sin credencial/Bearer/API key en cabecera X-. Las credenciales se cifran con AES-256-GCM antes de persistir; al abrir la configuración solo se indica si existe una.
6. En **Probar conexión**, seleccionar pruebas y comprobar los resultados. Un editor puede comprobar pruebas; solo el propietario configura ambientes o comprueba producción.
7. Comprobar el borrador en producción. Después el propietario puede publicarlo; la comprobación debe corresponder al mismo contrato y revisión del ambiente, y tener menos de 24 horas al publicar.
8. Insertar `ApiQuery` en una página, seleccionar la conexión en **Conexión externa** y publicar la página. Runtime utilizará esa versión del contrato y siempre el ambiente de producción.

El navegador llama al backend de AppBuilderDev. No realiza llamadas directas al proveedor ni recibe sus cabeceras, credenciales, URL o rutas de mapeo. El propietario introduce una credencial en un campo de configuración para enviarla al backend; el frontend no la conserva en almacenamiento local, contratos, páginas o respuestas de configuración. Usar HTTPS al desplegar.

## Contratos y formatos

Se admiten texto, enteros, dinero en centavos enteros, booleanos y fechas ISO `YYYY-MM-DD`. Una lista puede tener hasta cien resultados; un objeto se presenta como una fila. Solo se devuelven los campos declarados. Los adicionales se descartan; un campo obligatorio ausente o de tipo incorrecto rechaza la respuesta completa.

No se redondean importes decimales ni se convierten unidades. Un campo monetario debe llegar del proveedor como centavos enteros. Por ejemplo, `1990` se muestra como `S/ 19.90`; `19.90` como número no cumple ese contrato. No hay transformaciones arbitrarias. Los valores de texto se muestran como texto, sin interpretar HTML.

Las entradas admiten texto, números enteros/centavos, booleanos, fechas y selecciones. No incluyen relaciones locales en este bloque. Entradas desconocidas, límites incorrectos y claves reservadas se rechazan. La ruta y el dominio son fijos por ambiente; los parámetros declarados se codifican como consulta.

## Ambientes, versiones y rotación

Cada conexión tiene configuraciones independientes de pruebas y producción. Publicar conserva una versión inmutable del contrato, no una copia de la credencial. Las páginas conservan la versión del contrato hasta republicarse.

Al cambiar origen, ruta, autenticación o credencial, aumenta la revisión del ambiente y sus comprobaciones anteriores dejan de habilitar consultas para esa configuración. El propietario debe probar las versiones que continúan utilizando las páginas. El selector **Contrato de prueba** permite comprobar una versión publicada anterior, además del borrador.

Las consultas de Runtime no aplican caducidad diaria a una configuración ya comprobada; validan la estructura en cada respuesta. El límite de 24 horas se aplica al acto de publicar una versión nueva. Los fallos de proveedor durante una consulta ordinaria no borran la comprobación previa; una comprobación explícita fallida sí queda registrada como fallida hasta volver a comprobar.

Cambiar la versión predeterminada afecta nuevas vinculaciones/republicaciones; las páginas existentes mantienen su versión. Desactivar la conexión bloquea todas las versiones. **Ver comprobaciones e impacto** muestra las páginas vinculadas, las comprobaciones y consultas recientes.

## Permisos y observabilidad

Los permisos operativos de la aplicación se reutilizan. El propietario puede permitir consultar a administradores, operadores y usuarios de consulta; administradores siempre conservan capacidad. Se aplica tanto el permiso de la versión solicitada como el de la versión predeterminada actual, para que una versión antigua no eluda una restricción nueva.

Los usuarios operativos no reciben acceso de construcción ni pueden leer/configurar ambientes. La aplicación puede tener conexiones aunque no tenga inventario o servicios transaccionales activados. Después de recibir la respuesta se vuelven a comprobar el permiso y la revisión del ambiente; si cambiaron durante la espera, no se devuelve el resultado anterior.

Los eventos guardan proyecto, conexión, usuario, ambiente, versión, estado, duración y fecha. No guardan parámetros, URL, cuerpos del proveedor, datos mapeados o credenciales. Se conservan hasta quinientos eventos por conexión y se muestran los últimos veinte. También se rechazan coincidencias explícitas de la credencial en valores proyectados (texto directo, codificación URL o base64).

## Gateway de esta entrega

- Solo GET a HTTPS por el puerto estándar y dominios autorizados exactamente en el servidor.
- Bloqueo de URL con usuario/contraseña, redirecciones y destinos locales, privados, reservados o de enlace local. Para IPv6 se usa una política conservadora de direcciones globales, excluyendo rangos especiales.
- Resolución de todas las direcciones antes de enviar cabeceras y rechazo si alguna no es pública permitida. El socket utiliza una dirección validada, conservando el nombre TLS y la validación normal del certificado. No se reutiliza un agente/socket de otra consulta.
- No se reenvían cookies ni cabeceras de sesión del navegador. Solo se genera la cabecera de autenticación configurada. Se excluyen nombres de cabecera que controlan método o enrutamiento.
- Máximo ocho segundos totales, incluidos DNS y lectura; cinco segundos de inactividad de socket. Máximo 256 KiB de respuesta y JSON UTF-8 sin compresión. Se solicita `Accept-Encoding: identity`.
- Máximo sesenta consultas por minuto y dos simultáneas por proyecto; diez simultáneas en el proceso de API. Los contadores son del proceso y se reinician con la API.

No se ejecutan HTTP externos dentro de las transacciones SQLite de E3-A. Esta entrega no ofrece escrituras a terceros, OAuth, llamadas a redes privadas, subida/descarga de archivos, paginación automática del proveedor, reintentos automáticos ni proxies corporativos. Una consulta manual se puede repetir porque el contrato de esta función es de lectura.

## API

Base `/api/v1/projects/{projectId}`. Sesión, aislamiento y cabecera de mutación de la aplicación, como en los servicios existentes.

| Ruta                                  | Método       | Uso                                                                      |
| ------------------------------------- | ------------ | ------------------------------------------------------------------------ |
| `/connections`                        | GET / POST   | Listar contratos del builder / crear borrador                            |
| `/connections/policy`                 | GET          | Dominios permitidos y disponibilidad de cifrado, solo propietario        |
| `/connections/{id}`                   | PUT / PATCH  | Guardar borrador / activar o elegir versión predeterminada, con revisión |
| `/connections/{id}/environments`      | GET          | Metadatos sin credenciales, solo propietario                             |
| `/connections/{id}/environments/{test | production}` | PUT                                                                      | Configurar ambiente con revisión, solo propietario |
| `/connections/{id}/test`              | POST         | Comprobar borrador o versión en un ambiente autorizado                   |
| `/connections/{id}/publish`           | POST         | Publicar tras comprobar producción, solo propietario                     |
| `/connections/{id}/access?version=1`  | GET          | Permiso de consulta y contrato público                                   |
| `/connections/{id}/query`             | POST         | Consultar con `{version,input}`, siempre producción                      |
| `/connections/{id}/details`           | GET          | Impacto, comprobaciones y eventos, solo builder                          |

Las consultas usan POST local para transportar parámetros tipados; el proveedor recibe únicamente GET. El endpoint público rechaza un ambiente enviado por el cliente. Los errores no incluyen cuerpos de proveedor ni credenciales.

## Compatibilidad y recuperación

Se agregan tablas `connections`, `connection_versions`, `connection_environments`, `connection_checks`, `connection_events` y `connections_schema_version=1`. Los esquemas previos permanecen en versión 1. Se comprueba la apertura de una base E3-A conservando cuentas, registros, servicios y ejecuciones existentes. No se modifica ni importa el almacenamiento JSON anterior.

Obtener una copia verificada antes de desplegar API, Design y Runtime de esta entrega juntos. Para restaurar, usar la copia SQLite y la misma clave maestra, además de la política de dominios del servidor. Se prueba restauración con una credencial cifrada sin imprimirla ni descifrarla en la copia exportada.

Para volver al checkpoint anterior, detener escrituras y conservar la base actual completa. No borrar las tablas nuevas. El checkpoint E3-A no reconoce ApiQuery ni ofrece estas conexiones. Una copia previa no incluye cambios posteriores; mantener la base actual y seguir el procedimiento de recuperación con archivos nuevos.

Límites: veinte conexiones por proyecto, veinte versiones por conexión, diez entradas, doce campos de respuesta y cien filas por consulta. Se mantiene un proceso de API y disco local persistente. No hay nuevas dependencias de ejecución.

## Verificación y fuentes técnicas

El recorrido de navegador emplea un proveedor determinista mediante un lanzador exclusivo de Playwright (`e2e-platform/fixtures/api.ts`). No se contactan proveedores reales ni se usan credenciales del equipo en esas pruebas. `npm run api` conserva el transporte HTTPS normal y no importa ese lanzador. Las pruebas del gateway comprueban direcciones, fijación de resolución, opciones TLS, límites, errores y no filtración; una integración real debe probarse con la API y credenciales concretas del equipo.

Referencias primarias utilizadas para implementar el transporte y cifrado: [HTTPS en Node](https://nodejs.org/download/release/v24.18.0/docs/api/https.html), [conexión TCP y selección de familia](https://nodejs.org/download/release/v24.18.0/docs/api/net.html), [cifrado autenticado de Node](https://nodejs.org/download/release/v24.18.0/docs/api/crypto.html).

Siguiente bloque pendiente de E3: importación explícita y revisable de los datos anteriores. También quedan pendientes ambientes completos con datos/despliegues separados y conectores de escritura con una estrategia propia de consistencia. IA, Figma y sincronización bidireccional siguen fuera de alcance.
