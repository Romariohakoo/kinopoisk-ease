const test = require('node:test');
const assert = require('node:assert/strict');
const {
    parseTitlePath,
    parseTitleMeta,
    describeKind,
    pluralRu,
    parseSeasons,
    formatSeasons,
    ratingTone,
    normalizeSettings,
    normalizeLocal,
    parseColor,
    luminance,
    pickAccent,
    cleanTitle,
    parseRating,
    formatRating,
    parseDuration,
    formatDuration,
    normalizeMirror,
    buildWatchUrl,
} = require('../../extension/src/lib.js');

test('parseTitlePath: фильмы, сериалы и вкладки', () => {
    assert.deepEqual(parseTitlePath('/film/258687/'), { type: 'film', id: '258687' });
    assert.deepEqual(parseTitlePath('/film/258687'), { type: 'film', id: '258687' });
    assert.deepEqual(parseTitlePath('/series/464963/reviews/'), { type: 'series', id: '464963' });
});

test('parseTitlePath: всё остальное — не тайтл', () => {
    for (const path of [
        '/',
        '/lists/movies/top250/',
        '/name/37859/',
        '/film/',
        '/film/abc/',
        '/film/4f2d2c1e3b5a/',
        '/films/1/',
        '/film/12x/',
        '',
    ]) {
        assert.equal(parseTitlePath(path), null, path);
    }
});

test('cleanTitle: убирает год и тип в скобках', () => {
    assert.equal(cleanTitle('Интерстеллар (2014)'), 'Интерстеллар');
    assert.equal(cleanTitle('Игра престолов (сериал, 2011 – 2019)'), 'Игра престолов');
    assert.equal(cleanTitle('Что? Где? Когда? (ТВ, 1975 – ...)'), 'Что? Где? Когда?');
    assert.equal(cleanTitle('  Шрэк\n (2001) '), 'Шрэк');
});

test('cleanTitle: не трогает скобки и тире внутри названия', () => {
    assert.equal(cleanTitle('(500) дней лета (2009)'), '(500) дней лета');
    assert.equal(
        cleanTitle('Звёздные войны: Эпизод 4 — Новая надежда (1977)'),
        'Звёздные войны: Эпизод 4 — Новая надежда',
    );
    assert.equal(cleanTitle('Борат (продолжение)'), 'Борат (продолжение)');
    assert.equal(cleanTitle(''), '');
    assert.equal(cleanTitle(null), '');
});

test('parseRating', () => {
    assert.equal(parseRating('8.6'), 8.6);
    assert.equal(parseRating('7,9'), 7.9);
    assert.equal(parseRating('8.61 010 000 оценок'), 8.61);
    assert.equal(parseRating('10'), 10);
    assert.equal(parseRating(' 6.512 '), 6.512);
    assert.equal(parseRating('95%'), null);
    assert.equal(parseRating('Рейтинг появится после выхода'), null);
    assert.equal(parseRating('0'), null);
    assert.equal(parseRating('—'), null);
    assert.equal(parseRating(''), null);
});

test('formatRating', () => {
    assert.equal(formatRating(8.6), '8,6');
    assert.equal(formatRating(9), '9,0');
    assert.equal(formatRating(8.61), '8,6');
    assert.equal(formatRating(10), '10');
    assert.equal(formatRating(null), '');
});

test('parseDuration', () => {
    assert.equal(parseDuration('169 мин. / 02:49'), 169);
    assert.equal(parseDuration('45 мин.'), 45);
    assert.equal(parseDuration('02:05'), 125);
    assert.equal(parseDuration('PT169M'), 169);
    assert.equal(parseDuration('PT2H5M'), 125);
    assert.equal(parseDuration('PT1H'), 60);
    assert.equal(parseDuration(''), null);
    assert.equal(parseDuration('скоро'), null);
});

test('formatDuration', () => {
    assert.equal(formatDuration(169), '2 ч 49 мин');
    assert.equal(formatDuration(60), '1 ч');
    assert.equal(formatDuration(45), '45 мин');
    assert.equal(formatDuration(null), '');
});

test('normalizeMirror: принимает домен в любом виде', () => {
    assert.equal(normalizeMirror('sspoisk.ru'), 'sspoisk.ru');
    assert.equal(normalizeMirror('  https://www.SSPoisk.ru/film/1/?x=1#y '), 'www.sspoisk.ru');
    assert.equal(normalizeMirror('http://mirror.example:8080'), 'mirror.example:8080');
    assert.equal(normalizeMirror('кинопоиск.рф'), 'xn--h1aaecngahu.xn--p1ai');
    assert.equal(normalizeMirror('sspoisk.ru.'), 'sspoisk.ru');
});

test('normalizeMirror: отклоняет мусор', () => {
    for (const value of [
        '',
        '   ',
        'это не адрес',
        'localhost',
        'javascript:alert(1)',
        'ftp://mirror.example',
        'https://user:pass@mirror.example',
        '-bad-.ru',
        '192.168.0.1',
    ]) {
        assert.equal(normalizeMirror(value), null, value);
    }
});

test('buildWatchUrl', () => {
    assert.equal(buildWatchUrl('sspoisk.ru', { type: 'film', id: '258687' }), 'https://sspoisk.ru/film/258687/');
    assert.equal(
        buildWatchUrl('mirror.example', { type: 'series', id: '464963' }),
        'https://mirror.example/series/464963/',
    );
    assert.equal(buildWatchUrl('мусор', { type: 'film', id: '1' }), 'https://sspoisk.ru/film/1/');
});

test('parseTitleMeta: годы и тип из хвоста заголовка', () => {
    assert.deepEqual(parseTitleMeta('Интерстеллар (2014)'), { years: '2014', kindHint: '' });
    assert.deepEqual(parseTitleMeta('Игра престолов (сериал, 2011 – 2019)'), {
        years: '2011–2019',
        kindHint: 'Сериал',
    });
    assert.deepEqual(parseTitleMeta('Чернобыль (мини–сериал, 2019)'), { years: '2019', kindHint: 'Мини-сериал' });
    assert.deepEqual(parseTitleMeta('Что? Где? Когда? (ТВ, 1975 – ...)'), { years: '1975–…', kindHint: 'ТВ-шоу' });
    assert.deepEqual(parseTitleMeta('Смешарики (мультсериал, 2004 – 2012)'), {
        years: '2004–2012',
        kindHint: 'Мультсериал',
    });
    assert.deepEqual(parseTitleMeta('Твин Пикс (Twin Peaks, 1990)'), { years: '1990', kindHint: '' });
    assert.deepEqual(parseTitleMeta('Без года'), { years: '', kindHint: '' });
});

test('describeKind: жанр важнее подсказки', () => {
    assert.equal(describeKind({ type: 'film', genre: 'аниме, мультфильм' }), 'Аниме');
    assert.equal(describeKind({ type: 'series', kindHint: 'Сериал', genre: 'аниме, фэнтези' }), 'Аниме-сериал');
    assert.equal(describeKind({ type: 'film', genre: 'мультфильм, комедия' }), 'Мультфильм');
    assert.equal(describeKind({ type: 'series', genre: 'мультфильм' }), 'Мультсериал');
    assert.equal(describeKind({ type: 'film', genre: 'документальный, спорт' }), 'Документальный');
    assert.equal(describeKind({ type: 'series', kindHint: 'Мини-сериал', genre: 'драма' }), 'Мини-сериал');
    assert.equal(describeKind({ type: 'series', genre: '' }), 'Сериал');
    assert.equal(describeKind({ type: 'film' }), 'Фильм');
});

test('pluralRu, parseSeasons, formatSeasons', () => {
    assert.equal(pluralRu(1, 'a', 'b', 'c'), 'a');
    assert.equal(pluralRu(3, 'a', 'b', 'c'), 'b');
    assert.equal(pluralRu(11, 'a', 'b', 'c'), 'c');
    assert.equal(pluralRu(21, 'a', 'b', 'c'), 'a');
    assert.equal(pluralRu(112, 'a', 'b', 'c'), 'c');
    assert.equal(parseSeasons('8 сезонов'), 8);
    assert.equal(parseSeasons('1 сезон, 10 серий'), 1);
    assert.equal(parseSeasons('Сезоны'), null);
    assert.equal(formatSeasons(1), '1 сезон');
    assert.equal(formatSeasons(4), '4 сезона');
    assert.equal(formatSeasons(8), '8 сезонов');
    assert.equal(formatSeasons(null), '');
});

test('ratingTone', () => {
    assert.equal(ratingTone(8.6), 'good');
    assert.equal(ratingTone(7), 'good');
    assert.equal(ratingTone(6.9), 'mid');
    assert.equal(ratingTone(5), 'mid');
    assert.equal(ratingTone(4.2), 'bad');
    assert.equal(ratingTone(null), '');
});

test('formatDuration для серий', () => {
    assert.equal(formatDuration(60, { perEpisode: true }), '1 ч / серия');
    assert.equal(formatDuration(24, { perEpisode: true }), '24 мин / серия');
});

test('normalizeSettings: значения по умолчанию, проверка и миграция', () => {
    const defaults = normalizeSettings(undefined);
    assert.deepEqual(defaults.mirrors, ['sspoisk.ru']);
    assert.equal(defaults.floating, 'auto');
    assert.equal(defaults.enabled, true);
    assert.equal(defaults.hotkey, true);

    assert.deepEqual(normalizeSettings({ mirror: 'https://old.example/' }).mirrors, ['old.example']);
    assert.deepEqual(normalizeSettings({ mirrors: ['a.example', 'мусор', 'A.example', 'b.example'] }).mirrors, [
        'a.example',
        'b.example',
    ]);
    assert.deepEqual(normalizeSettings({ mirrors: [] }).mirrors, ['sspoisk.ru']);
    const odd = normalizeSettings({ floating: 'sometimes', position: 'center', theme: 'pink', enabled: false });
    assert.equal(odd.floating, 'auto');
    assert.equal(odd.position, 'bottom-right');
    assert.equal(odd.theme, 'auto');
    assert.equal(odd.enabled, false);
});

test('normalizeLocal: только корректные ключи тайтлов', () => {
    const local = normalizeLocal({ expanded: 1, hiddenTitles: ['film/1', 'bad', 'series/22', 5] });
    assert.deepEqual(local, { expanded: true, onboarded: false, hiddenTitles: ['film/1', 'series/22'] });
});

test('parseColor и luminance', () => {
    assert.deepEqual(parseColor('rgb(242, 242, 242)'), { r: 242, g: 242, b: 242, a: 1 });
    assert.deepEqual(parseColor('rgba(0, 0, 0, 0)'), { r: 0, g: 0, b: 0, a: 0 });
    assert.deepEqual(parseColor('rgb(10 20 30 / 50%)'), { r: 10, g: 20, b: 30, a: 0.5 });
    assert.equal(parseColor('transparent'), null);
    assert.ok(luminance({ r: 255, g: 255, b: 255 }) > 0.99);
    assert.ok(luminance({ r: 18, g: 18, b: 18 }) < 0.01);
});

function fill(size, rgb) {
    const pixels = new Uint8ClampedArray(size * size * 4);
    for (let i = 0; i < pixels.length; i += 4) pixels.set([...rgb, 255], i);
    return pixels;
}

test('pickAccent: насыщенный оттенок постера, серый постер — без акцента', () => {
    const orange = pickAccent(fill(8, [200, 120, 40]));
    const [r, g, b] = orange.match(/\d+/g).map(Number);
    assert.ok(r > g && g > b, orange);

    const mixed = fill(8, [30, 30, 30]);
    for (let i = 0; i < 16 * 4; i += 4) mixed.set([40, 90, 200, 255], i); // четверть синих пикселей
    const blue = pickAccent(mixed).match(/\d+/g).map(Number);
    assert.ok(blue[2] > blue[0] && blue[2] > blue[1]);

    assert.equal(pickAccent(fill(8, [128, 128, 128])), null);
    assert.equal(pickAccent(fill(8, [0, 0, 0])), null);
    assert.equal(pickAccent(new Uint8ClampedArray(0)), null);
});
