// Поведение плашки: сворачивание, настройки, переходы, изоляция стилей, шрифты, адаптив.
const { test, expect, titleUrl, widget, setFlags } = require('./harness');

test.describe('сворачивание', () => {
    test('крестик сворачивает плашку с анимацией, плашка-кнопка разворачивает обратно', async ({ page }) => {
        await page.goto(titleUrl('interstellar'));
        const w = widget(page);
        await expect(w.card).toBeVisible();
        await page.waitForTimeout(500); // анимация появления закончилась

        // Кликаем и сразу (до конца анимации) смотрим, что запустилось у уходящей карточки.
        const animation = await w.collapse.evaluate(async (button) => {
            button.click();
            await new Promise((resolve) => setTimeout(resolve, 0));
            const leaving = button.getRootNode().querySelector('.surface.is-leaving');
            const [running] = leaving ? leaving.getAnimations() : [];
            return running ? running.animationName : null;
        });
        expect(animation).toBe('slide-out');

        await expect(w.pill).toBeVisible();
        await expect(w.card).toHaveCount(0);
        await expect(w.watch).toHaveAttribute('href', 'https://sspoisk.ru/film/258687/');

        await w.expand.click();
        await expect(w.card).toBeVisible();
        await expect(w.title).toHaveText('Интерстеллар');
    });

    test('свёрнутое состояние запоминается: после перезагрузки и на других фильмах', async ({ page }) => {
        await page.goto(titleUrl('interstellar'));
        const w = widget(page);
        await w.collapse.click();
        await expect(w.pill).toBeVisible();

        await page.reload();
        await expect(w.pill).toBeVisible();
        await page.waitForTimeout(1000);
        await expect(w.card).toHaveCount(0);

        await page.locator('#__next a[data-key="got"]').click();
        await expect(w.watch).toHaveAttribute('href', 'https://sspoisk.ru/series/464963/');
        await expect(w.pill).toBeVisible();

        await w.expand.click();
        await expect(w.title).toHaveText('Игра престолов');

        await page.reload();
        await expect(w.card).toBeVisible();
    });

    test('Escape сворачивает плашку', async ({ page }) => {
        await page.goto(titleUrl('interstellar'));
        const w = widget(page);
        await w.settings.focus();
        await page.keyboard.press('Escape');
        await expect(w.pill).toBeVisible();
    });
});

test.describe('кнопка «Смотреть»', () => {
    test('открывает зеркало в этой же вкладке', async ({ page }) => {
        await page.goto(titleUrl('chernobyl'));
        await widget(page).watch.click();
        await expect(page).toHaveURL('https://sspoisk.ru/series/1227803/');
        await expect(page.locator('#external')).toHaveText('https://sspoisk.ru/series/1227803/');
    });

    test('это настоящая ссылка: колёсиком/Ctrl+клик открывается в новой вкладке', async ({ page, context }) => {
        await page.goto(titleUrl('interstellar'));
        const popupPromise = context.waitForEvent('page');
        await widget(page).watch.click({ modifiers: ['ControlOrMeta'] });
        const popup = await popupPromise;
        // Вкладку от Ctrl+клика Chromium открывает мимо перехвата сети Playwright, и в офлайн-тесте она
        // падает на chrome-error; reload повторяет тот же адрес уже через перехват.
        await popup.waitForLoadState();
        await popup.reload();
        await expect(popup.locator('#external')).toHaveText('https://sspoisk.ru/film/258687/');
        await expect(page).toHaveURL(titleUrl('interstellar'));
    });
});

test.describe('настройки', () => {
    test('смена зеркала: проверка ввода, нормализация, сохранение', async ({ page }) => {
        await page.goto(titleUrl('interstellar'));
        const w = widget(page);
        await w.settings.click();

        const input = w.host.locator('input[name="mirror"]');
        await expect(input).toBeFocused();
        await expect(input).toHaveValue('sspoisk.ru');

        await input.fill('это не адрес');
        await w.host.locator('[data-role="save"]').click();
        await expect(input).toHaveAttribute('aria-invalid', 'true');
        await expect(w.host.locator('.hint')).toHaveText(/Не похоже на адрес сайта/);

        await input.fill('  https://www.Example-Mirror.org/film/1/?x=1 ');
        await w.host.locator('[data-role="save"]').click();
        await expect(input).toHaveCount(0);
        await expect(w.watch).toHaveAttribute('href', 'https://www.example-mirror.org/film/258687/');
        await expect(w.settings).toBeFocused();

        await page.reload();
        await expect(w.watch).toHaveAttribute('href', 'https://www.example-mirror.org/film/258687/');

        // Пустое поле — вернуть адрес по умолчанию.
        await w.settings.click();
        await input.fill('');
        await w.host.locator('[data-role="save"]').click();
        await expect(w.watch).toHaveAttribute('href', 'https://sspoisk.ru/film/258687/');
    });

    test('«Отмена» и Escape закрывают настройки без сохранения', async ({ page }) => {
        await page.goto(titleUrl('interstellar'));
        const w = widget(page);
        const input = w.host.locator('input[name="mirror"]');

        await w.settings.click();
        await input.fill('other.example');
        await w.host.locator('[data-role="cancel"]').click();
        await expect(w.watch).toHaveAttribute('href', 'https://sspoisk.ru/film/258687/');

        await w.settings.click();
        await input.fill('other.example');
        await input.press('Escape');
        await expect(input).toHaveCount(0);
        await expect(w.card).toBeVisible();
        await expect(w.watch).toHaveAttribute('href', 'https://sspoisk.ru/film/258687/');
    });

    test('«Открывать в новой вкладке»', async ({ page, context }) => {
        await page.goto(titleUrl('aot'));
        const w = widget(page);
        await w.settings.click();
        await w.host.locator('input[name="openInNewTab"]').check();
        await w.host.locator('[data-role="save"]').click();
        await expect(w.watch).toHaveAttribute('target', '_blank');

        const popupPromise = context.waitForEvent('page');
        await w.watch.click();
        const popup = await popupPromise;
        await expect(popup).toHaveURL('https://sspoisk.ru/series/749374/');
        await expect(page).toHaveURL(titleUrl('aot'));
    });

    test('изменения сразу применяются в других открытых вкладках', async ({ page, context }) => {
        await page.goto(titleUrl('interstellar'));
        const other = await context.newPage();
        await other.goto(titleUrl('got'));
        await expect(widget(other).watch).toHaveAttribute('href', 'https://sspoisk.ru/series/464963/');

        const w = widget(page);
        await w.settings.click();
        await w.host.locator('input[name="mirror"]').fill('mirror.example');
        await w.host.locator('[data-role="save"]').click();

        await expect(widget(other).watch).toHaveAttribute('href', 'https://mirror.example/series/464963/');
    });

    test('ввод в поле не долетает до горячих клавиш сайта', async ({ page }) => {
        await page.goto(titleUrl('interstellar'));
        await page.evaluate(() => {
            window.__siteKeys = 0;
            document.addEventListener('keydown', () => window.__siteKeys++);
        });
        const w = widget(page);
        await w.settings.click();
        await w.host.locator('input[name="mirror"]').pressSequentially('abc');
        expect(await page.evaluate(() => window.__siteKeys)).toBe(0);
    });
});

test.describe('изоляция и оформление', () => {
    test('стили сайта не ломают плашку, стили плашки не трогают сайт', async ({ page }) => {
        await page.goto(titleUrl('interstellar'));
        const w = widget(page);
        await expect(w.title).toBeVisible(); // на сайте есть .title { display: none }

        const watch = await w.watch.evaluate((el) => {
            const style = getComputedStyle(el);
            return { background: style.backgroundColor, outline: style.outlineStyle, font: style.fontFamily };
        });
        expect(watch.background).toBe('rgba(255, 255, 255, 0.2)');
        expect(watch.outline).toBe('none');
        expect(watch.font).toContain('KPE Manrope');

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
        expect(site.width).toBeLessThan(400); // старый .button.first { width: 100% } растягивал кнопку сайта
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
            'KPE Manrope 700 loaded',
            'KPE Montserrat Alternates 700 loaded',
            'KPE Roboto 400 loaded',
        ]);
        const titleFont = await widget(page).title.evaluate((el) => getComputedStyle(el).fontFamily);
        expect(titleFont).toMatch(/^"KPE Montserrat Alternates"/);
    });

    test('работает на странице со строгой Content-Security-Policy', async ({ page, context }) => {
        await setFlags(context, 'csp');
        await page.goto(titleUrl('interstellar'));
        const w = widget(page);
        await expect(w.title).toHaveText('Интерстеллар');
        expect(await w.title.evaluate((el) => getComputedStyle(el).fontSize)).toBe('22px');
        await page.evaluate(() => document.fonts.ready);
        const loaded = await page.evaluate(
            () =>
                [...document.fonts].filter((face) => face.family.startsWith('KPE') && face.status === 'loaded').length,
        );
        expect(loaded).toBe(4);
    });

    test('у кнопок есть доступные имена', async ({ page }) => {
        await page.goto(titleUrl('interstellar'));
        await expect(page.getByRole('link', { name: 'Смотреть' })).toBeVisible();
        await expect(page.getByRole('button', { name: 'Настройки' })).toBeVisible();
        await expect(page.getByRole('button', { name: 'Свернуть' })).toBeVisible();
        await expect(page.getByRole('img', { name: 'Постер: Интерстеллар' })).toBeVisible();
    });
});

test.describe('узкий экран', () => {
    test.use({ viewport: { width: 375, height: 740 } });

    test('плашка помещается в ширину телефона', async ({ page }) => {
        await page.goto(titleUrl('long'));
        const w = widget(page);
        await expect(w.card).toBeVisible();
        await page.waitForTimeout(500);
        const box = await w.card.boundingBox();
        expect(box.x).toBeGreaterThanOrEqual(0);
        expect(box.x + box.width).toBeLessThanOrEqual(375);
        const poster = await w.poster.boundingBox();
        expect(poster.width).toBe(72);
        expect(box.y + box.height).toBeLessThanOrEqual(740);
    });
});

test.describe('prefers-reduced-motion', () => {
    test.use({ reducedMotion: 'reduce' });

    test('без анимаций появления и сворачивания', async ({ page }) => {
        await page.goto(titleUrl('interstellar'));
        const w = widget(page);
        await expect(w.card).toBeVisible();
        expect(await w.card.evaluate((el) => el.getAnimations().length)).toBe(0);
        await w.collapse.click();
        await expect(w.pill).toBeVisible();
        expect(await w.pill.evaluate((el) => el.getAnimations().length)).toBe(0);
    });
});
