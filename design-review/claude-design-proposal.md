# Propuesta de diseño: AppBuilderDev Builder

## 0. Herramienta usada

**No había Claude Design disponible.** Revisé las skills y herramientas de la sesión y ninguna se llama Claude Design ni hace ese trabajo. Durante la sesión se conectó Canva, pero no es Claude Design, y usarlo habría enviado datos del proyecto a un servicio externo, así que no lo usé. Toda la propuesta sale de mi propio criterio de diseño como Claude Code. Me basé solo en estos archivos: `workspace-theme.css`, `Workspace.tsx`, `WorkspacePages.tsx`, `WorkspaceRoutes.tsx`, `PageTable.tsx`, `EditorToolbar.tsx`, `EditorLibrary.tsx` y `PropertiesPanel.tsx`. No modifiqué nada.

**Qué falla hoy:** casi todo es blanco o `#f7f8fb` y hay un solo acento violeta (`#6352df`). Las etiquetas son de 10–11px en gris (`.eyebrow`, `.library-hint`). Las sombras están en `none`. Los métodos HTTP se ven como `<code>` plano y el estado "Sin guardar" luce igual que "Guardado".

---

## 1. Tres direcciones

**A · «Tinta y Señal» (recomendada).** Barra lateral de tinta oscura, área de trabajo en papel cálido y un azul cobalto para las acciones. Un coral marca dónde estás: navegación activa, eyebrows y elementos básicos. Un verde azulado identifica todo lo que está conectado a datos. Se ve editorial y profesional, con contraste real y sin degradados.

**B · «Plano técnico».** Fondo gris azulado frío (`#EEF2F7`), canvas con cuadrícula de 8px y acento cian `#0B7FAB`. Todo en monoespaciada salvo los títulos. Encaja con la parte de endpoints y TSX, pero es fría y se parece demasiado a una herramienta para desarrolladores.

**C · «Estudio terracota».** Neutros cálidos (`#F7F1EA`), acción en terracota `#B4441F` y éxito en oliva `#4F6B2A`. Es expresiva y amable, pero el terracota choca con el rojo de peligro y hace más ambiguas las acciones destructivas.

**Por qué A:** distingue tres funciones con tres colores (navegar, actuar, datos) y no se acerca al "dashboard de IA morado". Además se implementa casi solo con CSS sobre las clases que ya existen.

---

## 2. Tokens (dirección A)

| Token                          | Hex                   | Uso                                                                                   |
| ------------------------------ | --------------------- | ------------------------------------------------------------------------------------- |
| `--bg-app`                     | `#F4F2EC`             | fondo del shell y de la página                                                        |
| `--bg-sunken`                  | `#ECE9E1`             | área del canvas, vacíos, chips neutros                                                |
| `--panel`                      | `#FFFFFF`             | tarjetas, tabla, paneles del editor                                                   |
| `--sidebar`                    | `#141A29`             | nav lateral y toolbar del editor                                                      |
| `--sidebar-2`                  | `#1E2638`             | ítem activo, select de proyecto                                                       |
| `--sidebar-line`               | `#2B3449`             | bordes sobre fondo oscuro                                                             |
| `--sidebar-text`               | `#C3CAD8`             | texto de la nav                                                                       |
| `--ink`                        | `#161C2B`             | texto principal                                                                       |
| `--ink-2`                      | `#434C61`             | texto secundario                                                                      |
| `--muted`                      | `#5F6779`             | metadatos (≥4.5:1 sobre el papel)                                                     |
| `--border`                     | `#DCD7CB`             | bordes                                                                                |
| `--border-strong`              | `#C4BEB0`             | inputs y botón secundario                                                             |
| `--action`                     | `#2448D8`             | botón primario y foco (blanco encima: 6.6:1)                                          |
| `--action-hover`               | `#1A37B0`             | hover del primario                                                                    |
| `--action-soft`                | `#E6EBFC`             | botón tint, toggles activos                                                           |
| `--signal`                     | `#FF6A3D`             | barra activa y puntos (solo sobre oscuro o como forma, nunca como texto sobre blanco) |
| `--signal-ink`                 | `#B8431C`             | eyebrows y texto coral sobre claro                                                    |
| `--signal-soft`                | `#FDECE5`             | fondo de iconos "Básicos"                                                             |
| `--data` / `--data-soft`       | `#0E7C66` / `#DDF3EC` | categoría "Con tus datos"                                                             |
| `--success` / `--success-soft` | `#1E7F4F` / `#E3F3EA` | publicado, guardado                                                                   |
| `--warning` / `--warning-soft` | `#9A5B00` / `#FDF0D9` | borrador, sin guardar                                                                 |
| `--danger` / `--danger-soft`   | `#C2362B` / `#FBE6E3` | eliminar, errores                                                                     |

**Métodos HTTP** (texto sobre fondo suave):

| Método | Texto     | Fondo     |
| ------ | --------- | --------- |
| GET    | `#0E7C66` | `#DDF3EC` |
| POST   | `#2448D8` | `#E6EBFC` |
| PUT    | `#9A5B00` | `#FDF0D9` |
| PATCH  | `#6B3FC4` | `#EEE7FB` |
| DELETE | `#C2362B` | `#FBE6E3` |

El método siempre se muestra escrito, así que no depende solo del color.

**Tipografía** (fuentes locales, sin dependencias nuevas):

- UI: `"Segoe UI Variable Text", "Segoe UI", system-ui, -apple-system, sans-serif`
- Mono: `"Cascadia Code", Consolas, ui-monospace, monospace`

**Escala:**

| Elemento          | Tamaño / peso                    |
| ----------------- | -------------------------------- |
| Título h1         | 30px / 700, `-0.02em`            |
| Título de sección | 16px / 650                       |
| Cuerpo            | 14px                             |
| Tabla             | 13.5px                           |
| Metadatos         | 12.5px                           |
| Eyebrow           | 11px / 700, mayúsculas, `0.08em` |

Ningún texto debe quedar por debajo de 11px; eso sube `.library-hint`, que hoy está en 10px.

**Forma y profundidad:**

- Radios: 8px en controles, 12px en paneles y tarjetas.
- `--shadow-1`: `0 1px 2px #161C2B0F, 0 2px 8px #161C2B0A`
- `--shadow-pop`: `0 12px 32px #161C2B29`

---

## 3. Especificaciones por pantalla

### Barra lateral (`.workspace-nav`)

- Fondo `--sidebar`, 248px de ancho.
- `.workspace-brand`: texto blanco, `.brand-dot` en `--signal`.
- `.workspace-org`: 11px, mayúsculas, `#8D95A8`.
- `.project-switch select`: fondo `--sidebar-2`, borde `--sidebar-line`, texto blanco, 36px de alto.
- Enlaces de `nav a`: 40px de alto, radio 8px, texto `--sidebar-text`.
  - Hover: fondo `#1A2133`.
  - `.active`: fondo `--sidebar-2`, texto blanco y barra coral (`box-shadow: inset 3px 0 0 var(--signal)`). El icono activo también va en coral.
- `.workspace-account`: anclada abajo con `margin-top: auto` y borde superior `--sidebar-line`. Botón "Cerrar sesión" en estilo ghost claro.

### Cabecera (`.workspace-header`)

- 56px, fondo blanco y borde inferior.
- Nombre del proyecto en 15px / 650.
- `.privacy-pill` como chip: fondo `--bg-sunken`, texto `--ink-2`, radio 999px, icono en `--success`.

### Resumen de páginas (`WorkspacePages`)

1. **Encabezado.** `.eyebrow` en `--signal-ink`, h1 a 30px y botón primario «Crear página» a la derecha.
2. **Fila de estadísticas `.page-stats`** (nueva, solo marcado). Cuatro tarjetas que se calculan de `state.pages`:
   - **Total:** `pages.length`.
   - **Publicadas:** cantidad con `status === 'published'`. Va con un punto `--success`.
   - **Borradores:** el resto. Va con un punto `--warning`.
   - **Última edición:** la fecha más reciente de `updatedAt`, con el mismo formato `es` que ya usa la tabla.

   Cada tarjeta: número en 26px / 700 y etiqueta en 12.5px `--muted`. Se ocultan mientras `loading` y también con 0 páginas, porque el estado vacío ya lo explica. No se muestran tendencias ni porcentajes inventados.

3. **`.context-tip`.** Fondo `--panel`, borde `--border`, barra izquierda de 3px en `--signal` y `strong` en `--ink`. Desaparece el lavanda.

### Listado de páginas (`.page-table`)

- Panel blanco, radio 12px, `--shadow-1`.
- `.table-toolbar` con `.count` como chip (`--bg-sunken`, 12px / 650). La búsqueda pasa a medir 280px y el foco usa un anillo `--action`.
- `th`: 11.5px / 650, mayúsculas, `--muted`, fondo `#FAF9F6`.
- Filas: 56px de alto. Hover en `#FAF8F3`. Al hacer foco con teclado dentro de la fila (`:focus-within`), la fila recibe un borde interior `--action`.
- `.file-icon`: cuadrado de 32px, radio 8px.
  - Publicada: fondo `--success-soft`.
  - Borrador: fondo `--warning-soft`.
  - Requiere poner `data-status` en el `<tr>`.
- `.published-route code`: mono 12.5px, chip `--bg-sunken`. La flecha aparece en hover.
- `.badge.published`: texto `--success` sobre `--success-soft`. `.badge.draft`: texto `--warning` sobre `--warning-soft`. Radio 999px. Los caracteres ●/◌ se mantienen.
- `.editor-link` «Diseñar»: botón tint (`--action-soft` con texto `--action-hover`).
- Botones lápiz y papelera: ghost de 32px. La papelera en hover usa `--danger` sobre `--danger-soft`.
- `.table-footer`: 12.5px `--muted` sobre `#FAF9F6`.

### Estados

- **Carga.** Se conserva el `role="status"` y su texto, que se vuelve visualmente oculto. Debajo van tres filas skeleton (`.skeleton-row`, barras `--bg-sunken`) con brillo animado. Con movimiento reducido, las barras quedan estáticas.
- **Vacío.** `.empty` con borde punteado `--border-strong` sobre `--bg-sunken`, radio 12px y padding 48px. El icono va en un círculo de 56px `--signal-soft` en `--signal-ink`. h3 en 18px. Con búsqueda sin resultados, se usa el mismo bloque con icono neutro.
- **Error.** `.alert`: fondo `--danger-soft`, barra izquierda de 3px `--danger`, texto `--ink`. «Reintentar» como botón secundario.
- **Aviso.** `.notice`: toast abajo a la derecha, fondo `--sidebar`, texto blanco, punto `--success`, `--shadow-pop`.

### Jerarquía de botones

| Nivel      | Estilo                                            | Dónde se usa                               |
| ---------- | ------------------------------------------------- | ------------------------------------------ |
| Primario   | sólido `--action`                                 | Crear página, Publicar                     |
| Secundario | blanco con borde `--border-strong`, texto `--ink` | Guardar borrador, Reintentar               |
| Tint       | `--action-soft`                                   | Diseñar, toggles con `aria-pressed="true"` |
| Ghost      | icono, sin fondo                                  | Editar, deshacer/rehacer                   |
| Peligro    | sólido `--danger`                                 | solo en el diálogo de eliminar             |

Por vista debe haber como máximo un botón primario.

### Endpoints (`WorkspaceRoutes`)

- `<code className={'method method-' + e.method.toLowerCase()}>`
- Estilo: mono 11px / 700, ancho mínimo 60px, centrado, radio 6px, colores de la tabla de métodos.
- La ruta va en un chip mono neutro.

### Editor de tres paneles

- **Toolbar** (`.editor-toolbar`): fondo `--sidebar` para continuar la barra lateral.
  - Texto `#E6E9F0`. Botones con borde `--sidebar-line` y fondo transparente. «Publicar» en `--action`.
  - `.editor-save-state` con `data-state`. Si está `dirty`: punto y texto `#F5B455` («Sin guardar»). Si está guardado: punto `#5BD69A`.
  - El botón «Código» con `aria-pressed="true"` usa fondo `--sidebar-2` y texto blanco.
- **Biblioteca** (`.studio-library`): blanca. `.classic-tabs` activa con `--action-soft` y texto `--action-hover`.
  - Cada `section` lleva `data-group="basic|data"`. El h3 es un eyebrow de 11px / 700 con punto de 6px del color del grupo.
  - Tiles de `.element-list button`: 76px de alto, radio 10px. El icono va en un cuadrado de 32px tintado (`--signal-soft` en Básicos, `--data-soft` en Con tus datos).
  - Hover: borde del color del grupo y `translateY(-1px)`.
- **Canvas** (`.canvas-area`): fondo `--bg-sunken` con puntos (`radial-gradient(#D3CEC2 1px, transparent 1px) 0 0/16px 16px`).
  - `.canvas` mantiene fondo blanco, radio 12px y pasa a `--shadow-1`.
  - **No se toca nada dentro de `.canvas`**: los estilos de página y componentes del usuario se respetan.
  - `.canvas-toolbar` en 12px `--ink-2`.
- **Inspector** (`.editor-right`): blanco, borde izquierdo `--border`.
  - `.studio-panel-heading h2` en 15px / 700.
  - `.panel-heading` como eyebrow de 11px / 700 `--ink-2` con borde superior y 16px de separación.
  - Los bloques de conexión («Servicios HTTP», «Conexión de datos/servicio/externa») llevan un marcador lateral `--data`. Para eso hace falta `data-kind="data"` en el contenedor.
  - Inputs de 36px, radio 8px, foco `--action`.

### Móvil, teclado y movimiento

- **≤960px.** La barra lateral pasa a ser una barra superior oscura: marca y select arriba, y la nav con scroll horizontal (`overflow-x:auto`, `scroll-snap`). `.page-stats` en 2×2. Se mantiene `.table-scroll`.
- **Editor en móvil.** Se respetan los paneles superpuestos y `.mobile-panel-close`. Se añade `--shadow-pop` y un fondo semitransparente `#141A2966`.
- **Teclado.** `:focus-visible` con 2px `--action` y offset de 2px. Sobre fondos oscuros, 2px `--signal`. El `.skip-link` usa `--action`. Los tiles de la biblioteca ya son `<button>`, así que funcionan con Enter.
- **Movimiento reducido.** Con `@media (prefers-reduced-motion: reduce)` se desactivan las transiciones, el `translateY` y el brillo del skeleton.

---

## 4. Doce prioridades de implementación

1. Tokens nuevos en `:root` de `workspace-theme.css`, sustituyendo los `--ui-*` y manteniendo esos nombres como alias.
2. Barra lateral oscura y estado activo con barra coral.
3. Jerarquía de botones (primario, secundario, tint, ghost, peligro) en `.workspace-content` y `.classic-editor`.
4. Badges de estado y `data-status` en las filas de `PageTable.tsx`.
5. `.page-stats` en `WorkspacePages.tsx`, derivada de `state.pages`.
6. Badges de método en `WorkspaceRoutes.tsx:134`.
7. Toolbar del editor oscura y `data-state` en `.editor-save-state` (`EditorToolbar.tsx:64`).
8. `data-group` y tiles con acento en `EditorLibrary.tsx:111`.
9. Fondo punteado del canvas, sin tocar el contenido de `.canvas`.
10. Encabezados del inspector y marcador `data-kind` en los bloques de conexión.
11. Estados de carga, vacío, error y aviso.
12. Responsive ≤960px, foco y movimiento reducido. Al final, verificar contraste con la app en marcha.

---

## 5. Esbozo de CSS

```css
:root {
  --bg-app: #f4f2ec;
  --bg-sunken: #ece9e1;
  --panel: #fff;
  --sidebar: #141a29;
  --sidebar-2: #1e2638;
  --sidebar-line: #2b3449;
  --sidebar-text: #c3cad8;
  --ink: #161c2b;
  --ink-2: #434c61;
  --muted: #5f6779;
  --border: #dcd7cb;
  --border-strong: #c4beb0;
  --action: #2448d8;
  --action-hover: #1a37b0;
  --action-soft: #e6ebfc;
  --signal: #ff6a3d;
  --signal-ink: #b8431c;
  --signal-soft: #fdece5;
  --data: #0e7c66;
  --data-soft: #ddf3ec;
  --success: #1e7f4f;
  --success-soft: #e3f3ea;
  --warning: #9a5b00;
  --warning-soft: #fdf0d9;
  --danger: #c2362b;
  --danger-soft: #fbe6e3;
  --shadow-1: 0 1px 2px #161c2b0f, 0 2px 8px #161c2b0a;
  --font-ui: 'Segoe UI Variable Text', 'Segoe UI', system-ui, sans-serif;
  --font-mono: 'Cascadia Code', Consolas, ui-monospace, monospace;
  --ui-ink: var(--ink);
  --ui-muted: var(--muted);
  --ui-accent: var(--action);
  --ui-border: var(--border);
  --ui-paper: var(--bg-app);
}
.workspace-shell {
  font-family: var(--font-ui);
  background: var(--bg-app);
  color: var(--ink);
}
.workspace-nav {
  background: var(--sidebar);
  border-color: var(--sidebar-line);
  color: var(--sidebar-text);
}
.workspace-nav nav a {
  min-height: 40px;
  border-radius: 8px;
  color: var(--sidebar-text);
}
.workspace-nav nav a.active {
  background: var(--sidebar-2);
  color: #fff;
  box-shadow: inset 3px 0 0 var(--signal);
}
.workspace-nav nav a.active svg,
.brand-dot {
  color: var(--signal);
}
.eyebrow {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.08em;
  color: var(--signal-ink);
}
.page-stats {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
  margin: 0 0 20px;
}
.page-stats > div {
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 16px;
  box-shadow: var(--shadow-1);
}
.page-stats strong {
  display: block;
  font-size: 26px;
  font-weight: 700;
}
.badge.published {
  color: var(--success);
  background: var(--success-soft);
}
.badge.draft {
  color: var(--warning);
  background: var(--warning-soft);
}
.method {
  font: 700 11px var(--font-mono);
  min-width: 60px;
  text-align: center;
  border-radius: 6px;
  padding: 3px 6px;
}
.method-get {
  color: #0e7c66;
  background: #ddf3ec;
}
.method-post {
  color: #2448d8;
  background: #e6ebfc;
}
.method-put {
  color: #9a5b00;
  background: #fdf0d9;
}
.method-patch {
  color: #6b3fc4;
  background: #eee7fb;
}
.method-delete {
  color: #c2362b;
  background: #fbe6e3;
}
.workspace-content .editor-link {
  background: var(--action-soft);
  color: var(--action-hover);
  border-radius: 8px;
}
.classic-editor .editor-toolbar {
  background: var(--sidebar);
  color: #e6e9f0;
  border-color: var(--sidebar-line);
}
.classic-editor .editor-toolbar button {
  background: transparent;
  color: #e6e9f0;
  border-color: var(--sidebar-line);
}
.editor-save-state[data-state='dirty'] {
  color: #f5b455;
}
.editor-save-state[data-state='saved'] {
  color: #5bd69a;
}
.element-groups section[data-group='basic'] {
  --grp: var(--signal-ink);
  --grp-soft: var(--signal-soft);
}
.element-groups section[data-group='data'] {
  --grp: var(--data);
  --grp-soft: var(--data-soft);
}
.element-list button svg {
  box-sizing: content-box;
  padding: 6px;
  border-radius: 8px;
  background: var(--grp-soft);
  color: var(--grp);
}
.element-list button:hover {
  border-color: var(--grp);
  color: var(--grp);
  transform: translateY(-1px);
}
.classic-editor .canvas-area {
  background: var(--bg-sunken) radial-gradient(#d3cec2 1px, transparent 1px) 0 0/16px 16px;
}
.classic-editor .canvas {
  border-radius: 12px;
  box-shadow: var(--shadow-1);
}
:focus-visible {
  outline: 2px solid var(--action);
  outline-offset: 2px;
}
.workspace-nav :focus-visible,
.editor-toolbar :focus-visible {
  outline-color: var(--signal);
}
@media (max-width: 960px) {
  .page-stats {
    grid-template-columns: repeat(2, 1fr);
  }
}
@media (prefers-reduced-motion: reduce) {
  * {
    transition: none !important;
    animation: none !important;
  }
  .element-list button:hover {
    transform: none;
  }
}
```

**Cambios en TSX:** son todos de marcado y no tocan la lógica.

- `data-status` en las filas de `PageTable.tsx`.
- Bloque `.page-stats` en `WorkspacePages.tsx`.
- `className` del método en `WorkspaceRoutes.tsx`.
- `data-state` en `EditorToolbar.tsx`.
- `data-group` en `EditorLibrary.tsx`.
- `data-kind` en los bloques de conexión de `PropertiesPanel.tsx`.

Los selectores del inspector y los de selección en el canvas que no leí completos hay que confirmarlos antes de aplicarlos.
