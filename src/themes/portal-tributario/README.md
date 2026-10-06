# Tema `portal-tributario`

Tema claro basado en el prototipo "Sistema de Rentas y Tributos" (épica wasichai/srtm-ui#44), un portal tributario
en línea: barra de marca azul, menú de trámites en árbol, pasos en galón, formularios en grupos con la leyenda sobre
el borde, tablas cebra y alertas estilo Bootstrap 3, en Arial 14px con radios de 3px. Solo tiene modo claro.

Se elige en el menú de tema de la cabecera ("Portal tributario"), en el portal o en el admin: la preferencia es la
misma para los dos. A diferencia de light y dark, **cambia también la estructura** del portal: con este tema,
`useVarianteTema()` vale `'portal'` y el shell, las fichas y los asistentes dibujan las piezas del prototipo (ver
[Estructura de portal](#estructura-de-portal-variante-portal)). El admin (`WasichaiApp`) solo toma los tokens.

Tiene tres capas, de la más genérica a la más propia:

1. **Tokens**: los 18 base más los de extensión, la fuente y los radios. Desde `@wasichai/*` 0.3 (#66) son de la
   librería: `@wasichai/ui/theme.css` trae los de extensión en todos los temas y
   `@wasichai/ui/themes/portal-tributario.css` el bloque del tema. Solo con esto, todo lo que dibujan `@wasichai/*` y el
   portal ya toma los colores y la forma del tema.
2. **Parciales de componentes**: la forma exacta del prototipo. Los controles, las tablas, las pestañas, las alertas y el
   menú en árbol de la librería los pinta la hoja de `@wasichai/ui`, enganchada en sus `data-slot`. Aquí quedan los parciales de lo propio de
   srtm (`tables.css`, `tabs.css`, `pasos.css`…), enganchados en atributos `data-ui`. Light y dark no cambian.
3. **Estructura de portal**: componentes React que solo se dibujan con la variante `portal` (barra de marca, árbol,
   pasos en galón, banda de título), con tokens y un parcial para lo que no tiene token.

## Archivos

| Archivo                                     | Qué hace                                                                                                                                                         |
| ------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/index.css`                             | Importa `tailwindcss`, `@wasichai/ui/theme.css`, `@wasichai/ui/themes/portal-tributario.css` y `./themes/portal-tributario/index.css`, en ese orden.             |
| `@wasichai/ui/themes/portal-tributario.css` | La hoja del tema en la librería (#66): tokens, fuente y radios, y los controles, tablas, pestañas, alertas y menú en árbol de la librería sobre sus `data-slot`. |
| `src/themes/portal-tributario/index.css`    | Los parciales de srtm. Cada issue añade aquí el `@import` de su parcial.                                                                                         |
| `src/themes/portal-tributario/tables.css`   | Códigos sin cortar en las tablas, ficha clave-valor y paginadores ([#49](#tablas-ficha-clave-valor-y-estados-tablescss-49)).                                     |
| `src/themes/portal-tributario/shell.css`    | El panel del menú de sesión de la barra de marca: borde, sombra y cabecera del prototipo (ver [Shell](#shell-52)).                                               |
| `src/themes/tokens.test.tsx`                | Lo que srtm espera de los tokens de la librería (completitud y contraste WCAG) y el orden de los `@import` de `src/index.css`.                                   |
| `src/themes/tablas.test.tsx`                | Tests de `tables.css` y de lo que srtm espera de las tablas de la hoja de la librería.                                                                           |
| `src/themes/portal-tributario/controls.css` | Lo que la hoja de la librería deja a la app: `ghost` como enlace en el contenido, radios y checkboxes (#47, #66).                                                |
| `src/themes/parciales.test.tsx`             | Cada parcial va bajo el tema, fuera de capas e importado; y los contrastes de sus colores propios.                                                               |
| `src/themes/css.ts`                         | Ayudas de los tests: leer una regla CSS y medir un contraste.                                                                                                    |
| `src/kit/forms/NativeSelect.tsx`            | `NativeSelect`, el `<select>` nativo con `data-slot="select-trigger"`. Botones y campos vienen de `@wasichai/ui` (#66).                                          |
| `src/themes/portal-tributario/tabs.css`     | Pestañas de trabajo y fieldsets de `RecordForm` con la leyenda sobre el borde (#48). Las de la ficha son de la librería.                                         |
| `src/themes/portal-tributario/pasos.css`    | Pasos en galón y barra de instrucción de los asistentes (#54).                                                                                                   |
| `src/themes/portal-tributario/banda.css`    | La banda de título unida a las pestañas carpeta y el pie de acciones de `RecordForm` (#55).                                                                      |
| `src/portal/components/BandaTitulo.tsx`     | La banda de título de fichas y asistentes, y la fila de badges y acciones bajo ella (#55).                                                                       |

La hoja de la librería va antes que los parciales de srtm. Sus reglas van dentro de `@scope ([data-theme='portal-tributario'])`,
que no suma especificidad, así que una regla de srtm (`[data-theme='portal-tributario'] X`) le gana siempre, vaya
donde vaya.

## Tokens

### Base (los 18 de `@wasichai/ui/theme.css`, ADR-034)

Los definió srtm en #46 y desde #66 los trae `@wasichai/ui/themes/portal-tributario.css` con los mismos valores. Las
tablas de esta sección siguen como referencia de su origen en el prototipo.

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

Cada issue de componentes escribe su parcial en esta carpeta y lo importa en `index.css`.
Las reglas van **fuera de capas**: una regla sin `@layer` gana a cualquier utilidad de Tailwind (que van en la capa
`utilities`), sin importar la especificidad. Todas empiezan por `[data-theme='portal-tributario']`, así que light y dark
no cambian. Se enganchan en atributos `data-ui` que ponen los componentes. `src/themes/parciales.test.tsx` lo comprueba.

Consecuencia: bajo el tema, lo que fija un parcial gana también a las clases que un sitio pase al componente. Por eso
los parciales fijan solo lo que el prototipo define (por ejemplo, el botón secundario no fija el color del texto y un
ícono puede seguir en `brand`).

### Controles (`controls.css`, #47, #66)

Desde `@wasichai/*` 0.3, `Button`, `Input`, `Textarea` y `SelectTrigger` de la librería ponen sus `data-slot`
(`button` con `data-variant` y `data-size`, `input`, `textarea`, `select-trigger`), y la hoja
`@wasichai/ui/themes/portal-tributario.css` les da las medidas del prototipo: 15px, `padding: 10px 20px` (primario y
danger `10px 26px`), borde `#CCC` en el secundario y los campos, campos de 38px y 14.5px, foco cian con brillo, borde
`danger` en un campo inválido y opacidad 0.55 con cursor `not-allowed` en uno deshabilitado. El portal importa esos
controles directamente de `@wasichai/ui`: ya no hay envoltorio. La hoja alcanza **todos** los controles de
`@wasichai/*`, así que también las listas, el inicio, el login y el admin toman esas medidas bajo el tema.

`controls.css` guarda lo que la hoja deja a la app a propósito:

| Regla                                                 | Bajo el tema                                                                          |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `#content [data-slot='button'][data-variant='ghost']` | sin caja, texto `link`, hover `#F0F0F0`. Solo en el contenido: el shell y el admin no |
| `input[type=radio]`, `input[type=checkbox]`           | 16px, `accent-color: var(--link)`                                                     |

- **`NativeSelect`** (`src/kit/forms/NativeSelect.tsx`) es el `<select>` nativo con `selectClass`; lleva
  `data-slot="select-trigger"`, así la hoja lo pinta como los selects de la librería.
- **Botón-ícono redondo.** La variante `round` de #47 no tenía usos y se retiró con #66. Si hace falta, es un `Button`
  `ghost` de tamaño `icon` con `data-variant="round"` (la librería deja sobrescribir sus ganchos) y una regla aquí; el
  gris del prototipo (`#8B99A6`) no llega a 3:1 con el ícono blanco, `#8794A0` sí.
- **Campos.** La hoja conserva los 12px laterales de la librería (el prototipo usa 10px) para no romper el hueco del
  ícono de los buscadores.
- **Enlaces.** Los enlaces de texto del contenido usan la utilidad `text-link` en lugar de `text-brand`. En light y
  dark `--link` vale `var(--brand)`, así que no cambian. Bajo el tema son `#1569B0`. Ya se subrayaban al pasar el
  cursor (`hover:underline`).

### Tablas, ficha clave-valor y estados (`tables.css`, #49)

La cabecera, las celdas, la cebra y la fila de total las pinta la hoja de la librería sobre `data-slot="table"`, que
`Table` de `@wasichai/ui` pone en su `<table>` (#66). `tables.css` va fuera de capas (gana a las utilidades de
Tailwind) y todas sus reglas empiezan por `[data-theme='portal-tributario']`, así que light y dark no cambian. Añade
lo propio de srtm, enganchado en atributos que ponen los componentes:

| Gancho                           | Dónde                                                                                            | Qué pinta el tema                                                                   |
| -------------------------------- | ------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------- |
| `data-slot="table"`              | el `<table>` de cada `Table` del portal (lo pone la librería)                                    | `td a` sin corte: un código (`01-01-0001`) no se parte en los guiones               |
| `data-numeric`                   | las celdas de cifras (`NUMERICA` de `src/portal/components/tabla.ts`, `numeric` en `HijosPanel`) | nada: `NUMERICA` ya las alinea a la derecha con `tabular-nums` en todos los temas   |
| `data-ui="ficha-kv"`             | el `<dl>` de `FieldGrid`, la ficha en solo lectura (Datos del contribuyente, del predio…)        | filas clave-valor alternas                                                          |
| `data-tono="verde\|ambar\|rojo"` | una fila (hijo directo) de un `data-ui="ficha-kv"`                                               | la fila entera con el fondo de la alerta y el texto del tono                        |
| `data-slot="pagination"`         | `Pagination` y `PageSizePagination` de `@wasichai/ui` (`data-mode` `pages` o `range`)            | nota bajo la tabla: `table-stripe`, 13.5px, `ink-muted`; botones como el secundario |
| `data-ui="estado"` + `data-tono` | `EstadoBadge` con la variante `portal`                                                           | nada: el tono lo ponen sus clases (`text-success`…); el gancho queda para el tema   |

**Tablas.** Como el prototipo, en la hoja de la librería:

- `th`: `padding: 11px 18px`, 13.5px en negrita `#444` sobre `var(--table-head)`, sin mayúsculas ni salto de línea,
  con `border-bottom: 1px solid #DDD`.
- `td`: 14.5px, `padding: 10px 18px` (el prototipo no lo fija; 18px alinea con la cabecera) y
  `border-bottom: 1px solid var(--line)`. El color del texto no se toca: `td` ya es `ink` (`#333`) y así una fila
  seleccionada conserva su `text-brand-strong`.
- Cebra `var(--table-stripe)` en las filas pares, en la capa `base`: la clase de una fila gana, así que una fila
  seleccionada (`bg-brand-soft`, en `HijosPanel` y el buscador de predios) conserva su fondo y el hover de las listas
  se ve también en las filas pares. El tema no añade un hover propio: sobre un gris que se note (`#F0F0F0`), el texto
  `warning` bajaría a 4.25:1.
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

**Secciones de la ficha.** Cada sección de `FieldGrid` (`data-ui="ficha-seccion"`) se dibuja bajo el tema como los
fieldsets del formulario: borde de 1px `brand`, radio 3px y el título (`data-ui="ficha-titulo"`, un `h3`) sobre el
borde, en `shell`, 15px en negrita y sin mayúsculas, como la "ficha del contribuyente" del prototipo. En las tablas,
un código enlazado (el predio `01-01-0001`) no se corta en los guiones.

**Paginadores.** Los botones de página toman el aspecto del botón secundario del prototipo (blanco, borde `#CCC`,
hover `#F0F0F0`) con CSS propio, acotado a `[data-slot='pagination']`. Los paginadores son los de `@wasichai/ui`
(0.4.0-dev.0) y sus botones ya son `Button` con `data-slot="button"`: podría delegarse en los ganchos de botón.

### Pestañas y fieldsets (`tabs.css`, #48, #66)

Las pestañas de la ficha las pinta la hoja de la librería: `FichaTabs` no usa `Tabs` de `@wasichai/ui` (es controlada,
tiene pestañas en gris e íconos), pero lleva sus mismos ganchos, `data-slot="tabs"`, `"tabs-list"`, `"tabs-trigger"`
(con `aria-selected`) y `"tabs-content"`, y su tarjeta es un `Card` (`data-slot="card"`). `tabs.css` guarda lo propio:
`"workspace-tabs"` y `"workspace-tab"` en `TabBar`, y `"record-fieldset"`, `"record-legend"`, `"record-number"`,
`"record-title"` y `"record-action"` en las secciones de `RecordForm`. El ARIA y el comportamiento de las pestañas
(montaje perezoso, panel oculto) no cambian: solo se pintan.

| Pieza                          | Bajo el tema                                                                                                        |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------- |
| Pestaña de la ficha (librería) | carpeta de 16px, `padding: 13px 22px`, radio `3px 3px 0 0`; inactiva `#F0F0F0` con texto `#666`                     |
| Pestaña activa (librería)      | blanca, en negrita `ink`, borde `brand` y borde inferior blanco: se funde con el panel                              |
| Tira de pestañas (librería)    | la línea `brand` de debajo es su fondo (un degradado de 1px), no un borde                                           |
| Panel (librería)               | borde `brand` sin borde superior, blanco, radio abajo y 24px abajo                                                  |
| Tarjeta de la ficha (librería) | se aparta (sin borde, sombra, fondo ni relleno inferior): las pestañas quedan sobre la página y el panel es la caja |
| Pestañas de trabajo (`TabBar`) | el mismo lenguaje a 14px; la activa, blanca y en negrita, se funde con la ruta de debajo                            |
| Fieldset de `RecordForm`       | borde de 1px `brand`, radio 3px, `padding: 6px 18px 20px`, 18px entre fieldsets                                     |
| Leyenda                        | sobre el borde, 15px en negrita, color `shell`, sin mayúsculas ni tracking; el número sigue en su círculo `brand`   |
| Acción de la sección           | sigue a la derecha, también sobre el borde, con fondo blanco que tapa la línea                                      |

- **Por qué la línea es un fondo.** Para que la pestaña activa tape la línea de la tira, con un borde tendría que
  bajar 1px por encima de él. La tira se desplaza en horizontal (`overflow-x-auto`), así que ese píxel también la
  haría desplazable en vertical. Con la línea como fondo, cada pestaña inactiva lleva su borde inferior `brand` y la
  activa lo lleva blanco.
- **Muchas pestañas.** La ficha del contribuyente tiene siete y la declaración seis, con nombres largos. Con las
  medidas del prototipo necesitan unos 1240px de tira. La tira es un contenedor (`container-type: inline-size`):
  por debajo de 1240px las pestañas pasan a 15px con 12px a los lados, y por debajo de 1000px a 14px con 10px. Por
  debajo de eso se desplazan, como en light.
- **La leyenda y su acción.** La leyenda mide lo que su texto, así el borde del fieldset corre a ambos lados sin
  trucos. La acción (el "Buscar predios" de la ubicación) sale del flujo con `position: absolute` a la derecha. Como
  hija de la leyenda, que es flex, conserva su centro vertical: queda sobre el borde, como la leyenda.
- **Selectores `:has()`.** La tarjeta que envuelve la ficha se reconoce por `[data-slot='card']:has(> [data-slot='tabs'])` (librería), la
  pestaña de trabajo activa por `:has(> [aria-current='page'])` y el espacio entre fieldsets por
  `:has(+ [data-ui='record-fieldset'])`.

### Alertas (#50, de la librería desde `@wasichai/*` 0.5)

Las alertas son `Alert` de `@wasichai/ui`: `tone` (`'success' | 'warning' | 'danger' | 'notice'`), `title?` (en negrita
al inicio: "Atención.", "Sr. contribuyente,"), `children`, `onDismiss?` (un check con `aria-label` "Entendido, cerrar
el aviso", del bundle de core) y `className`. `role="alert"` para `danger` y `role="status"` para el resto. Pone
`data-slot="alert"` y `data-tone`, y envuelve el texto en `data-slot="alert-text"`.

- **light y dark no cambian.** Fuera del tema, `Alert` es el texto en el color de su tono más lo que cada sitio le pase
  en `className`. Así, el error de `RecordForm` conserva su caja (`rounded-md bg-danger/10 px-3 py-2`).
- **Bajo el tema**, el `alerts.css` de la hoja de la librería pinta la caja del prototipo, con los valores que tenía
  aquí (#50): `padding: 14px 18px`, 14.5px, `line-height: 1.6`, radio 3px, y por tono el fondo, el texto y el borde de
  Bootstrap 3 (`#D6E9C6`, `#FAEBCC`, `#EBCCD1`, `#E8E0C4`).
- El toast queda fuera de alcance: el portal no tiene toasts.

## Tokens de extensión en light y dark

Desde #66 los trae `@wasichai/ui/theme.css` en todos los temas, con valores fijos en oklch para light y dark (con #46
srtm los derivaba con `color-mix` en `src/themes/extensions.css`, que se borró). Son `success-soft`, `danger-soft`,
`notice`, `notice-soft`, `link`, `focus`, `table-head`, `table-stripe`, `line` y `map-selected`, con sus utilidades
`--color-*`. `link` y `focus` valen `brand`, `table-head` vale `surface-muted` y `line` vale `border`, así que light y
dark se ven igual que antes. `map-selected` es el naranja `#E8590C` del mapa de lotes en light y dark, y
`portal-tributario` lo fija en `#C9302C`.

- **Efecto visible en light y dark.** `@wasichai/documents` usa `bg-danger-soft` en sus mensajes de error
  (`RecordDocuments` y `DocumentTypesPage`), que ahora tienen el fondo rojo suave que el componente quería mostrar.
- **`success` en light.** Desde `@wasichai/*` 0.3.1 (wasichai/wasichai-ui#15) el verde de light es más oscuro y pasa AA
  sobre `surface` y `success-soft`. `portal-tributario` tiene su propio verde (`#3C763D`) y dark no cambia.

## Tailwind 4

Comprobado en el CSS de `yarn build`:

- `rounded-sm`, `rounded-md`, `rounded-lg` y `rounded-card` generan `border-radius: var(--radius-*)`.
- `rounded` a secas generaba `0.25rem` fijo, porque Tailwind trae `--radius` como `inline`. `@wasichai/ui/theme.css`
  (antes `extensions.css`) lo declara en `@theme { --radius: 0.25rem }`: el valor es el mismo, pero `rounded` genera
  `var(--radius)` y el tema lo cambia a 3px. Así cambian también las clases `rounded` de `@wasichai/*` y de la app.
  `rounded-full` no cambia.
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

## Estructura de portal (variante `portal`)

`useVarianteTema()` (`src/themes/useVarianteTema.ts`) lee el tema que core aplicó: `'portal'` con
`portal-tributario`, `'clasico'` con light, dark, el del sistema o un id desconocido. Lo que sigue solo se dibuja con
`'portal'`; con `'clasico'` el DOM es el de siempre. Son componentes con tokens y utilidades, y cada uno tiene su
parcial para los valores sin token.

| Pieza                        | Componente                                                      | Dónde                                                                        |
| ---------------------------- | --------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| Barra de marca, sesión y pie | `PortalShell.tsx`, `MenuSesion.tsx` (`src/portal/shell/`)       | el marco de `AppShell`, en todas las pantallas                               |
| Menú de trámites en árbol    | `NavTree` (`@wasichai/core`), `navTree.ts`, `LateralPortal.tsx` | el lateral de `AppShell`                                                     |
| Pasos en galón e instrucción | `PasosAsistente`, `PasosGalon`, `BarraInstruccion`              | Nuevo contribuyente, ficha con `?inscripcion=1`, Nueva DJ, DJ `?asistente=1` |
| Banda de título              | `BandaTitulo`, `CabeceraBanda`, `CabeceraAsistente`             | `FichaHeader` (fichas) y los asistentes                                      |
| Estado como texto con tono   | `EstadoBadge` + `tonoDeEstado`                                  | listas y fichas                                                              |

El marco (`AppShell`) es el mismo para todos los temas: al cambiar de tema no se desmonta la página abierta ni se
pierde lo escrito en un formulario.

### Shell (#52)

Con este tema, `useVarianteTema()` vale `'portal'` y `AppShell` (`src/portal/shell/`) dibuja en su marco las piezas
de `PortalShell`: la barra de marca (escudo, título, búsqueda, Administración, tema y `MenuSesion`), un lateral claro
con el árbol de trámites (`LateralPortal`, ver [Menú en árbol](#menú-en-árbol-53)) y el pie institucional. Son componentes con tokens y
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
- La hoja activa del lateral: ver [Menú en árbol](#menú-en-árbol-53).

### Menú en árbol (#53)

Con la variante `portal`, el lateral (`LateralPortal`) es el árbol de trámites del prototipo: `NavTree` de
`@wasichai/core` (desde `@wasichai/*` 0.5), un componente genérico que recibe el árbol, con el contenido declarado en
`NAV_TREE` (`src/portal/shell/navTree.ts`). El shell clásico de light y dark conserva `NAV` y su menú de móvil.

- **Panel** de 292px (`w-73`) sobre `table-head` con borde `border`. Arriba, "Ir al inicio" (16px, `link`, con
  `aria-current` en `/`) y el botón "Ocultar el menú"; debajo, el título "Mis trámites" (18px, negrita, `link`).
- **Grupos**: `<button aria-expanded aria-controls>` de 17px en negrita `ink`, con un caret que gira 90° en 0.13s
  (`transition-transform duration-130`, quieto con `prefers-reduced-motion`). Plegado, su lista lleva `hidden`.
  **Subgrupos** (opcionales, ninguno hoy): 16px con sangría de 26px.
- **Hojas**: 15px en `link`, sangría de 34px (48px bajo un subgrupo). La activa lleva `aria-current="page"`, borde
  izquierdo de 4px `link`, negrita y un chevron. Una ruta hija marca su hoja: gana la más específica
  (`/contribuyentes/123` → Buscar contribuyentes, `/contribuyentes/nuevo` → Nuevo contribuyente) y una hoja puede
  declarar otras rutas de su pantalla (`alsoAt`: el asistente abierto desde la ficha marca Nueva declaración). La hoja activa es la de `currentNavTreeLeaf`
  de core: su ruta, luego `alsoAt`, luego el inicio más largo.
  Las fichas sin hoja propia (una declaración, un lote) no marcan ninguna. Las hojas son `Link` con el
  `aria-current` calculado, no `NavLink`: su coincidencia por prefijo marcaría a la vez Buscar y Nuevo contribuyente.
- **Administración** va al final, solo para administradores, como un enlace normal (`<a href="/admin">`, otra app)
  con la letra de los grupos y un ícono en el sitio del caret.
- **Plegado**: el botón del panel lo oculta en cualquier ancho y aparece la hamburguesa de la barra de marca (30px,
  borde `shell-ink` al 50 %), que lo reabre; es el mismo botón `aria-controls="sidebar"` del menú de móvil clásico
  y el foco pasa de uno a otro. Con 1080px o menos, el panel empieza plegado y se pliega al elegir una hoja; en un
  teléfono ocupa todo el ancho. En el prototipo el panel solo se oculta en pantallas estrechas (en las anchas la
  hamburguesa aparecía sin ocultarlo); aquí se oculta siempre. Estos botones no son el `Button` de #47: los del
  árbol son controles sin caja del prototipo y la hamburguesa es el botón del marco común (el clásico no cambia).
- **Memoria**: el estado del panel y de los grupos se guarda en `sessionStorage['srtm.nav']` (con try/catch), como
  las pestañas de trabajo. En una pantalla estrecha el panel empieza plegado aunque se guardara abierto, y el
  plegado automático al navegar no se guarda.

Los grises del prototipo (hoja activa `#0D4D80` sobre `#E6E6E6`, hover `#E9E9E9`, grupo `#0D4D80`, caret `#555555`)
los fija el `nav.css` de la hoja de la librería sobre `data-slot="nav-tree*"`, con los mismos valores y contrastes que
tenía aquí.

Tests: `src/portal/arbolNav.test.tsx` (`NAV_TREE`, hoja activa, plegado, memoria, pantalla estrecha, clásico intacto); el
componente y su parcial los prueba wasichai-ui.

## Ganchos `data-slot` y `data-ui`

Los atributos que ponen los componentes para que un tema los pinte desde CSS. En light y dark no hacen nada. Los
`data-slot` son de `@wasichai/ui` (0.3, con los nombres de shadcn; `pagination`, desde 0.4.0-dev.0; `alert*` y `nav-tree*`, desde 0.5) y los pinta la hoja
del tema de la librería, salvo `pagination`, que pinta `tables.css`; los `data-ui` son de srtm y los pintan sus
parciales.

| Grupo             | Ganchos                                                                                                                                                                                                                  | Componente                                                                                  |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------- |
| Controles         | `data-slot`: `button` (+ `data-variant`, `data-size`), `input`, `textarea`, `select-trigger`                                                                                                                             | `@wasichai/ui`; `NativeSelect` (`NativeSelect.tsx`) usa `select-trigger`                    |
| Formularios       | `record-fieldset`, `record-legend`, `record-number`, `record-title`, `record-action`, `record-acciones`, `record-nota`                                                                                                   | `RecordForm`                                                                                |
| Fichas            | `ficha-seccion`, `ficha-titulo`, `ficha-kv` (+ `data-tono` por fila)                                                                                                                                                     | `FieldGrid`                                                                                 |
| Pestañas          | `data-slot`: `card`, `tabs`, `tabs-list`, `tabs-trigger`, `tabs-content`; `data-ui`: `workspace-tabs`, `workspace-tab`                                                                                                   | `Card`, `FichaTabs`, `TabBar`                                                               |
| Tablas            | `data-slot`: `table`, `table-head`, `table-cell`, `badge`, `pagination`; `data-ui`: `estado` (+ `data-tono`); `data-numeric` en las celdas de cifras                                                                     | `Table`/`Th`/`Td`, `Pagination`, `PageSizePagination`, `EstadoBadge`                        |
| Alertas           | `data-slot`: `alert` (+ `data-tone`), `alert-text`, `alert-dismiss`                                                                                                                                                      | `Alert` (`@wasichai/ui`)                                                                    |
| Estructura portal | `menu-sesion-panel`, `menu-sesion-cabecera`, `pasos-galon`, `paso`, `barra-instruccion`, `banda-titulo`, `cabecera-banda`, `cabecera-fila`; `data-slot`: `nav-tree`, `nav-tree-group`, `nav-tree-leaf`, `nav-tree-caret` | `MenuSesion`, `PasosGalon`, `BarraInstruccion`, `BandaTitulo`, `NavTree` (`@wasichai/core`) |

## wasichai-ui

Lo que srtm construyó para el tema subió a la librería con wasichai/wasichai-ui#12 (ADR-035) y srtm lo adoptó con
#66 (`@wasichai/*` 0.3.1):

- los tokens de extensión y `--radius` en `@theme`, en `@wasichai/ui/theme.css`;
- los ganchos `data-slot` de `Button`, `Card`, `Input`, `Textarea`, `SelectTrigger`, `Table`, `Th`, `Td`, `Badge` y
  `Tabs`;
- la hoja `@wasichai/ui/themes/portal-tributario.css` (tokens, controles, tablas y pestañas) y
  `PORTAL_TRIBUTARIO_THEME` en `@wasichai/core`, con su etiqueta `theme.portalTributario` en el i18n de core;
- el verde de light con AA (wasichai/wasichai-ui#15, 0.3.1);
- `Alert` en `@wasichai/ui` y `NavTree` en `@wasichai/core`, con sus parciales en la hoja del tema
  (wasichai/wasichai-ui#14, 0.5.0-dev.0): caja-ui fue el segundo usuario.

Pendiente, en wasichai/wasichai-ui#14: `PasosGalon`, `BarraInstruccion`, `BandaTitulo` y la idea de `useVarianteTema`. Solo suben
con un segundo usuario concreto (regla 6 del `CLAUDE.md` de wasichai-ui). Hasta entonces siguen aquí, con sus parciales.

Lo que se queda en srtm-ui en cualquier caso: `navTree.ts` (los trámites), `instrucciones.ts` (los textos de cada paso),
`tonoDeEstado` (los estados del SRTM) y la marca de la barra.
