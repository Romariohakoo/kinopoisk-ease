// На каких адресах плашка появляется, а на каких — нет.
const { test, expect, titleUrl, widget } = require('./harness');

const NOT_A_TITLE = [
    ['главная', 'https://www.kinopoisk.ru/'],
    ['подборка', 'https://www.kinopoisk.ru/lists/movies/top250/'],
    ['персона', 'https://www.kinopoisk.ru/name/37859/'],
    ['Кинопоиск HD (uuid)', 'https://hd.kinopoisk.ru/film/4f2d2c1e3b5a4b2f9e2c1d3a5b6c7d8e/'],
    ['Кинопоиск HD (числовой id)', 'https://hd.kinopoisk.ru/film/258687/'],
];

for (const [name, url] of NOT_A_TITLE) {
    test(`нет плашки: ${name}`, async ({ page }) => {
        await page.goto(url);
        await page.waitForTimeout(1200);
        await expect(widget(page).host).toHaveCount(0);
    });
}

for (const host of ['kinopoisk.ru', 'www.kinopoisk.com', 'www.kinopoisk.kz', 'kinopoisk.by']) {
    test(`домен ${host}`, async ({ page }) => {
        await page.goto(titleUrl('interstellar', { host }));
        const w = widget(page);
        await expect(w.title).toHaveText('Интерстеллар');
        await expect(w.watch).toHaveAttribute('href', 'https://sspoisk.ru/film/258687/');
    });
}

test('вкладка фильма (/reviews/): плашка есть, «Смотреть» ведёт на страницу фильма', async ({ page }) => {
    await page.goto(titleUrl('got', { suffix: 'reviews/' }));
    const w = widget(page);
    await expect(w.title).toHaveText('Игра престолов');
    await expect(w.watch).toHaveAttribute('href', 'https://sspoisk.ru/series/464963/');
});

test('плашка появляется, даже если страница грузится медленно (поздняя гидрация)', async ({ page, context }) => {
    const { setFlags } = require('./harness');
    await setFlags(context, 'late');
    await page.goto(titleUrl('interstellar'));
    const w = widget(page);
    await expect(w.title).toHaveText('Интерстеллар');
    await expect(w.rating).toHaveText('8,6');
    await expect(w.description).toHaveText(/^Фантастический эпос/);
});
