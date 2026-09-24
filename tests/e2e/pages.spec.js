// На каких адресах расширение что-то показывает, а на каких — нет.
const { test, expect, titleUrl, widget, inlineButton, setFlags } = require('./harness');

const NOT_A_TITLE = [
    ['главная', 'https://www.kinopoisk.ru/'],
    ['подборка', 'https://www.kinopoisk.ru/lists/movies/top250/'],
    ['персона', 'https://www.kinopoisk.ru/name/37859/'],
    ['Кинопоиск HD (uuid)', 'https://hd.kinopoisk.ru/film/4f2d2c1e3b5a4b2f9e2c1d3a5b6c7d8e/'],
    ['Кинопоиск HD (числовой id)', 'https://hd.kinopoisk.ru/film/258687/'],
];

for (const [name, url] of NOT_A_TITLE) {
    test(`ничего не показываем: ${name}`, async ({ page }) => {
        await page.goto(url);
        await page.waitForTimeout(1200);
        await expect(widget(page).host).toHaveCount(0);
        await expect(inlineButton(page).host).toHaveCount(0);
    });
}

for (const host of ['kinopoisk.ru', 'www.kinopoisk.com', 'www.kinopoisk.kz', 'kinopoisk.by']) {
    test(`домен ${host}`, async ({ page }) => {
        await page.goto(titleUrl('interstellar', { host }));
        await expect(inlineButton(page).link).toHaveAttribute('href', 'https://sspoisk.ru/film/258687/');
    });
}

test('вкладка тайтла (/reviews/): кнопка ведёт на страницу сериала', async ({ page }) => {
    await page.goto(titleUrl('got', { suffix: 'reviews/' }));
    await expect(inlineButton(page).link).toHaveAttribute('href', 'https://sspoisk.ru/series/464963/');
});

test.describe('поздняя гидрация', () => {
    test.use({ storage: { sync: { floating: 'always' }, local: { expanded: true } } });

    test('пока страница грузится — скелетон с уже рабочей кнопкой, потом данные', async ({ page, context }) => {
        await setFlags(context, 'late');
        await page.goto(titleUrl('interstellar'));
        const w = widget(page);
        await expect(w.skeleton).toBeVisible();
        await expect(w.watch).toHaveAttribute('href', 'https://sspoisk.ru/film/258687/');

        await expect(w.title).toHaveText('Интерстеллар');
        await expect(w.rating).toHaveText('8,6');
        await expect(w.description).toHaveText(/^Фантастический эпос/);
        await expect(inlineButton(page).link).toBeVisible();
    });
});
