/*
 * Фоновый service worker: проверка доступности зеркал и открытие настроек из плашки.
 */
importScripts('lib.js');

const { normalizeMirror } = globalThis.KPE;

const CHECK_TIMEOUT = 4000;
const CACHE_TTL = 5 * 60 * 1000;
const cache = new Map(); // host → { ok, at }

/**
 * Зеркало доступно, если на него вообще можно подключиться. no-cors не требует прав на домен
 * и не раскрывает содержимое ответа — важен только факт, что сервер ответил.
 */
async function checkMirror(host, { force = false } = {}) {
    const cached = cache.get(host);
    if (!force && cached && Date.now() - cached.at < CACHE_TTL) return cached.ok;
    let ok;
    try {
        await fetch(`https://${host}/`, {
            mode: 'no-cors',
            cache: 'no-store',
            credentials: 'omit',
            signal: AbortSignal.timeout(CHECK_TIMEOUT),
        });
        ok = true;
    } catch {
        ok = false;
    }
    cache.set(host, { ok, at: Date.now() });
    return ok;
}

/** Первое по порядку доступное зеркало; если недоступны все — первое из списка. */
async function resolveMirror(mirrors) {
    const hosts = mirrors.map(normalizeMirror).filter(Boolean);
    if (!hosts.length) return null;
    const results = await Promise.all(hosts.map((host) => checkMirror(host)));
    const index = results.indexOf(true);
    return hosts[index === -1 ? 0 : index];
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (!message || typeof message.type !== 'string') return false;

    if (message.type === 'openOptions') {
        chrome.runtime.openOptionsPage();
        return false;
    }
    if (message.type === 'resolveMirror' && Array.isArray(message.mirrors)) {
        resolveMirror(message.mirrors).then((host) => sendResponse({ host }));
        return true;
    }
    if (message.type === 'checkMirror') {
        const host = normalizeMirror(message.host);
        if (!host) {
            sendResponse({ ok: false });
            return false;
        }
        checkMirror(host, { force: true }).then((ok) => sendResponse({ ok }));
        return true;
    }
    return false;
});
