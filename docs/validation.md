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

## Integración Craft.js — 5 de noviembre de 2026

- Craft.js 0.2.12 integrado en Design; Runtime conserva su dependencia exclusiva del contrato público v1.
- Build TypeScript/Vite, ESLint y Prettier: correctos en ambos repositorios.
- Design: 8 pruebas Vitest; se añaden conversiones de ida y vuelta entre páginas v1 y Craft, preservación de IDs (incluido ROOT), componentes desconocidos, propiedades, hijos heredados y exportación de nuevos nodos y movimientos.
- Runtime: 2 pruebas Vitest correctas tras reutilizar ComponentView para el renderizado individual. Los renderizadores de ambos repositorios siguen siendo equivalentes.
- Chromium: 2 pruebas E2E correctas. Se conserva el flujo original de publicación y se valida arrastre desde catálogo y capas, anidamiento, tirador del lienzo, deshacer/rehacer, reordenamiento por flechas, vista previa, eliminación y recuperación, estado de cambios pendientes, recarga y publicación compatible con Runtime.
- La prueba Craft comprueba que no hay excepciones JavaScript y que el JSON público no contiene el formato interno de Craft; elimina su página al terminar.
- npm audit --omit=dev en Design: cero vulnerabilidades tras añadir Craft.js.
- Captura de revisión visual: test-results/craft-editor.png.

## Mejoras de edición y biblioteca — 5 de noviembre de 2026

- Design: 15 pruebas Vitest, incluidas clonación independiente, portapapeles validado, biblioteca persistente y recuperación de fallos de escritura.
- Runtime: 3 pruebas Vitest, incluidas distribución y espaciado por lado.
- Chromium: 5 pruebas E2E. Se conservan los flujos previos y se validan duplicación de árboles, copiar/pegar, atajos y protección de campos de texto, navegación por padres, selección tras deshacer/rehacer, bloques entre páginas, estilos publicados y desplazamiento automático con arrastre real.
- Guardado JSON: prueba de EPERM/EBUSY temporal, reintentos limitados, limpieza del archivo temporal, conservación del archivo anterior ante fallo permanente y recuperación de la cola para la siguiente transacción.
- Espaciado: se comprueba en navegador que cambiar padding general no sobrescribe un lado explícito.
- Captura revisada: test-results/editor-tools.png.
- Build, ESLint, formato y diff sin errores en ambos repositorios.
- La creación visual de servicios de datos propios queda documentada como propuesta en data-services.md.
