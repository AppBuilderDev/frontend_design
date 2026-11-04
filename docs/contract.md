# Contrato Frontend Builder v1

`src/models/contracts.ts` y `src/components/renderer.tsx` son equivalentes en ambos repositorios. No existen imports entre repositorios ni dependencias de un workspace. El contrato declara `CONTRACT_VERSION = 1`; en esta fase la versión se acuerda a nivel de código, no se negocia por HTTP.

Una página contiene id, name, code, status (draft | published), components, createdAt y updatedAt. Los nodos contienen id, type, props JSON y children opcional. Se permiten hasta 500 nodos y profundidad 20. Los IDs deben ser únicos dentro de la página. El código es una secuencia de segmentos en minúsculas con números y guiones. api, admin, editor, preview y assets son prefijos reservados.

Registro inicial: Container (hijos), Card (title, hijos), Heading (text, level h1/h2/h3), Paragraph (text), Button (text, href), Input (label, placeholder, inputType). Todos admiten color, backgroundColor, padding, margin, borderRadius, fontSize, textAlign y maxWidth, expresados como strings CSS. No se interpreta JSX ni HTML. Los enlaces aceptan http, https, rutas locales y anchors. Un tipo desconocido produce un aviso visible. `registerComponent(type, componente)` permite extensiones sin modificar RenderTree; debe invocarse en el arranque de cada aplicación que lo utilice.

## Publicación

La interfaz tiene una sola acción **Guardar**, que envía status=published y actualiza la versión pública de inmediato. Crear una página genera el borrador inicial; su primer guardado en el editor la publica. Guardar nombre o código desde el listado también publica. La API conserva la posibilidad de guardar borradores para futuras integraciones, sin exponer un botón adicional en el editor.

GET /api/pages devuelve borradores administrativos. PUT con status=draft guarda sin cambiar la copia publicada. PUT con status=published guarda y reemplaza esa copia de forma atómica. El endpoint público solo consulta copias publicadas; no expone borradores. Al cambiar el código, la ruta pública anterior sigue activa hasta republicar y su código queda reservado. Al republicar se reemplaza la ruta anterior. DELETE elimina ambas versiones. No se incluye despublicación en esta fase.

## Evolución

Extraer contratos, esquemas de validación, renderizador y pruebas de conformidad a un paquete privado `@frontend-builder/contracts` con SemVer, consumido por cada repositorio mediante una versión fijada. Añadir schemaVersion en la persistencia/respuestas antes de cambiar el formato, migraciones explícitas, matriz de compatibilidad y CI de conformidad. Mientras tanto, mantener estos archivos equivalentes y revisar cambios coordinadamente. El editor no forma parte del paquete compartido.

No se implementa federación de módulos: Design y Runtime son aplicaciones desplegables independientes que comparten datos vía HTTP. Un futuro microfrontend de componentes puede registrarse en el bootstrap, con manifest y versiones verificadas.
