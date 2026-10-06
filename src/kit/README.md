# `src/kit`: la incubadora

Código reutilizable de srtm-ui que espera su turno para subir a wasichai-ui: el motor de formularios, la lista editable, las utilidades de flujo (cambios sin
guardar, mensaje de error) y los textos y el proveedor que los configuran. Nace aquí porque hoy solo srtm-ui lo usa, y la regla 6 de wasichai-ui pide un segundo
usuario concreto antes de abstraer (ver [Cuándo sube una pieza](#cuándo-sube-una-pieza)). Mientras tanto vive detrás de una frontera comprobada por un test,
para que no se contamine con el dominio del SRTM y suba sin reescribirse.

El portal (`src/portal`) usa el kit; el kit no conoce al portal. Lo que el motor sabía del SRTM llega inyectado: las etiquetas de los enums y los tipos de campo
propios por `KitProvider`, las cadenas por los defaults de `KitTexts`, los textos de "sin código" por una función `placeholder`, las dependencias de las
sugerencias por `dependsOn` y el año más antiguo por `yearFrom`. Las specs, los widgets y la orquestación se quedan en el portal.

Es la fase 1 de "páginas, formularios y componentes como metadata"; la fase 2 mueve lo que tenga segundo usuario a wasichai-ui (ver [Enlaces](#enlaces)).

## Reglas

1. **La frontera** (`boundaries.test.tsx`). Un archivo de `src/kit` que no es un test solo puede importar:
   - otro archivo del propio kit (una ruta relativa que cae fuera de `src/kit` falla);
   - `react`, `react-dom`, `react-hook-form`, `react-router`, `@tanstack/react-query`, `@wasichai/core`, `@wasichai/ui` y `lucide-react`, que es de lo que ya
     dependen los paquetes de wasichai-ui.

   El test mira `from '…'`, `import '…'` e `import('…')`, con comillas simples o dobles, así que el `import()` dinámico tampoco es una puerta lateral. Los
   tests del kit quedan fuera de la regla: pueden saber lo que quieran (pero ver [Pendientes](#pendientes-conocidos)).

2. **Sin dominio.** Ningún archivo del kit que no sea un test dice `contribuyente`, `predio`, `declaraci…`, `srtm`, `rentas`, `ubigeo`, `reniec`, `padrón`,
   `catastro`, `perené` ni `dj`. Lo comprueba el mismo test con una expresión regular sobre todo el archivo, comentarios incluidos. La expresión no agota el
   vocabulario (ver [Pendientes](#pendientes-conocidos)): el test detecta el escape grueso, la revisión el fino.

3. **Inglés en el código y los comentarios**: identificadores, comentarios y nombres de tipos, en el estilo escueto del kit. El portal conserva su estilo, en
   español. El español del kit son solo los textos que ve la persona, y esos no van sueltos en los componentes sino en `KitTexts`.

4. **Los textos y la configuración, por `KitProvider`.** El proveedor recibe, todo opcional, `texts` (un `Partial<KitTexts>`, que se mezcla sobre
   `DEFAULT_TEXTS`), `enumLabel`, `renderAlert` y `kinds`. `useKit()` devuelve la configuración ya resuelta, un `KitConfig`: `texts` es un `KitTexts`
   completo; `enumLabel(field, value)` dice cómo se escribe una opción (por defecto, tal como está guardada); `renderAlert(message)` dibuja la caja de error del
   formulario (por defecto, un `<p role="alert">` en rojo), y `kinds` son los tipos de campo propios de la app, por nombre, encima de `CORE_KINDS`. Sin
   proveedor rigen esos valores por defecto, así que un componente del kit funciona suelto.

   Los `kinds` tienen que ser estables: componentes definidos a nivel de módulo, en un objeto también de módulo. El motor dibuja cada uno como un componente,
   así que un renderer escrito en línea (`kinds={{ color: (p) => … }}`) es un componente nuevo en cada render del proveedor: su control se vuelve a montar y
   pierde el foco. Un objeto en línea con renderers estables no rompe nada, pero hace que todo lo del kit se vuelva a dibujar.

   El portal lo monta en `src/portal/KitDelPortal.tsx`, que inyecta `enumLabel` (`etiqueta`, de `src/portal/forms/etiquetas.ts`) y `renderAlert` (el
   `Alert` de `@wasichai/ui` con tono `danger`). No pasa `texts`: los defaults del kit ya son el texto del SRTM, tal como estaba en `HijosPanel` y los
   formularios. Otra app con otras palabras pasa un `texts` parcial.

5. **Qué entra en el kit**: lo que no sabe de dominio y tendría un segundo usuario verosímil, aunque hoy no lo tenga (un motor de formularios, una lista
   editable, un aviso de cambios sin guardar). Antes de mover algo, la pregunta es si caja-ui lo usaría tal cual, cambiando solo lo que se inyecta.

6. **Qué no entra**:
   - Las specs (`CONTRIBUYENTE_SECTIONS`, `DJ_*`, `LOTE_SECTIONS`…): son datos del dominio.
   - Los widgets con reglas del dominio (`UbigeoFields`, `UsoFields`, `CategoriasFields`, `CatastroMapa`, `UbicarDireccion`…): entran al motor como
     `kind: 'custom'` o por `kinds`, pero no viven aquí.
   - La orquestación: los asistentes, el guardado de la DJ, las listas de primer nivel, las emisiones.
   - Lo que tiene un solo uso: se queda en el portal hasta el segundo (regla de tres).

7. **Cuándo sube**: con un segundo usuario concreto (ver la sección siguiente). Hasta entonces, mover o cambiar código del kit no cambia lo que ve la persona:
   las suites de integración del portal lo comprueban.

## Cuándo sube una pieza

Una pieza sube a wasichai-ui cuando tiene **un segundo usuario concreto**, no antes. Es la regla 6 de wasichai-ui (una abstracción necesita un segundo usuario
concreto), que el spec aplica en cada nivel: wasichai-ui (lo genérico), un paquete de Perú y sector público (DNI/RUC, ubigeo del INEI) y la app. El segundo
usuario es **caja-ui**, que se reescribe sobre wasichai-ui como srtm-ui.

Al subir, la pieza se mueve al paquete, srtm-ui la importa de allí y su archivo desaparece del kit. Los paquetes de destino son los de `@wasichai/*`:
`@wasichai/ui` para lo que dibuja, `@wasichai/core` para lo que consulta datos y se apoya en `ApiError` (`@wasichai/ui` no puede importar de core). La tabla
[Qué sube en la fase 2](#qué-sube-en-la-fase-2-y-adónde) dice dónde va cada una.

### Lo que ya subió en la fase 1

Con `@wasichai/*` **0.4.0-dev.0** (una pre-release `-dev` publicada desde `dev`), primitivas sin dominio que srtm-ui había escrito para el portal y que caja-ui
necesita también:

- `@wasichai/ui`: `ConfirmDialog`, `Pagination`, `PageSizePagination` y `PdfDialog`, con sus ganchos `data-slot` para los temas.
- `@wasichai/core`: `QueryState`, con `LoadingState`, `EmptyState` y `ErrorState`.

El kit las usa en lugar de las suyas: `EditableList` toma `QueryState`, `EmptyState`, `PageSizePagination` y `ConfirmDialog`, y `ConfirmDiscard` toma
`ConfirmDialog`.

## Qué hay

| Archivo                  | Qué hace                                                                                                                                                                                                                                                                     |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `boundaries.test.tsx`    | La frontera: imports permitidos y vocabulario prohibido (ver [Reglas](#reglas)).                                                                                                                                                                                             |
| `texts.ts`               | `KitTexts` y `DEFAULT_TEXTS`: todas las cadenas del kit, en español, incluidas las funciones de plural y singular de la lista editable.                                                                                                                                      |
| `KitProvider.tsx`        | `KitProvider`, `useKit()` y `KitConfig` (`texts`, `enumLabel`, `renderAlert`, `kinds`): lo que la app inyecta.                                                                                                                                                               |
| `format.ts`              | `formatMoney`, `formatNumber`, `formatDate` (ISO o instante a `DD/MM/AAAA`), `formatText` y `currentYear`.                                                                                                                                                                   |
| `forms/RecordForm.tsx`   | `RecordForm`: un formulario para cualquier entidad, a partir de secciones. Reglas, condiciones, errores del backend bajo su campo, cambios pendientes y guardado en grupo.                                                                                                   |
| `forms/FieldGrid.tsx`    | `FieldGrid`: el lado de solo lectura de las mismas secciones (la ficha), con la misma rejilla.                                                                                                                                                                               |
| `forms/spec.ts`          | Los tipos de la spec (`FieldSpec`, `SectionSpec`, `FieldKind`, `FormValues`, `PlaceholderContext`, `SuggestSource`) y `dataFields` y `emptyOf`.                                                                                                                              |
| `forms/kinds.tsx`        | `CORE_KINDS`, `KindProps` y `KindRenderer`: el control de cada `kind`; la app añade los suyos con `kinds`.                                                                                                                                                                   |
| `forms/group.ts`         | `useFormGroup` y `useSharedFields`, con `FormHandle`, `FormLink` y `SharedFields`: varios formularios de una página que guarda un botón de fuera, y campos que son uno solo en varios.                                                                                       |
| `forms/locked.ts`        | `LOCKED`, `lockedOf`, `lock`, `unlock` y `lockedIn`: campos rellenados desde otro registro, en gris hasta que se desbloquean.                                                                                                                                                |
| `forms/fieldId.ts`       | `FieldIdContext` y `useFieldId`: el id del control al que apunta su etiqueta, con alcance para que dos formularios de una página no se crucen.                                                                                                                               |
| `forms/styles.ts`        | `selectClass`, `SPAN` y `GRID`: las clases de la rejilla de seis columnas y del `<select>` nativo.                                                                                                                                                                           |
| `forms/NativeSelect.tsx` | `NativeSelect`: el `<select>` nativo con el aspecto del `Input` de la librería y `data-slot="select-trigger"`.                                                                                                                                                               |
| `forms/geometry.ts`      | `Geometry` y `parseGeometry`: una geometría GeoJSON guardada como texto en un campo oculto.                                                                                                                                                                                  |
| `forms/SuggestInput.tsx` | `SuggestInput`: texto libre con sugerencias (un `datalist`), una petición por pausa.                                                                                                                                                                                         |
| `crud/EditableList.tsx`  | `EditableList`, `EditableListProps` y `Column<T>`: la lista de filas que cuelgan de un registro, con "+", lápiz y papelera sobre la fila elegida, tabla paginada y diálogo de alta y edición.                                                                                |
| `ui/errorMessage.ts`     | `errorMessage(error, fallback)`: lo que dice un fallo, o el texto de respaldo si no dice nada útil.                                                                                                                                                                          |
| `ui/UnsavedChanges.tsx`  | `useUnsavedChanges(pending)`, que devuelve `{ dialog, allow }`, y `ConfirmDiscard`: pregunta antes de salir de la página o del navegador con cambios sin guardar. Pide un router de datos.                                                                                   |
| `*.test.tsx`             | Los tests del kit: `KitProvider.test.tsx`, `forms/RecordForm.test.tsx`, `crud/EditableList.test.tsx`, `ui/UnsavedChanges.test.tsx`, `ui/errorMessage.test.tsx` y `boundaries.test.tsx`. No importan nada del portal (salvo lo dicho en [Pendientes](#pendientes-conocidos)). |

`EditableList` vuelve a leer su propia consulta (`queryKey`) después de grabar o eliminar, así que una app no tiene que refrescarla; `onChanged` es para lo
demás que deba leerse otra vez (el portal pasa `useRefresh`, que refresca fichas y totales). La columna de estado se titula `status.label` o, sin él,
`texts.status` ('Estado' por defecto).

## Por pieza

Los veredictos del spec, recortados a las piezas de srtm-ui. ⬆ sube a wasichai-ui · ◐ se incuba en `src/kit` (fase 1) y sube después · ◼ se queda en srtm-ui ·
✋ no tocar. Los nombres del spec que cambiaron al pasar al kit: `grupo.ts` es `forms/group.ts`, `campoId` es `forms/fieldId.ts`, `bloqueo` es
`forms/locked.ts`, `Columna<T>` es `Column<T>` y `CambiosPendientes` es `ui/UnsavedChanges.tsx`.

| Pieza                                                                                                               | Veredicto                                                                                                           | Ventajas                                                                                                                                              | Costos y riesgos                                                                                                                                                                                                                                                      |
| ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Motor de formularios: `RecordForm`, `FieldGrid`, tipos de la spec, `group`, `SuggestInput`, `fieldId`, `locked`     | ◐ ahora, ⬆ fase 2, convergiendo con `DynamicForm`                                                                   | Ya probado; tiene lo que wasichai no tiene (reglas, spans, errores del backend bajo su campo, guardado en grupo); caja-ui lo necesita                 | Escapes de dominio que se cerraron en la fase 1 (las claves de las sugerencias, el año desde 1900, los textos, `etiqueta()`, AUTO y padrón). Dos motores en wasichai hasta converger; valores planos en cadena frente a `attributes` con secciones piden un adaptador |
| Specs del dominio (`CONTRIBUYENTE_SECTIONS`, `DJ_*`, `LOTE_SECTIONS`…)                                              | ◼                                                                                                                   | Tipadas, refactorizables y probadas; pantallas regulatorias                                                                                           | Las etiquetas y los obligatorios duplican `model.json`; editadas desde el servidor sin lista blanca, un administrador podría romper una DJ legal                                                                                                                      |
| Bloques de campos: documento y persona, dirección y vías, ubigeo                                                    | ◼ como fragmentos ahora; ⬆ al paquete de Perú cuando caja-ui los use                                                | Quitan el bloque de ubigeo ×4, `PERENE` ×5 y `nombres` ×4                                                                                             | Las copias difieren (RUC a razón social, spans, obligatorios); un fragmento con muchas banderas es peor que repetir. `direccion.ts` debe seguir a `Reglas.kt`                                                                                                         |
| `HijosPanel` y `Columna<T>`                                                                                         | ◐ desacoplado (hecho: `EditableList`); ⬆ fase 2 como variante editable de `RELATED_LIST`                            | 8 usos; vista declarativa; caja-ui (líneas de una orden, medios de pago)                                                                              | La interacción "elegir la fila y luego la barra" es del SRTM; ya son más de 15 props, riesgo de explosión (un núcleo sin cabeza y una piel por defecto). `HijosPanel` sigue en el portal como envoltorio con la API, los catálogos y el estado                        |
| Fichas como árbol de `PageRenderer`                                                                                 | ✋                                                                                                                  | Tendría constructor visual                                                                                                                            | `PageRenderer` es por objeto y "el primer FORM guarda"; la DJ guarda 3 formularios de 2 registros; hay condiciones entre pasos y casi todo sería a medida. En su lugar, mejoras de `FichaTabs` (montaje perezoso, `?tab=`) a `Tabs` de `@wasichai/ui` en la fase 2    |
| Asistentes                                                                                                          | ✋ la orquestación; ⬆ `PasosGalon` y `BarraInstruccion` con wasichai-ui#14                                          | —                                                                                                                                                     | Un DSL de asistentes pide guardas, efectos y varios registros: un lenguaje de flujo en el cliente                                                                                                                                                                     |
| Orquestación de la DJ (`guardar`, `sobre`, `useComun`)                                                              | ✋                                                                                                                  | —                                                                                                                                                     | Leer-mezclar-escribir ×4 arriesga actualizaciones perdidas; se arregla de raíz con PATCH en la API de wasichai (fase 2, primero el backend)                                                                                                                           |
| Listas de primer nivel (`Listas.tsx`, `BuscarPage`)                                                                 | ◼                                                                                                                   | Dedupe barato                                                                                                                                         | 2 usos (regla de tres); búsqueda de `/api/srtm`, no vistas de wasichai                                                                                                                                                                                                |
| SIG (`LotesMapImpl`, `CatastroMapa`, `UbicarDireccion`, `BuscarPrediosDialog`)                                      | ✋                                                                                                                  | Se registran por nombre cuando exista el registro                                                                                                     | El widget sigue siendo código                                                                                                                                                                                                                                         |
| Valuación (`CategoriasFields`, `UsoFields`, `ObraCategoriaField`)                                                   | ✋                                                                                                                  | Se registran por nombre                                                                                                                               | Regulatorio (R.M. 309-2022)                                                                                                                                                                                                                                           |
| RENIEC (`reniec.ts`)                                                                                                | ✋ (integración postergada)                                                                                         | —                                                                                                                                                     | Si algún día sube: un comportamiento con la consulta inyectada como puerto                                                                                                                                                                                            |
| Emisiones                                                                                                           | ✋; solo sube su confirmación                                                                                       | —                                                                                                                                                     | Sondeo y retención del dominio                                                                                                                                                                                                                                        |
| Primitivas sin dominio: `ConfirmDialog` (4 a mano), `Paginador`, `QueryState` y `EmptyState`, `PdfDialog`           | ⬆ **fase 1, hecho** (0.4.0-dev.0): confirmación, paginación y PDF a `@wasichai/ui`; `QueryState` a `@wasichai/core` | Poco riesgo; la paginación ya tenía un segundo usuario (el `DataTable` de core), `PdfDialog` los recibos de caja-ui y `ConfirmDialog` sus anulaciones | Mantener los ganchos `data-slot` de los temas; los textos por i18n (en y es)                                                                                                                                                                                          |
| Utilidades de flujo: `CambiosPendientes` (`ui/UnsavedChanges.tsx`) y el mensaje de error (`ui/errorMessage.ts`, ×9) | ◐                                                                                                                   | Menos código                                                                                                                                          | `CambiosPendientes` pide el router de datos (`useBlocker`); aún no hay un segundo usuario claro                                                                                                                                                                       |
| Estructura de portal: `Alerta`, `PasosGalon`, `BarraInstruccion`, `ArbolNav`, `BandaTitulo`                         | `Alerta` y `ArbolNav` ⬆ hechos (`Alert` y `NavTree`, 0.5.0-dev.0); el resto ⬆ fase 2 (wasichai-ui#14)               | caja-ui es el segundo usuario que falta para el resto                                                                                                 | `navTree.ts`, `instrucciones.ts`, `tonoDeEstado` y la barra de marca se quedan (ADR-035)                                                                                                                                                                              |
| Shell: `WorkspaceTabs`, `TabBar`, `Breadcrumbs`, `AppShell` y las rutas                                             | `WorkspaceTabs` ⬆ con caja-ui (sin la unión `kind` del SRTM); ◼ el resto                                            | El portal como `WasichaiModule` dejaría a caja-ui componer igual                                                                                      | `NAV_TREE` (`alsoAt`, `soloAdmin`) no encaja en `navGroups`/`nav`: evaluar en la fase 2                                                                                                                                                                               |
| Etiquetas de los enums (`etiquetas.ts`)                                                                             | ⬆ al contrato: `enumOptions` con etiquetas (primero el backend)                                                     | caja-ui no escribiría su propio mapa a mano                                                                                                           | Toca el backend de wasichai. Mientras, entra al kit por `enumLabel`                                                                                                                                                                                                   |

## Qué sube en la fase 2 y adónde

Lo que el spec prevé para la fase 2, sobre lo que hoy hay en `src/kit`. Nada sube sin caja-ui empezando sobre ello.

| Pieza del kit                                                          | Destino                                                                                                                                            | Antes de subir                                                                                                                                                                       |
| ---------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `forms/*` (motor de formularios)                                       | wasichai-ui, con `DynamicForm` (`@wasichai/core`) como adaptador del mismo motor. El spec no fija el paquete: lo decide el ADR de la fase 2        | Un ADR del contrato de la spec de formulario: ids de sección, ubicaciones con span, etiqueta, obligatorio, visible y widget, la lista blanca L2, `enumOptions` con etiquetas y PATCH |
| `crud/EditableList.tsx`                                                | wasichai-ui, como variante editable de `RELATED_LIST`                                                                                              | Partirla en un núcleo sin cabeza y una piel por defecto (ya tiene más de 15 props)                                                                                                   |
| `texts.ts` y `KitProvider.tsx`                                         | Con el motor. Las primitivas de la fase 1 ya llevan sus palabras a los bundles i18n (es y en) de core; queda por decidir si `KitTexts` sigue igual | Que el español deje de ser el default de una librería                                                                                                                                |
| `format.ts`                                                            | Con el motor (o `@wasichai/core`)                                                                                                                  | Que tome idioma, moneda y zona horaria de la configuración (ver [Pendientes](#pendientes-conocidos))                                                                                 |
| `ui/UnsavedChanges.tsx` y `ui/errorMessage.ts`                         | wasichai-ui                                                                                                                                        | Un segundo usuario claro (`useBlocker` pide un router de datos)                                                                                                                      |
| Estructura de portal (`PasosGalon`, `BarraInstruccion`, `BandaTitulo`) | wasichai-ui, por [wasichai-ui#14](https://github.com/wasichai/wasichai-ui/issues/14). No están en el kit: viven en `src/portal`                    | caja-ui como segundo usuario                                                                                                                                                         |

## Pendientes conocidos

Lo que hoy impide subir el kit tal cual, dicho sin adornos:

- **`format.ts` está fijo a `es-PE`, `PEN` y `America/Lima`.** `formatMoney` y `formatNumber` formatean con `Intl` en `es-PE` y soles, y `formatDate` cuenta el
  día de un instante en Lima, no en UTC. Sirve mientras todos los usuarios sean peruanos, pero una librería tiene que tomar idioma, moneda y zona de la
  configuración.
- **`forms/RecordForm.test.tsx` importa `SRTM_THEMES`** de `src/themes`, para probar el formulario bajo el tema portal-tributario. Los tests están fuera de la
  frontera, pero el test no puede subir con esa importación: hay que sustituirla por un tema mínimo definido en el propio test.
- **El kit conserva ganchos `data-ui` con nombre del SRTM (en español, o de la ficha) que el tema del portal estiliza:**
  - `RecordForm`: `record-fieldset`, `record-legend` y `record-action` (`tabs.css`), `record-acciones` y `record-nota` (`banda.css`), y `record-number` y
    `record-title`, que hoy no tienen estilo;
  - `FieldGrid`: `ficha-seccion`, `ficha-titulo` y `ficha-kv` (`tables.css`).

  No son palabras del dominio, así que la frontera no los ve. Al subir, deben pasar a `data-slot` (como los de la librería), y sus parciales, a la hoja del tema
  de wasichai-ui.

- **Quedan restos de vocabulario que la expresión de la frontera no cubre:** `ficha` (`FieldSpec.shownInFicha`, `FieldGrid`, el `removeBody` por defecto),
  `clerk` en los comentarios y los ejemplos de `texts.ts` con `domicilio`. Conviene revisarlos en el ADR de la fase 2, cuando se congele el nombre de lo
  público.
- **Los valores del formulario son cadenas planas** (`FormValues = Record<string, string>`), no los `attributes` con secciones de wasichai: subir el motor pide
  un adaptador.
- **Los textos por defecto son en español.** Sin `KitProvider`, una app en inglés vería español.

## Enlaces

En el repositorio [wasichai](https://github.com/wasichai/wasichai):

- Spec: [`2026-09-29-metadata-ui-design.md`](https://github.com/wasichai/wasichai/blob/dev/docs/superpowers/specs/2026-09-29-metadata-ui-design.md), con el
  veredicto, las reglas y las fases.
- Plan de la fase 1 en wasichai-ui:
  [`2026-09-29-metadata-ui-f1-wasichai-ui.md`](https://github.com/wasichai/wasichai/blob/dev/docs/superpowers/plans/2026-09-29-metadata-ui-f1-wasichai-ui.md).
- Plan de la fase 1 en srtm-ui, el de esta incubadora:
  [`2026-09-29-metadata-ui-f1-srtm-ui.md`](https://github.com/wasichai/wasichai/blob/dev/docs/superpowers/plans/2026-09-29-metadata-ui-f1-srtm-ui.md).
- La estructura de portal en la librería: [wasichai-ui#14](https://github.com/wasichai/wasichai-ui/issues/14).
