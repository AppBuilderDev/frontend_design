# Validación · E1 a conexiones externas E3-B

Verificado el 6 de noviembre de 2026 con Node 24.18.0. Se utilizan bases y cuentas temporales independientes de los datos locales.

| Comprobación            | Design                              | Runtime                     |
| ----------------------- | ----------------------------------- | --------------------------- |
| TypeScript y build Vite | Correcto                            | Correcto                    |
| ESLint                  | Sin errores ni advertencias         | Sin errores ni advertencias |
| Prettier                | Correcto                            | Correcto                    |
| Vitest                  | 42 pruebas correctas en 10 archivos | 3 pruebas correctas         |

**Cinco recorridos conjuntos de navegador:**

1. Constructor básico con organización, relaciones, importes en centavos, edición de datos, servicios, borradores, publicación y consumo desde Runtime.
2. Arrastre e historial de Craft, alineación y padding cero, también en Runtime.
3. Inventario operativo: movimientos, mínimos, historial, respuesta perdida y recuperación sin duplicación, operadores y revocación.
4. Servicio configurable de cuatro pasos, simulación sin guardar cambios, publicación/versiones, ejecución desde Runtime y reintento del mismo UUID.
5. Conexión externa: contrato, ambientes con credenciales distintas, producción obligatoriamente comprobada antes de publicar, ApiQuery, usuario de consulta sin acceso de construcción, rechazo de decimales incompatibles, estado vacío y rotación de credenciales con revalidación de la versión activa.

El quinto recorrido utiliza un proveedor simulado y determinista mediante un lanzador exclusivo de Playwright. El navegador solo llama a AppBuilderDev; no recibe las credenciales ni la URL del proveedor. No se han configurado ni contactado APIs reales del equipo en estas pruebas. `npm run api` usa el transporte HTTPS normal.

Las pruebas del backend incluyen las verificaciones anteriores de aislamiento, roles, invitaciones, revisiones, transacciones, idempotencia, contratos publicados, reversión completa y recuperación desde copias. Para conexiones se comprueba además:

- Credenciales cifradas con nonce aleatorio y contexto por proyecto/conexión/ambiente; rechazo con otra clave o contexto. Las lecturas de configuración y páginas publicadas no contienen la credencial ni el mapeo privado.
- Orígenes HTTPS permitidos, rechazo de literales, dominios no autorizados, URL con credenciales/rutas y DNS con direcciones privadas o mixtas. Política IPv4/IPv6 conservadora.
- Una resolución validada se fija en el transporte; se conservan nombre TLS, verificación de certificado y socket independiente. La prueba inspecciona las opciones del cliente HTTPS; no sustituye una integración real con un proveedor.
- No seguimiento de redirecciones; rechazo de JSON inválido, contenido no JSON, exceso de tamaño/filas, campos incompatibles y coincidencias explícitas con la credencial en resultados seleccionados.
- Reglas de ambiente: un editor prueba test pero no producción ni configura credenciales; usuarios de consulta solo consumen los contratos autorizados. Runtime rechaza seleccionar otro ambiente desde el cliente.
- Revisión de configuración, pausa tras rotar credenciales, comprobación por versión y restricción de permisos de versiones antiguas mediante la política vigente.
- Revisión posterior a una consulta en vuelo: si se revoca el permiso o cambia el ambiente, no se devuelve el dato anterior.
- Límites de frecuencia y tiempo total, incluidos DNS y transportes que no completan.
- Eventos sin URL, parámetros, cuerpos, credenciales o resultados privados.
- Preparador de configuración que conserva las variables y clave existentes; backup que restaura una credencial cifrada y permite usarla con su clave.
- Apertura de una base E3-A agregando conexiones sin reescribir cuentas, entidades, servicios, registros o ejecuciones; rechazo de versión futura incompatible.

Se inspeccionaron capturas del diseñador de servicios, prueba de conexión y pantalla publicada. Se comprobó que los contratos y componentes compartidos coinciden entre ambos repositorios.

No se han hecho pruebas de carga, alta disponibilidad, proveedor real ni recuperación de producción. Los escenarios de `e2e/` siguen como batería legacy separada. Los JSON anteriores no se modificaron ni importaron. Vite conserva avisos no bloqueantes sobre anotaciones de Zod y tamaño del paquete de Design.

Pendientes: importación explícita de datos anteriores, ambientes completos con datos/despliegues separados, conectores de escritura y OAuth. Continúan pendientes permisos por campo/usuario, flujos con ramas y colaboración en tiempo real. [Alcance de conexiones](external-connections.md).
