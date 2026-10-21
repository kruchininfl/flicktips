# FlickTips

Сайт рекомендаций фильмов [flicktips.ru](https://flicktips.ru). Устройство репозитория описано в [AGENTS.md](AGENTS.md).

## Локальный запуск

Весь стек (web SSR, webpack-dev-server с hot reload, PHP API, nginx) поднимается командой
`tools/local.sh up` и открывается на https://flicktips.local. Локальной базы нет: API работает
с `flicktips_test` на сервере через SSH-туннель, который скрипт открывает сам. Парсеры
в локальный стек не входят.

### Подготовка (один раз)

1. Docker с `docker compose`. Если демон не запущен, скрипт сам запустит Colima.
2. SSH-доступ к серверу (по умолчанию `root@45.15.252.159`, меняется через `DEPLOY_HOST`).
3. mkcert: `brew install mkcert && mkcert -install`. Сертификат для `flicktips.local` скрипт выпустит сам.
4. В `/etc/hosts`:
   ```
   127.0.0.1 flicktips.local
   ::1 flicktips.local
   ```
5. `cp .env.example .env` и заполнить секреты: как минимум `DB_USER` и `DB_PASSWORD`, а также
   ключи VK, Yandex, `TMDB_API_KEY`, `KP_API_KEY`.

### Команды

Из корня репозитория:

```sh
tools/local.sh up             # туннель к БД + сборка и запуск стека
tools/local.sh logs [сервис]  # логи (web, assets, api, nginx)
tools/local.sh down           # остановить стек и закрыть туннель
```

### Порты и переменные

- На localhost должны быть свободны порты 443 (nginx) и 8050 (webpack-dev-server).
- Туннель к MySQL слушает `127.0.0.1:3307` (`LOCAL_DB_PORT`). Если порт уже открыт другим туннелем, скрипт использует его.
- Домен меняется через `LOCAL_HOST` (по умолчанию `flicktips.local`).

Вход через VK работает, только если локальный URL разрешён в приложении VK ID.
