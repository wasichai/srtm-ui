# Tema `portal-tributario`

Tema claro basado en el prototipo "Sistema de Rentas y Tributos" (épica wasichai/srtm-ui#44): barra de marca azul,
Arial 14px, radios de 3px, tablas cebra y alertas estilo Bootstrap 3. Solo tiene modo claro.

Para probarlo sin el selector de temas (#45), abre `yarn dev` y escribe en la consola:
`document.documentElement.dataset.theme = 'portal-tributario'`.

## Archivos

| Archivo                                   | Qué hace                                                                                                                           |
| ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `src/index.css`                           | Importa `tailwindcss`, `@wasichai/ui/theme.css`, `./themes/extensions.css` y `./themes/portal-tributario/index.css`, en ese orden. |
| `src/themes/extensions.css`               | Tokens de extensión en `:root` para todos los temas y sus utilidades `--color-*`.                                                  |
| `src/themes/portal-tributario/index.css`  | Punto de entrada del tema. Cada issue añade aquí el `@import` de su parcial.                                                       |
| `src/themes/portal-tributario/tokens.css` | El bloque `[data-theme='portal-tributario']` (tokens, fuente y radios), el cuerpo a 14px y el foco.                                |
| `src/themes/tokens.test.tsx`              | Tests de completitud, extensión y contraste WCAG.                                                                                  |

Las reglas `:root` de `extensions.css` y las de `[data-theme='…']` tienen la misma especificidad, así que gana la
que va después. Por eso `extensions.css` se importa **antes** que los temas, y el test lo comprueba.

## Tokens

### Base (los 18 de `@wasichai/ui/theme.css`, ADR-034)

| Token           | Valor              | Origen en el prototipo                                                                    |
| --------------- | ------------------ | ----------------------------------------------------------------------------------------- |
| `surface`       | `#FFFFFF`          | fondo de página, paneles y tablas                                                         |
| `surface-muted` | `#F6F6F6`          | barra de instrucción y fila de total                                                      |
| `border`        | `#D8D8D8`          | borde del menú lateral                                                                    |
| `ink`           | `#333333`          | texto                                                                                     |
| `ink-muted`     | `#6B6B6B`          | notas y pie institucional                                                                 |
| `brand`         | `#3A78AF`          | ACERO (`#3D7EB7`) oscurecido para AA; ver [Decisión sobre `brand`](#decisión-sobre-brand) |
| `brand-strong`  | `#2F6596`          | hover del acero                                                                           |
| `brand-soft`    | `#EFF6FB`          | hover de las opciones del menú de sesión                                                  |
| `on-brand`      | `#FFFFFF`          | texto del botón primario y de la banda de título                                          |
| `shell`         | `#0D5FA8`          | AZUL: barra de marca                                                                      |
| `shell-muted`   | `#CFE3F4`          | texto secundario de la barra (entidad)                                                    |
| `shell-ink`     | `#FFFFFF`          | texto de la barra                                                                         |
| `danger`        | `#A94442`          | texto de la alerta de error y "Cerrar sesión"                                             |
| `on-danger`     | `#FFFFFF`          | texto sobre `danger` (el prototipo no lo usa)                                             |
| `success`       | `#3C763D`          | texto de la alerta de éxito                                                               |
| `warning`       | `#8A6D3B`          | texto de la alerta de atención                                                            |
| `warning-soft`  | `#FCF8E3`          | fondo de la alerta de atención                                                            |
| `overlay`       | `rgb(0 0 0 / 45%)` | velo de los diálogos (no está en el prototipo)                                            |

### De extensión

| Token          | Valor     | Origen en el prototipo                                            |
| -------------- | --------- | ----------------------------------------------------------------- |
| `success-soft` | `#DFF0D8` | fondo de la alerta de éxito                                       |
| `danger-soft`  | `#F2DEDE` | fondo de la alerta de error                                       |
| `notice`       | `#7A6A33` | texto de la alerta de aviso                                       |
| `notice-soft`  | `#FBF7E6` | fondo de la alerta de aviso                                       |
| `link`         | `#1569B0` | AZUL_TXT: enlaces, hojas del árbol y `accent-color`               |
| `focus`        | `#1BA0D7` | contorno de foco y borde del input con foco                       |
| `table-head`   | `#F2F2F2` | cabecera de tabla (y fondo del lateral)                           |
| `table-stripe` | `#FAFAFA` | cebra de tablas y fichas, notas bajo la tabla y pie               |
| `line`         | `#E4E4E4` | líneas finas: barra de instrucción y pie institucional            |
| `map-selected` | `#C9302C` | rojo de la insignia de avisos, para el lote seleccionado del mapa |

Los bordes de las alertas (`#D6E9C6`, `#FAEBCC`, `#EBCCD1`, `#E8E0C4`) y los demás grises del prototipo no tienen
token. Si un componente los necesita, van como hex en el parcial CSS de su issue.

### Fuente, tamaño y radios

| Variable o regla                                                                        | Valor                                                  | Origen          |
| --------------------------------------------------------------------------------------- | ------------------------------------------------------ | --------------- |
| `--font-sans`                                                                           | `Arial, Helvetica, sans-serif`                         | Arial/Helvetica |
| `body`                                                                                  | `font-size: 14px; line-height: 1.45`                   | texto base      |
| `--radius`, `--radius-sm`, `--radius-md`, `--radius-lg`, `--radius-xl`, `--radius-card` | `3px`                                                  | radios de 3px   |
| `*:focus-visible`                                                                       | `outline: 2px solid var(--focus); outline-offset: 1px` | foco            |

## Decisión sobre `brand`

El ACERO del prototipo (`#3D7EB7`) da **4.32:1** con texto blanco. No llega a AA (4.5:1), y `brand` lleva texto
blanco en el botón primario, la banda de título y el paso actual. Usamos **`#3A78AF`**, que da **4.68:1**. Tiene el
mismo tono y cada canal baja un 5 %, así que a simple vista casi no se distingue del original.

## Contraste (WCAG 2.x)

`src/themes/tokens.test.tsx` lo comprueba con una función propia. Todos los pares pasan de 4.5:1.

| Texto          | Fondo          | Ratio |
| -------------- | -------------- | ----- |
| `ink`          | `surface`      | 12.63 |
| `ink-muted`    | `surface`      | 5.33  |
| `brand-strong` | `surface`      | 6.14  |
| `danger`       | `surface`      | 5.85  |
| `success`      | `surface`      | 5.45  |
| `warning`      | `surface`      | 4.85  |
| `link`         | `surface`      | 5.71  |
| `on-brand`     | `brand`        | 4.68  |
| `shell-ink`    | `shell`        | 6.52  |
| `on-danger`    | `danger`       | 5.85  |
| `success`      | `success-soft` | 4.57  |
| `warning`      | `warning-soft` | 4.54  |
| `danger`       | `danger-soft`  | 4.53  |
| `notice`       | `notice-soft`  | 4.97  |

Pendiente para #47/#56: el foco `#1BA0D7` da **2.98:1** sobre blanco, justo por debajo del 3:1 que pide WCAG 1.4.11
(contraste no textual). Se mantiene el valor del prototipo. Si hace falta, `#1B9FD6` ya llega a 3.01:1.

## Tokens de extensión en light y dark

`extensions.css` los deriva en `:root` de los tokens base del tema activo. `data-theme` está en `<html>`, así que
se recalculan con cada tema. La única excepción es `map-selected`:

| Token           | Derivación                           | light ≈       | dark ≈        |
| --------------- | ------------------------------------ | ------------- | ------------- |
| `success-soft`  | `success` 8 % sobre `surface`        | `#EBF3EF`     | `#1D2629`     |
| `danger-soft`   | `danger` 8 % sobre `surface`         | `#FAECEC`     | `#272127`     |
| `notice`        | `warning` 70 % con `ink`             | `#6B431A`     | `#E9C487`     |
| `notice-soft`   | `warning-soft` 50 % sobre `surface`  | `#FDF4E3`     | `#33281B`     |
| `link`, `focus` | `brand`                              | igual que hoy | igual que hoy |
| `table-head`    | `surface-muted`                      | igual que hoy | igual que hoy |
| `table-stripe`  | `surface-muted` 50 % sobre `surface` | `#F7F8FA`     | `#13161D`     |
| `line`          | `border`                             | igual que hoy | igual que hoy |
| `map-selected`  | fijo, `#E8590C`                      | igual que hoy | igual que hoy |

- **`oklab` y no `oklch`.** El issue pedía `color-mix(in oklch, …)`, pero en oklch el tono se interpola por el
  círculo. Al teñir la `surface` casi gris, el resultado toma su tono: en light `success-soft` saldría azul (`#EBF2F9`)
  y `danger-soft` lila (`#EBF0FC`). En oklab el tinte conserva el tono del color de origen.
- **Efecto visible en light y dark.** `@wasichai/documents` ya usa `bg-danger-soft` en sus mensajes de error
  (`RecordDocuments` y `DocumentTypesPage`). Hasta ahora esa clase no generaba nada. Con el token, esos mensajes
  tienen un fondo rojo muy suave, que es lo que el componente quería mostrar. El 8 % está elegido para que
  `text-danger` sobre él siga en AA: 4.66:1 en light y 5.06:1 en dark (antes 5.20 y 5.57 sobre `surface`).
- En light, `success` ya se queda en 3.92:1 sobre `surface` con la paleta base de wasichai. Una alerta de éxito en
  light o dark (#50) necesita un texto más oscuro que `success`.
- **`map-selected` no se deriva.** En `:root` vale `#E8590C`, el naranja que el mapa de lotes usa hoy para la
  selección. Así el mapa de light y dark no cambia cuando #51 pase a leer la variable. `portal-tributario` lo fija
  en `#C9302C`.

## Tailwind 4

Comprobado en el CSS de `yarn build`:

- `rounded-sm`, `rounded-md`, `rounded-lg` y `rounded-card` generan `border-radius: var(--radius-*)`.
- `rounded` a secas generaba `0.25rem` fijo, porque Tailwind trae `--radius` como `inline`. `extensions.css` lo
  declara en `@theme { --radius: 0.25rem }`: el valor es el mismo, pero ahora `rounded` genera `var(--radius)` y el
  tema lo cambia a 3px. Así cambian también las clases `rounded` de `@wasichai/*` y de la app. `rounded-full` no
  cambia.
- La fuente del documento sale de `html { font-family: var(--default-font-family, …) }`, con
  `--default-font-family: var(--font-sans)` en `:root`. `data-theme` está en `<html>`, así que el `--font-sans` del
  tema se aplica a todo. `font-sans` como clase también genera `var(--font-sans)`.
- Las variables del tema son CSS normal, no `@theme`, así que siempre se emiten completas bajo
  `[data-theme=portal-tributario]`. `@theme` solo emite las que se usan, pero eso no afecta a este bloque.
- `body` y `*:focus-visible` van en `@layer base`, junto a los valores por defecto de `@wasichai/ui` que sustituyen.
  Así, las utilidades propias de un componente siguen ganando. Por ejemplo, el contorno interior de las filas de
  `HijosPanel` (`focus-visible:-outline-offset-2`) se mantiene. Los parciales de componentes van fuera de capas.
- El tamaño base de 14px se aplica a `body`, no a `html`. Los espaciados en `rem` no cambian, y las clases `text-*`
  (`text-sm` = 14px) siguen con su tamaño.
