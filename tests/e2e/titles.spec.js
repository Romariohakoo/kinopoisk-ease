// Данные на плашке для разных типов тайтлов: фильмы, сериалы, аниме, мультфильмы, шоу, документалки…
const { test, expect, titleUrl, widget, titleByKey } = require('./harness');

const POSTER = (id, size = '300x450') => `https://avatars.mds.yandex.net/get-kinopoisk-image/fixture/${id}/${size}`;

const CASES = [
    { key: 'interstellar', title: 'Интерстеллар', rating: '8,6', duration: '2 ч 49 мин', description: 'topText' },
    { key: 'got', title: 'Игра престолов', rating: '9,0', duration: '1 ч', description: 'synopsis' },
    { key: 'aot', title: 'Атака титанов', rating: '8,4', duration: '24 мин', description: 'synopsis' },
    { key: 'spirited', title: 'Унесённые призраками', rating: '8,5', duration: '2 ч 5 мин', description: 'topText' },
    { key: 'shrek', title: 'Шрэк', rating: '8,1', duration: '1 ч 30 мин', description: 'topText' },
    { key: 'chernobyl', title: 'Чернобыль', rating: '8,8', duration: '1 ч 5 мин', description: 'synopsis' },
    { key: 'chgk', title: 'Что? Где? Когда?', rating: '8,3', duration: '2 ч', description: 'synopsis' },
    { key: 'freesolo', title: 'Свободное восхождение', rating: '7,9', duration: '1 ч 40 мин', description: 'synopsis' },
    {
        key: 'starwars',
        title: 'Звёздные войны: Эпизод 4 — Новая надежда',
        rating: '8,1',
        duration: '2 ч 1 мин',
        description: 'topText',
    },
    { key: 'days500', title: '(500) дней лета', rating: '7,6', duration: '1 ч 35 мин', description: 'synopsis' },
    { key: 'long', title: null, rating: '10', duration: '4 ч 5 мин', description: 'synopsis' },
    {
        key: 'upcoming',
        title: 'Дюна: Часть третья',
        rating: null,
        duration: null,
        description: 'ogDescription',
    },
    {
        key: 'noposter',
        title: 'Фильм без постера',
        rating: '7,0',
        duration: '1 ч 28 мин',
        description: 'synopsis',
        poster: POSTER('3333333', '1200x630'),
    },
    {
        key: 'redesign',
        title: 'Фильм после редизайна',
        rating: '7,3',
        duration: '1 ч 52 мин',
        description: 'synopsis',
    },
];

for (const expected of CASES) {
    const entry = titleByKey(expected.key);

    test(`${entry.kind}: ${entry.title.slice(0, 40)}`, async ({ page }) => {
        await page.goto(titleUrl(expected.key));
        const w = widget(page);

        await expect(w.card).toBeVisible();
        await expect(w.title).toHaveText(expected.title || entry.title);

        if (expected.rating) await expect(w.rating).toHaveText(expected.rating);
        else await expect(w.rating).toHaveCount(0);

        if (expected.duration) await expect(w.duration).toHaveText(expected.duration);
        else await expect(w.duration).toHaveCount(0);

        await expect(w.description).toHaveText(entry[expected.description]);
        await expect(w.poster).toHaveAttribute('src', expected.poster || POSTER(entry.id));
        await expect(w.watch).toHaveAttribute('href', `https://sspoisk.ru/${entry.type}/${entry.id}/`);
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
    await expect(w.card).toBeVisible();

    const box = await w.card.boundingBox();
    expect(box.height).toBeLessThan(320);
    expect(box.width).toBeLessThan(470);
    const clamped = await w.description.evaluate((el) => el.scrollHeight > el.clientHeight);
    expect(clamped).toBe(true);
});
