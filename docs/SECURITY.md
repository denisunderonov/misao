# Безопасность и подготовка к публикации

Проверка: 19 ноября 2026 года. Сайт предназначен для открытых учебных материалов. Абсолютная защита от взлома не гарантируется; проверка не является внешним пентестом инфраструктуры GitHub или Pages CMS.

## Что исправлено

- Удалён `gray-matter`: его выбор движка через `---javascript` позволял выполнить код при сборке Markdown. Теперь метаданные разбираются только как YAML библиотекой `yaml`, без выполнения кода. Движки, неизвестные YAML-теги, повторяющиеся ключи и неполные разделители отклоняются. Число разворачиваемых aliases ограничено. Проверяется и база знаний, и домашние задания.
- Production-сборка получает Content Security Policy до первого скрипта. Разрешены собственные JS/CSS/шрифты и точный SHA256 раннего скрипта темы. Запрещены произвольный inline JavaScript, `eval`, подключения через fetch/WebSocket, формы, плагины и iframe. Для изображений разрешены свой origin, HTTPS и data. `no-referrer` исключает передачу URL страницы внешним ресурсам.
- Сохраняется безопасный Markdown: raw HTML не исполняется; опасные URL-схемы отсекает `react-markdown`. Домашние задания целиком текстовые. Поле PDF, загрузка файлов в CMS и обработчик вложений удалены.
- GitHub Actions закреплены полными SHA. Checkout не сохраняет Git credentials; обычные проверки имеют только `contents: read`. PR не публикуется. Запись в Pages и OIDC выдаются только deploy после успешных проверок main. Личные токены не нужны.
- Установка зависимостей в CI выполняется через `npm ci --ignore-scripts`. Добавлены npm audit, Gitleaks для файлов/истории/артефакта и недельные предложения обновлений Dependabot. Бинарник Gitleaks закреплён версией и SHA256; находки редактируются в логах через `--redact`.
- В .gitignore добавлены локальная .npmrc, закрытые ключи, контейнеры сертификатов, логи и coverage.

CSP применяется к собранному HTML, а не к dev-серверу с HMR. Не редактируйте dist/index.html вручную: это нарушит хэш скрипта. Проверяйте через npm run build и npm run preview.

## Результат проверки секретов

Gitleaks 8.30.1 с правилами по умолчанию не обнаружил секретов в рабочем дереве исходников (включая новые неигнорируемые файлы), всей доступной Git-истории и dist. Перед проверкой история origin обновлена; доступно два коммита. Отдельно проверены список отслеживаемых файлов, отсутствие env/ключей и локальных Git credential-настроек. npm audit для production и всех зависимостей показал 0 известных уязвимостей.

Сканер ищет известные форматы и подозрительные значения, а не доказывает отсутствие любых секретов. Игнорируемые локальные зависимости/временные отчёты не входят в снимок исходников. Облачные GitHub Secrets, журналы прошлых workflow, удалённые коммиты и чужие копии репозитория не проверялись. Публичный Git также раскрывает имя/email автора коммитов: это метаданные, не токен доступа.

В dist включены HTML, JS/CSS с опубликованным текстовым контентом, локальные шрифты и SVG. PDF удалён из проекта и сборки. Исходники, .git, .env, node_modules, тестовые отчёты и sourcemaps в него не включены. Скрытие записи через published: false не делает историю публичного Git-репозитория приватной. Не размещайте там закрытые документы, персональные данные студентов, ключи или пароли.

## Что настроить владельцу в GitHub

1. В Settings → Pages выбрать Source: GitHub Actions и проверить Enforce HTTPS. Для github.io HTTPS поддерживается GitHub; локально состояние настройки не подтверждалось.
2. Защитить GitHub-аккаунт двухфакторной аутентификацией или passkey, сохранить recovery codes вне репозитория. Pages CMS дать доступ только к этому репозиторию; не выдавать другим пользователям права записи без необходимости.
3. В Settings → Environments → github-pages ограничить deployment веткой main. В настройках Actions оставить минимальные права токена и подтверждение workflow внешних участников.
4. Проверить доступные Secret scanning / Push protection и Dependabot alerts в Security. Gitleaks в workflow дополняет эти средства.
5. Если включаете обязательный PR для main, редактируйте в Pages CMS отдельную ветку и переносите материалы через PR: прямое сохранение CMS в защищённую main может блокироваться. Не отключайте проверки ради публикации ошибочного контента.
6. Перед публичной публикацией подтвердить права на Gilroy/NextArt или выбрать шрифты с разрешённым распространением: отдельная лицензия в репозитории референса не найдена. Происхождение сохранено в public/fonts/README.md.

Настройки аккаунта, реальная установка Pages CMS, GitHub-hosted workflow и live-сайт проверяются после подключения владельцем. В рамках этой подготовки push и deploy не выполнялись.

## Повторная проверка

```sh
npm ci --ignore-scripts
npm audit --audit-level=high
npm test
npm run build
npm run test:e2e
```

При установленном Gitleaks:

```sh
gitleaks git . --log-opts="--all" --redact --no-banner
gitleaks dir dist --redact --no-banner
```

Полный workflow также сканирует рабочие файлы до установки node_modules. Если секрет когда-либо обнаружится, сначала отзовите/замените его у провайдера; одного удаления строки недостаточно.

## Источники

- [GitHub: безопасное использование Actions](https://docs.github.com/en/actions/reference/security/secure-use)
- [GitHub: Pages и HTTPS](https://docs.github.com/en/pages/getting-started-with-github-pages/securing-your-github-pages-site-with-https)
- [GitHub: custom Pages workflows](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)
- [GitHub: Secret scanning](https://docs.github.com/en/code-security/concepts/secret-security/secret-scanning)
- [MDN: Content Security Policy](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CSP)
- [Gitleaks 8.30.1](https://github.com/gitleaks/gitleaks/releases/tag/v8.30.1)

GitHub Pages не предоставляет проекту управление всеми HTTP response headers. CSP установлена через HTML meta; frame-ancestors и X-Frame-Options таким способом не включаются. Защита сайта от встраивания на чужие страницы здесь не заявляется.
