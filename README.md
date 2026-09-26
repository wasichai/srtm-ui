# srtm-ui

Web básica de **rentas municipales** (Perené) para [srtm-backend](../srtm-backend). Es una app Vite + React armada
solo con paquetes `@wasichai/*`, siguiendo la forma de `wasichai-ui/examples/gis-sample/web`, pero **sin GIS** y con
los módulos que corre el backend.

| | |
|---|---|
| Módulos | core, workflow, documents, views, forms, pages |
| Puerto | 5180 (`yarn dev` y `yarn preview`) |
| API | proxy de `/api` a `http://localhost:8090` (`WASICHAI_API_URL`) |
| Login de desarrollo | `admin@wasichai.local` / `admin` (seed de srtm-backend) |

Las pantallas de contribuyentes, predios y declaraciones prediales no se programan aquí: salen de la metadata que
`srtm-backend/model/apply.py` carga en Core. Listas, formularios y detalle se pueden ajustar desde la propia app
(Vistas, Formularios, Páginas).

## Requisitos

- Node 26 y yarn 1.
- Un checkout de `wasichai-ui` al lado (`../wasichai-ui`), instalado y compilado. Los paquetes `@wasichai/*` todavía no
  están publicados en GitHub Packages, así que se enlazan desde ahí (`link:` en `package.json`):
  ```bash
  cd ../wasichai-ui && yarn install && yarn build
  ```

## Arrancar

```bash
yarn install
yarn dev             # http://localhost:5180, con srtm-backend corriendo en :8090
```

Backend y datos: ver el README de `srtm-backend` (`docker compose up -d`, `./gradlew bootRun`, `model/apply.py` y
`model/import_predios.py`).

## Comandos

```bash
yarn test            # vitest: login y menú de módulos, contra un fetch simulado
yarn typecheck
yarn lint            # prettier --check (yarn format lo corrige)
yarn build           # dist/, luego yarn preview
```

## Notas

- Con los paquetes enlazados, `vite.config.ts` usa `resolve.preserveSymlinks` para que React y compañía se resuelvan
  desde el `node_modules` de este proyecto (una sola copia; con dos, los hooks fallan), y los tests cargan
  `@wasichai/*` a través de Vite (`test.server.deps.inline`).
- Tras cambiar algo en `wasichai-ui`, basta con `yarn build` allí: los enlaces apuntan a su `dist/`.
- Cuando `@wasichai/*` esté publicado: añadir `.npmrc` con `@wasichai:registry=https://npm.pkg.github.com`, cambiar
  los `link:` por versiones, y quitar `resolutions`, `preserveSymlinks` y `server.deps.inline`.

## Siguientes pasos

Pantallas propias de rentas (estado de cuenta, cálculo del predial, emisión de recibos) como un módulo
`WasichaiModule` en `src/`, cuando el backend tenga esos endpoints.
