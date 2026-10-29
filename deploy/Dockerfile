# la imagen de srtm-ui: nginx con el build de vite y deploy/nginx.conf. se construye desde la raíz del repo,
# después de yarn build:  docker build -f deploy/Dockerfile -t srtm-ui .
FROM nginx:1.29-alpine
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY dist/ /usr/share/nginx/html/
