/*
 * Точка входа. Следит за адресом (Кинопоиск — SPA), дожидается данных нужного фильма
 * и управляет плашкой из widget.js.
 */
(function () {
    'use strict';

    const KPE = globalThis.KPE;
    const {
        DEFAULT_SETTINGS,
        parseTitlePath,
        buildWatchUrl,
        normalizeMirror,
        extractFilmData,
        pageIdentity,
        createWidget,
    } = KPE;

    const POLL_INTERVAL = 100;
    // Всё основное есть — показываем сразу; нет рейтинга/описания (анонс) — ждём не дольше SOFT;
    // страница так и не обновилась — через HARD показываем то, что точно относится к этому фильму.
    const SOFT_TIMEOUT = 1500;
    const HARD_TIMEOUT = 5000;
    const URL_CHECK_INTERVAL = 500;

    const state = {
        url: null,
        target: null,
        token: 0,
        widget: null,
        lastShown: null, // { id, title } — что показывали до SPA-перехода
        settings: { ...DEFAULT_SETTINGS },
        collapsed: false,
        stopped: false,
        urlTimer: null,
    };

    // ---------- Хранилище ----------

    function extensionAlive() {
        try {
            return Boolean(chrome.runtime && chrome.runtime.id);
        } catch {
            return false;
        }
    }

    async function storageGet(area, defaults) {
        try {
            return { ...defaults, ...(await chrome.storage[area].get(defaults)) };
        } catch {
            return { ...defaults };
        }
    }

    async function storageSet(area, values) {
        try {
            await chrome.storage[area].set(values);
        } catch {
            // Контекст расширения потерян (его обновили) — не критично.
        }
    }

    function applySettings(raw) {
        state.settings = {
            mirror: normalizeMirror(raw.mirror) || DEFAULT_SETTINGS.mirror,
            openInNewTab: Boolean(raw.openInNewTab),
        };
    }

    async function loadPreferences() {
        const [settings, ui] = await Promise.all([
            storageGet('sync', DEFAULT_SETTINGS),
            storageGet('local', { collapsed: false }),
        ]);
        applySettings(settings);
        state.collapsed = Boolean(ui.collapsed);
    }

    // ---------- Ожидание данных ----------

    const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

    /**
     * Данные «свежие», если canonical/og:url указывает на нужный фильм. Если их нет или сайт не обновил их
     * при SPA-переходе, ориентируемся на смену названия относительно предыдущего фильма.
     */
    function isFresh(target, data) {
        const identity = pageIdentity(document);
        if (identity && identity.id === target.id) return true;
        const previous = state.lastShown;
        if (!previous || previous.id === target.id) return true;
        return Boolean(data.title) && data.title !== previous.title;
    }

    async function waitForData(target, token) {
        const startedAt = Date.now();
        for (;;) {
            if (token !== state.token) return null;
            const data = extractFilmData(document);
            const fresh = isFresh(target, data);
            const elapsed = Date.now() - startedAt;

            if (fresh && data.title && data.description && data.rating != null) return data;
            if (fresh && data.title && elapsed >= SOFT_TIMEOUT) return data;
            if (elapsed >= HARD_TIMEOUT) {
                // Не показываем чужое описание: оставляем только то, что точно относится к этому адресу.
                return fresh ? data : { title: '', poster: '', rating: null, duration: null, description: '' };
            }
            await sleep(POLL_INTERVAL);
        }
    }

    // ---------- Плашка ----------

    function ensureWidget() {
        if (state.widget) return state.widget;
        state.widget = createWidget({
            getWatchUrl: () => buildWatchUrl(state.settings.mirror, state.target),
            getSettings: () => state.settings,
            async saveSettings(settings) {
                applySettings(settings);
                state.widget.refreshLinks();
                await storageSet('sync', state.settings);
            },
            onCollapsedChange(collapsed) {
                state.collapsed = collapsed;
                storageSet('local', { collapsed });
            },
        });
        return state.widget;
    }

    function removeWidget() {
        state.token++;
        state.target = null;
        if (state.widget) {
            state.widget.destroy();
            state.widget = null;
        }
    }

    async function showFor(target) {
        const token = ++state.token;
        state.target = target;
        const widget = ensureWidget();
        widget.reset({ collapsed: state.collapsed });

        const data = await waitForData(target, token);
        if (!data || token !== state.token) return;
        state.lastShown = { id: target.id, title: data.title };
        widget.setData(data);
    }

    // ---------- Навигация ----------

    function stop() {
        state.stopped = true;
        clearInterval(state.urlTimer);
        removeWidget();
    }

    function onLocationChange() {
        if (state.stopped) return;
        if (!extensionAlive()) {
            // Расширение обновили или отключили — старый скрипт больше ничего не делает.
            stop();
            return;
        }
        if (state.widget) state.widget.ensureAttached();
        if (location.href === state.url) return;
        state.url = location.href;

        const target = parseTitlePath(location.pathname);
        if (!target) {
            removeWidget();
            return;
        }
        // Переход между вкладками одного фильма (/film/1/ → /film/1/reviews/) — плашка остаётся как есть.
        if (state.widget && state.target && state.target.id === target.id && state.target.type === target.type) return;
        showFor(target);
    }

    function watchLocation() {
        // Navigation API сообщает о pushState/replaceState сразу; интервал — страховка для браузеров без него.
        if (window.navigation && typeof window.navigation.addEventListener === 'function') {
            window.navigation.addEventListener('currententrychange', onLocationChange);
        }
        window.addEventListener('popstate', onLocationChange);
        state.urlTimer = setInterval(onLocationChange, URL_CHECK_INTERVAL);
    }

    function watchStorage() {
        try {
            chrome.storage.onChanged.addListener((changes, area) => {
                if (area !== 'sync' || state.stopped) return;
                const next = { ...state.settings };
                for (const key of Object.keys(DEFAULT_SETTINGS)) {
                    if (changes[key]) next[key] = changes[key].newValue;
                }
                applySettings(next);
                if (state.widget) state.widget.refreshLinks();
            });
        } catch {
            // Нет доступа к chrome.storage — работаем с настройками по умолчанию.
        }
    }

    async function start() {
        if (window.top !== window) return;
        await loadPreferences();
        watchStorage();
        watchLocation();
        onLocationChange();
    }

    start();
})();
