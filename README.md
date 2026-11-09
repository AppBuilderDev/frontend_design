# AppBuilderDev Design

Frontend React + TypeScript + Vite + Craft.js. No contiene servidor, persistencia ni credenciales. Consume el backend NestJS del repositorio ../backend mediante HTTP. Node 24 recomendado.

## Ejecutar (tres terminales)

1. En ../backend: `npm ci --ignore-scripts`, preparar .env y `npm run dev` (3001).
2. Aqui: `npm ci --ignore-scripts`, copiar .env.example a .env si no existe y `npm run dev` (5173).
3. En ../frontend_runtime: `npm ci`, `npm run dev` (5174).

Abrir http://localhost:5173/workspace. Usa siempre localhost en ambos frontends o siempre 127.0.0.1 para compartir la sesion. PLATFORM_API_TARGET configura el destino del proxy /api/v1; VITE_RUNTIME_URL abre Runtime. No hay variables de base de datos ni secretos en este frontend.

## Flujo backend -> rutas -> pagina

1. Crear una cuenta/proyecto o iniciar sesion con una existente.
2. En Rutas y endpoints, **Crear recurso en backend** con nombre, identificador y campos. Tambien puedes crear el endpoint en un controlador Nest propio del backend.
3. **Registrar ruta** para cada metodo HTTP: GET /api/v1/projects/{projectId}/resources/productos, POST misma ruta, PUT o PATCH con /:id y DELETE con /:id. Define fields (key, label, type, required) y itemsPath=items para la lista. Admite buscar, editar y eliminar rutas con confirmacion. Rutas usadas en paginas no se eliminan sin desvincular.
4. Crear una pagina y agregar **Tabla HTTP**. En Servicios HTTP del inspector, seleccionar las rutas GET, POST, PUT/PATCH y DELETE.
5. Guardar borrador y Publicar como propietario. Runtime abre /p/{proyecto}/{codigo}. Desde la tabla puedes crear, editar y eliminar registros con el backend real.

Se conservan el constructor de entidades, inventario, servicios configurables, conexiones externas, permisos, sesiones y bloques existentes. No se cambiaron remotos ni se hizo push.

## Codigo y sincronizacion

El boton **Codigo** muestra TSX generado desde el arbol del editor. Los cambios visuales actualizan el codigo cuando no hay una edicion de codigo pendiente. **Aplicar codigo al diseno** valida y transforma TSX a nodos de Craft, conserva IDs, estilos, anidamiento y config, incluidos los IDs de servicios. Las modificaciones son explicitas para evitar sobreescribir mientras se escribe. Codigo invalido o no compatible informa el error sin modificar el diseno. Si cambian ambas representaciones antes de aplicar, se solicita resolver el conflicto usando descarga o regeneracion. Guardar y Ctrl+S rechazan codigo pendiente.

Contrato TSX v1: imports de ./builder-components, export default function Page con un unico return JSX; componentes del registro con builderId estable y config JSON. No soporta React arbitrario, hooks, variables, spreads, funciones, expresiones ejecutables ni imports externos. No se usa eval. El archivo descargado Page.tsx puede colocarse en src/ de Design o Runtime, que incluyen src/builder-components.tsx y el renderizador. Los componentes de datos requieren DataProvider del proyecto, igual que el Runtime dinamico. No es una exportacion standalone de todo el proyecto.

Cada panel permite exportar mediciones JSON de conversion (direccion, exito, duracion, nodos y errores). Descargar conserva el texto pendiente. El archivo generado no contiene credenciales.

## Verificar y reproducir el experimento

```powershell
npm run build
npm run lint
npm test
npm run test:experiment
npm run test:e2e
npm run format:check
```

El experimento escribe artifacts/sync-experiment.json con 150 observaciones: 50 conversiones visual a codigo, 50 codigo a visual y 50 rechazos controlados. Prueba la conservacion de conexiones. El E2E builder-flow.spec.ts verifica Nest, catalogo CRUD, sincronizacion en ambas direcciones y CRUD real de tabla en Runtime. La bateria de navegador usa bases temporales; no escribe en tu base local. Las pruebas de servidor viven exclusivamente en ../backend/tests.

Esto habilita el experimento tecnico sobre el subconjunto declarado; no demuestra facilidad de uso, ahorro de tiempo humano ni superioridad frente a IA. Ver docs/experiment.md y docs/contract.md.

## Probar el backend en Swagger

Disponible en http://localhost:3001/docs/. Crear un recurso desde Rutas y endpoints habilita su CRUD sin escribir un controlador. Registrar una ruta solo guarda su contrato. Para logica propia usar los servicios configurables o programar un controlador Nest. Swagger muestra los recursos en rutas parametrizadas: por ejemplo key=productos.
