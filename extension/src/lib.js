/*
 * Чистые функции без доступа к DOM и chrome.* — их можно тестировать в Node.
 * В браузере подключаются как обычный скрипт и живут в globalThis.KPE.
 */
(function (root) {
    'use strict';

    const DEFAULT_SETTINGS = Object.freeze({
        enabled: true,
        mirrors: Object.freeze(['sspoisk.ru']),
        autoFallback: true,
        openInNewTab: false,
        inlineButton: true,
        floating: 'auto', // 'auto' — когда кнопка на странице не видна, 'always', 'never'
        position: 'bottom-right', // 'bottom-right' | 'bottom-left' | 'top-right'
        theme: 'auto', // 'auto' — как у сайта, 'dark', 'light'
        hotkey: true,
    });

    const DEFAULT_LOCAL = Object.freeze({
        expanded: false,
        onboarded: false,
        hiddenTitles: Object.freeze([]),
    });

    const MAX_MIRRORS = 10;
    const MAX_HIDDEN = 500;

    /**
     * «/film/258687/», «/series/464963/reviews/» → { type, id }.
     * Всё остальное (главная, персоны, подборки, hd.kinopoisk.ru/film/<uuid>) → null.
     */
    function parseTitlePath(pathname) {
        const match = /^\/(film|series)\/(\d+)(?:\/|$)/.exec(String(pathname || ''));
        return match ? { type: match[1], id: match[2] } : null;
    }

    function titleKey(target) {
        return `${target.type}/${target.id}`;
    }

    function collapseSpaces(value) {
        return String(value || '')
            .replace(/\s+/g, ' ')
            .trim();
    }

    const YEAR_PARENS = /\s*\(([^()]*\b(?:18|19|20)\d{2}\b[^()]*)\)$/;

    /**
     * Убирает хвост с годом и типом: «Интерстеллар (2014)», «Игра престолов (сериал, 2011 – 2019)».
     * Скобки внутри самого названия остаются: «(500) дней лета (2009)» → «(500) дней лета».
     */
    function cleanTitle(raw) {
        return collapseSpaces(raw).replace(YEAR_PARENS, '').trim();
    }

    /**
     * Годы и тип из хвоста og:title: «(сериал, 2011 – 2019)» → { years: '2011–2019', kindHint: 'Сериал' },
     * «(ТВ, 1975 – ...)» → { years: '1975–…', kindHint: 'ТВ-шоу' }.
     */
    function parseTitleMeta(raw) {
        const match = YEAR_PARENS.exec(collapseSpaces(raw));
        if (!match) return { years: '', kindHint: '' };
        const inner = match[1];
        const years = inner.match(/(?:18|19|20)\d{2}/g) || [];
        let range = years[0] || '';
        if (years.length >= 2 && years[1] !== years[0]) range = `${years[0]}–${years[1]}`;
        else if (/[–—-]\s*(?:\.\.\.|…)/.test(inner)) range = `${years[0]}–…`;

        const head = inner.split(',')[0].trim().toLowerCase();
        let kindHint = '';
        if (/мини\s*[–—-]?\s*сериал/.test(head)) kindHint = 'Мини-сериал';
        else if (/мультсериал/.test(head)) kindHint = 'Мультсериал';
        else if (/сериал/.test(head)) kindHint = 'Сериал';
        else if (/^тв(?![а-яё])/.test(head)) kindHint = 'ТВ-шоу';
        return { years: range, kindHint };
    }

    /** Подпись типа: жанр важнее (аниме/мультфильм/документальный), затем подсказка из заголовка. */
    function describeKind({ type, kindHint, genre }) {
        const genres = String(genre || '').toLowerCase();
        const series = type === 'series';
        if (/аниме/.test(genres)) return series ? 'Аниме-сериал' : 'Аниме';
        if (/документальн/.test(genres)) return series ? 'Документальный сериал' : 'Документальный';
        if (/мультфильм/.test(genres)) return series ? 'Мультсериал' : 'Мультфильм';
        if (kindHint) return kindHint;
        return series ? 'Сериал' : 'Фильм';
    }

    function pluralRu(n, one, few, many) {
        const mod10 = n % 10;
        const mod100 = n % 100;
        if (mod10 === 1 && mod100 !== 11) return one;
        if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
        return many;
    }

    /** «8 сезонов», «1 сезон, 10 серий» → 8 / 1. */
    function parseSeasons(text) {
        const match = /^(\d{1,3})\s+сезон/i.exec(collapseSpaces(text));
        return match ? Number(match[1]) || null : null;
    }

    function formatSeasons(count) {
        return count ? `${count} ${pluralRu(count, 'сезон', 'сезона', 'сезонов')}` : '';
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

    /** Цвет рейтинга как на Кинопоиске: от 7 — зелёный, от 5 — серый, ниже — красный. */
    function ratingTone(value) {
        if (value == null) return '';
        if (value >= 7) return 'good';
        if (value >= 5) return 'mid';
        return 'bad';
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

    function formatDuration(minutes, { perEpisode = false } = {}) {
        if (!minutes) return '';
        const hours = Math.floor(minutes / 60);
        const rest = minutes % 60;
        let text = `${rest} мин`;
        if (hours) text = rest ? `${hours} ч ${rest} мин` : `${hours} ч`;
        return perEpisode ? `${text} / серия` : text;
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
        const host = normalizeMirror(mirror) || DEFAULT_SETTINGS.mirrors[0];
        return `https://${host}/${target.type}/${target.id}/`;
    }

    function pick(value, allowed, fallback) {
        return allowed.includes(value) ? value : fallback;
    }

    /** Приводит сохранённые настройки к актуальной схеме (в т.ч. старое поле mirror из версии 1.1). */
    function normalizeSettings(raw) {
        const source = raw || {};
        const list = Array.isArray(source.mirrors) ? source.mirrors : source.mirror ? [source.mirror] : [];
        const mirrors = [];
        for (const item of list) {
            const host = normalizeMirror(item);
            if (host && !mirrors.includes(host)) mirrors.push(host);
        }
        return {
            enabled: source.enabled !== false,
            mirrors: mirrors.length ? mirrors.slice(0, MAX_MIRRORS) : [...DEFAULT_SETTINGS.mirrors],
            autoFallback: source.autoFallback !== false,
            openInNewTab: Boolean(source.openInNewTab),
            inlineButton: source.inlineButton !== false,
            floating: pick(source.floating, ['auto', 'always', 'never'], DEFAULT_SETTINGS.floating),
            position: pick(source.position, ['bottom-right', 'bottom-left', 'top-right'], DEFAULT_SETTINGS.position),
            theme: pick(source.theme, ['auto', 'dark', 'light'], DEFAULT_SETTINGS.theme),
            hotkey: source.hotkey !== false,
        };
    }

    function normalizeLocal(raw) {
        const source = raw || {};
        const hidden = Array.isArray(source.hiddenTitles)
            ? source.hiddenTitles.filter((key) => /^(film|series)\/\d+$/.test(key))
            : [];
        return {
            expanded: Boolean(source.expanded),
            onboarded: Boolean(source.onboarded),
            hiddenTitles: hidden.slice(-MAX_HIDDEN),
        };
    }

    /** «rgb(242, 242, 242)», «rgba(0, 0, 0, 0)» → { r, g, b, a } или null. */
    function parseColor(value) {
        const match = /^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:\s*[,/]\s*([\d.]+%?))?\s*\)$/i.exec(
            String(value || '').trim(),
        );
        if (!match) return null;
        let alpha = match[4] == null ? 1 : Number.parseFloat(match[4]);
        if (String(match[4]).endsWith('%')) alpha /= 100;
        return { r: Number(match[1]), g: Number(match[2]), b: Number(match[3]), a: alpha };
    }

    /** Относительная яркость по WCAG, 0…1. */
    function luminance({ r, g, b }) {
        const channel = (value) => {
            const c = value / 255;
            return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
        };
        return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
    }

    function rgbToHsl(r, g, b) {
        const rn = r / 255;
        const gn = g / 255;
        const bn = b / 255;
        const max = Math.max(rn, gn, bn);
        const min = Math.min(rn, gn, bn);
        const l = (max + min) / 2;
        if (max === min) return [0, 0, l];
        const d = max - min;
        const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        let h;
        if (max === rn) h = (gn - bn) / d + (gn < bn ? 6 : 0);
        else if (max === gn) h = (bn - rn) / d + 2;
        else h = (rn - gn) / d + 4;
        return [h * 60, s, l];
    }

    function hslToRgb(h, s, l) {
        const k = (n) => (n + h / 30) % 12;
        const a = s * Math.min(l, 1 - l);
        const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
        return [f(0), f(8), f(4)].map((value) => Math.round(value * 255));
    }

    /**
     * Акцентный цвет постера из RGBA-пикселей: самый «весомый» оттенок среди насыщенных пикселей,
     * приведённый к умеренной яркости. Серый/чёрно-белый постер → null.
     */
    function pickAccent(pixels) {
        const BINS = 12;
        const bins = Array.from({ length: BINS }, () => ({ weight: 0, r: 0, g: 0, b: 0 }));
        for (let i = 0; i + 3 < pixels.length; i += 4) {
            if (pixels[i + 3] < 128) continue;
            const [h, s, l] = rgbToHsl(pixels[i], pixels[i + 1], pixels[i + 2]);
            if (s < 0.2 || l < 0.12 || l > 0.9) continue;
            const weight = s * (1 - Math.abs(2 * l - 1));
            const bin = bins[Math.floor(h / (360 / BINS)) % BINS];
            bin.weight += weight;
            bin.r += pixels[i] * weight;
            bin.g += pixels[i + 1] * weight;
            bin.b += pixels[i + 2] * weight;
        }
        const best = bins.reduce((a, b) => (b.weight > a.weight ? b : a));
        const total = bins.reduce((sum, bin) => sum + bin.weight, 0);
        const pixelCount = pixels.length / 4;
        if (!best.weight || total / pixelCount < 0.02) return null;

        const [h, s, l] = rgbToHsl(best.r / best.weight, best.g / best.weight, best.b / best.weight);
        const [r, g, b] = hslToRgb(h, Math.min(0.85, Math.max(s, 0.45)), Math.min(0.6, Math.max(l, 0.45)));
        return `rgb(${r}, ${g}, ${b})`;
    }

    const api = {
        DEFAULT_SETTINGS,
        DEFAULT_LOCAL,
        parseTitlePath,
        titleKey,
        collapseSpaces,
        cleanTitle,
        parseTitleMeta,
        describeKind,
        pluralRu,
        parseSeasons,
        formatSeasons,
        parseRating,
        formatRating,
        ratingTone,
        parseDuration,
        formatDuration,
        normalizeMirror,
        buildWatchUrl,
        normalizeSettings,
        normalizeLocal,
        parseColor,
        luminance,
        pickAccent,
    };

    root.KPE = Object.assign(root.KPE || {}, api);
    if (typeof module === 'object' && module.exports) module.exports = api;
})(globalThis);
