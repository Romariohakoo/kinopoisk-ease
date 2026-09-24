/*
 * Настройки: открываются по иконке расширения (popup) и как отдельная страница (options_ui).
 * Каждое изменение сохраняется сразу; открытые вкладки Кинопоиска подхватывают его через storage.onChanged.
 */
(function () {
    'use strict';

    const { normalizeSettings, normalizeLocal, normalizeMirror, pluralRu } = globalThis.KPE;

    const $ = (id) => document.getElementById(id);
    const CHECKBOXES = ['enabled', 'autoFallback', 'inlineButton', 'openInNewTab', 'hotkey'];
    const SELECTS = ['floating', 'position', 'theme'];

    let settings = normalizeSettings({});
    let local = normalizeLocal({});
    const statuses = new Map(); // host → 'checking' | 'ok' | 'bad'
    let savedTimer = null;

    if (new URLSearchParams(location.search).has('popup')) document.body.classList.add('popup');
    $('version').textContent = `Версия ${chrome.runtime.getManifest().version}`;

    function flashSaved() {
        $('saved').textContent = 'Сохранено';
        clearTimeout(savedTimer);
        savedTimer = setTimeout(() => {
            $('saved').textContent = '';
        }, 1500);
    }

    async function save(patch) {
        settings = normalizeSettings({ ...settings, ...patch });
        await chrome.storage.sync.set(settings);
        flashSaved();
    }

    function button(text, label, onclick, disabled = false) {
        const el = document.createElement('button');
        el.type = 'button';
        el.className = 'icon';
        el.textContent = text;
        el.title = label;
        el.setAttribute('aria-label', label);
        el.disabled = disabled;
        el.addEventListener('click', onclick);
        return el;
    }

    function move(index, delta) {
        const mirrors = [...settings.mirrors];
        const [item] = mirrors.splice(index, 1);
        mirrors.splice(index + delta, 0, item);
        save({ mirrors }).then(renderMirrors);
    }

    function renderMirrors() {
        const list = $('mirrors');
        list.replaceChildren(
            ...settings.mirrors.map((host, index) => {
                const item = document.createElement('li');
                item.className = 'mirror';
                item.dataset.host = host;

                const status = document.createElement('span');
                status.className = 'status';
                status.dataset.status = statuses.get(host) || 'unknown';
                status.title =
                    { ok: 'Доступно', bad: 'Недоступно', checking: 'Проверяем…' }[statuses.get(host)] || 'Не проверено';

                const name = document.createElement('span');
                name.className = 'mirror-host';
                name.textContent = host;

                item.append(status, name);
                if (index === 0) {
                    const badge = document.createElement('span');
                    badge.className = 'badge';
                    badge.textContent = 'основное';
                    item.append(badge);
                }
                item.append(
                    button('↑', `Поднять ${host}`, () => move(index, -1), index === 0),
                    button('↓', `Опустить ${host}`, () => move(index, 1), index === settings.mirrors.length - 1),
                    button('✕', `Удалить ${host}`, () => remove(index), settings.mirrors.length === 1),
                );
                return item;
            }),
        );
    }

    function remove(index) {
        const mirrors = settings.mirrors.filter((_, i) => i !== index);
        save({ mirrors }).then(renderMirrors);
    }

    async function check(host) {
        statuses.set(host, 'checking');
        renderMirrors();
        const response = await chrome.runtime.sendMessage({ type: 'checkMirror', host }).catch(() => null);
        statuses.set(host, response && response.ok ? 'ok' : 'bad');
        renderMirrors();
    }

    function setHint(text, isError) {
        const hint = $('add-hint');
        hint.textContent = text;
        hint.classList.toggle('is-error', Boolean(isError));
        $('add-input').setAttribute('aria-invalid', isError ? 'true' : 'false');
    }

    $('add-form').addEventListener('submit', async (event) => {
        event.preventDefault();
        const input = $('add-input');
        const host = normalizeMirror(input.value);
        if (!host) {
            setHint('Не похоже на адрес сайта. Пример: mirror.example', true);
            input.focus();
            return;
        }
        if (settings.mirrors.includes(host)) {
            setHint(`${host} уже в списке`, true);
            return;
        }
        await save({ mirrors: [...settings.mirrors, host] });
        input.value = '';
        setHint(`Добавлено: ${host}`, false);
        renderMirrors();
        check(host);
    });
    $('add-input').addEventListener('input', () => setHint('', false));
    $('check-all').addEventListener('click', () => settings.mirrors.forEach(check));

    for (const id of CHECKBOXES) $(id).addEventListener('change', (event) => save({ [id]: event.target.checked }));
    for (const id of SELECTS) $(id).addEventListener('change', (event) => save({ [id]: event.target.value }));

    function renderLocal() {
        const count = local.hiddenTitles.length;
        $('hidden-count').textContent = count
            ? `Скрыто на ${count} ${pluralRu(count, 'тайтле', 'тайтлах', 'тайтлах')}`
            : 'Скрытых тайтлов нет';
        $('unhide').disabled = count === 0;
        $('onboarding').disabled = !local.onboarded;
    }

    $('unhide').addEventListener('click', async () => {
        await chrome.storage.local.set({ hiddenTitles: [] });
        flashSaved();
    });
    $('onboarding').addEventListener('click', async () => {
        await chrome.storage.local.set({ onboarded: false });
        flashSaved();
    });

    function renderAll() {
        for (const id of CHECKBOXES) $(id).checked = settings[id];
        for (const id of SELECTS) $(id).value = settings[id];
        renderMirrors();
        renderLocal();
    }

    chrome.storage.onChanged.addListener((changes, area) => {
        if (area === 'local') {
            const next = { ...local };
            for (const [key, change] of Object.entries(changes)) next[key] = change.newValue;
            local = normalizeLocal(next);
            renderLocal();
        }
        if (area === 'sync') {
            const next = { ...settings };
            for (const [key, change] of Object.entries(changes)) next[key] = change.newValue;
            settings = normalizeSettings(next);
            renderAll();
        }
    });

    Promise.all([chrome.storage.sync.get(null), chrome.storage.local.get(null)]).then(([sync, stored]) => {
        settings = normalizeSettings(sync);
        local = normalizeLocal(stored);
        renderAll();
    });
})();
