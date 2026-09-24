/*
 * Чтение данных о фильме/сериале со страницы Кинопоиска.
 * Классы вида styles_xxx__hash генерируются сборкой сайта и меняются, поэтому для каждого поля
 * есть цепочка запасных вариантов: разметка → JSON-LD → og-мета.
 */
(function (root) {
    'use strict';

    const {
        collapseSpaces,
        cleanTitle,
        parseTitleMeta,
        describeKind,
        parseSeasons,
        parseRating,
        parseDuration,
        parseTitlePath,
    } = root.KPE;

    const text = (el) => (el ? collapseSpaces(el.textContent) : '');

    function meta(doc, property) {
        const el = doc.querySelector(`meta[property="${property}"], meta[name="${property}"]`);
        return el ? collapseSpaces(el.getAttribute('content')) : '';
    }

    function absoluteUrl(doc, value) {
        if (!value) return '';
        try {
            const url = new URL(value, doc.baseURI);
            return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : '';
        } catch {
            return '';
        }
    }

    /** Первый объект Movie/TVSeries из <script type="application/ld+json">, если он есть. */
    function readJsonLd(doc) {
        for (const script of doc.querySelectorAll('script[type="application/ld+json"]')) {
            let parsed;
            try {
                parsed = JSON.parse(script.textContent);
            } catch {
                continue;
            }
            const items = Array.isArray(parsed) ? parsed : parsed['@graph'] || [parsed];
            const item = items.find((entry) => entry && /^(Movie|TVSeries|CreativeWork)$/.test(entry['@type']));
            if (item) return item;
        }
        return null;
    }

    /** Значение строки из таблицы «О фильме» по её подписи («Время», «Год производства»…). */
    function tableValue(doc, label) {
        for (const row of doc.querySelectorAll('[data-test-id="encyclopedic-table"] > *, [class*="styles_row"]')) {
            const cells = row.children;
            if (cells.length >= 2 && text(cells[0]) === label) return text(cells[cells.length - 1]);
        }
        return '';
    }

    /** Полный заголовок вместе с хвостом «(сериал, 2011 – 2019)». */
    function rawTitle(doc, ld) {
        return (
            meta(doc, 'og:title') ||
            text(doc.querySelector('h1[itemprop="name"], h1[class*="styles_title"]')) ||
            collapseSpaces(ld && ld.name) ||
            collapseSpaces(doc.title.split(' — ')[0])
        );
    }

    function extractSeasons(doc) {
        for (const el of doc.querySelectorAll('[class*="eason"], a[href*="/episodes/"]')) {
            const value = text(el);
            if (value.length < 40) {
                const count = parseSeasons(value);
                if (count) return count;
            }
        }
        return null;
    }

    function extractPoster(doc, ld) {
        const img =
            doc.querySelector('img.film-poster') ||
            doc.querySelector('[class*="styles_posterContainer"] img, [class*="styles_poster"] img');
        const fromImg = img && (img.currentSrc || img.getAttribute('src'));
        const fromLd = ld && (typeof ld.image === 'string' ? ld.image : ld.image && ld.image.url);
        return (
            absoluteUrl(doc, fromImg) ||
            absoluteUrl(doc, fromLd) ||
            absoluteUrl(doc, meta(doc, 'og:image')) ||
            absoluteUrl(doc, meta(doc, 'twitter:image'))
        );
    }

    function extractRating(doc, ld) {
        const value = doc.querySelector('.film-rating-value');
        if (value) return parseRating(text(value));

        const block = doc.querySelector('[class^="styles_ratingKpTop"], [class^="styles_rating"]');
        const fromBlock = parseRating(text(block));
        if (fromBlock != null) return fromBlock;

        const aggregate = ld && ld.aggregateRating;
        return aggregate ? parseRating(String(aggregate.ratingValue)) : null;
    }

    function extractDuration(doc, ld) {
        const value =
            text(doc.querySelector('[data-test-id="duration"] [class^="styles_value"]')) ||
            tableValue(doc, 'Время') ||
            (ld && ld.duration) ||
            '';
        return parseDuration(value);
    }

    function extractDescription(doc, ld) {
        const el =
            doc.querySelector('[class^="styles_topText"] p') ||
            doc.querySelector('[data-tid="bfd38da2"]') ||
            doc.querySelector('[class*="styles_synopsis"] p, [class*="styles_filmSynopsis"] p');
        return text(el) || collapseSpaces(ld && ld.description) || meta(doc, 'og:description');
    }

    /**
     * Какой фильм описывает текущая разметка — по canonical и og:url.
     * При SPA-навигации URL меняется раньше контента, и это позволяет не показать данные прошлого фильма.
     */
    function pageIdentity(doc) {
        const canonical = doc.querySelector('link[rel="canonical"]');
        const candidates = [canonical && canonical.getAttribute('href'), meta(doc, 'og:url')];
        for (const candidate of candidates) {
            const url = absoluteUrl(doc, candidate);
            const parsed = url && parseTitlePath(new URL(url).pathname);
            if (parsed) return parsed;
        }
        return null;
    }

    /** @param {{type: string}} target — чтобы отличать фильм от сериала, если страница молчит. */
    function extractFilmData(doc, target) {
        const ld = readJsonLd(doc);
        const raw = rawTitle(doc, ld);
        const { years, kindHint } = parseTitleMeta(raw);
        const type = (target && target.type) || (ld && ld['@type'] === 'TVSeries' ? 'series' : 'film');
        const tableYear = /(?:18|19|20)\d{2}/.exec(tableValue(doc, 'Год производства'));
        return {
            title: cleanTitle(raw),
            poster: extractPoster(doc, ld),
            rating: extractRating(doc, ld),
            duration: extractDuration(doc, ld),
            description: extractDescription(doc, ld),
            year: years || (tableYear ? tableYear[0] : ''),
            kind: describeKind({
                type,
                kindHint,
                genre: tableValue(doc, 'Жанр') || (ld && [].concat(ld.genre || []).join(', ')),
            }),
            seasons: type === 'series' ? extractSeasons(doc) : null,
            series: type === 'series',
        };
    }

    Object.assign(root.KPE, { extractFilmData, pageIdentity });
})(globalThis);
