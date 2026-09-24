/*
 * Чистые функции без доступа к DOM и chrome.* — их можно тестировать в Node.
 * В браузере подключаются как обычный content script и живут в globalThis.KPE.
 */
(function (root) {
    'use strict';

    const DEFAULT_SETTINGS = Object.freeze({
        mirror: 'sspoisk.ru',
        openInNewTab: false,
    });

    /**
     * «/film/258687/», «/series/464963/reviews/» → { type, id }.
     * Всё остальное (главная, персоны, подборки, hd.kinopoisk.ru/film/<uuid>) → null.
     */
    function parseTitlePath(pathname) {
        const match = /^\/(film|series)\/(\d+)(?:\/|$)/.exec(String(pathname || ''));
        return match ? { type: match[1], id: match[2] } : null;
    }

    function collapseSpaces(value) {
        return String(value || '')
            .replace(/\s+/g, ' ')
            .trim();
    }

    /**
     * Убирает хвост с годом и типом: «Интерстеллар (2014)», «Игра престолов (сериал, 2011 – 2019)».
     * Скобки внутри самого названия остаются: «(500) дней лета (2009)» → «(500) дней лета».
     */
    function cleanTitle(raw) {
        return collapseSpaces(raw)
            .replace(/\s*\([^()]*\b(?:18|19|20)\d{2}\b[^()]*\)$/, '')
            .trim();
    }

    /** «8.6», «8.61 010 000 оценок», «7,9» → число от 0 до 10 или null. */
    function parseRating(text) {
        const match = /^(\d{1,2}(?:[.,]\d{1,3})?)(?!\d)/.exec(collapseSpaces(text));
        if (!match) return null;
        const value = Number.parseFloat(match[1].replace(',', '.'));
        return value > 0 && value <= 10 ? value : null;
    }

    function formatRating(value) {
        if (value == null) return '';
        return value === 10 ? '10' : value.toFixed(1).replace('.', ',');
    }

    /** «169 мин. / 02:49», «45 мин.», «02:05», ISO «PT169M» → минуты или null. */
    function parseDuration(text) {
        const value = collapseSpaces(text);
        let match = /(\d+)\s*мин/i.exec(value);
        if (match) return Number(match[1]) || null;
        match = /^PT(?:(\d+)H)?(?:(\d+)M)?/i.exec(value);
        if (match && (match[1] || match[2])) {
            return Number(match[1] || 0) * 60 + Number(match[2] || 0) || null;
        }
        match = /\b(\d{1,2}):(\d{2})\b/.exec(value);
        if (match) return Number(match[1]) * 60 + Number(match[2]) || null;
        return null;
    }

    function formatDuration(minutes) {
        if (!minutes) return '';
        const hours = Math.floor(minutes / 60);
        const rest = minutes % 60;
        if (!hours) return `${rest} мин`;
        return rest ? `${hours} ч ${rest} мин` : `${hours} ч`;
    }

    /**
     * Принимает то, что пользователь ввёл в настройках («sspoisk.ru», «https://www.sspoisk.ru/film/1/»)
     * и возвращает чистый хост или null, если это не похоже на домен.
     */
    function normalizeMirror(input) {
        let value = String(input || '').trim();
        if (!value) return null;
        if (!/^[a-z][a-z\d+.-]*:\/\//i.test(value)) value = `https://${value}`;

        let url;
        try {
            url = new URL(value);
        } catch {
            return null;
        }
        if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
        if (url.username || url.password) return null;

        const host = url.hostname.toLowerCase().replace(/\.$/, '');
        const label = '[a-z\\d](?:[a-z\\d-]{0,61}[a-z\\d])?';
        const hostPattern = new RegExp(`^(?=.{1,253}$)(?:${label}\\.)+(?:[a-z]{2,63}|xn--[a-z\\d-]{1,59})$`);
        if (!hostPattern.test(host)) return null;
        return url.port ? `${host}:${url.port}` : host;
    }

    function buildWatchUrl(mirror, target) {
        const host = normalizeMirror(mirror) || DEFAULT_SETTINGS.mirror;
        return `https://${host}/${target.type}/${target.id}/`;
    }

    const api = {
        DEFAULT_SETTINGS,
        parseTitlePath,
        collapseSpaces,
        cleanTitle,
        parseRating,
        formatRating,
        parseDuration,
        formatDuration,
        normalizeMirror,
        buildWatchUrl,
    };

    root.KPE = Object.assign(root.KPE || {}, api);
    if (typeof module === 'object' && module.exports) module.exports = api;
})(globalThis);
