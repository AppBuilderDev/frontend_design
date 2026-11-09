# AppBuilderDev Design

Frontend React, TypeScript, Vite y Craft.js. El servidor y las pruebas de dominio se trasladaron al repositorio ../backend. Este repositorio no contiene persistencia ni credenciales del backend.

Usar Node 24. Iniciar primero npm run dev en ../backend y npm run dev en ../frontend_runtime. Aqui instalar con npm ci y ejecutar npm run dev. Design: http://localhost:5173/workspace, Runtime: http://localhost:5174, API: http://localhost:3001.

Copiar .env.example a .env si no existe. PLATFORM_API_TARGET configura el proxy /api/v1; VITE_RUNTIME_URL configura el enlace a Runtime. Mantener el mismo host en ambos frontends para compartir la sesion.

Se preservan el editor visual, paginas, entidades, inventario, servicios, conexiones y equipo. Guardar conserva el borrador; Publicar requiere rol propietario y actualiza Runtime.

Verificar con npm run build, npm run lint y npm test. npm run test:e2e inicia el backend separado y ambos frontends con SQLite temporal. Las pruebas del servidor viven en ../backend/tests.
