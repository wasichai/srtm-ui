# Despliegue de srtm-ui

En producción srtm-ui es una imagen de nginx con el build de Vite (`dist/`) y la configuración de
[`nginx.conf`](nginx.conf). nginx sirve la web y pasa `/api/` a `srtm-core:8090`.

## Construir la imagen

Desde la raíz del repo:

```sh
yarn install --frozen-lockfile
yarn build
docker build -f deploy/Dockerfile -t srtm-ui .
```

El [`Dockerfile`](Dockerfile) parte de `nginx:1.29-alpine`. Copia `deploy/nginx.conf` como
`/etc/nginx/conf.d/default.conf` y `dist/` en `/usr/share/nginx/html`. El `.dockerignore` de la raíz deja en
el contexto solo esas dos cosas.

La configuración se toma de este repo, no del contenedor anterior: así cada despliegue lleva la que está
revisada y versionada.

## Por qué importa la configuración

Vite pone un hash en el nombre de cada chunk (`assets/LotesMapImpl-3f9a….js`), y cada build cambia esos
nombres. El `index.html` es el que dice qué chunks pedir. Por eso:

| Ruta                                                      | Respuesta                                            | Por qué                                                                                                    |
| --------------------------------------------------------- | ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `/index.html` y las rutas del SPA (`/`, `/brecha/visor`…) | `Cache-Control: no-cache`                            | el navegador lo revalida siempre y, tras un despliegue, recibe el nuevo, con los chunks nuevos             |
| `/assets/*` que existe                                    | `Cache-Control: public, max-age=31536000, immutable` | un nombre con hash no cambia nunca: se guarda un año sin volver a preguntar                                |
| `/assets/*` que no existe                                 | `404`                                                | no el `index.html` con `200`: el `import()` falla limpio en lugar de recibir HTML como si fuera JavaScript |

Las rutas del SPA llegan al `index.html` por `try_files $uri /index.html`, una redirección interna que cae en
`location = /index.html`, y ahí lleva su `no-cache`.

Con la configuración anterior (`try_files $uri /index.html` sin cabeceras) el navegador guardaba el
`index.html` de un build viejo. Tras un despliegue pedía chunks que ya no existían, recibía el `index.html` con
`200`, y el mapa mostraba «No se pudo mostrar el mapa en este equipo» ([#161](https://github.com/wasichai/srtm-ui/issues/161)).

La app, además, se defiende sola (`src/portal/components/lazyConRecarga.ts`): si falla la carga de un chunk,
recarga la página una vez. Si tras recargar vuelve a fallar, el aviso del mapa sugiere recargar sin caché.

## Comprobar la configuración

```sh
docker run --rm --add-host srtm-core:127.0.0.1 -v "$PWD/deploy/nginx.conf:/etc/nginx/conf.d/default.conf:ro" \
  nginx:1.29-alpine nginx -t
```

`--add-host` hace falta porque nginx resuelve `srtm-core` al arrancar.
