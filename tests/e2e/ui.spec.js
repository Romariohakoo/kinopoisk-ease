// Поведение интерфейса: кнопка на странице, плавающая плашка, настройки, изоляция, оформление.
const {
    test,
    expect,
    titleUrl,
    widget,
    inlineButton,
    expectFloating,
    setFlags,
    setStorage,
    openOptions,
    stubMirrorChecks,
} = require('./harness');

const scrollDown = (page) => page.evaluate(() => window.scrollTo(0, 1600));
const scrollUp = (page) => page.evaluate(() => window.scrollTo(0, 0));

test.describe('кнопка на странице и плавающая плашка', () => {
    test('по умолчанию: кнопка на странице; плашка появляется, когда кнопка ушла с экрана', async ({ page }) => {
        await page.goto(titleUrl('interstellar'));
        const inline = inlineButton(page);
        const w = widget(page);

        await expect(inline.link).toBeVisible();
        await expect(inline.link).toHaveText('Смотреть на sspoisk.ru');
        await page.waitForTimeout(500);
        await expectFloating(page, false);

        await scrollDown(page);
        await expectFloating(page, true);
        await expect(w.compact).toBeVisible();
        await expect(w.title).toHaveText('Интерстеллар');
        await expect(w.meta).toHaveText(/8,6.*2014.*2 ч 49 мин/);
        await expect(w.watch).toHaveText('Смотреть');

        await scrollUp(page);
        await expectFloating(page, false);
    });

    test('если кнопку вставить некуда — плашка видна сразу', async ({ page }) => {
        await page.goto(titleUrl('redesign'));
        await expectFloating(page, true);
        await expect(widget(page).title).toHaveText('Фильм после редизайна');
        await expect(inlineButton(page).host).toHaveCount(0);
    });

    test('«Никогда»: только кнопка на странице', async ({ page, context }) => {
        await setStorage(context, { sync: { floating: 'never' } });
        await page.goto(titleUrl('interstellar'));
        await expect(inlineButton(page).link).toBeVisible();
        await scrollDown(page);
        await page.waitForTimeout(600);
        await expectFloating(page, false);

        // …но если кнопки на странице нет, плашка остаётся единственным способом.
        await page.goto(titleUrl('redesign'));
        await expectFloating(page, true);
    });

    test('«Всегда»: плашка видна и рядом с кнопкой', async ({ page, context }) => {
        await setStorage(context, { sync: { floating: 'always' } });
        await page.goto(titleUrl('interstellar'));
        await expect(inlineButton(page).link).toBeVisible();
        await expectFloating(page, true);
    });

    test('кнопку на странице можно выключить', async ({ page, context }) => {
        await setStorage(context, { sync: { inlineButton: false } });
        await page.goto(titleUrl('interstellar'));
        await expectFloating(page, true);
        await expect(inlineButton(page).host).toHaveCount(0);
    });

    test('кнопка контрастна фону страницы', async ({ page, context }) => {
        await page.goto(titleUrl('interstellar'));
        await expect(inlineButton(page).host).toHaveAttribute('data-theme', 'dark');

        await setFlags(context, 'dark');
        await page.reload();
        await expect(inlineButton(page).host).toHaveAttribute('data-theme', 'light');
    });
});

test.describe('плавающая плашка', () => {
    test.use({ storage: { sync: { floating: 'always' } } });

    test('компактная ↔ развёрнутая: плавное перетекание, фокус, Esc, запоминание', async ({ page }) => {
        await page.goto(titleUrl('got'));
        const w = widget(page);
        await expect(w.compact).toBeVisible();
        await expect(w.meta).toHaveText(/9,0.*2011–2019.*8 сезонов/);
        await page.waitForTimeout(500);

        const animations = await w.expand.evaluate((button) => {
            const surface = button.closest('.surface');
            button.click();
            return surface.getAnimations().length;
        });
        expect(animations).toBeGreaterThan(0);
        await expect(w.expanded).toBeVisible();
        await expect(w.collapse).toBeFocused();
        await expect(w.duration).toHaveText('1 ч / серия');

        await page.keyboard.press('Escape');
        await expect(w.compact).toBeVisible();
        await expect(w.expand).toBeFocused();

        await w.expand.click();
        await page.reload();
        await expect(w.expanded).toBeVisible();
        await w.collapse.click();
        await page.reload();
        await expect(w.compact).toBeVisible();
    });

    test('«Скрыть на этом тайтле»: плашка прячется только здесь, из настроек возвращается', async ({
        page,
        context,
    }) => {
        await setStorage(context, { local: { expanded: true } });
        await page.goto(titleUrl('interstellar'));
        const w = widget(page);
        await w.hide.click();
        await expectFloating(page, false);
        await expect(inlineButton(page).link).toBeVisible();

        await page.reload();
        await expect(inlineButton(page).link).toBeVisible();
        await page.waitForTimeout(500);
        await expectFloating(page, false);

        await page.locator('#__next a[data-key="got"]').click();
        await expectFloating(page, true);
        await expect(w.title).toHaveText('Игра престолов');

        await page.goBack();
        await expect(page).toHaveURL(/258687/);
        await expectFloating(page, false);

        const options = await openOptions(context);
        await expect(options.locator('#hidden-count')).toHaveText('Скрыто на 1 тайтле');
        await options.locator('#unhide').click();
        await expectFloating(page, true);
    });

    test('шестерёнка открывает настройки', async ({ page, context }) => {
        await setStorage(context, { local: { expanded: true } });
        await page.goto(titleUrl('interstellar'));
        const optionsPromise = context.waitForEvent('page');
        await widget(page).settings.click();
        const options = await optionsPromise;
        await expect(options).toHaveURL(/\/options\/options\.html$/);
        await expect(options.locator('h1')).toHaveText('Kinopoisk Ease');
    });

    test('подсказка при первом запуске показывается один раз', async ({ page, context }) => {
        await setStorage(context, { local: { onboarded: false } });
        await page.goto(titleUrl('interstellar'));
        const w = widget(page);
        await expect(w.onboarding).toBeVisible();
        await expect(w.onboarding).toContainText('Shift+W');
        await w.host.locator('[data-role="onboarding-ok"]').click();
        await expect(w.onboarding).toHaveCount(0);

        await page.reload();
        await expect(w.compact).toBeVisible();
        await page.waitForTimeout(300);
        await expect(w.onboarding).toHaveCount(0);
    });

    test('тема: как у сайта или выбранная', async ({ page, context }) => {
        await page.goto(titleUrl('interstellar'));
        const w = widget(page);
        await expect(w.host).toHaveAttribute('data-theme', 'light');

        await setFlags(context, 'dark');
        await page.reload();
        await expect(w.host).toHaveAttribute('data-theme', 'dark');

        await setStorage(context, { sync: { floating: 'always', theme: 'light' } });
        await expect(w.host).toHaveAttribute('data-theme', 'light');
    });

    test('позиция на экране', async ({ page, context }) => {
        await page.goto(titleUrl('interstellar'));
        const w = widget(page);
        await expect(w.compact).toBeVisible();
        await page.waitForTimeout(400);
        let box = await w.surface.boundingBox();
        expect(box.x + box.width).toBeGreaterThan(1200);
        expect(box.y + box.height).toBeGreaterThan(760);

        await setStorage(context, { sync: { floating: 'always', position: 'bottom-left' } });
        await expect(w.host).toHaveAttribute('data-position', 'bottom-left');
        await page.waitForTimeout(300);
        box = await w.surface.boundingBox();
        expect(box.x).toBeLessThan(40);

        await setStorage(context, { sync: { floating: 'always', position: 'top-right' } });
        await expect(w.host).toHaveAttribute('data-position', 'top-right');
        await page.waitForTimeout(300);
        box = await w.surface.boundingBox();
        expect(box.y).toBeGreaterThanOrEqual(88); // под шапкой сайта
        await expect(w.expand).toHaveAttribute('aria-label', 'Подробнее');
    });

    test('акцентный цвет берётся из постера', async ({ page }) => {
        await page.goto(titleUrl('interstellar'));
        const w = widget(page);
        await expect(w.compact).toBeVisible();
        await expect
            .poll(() => w.surface.evaluate((el) => el.style.getPropertyValue('--accent')))
            .toMatch(/^rgb\(\d+, \d+, \d+\)$/);
    });
});

test.describe('«Смотреть»', () => {
    test('кнопка на странице открывает зеркало в этой же вкладке', async ({ page }) => {
        await page.goto(titleUrl('chernobyl'));
        await inlineButton(page).link.click();
        await expect(page).toHaveURL('https://sspoisk.ru/series/1227803/');
        await expect(page.locator('#external')).toHaveText('https://sspoisk.ru/series/1227803/');
    });

    test('это настоящая ссылка: Ctrl+клик открывает новую вкладку', async ({ page, context }) => {
        await page.goto(titleUrl('interstellar'));
        const popupPromise = context.waitForEvent('page');
        await inlineButton(page).link.click({ modifiers: ['ControlOrMeta'] });
        const popup = await popupPromise;
        // Вкладку от Ctrl+клика Chromium открывает мимо перехвата сети Playwright, и в офлайн-тесте она
        // падает на chrome-error; reload повторяет тот же адрес уже через перехват.
        await popup.waitForLoadState();
        await popup.reload();
        await expect(popup.locator('#external')).toHaveText('https://sspoisk.ru/film/258687/');
        await expect(page).toHaveURL(titleUrl('interstellar'));
    });

    test('«Открывать в новой вкладке»', async ({ page, context }) => {
        await setStorage(context, { sync: { openInNewTab: true, floating: 'always' } });
        await page.goto(titleUrl('aot'));
        await expect(inlineButton(page).link).toHaveAttribute('target', '_blank');
        await expect(widget(page).watch).toHaveAttribute('target', '_blank');

        const popupPromise = context.waitForEvent('page');
        await inlineButton(page).link.click();
        const popup = await popupPromise;
        await expect(popup).toHaveURL('https://sspoisk.ru/series/749374/');
        await expect(page).toHaveURL(titleUrl('aot'));
    });

    test('Shift+W — смотреть; при наборе текста не срабатывает', async ({ page }) => {
        await page.goto(titleUrl('interstellar'));
        await expect(inlineButton(page).link).toBeVisible();

        await page.locator('#site-search').click();
        await page.keyboard.type('Wall-E');
        await page.keyboard.press('Shift+KeyW');
        await expect(page.locator('#site-search')).toHaveValue('Wall-EW');
        await expect(page).toHaveURL(titleUrl('interstellar'));

        await page.locator('h1').click();
        await page.keyboard.press('Shift+KeyW');
        await expect(page).toHaveURL('https://sspoisk.ru/film/258687/');
    });

    test('Shift+W можно выключить', async ({ page, context }) => {
        await setStorage(context, { sync: { hotkey: false } });
        await page.goto(titleUrl('interstellar'));
        await expect(inlineButton(page).link).toBeVisible();
        await page.locator('h1').click();
        await page.keyboard.press('Shift+KeyW');
        await page.waitForTimeout(500);
        await expect(page).toHaveURL(titleUrl('interstellar'));
    });

    test('основное зеркало недоступно — кнопки ведут на следующее', async ({ page, context }) => {
        await stubMirrorChecks(context);
        await setStorage(context, { sync: { mirrors: ['dead-mirror.example', 'sspoisk.ru'], floating: 'always' } });
        await page.goto(titleUrl('interstellar'));
        await expect(inlineButton(page).link).toHaveAttribute('href', 'https://sspoisk.ru/film/258687/');
        await expect(widget(page).watch).toHaveAttribute('href', 'https://sspoisk.ru/film/258687/');
    });

    test('без автопереключения — всегда основное зеркало', async ({ page, context }) => {
        await setStorage(context, { sync: { mirrors: ['dead-mirror.example', 'sspoisk.ru'], autoFallback: false } });
        await page.goto(titleUrl('interstellar'));
        await expect(inlineButton(page).link).toHaveAttribute('href', 'https://dead-mirror.example/film/258687/');
        await page.waitForTimeout(500);
        await expect(inlineButton(page).link).toHaveAttribute('href', 'https://dead-mirror.example/film/258687/');
    });
});

test.describe('настройки', () => {
    test('зеркала: добавить, проверить, поменять порядок, удалить — вкладка сайта обновляется сразу', async ({
        page,
        context,
    }) => {
        await stubMirrorChecks(context);
        await page.goto(titleUrl('interstellar'));
        const inline = inlineButton(page);
        await expect(inline.link).toHaveAttribute('href', 'https://sspoisk.ru/film/258687/');

        const options = await openOptions(context);
        const input = options.locator('#add-input');
        const mirrors = options.locator('.mirror-host');
        await expect(mirrors).toHaveText(['sspoisk.ru']);

        await input.fill('это не адрес');
        await options.locator('#add-form button[type="submit"]').click();
        await expect(input).toHaveAttribute('aria-invalid', 'true');
        await expect(options.locator('#add-hint')).toHaveText(/Не похоже на адрес сайта/);

        await input.fill('https://Mirror.Example/film/1/');
        await input.press('Enter');
        await expect(mirrors).toHaveText(['sspoisk.ru', 'mirror.example']);
        await expect(options.locator('.mirror[data-host="mirror.example"] .status')).toHaveAttribute(
            'data-status',
            'ok',
        );

        await input.fill('dead.example');
        await input.press('Enter');
        await expect(options.locator('.mirror[data-host="dead.example"] .status')).toHaveAttribute(
            'data-status',
            'bad',
        );

        await options.getByRole('button', { name: 'Поднять mirror.example' }).click();
        await expect(mirrors).toHaveText(['mirror.example', 'sspoisk.ru', 'dead.example']);
        await expect(inline.link).toHaveAttribute('href', 'https://mirror.example/film/258687/');
        await expect(inline.link).toHaveText('Смотреть на mirror.example');

        await options.getByRole('button', { name: 'Удалить mirror.example' }).click();
        await expect(mirrors).toHaveText(['sspoisk.ru', 'dead.example']);
        await expect(inline.link).toHaveAttribute('href', 'https://sspoisk.ru/film/258687/');
    });

    test('переключатели применяются в открытой вкладке без перезагрузки', async ({ page, context }) => {
        await page.goto(titleUrl('interstellar'));
        const w = widget(page);
        await expect(inlineButton(page).link).toBeVisible();

        const options = await openOptions(context);
        await options.locator('#floating').selectOption('always');
        await expectFloating(page, true);

        await options.locator('#position').selectOption('bottom-left');
        await expect(w.host).toHaveAttribute('data-position', 'bottom-left');

        await options.locator('#theme').selectOption('dark');
        await expect(w.host).toHaveAttribute('data-theme', 'dark');

        await options.locator('#enabled').uncheck({ force: true });
        await expect(w.host).toHaveCount(0);
        await expect(inlineButton(page).host).toHaveCount(0);

        await options.locator('#enabled').check({ force: true });
        await expect(inlineButton(page).link).toBeVisible();
        await expectFloating(page, true);
        expect(await options.locator('#saved').textContent()).toBe('Сохранено');
    });

    test('версия 1.1 с одним полем mirror переезжает в список зеркал', async ({ page, context }) => {
        await setStorage(context, { sync: { mirror: 'old-mirror.example' } });
        await page.goto(titleUrl('interstellar'));
        await expect(inlineButton(page).link).toHaveAttribute('href', 'https://old-mirror.example/film/258687/');
        const options = await openOptions(context);
        await expect(options.locator('.mirror-host')).toHaveText(['old-mirror.example']);
    });

    test('в попапе по иконке — компактная ширина', async ({ context }) => {
        const popup = await openOptions(context, { popup: true });
        await expect(popup.locator('body')).toHaveClass(/popup/);
        expect(await popup.evaluate(() => document.body.getBoundingClientRect().width)).toBe(380);
    });
});

test.describe('изоляция и оформление', () => {
    test.use({ storage: { sync: { floating: 'always' }, local: { expanded: true } } });

    test('стили сайта не ломают плашку и кнопку, их стили не трогают сайт', async ({ page }) => {
        await page.goto(titleUrl('interstellar'));
        const w = widget(page);
        await expect(w.title).toBeVisible(); // на сайте есть .title { display: none }

        const watch = await w.watch.evaluate((el) => {
            const style = getComputedStyle(el);
            return { outline: style.outlineStyle, font: style.fontFamily, radius: style.borderRadius };
        });
        expect(watch.outline).toBe('none');
        expect(watch.font).toContain('KPE Manrope');
        expect(watch.radius).toBe('999px');

        const inlineFont = await inlineButton(page).link.evaluate((el) => getComputedStyle(el).fontFamily);
        expect(inlineFont).toContain('KPE Manrope');

        const site = await page.locator('#site-button').evaluate((el) => {
            const style = getComputedStyle(el);
            return {
                background: style.backgroundColor,
                padding: style.padding,
                width: el.getBoundingClientRect().width,
            };
        });
        expect(site.background).toBe('rgb(255, 102, 0)');
        expect(site.padding).toBe('20px');
        expect(site.width).toBeLessThan(400);
    });

    test('шрифты расширения загружаются', async ({ page }) => {
        await page.goto(titleUrl('interstellar'));
        await expect(widget(page).title).toBeVisible();
        await page.evaluate(() => document.fonts.ready);
        const fonts = await page.evaluate(() =>
            [...document.fonts]
                .filter((face) => face.family.startsWith('KPE'))
                .map((face) => `${face.family} ${face.weight} ${face.status}`),
        );
        expect(fonts.sort()).toEqual([
            'KPE Manrope 400 loaded',
            'KPE Manrope 600 loaded',
            'KPE Manrope 700 loaded',
            'KPE Manrope 800 loaded',
        ]);
        const weight = await widget(page).title.evaluate((el) => getComputedStyle(el).fontWeight);
        expect(weight).toBe('800');
    });

    test('работает на странице со строгой Content-Security-Policy', async ({ page, context }) => {
        await setFlags(context, 'csp');
        await page.goto(titleUrl('interstellar'));
        const w = widget(page);
        await expect(w.title).toHaveText('Интерстеллар');
        expect(await w.title.evaluate((el) => getComputedStyle(el).fontSize)).toBe('20px');
        await expect(inlineButton(page).link).toBeVisible();
        await page.evaluate(() => document.fonts.ready);
        const loaded = await page.evaluate(
            () =>
                [...document.fonts].filter((face) => face.family.startsWith('KPE') && face.status === 'loaded').length,
        );
        expect(loaded).toBe(4);
    });

    test('у кнопок есть доступные имена', async ({ page }) => {
        await page.goto(titleUrl('interstellar'));
        await expect(page.getByRole('link', { name: 'Смотреть на sspoisk.ru' })).toHaveCount(2);
        await expect(page.getByRole('button', { name: 'Настройки' })).toBeVisible();
        await expect(page.getByRole('button', { name: 'Свернуть' })).toHaveAttribute('aria-expanded', 'true');
        await expect(page.getByRole('button', { name: 'Скрыть на этом тайтле' })).toBeVisible();
        await expect(page.getByRole('img', { name: 'Постер: Интерстеллар' })).toBeVisible();
        await page.getByRole('button', { name: 'Свернуть' }).click();
        await expect(page.getByRole('button', { name: 'Подробнее' })).toHaveAttribute('aria-expanded', 'false');
    });

    test('скрытая плашка недоступна с клавиатуры', async ({ page, context }) => {
        await setStorage(context, { sync: { floating: 'auto' } });
        await page.goto(titleUrl('interstellar'));
        await expect(inlineButton(page).link).toBeVisible();
        await expectFloating(page, false);
        expect(await widget(page).stage.evaluate((el) => el.inert)).toBe(true);
    });
});

test.describe('телефон', () => {
    test.use({ viewport: { width: 375, height: 740 }, storage: { sync: { floating: 'always' } } });

    test('плашка — нижняя панель на всю ширину', async ({ page }) => {
        await page.goto(titleUrl('long'));
        const w = widget(page);
        await expect(w.compact).toBeVisible();
        await page.waitForTimeout(500);
        let box = await w.surface.boundingBox();
        expect(Math.round(box.x)).toBe(8);
        expect(Math.round(box.width)).toBe(359);
        expect(Math.round(box.y + box.height)).toBe(732);

        await w.expand.click();
        await page.waitForTimeout(500);
        box = await w.surface.boundingBox();
        expect(box.x).toBeGreaterThanOrEqual(0);
        expect(box.x + box.width).toBeLessThanOrEqual(375);
        expect(box.y).toBeGreaterThanOrEqual(0);
    });
});

test.describe('prefers-reduced-motion', () => {
    test.use({ reducedMotion: 'reduce', storage: { sync: { floating: 'always' } } });

    test('без анимаций при разворачивании', async ({ page }) => {
        await page.goto(titleUrl('interstellar'));
        const w = widget(page);
        await expect(w.compact).toBeVisible();
        const animations = await w.expand.evaluate((button) => {
            const surface = button.closest('.surface');
            button.click();
            return surface.getAnimations({ subtree: true }).filter((a) => a.playState === 'running').length;
        });
        expect(animations).toBe(0);
        await expect(w.expanded).toBeVisible();
    });
});
