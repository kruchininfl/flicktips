# Reverse proxy for flicktips.ru and the internal tg-brew service.
# Runs with network_mode: host, so it binds the host's :80/:443 directly.
FROM nginx:1.28-alpine

RUN rm -f /etc/nginx/conf.d/default.conf

COPY conf.d/ /etc/nginx/conf.d/

EXPOSE 80 443

CMD ["nginx", "-g", "daemon off;"]
