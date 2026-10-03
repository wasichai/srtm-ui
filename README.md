# srtm-ui

Web de **rentas municipales** (Perené) para [srtm-backend](../srtm-backend). Es una sola app Vite + React con dos
partes, y ambas comparten el login (el mismo token en `localStorage['srtm.*']`):

| Ruta     | Para quién                              | Qué es                                                                                                                        |
| -------- | --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `/`      | personal municipal (ventanilla, rentas) | el **portal**: buscar contribuyentes y predios, fichas en pestañas, alta y edición de contribuyentes, predios y declaraciones |
| `/admin` | administradores                         | el `WasichaiApp` de wasichai-ui: objetos, vistas, formularios, páginas, workflows, documentos, usuarios                       |

|                     |                                                                |
| ------------------- | -------------------------------------------------------------- |
| Puerto              | 5180 (`yarn dev` y `yarn preview`)                             |
| API                 | proxy de `/api` a `http://localhost:8090` (`WASICHAI_API_URL`) |
| Login de desarrollo | `admin@wasichai.local` / `admin` (seed de srtm-backend)        |

## Portal (`src/portal`)

El aspecto y la navegación siguen a `../gisxp`: cabecera con búsqueda global, barra lateral oscura y pestañas de
trabajo. Los componentes (`Card`, `Table`, `Tabs`, `Badge`, `Button`…) y los tokens de color vienen de
`@wasichai/ui`, que comparte el sistema de diseño de gisxp.

- **Pestañas de trabajo**:
  - Cada ficha que se abre queda como pestaña hasta que se cierra, para poder atender a varias personas a la vez.
  - "Inicio" es fija.
  - Las pestañas se guardan por pestaña del navegador (`sessionStorage['srtm.tabs']`).
- **Registro de contribuyente** (fase 1 de la presentación del SRTM, `Presentacion2_.pdf`):
  - **Nuevo contribuyente** (`/contribuyentes/nuevo`): el asistente del SRTM.
    - Pestaña "Datos del contribuyente", con sus tres secciones numeradas: datos de la declaración, identificación y
      datos personales. Persona natural o jurídica cambia los campos.
    - Las demás pestañas quedan en gris. "Siguiente" inscribe al contribuyente y abre su ficha en Domicilios.
  - **Ficha**: Datos del contribuyente, Domicilios, Relacionados, Medios de contacto y Sustento, como en el SRTM. Luego
    Predios (los del año, con totales) y Declaraciones (todos los años, alta y edición).
    - Cada lista tiene su diálogo de alta y edición, y baja con confirmación.
    - El domicilio usa la cascada departamento → provincia → distrito (ubigeo INEI) y sugerencias de vías y unidades
      urbanas del catálogo. Muestra en vivo la descripción que guardará el backend.
    - Sin domicilio fiscal activo aparece el aviso del SRTM. En los contribuyentes importados, además, el domicilio
      del padrón.
  - La pestaña abierta va en la URL (`?tab=domicilios`).
- **Declaración jurada predial** (fase 2):
  - **Asistente "Nueva declaración"**, desde la pestaña Declaraciones del contribuyente.
    - Primero "Datos del predio": adquisición, documentos de sustento, y condición del predio y predio inhabitable,
      cuyos campos se habilitan al elegir una.
    - Luego "Datos de la ubicación": un predio del padrón (búsqueda) o uno nuevo, con código autogenerado y la cascada
      de ubigeo.
    - Guardar presenta la DJ y la abre en Transferentes.
  - **Página de la DJ** (`/declaraciones/:id`): Datos del predio, Datos de la ubicación, Datos del transferente,
    Características, Datos de los condóminos y Otros frentes.
    - Características: niveles de construcción con las letras A–I de sus siete categorías y, al lado, la descripción
      oficial del cuadro de valores unitarios. También obras complementarias, con el total metrado en vivo.
    - "Datos de los condóminos" solo se habilita en una DJ de condómino, como en el SRTM.
    - Cada pestaña de formulario guarda solo sus propios campos, sobre la DJ tal como está en ese momento.

  - Los contribuyentes importados del padrón deben completar lo que exige el SRTM (tipo de contribuyente, sexo,
    estado civil…) la primera vez que se editan.
- **Ficha de predio**: igual, con **Titulares** en lugar de Predios.
- **Datos**: vienen de la API del portal `/api/srtm/**` de srtm-backend, que usa en proceso los servicios de wasichai
  (`RecordService`) en lugar de un BFF.
  - Las opciones de los desplegables salen de `/api/srtm/catalogos`, es decir, del modelo.
  - Un error de validación del backend se muestra debajo de su campo.

- **Tema**: sistema, claro, oscuro o _Portal tributario_, en el menú de tema de la cabecera.
  - _Portal tributario_ reproduce un portal tributario en línea: barra de marca azul, menú de trámites en árbol, pasos
    en galón en los asistentes, banda de título, pestañas carpeta, fieldsets con la leyenda sobre el borde, tablas
    cebra y alertas en cuatro tonos, en Arial 14px. A diferencia de claro y oscuro, cambia también la estructura del
    portal; el admin toma sus colores y la forma de sus controles, tablas y pestañas. Detalle, decisiones y contrastes
    en `src/themes/portal-tributario/README.md`.
  - El tema es de `@wasichai/*` (desde 0.3): `PORTAL_TRIBUTARIO_THEME` de `@wasichai/core` y la hoja
    `@wasichai/ui/themes/portal-tributario.css`. srtm-ui añade los parciales de sus pantallas
    (`src/themes/portal-tributario/`) y los componentes de la estructura de portal.
  - Los temas que registra srtm-ui están en `src/themes` (`SRTM_THEMES`); el portal y el admin los registran en core.
  - `useVarianteTema()` dice si el tema aplicado pide la estructura de portal (`'portal'`) o la clásica (`'clasico'`).
  - **Añadir un tema**:
    1. Un bloque `[data-theme='<id>']` con los 18 tokens base y los de extensión de `@wasichai/ui/theme.css` (todos: un
       tema parcial hereda valores sueltos, ADR-034), en `src/themes/<id>/tokens.css`, importado desde
       `src/themes/<id>/index.css` y este desde `src/index.css`. Si el tema es de la librería, basta con importar su
       hoja.
    2. Su entrada en `SRTM_THEMES` (`{ id, label, colorScheme }`, `id` en `^[a-z0-9-]{1,40}$`), su etiqueta en el i18n
       (la de un tema de la librería ya viene en el de core) y su `colorScheme` en el script de `index.html` (un test
       comprueba que coinciden).
    3. Si cambia la forma de los componentes, parciales `src/themes/<id>/*.css` fuera de capas, bajo el selector del
       tema, enganchados en los `data-slot` de `@wasichai/ui` o en los atributos `data-ui` de srtm-ui (catálogo en el
       README del tema). Si cambia la estructura, una variante en `useVarianteTema`.
  - El portal monta los providers de core (`WasichaiProviders`), así que la sesión y el tema son los mismos que en el
    admin.
  - La elección se guarda en `srtm.theme` y, con un backend que tenga `PUT /auth/me/preferences` (wasichai ≥ 0.2.0),
    también para el usuario.
  - `index.html` aplica el tema antes de cargar la app, para que no parpadee. Un tema que no conoce cae al del sistema,
    como en core.

- **Registro de predio y catastro fiscal** (fase 3, págs. 11-14 de la presentación):
  - **"Buscar predios"** (pág. 13): un diálogo con pestañas _Buscar en Tributario_ (el padrón, la que abre) y _Buscar
    en Catastro Fiscal_.
    - Tiene los filtros del SRTM, Limpiar / Buscar, y una tabla paginada (Filas 5/10/25).
    - Debajo, el mapa de los lotes: la fila elegida se resalta y un clic en un lote elige su fila. La cámara descarga
      una imagen del mapa.
    - Se abre desde la ubicación de una DJ o de un predio (rellena la ubicación, el código CPU y el polígono), desde
      el asistente de DJ (un predio del padrón pasa a ser el de la declaración) y desde la lista de predios (abre la
      ficha, o "Nuevo predio" ya ubicado).
    - Un lote elegido (pág. 14) copia su código de predio municipal al predio nuevo y deja en gris lo que trajo del
      catastro (departamento, provincia y distrito según su ubigeo, vía, zona, manzana, lote, código CPU, polígono),
      hasta pulsar _Desbloquear_. Un predio que ya está en el padrón conserva su código.
    - En _Buscar en Catastro Fiscal_, _Nuevo lote_ y _Editar lote_ abren el editor de lotes; sobre un formulario a
      medio llenar lo abren en otra pestaña del navegador.
  - **Lotes del catastro fiscal** (`/catastro/nuevo`, `/catastro/:id`, también desde el inicio): código CPU, código
    municipal, ubicación y el polígono dibujado en el mapa, sobre los demás lotes del catastro. Cada lote abierto queda
    como pestaña de trabajo.
  - **Ubicación del predio:** incluye la sección _Predio de catastro fiscal_, con código CPU, código municipal y un
    mapa. En ese mapa se ve el lote del predio sobre los del catastro, se elige uno con un clic, o se dibuja / edita el
    polígono.
  - **Datos del predio de la DJ:** muestran código y número de registro del predio, el tipo de predio (que se guarda
    en el predio), la fecha de actualización y _Otros datos_.
  - **Ficha y alta de predio** (`/predios/:id`, `/predios/nuevo`) con la ubicación del SRTM, en lugar del formulario
    simple del padrón.
  - **Obra complementaria:** la categoría se elige del instructivo oficial y fija la unidad de medida. Sin catálogo
    cargado, se escribe a mano.
- **Arbitrios** (grupo _Arbitrios_ del menú):
  - Pestaña **Arbitrios** de las fichas de predio y de contribuyente (`?tab=arbitrios`): servicio por mes, el titular
    de cada mes y los totales del backend con su fecha; un mes sin cuota lo dice, nunca un 0. Desde ahí se determinan
    las cuotas que falten del año, con observación y permiso de creación sobre `cuota_arbitrio`.
  - **Consulta de cuotas** (`/arbitrios`), **Tasas del año** (`/arbitrios/tasas`: la ordenanza, sus tasas, zonas, usos
    y vencimientos, y lo que le falta al año) y **Determinación masiva** (`/arbitrios/determinaciones`).
  - **Emisión masiva** (`/emisiones`): la HR y el PU de todo un año, y la HLA si se pide, en segundo plano.
- **Infracciones administrativas** (grupo del menú entre Arbitrios y Emisión; en el menú clásico, _Infracciones_ con
  sus páginas enlazadas entre sí):
  - **CUIS** (`/infracciones/cuis`): el cuadro único de infracciones y sanciones vigente a una fecha (hoy, por
    omisión), por materia y por código o descripción, con la multa de cada código a la UIT de ese día (primera,
    segunda y tercera vez). Las multas las cifra el backend; la pantalla no multiplica nada. Sin UIT, una alerta nombra
    lo que falta y ninguna multa aparece como 0.
  - Un código no se edita: **Nueva versión** (o **Nuevo código**) crea una versión con su observación y cierra la
    vigente el día anterior. Pide creación sobre `codigo_infraccion`; sin ese permiso los botones se ven deshabilitados
    y dicen por qué.
  - Lo común a los actos está en `src/portal`: `send` de `api.ts` lanza un `RentasError` con `faltan`, `errors` y
    `detail` y acepta cabeceras (`Idempotency-Key`); `DialogoDeActo` es el diálogo de un acto con observación de 5 a 500
    caracteres; `FaseBadge` / `BadgeDeMapa` muestran una fase o un estado con un mapa explícito; `usePuede` dice si la
    cuenta puede hacer una acción. Las consultas cuelgan de la clave `['infracciones', …]`.
  - Expedientes, nueva acta, notificaciones previas, escalas y plazos y la pestaña de las fichas llegan en los PR
    siguientes.
- **Otros:**
  - todas las listas de la ficha van paginadas, como en el SRTM;
  - el domicilio se ubica en el mapa ("Buscar dirección");
  - cada pantalla muestra la ruta del SRTM ("Registro tributario y determinación › Registro tributario › …").
- **Mapas:** `components/LotesMap.tsx` usa maplibre-gl 6.10.0 y terra-draw 1.33.0, las mismas versiones que
  `@wasichai/gis`.
  - Se carga diferido: maplibre solo baja con el primer mapa. `main.tsx` le pasa la URL del worker.
  - El fondo es OpenStreetMap, así que necesita internet. Los lotes vienen de wasichai-gis
    (`/api/gis/objects/{objeto}/features?bbox=…`).
  - En los tests, el mapa es un doble que expone sus gestos como botones: elegir, dibujar, marcar un punto.

El admin (`src/admin`) no cambia: las pantallas de metadata salen de lo que `srtm-backend/model/apply.py` carga en
Core. El enlace "Administración" de la cabecera del portal solo aparece para el rol `ADMIN`.

## Requisitos

- Node 26 y yarn 1.
- Acceso de lectura a GitHub Packages: los paquetes `@wasichai/*` se instalan de `npm.pkg.github.com` (el scope está en
  el `.npmrc` del proyecto). El token va en `~/.npmrc`, fuera del repo:
  ```
  //npm.pkg.github.com/:_authToken=<token con read:packages>
  ```
  Sirve un PAT classic con solo `read:packages`, o el de `gh` (`gh auth refresh -s read:packages`, luego `gh auth token`).

## Arrancar

```bash
yarn install
yarn dev             # http://localhost:5180, con srtm-backend corriendo en :8090
```

Backend y datos: ver el README de `srtm-backend` (`docker compose up -d`, `./gradlew bootRun`, `model/apply.py` y
`model/import_predios.py`).

## Comandos

```bash
yarn test            # vitest: admin (login, módulos) y portal (fichas, edición, arbitrios, emisión, infracciones…), con fetch simulado
yarn typecheck
yarn lint            # prettier --check (yarn format lo corrige)
yarn build           # dist/, luego yarn preview
```

## Notas

- Versión de wasichai-ui: `@wasichai/*` 0.4.0, igual en todos los paquetes. Para actualizar, cambiar la versión de
  todos a la vez en `package.json`, alinear las dependencias que comparten (react-query, testing-library…) y correr
  `yarn install`. Luego reiniciar el servidor con `yarn dev --force`: Vite guarda los paquetes pre-empaquetados y, si
  no, sigue sirviendo la versión anterior.
- Para probar cambios de un checkout local de wasichai-ui antes de publicarlos, `yarn link` no basta: React y
  react-query quedarían duplicados. Mejor `yarn pack` en cada paquete e instalar los `.tgz`.

## Siguientes pasos

- **Integraciones:** consulta PIDE RENIEC. Hoy esos datos se cargan a mano.
- **Estado de cuenta, cálculo del predial y emisión de recibos**, como nuevas pestañas de la ficha, cuando srtm-backend
  tenga esos casos de uso en `srtm.rentas`.
