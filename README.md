# Frontend Builder · Design

Aplicación React + TypeScript estricto + Vite + React Router + Tailwind CSS 4 + Craft.js. API HTTP local independiente del frontend, persistida en JSON. Node 22.13+ y npm.

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
- BLOCKS_FILE: archivo opcional de bloques reutilizables; por defecto `blocks.json` junto a PAGES_FILE.
- PAGES_FILE: archivo de datos opcional; las rutas relativas se resuelven desde el directorio de ejecución. Por defecto server/data/pages.json. Se crea al guardar la primera página. El archivo está excluido de Git; mantener copia de seguridad si se desea conservar trabajo.

Vite carga .env al arrancar; sus variables VITE_* son públicas y quedan integradas en el build. La API carga .env mediante el script npm.

## Uso

Crear una página desde Páginas, ingresar `Inicio` / `inicio`, agregar Heading, cambiar Texto a `Hola desde Frontend Builder` y pulsar **Guardar**. Esa única acción guarda y publica. Abrir http://localhost:5174/inicio. Editar el texto, Guardar nuevamente y recargar Runtime. Una página recién creada permanece en borrador hasta su primer guardado en el editor. Los cambios locales sin guardar no afectan la versión pública. Guardar nombre o código desde el listado también publica los cambios.

El editor permite insertar dentro del Container/Card seleccionado; seleccionar raíz para añadir fuera. Selección desde canvas o capas, flechas para reordenar hermanos, selector Mover a para anidar o volver a raíz. Craft.js permite arrastrar componentes del catálogo al lienzo, reordenarlos y anidarlos dentro de Container/Card. Para mover componentes existentes, usar el tirador sobre el componente seleccionado o arrastrar desde una fila de capas hasta el lienzo. La línea violeta indica una inserción válida y la roja un destino inválido. Deshacer/Rehacer recupera cambios de contenido y estructura; volver al estado guardado elimina el aviso de cambios pendientes. Vista previa renderiza el borrador sin controles de selección. Se incluyen vistas de escritorio/móvil, edición de propiedades y estilos. La navegación de salida avisa si hay cambios locales.

## Verificaciones

```powershell
npm run build
npm run lint
npm test
npx playwright install chromium
npm run test:e2e
```

E2E requiere Runtime instalado. Playwright inicia los tres servicios si no están activos, usa un código único y valida borrador/404 antes del primer guardado, publicación al guardar, aislamiento de cambios locales, actualización en Runtime y cambio de ruta desde el listado; elimina la página al finalizar. Capturas del editor en test-results/editor.png y test-results/craft-editor.png. La prueba Craft valida arrastre real desde el catálogo, anidamiento, movimiento de nodos, historial, reordenamiento, vista previa, recarga y publicación compatible con Runtime. Para CI se recomienda PAGES_FILE temporal y puertos exclusivos. Vitest prueba API HTTP real con archivos temporales, concurrencia, validación, CORS, rutas anidadas, árbol y registro/renderizado.

## Arquitectura

- src/models: contrato y validación Zod.
- src/services: cliente HTTP configurable.
- src/state: operaciones puras sobre árboles.
- src/features/editor: editor visual con Craft.js como estado de edición.
- src/features/editor/craft: componentes conectados y adaptador entre el árbol público y los nodos internos de Craft; no se persiste el formato de Craft ni se requiere migrar páginas.
- src/components: registro extensible y renderizado declarativo.
- server/app.ts: HTTP, CORS, validación y publicación.
- server/repository.ts: interfaz PageRepository y adaptador JSON con cola de transacciones y reemplazo de archivo mediante rename. Para PostgreSQL, implementar el repositorio con transacciones y restricciones únicas para borradores/rutas publicadas.

Endpoints: GET/POST /api/pages, GET/PUT/DELETE /api/pages/:id, GET /api/public/pages/by-path?path=/inicio. Errores JSON con message; 400 validación, 404 inexistente, 409 duplicado, 413 tamaño, 500 persistencia. Límite de cuerpo 1 MB. Las escrituras se serializan en un único proceso; el adaptador JSON no debe usarse con múltiples procesos.

**Solo desarrollo:** antes de desplegar esta API es obligatorio incorporar autenticación y autorización para todas las operaciones administrativas, incluyendo lectura, edición, publicación y eliminación. CORS no sustituye autenticación. No hay multitenancy. No exponer este servicio de desarrollo a Internet.

No hay monorepo, tercer repositorio, enlaces locales entre paquetes ni cambios de remotos. Consultar [contrato y evolución](docs/contract.md). Para producción, configurar fallback de rutas de SPA y desplegar un backend protegido con almacenamiento duradero.

## Formato y estructura

`npm run format` aplica Prettier y `npm run format:check` verifica la indentación (dos espacios), comillas simples y finales de línea LF. .editorconfig fija UTF-8. App.tsx contiene solo rutas; las páginas, componentes, hooks, modelos y servicios se mantienen separados.

## Herramientas del editor

- La ruta sobre el lienzo permite seleccionar Página o cualquier componente padre.
- Acciones rápidas: duplicar con todos los hijos, copiar, pegar, eliminar y guardar como bloque. Las copias reciben identificadores nuevos y son independientes.
- Atajos: Ctrl/⌘ D duplica; Ctrl/⌘ C y V copian/pegan; Ctrl/⌘ Z deshace; Ctrl/⌘ Mayús Z o Ctrl Y rehace; Supr elimina; Escape selecciona el padre; Alt ↑/↓ reordena; Ctrl/⌘ S guarda y publica. Los campos de texto conservan sus atajos de edición. El portapapeles del sistema requiere permiso del navegador; los botones usan una copia de sesión como alternativa si el acceso no está disponible.
- Durante el arrastre, se resalta el contenedor de destino y se muestra el punto de inserción. Mantener el puntero cerca de los bordes superior o inferior desplaza el lienzo.
- Propiedades: selectores de color, medidas numéricas con unidades o valores CSS manuales, espaciado por lado y controles Flexbox/cuadrícula para Container y Card. Runtime interpreta los mismos estilos.
- La pestaña Bloques ofrece Encabezado, Presentación, Contacto y Pie de página. Contacto es una estructura visual de campos; sus acciones de datos se configurarán con los futuros servicios.
- «Guardar como bloque» conserva una selección y sus hijos en la API, independientemente de guardar/publicar la página. La biblioteca se conserva al recargar y puede usarse desde otras páginas. Insertar genera una copia; editarla o borrar el bloque de la biblioteca no cambia las páginas existentes.

API de bloques administrativos: GET/POST `/api/blocks`, DELETE `/api/blocks/:id`. Se valida el árbol y se persiste en JSON con la misma cola de transacciones y reemplazo atómico usados para páginas. Se reintentan brevemente bloqueos temporales de archivos de Windows. Reiniciar `npm run api` tras actualizar el código del servidor.

La propuesta para crear endpoints propios con datos está en [servicios de datos](docs/data-services.md).
