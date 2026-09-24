/*
 * Точка входа. Следит за адресом (Кинопоиск — SPA), дожидается данных нужного тайтла
 * и управляет кнопкой на странице (inline.js) и плавающей плашкой (widget.js).
 */
(function () {
    'use strict';

    const KPE = globalThis.KPE;
    const {
        DEFAULT_SETTINGS,
        DEFAULT_LOCAL,
        parseTitlePath,
        titleKey,
        buildWatchUrl,
        normalizeSettings,
        normalizeLocal,
        extractFilmData,
        pageIdentity,
        createWidget,
        createInlineButton,
    } = KPE;

    const POLL_INTERVAL = 100;
    // Всё основное есть — показываем сразу; нет рейтинга/описания (анонс) — ждём не дольше SOFT;
    // страница так и не обновилась — через HARD показываем то, что точно относится к этому тайтлу.
    const SOFT_TIMEOUT = 1500;
    const HARD_TIMEOUT = 5000;
    const URL_CHECK_INTERVAL = 500;

    const state = {
        url: null,
        target: null,
        token: 0,
        widget: null,
        inline: null,
        placementKnown: false, // уже пытались вставить кнопку на страницу для этого тайтла
        inlineInView: false,
        lastShown: null, // { id, title } — что показывали до SPA-перехода
        mirror: DEFAULT_SETTINGS.mirrors[0], // зеркало, на которое сейчас ведут кнопки
        settings: normalizeSettings(DEFAULT_SETTINGS),
        local: normalizeLocal(DEFAULT_LOCAL),
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

    async function storageGet(area) {
        try {
            return await chrome.storage[area].get(null);
        } catch {
            return {};
        }
    }

    async function saveLocal(patch) {
        state.local = normalizeLocal({ ...state.local, ...patch });
        try {
            await chrome.storage.local.set(patch);
        } catch {
            // Контекст расширения потерян (его обновили) — не критично.
        }
    }

    async function sendMessage(message) {
        try {
            return await chrome.runtime.sendMessage(message);
        } catch {
            return null;
        }
    }

    // ---------- Зеркало ----------

    const watchUrl = () => buildWatchUrl(state.mirror, state.target);

    /** С несколькими зеркалами и автопереключением фон проверяет доступность и возвращает рабочее. */
    async function resolveMirror(token) {
        const { mirrors, autoFallback } = state.settings;
        state.mirror = mirrors[0];
        if (!autoFallback || mirrors.length < 2) return;
        const response = await sendMessage({ type: 'resolveMirror', mirrors });
        if (token !== state.token || !response || !response.host) return;
        if (response.host !== state.mirror) {
            state.mirror = response.host;
            refreshAll();
        }
    }

    function openWatch() {
        if (!state.target) return;
        if (state.settings.openInNewTab) window.open(watchUrl(), '_blank', 'noopener,noreferrer');
        else window.location.assign(watchUrl());
    }

    // ---------- Ожидание данных ----------

    const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

    /**
     * Данные «свежие», если canonical/og:url указывает на нужный тайтл. Если их нет или сайт не обновил их
     * при SPA-переходе, ориентируемся на смену названия относительно предыдущего тайтла.
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
            const data = extractFilmData(document, target);
            const fresh = isFresh(target, data);
            const elapsed = Date.now() - startedAt;

            if (fresh && data.title && data.description && data.rating != null) return { data, fresh };
            if (fresh && data.title && elapsed >= SOFT_TIMEOUT) return { data, fresh };
            if (elapsed >= HARD_TIMEOUT) {
                // Не показываем чужие данные: оставляем только то, что точно относится к этому адресу.
                const empty = { title: '', poster: '', rating: null, duration: null, description: '', year: '' };
                return {
                    data: fresh ? data : { ...empty, kind: '', seasons: null, series: target.type === 'series' },
                    fresh,
                };
            }
            await sleep(POLL_INTERVAL);
        }
    }

    // ---------- Кнопка на странице и плашка ----------

    function isHiddenHere() {
        return Boolean(state.target && state.local.hiddenTitles.includes(titleKey(state.target)));
    }

    /** Когда видна плавающая плашка — главный переключатель поведения. */
    function floatingVisible() {
        if (!state.target || isHiddenHere()) return false;
        const { floating } = state.settings;
        if (floating === 'always') return true;
        if (!state.placementKnown) return false;
        const inlineShown = Boolean(state.inline && state.inline.isMounted());
        if (!inlineShown) return true; // кнопку вставить некуда — плашка единственный способ
        if (floating === 'never') return false;
        return !state.inlineInView;
    }

    function updateVisibility() {
        if (!state.widget) return;
        const visible = floatingVisible();
        state.widget.setVisible(visible);
        state.widget.setOnboarding(visible && !state.local.onboarded);
    }

    function ensureWidget() {
        if (state.widget) return state.widget;
        state.widget = createWidget({
            getWatchUrl: watchUrl,
            getMirror: () => state.mirror,
            getSettings: () => state.settings,
            onExpandedChange: (expanded) => saveLocal({ expanded }),
            onHideTitle: () => {
                if (!state.target) return;
                saveLocal({ hiddenTitles: [...state.local.hiddenTitles, titleKey(state.target)] });
                updateVisibility();
            },
            onOpenSettings: () => sendMessage({ type: 'openOptions' }),
            onOnboardingDone: () => saveLocal({ onboarded: true }),
        });
        return state.widget;
    }

    function ensureInline() {
        if (!state.settings.inlineButton) return null;
        if (state.inline) return state.inline;
        state.inline = createInlineButton({
            getWatchUrl: watchUrl,
            getMirror: () => state.mirror,
            getSettings: () => state.settings,
            onVisibilityChange: (inView) => {
                state.inlineInView = inView;
                updateVisibility();
            },
        });
        return state.inline;
    }

    function removeInline() {
        if (state.inline) state.inline.destroy();
        state.inline = null;
        state.inlineInView = false;
    }

    function removeAll() {
        state.token++;
        state.target = null;
        state.placementKnown = false;
        if (state.widget) state.widget.destroy();
        state.widget = null;
        removeInline();
    }

    function refreshAll() {
        if (state.widget) state.widget.refresh();
        if (state.inline) state.inline.refresh();
    }

    async function showFor(target) {
        const token = ++state.token;
        state.target = target;
        state.placementKnown = !state.settings.inlineButton;
        removeInline(); // кнопка прошлой страницы ушла вместе с её разметкой

        const widget = ensureWidget();
        widget.reset({ expanded: state.local.expanded });
        updateVisibility();
        resolveMirror(token);

        const result = await waitForData(target, token);
        if (!result || token !== state.token) return;
        state.lastShown = { id: target.id, title: result.data.title };
        widget.setData(result.data);

        const inline = result.fresh ? ensureInline() : null;
        if (inline) {
            await inline.styled;
            if (token !== state.token) return;
            inline.mount();
        }
        state.placementKnown = true;
        updateVisibility();
    }

    // ---------- Навигация ----------

    function stop() {
        state.stopped = true;
        clearInterval(state.urlTimer);
        removeAll();
    }

    function onLocationChange() {
        if (state.stopped) return;
        if (!extensionAlive()) {
            // Расширение обновили или отключили — старый скрипт больше ничего не делает.
            stop();
            return;
        }
        if (!state.settings.enabled) return;
        if (state.widget) state.widget.ensureAttached();
        if (state.inline && state.inline.ensureAttached()) updateVisibility();
        if (location.href === state.url) return;
        state.url = location.href;

        const target = parseTitlePath(location.pathname);
        if (!target) {
            removeAll();
            return;
        }
        // Переход между вкладками одного тайтла (/film/1/ → /film/1/reviews/) — всё остаётся как есть.
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

    function isEditable(node) {
        return Boolean(node && (node.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(node.tagName)));
    }

    /** Shift+W — «Смотреть». Не срабатывает при наборе текста (в том числе в поле поиска сайта). */
    function watchHotkey() {
        document.addEventListener(
            'keydown',
            (event) => {
                if (!state.settings.enabled || !state.settings.hotkey || !state.target) return;
                if (event.code !== 'KeyW' || !event.shiftKey || event.ctrlKey || event.metaKey || event.altKey) return;
                if (event.repeat || isEditable(event.composedPath()[0])) return;
                event.preventDefault();
                openWatch();
            },
            true,
        );
    }

    function applySettings(raw) {
        const previous = state.settings;
        state.settings = normalizeSettings(raw);
        const next = state.settings;

        if (previous.enabled !== next.enabled) {
            if (!next.enabled) {
                removeAll();
                state.url = null;
            } else {
                onLocationChange();
            }
            return;
        }
        if (!next.enabled) return;

        if (previous.inlineButton !== next.inlineButton && state.target) {
            // Проще всего заново пройти по текущему тайтлу.
            removeAll();
            state.url = null;
            onLocationChange();
            return;
        }
        if (previous.mirrors.join() !== next.mirrors.join() || previous.autoFallback !== next.autoFallback) {
            resolveMirror(state.token);
        }
        refreshAll();
        updateVisibility();
    }

    function watchStorage() {
        try {
            chrome.storage.onChanged.addListener((changes, area) => {
                if (state.stopped) return;
                if (area === 'sync') {
                    const next = { ...state.settings };
                    for (const [key, change] of Object.entries(changes)) next[key] = change.newValue;
                    applySettings(next);
                }
                if (area === 'local') {
                    const next = { ...state.local };
                    for (const [key, change] of Object.entries(changes)) next[key] = change.newValue;
                    state.local = normalizeLocal(next);
                    updateVisibility();
                }
            });
        } catch {
            // Нет доступа к chrome.storage — работаем с настройками по умолчанию.
        }
    }

    async function start() {
        if (window.top !== window) return;
        const [sync, local] = await Promise.all([storageGet('sync'), storageGet('local')]);
        state.settings = normalizeSettings(sync);
        state.local = normalizeLocal(local);
        watchStorage();
        watchHotkey();
        watchLocation();
        onLocationChange();
    }

    start();
})();
