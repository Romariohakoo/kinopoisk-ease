/*
 * Запуск Chromium с распакованным расширением и подменённой сетью (см. fixtures/server.js).
 */
const crypto = require('node:crypto');
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
    // Начальное содержимое chrome.storage: { sync: {...}, local: {...} }. Подсказку первого запуска
    // по умолчанию считаем показанной, чтобы она не мешала остальным сценариям.
    storage: [{}, { option: true }],

    context: async ({ viewport, reducedMotion, fixtureFlags, storage }, use) => {
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
        await setStorage(context, { sync: storage.sync || {}, local: { onboarded: true, ...(storage.local || {}) } });
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

/** ID распакованного расширения Chrome вычисляет из абсолютного пути к папке. */
const EXTENSION_ID = [...crypto.createHash('sha256').update(EXTENSION_DIR).digest('hex').slice(0, 32)]
    .map((char) => String.fromCharCode(97 + parseInt(char, 16)))
    .join('');

/**
 * Service worker расширения. Под нагрузкой Chrome запускает его не сразу, а Playwright иногда пропускает
 * событие запуска, поэтому ждём понемногу и будим воркер сообщением со страницы расширения.
 */
async function serviceWorker(context) {
    for (let attempt = 0; attempt < 6; attempt++) {
        const [existing] = context.serviceWorkers();
        if (existing) return existing;
        try {
            return await context.waitForEvent('serviceworker', { timeout: 2000 });
        } catch {
            await withExtensionPage(context, (page) =>
                page.evaluate(() => chrome.runtime.sendMessage({ type: 'ping' }).catch(() => {})),
            );
        }
    }
    throw new Error('Service worker расширения не запустился');
}

/**
 * Проверка зеркал идёт из service worker, мимо перехвата сети Playwright. Подменяем fetch в воркере:
 * хосты со словом «dead» недоступны, остальные отвечают.
 */
async function stubMirrorChecks(context) {
    for (let attempt = 0; ; attempt++) {
        try {
            const worker = await serviceWorker(context);
            await worker.evaluate(() => {
                self.fetch = async (url) => {
                    if (new URL(url).hostname.includes('dead')) throw new TypeError('Failed to fetch');
                    return new Response(null, { status: 200 });
                };
            });
            return;
        } catch (error) {
            if (attempt >= 3) throw error;
        }
    }
}

/** Временная страница расширения: у неё всегда есть chrome.* API, в отличие от спящего воркера. */
async function withExtensionPage(context, callback) {
    const page = await context.newPage();
    try {
        await page.goto(`chrome-extension://${EXTENSION_ID}/options/options.html`);
        return await callback(page);
    } finally {
        await page.close();
    }
}

async function setStorage(context, { sync = {}, local = {} }) {
    await withExtensionPage(context, (page) =>
        page.evaluate(
            async ({ sync, local }) => {
                await chrome.storage.sync.set(sync);
                await chrome.storage.local.set(local);
            },
            { sync, local },
        ),
    );
}

async function openOptions(context, { popup = false } = {}) {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${EXTENSION_ID}/options/options.html${popup ? '?popup' : ''}`);
    return page;
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

/** Локаторы внутри Shadow DOM плавающей плашки (Playwright проходит сквозь open shadow root). */
function widget(page) {
    const host = page.locator('kinopoisk-ease-widget');
    const surface = host.locator('.surface');
    const part = (role) => surface.locator(`[data-role="${role}"]`);
    return {
        host,
        surface,
        stage: host.locator('.stage'),
        compact: surface.locator('.view.compact:not(.is-loading)'),
        expanded: surface.locator('.view.expanded'),
        skeleton: surface.locator('.view.is-loading'),
        title: part('title'),
        meta: part('meta'),
        rating: part('rating'),
        duration: part('duration'),
        kind: part('kind'),
        year: part('year'),
        seasons: part('seasons'),
        description: part('description'),
        watch: part('watch'),
        settings: part('settings'),
        expand: part('expand'),
        collapse: part('collapse'),
        hide: part('hide'),
        onboarding: host.locator('[data-role="onboarding"]'),
        poster: surface.locator('.poster, .thumb'),
    };
}

/** Кнопка «Смотреть на …» внутри страницы. */
function inlineButton(page) {
    const host = page.locator('kinopoisk-ease-button');
    return { host, link: host.locator('[data-role="inline-watch"]') };
}

/** Плашка показана (или спрятана — атрибут data-hidden на хосте). */
async function expectFloating(page, visible) {
    const host = page.locator('kinopoisk-ease-widget');
    if (visible) await expect(host).not.toHaveAttribute('data-hidden', /.*/);
    else await expect(host).toHaveAttribute('data-hidden', '');
}

module.exports = {
    test,
    expect,
    titleUrl,
    widget,
    inlineButton,
    expectFloating,
    setFlags,
    setStorage,
    openOptions,
    EXTENSION_ID,
    serviceWorker,
    stubMirrorChecks,
    titleByKey,
    EXTENSION_DIR,
};
