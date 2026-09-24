# Kinopoisk Ease

Расширение для Chrome и других Chromium-браузеров. На странице фильма или сериала на Кинопоиске показывает аккуратную плашку: постер, название, рейтинг, длительность, описание и кнопку «Смотреть», которая ведёт на выбранное зеркало.

- Работает на фильмах, сериалах, мини-сериалах, аниме, мультфильмах, ТВ-шоу и документальных фильмах (`/film/…` и `/series/…`), на доменах `kinopoisk.ru`, `.com`, `.kz`, `.by`.
- Понимает переходы внутри сайта без перезагрузки и не показывает данные предыдущего фильма.
- Плашку можно свернуть в компактную кнопку. Выбор запоминается.
- В настройках (шестерёнка) можно сменить зеркало и включить открытие в новой вкладке. Настройки синхронизируются между устройствами через `chrome.storage.sync`.
- Живёт в Shadow DOM: стили сайта не ломают плашку, а плашка не трогает сайт.
- Адаптируется к узким экранам и учитывает `prefers-reduced-motion`. Кнопки доступны с клавиатуры и для скринридеров, `Esc` сворачивает плашку.

## Установка

1. Скачайте репозиторий (или архив из `npm run build`, см. ниже).
2. Откройте `chrome://extensions` и включите «Режим разработчика».
3. Нажмите «Загрузить распакованное расширение» и выберите папку **`extension/`**.

> Раньше расширение лежало в корне репозитория. Если оно было загружено оттуда, удалите его и загрузите заново из `extension/`.

## Разработка

Нужен Node.js 18+.

```bash
npm install
npx playwright install chromium   # один раз, браузер для e2e-тестов

npm run lint          # ESLint
npm run format        # Prettier (npm run format:check — только проверка)
npm run test:unit     # unit-тесты чистых функций (node:test)
npm run test:e2e      # e2e: Chromium с загруженным расширением
npm test              # всё вместе
npm run build         # dist/kinopoisk-ease-<версия>.zip
npm run icons         # перерисовать иконки из SVG
```

Для e2e-тестов живой Кинопоиск не нужен. Playwright перехватывает запросы к `*.kinopoisk.*` и отдаёт страницы из `tests/e2e/fixtures/`, которые повторяют разметку сайта: CSS-модули `styles_xxx__hash`, `film-poster`, `data-tid`, таблица «О фильме», og-мета, JSON-LD и SPA-переходы через `history.pushState` с задержкой загрузки контента. Если Кинопоиск поменяет вёрстку, обновите фикстуры по живой странице. Для отладки с видимым окном браузера: `HEADED=1 npm run test:e2e`.

### Структура

```
extension/            ← то, что загружается в браузер
  manifest.json
  src/lib.js          чистые функции: разбор адреса, названия, рейтинга, длительности, домена зеркала
  src/extract.js      чтение данных со страницы с цепочкой запасных селекторов
  src/widget.js       интерфейс плашки (Shadow DOM, без innerHTML)
  src/widget.css      стили плашки
  src/content.js      точка входа: навигация, ожидание данных, настройки
  fonts/, icons/
tests/unit/           unit-тесты lib.js
tests/e2e/            Playwright: сценарии и фикстуры страниц Кинопоиска
scripts/              сборка zip и генерация иконок
```

## Шрифты

Manrope (Copyright 2018 The Manrope Project Authors), Montserrat Alternates (Copyright 2011 The Montserrat Project Authors) и Roboto (Copyright 2011 The Roboto Project Authors) распространяются по лицензии SIL Open Font License 1.1, текст лицензии лежит в [`extension/fonts/OFL.txt`](extension/fonts/OFL.txt).

## Лицензия

[Apache 2.0](LICENSE)
