// SPA-переходы: Кинопоиск меняет адрес через history API, а контент подгружает позже.
const { test, expect, titleUrl, widget, setFlags } = require('./harness');

/** Каждые 10 мс записывает в странице пару «адрес → заголовок на плашке». */
async function startSampling(page) {
    await page.evaluate(() => {
        window.__kpeSamples = [];
        window.__kpeSampler = setInterval(() => {
            const hosts = document.querySelectorAll('kinopoisk-ease-widget');
            const root = hosts[0] && hosts[0].shadowRoot;
            const title = root && root.querySelector('.surface.card:not(.is-leaving) [data-role="title"]');
            window.__kpeSamples.push({
                path: location.pathname,
                title: title ? title.textContent : null,
                hosts: hosts.length,
            });
        }, 10);
    });
}

async function stopSampling(page) {
    return page.evaluate(() => {
        clearInterval(window.__kpeSampler);
        return window.__kpeSamples;
    });
}

const spaClick = (page, key) => page.locator(`#__next a[data-key="${key}"]`).first().click();

for (const [from, to, fromTitle, toTitle, toPath] of [
    ['interstellar', 'spirited', 'Интерстеллар', 'Унесённые призраками', '/film/370/'],
    ['interstellar', 'got', 'Интерстеллар', 'Игра престолов', '/series/464963/'],
    ['aot', 'shrek', 'Атака титанов', 'Шрэк', '/film/430/'],
]) {
    test(`переход ${fromTitle} → ${toTitle}: ни на миг не показываем данные старого тайтла`, async ({
        page,
        context,
    }) => {
        await setFlags(context, 'spa=800');
        await page.goto(titleUrl(from));
        const w = widget(page);
        await expect(w.title).toHaveText(fromTitle);

        await startSampling(page);
        await spaClick(page, to);
        await expect(w.title).toHaveText(toTitle);
        await expect(w.rating).toBeVisible();
        const samples = await stopSampling(page);

        const stale = samples.filter((sample) => sample.path === toPath && sample.title === fromTitle);
        expect(stale, 'кадры, где адрес новый, а на плашке старый тайтл').toEqual([]);
        expect(samples.some((sample) => sample.path === toPath && sample.title === null)).toBe(true); // был индикатор загрузки
        expect(Math.max(...samples.map((sample) => sample.hosts))).toBe(1);
        await expect(w.watch).toHaveAttribute('href', `https://sspoisk.ru${toPath}`);
    });
}

test('без canonical/og:url тоже не показываем старые данные', async ({ page, context }) => {
    await setFlags(context, 'noid,spa=800');
    await page.goto(titleUrl('interstellar'));
    const w = widget(page);
    await expect(w.title).toHaveText('Интерстеллар');

    await startSampling(page);
    await spaClick(page, 'spirited');
    await expect(w.title).toHaveText('Унесённые призраками');
    const samples = await stopSampling(page);
    expect(samples.filter((sample) => sample.path === '/film/370/' && sample.title === 'Интерстеллар')).toEqual([]);
});

test('сайт не обновил canonical при переходе: всё равно показываем новый тайтл', async ({ page, context }) => {
    await setFlags(context, 'staleid,spa=800');
    await page.goto(titleUrl('interstellar'));
    const w = widget(page);
    await expect(w.title).toHaveText('Интерстеллар');

    await startSampling(page);
    await spaClick(page, 'got');
    await expect(w.title).toHaveText('Игра престолов', { timeout: 3000 }); // раньше HARD_TIMEOUT (5 с)
    await expect(w.rating).toHaveText('9,0');
    const samples = await stopSampling(page);
    expect(samples.filter((sample) => sample.path === '/series/464963/' && sample.title === 'Интерстеллар')).toEqual(
        [],
    );
});

test('сайт перерисовал body и удалил плашку — она возвращается', async ({ page }) => {
    await page.goto(titleUrl('interstellar'));
    const w = widget(page);
    await expect(w.card).toBeVisible();
    await page.evaluate(() => document.querySelector('kinopoisk-ease-widget').remove());
    await expect(w.host).toHaveCount(0);
    await expect(w.title).toHaveText('Интерстеллар');
    await expect(w.host).toHaveCount(1);
});

test('быстрые переходы подряд: одна плашка с последним тайтлом', async ({ page, context }) => {
    await setFlags(context, 'spa=300');
    await page.goto(titleUrl('interstellar'));
    const w = widget(page);
    await expect(w.title).toHaveText('Интерстеллар');

    await page.evaluate(async () => {
        const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
        window.__spaGo('/series/464963/');
        await wait(60);
        window.__spaGo('/film/370/');
        await wait(60);
        window.__spaGo('/series/749374/');
    });

    await expect(w.title).toHaveText('Атака титанов');
    await page.waitForTimeout(800);
    await expect(w.title).toHaveText('Атака титанов');
    await expect(w.host).toHaveCount(1);
    await expect(w.host.locator('.surface')).toHaveCount(1);
    await expect(w.watch).toHaveAttribute('href', 'https://sspoisk.ru/series/749374/');
});

test('кнопка «Назад» возвращает плашку прошлого фильма', async ({ page }) => {
    await page.goto(titleUrl('interstellar'));
    const w = widget(page);
    await expect(w.title).toHaveText('Интерстеллар');
    await spaClick(page, 'got');
    await expect(w.title).toHaveText('Игра престолов');

    await page.goBack();
    await expect(page).toHaveURL(/\/film\/258687\/$/);
    await expect(w.title).toHaveText('Интерстеллар');
    await expect(w.rating).toHaveText('8,6');
});

test('уход на страницу не-фильма убирает плашку, возврат — показывает', async ({ page }) => {
    await page.goto(titleUrl('interstellar'));
    const w = widget(page);
    await expect(w.card).toBeVisible();

    await page.locator('header a[href="/"]').click();
    await expect(page).toHaveURL('https://www.kinopoisk.ru/');
    await expect(w.host).toHaveCount(0);

    await spaClick(page, 'chernobyl');
    await expect(w.title).toHaveText('Чернобыль');
});

test('SPA-переход с главной на фильм (скрипт загружен не на странице фильма)', async ({ page }) => {
    await page.goto('https://www.kinopoisk.ru/');
    const w = widget(page);
    await page.waitForTimeout(700);
    await expect(w.host).toHaveCount(0);

    await spaClick(page, 'spirited');
    await expect(w.title).toHaveText('Унесённые призраками');
    await expect(w.duration).toHaveText('2 ч 5 мин');
});

test('переход между вкладками одного фильма не перерисовывает плашку', async ({ page }) => {
    await page.goto(titleUrl('interstellar'));
    const w = widget(page);
    await expect(w.card).toBeVisible();
    await w.host.evaluate((host) => host.shadowRoot.querySelector('.surface').setAttribute('data-mark', 'same'));

    await page.locator('#__next a[data-key="reviews"]').click();
    await expect(page).toHaveURL(/\/film\/258687\/reviews\/$/);
    await page.waitForTimeout(1200);
    await expect(w.host.locator('.surface[data-mark="same"]')).toHaveCount(1);
    await expect(w.watch).toHaveAttribute('href', 'https://sspoisk.ru/film/258687/');
});
