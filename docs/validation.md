# Validaciones de la primera entrega

Validado el 4 de noviembre de 2026 con Node 22.14.0 en Windows.

- TypeScript estricto y build de producción: correctos.
- ESLint: correcto.
- Prettier: formato consistente; dos espacios y comillas simples.
- Design: 6 pruebas Vitest (API HTTP, persistencia, aislamiento de publicación, validación, CORS, concurrencia, rutas anidadas, árbol y renderizador).
- Runtime: 2 pruebas Vitest (renderizado anidado, extensión del registro, tipos desconocidos y enlaces).
- E2E Chromium desde Design: creación en borrador, 404 antes del primer guardado, Heading, publicación con Guardar, aislamiento de cambios locales, actualización pública al volver a guardar y cambio de ruta al guardar metadatos desde el listado. La prueba borra su página.
- npm audit --omit=dev: cero vulnerabilidades en ambos repositorios.

La auditoría completa aún informa 11 avisos moderados en la cadena de ESLint/typescript-eslint/minimatch. Se actualizaron ESLint a 10 y Vitest a 5 para eliminar los avisos críticos iniciales. No se forzaron downgrades incompatibles ni sustituciones mayores de dependencias transitivas. Revisar las correcciones de upstream antes de usar esta cadena de herramientas en CI con entradas no confiables.

Vite muestra dos avisos de anotaciones PURE del paquete Zod; elimina esos comentarios y completa los builds. No son errores del código del proyecto.

Los servicios utilizados por Playwright se inician y cierran durante la prueba. Para trabajar, seguir el README de cada repositorio. No se realizaron commits, push ni cambios de remotos.
