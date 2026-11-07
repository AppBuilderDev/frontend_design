# AppBuilderDev · Design y backend

Builder para aplicaciones internas. Rama `build/inventario`. React, TypeScript, Craft.js y API Node con SQLite transaccional. Usar **Node 24 LTS** y npm; instalar las dependencias en ambos repositorios.

## Ejecutar

En este repositorio:

```powershell
npm ci
Copy-Item .env.example .env
npm run dev:all
```

En `../frontend_runtime`, ejecutar `npm ci` y `npm run dev`. Abrir **http://localhost:5173/workspace**. Usar siempre el mismo nombre de host en ambas aplicaciones (localhost o 127.0.0.1) para compartir la sesión.

1. Crear una cuenta y organización; se crea su único proyecto privado.
2. En **Datos**, pulsar **Comenzar con inventario**: categorías, unidades y productos relacionados. Crear categorías y unidades antes de los productos. También se pueden definir otras entidades y campos.
3. En **Servicios**, consultar los contratos y probar las operaciones generadas.
4. Crear una página, insertar `DataTable`, `DataForm` o `DataDetail` y seleccionar su entidad en **Conexión de datos**. Un formulario puede crear o editar la selección de la tabla.
5. **Guardar** conserva el borrador. **Publicar**, disponible solo para el propietario, actualiza Runtime. El enlace abre `http://localhost:5174/p/{proyecto}/{ruta}`. Las páginas y sus datos requieren acceso al proyecto.
6. En **Equipo y proyecto**, el propietario genera invitaciones para editores o lectores y comparte el enlace con la persona invitada. Se puede archivar y restaurar el proyecto.

El editor conserva el arrastre, anidamiento, historial, bloques reutilizables, propiedades, alineación y espaciado. Ctrl+S guarda el borrador en el modo nuevo. La vista previa del editor permite consultar pero desactiva escrituras de registros.

## Datos y configuración

- `PLATFORM_DB`: SQLite, por defecto `server/data/platform.sqlite`; ignorado por Git. Es persistencia local de un único proceso de API. Las transacciones, claves de organización y revisiones previenen escrituras parciales y sobrescrituras obsoletas.
- `API_HOST` / `API_PORT`: por defecto 127.0.0.1:3001.
- `PLATFORM_API_TARGET`: destino del proxy Vite `/api/v1`, por defecto http://127.0.0.1:3001. En producción se necesita un proxy inverso equivalente.
- `VITE_RUNTIME_URL`: dirección de Runtime. `VITE_PLATFORM_API_URL` solo si se necesita una base diferente compatible con cookies y CORS; el valor normal es vacío.
- `CORS_ORIGINS`: orígenes permitidos, sin comodines. No reemplaza los permisos.
- Sesión de ocho horas mediante cookie HttpOnly. Con `NODE_ENV=production`, cookie Secure y HTTPS obligatorio. No hay tokens en localStorage.

Los archivos anteriores `pages.json` y `blocks.json` permanecen intactos. **No se importan ni se asignan automáticamente a ninguna organización**. Para consultar el sistema anterior, ver [referencia histórica](docs/legacy.md); su API está desactivada por defecto. No habilitar ese modo en un despliegue compartido.

## Validar

```powershell
npm run build
npm run lint
npm test
npx playwright install chromium
npm run test:e2e
npm run format:check
```

El recorrido E2E inicia API, Design y Runtime en 3101/5183/5184 con una base temporal aislada. Prueba registro, relaciones, centavos, creación de datos, servicios, conexión en Craft y publicación a Runtime. Los escenarios históricos quedan en `npm run test:e2e:legacy`; requieren puertos 3001/5173/5174 libres o servicios arrancados con las dos opciones legacy.

## Estructura

- `server/platform`: autenticación, autorización, almacenamiento SQLite, servicios, publicación y copia de seguridad.
- `src/features/workspace`: organización/proyecto, páginas, datos, servicios y equipo.
- `src/features/editor`: editor Craft y adaptador al árbol JSON público.
- `src/models`: contratos de páginas, entidades y validaciones.
- `src/components/dataComponents.tsx`: formulario, tabla, detalle y contexto de selección compartido con Runtime.
- `src/services`: cliente HTTP y ámbito del proyecto.
- `tests` / `e2e-platform`: verificaciones de API, permisos, persistencia y recorrido en navegador.

[Decisiones, requisitos y etapas](docs/build-plan.md) · [Operación y recuperación](docs/operations.md).

## Inventario operativo (E2)

En **Inventario**, el propietario conecta el catálogo existente. Después puede registrar entradas/salidas, ajustes justificados, configurar mínimos y consultar historial. **Equipo y proyecto** administra los permisos operativos independientes y las invitaciones para usar la aplicación sin construirla. Publicar el componente `Inventory` lleva el mismo flujo a Runtime. Los saldos empiezan en cero y no se modifican los registros anteriores.

[Guía de inventario, servicios, permisos y compatibilidad](docs/inventory-operations.md).

## Servicios configurables (E3-A)

En **Servicios**, crea una operación con entradas, consultas, condiciones y escrituras. **Simular** revierte todos los cambios. El propietario publica una versión; un componente `ServiceForm` permite ejecutarla desde Runtime. Las páginas mantienen su versión hasta republicarse, y se pueden consultar impacto y últimas ejecuciones. El almacenamiento anterior se conserva.

[Guía del diseñador, permisos, versiones y recuperación](docs/configurable-services.md).
