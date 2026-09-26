# srtm-ui

Web de **rentas municipales** (Perené) para [srtm-backend](../srtm-backend). Es una sola app Vite + React con dos
partes, y ambas comparten el login (el mismo token en `localStorage['srtm.*']`):

| Ruta | Para quién | Qué es |
|---|---|---|
| `/` | personal municipal (ventanilla, rentas) | el **portal**: buscar contribuyentes y predios, fichas en pestañas, alta y edición de contribuyentes, predios y declaraciones |
| `/admin` | administradores | el `WasichaiApp` de wasichai-ui: objetos, vistas, formularios, páginas, workflows, documentos, usuarios |

| | |
|---|---|
| Puerto | 5180 (`yarn dev` y `yarn preview`) |
| API | proxy de `/api` a `http://localhost:8090` (`WASICHAI_API_URL`) |
| Login de desarrollo | `admin@wasichai.local` / `admin` (seed de srtm-backend) |

## Portal (`src/portal`)

El aspecto y la navegación siguen a `../gisxp`: cabecera con búsqueda global, barra lateral oscura y pestañas de
trabajo. Los componentes (`Card`, `Table`, `Tabs`, `Badge`, `Button`…) y los tokens de color vienen de
`@wasichai/ui`, que comparte el sistema de diseño de gisxp.

- **Pestañas de trabajo**:
  - Cada ficha que se abre queda como pestaña hasta que se cierra, para poder atender a varias personas a la vez.
  - "Inicio" es fija.
  - Las pestañas se guardan por pestaña del navegador (`sessionStorage['srtm.tabs']`).
- **Ficha de contribuyente**:
  - Cabecera y totales del año seleccionado (predios, autoavalúo, valor afecto).
  - Pestañas **Datos** (ver y editar), **Predios** (declaraciones del año, con enlace a cada predio) y
    **Declaraciones** (todos los años, alta y edición en un diálogo).
- **Ficha de predio**: igual, con **Titulares** en lugar de Predios.
- **Datos**: vienen de la API del portal `/api/srtm/**` de srtm-backend, que usa en proceso los servicios de wasichai
  (`RecordService`) en lugar de un BFF.
  - Las opciones de los desplegables salen de `/api/srtm/catalogos`, es decir, del modelo.
  - Un error de validación del backend se muestra debajo de su campo.

- **Tema**: claro, oscuro o el del sistema, con el botón de la cabecera.
  - El portal monta los providers de core (`WasichaiProviders`), así que la sesión y el tema son los mismos que en el
    admin.
  - La elección se guarda en `srtm.theme` y, con un backend que tenga `PUT /auth/me/preferences` (wasichai ≥ 0.2.0),
    también para el usuario.
  - `index.html` aplica el tema antes de cargar la app, para que no parpadee.

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
yarn test            # vitest: admin (login, módulos) y portal (login, búsqueda, pestañas, fichas, edición), con fetch simulado
yarn typecheck
yarn lint            # prettier --check (yarn format lo corrige)
yarn build           # dist/, luego yarn preview
```

## Notas

- Versión de wasichai-ui: `@wasichai/*` 0.2.1, igual en todos los paquetes. Para actualizar, cambiar la versión de
  todos a la vez en `package.json`, alinear las dependencias que comparten (react-query, testing-library…) y correr
  `yarn install`. Luego reiniciar el servidor con `yarn dev --force`: Vite guarda los paquetes pre-empaquetados y, si
  no, sigue sirviendo la versión anterior.
- Para probar cambios de un checkout local de wasichai-ui antes de publicarlos, `yarn link` no basta: React y
  react-query quedarían duplicados. Mejor `yarn pack` en cada paquete e instalar los `.tgz`.

## Siguientes pasos

Estado de cuenta, cálculo del predial y emisión de recibos como nuevas pestañas de la ficha, cuando srtm-backend
tenga esos casos de uso en `srtm.rentas`.
