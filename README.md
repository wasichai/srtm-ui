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
- **Infracciones administrativas** (grupo del menú entre Arbitrios y Emisión; en el menú clásico, _Infracciones_ abre
  los expedientes, con sus páginas enlazadas entre sí):
  - **Expedientes** (`/infracciones`): las actas por número, administrado (documento o nombre), código CUIS, fase y
    fechas, con su importe a pagar y la fecha en que se cifró. La **fase** del procedimiento (a la fecha que encabeza su
    columna) y el **estado de la deuda** (pendiente, anulada, dejada sin efecto) son dos columnas con sus nombres, y los
    dos los dice el backend; un acta anulada o dejada sin efecto no tiene fase («—»). Cada fila abre su expediente.
    - Encabeza la página el **panel** del ejercicio (selector de año; `/srtm/infracciones/panel?anio`): actas
      levantadas, resoluciones de sanción (RIS), notificadas y notificaciones previas que vencen esta semana (con la semana,
      de lunes a domingo), cada cifra del backend y con su fecha (`al_dia`). _En coactiva_ dice «No aplica» con la nota
      del backend: srtm no cobra, y no se muestra un 0.
  - **Nueva acta** (`/infracciones/nueva`): número del formulario, fecha y hora, lugar, el código del CUIS vigente el día
    de la infracción (la lista cambia con la fecha), la reincidencia que declara el inspector, el **obligado** (se elige
    siempre: no se deduce del contribuyente), el contribuyente o el predio (al menos uno), la notificación previa si la
    hubo (solo las no subsanadas y sin acta; se busca por parte de su número, `q`), expediente, inspector, descripción del hecho y observación. Pide creación
    sobre `papeleta`. El backend cifra la multa con la UIT y el CUIS de ese día y la congela en el acta: la pantalla
    muestra su desglose (base imponible = UIT, % e importe de la infracción, % a cobrar, importe a pagar, con beneficio
    «—», fecha de cálculo y referencia `PAPELETA-…`). Si falta la UIT del año o el % del grado en el CUIS, una alerta lo
    nombra y el acta no se registra.
  - **Ficha del expediente** (`/infracciones/:id`, también como pestaña de trabajo): la fase y el estado de la deuda con
    sus nombres, la referencia, el acta con su multa congelada y su fecha, sus **partes** (el obligado con su
    documento y su domicilio fiscal, el contribuyente y el predio, cada uno con el enlace a su ficha; con un backend
    que no manda `partes`, solo los enlaces), la versión del CUIS aplicada (código,
    vigencia, base legal) y los **actos del expediente** en el orden legal que da el backend (Nº, acto, fecha,
    documento, estado). **Anular** (motivo, fecha, hoy si va en blanco, y observación) pide creación sobre
    `anulacion_papeleta`; impedido, dice por qué con el motivo del backend (`acciones.anulacion.motivo`) o por permiso.
    - **Registrar descargo** (número de expediente, tipo de recurso, fecha de presentación, sustento y observación) pide
      creación sobre `descargo_papeleta`. Lo escrito dice su plazo (`5 DIAS_HABILES`), hasta cuándo se podía presentar y
      si se presentó dentro del plazo o fuera de él («se registra igual y se resuelve improcedente»): todo del backend,
      la pantalla no cuenta días hábiles. Si faltan el `PLAZO DESCARGO_PAPELETA` o los `FERIADOS` del año, una alerta
      los nombra.
    - **Dictar resolución**: la administrativa (RIS, sanciona; una por acta, con sanción accesoria) o la de recurso
      (RGR, resuelve un descargo: se eligen el descargo, el sentido del fallo y el efecto sobre la multa). _Se reduce_
      se ofrece deshabilitado con su porqué: no hay regla de reducción, la fija la ordenanza. Fecha (hoy si va en
      blanco), sustento y observación; pide creación sobre `resolucion_gerencia`. Lo escrito dice su número y abre su
      PDF; una segunda RIS o una segunda resolución del mismo descargo, o el `PLAZO RG_RECURSO` que falta, se muestran
      en el diálogo.
    - Los **descargos** (fechas, plazo, presentado hasta, en plazo, la resolución que lo resolvió) y las
      **resoluciones** (número, tipo, fecha, descargo, fallo, plazo de recurso) tienen su tabla. Cada resolución tiene
      **Ver PDF** (`/srtm/infracciones/resoluciones/{id}/pdf`, regenerado de sus datos) y **Notificar**: fecha de la
      diligencia (hoy si va en blanco), modalidad, resultado, notificador, dirección (vacía: el domicilio fiscal
      vigente a la fecha de la diligencia), receptor, documento, vínculo, acuse y observación; pide creación sobre
      `notificacion_resolucion`. Cada intento muestra desde cuándo es exigible la resolución, según el backend, o que
      no surte efecto (no ubicado). Con el acta anulada o dejada sin efecto no queda nada que notificar: **Notificar**
      se ve deshabilitado con el motivo del backend (`resoluciones[].acciones.notificacion.motivo`) bajo el botón.
    - Las acciones impedidas por el orden legal dicen el motivo del backend (`acciones.descargo.motivo`,
      `acciones.resolucion.motivo`); las que no permite la cuenta, el permiso que falta.
  - **CUIS** (`/infracciones/cuis`): el cuadro único de infracciones y sanciones vigente a una fecha (hoy, por
    omisión), por materia y por código o descripción, con la multa de cada código a la UIT de ese día (primera,
    segunda y tercera vez). Las multas las cifra el backend; la pantalla no multiplica nada. Sin UIT, una alerta nombra
    lo que falta y ninguna multa aparece como 0.
  - Un código no se edita: **Nueva versión** (o **Nuevo código**) crea una versión con su observación y cierra la
    vigente el día anterior. Pide creación sobre `codigo_infraccion`; sin ese permiso los botones se ven deshabilitados
    y dicen por qué.
  - **Notificaciones previas** (`/infracciones/notificaciones`): lo que se notificó antes de un acta, por número,
    contribuyente y fechas, con su plazo, su vencimiento y si está vencida a una fecha (hoy, por omisión; el encabezado
    la dice). Vencimiento y vencida son del backend (una sola definición): la pantalla no suma días. Cada fila dice si
    se subsanó y cuándo, y abre el acta que originó. **Nueva notificación** (número del formulario, fecha, contribuyente
    y predio opcionales, dirección, motivo, plazo en días opcional y observación) pide creación sobre
    `notificacion_administrativa`; **Subsanar** (fecha, hoy si va en blanco, y observación) pide creación sobre
    `subsanacion_notificacion` y se ve deshabilitado, con el porqué, si la fila ya está subsanada, ya tiene acta o está
    vencida a esa fecha.
  - **Escalas y plazos** (`/infracciones/plazos`):
    - **Vencidas sin acta**: las notificaciones previas no subsanadas y sin acta vencidas a una fecha de corte (hoy, por
      omisión; el título de la tabla dice la que aplicó el backend), con su plazo y su vencimiento.
    - **Por contribuyente**: las notificaciones previas del contribuyente elegido, con vencimiento, vencida o no,
      subsanación y el acta que originaron.
    - **Plazos cargados** (`/srtm/infracciones/plazos?anio`; el selector incluye el año siguiente, para revisar lo
      cargado antes de que rija): los `PLAZO` vigentes del año (clave, días, unidad, vigencia) y los `FERIADOS` del año
      con sus fechas, tal como los lee el backend; lo que falta (`faltan`) lo nombra una alerta, nunca un 0. Debajo, cómo
      se configuran: parámetros tributarios (`parametro_tributario`) `PLAZO` `DESCARGO_PAPELETA` y `PLAZO` `RG_RECURSO`
      (días hábiles, texto `DIAS_HABILES`) y `FERIADOS` `<año>` (los no nacionales, del 1 de enero al 31 de diciembre),
      cargados con `import_parametros.py` de srtm-backend o desde la lista de la administración (enlace solo para el
      rol `ADMIN`). Si al año le falta uno, el acto que lo necesita lo nombra en una alerta. Las escalas de las multas
      (% de la UIT por grado) están en el CUIS.
  - Pestaña **Infracciones** de las fichas de contribuyente y de predio (`?tab=infracciones`, después de Arbitrios;
    también durante la inscripción del contribuyente): sus actas (las del contribuyente como obligado o como
    contribuyente; las que nombran el predio) con número (abre el expediente), fecha, código, importe a pagar con su
    fecha de cálculo, y la fase y el estado de la deuda en dos columnas, a la fecha que da el backend (`al_dia`).
  - Lo común a los actos está en `src/portal`: `send` de `api.ts` lanza un `RentasError` con `faltan`, `errors` y
    `detail` y acepta cabeceras (`Idempotency-Key`); `DialogoDeActo` es el diálogo de un acto con observación de 5 a 500
    caracteres, y su `MensajeDeError` traduce un fallo de red (`fetch` sin respuesta) a «No hubo respuesta del
    servidor. Vuelva a intentarlo: el acto no se registra dos veces.»; `FaseBadge` / `BadgeDeMapa` muestran una fase o
    un estado con un mapa explícito; `usePuede` dice si la cuenta puede hacer una acción; `StatCard` acepta la fecha de
    su cifra (`fecha`) y una `nota`. Las consultas cuelgan de la clave `['infracciones', …]`.
- **Anuncios y propaganda** (grupo del menú después de Infracciones administrativas; en el menú clásico, _Anuncios_
  con sus páginas enlazadas entre sí). El estado (vigente, vencido, cesado, retirado), la vigencia que rige y la tasa
  son del backend, a la fecha que muestra la pantalla; la pantalla no los deduce de las fechas. Un anuncio cesado o
  retirado ya no rige: su vigencia se ve como «—» en el padrón, la ficha y las pestañas, nunca la de su último plazo.
  - **Padrón de anuncios** (`/anuncios`): por titular, clase, estado y texto, con el estado y la vigencia a una fecha
    (hoy, por omisión).
  - **Nuevo anuncio** (`/anuncios/nuevo`): titular, predio opcional y los datos del anuncio, con observación. El backend
    lo numera (`AN-AAAA-NNNNNN`) y devenga la tasa de su clase: la pantalla nunca manda una tasa. Cada intento de alta
    lleva un `Idempotency-Key` propio que se repite en sus reintentos (una respuesta perdida, un 5xx); si el backend
    responde que ya estaba registrado (200, `ya_existia`), la pantalla lo dice y no se devenga otra vez. Sin la tasa de
    la clase, una alerta nombra la llave que falta (`TASA_ANUNCIO PANEL 2026`), nunca un 0.
  - **Ficha del anuncio** (`/anuncios/:id`): sus datos, sus movimientos (acto, fecha, ejercicio, referencia de cargo,
    tasa con su fecha, vigencia, motivo, observación), el estado y la vigencia al día (cesado o retirado: «—» con
    «cesado el …» / «retirado el …», la fecha de su movimiento) y lo devengado con su fecha.
    **Renovar**, **Cesar** y **Retirar** piden observación (y motivo, cesar y retirar); un acto que el estado no admite
    (renovar un anuncio cesado o retirado, retirar sin cese previo) o que la cuenta no puede escribir (creación sobre
    `movimiento_anuncio`) se ve deshabilitado y dice por qué.
  - **Tasas de anuncios** (`/anuncios/tasas`): la tasa de cada clase en el año, con su vigencia, y las clases sin tasa.
    El selector incluye el año siguiente, para revisar las tasas cargadas antes de que rijan.
  - Pestaña **Anuncios** de las fichas de contribuyente y de predio (`?tab=anuncios`), con el estado al día.
  - Las consultas cuelgan de la clave `['anuncios', …]` (`claves.anuncios`): un acto refresca padrón, ficha y pestañas.
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
