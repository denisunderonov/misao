# Подготовка МИСАО к GitHub Pages

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Подготовить проверенную статическую сборку, ограничить выполнение постороннего кода и проверить отсутствие секретов.

**Architecture:** Существующий React-клиент, локальный Markdown и PDF остаются статическими. Защита применяется к обработке контента, production HTML и workflow публикации; доступ к редактированию обеспечивает GitHub/Pages CMS.

**Tech Stack:** React, TypeScript, Vite, Vitest, Playwright, GitHub Actions, Gitleaks.

**Spec:** Запрос владельца от 19.11.2026 и AGENTS.md.

## Global Constraints

- GitHub Pages, hash-маршруты и Vite BASE_URL.
- Без аккаунтов студентов, нового бэкенда и другого хостинга.
- Сохранить текущие незакоммиченные изменения и утверждённый дизайн.
- Проверить npm test, npm run build, npm run test:e2e и реальные снимки.
- Не печатать значения потенциальных секретов. Не переписывать Git-историю и не публиковать сайт в рамках подготовки.

## Review Focus

- Markdown/frontmatter не должен выполнять JavaScript ни при сборке, ни в браузере.
- Новые материалы, длинные заголовки и мобильная навигация не должны ломать интерфейс.
- Production-защита должна разрешать собственные шрифты, тему, PDF и ссылки с /misao/.
- В историю Git и артефакт не должны попадать ключи и локальные служебные файлы.
- Pull requests должны проверяться без права публикации и без сохранённых Git credentials.

### Task 1: Аудит и исправление границ контента

**Files:** scripts/content.mjs, src/App.tsx, src/lib/content.ts, tests/content.test.ts, tests/app.test.tsx.

- [x] Проверить Markdown, frontmatter, URL и PDF; воспроизвести каждую найденную проблему безопасным тестом.
- [x] Добавить регрессионные тесты для подтверждённых проблем, затем минимальные исправления.
- [x] Запустить соответствующие Vitest-проверки.

### Task 2: Production-сборка и публикация

**Files:** vite.config.ts, index.html, .github/workflows/pages.yml, .github/dependabot.yml, .gitignore, tests/security.test.ts, e2e/student-flow.spec.ts.

- [x] Добавить проверяемую CSP production-сборки без ослабления Markdown-защиты; проверить браузером.
- [x] Закрепить Actions проверенными SHA, ограничить permissions, убрать сохранение Git credentials, настроить обновления и аудит зависимостей.
- [x] Проверить Gitleaks рабочие файлы, всю локальную историю и dist; проверить состав артефакта и .gitignore.

### Task 3: UX и итоговая проверка

**Files:** src/App.tsx/src/styles.css при подтверждённых дефектах; docs/SECURITY.md, docs/TESTING.md, README.md.

- [x] Проверить desktop/mobile, обе темы, клавиатуру, меню, переходы и скачивание PDF; исправить подтверждённые проблемы.
- [x] Выполнить npm test, npm run build, npm run test:e2e после изменений, повторить сканирование итоговых файлов.
- [x] Провести независимый review; записать результаты, ограничения проверки и конкретные шаги владельца в GitHub.

## Результаты и решения

- YAML engine regression: безопасный marker выполнился до исправления; после замены парсера регрессионные тесты проходят.
- Решение: работать в существующем checkout, сохранив все ранее сделанные UI-правки; не создавать новую публикацию или коммит без запроса.
- Решение: снизить локальный параллелизм Chromium с 4 до 2 после ошибок launch/teardown. Это меняет нагрузку тестового окружения, не assertions.
- Независимый review: две CI-находки подтверждены тестами RED → GREEN, исправлены. Публикуемый артефакт теперь сканируется непосредственно перед upload; traces сохраняются из test-results/.
- Итог: 73 Vitest, build и 156 Playwright прошли; оба npm audit — 0; Gitleaks исходников, всей доступной истории и dist — 0 находок.
- Внешние GitHub/CMS настройки и фактический deployment не выполнялись. Лицензии шрифтов требуют подтверждения владельца перед публичным размещением.
