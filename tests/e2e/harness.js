/*
 * Запуск Chromium с распакованным расширением и подменённой сетью (см. fixtures/server.js).
 */
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const { test: base, expect, chromium } = require('@playwright/test');
const { handleRoute } = require('./fixtures/server');
const { titleByKey } = require('./fixtures/catalog');

const EXTENSION_DIR = path.resolve(process.env.KPE_EXTENSION_DIR || path.join(__dirname, '../../extension'));

const test = base.extend({
    viewport: [{ width: 1280, height: 800 }, { option: true }],
    reducedMotion: ['no-preference', { option: true }],
    fixtureFlags: ['', { option: true }],

    context: async ({ viewport, reducedMotion, fixtureFlags }, use) => {
        const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kpe-profile-'));
        const context = await chromium.launchPersistentContext(userDataDir, {
            channel: 'chromium',
            headless: !process.env.HEADED,
            viewport,
            reducedMotion,
            locale: 'ru-RU',
            args: [`--disable-extensions-except=${EXTENSION_DIR}`, `--load-extension=${EXTENSION_DIR}`],
        });
        await context.route('**/*', handleRoute);
        if (fixtureFlags) await setFlags(context, fixtureFlags);
        await use(context);
        await context.close();
        fs.rmSync(userDataDir, { recursive: true, force: true });
    },

    page: async ({ context }, use) => {
        const page = context.pages()[0] || (await context.newPage());
        const errors = await collectErrors(context, page);
        await use(page);
        expect(errors, 'ошибки JavaScript на странице и в скриптах расширения').toEqual([]);
    },
});

/**
 * Ошибки из скриптов расширения живут в изолированном мире и не приходят в page.on('pageerror'/'console'),
 * поэтому слушаем их через CDP — он видит все контексты выполнения страницы.
 */
async function collectErrors(context, page) {
    const errors = [];
    const cdp = await context.newCDPSession(page);
    cdp.on('Runtime.exceptionThrown', ({ exceptionDetails }) => {
        errors.push((exceptionDetails.exception && exceptionDetails.exception.description) || exceptionDetails.text);
    });
    cdp.on('Runtime.consoleAPICalled', ({ type, args }) => {
        if (type === 'error' || type === 'assert')
            errors.push(args.map((arg) => arg.value ?? arg.description).join(' '));
    });
    await cdp.send('Runtime.enable');
    return errors;
}

async function setFlags(context, flags) {
    const cookies = ['kinopoisk.ru', 'kinopoisk.com', 'kinopoisk.kz', 'kinopoisk.by'].map((domain) => ({
        name: 'kpe_fixture',
        value: encodeURIComponent(flags),
        domain: `.${domain}`,
        path: '/',
    }));
    await context.addCookies(cookies);
}

function titleUrl(key, { host = 'www.kinopoisk.ru', suffix = '' } = {}) {
    const entry = titleByKey(key);
    return `https://${host}/${entry.type}/${entry.id}/${suffix}`;
}

/** Локаторы внутри Shadow DOM плашки (Playwright проходит сквозь open shadow root). */
function widget(page) {
    const host = page.locator('kinopoisk-ease-widget');
    const part = (role) => host.locator(`[data-role="${role}"]`);
    return {
        host,
        surface: host.locator('.surface:not(.is-leaving)'),
        card: host.locator('.surface.card'),
        pill: host.locator('.surface.pill'),
        loading: host.locator('.surface.loading'),
        title: part('title'),
        rating: part('rating'),
        duration: part('duration'),
        description: part('description'),
        watch: part('watch'),
        settings: part('settings'),
        collapse: part('collapse'),
        expand: part('expand'),
        poster: host.locator('.poster-image'),
    };
}

module.exports = { test, expect, titleUrl, widget, setFlags, titleByKey, EXTENSION_DIR };
