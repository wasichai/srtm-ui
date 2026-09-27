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
| `src/themes/portal-tributario/tabs.css`     | Pestañas carpeta de la ficha y de trabajo, y fieldsets de `RecordForm` con la leyenda sobre el borde (#48).                        |
| `src/themes/portal-tributario/alerts.css`   | La caja de las alertas en cuatro tonos (#50).                                                                                      |
| `src/portal/components/Alerta.tsx`          | Alerta con tono, título y cierre; en light y dark se ve como el texto que sustituye (#50).                                         |
| `src/themes/portal-tributario/nav.css`      | El menú en árbol del lateral: hoja activa, hovers y carets con los valores del prototipo (ver [Menú en árbol](#menú-en-árbol-53)). |
| `src/portal/shell/ArbolNav.tsx`             | El menú en árbol genérico (grupos, subgrupos y hojas) con sus ganchos `data-ui` (#53).                                             |
| `src/themes/portal-tributario/pasos.css`    | Pasos en galón y barra de instrucción de los asistentes (#54).                                                                     |

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
  Las listas (`Listas`, `Declaraciones`, `Condominos`), el inicio y el login siguen con los controles de la
  librería: bajo el tema toman los tokens (colores y radios de 3px), pero no las medidas del prototipo. Los
  paginadores los pinta `tables.css` (#49). Cuando wasichai/wasichai-ui#12 ponga ganchos `data-slot` en la librería, `controles.tsx` sobrará y los
  selectores pasarán a esos ganchos.

### Pestañas y fieldsets (`tabs.css`, #48)

Ganchos: `data-ui="ficha-tabs"` (el contenedor de `FichaTabs`), `"ficha-tab"` (cada pestaña, con su
`aria-selected`) y `"ficha-panel"`; `"workspace-tabs"` y `"workspace-tab"` en `TabBar`; `"record-fieldset"`,
`"record-legend"`, `"record-number"`, `"record-title"` y `"record-action"` en las secciones de `RecordForm`. El ARIA
y el comportamiento de las pestañas (montaje perezoso, panel oculto) no cambian: solo se pintan.

| Pieza                          | Bajo el tema                                                                                                        |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------- |
| Pestaña de la ficha            | carpeta de 16px, `padding: 13px 22px`, radio `3px 3px 0 0`; inactiva `#F0F0F0` con texto `#666`                     |
| Pestaña activa                 | blanca, en negrita `ink`, borde `brand` y borde inferior blanco: se funde con el panel                              |
| Tira de pestañas               | la línea `brand` de debajo es su fondo (un degradado de 1px), no un borde                                           |
| Panel                          | borde `brand` sin borde superior, blanco, radio abajo y 24px abajo                                                  |
| Tarjeta que envuelve la ficha  | se aparta (sin borde, sombra, fondo ni relleno inferior): las pestañas quedan sobre la página y el panel es la caja |
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
- **Selectores `:has()`.** La tarjeta que envuelve la ficha se reconoce por `:has(> [data-ui='ficha-tabs'])`, la
  pestaña de trabajo activa por `:has(> [aria-current='page'])` y el espacio entre fieldsets por
  `:has(+ [data-ui='record-fieldset'])`.

### Alertas (`alerts.css`, #50)

`src/portal/components/Alerta.tsx`: `tono` (`'exito' | 'atencion' | 'error' | 'aviso'`), `titulo?` (en negrita al
inicio: "Atención.", "Sr. contribuyente,"), `children`, `onCerrar?` (un botón con un check y `aria-label`
"Entendido, cerrar el aviso") y `className`. `role="alert"` para `error` y `role="status"` para el resto. Pone
`data-ui="alerta"` y `data-tono`, y envuelve el texto en `data-ui="alerta-texto"`.

- **light y dark no cambian.** Fuera del tema, `Alerta` es el texto en el color de su tono (`text-success`,
  `text-warning`, `text-danger`, `text-notice`, a 14px) más lo que cada sitio le pase en `className`. Así, el error
  de `RecordForm` conserva su caja (`rounded-md bg-danger/10 px-3 py-2`) y los de `NuevaDeclaracionPage`,
  `DeclaracionPage`, `HijosPanel` y `BuscarPrediosDialog` siguen siendo texto rojo con sus márgenes. Los textos no
  cambian.
- **Bajo el tema**, `alerts.css` pinta la caja del prototipo: `padding: 14px 18px`, 14.5px, `line-height: 1.6`, radio
  3px, y por tono el fondo y el texto de los tokens (`success-soft`/`success`, `warning-soft`/`warning`,
  `danger-soft`/`danger`, `notice-soft`/`notice`; su contraste lo comprueba `tokens.test.tsx`) con el borde de
  Bootstrap 3 en hex (`#D6E9C6`, `#FAEBCC`, `#EBCCD1`, `#E8E0C4`). El botón de cerrar queda arriba a la derecha.
- El toast queda fuera de alcance: el portal no tiene toasts.

### Pasos en galón y barra de instrucción (`pasos.css`, #54)

Componentes (en `src/portal/components/`):

- `PasosGalon`: `pasos` (`{ id, label }[]`), `actual`, `onIr?(id)`, `puedeIr?(id)` y `label` (por defecto "Pasos del
  trámite"). Es un `<ol>` (`data-ui="pasos-galon"`) con un `<li>` por paso (`data-ui="paso"`) y `aria-current="step"`
  en el actual, que va en `bg-brand text-on-brand`; los demás, en `bg-surface-muted text-ink-muted`. Solo son botones
  los pasos a los que se puede ir (hay `onIr` y `puedeIr` lo permite); los demás, y el actual, son texto: no se
  enfocan. El recorte también cortaría el contorno de foco, así que el botón dibuja el anillo alrededor de su texto,
  dentro del galón, en el color del texto.
- `BarraInstruccion`: `paso?` (en negrita), `children` (la instrucción, con `aria-live="polite"`) y `herramientas?`
  (`{ label, icon, onClick }[]`), que son `Button` primarios de `controles.tsx`. Hoy nadie pasa herramientas: el
  portal no tiene Recuperar, Importar ni Limpiar.
- `PasosAsistente` junta los dos sobre una tarjeta, solo con la variante `portal`; en la clásica no pinta nada. Lo
  usan Nuevo contribuyente, Nueva declaración y la declaración con `?asistente=1`, justo debajo de su cabecera. Los
  pasos son las pestañas de cada asistente, con su mismo estado: el paso actual es la pestaña abierta y un paso va
  adonde va su pestaña, cuando se puede abrir. Las instrucciones, una por paso, están en
  `src/portal/forms/instrucciones.ts`.

Bajo el tema, `pasos.css` da la forma y las medidas del prototipo:

| Pieza                    | Bajo el tema                                                                                                       |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------ |
| Paso                     | 15.5px, `padding: 11px 30px 11px 34px` (el primero 22px a la izquierda, el último 26px a la derecha)               |
| Recorte                  | `clip-path` con punta y muesca de 14px; el primero sin muesca, el último sin punta, uno solo sin recorte           |
| Paso no actual           | `#EDEDED` con texto `#555` (6.37:1)                                                                                |
| Barra de instrucción     | `padding-left: 18px`; el texto a 15px con `padding: 11px 0`, sobre `surface-muted` y con la línea `line` debajo    |
| Herramientas de la barra | el botón primario, plano: `padding: 12px 18px`, 14.5px, ícono de 15px y una línea de blanco al 30 % a su izquierda |

- **Separación entre pasos.** El prototipo mete cada paso 14px bajo la punta del anterior (`margin-left: -14px`) y
  su recorte encaja justo: dos pasos grises seguidos se funden en una sola banda. Aquí se meten 12px: queda una
  línea de 2px del fondo entre paso y paso. El recorte no deja solapes, así que no hace falta el `z-index`
  decreciente del prototipo.
- **Muchos pasos.** Los seis de la declaración necesitan unos 1090px con las medidas del prototipo, más de lo que
  queda junto al lateral en una pantalla de 1440px. Como las pestañas (`tabs.css`), la lista es un contenedor: por
  debajo de 1100px los pasos se estrechan (`11px 24px 11px 28px`) y por debajo de 1000px pasan a 14.5px
  (`10px 20px 10px 24px`). Lo que aún no cabe se desplaza en horizontal, con una barra fina.
- **Sobre una tarjeta.** El prototipo pone galón y barra sobre su columna blanca, y la barra es gris (`#F6F6F6`).
  Aquí el fondo de la página ya es `surface-muted` (ese mismo gris), así que `PasosAsistente` los pone sobre una
  tarjeta blanca: el galón con `padding: 10px 18px` y la barra debajo, cuya línea inferior es el borde de la tarjeta.

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

## Menú en árbol (#53)

Con la variante `portal`, el lateral (`LateralPortal`) es el árbol de trámites del prototipo: `ArbolNav`
(`src/portal/shell/ArbolNav.tsx`), un componente genérico que recibe el árbol, con el contenido declarado en
`NAV_TREE` (`src/portal/shell/navTree.ts`). El shell clásico de light y dark conserva `NAV` y su menú de móvil.

- **Panel** de 292px (`w-73`) sobre `table-head` con borde `border`. Arriba, "Ir al inicio" (16px, `link`, con
  `aria-current` en `/`) y el botón "Ocultar el menú"; debajo, el título "Mis trámites" (18px, negrita, `link`).
- **Grupos**: `<button aria-expanded aria-controls>` de 17px en negrita `ink`, con un caret que gira 90° en 0.13s
  (`transition-transform duration-130`, quieto con `prefers-reduced-motion`). Plegado, su lista lleva `hidden`.
  **Subgrupos** (opcionales, ninguno hoy): 16px con sangría de 26px.
- **Hojas**: 15px en `link`, sangría de 34px (48px bajo un subgrupo). La activa lleva `aria-current="page"`, borde
  izquierdo de 4px `link`, negrita y un chevron. Una ruta hija marca su hoja: gana la más específica
  (`/contribuyentes/123` → Buscar contribuyentes, `/contribuyentes/nuevo` → Nuevo contribuyente) y una hoja puede
  declarar otras rutas de su pantalla (`tambienEn`: el asistente abierto desde la ficha marca Nueva declaración).
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

`nav.css` fija lo que el componente aproxima con tokens (`bg-ink/6` y `bg-ink/4` sobre `table-head`,
`text-ink-muted` en los carets):

| Regla                                         | Valor                            | Contraste                 |
| --------------------------------------------- | -------------------------------- | ------------------------- |
| `[data-ui='arbol-hoja'][aria-current='page']` | texto `#0D4D80`, fondo `#E6E6E6` | 7.04:1                    |
| `[data-ui='arbol-hoja']:hover`                | fondo `#E9E9E9`                  | `link` encima: 4.70:1     |
| `[data-ui='arbol-grupo']:hover`               | texto `#0D4D80`                  | 7.85:1 sobre `table-head` |
| `[data-ui='arbol-caret']`                     | `#555555`                        | 6.66:1 sobre `table-head` |

Tests: `src/portal/arbolNav.test.tsx` (árbol, hoja activa, plegado, memoria, pantalla estrecha, clásico intacto) y el
bloque `nav.css` de `src/themes/parciales.test.tsx` (valores y contrastes).
