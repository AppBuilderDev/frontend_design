# AppBuilderDev Design

Frontend React, TypeScript, Vite y Craft.js. El servidor y las pruebas de dominio se trasladaron al repositorio ../backend. Este repositorio no contiene persistencia ni credenciales del backend.

Usar Node 24. Iniciar primero npm run dev en ../backend y npm run dev en ../frontend_runtime. Aqui instalar con npm ci y ejecutar npm run dev. Design: http://localhost:5173/workspace, Runtime: http://localhost:5174, API: http://localhost:3001.

Copiar .env.example a .env si no existe. PLATFORM_API_TARGET configura el proxy /api/v1; VITE_RUNTIME_URL configura el enlace a Runtime. Mantener el mismo host en ambos frontends para compartir la sesion.

Se preservan el editor visual, paginas, entidades, inventario, servicios, conexiones y equipo. Guardar conserva el borrador; Publicar requiere rol propietario y actualiza Runtime.

Verificar con npm run build, npm run lint y npm test. npm run test:e2e inicia el backend separado y ambos frontends con SQLite temporal. Las pruebas del servidor viven en ../backend/tests.

## Rutas y tablas HTTP

En Rutas y endpoints puedes crear recursos CRUD en el backend y registrar sus rutas HTTP. Registrar una ruta no crea el endpoint: conserva su contrato para conectarlo a la pagina. Se permite listar, buscar, crear, editar y eliminar rutas no vinculadas.

Agrega Tabla HTTP a una pagina y selecciona las rutas GET, POST, PUT/PATCH y DELETE en Servicios HTTP. Los campos y la ruta de items se definen en el catalogo. Publicar conserva los contratos y permite operar desde Runtime; el borrador no ejecuta escrituras. Los metodos reales son autorizados y validados por el backend independiente.

## Codigo y sincronizacion

El boton **Codigo** muestra TSX generado desde el arbol del editor. Los cambios visuales actualizan el codigo cuando no hay una edicion de codigo pendiente. **Aplicar codigo al diseno** valida y transforma TSX a nodos de Craft, conserva IDs, estilos, anidamiento y config, incluidos los IDs de servicios. Las modificaciones son explicitas para evitar sobreescribir mientras se escribe. Codigo invalido o no compatible informa el error sin modificar el diseno. Si cambian ambas representaciones antes de aplicar, se solicita resolver el conflicto usando descarga o regeneracion. Guardar y Ctrl+S rechazan codigo pendiente.

Contrato TSX v1: imports de ./builder-components, export default function Page con un unico return JSX; componentes del registro con builderId estable y config JSON. No soporta React arbitrario, hooks, variables, spreads, funciones, expresiones ejecutables ni imports externos. No se usa eval. El archivo descargado Page.tsx puede colocarse en src/ de Design o Runtime, que incluyen src/builder-components.tsx y el renderizador. Los componentes de datos requieren DataProvider del proyecto, igual que el Runtime dinamico. No es una exportacion standalone de todo el proyecto.

Cada panel permite exportar mediciones JSON de conversion (direccion, exito, duracion, nodos y errores). Descargar conserva el texto pendiente. El archivo generado no contiene credenciales.
