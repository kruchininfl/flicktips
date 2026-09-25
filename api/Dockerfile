# REST API (Silex 2.0 / Symfony 2.7) — must run on PHP 7.x.
FROM composer:2 AS vendor

WORKDIR /app

COPY api/composer.json api/composer.lock ./
RUN composer install \
    --no-dev \
    --no-scripts \
    --no-interaction \
    --prefer-dist


FROM php:7.4-fpm

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        libonig-dev \
    && docker-php-ext-install -j"$(nproc)" pdo_mysql mbstring opcache \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/* \
    && mkdir -p /var/run/mysqld

WORKDIR /var/www/api

COPY api/ ./
COPY --from=vendor /app/vendor ./vendor
COPY api/zz-flicktips.conf /usr/local/etc/php-fpm.d/zz-flicktips.conf
RUN rm -f /usr/local/etc/php-fpm.d/www.conf.default

EXPOSE 9000

CMD ["php-fpm"]
