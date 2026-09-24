/*
 * Подменяет сеть в Playwright: страницы *.kinopoisk.* собираются из catalog.js с разметкой,
 * повторяющей настоящий сайт (CSS-модули styles_xxx__hash, film-poster, data-tid, data-test-id…).
 * Флаги сценария передаются cookie kpe_fixture, например «noid,late,spa=800».
 */
const { TITLES, BY_PATH } = require('./catalog');

const KINOPOISK_HOST = /(^|\.)kinopoisk\.(ru|com|kz|by)$/;

const esc = (value) =>
    String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');

// Стили «сайта»: глобальные правила и классы с теми же именами, что были у старой плашки.
const SITE_CSS = `
* { box-sizing: border-box; }
body { margin: 0; font-family: Tahoma, Verdana, sans-serif; font-size: 17px; line-height: 2; color: #111; background: #f2f2f2; letter-spacing: 1px; }
h1 { font-size: 40px; margin: 0 0 8px; }
p { margin: 0 0 24px; }
a { color: #f50; }
button { font-family: Tahoma; font-size: 17px; }
.styles_header__app { position: sticky; top: 0; height: 64px; background: #1f1f1f; color: #fff; display: flex; align-items: center; gap: 24px; padding: 0 24px; z-index: 10; }
.styles_header__app a { color: #fff; text-decoration: none; }
.styles_root__2kxYy { display: grid; grid-template-columns: 302px 1fr 240px; gap: 32px; padding: 32px 24px; }
.film-poster { width: 302px; height: 453px; display: block; }
.styles_ratingKpTop__84afd { font-size: 32px; font-weight: bold; }
.styles_row__da_RK { display: grid; grid-template-columns: 180px 1fr; }
.kp-progress { position: fixed; top: 0; left: 0; height: 3px; width: 60%; background: #f50; z-index: 20; }
.links { padding: 0 24px 48px; display: flex; flex-wrap: wrap; gap: 8px 16px; }
#site-button { margin: 0 24px; }
`;

// Правила с теми же именами классов, что были у старой плашки (.title, .button…), — проверка изоляции.
// Флаг «plain» их отключает, чтобы сравнивать внешний вид.
const HOSTILE_CSS = `
svg { width: 40px; height: 40px; }
.title { display: none; }
.button { background: rgb(255, 102, 0); color: rgb(0, 0, 0); padding: 20px; border-radius: 0; }
.background { background: rgb(0, 128, 0); }
.first, .last { outline: 5px solid rgb(255, 0, 255); }
`;

// Упрощённый роутер в духе Next.js: pushState сразу, полоса загрузки, новый контент — с задержкой.
const ROUTER_JS = `
(() => {
  let seq = 0;
  // staleid: сайт не обновляет canonical/og:url при переходе.
  const IDENTITY = ['link[rel="canonical"]', 'meta[property="og:url"]'];
  const HEAD = ['meta[property="og:title"]', 'meta[property="og:description"]', 'meta[property="og:image"]',
    'script[type="application/ld+json"]'].concat(window.__SPA_KEEP_IDENTITY ? [] : IDENTITY);
  async function go(url, push) {
    const my = ++seq;
    if (push) history.pushState({}, '', url);
    const bar = document.createElement('div');
    bar.className = 'kp-progress';
    document.body.append(bar);
    const html = await (await fetch(url, { headers: { 'x-spa': '1' } })).text();
    await new Promise((resolve) => setTimeout(resolve, window.__SPA_DELAY));
    bar.remove();
    if (my !== seq) return;
    const doc = new DOMParser().parseFromString(html, 'text/html');
    document.title = doc.title;
    for (const selector of HEAD) {
      document.head.querySelectorAll(selector).forEach((el) => el.remove());
      doc.head.querySelectorAll(selector).forEach((el) => document.head.append(el));
    }
    document.getElementById('__next').replaceWith(doc.getElementById('__next'));
    window.scrollTo(0, 0);
  }
  document.addEventListener('click', (event) => {
    const link = event.target.closest('a[data-spa]');
    if (!link || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey) return;
    event.preventDefault();
    go(link.href, true);
  });
  window.addEventListener('popstate', () => go(location.href, false));
  window.__spaGo = (url) => go(url, true);
})();
`;

function parseFlags(cookieHeader) {
    const match = /(?:^|;\s*)kpe_fixture=([^;]*)/.exec(cookieHeader || '');
    const flags = { noid: false, staleid: false, late: false, plain: false, csp: false, spaDelay: 400 };
    if (!match) return flags;
    for (const part of decodeURIComponent(match[1]).split(',')) {
        const [name, value] = part.split('=');
        if (name === 'spa') flags.spaDelay = Number(value);
        else if (name) flags[name] = true;
    }
    return flags;
}

function posterUrl(entry, size = '300x450') {
    return `//avatars.mds.yandex.net/get-kinopoisk-image/fixture/${entry.id}/${size}`;
}

function relatedLinks(current) {
    const links = TITLES.filter((entry) => entry !== current).map(
        (entry) => `<a href="/${entry.type}/${entry.id}/" data-spa data-key="${entry.key}">${esc(entry.title)}</a>`,
    );
    return `<nav class="links" aria-label="Похожие">${links.join('')}</nav>`;
}

function header() {
    return `<header class="styles_header__app">
  <a href="/" data-spa>Кинопоиск (фикстура)</a>
  <a href="/lists/movies/top250/" data-spa>Топ-250</a>
  <a href="/name/37859/" data-spa>Персона</a>
</header>`;
}

function jsonLd(entry) {
    const ld = {
        '@context': 'https://schema.org',
        '@type': entry.type === 'series' ? 'TVSeries' : 'Movie',
        name: entry.title,
        image: `https:${posterUrl(entry)}`,
        description: entry.synopsis || entry.ogDescription || '',
    };
    if (entry.rating) ld.aggregateRating = { '@type': 'AggregateRating', ratingValue: entry.rating };
    if (entry.duration) ld.duration = `PT${parseInt(entry.duration, 10)}M`;
    return `<script type="application/ld+json">${JSON.stringify(ld).replace(/</g, '\\u003c')}</script>`;
}

function mainContent(entry, subpage) {
    if (entry.redesign) {
        return `<main class="Main_root__x1"><div class="Hero_root__a9">
  <div class="Hero_cover__q2"><img class="Cover_img__z" src="${posterUrl(entry)}" alt=""></div>
  <div><h1 class="Hero_heading__k3">${esc(entry.ogTitle)}</h1>
  <div class="Hero_score__p1">${esc(entry.rating)}</div>
  <div class="Hero_about__m4">${esc(entry.synopsis)}</div></div>
</div></main>`;
    }

    const poster = entry.noPosterImg
        ? ''
        : `<a class="styles_posterLink__C1HRc" href="/${entry.type}/${entry.id}/posters/">
      <img class="film-poster styles_root__24Kbz image styles_image__lFPXy" src="${posterUrl(entry)}"
        srcset="${posterUrl(entry)} 1x, ${posterUrl(entry, '600x900')} 2x" alt="${esc(entry.title)}"></a>`;

    const rating = entry.rating
        ? `<div class="styles_ratingKpTop__84afd" data-tid="939058a8"><span class="film-rating-value styles_rootPositive__mLBSO styles_rootInDark__SZOTu"><span>${esc(entry.rating)}</span></span><span class="styles_count__iOIwD">${esc(entry.votes)} оценок</span></div>`
        : `<div class="styles_ratingKpTop__84afd" data-tid="939058a8"><span class="styles_waiting__x">Рейтинг появится после выхода</span></div>`;

    const durationRow = entry.duration
        ? `<div class="styles_rowDark__ucbcz styles_row__da_RK" data-test-id="duration"><div class="styles_titleDark___tfMR">Время</div><div class="styles_value__g6yP4 styles_valueDark__BCk93">${esc(entry.duration)}</div></div>`
        : '';

    const subpageNote = subpage ? `<p class="styles_subpage__x">Раздел: ${esc(subpage)}</p>` : '';

    return `<main class="styles_main__">
  <div class="styles_root__2kxYy" data-tid="f22e0093">
    <div class="styles_column__r2MWX styles_posterColumn__"><div class="styles_posterContainer__Knvhw">${poster}</div></div>
    <div class="styles_column__r2MWX">
      <div class="styles_header__mzj3d">
        <h1 class="styles_title__65Zwx" itemprop="name"><span data-tid="75209b22">${esc(entry.ogTitle)}</span></h1>
        <span class="styles_originalTitle__JaNKM">${esc(entry.original)}</span>
      </div>
      ${subpageNote}
      ${entry.topText ? `<div class="styles_topText__p__5L"><p>${esc(entry.topText)}</p></div>` : ''}
      <h3>О ${entry.type === 'series' ? 'сериале' : 'фильме'}</h3>
      <div data-test-id="encyclopedic-table" class="styles_rootDark__Z6Ag0">
        <div class="styles_rowDark__ucbcz styles_row__da_RK"><div class="styles_titleDark___tfMR">Год производства</div><div class="styles_value__g6yP4 styles_valueDark__BCk93"><a href="/lists/">${esc(entry.year)}</a></div></div>
        <div class="styles_rowDark__ucbcz styles_row__da_RK"><div class="styles_titleDark___tfMR">Жанр</div><div class="styles_value__g6yP4 styles_valueDark__BCk93">${esc(entry.genre)}</div></div>
        ${durationRow}
      </div>
    </div>
    <div class="styles_column__r2MWX">${rating}</div>
  </div>
  <section class="styles_synopsisSection__nJoAj"><div class="styles_filmSynopsis__Cu2Oz">${
      entry.synopsis ? `<p class="styles_paragraph__wEGPz" data-tid="bfd38da2">${esc(entry.synopsis)}</p>` : ''
  }</div></section>
  <nav class="links" aria-label="Разделы">
    <a href="/${entry.type}/${entry.id}/" data-spa>Обзор</a>
    <a href="/${entry.type}/${entry.id}/reviews/" data-spa data-key="reviews">Рецензии</a>
  </nav>
  <button class="button first" id="site-button" type="button">Кнопка сайта</button>
</main>`;
}

function page({ title, head = '', body, flags }) {
    return `<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
${head}
<style>${SITE_CSS}${flags.plain ? '' : HOSTILE_CSS}</style>
</head>
<body>
<div id="__next">${body}</div>
<script>window.__SPA_DELAY = ${Number(flags.spaDelay) || 0}; window.__SPA_KEEP_IDENTITY = ${Boolean(flags.staleid)};${ROUTER_JS}</script>
</body>
</html>`;
}

function titlePage(entry, url, flags) {
    const canonical = `https://www.kinopoisk.ru${url.pathname}`;
    const subpage = url.pathname.split('/').filter(Boolean)[2] || '';
    const identity = flags.noid
        ? ''
        : `<link rel="canonical" href="${canonical}">\n<meta property="og:url" content="${canonical}">`;
    const head = `${identity}
<meta property="og:title" content="${esc(entry.ogTitle)}">
<meta property="og:description" content="${esc(entry.ogDescription || entry.synopsis || '')}">
<meta property="og:image" content="https:${posterUrl(entry, '1200x630')}">
${entry.redesign ? jsonLd(entry) : ''}`;

    let body = header() + mainContent(entry, subpage) + relatedLinks(entry);
    // «Поздняя гидрация»: первые 1000 мс в разметке только шапка.
    if (flags.late && !flags.spa) {
        const encoded = JSON.stringify(body).replace(/</g, '\\u003c');
        body = `${header()}<script>setTimeout(() => { document.getElementById('__next').innerHTML = ${encoded}; }, 1000);</script>`;
    }
    return page({ title: `${entry.ogTitle} — смотреть онлайн в хорошем качестве — Кинопоиск`, head, body, flags });
}

function simplePage(title, text, flags) {
    return page({
        title,
        body: `${header()}<main style="padding:24px"><h2>${esc(title)}</h2><p>${esc(text)}</p></main>${relatedLinks(null)}`,
        flags,
    });
}

function posterSvg(entry, size) {
    const [from, to] = entry ? entry.palette : ['#333', '#777'];
    const [w, h] = size.split('x').map(Number);
    const label = entry ? esc(entry.title.replace(/<[^>]*>/g, '')) : '';
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 300 450">
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${from}"/><stop offset="1" stop-color="${to}"/></linearGradient></defs>
<rect width="300" height="450" fill="url(#g)"/>
<circle cx="230" cy="110" r="70" fill="rgba(255,255,255,0.18)"/>
<text x="24" y="400" font-family="sans-serif" font-size="30" font-weight="700" fill="white">${label.slice(0, 16)}</text>
</svg>`;
}

async function handleRoute(route) {
    const request = route.request();
    const url = new URL(request.url());
    // Файлы самого расширения (шрифты, widget.css) идут как есть.
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return route.continue();
    const html = (body, status = 200, headers = {}) =>
        route.fulfill({ status, contentType: 'text/html; charset=utf-8', body, headers });

    if (url.hostname === 'avatars.mds.yandex.net') {
        const [, , id, size] = url.pathname.split('/').filter(Boolean);
        const entry = TITLES.find((item) => item.id === id);
        return route.fulfill({ status: 200, contentType: 'image/svg+xml', body: posterSvg(entry, size || '300x450') });
    }

    if (KINOPOISK_HOST.test(url.hostname)) {
        const flags = parseFlags((await request.allHeaders()).cookie);
        flags.spa = request.headers()['x-spa'] === '1';
        const [section, id] = url.pathname.split('/').filter(Boolean);

        if (url.hostname.startsWith('hd.'))
            return html(simplePage('Кинопоиск HD', 'Страница стримингового сервиса', flags));
        if ((section === 'film' || section === 'series') && /^\d+$/.test(id || '')) {
            const entry = BY_PATH.get(`${section}/${id}`);
            if (entry) {
                const headers = flags.csp
                    ? {
                          'content-security-policy':
                              "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' https://avatars.mds.yandex.net; font-src 'self'; connect-src 'self'",
                      }
                    : {};
                return html(titlePage(entry, url, flags), 200, headers);
            }
            return html(simplePage('404', 'Нет такого тайтла', flags), 404);
        }
        if (url.pathname === '/') return html(simplePage('Кинопоиск', 'Главная страница', flags));
        if (section === 'lists') return html(simplePage('Топ-250', 'Подборка фильмов', flags));
        if (section === 'name') return html(simplePage('Персона', 'Страница актёра', flags));
        return html(simplePage('404', 'Страница не найдена', flags), 404);
    }

    // Зеркало для просмотра и прочие внешние сайты.
    return html(`<!DOCTYPE html><title>Внешний сайт</title><h1 id="external">${esc(url.href)}</h1>`);
}

module.exports = { handleRoute };
