const test = require('node:test');
const assert = require('node:assert/strict');
const {
    parseTitlePath,
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
