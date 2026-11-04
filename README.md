# Frontend Builder · Design

Aplicación React + TypeScript estricto + Vite + React Router + Tailwind CSS 4. API HTTP local independiente del frontend, persistida en JSON. Node 22.13+ y npm.

## Ejecutar

```powershell
npm ci
Copy-Item .env.example .env
npm run dev:all
```

Design: http://localhost:5173. API: http://localhost:3001. Instalar y levantar Runtime desde su propio repositorio en otro terminal (`npm ci`, `npm run dev`). También pueden ejecutarse `npm run api` y `npm run dev` en terminales separados. Los puertos del frontend son estrictos, no se escoge otro si están ocupados.

## Configuración

- VITE_API_URL: base HTTP de la API (por defecto http://localhost:3001).
- VITE_RUNTIME_URL: base para abrir la página pública (http://localhost:5174).
- API_PORT / API_HOST: 3001 / 127.0.0.1. La API escucha solo en loopback por defecto.
- CORS_ORIGINS: lista de orígenes separados por comas; permite localhost y 127.0.0.1 en 5173/5174 por defecto. Reiniciar la API tras cambios.
- PAGES_FILE: archivo de datos opcional; las rutas relativas se resuelven desde el directorio de ejecución. Por defecto server/data/pages.json. Se crea al guardar la primera página. El archivo está excluido de Git; mantener copia de seguridad si se desea conservar trabajo.

Vite carga .env al arrancar; sus variables VITE_* son públicas y quedan integradas en el build. La API carga .env mediante el script npm.

## Uso

Crear una página desde Páginas, ingresar `Inicio` / `inicio`, agregar Heading, cambiar Texto a `Hola desde Frontend Builder` y pulsar **Guardar**. Esa única acción guarda y publica. Abrir http://localhost:5174/inicio. Editar el texto, Guardar nuevamente y recargar Runtime. Una página recién creada permanece en borrador hasta su primer guardado en el editor. Los cambios locales sin guardar no afectan la versión pública. Guardar nombre o código desde el listado también publica los cambios.

El editor permite insertar dentro del Container/Card seleccionado; seleccionar raíz para añadir fuera. Selección desde canvas o capas, flechas para reordenar hermanos, selector Mover a para anidar o volver a raíz. También se pueden arrastrar capas sobre un Container/Card. Vista previa renderiza el borrador sin controles de selección. Se incluyen vistas de escritorio/móvil, edición de propiedades y estilos. La navegación de salida avisa si hay cambios locales.

## Verificaciones

```powershell
npm run build
npm run lint
npm test
npx playwright install chromium
npm run test:e2e
```

E2E requiere Runtime instalado. Playwright inicia los tres servicios si no están activos, usa un código único y valida borrador/404 antes del primer guardado, publicación al guardar, aislamiento de cambios locales, actualización en Runtime y cambio de ruta desde el listado; elimina la página al finalizar. Captura del editor en test-results/editor.png. Para CI se recomienda PAGES_FILE temporal y puertos exclusivos. Vitest prueba API HTTP real con archivos temporales, concurrencia, validación, CORS, rutas anidadas, árbol y registro/renderizado.

## Arquitectura

- src/models: contrato y validación Zod.
- src/services: cliente HTTP configurable.
- src/state: operaciones puras sobre árboles.
- src/features/editor: editor visual.
- src/components: registro extensible y renderizado declarativo.
- server/app.ts: HTTP, CORS, validación y publicación.
- server/repository.ts: interfaz PageRepository y adaptador JSON con cola de transacciones y reemplazo de archivo mediante rename. Para PostgreSQL, implementar el repositorio con transacciones y restricciones únicas para borradores/rutas publicadas.

Endpoints: GET/POST /api/pages, GET/PUT/DELETE /api/pages/:id, GET /api/public/pages/by-path?path=/inicio. Errores JSON con message; 400 validación, 404 inexistente, 409 duplicado, 413 tamaño, 500 persistencia. Límite de cuerpo 1 MB. Las escrituras se serializan en un único proceso; el adaptador JSON no debe usarse con múltiples procesos.

**Solo desarrollo:** antes de desplegar esta API es obligatorio incorporar autenticación y autorización para todas las operaciones administrativas, incluyendo lectura, edición, publicación y eliminación. CORS no sustituye autenticación. No hay multitenancy. No exponer este servicio de desarrollo a Internet.

No hay monorepo, tercer repositorio, enlaces locales entre paquetes ni cambios de remotos. Consultar [contrato y evolución](docs/contract.md). Para producción, configurar fallback de rutas de SPA y desplegar un backend protegido con almacenamiento duradero.

## Formato y estructura

`npm run format` aplica Prettier y `npm run format:check` verifica la indentación (dos espacios), comillas simples y finales de línea LF. .editorconfig fija UTF-8. App.tsx contiene solo rutas; las páginas, componentes, hooks, modelos y servicios se mantienen separados.
