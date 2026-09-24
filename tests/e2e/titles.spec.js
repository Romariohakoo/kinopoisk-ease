// Данные для разных типов тайтлов: фильмы, сериалы, аниме, мультфильмы, шоу, документалки…
const { test, expect, titleUrl, widget, inlineButton, titleByKey } = require('./harness');

// Плашка всегда видна и развёрнута — так проверяем все поля сразу.
test.use({ storage: { sync: { floating: 'always' }, local: { expanded: true } } });

const POSTER = (id, size = '300x450') => `https://avatars.mds.yandex.net/get-kinopoisk-image/fixture/${id}/${size}`;

const CASES = [
    {
        key: 'interstellar',
        kind: 'Фильм',
        year: '2014',
        rating: '8,6',
        tone: 'good',
        duration: '2 ч 49 мин',
        description: 'topText',
    },
    {
        key: 'got',
        kind: 'Сериал',
        year: '2011–2019',
        rating: '9,0',
        tone: 'good',
        seasons: '8 сезонов',
        duration: '1 ч / серия',
        description: 'synopsis',
    },
    {
        key: 'aot',
        kind: 'Аниме-сериал',
        year: '2013–2023',
        rating: '8,4',
        tone: 'good',
        seasons: '4 сезона',
        duration: '24 мин / серия',
        description: 'synopsis',
    },
    {
        key: 'spirited',
        kind: 'Аниме',
        year: '2001',
        rating: '8,5',
        tone: 'good',
        duration: '2 ч 5 мин',
        description: 'topText',
    },
    {
        key: 'shrek',
        kind: 'Мультфильм',
        year: '2001',
        rating: '8,1',
        tone: 'good',
        duration: '1 ч 30 мин',
        description: 'topText',
    },
    {
        key: 'chernobyl',
        kind: 'Мини-сериал',
        year: '2019',
        rating: '8,8',
        tone: 'good',
        seasons: '1 сезон',
        duration: '1 ч 5 мин / серия',
        description: 'synopsis',
    },
    {
        key: 'chgk',
        kind: 'ТВ-шоу',
        year: '1975–…',
        rating: '8,3',
        tone: 'good',
        duration: '2 ч / серия',
        description: 'synopsis',
    },
    {
        key: 'freesolo',
        kind: 'Документальный',
        year: '2018',
        rating: '7,9',
        tone: 'good',
        duration: '1 ч 40 мин',
        description: 'synopsis',
    },
    {
        key: 'starwars',
        title: 'Звёздные войны: Эпизод 4 — Новая надежда',
        kind: 'Фильм',
        year: '1977',
        rating: '8,1',
        tone: 'good',
        duration: '2 ч 1 мин',
        description: 'topText',
    },
    {
        key: 'days500',
        kind: 'Фильм',
        year: '2009',
        rating: '7,6',
        tone: 'good',
        duration: '1 ч 35 мин',
        description: 'synopsis',
    },
    {
        key: 'xss',
        kind: 'Фильм',
        year: '2020',
        rating: '6,5',
        tone: 'mid',
        duration: '1 ч 40 мин',
        description: 'topText',
    },
    {
        key: 'long',
        kind: 'Фильм',
        year: '2021',
        rating: '10',
        tone: 'good',
        duration: '4 ч 5 мин',
        description: 'synopsis',
    },
    { key: 'upcoming', kind: 'Фильм', year: '2026', rating: null, duration: null, description: 'ogDescription' },
    {
        key: 'noposter',
        kind: 'Фильм',
        year: '2022',
        rating: '7,0',
        tone: 'good',
        duration: '1 ч 28 мин',
        description: 'synopsis',
        poster: POSTER('3333333', '1200x630'),
    },
    {
        key: 'redesign',
        kind: 'Фильм',
        year: '2024',
        rating: '7,3',
        tone: 'good',
        duration: '1 ч 52 мин',
        description: 'synopsis',
        noInline: true,
    },
];

for (const expected of CASES) {
    const entry = titleByKey(expected.key);

    test(`${entry.kind}: ${entry.title.slice(0, 40)}`, async ({ page }) => {
        await page.goto(titleUrl(expected.key));
        const w = widget(page);
        const watch = `https://sspoisk.ru/${entry.type}/${entry.id}/`;

        await expect(w.expanded).toBeVisible();
        await expect(w.title).toHaveText(expected.title || entry.title);
        await expect(w.kind).toHaveText(expected.kind);
        await expect(w.year).toHaveText(expected.year);

        if (expected.rating) {
            await expect(w.rating).toHaveText(expected.rating);
            await expect(w.rating).toHaveClass(new RegExp(`tone-${expected.tone}`));
        } else {
            await expect(w.rating).toHaveCount(0);
        }

        if (expected.seasons) await expect(w.seasons).toHaveText(expected.seasons);
        else await expect(w.seasons).toHaveCount(0);

        if (expected.duration) await expect(w.duration).toHaveText(expected.duration);
        else await expect(w.duration).toHaveCount(0);

        await expect(w.description).toHaveText(entry[expected.description]);
        await expect(w.poster).toHaveAttribute('src', expected.poster || POSTER(entry.id));
        await expect(w.watch).toHaveAttribute('href', watch);
        await expect(w.watch).toHaveText('Смотреть на sspoisk.ru');

        const inline = inlineButton(page);
        if (expected.noInline) {
            await page.waitForTimeout(300);
            await expect(inline.host).toHaveCount(0);
        } else {
            await expect(inline.link).toHaveAttribute('href', watch);
        }
        await expect(w.host).toHaveCount(1);
    });
}

test('название и описание с HTML выводятся как текст, скрипты не выполняются', async ({ page }) => {
    const entry = titleByKey('xss');
    await page.goto(titleUrl('xss'));
    const w = widget(page);

    await expect(w.title).toHaveText(entry.title);
    await expect(w.description).toHaveText(entry.topText);
    await expect(w.poster).toHaveAttribute('alt', `Постер: ${entry.title}`);
    await expect(w.host.locator('img[src="x"], img[src="y"], b')).toHaveCount(0);
    await page.waitForTimeout(300);
    expect(await page.evaluate(() => window.__kpeXss)).toBeUndefined();
});

test('длинные название и описание обрезаются, плашка не растягивается', async ({ page }) => {
    await page.goto(titleUrl('long'));
    const w = widget(page);
    await expect(w.expanded).toBeVisible();
    await page.waitForTimeout(400);

    const box = await w.surface.boundingBox();
    expect(box.height).toBeLessThan(320);
    expect(box.width).toBeLessThanOrEqual(402);
    for (const part of [w.title, w.description]) {
        expect(await part.evaluate((el) => el.scrollHeight > el.clientHeight)).toBe(true);
    }
});

test('кнопка на странице встаёт рядом с «Буду смотреть»', async ({ page }) => {
    await page.goto(titleUrl('interstellar'));
    const inline = inlineButton(page);
    await expect(inline.link).toBeVisible();
    const siblingText = await inline.host.evaluate((host) => host.previousElementSibling.textContent.trim());
    expect(siblingText).toBe('Буду смотреть');
    await expect(inline.host).toHaveAttribute('data-placement', 'row');
});

test('без блока кнопок — кнопка встаёт после заголовка', async ({ page }) => {
    await page.goto(titleUrl('noposter'));
    const inline = inlineButton(page);
    await expect(inline.link).toBeVisible();
    await expect(inline.host).toHaveAttribute('data-placement', 'block');
});
