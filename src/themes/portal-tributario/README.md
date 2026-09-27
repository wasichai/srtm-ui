# Tema `portal-tributario`

Tema claro basado en el prototipo "Sistema de Rentas y Tributos" (épica wasichai/srtm-ui#44): barra de marca azul,
Arial 14px, radios de 3px, tablas cebra y alertas estilo Bootstrap 3. Solo tiene modo claro.

Para probarlo sin el selector de temas (#45), abre `yarn dev` y escribe en la consola:
`document.documentElement.dataset.theme = 'portal-tributario'`.

## Archivos

| Archivo                                     | Qué hace                                                                                                                           |
| ------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `src/index.css`                             | Importa `tailwindcss`, `@wasichai/ui/theme.css`, `./themes/extensions.css` y `./themes/portal-tributario/index.css`, en ese orden. |
| `src/themes/extensions.css`                 | Tokens de extensión en `:root` para todos los temas y sus utilidades `--color-*`.                                                  |
| `src/themes/portal-tributario/index.css`    | Punto de entrada del tema. Cada issue añade aquí el `@import` de su parcial.                                                       |
| `src/themes/portal-tributario/tokens.css`   | El bloque `[data-theme='portal-tributario']` (tokens, fuente y radios), el cuerpo a 14px y el foco.                                |
| `src/themes/portal-tributario/tables.css`   | Tablas cebra con fila de total, ficha clave-valor y paginadores ([#49](#tablas-ficha-clave-valor-y-estados-49)).                   |
| `src/themes/portal-tributario/shell.css`    | El panel del menú de sesión de la barra de marca: borde, sombra y cabecera del prototipo (ver [Shell](#shell-52)).                 |
| `src/themes/tokens.test.tsx`                | Tests de completitud, extensión y contraste WCAG.                                                                                  |
| `src/themes/tablas.test.tsx`                | Tests de `tables.css`: importado tras los tokens, fuera de capas, solo bajo el tema y con los valores del prototipo.               |
| `src/themes/portal-tributario/controls.css` | Botones, campos, selects, radios y checkboxes (#47).                                                                               |
| `src/themes/parciales.test.tsx`             | Cada parcial va bajo el tema, fuera de capas e importado; y los contrastes de sus colores propios.                                 |
| `src/themes/css.ts`                         | Ayudas de los tests: leer una regla CSS y medir un contraste.                                                                      |
| `src/portal/components/controles.tsx`       | `Button`, `Input`, `Textarea` y `NativeSelect` con sus ganchos `data-ui` (#47).                                                    |

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
| `focus`        | `#1E9CD5` | contorno de foco y borde del input con foco (`#1BA0D7` ajustado)  |
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

El foco no es texto: WCAG 1.4.11 (contraste no textual) le pide **3:1** sobre lo que tiene alrededor, y el test lo
comprueba sobre `surface`. El `#1BA0D7` del prototipo daba **2.98:1**. Usamos **`#1E9CD5`**, el color más cercano
(en OKLab) que llega a **3.10:1**: deja margen sobre el 3:1 y a simple vista es el mismo cian (#47).

| Elemento no textual | Fondo     | Ratio |
| ------------------- | --------- | ----- |
| `focus`             | `surface` | 3.10  |

## Parciales de componentes

Cada issue de componentes escribe su parcial en esta carpeta y lo importa en `index.css`, después de `tokens.css`.
Las reglas van **fuera de capas**: una regla sin `@layer` gana a cualquier utilidad de Tailwind (que van en la capa
`utilities`), sin importar la especificidad. Todas empiezan por `[data-theme='portal-tributario']`, así que light y dark
no cambian. Se enganchan en atributos `data-ui` que ponen los componentes. `src/themes/parciales.test.tsx` lo comprueba.

Consecuencia: bajo el tema, lo que fija un parcial gana también a las clases que un sitio pase al componente. Por eso
los parciales fijan solo lo que el prototipo define (por ejemplo, el botón secundario no fija el color del texto y un
ícono puede seguir en `brand`).

### Controles (`controls.css`, #47)

`Button`, `Input` y `Textarea` de `@wasichai/ui` reenvían los atributos `data-*` (hacen `{...props}`), pero no ponen
ganchos propios. `src/portal/components/controles.tsx` los envuelve sin cambiar su API y añade `data-ui`,
`data-variant` y `data-size`. También trae `NativeSelect`, el `<select>` nativo con `selectClass` y `data-ui="select"`.
En light y dark solo aparecen los atributos.

| Gancho                                      | Bajo el tema                                                                                       |
| ------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `data-ui="button"` + `data-size="md"`       | 15px, `padding: 10px 20px` (primario y danger, `10px 26px`), radio 3px, borde de 1px en todas      |
| `data-size="sm"`                            | 14px, `padding: 5px 12px`. `icon` conserva el tamaño de la librería                                |
| `data-variant="primary"`                    | `brand`, hover `brand-strong`                                                                      |
| `data-variant="secondary"`                  | blanco con borde `#CCC`, hover `#F0F0F0`                                                           |
| `data-variant="ghost"`                      | sin caja, texto `link`, hover `#F0F0F0`                                                            |
| `data-variant="danger"`                     | `danger`, hover un 15 % más oscuro                                                                 |
| `data-variant="round"`                      | botón-ícono redondo de 28px: ícono blanco sobre `#8794A0`, hover `#6D7A86`                         |
| `:disabled`                                 | opacidad 0.55 y cursor `not-allowed` (la librería quita los eventos del puntero, que lo ocultaban) |
| `data-ui="input"`, `"textarea"`, `"select"` | borde `#CCC`, radio 3px, `padding: 8px 10px`, 14.5px; input y select de 38px de alto               |
| `:focus` de los campos                      | borde `focus` y brillo `0 0 6px` del mismo color al 45 %, en lugar del contorno                    |
| `[aria-invalid='true']` de los campos       | borde `danger`, también con foco                                                                   |
| `input[type=radio]`, `input[type=checkbox]` | 16px, `accent-color: var(--link)`                                                                  |

- **Botón-ícono redondo.** `<Button variant="round" aria-label="Ayuda"><CircleHelp /></Button>`. Bajo el tema es
  un disco gris con el ícono blanco. En light y dark es un botón fantasma redondo. El `#8B99A6` del prototipo da
  2.91:1 con blanco, por debajo del 3:1 de WCAG 1.4.11. Usamos `#8794A0`, el más cercano que llega a 3.10:1. El
  hover del prototipo (`#6D7A86`) ya da 4.40:1.
- **Enlaces.** Los enlaces de texto del contenido usan la utilidad `text-link` en lugar de `text-brand`. En light y
  dark `--link` vale `var(--brand)`, así que no cambian. Bajo el tema son `#1569B0`. Ya se subrayaban al pasar el
  cursor (`hover:underline`).
- **Dónde se usan.** Los envoltorios están en `RecordForm` y sus campos propios (`forms/`), en las cabeceras con
  acciones de Nuevo contribuyente, Nueva declaración y la ficha de la declaración, en `DatosPanel`, en la barra de
  `HijosPanel` y en los diálogos (`BuscarPrediosDialog`, `CambiosPendientes`, `EliminarFicha`, `AnularDeclaracion`).
  Las listas (`Listas`, `Declaraciones`, `Condominos`), el inicio, el login y los paginadores siguen con los
  controles de la librería: bajo el tema toman los tokens (colores y radios de 3px), pero no las medidas del
  prototipo. Cuando wasichai/wasichai-ui#12 ponga ganchos `data-slot` en la librería, `controles.tsx` sobrará y los
  selectores pasarán a esos ganchos.

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

## Tablas, ficha clave-valor y estados (#49)

`tables.css` va fuera de capas (gana a las utilidades de Tailwind) y todas sus reglas empiezan por
`[data-theme='portal-tributario']`, así que light y dark no cambian. Se engancha en atributos que ponen los
componentes:

| Gancho                           | Dónde                                                                                            | Qué pinta el tema                                                                   |
| -------------------------------- | ------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------- |
| `data-ui="table"`                | el `<table>` de cada `Table` del portal (`Table` de `@wasichai/ui` reenvía los `data-*`)         | `th`, `td`, filas cebra, hover y `tfoot`                                            |
| `data-numeric`                   | las celdas de cifras (`NUMERICA` de `src/portal/components/tabla.ts`, `numeric` en `HijosPanel`) | derecha y `tabular-nums` (los componentes ya lo hacen en todos los temas)           |
| `data-ui="ficha-kv"`             | el `<dl>` de `FieldGrid`, la ficha en solo lectura (Datos del contribuyente, del predio…)        | filas clave-valor alternas                                                          |
| `data-tono="verde\|ambar\|rojo"` | una fila (hijo directo) de un `data-ui="ficha-kv"`                                               | la fila entera con el fondo de la alerta y el texto del tono                        |
| `data-ui="paginador"`            | `Paginador` y `Pagination`                                                                       | nota bajo la tabla: `table-stripe`, 13.5px, `ink-muted`; botones como el secundario |
| `data-ui="estado"` + `data-tono` | `EstadoBadge` con la variante `portal`                                                           | nada: el tono lo ponen sus clases (`text-success`…); el gancho queda para el tema   |

**Tablas.** Como el prototipo:

- `th`: `padding: 11px 18px`, 13.5px en negrita `#444` sobre `var(--table-head)`, sin mayúsculas ni salto de línea,
  con `border-bottom: 1px solid #DDD`.
- `td`: 14.5px, `padding: 10px 18px` (el prototipo no lo fija; 18px alinea con la cabecera) y
  `border-bottom: 1px solid var(--line)`. El color del texto no se toca: `td` ya es `ink` (`#333`) y así una fila
  seleccionada conserva su `text-brand-strong`.
- Cebra `var(--table-stripe)` en las filas pares. Las filas con `aria-selected="true"` (listas de `HijosPanel` y
  del buscador de predios) quedan fuera y conservan su `bg-brand-soft`. El prototipo no define hover y el tema no
  añade uno: sobre un gris que se note (`#F0F0F0`), el texto `warning` bajaría a 4.25:1.
- `tfoot td`: negrita sobre `var(--surface-muted)` (`#F6F6F6`) con `border-top: 2px solid #DDD`.
- Las líneas finas de fila usan `var(--line)` (`#E4E4E4`), como pide el issue, en vez del `#F0F0F0` del prototipo;
  la de la cabecera y la del total conservan el `#DDD`, más marcado.

**Estados por tono.** `tonoDeEstado(texto)` (`src/portal/components/tono.ts`) aplica la regla `tono()` del
prototipo, sin distinguir mayúsculas ni tildes: `vencida|coactiva|denegado|inactivo|baja` → rojo,
`por vencer|en trámite|observ` → ámbar, `activo|habido|vigente|cancelada|conforme` → verde. Añade `anulad` (rojo)
y `no habido` (rojo, porque contiene `habido`). Con la variante `portal` de `useVarianteTema()`, `EstadoBadge` es
texto de 12.5px en negrita con `text-success`, `text-warning` o `text-danger` y `data-tono`; en light y dark sigue la
pastilla. El texto es el mismo. Los tonos pasan AA sobre blanco y cebra (`src/themes/tablas.test.tsx`).
`text-warning` sobre `brand-soft` (fila seleccionada) queda en 4.44:1, pero `EstadoBadge` solo escribe Activo,
Vigente, Anulada e Inactivo, que son verde o rojo (5.00 y 5.36:1 sobre `brand-soft`).

**Ficha clave-valor.** Bajo el tema, el `<dl>` de `FieldGrid` pasa de la rejilla de 6 columnas a filas clave-valor
(etiqueta al 40 %, 13.5px `ink-muted`; valor 14.5px `ink`) en una columna, y en dos desde 64rem (el `lg` de
Tailwind). La cebra va por fila visual: pares en una columna, `4n+3` y `4n+4` en dos. Por eso los campos pierden su
`col-span` bajo el tema. `FieldGrid` no pone `data-tono` en ninguna fila (hoy ningún campo lo necesita); el estilo
queda listo para una ficha que lo marque, por ejemplo con `tonoDeEstado`.

**Paginadores.** Los botones de página toman el aspecto del botón secundario del prototipo (blanco, borde `#CCC`,
hover `#F0F0F0`) con CSS propio. Cuando llegue #47 (`controls.css`) se puede delegar en sus ganchos de botón.

## Shell (#52)

Con este tema, `useVarianteTema()` vale `'portal'` y `AppShell` (`src/portal/shell/`) dibuja en su marco las piezas
de `PortalShell`: la barra de marca (escudo, título, búsqueda, Administración, tema y `MenuSesion`), un lateral claro
provisional (`LateralPortal`, que sustituirá el árbol de #53) y el pie institucional. Son componentes con tokens y
utilidades (`bg-shell`, `text-shell-muted`, `bg-table-head`, `text-link`, `bg-table-stripe`, `border-line`…). El
marco es el mismo para todos los temas: al cambiar de tema, la página abierta y el menú de tema no se desmontan.

`shell.css` solo añade lo que no tiene token:

| Regla                              | Valor                                                     | Origen en el prototipo   |
| ---------------------------------- | --------------------------------------------------------- | ------------------------ |
| `[data-ui='menu-sesion-panel']`    | borde `#C8D4DE`, sombra `0 6px 22px rgb(13 95 168 / 22%)` | panel del menú de sesión |
| `[data-ui='menu-sesion-cabecera']` | fondo `#F6F9FC`, borde `#C8D4DE`                          | cabecera del panel       |

Desvíos del prototipo, por contraste:

- El círculo de las iniciales lleva un 15 % de blanco sobre `shell`, no un 22 %: el texto blanco da 4.73:1 (con el
  22 %, 4.08:1).
- El foco de los controles de la barra es blanco (`shell-ink`, 6.52:1). El azul de foco (`#1BA0D7`) sobre `shell` da
  2.19:1.
- La hoja activa del lateral lleva `ink` al 6 % sobre `table-head` (≈ `#E7E7E7`, el prototipo usa `#E6E6E6`) y el
  texto en `link` negrita: 4.62:1.
