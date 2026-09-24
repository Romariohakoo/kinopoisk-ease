/*
 * Интерфейс плашки. Живёт в Shadow DOM: стили сайта не ломают виджет, а стили виджета — сайт.
 * Разметка собирается через createElement/textContent — данные со страницы никогда не попадают в innerHTML.
 */
(function (root) {
    'use strict';

    const { DEFAULT_SETTINGS, formatRating, formatDuration, normalizeMirror } = root.KPE;

    const HOST_TAG = 'kinopoisk-ease-widget';
    const SVG_NS = 'http://www.w3.org/2000/svg';
    const AUTHOR_URL = 'https://t.me/iamromariohakoo';

    // Шрифты объявляются на уровне документа: @font-face внутри Shadow DOM Chrome игнорирует.
    // Семейства с префиксом KPE, чтобы не конфликтовать со шрифтами самого сайта.
    const FONTS = [
        ['KPE Manrope', 'Manrope-Regular.woff2', '400'],
        ['KPE Manrope', 'Manrope-Bold.woff2', '700'],
        ['KPE Montserrat Alternates', 'MontserratAlternates-Bold.woff2', '700'],
        ['KPE Roboto', 'Roboto-Regular.woff2', '400'],
    ];

    const ICONS = {
        close: {
            size: 14,
            paths: [
                {
                    d: 'M11.2106 3.37381L3.04398 11.5405M3.04395 3.37378L11.2106 11.5405',
                    stroke: '#E0E2EA',
                    'stroke-width': '1.5',
                    'stroke-linecap': 'round',
                },
            ],
        },
        star: {
            size: 13,
            paths: [
                {
                    d: 'M3.96422 10.8867C3.6616 11.0692 3.28825 10.7984 3.3679 10.454L3.98082 7.80434C4.01421 7.65999 3.96508 7.50901 3.85313 7.41196L1.797 5.62935C1.52999 5.39785 1.67237 4.95918 2.02443 4.92861L4.74296 4.69263C4.89063 4.67981 5.01911 4.58638 5.07681 4.44985L6.13123 1.95502C6.26889 1.62931 6.73046 1.62931 6.86812 1.95502L7.92254 4.44985C7.98024 4.58638 8.10872 4.67981 8.25639 4.69263L10.9749 4.92861C11.327 4.95918 11.4694 5.39785 11.2023 5.62935L9.14621 7.41196C9.03427 7.50901 8.98514 7.65999 9.01853 7.80434L9.63145 10.454C9.7111 10.7984 9.33775 11.0692 9.03513 10.8867L6.70629 9.48185C6.57921 9.40519 6.42014 9.40519 6.29306 9.48185L3.96422 10.8867Z',
                    fill: '#E0E2EA',
                },
            ],
        },
        settings: {
            size: 21,
            paths: [
                {
                    d: 'M12.4939 1.88321C12.1699 1.75 11.7591 1.75 10.9375 1.75C10.1159 1.75 9.70506 1.75 9.38105 1.88321C8.94897 2.06083 8.6057 2.40151 8.42674 2.8303C8.34504 3.02605 8.31307 3.25369 8.30055 3.58574C8.28217 4.07372 8.03001 4.5254 7.6039 4.76956C7.17778 5.01372 6.65756 5.0046 6.22255 4.77641C5.92653 4.62114 5.7119 4.53479 5.50024 4.50714C5.03658 4.44656 4.56766 4.57125 4.19664 4.8538C3.91837 5.06571 3.71296 5.41879 3.30216 6.12494C2.89136 6.8311 2.68596 7.18417 2.64018 7.5293C2.57913 7.98945 2.70478 8.45483 2.98948 8.82306C3.11943 8.99115 3.30205 9.13237 3.58549 9.30912C4.00217 9.569 4.27028 10.0117 4.27025 10.5C4.27023 10.9883 4.00213 11.4309 3.58549 11.6907C3.302 11.8675 3.11935 12.0089 2.98939 12.1769C2.70469 12.5451 2.57905 13.0105 2.64009 13.4706C2.68587 13.8157 2.89128 14.1689 3.30207 14.875C3.71288 15.5811 3.91828 15.9343 4.19655 16.1461C4.56757 16.4286 5.03649 16.5533 5.50015 16.4928C5.71181 16.4651 5.92642 16.3788 6.22241 16.2236C6.65745 15.9954 7.17771 15.9862 7.60385 16.2304C8.02999 16.4746 8.28216 16.9263 8.30055 17.4143C8.31307 17.7463 8.34504 17.974 8.42674 18.1697C8.6057 18.5985 8.94897 18.9392 9.38105 19.1168C9.70506 19.25 10.1159 19.25 10.9375 19.25C11.7591 19.25 12.1699 19.25 12.4939 19.1168C12.926 18.9392 13.2693 18.5985 13.4482 18.1697C13.5299 17.974 13.562 17.7463 13.5745 17.4143C13.5929 16.9263 13.8449 16.4746 14.2711 16.2304C14.6972 15.9862 15.2175 15.9954 15.6525 16.2236C15.9485 16.3788 16.1631 16.4651 16.3747 16.4927C16.8384 16.5533 17.3073 16.4286 17.6783 16.1461C17.9567 15.9342 18.162 15.5811 18.5728 14.8749C18.9836 14.1688 19.189 13.8157 19.2349 13.4706C19.2958 13.0105 19.1702 12.545 18.8856 12.1768C18.7555 12.0088 18.5729 11.8674 18.2894 11.6907C17.8728 11.4309 17.6047 10.9882 17.6047 10.4999C17.6047 10.0116 17.8728 9.56909 18.2894 9.3093C18.573 9.13246 18.7556 8.99124 18.8856 8.82306C19.1703 8.45489 19.2959 7.98951 19.2349 7.52935C19.1891 7.18423 18.9837 6.83115 18.5729 6.125C18.1621 5.41885 17.9567 5.06577 17.6784 4.85386C17.3074 4.57131 16.8385 4.44662 16.3748 4.5072C16.1632 4.53485 15.9485 4.62119 15.6526 4.77645C15.2176 5.00464 14.6973 5.01377 14.2712 4.76959C13.845 4.52542 13.5929 4.0737 13.5744 3.5857C13.5619 3.25367 13.5299 3.02604 13.4482 2.8303C13.2693 2.40151 12.926 2.06083 12.4939 1.88321ZM10.9375 13.125C12.3983 13.125 13.5824 11.9498 13.5824 10.5C13.5824 9.05021 12.3983 7.875 10.9375 7.875C9.47669 7.875 8.29251 9.05021 8.29251 10.5C8.29251 11.9498 9.47669 13.125 10.9375 13.125Z',
                    fill: 'white',
                    'fill-rule': 'evenodd',
                    'clip-rule': 'evenodd',
                },
            ],
        },
        play: {
            size: 14,
            paths: [
                {
                    d: 'M4 2.6v8.8c0 .6.66.97 1.17.64l6.84-4.4a.76.76 0 0 0 0-1.28L5.17 1.96A.76.76 0 0 0 4 2.6Z',
                    fill: 'white',
                },
            ],
        },
        expand: {
            size: 16,
            paths: [
                {
                    d: 'M9.5 2.75h3.75V6.5M6.5 13.25H2.75V9.5M13.25 2.75 9 7M2.75 13.25 7 9',
                    stroke: 'white',
                    'stroke-width': '1.5',
                    'stroke-linecap': 'round',
                    'stroke-linejoin': 'round',
                },
            ],
        },
    };

    let fontsRequested = false;
    let sheetPromise = null;

    function loadFonts() {
        if (fontsRequested || typeof FontFace !== 'function') return;
        fontsRequested = true;
        for (const [family, file, weight] of FONTS) {
            const source = `url("${chrome.runtime.getURL(`fonts/${file}`)}") format("woff2")`;
            const face = new FontFace(family, source, { weight, style: 'normal', display: 'swap' });
            document.fonts.add(face);
            face.load().catch(() => {});
        }
    }

    function loadStyleSheet() {
        if (!sheetPromise) {
            sheetPromise = fetch(chrome.runtime.getURL('src/widget.css'))
                .then((response) => response.text())
                .then((css) => {
                    const sheet = new CSSStyleSheet();
                    sheet.replaceSync(css);
                    return sheet;
                });
            sheetPromise.catch(() => {
                sheetPromise = null;
            });
        }
        return sheetPromise;
    }

    function h(tag, props, ...children) {
        const el = document.createElement(tag);
        for (const [key, value] of Object.entries(props || {})) {
            if (value == null || value === false) continue;
            if (key === 'class') el.className = value;
            else if (key === 'text') el.textContent = value;
            else if (key.startsWith('on')) el.addEventListener(key.slice(2), value);
            else el.setAttribute(key, value === true ? '' : String(value));
        }
        el.append(...children.flat().filter((child) => child != null && child !== false));
        return el;
    }

    function icon(name) {
        const { size, paths } = ICONS[name];
        const svg = document.createElementNS(SVG_NS, 'svg');
        svg.setAttribute('width', size);
        svg.setAttribute('height', size);
        svg.setAttribute('viewBox', `0 0 ${size} ${size}`);
        svg.setAttribute('fill', 'none');
        svg.setAttribute('aria-hidden', 'true');
        svg.setAttribute('focusable', 'false');
        for (const attrs of paths) {
            const path = document.createElementNS(SVG_NS, 'path');
            for (const [key, value] of Object.entries(attrs)) path.setAttribute(key, value);
            svg.append(path);
        }
        return svg;
    }

    function animationDone(el) {
        return new Promise((resolve) => {
            const name = getComputedStyle(el).animationName;
            if (!name || name === 'none') {
                resolve();
                return;
            }
            const timer = setTimeout(resolve, 700);
            el.addEventListener(
                'animationend',
                () => {
                    clearTimeout(timer);
                    resolve();
                },
                { once: true },
            );
        });
    }

    /**
     * @param {object} options
     * @param {() => string} options.getWatchUrl
     * @param {() => {mirror: string, openInNewTab: boolean}} options.getSettings
     * @param {(settings: object) => Promise<void>} options.saveSettings
     * @param {(collapsed: boolean) => void} options.onCollapsedChange
     */
    function createWidget(options) {
        loadFonts();

        const state = {
            view: null, // что сейчас на экране: 'loading' | 'card' | 'collapsed'
            collapsed: false,
            data: null,
            renderedData: null,
            settingsOpen: false,
            mounted: false,
            destroyed: false,
        };
        let queue = Promise.resolve();

        const host = document.createElement(HOST_TAG);
        const shadow = host.attachShadow({ mode: 'open' });
        const stage = h('div', { class: 'stage' });
        shadow.append(stage);

        // Горячие клавиши сайта не должны перехватывать ввод в поле настроек.
        for (const type of ['keydown', 'keyup', 'keypress']) {
            stage.addEventListener(type, (event) => event.stopPropagation());
        }
        stage.addEventListener('keydown', (event) => {
            if (event.key !== 'Escape') return;
            if (state.settingsOpen) closeSettings();
            else if (state.view === 'card') setCollapsed(true);
        });

        const styled = loadStyleSheet()
            .then((sheet) => {
                shadow.adoptedStyleSheets = [sheet];
            })
            .catch(() => {
                shadow.prepend(h('link', { rel: 'stylesheet', href: chrome.runtime.getURL('src/widget.css') }));
            })
            .then(() => {
                if (state.destroyed) return;
                state.mounted = true;
                attach();
            });

        function attach() {
            (document.body || document.documentElement).append(host);
        }

        function watchLinkProps(className) {
            const settings = options.getSettings();
            return {
                class: className,
                href: options.getWatchUrl(),
                target: settings.openInNewTab ? '_blank' : '_self',
                rel: 'noopener noreferrer',
                'data-role': 'watch',
            };
        }

        function renderLoading() {
            return h(
                'div',
                { class: 'surface loading', role: 'status', 'aria-label': 'Kinopoisk Ease: загрузка' },
                h('div', { class: 'spinner' }),
            );
        }

        function renderCollapsed() {
            return h(
                'div',
                { class: 'surface pill', role: 'region', 'aria-label': 'Kinopoisk Ease' },
                h(
                    'div',
                    { class: 'button-row' },
                    h('a', watchLinkProps('button first'), icon('play'), h('span', { text: 'Смотреть' })),
                    h(
                        'button',
                        {
                            type: 'button',
                            class: 'button icon last',
                            'aria-label': 'Развернуть',
                            title: 'Развернуть',
                            'data-role': 'expand',
                            onclick: () => setCollapsed(false),
                        },
                        icon('expand'),
                    ),
                ),
            );
        }

        function renderInfo(data) {
            const chips = [];
            if (data.rating != null) {
                chips.push(
                    h(
                        'div',
                        { class: 'chip', 'data-role': 'rating', title: 'Рейтинг Кинопоиска' },
                        h('span', { text: formatRating(data.rating) }),
                        icon('star'),
                    ),
                );
            }
            if (data.duration) {
                chips.push(
                    h(
                        'div',
                        { class: 'chip', 'data-role': 'duration', title: 'Длительность' },
                        h('span', { text: formatDuration(data.duration) }),
                    ),
                );
            }
            return h(
                'div',
                { class: 'media-container' },
                h(
                    'div',
                    { class: 'header' },
                    h('h2', { class: 'title', 'data-role': 'title', text: data.title || 'Без названия' }),
                    chips.length ? h('div', { class: 'chips' }, chips) : null,
                ),
                data.description
                    ? h('p', { class: 'description', 'data-role': 'description', text: data.description })
                    : null,
            );
        }

        function renderButtons() {
            return h(
                'div',
                { class: 'button-row' },
                h('a', watchLinkProps('button first'), h('span', { text: 'Смотреть' })),
                h(
                    'button',
                    {
                        type: 'button',
                        class: 'button icon last',
                        'aria-label': 'Настройки',
                        title: 'Настройки',
                        'data-role': 'settings',
                        onclick: openSettings,
                    },
                    icon('settings'),
                ),
            );
        }

        function renderSettings() {
            const settings = options.getSettings();
            const hintId = 'kpe-mirror-hint';
            const mirror = h('input', {
                class: 'input',
                id: 'kpe-mirror',
                name: 'mirror',
                type: 'text',
                inputmode: 'url',
                autocomplete: 'off',
                autocapitalize: 'off',
                spellcheck: 'false',
                placeholder: DEFAULT_SETTINGS.mirror,
                'aria-describedby': hintId,
            });
            mirror.value = settings.mirror;
            const newTab = h('input', { type: 'checkbox', name: 'openInNewTab', class: 'checkbox-input' });
            newTab.checked = settings.openInNewTab;
            const hint = h('p', {
                class: 'hint',
                id: hintId,
                'aria-live': 'polite',
                text: `Сайт, который открывает кнопка «Смотреть». Пусто — ${DEFAULT_SETTINGS.mirror}`,
            });

            const form = h(
                'form',
                { class: 'settings', novalidate: true, 'aria-label': 'Настройки Kinopoisk Ease' },
                h('h2', { class: 'title', text: 'Настройки' }),
                h(
                    'div',
                    { class: 'field' },
                    h('label', { class: 'label', for: 'kpe-mirror', text: 'Зеркало для просмотра' }),
                    mirror,
                    hint,
                ),
                h('label', { class: 'checkbox' }, newTab, h('span', { text: 'Открывать в новой вкладке' })),
                h(
                    'div',
                    { class: 'button-row' },
                    h('button', { type: 'submit', class: 'button first', 'data-role': 'save', text: 'Сохранить' }),
                    h('button', {
                        type: 'button',
                        class: 'button last text',
                        'data-role': 'cancel',
                        text: 'Отмена',
                        onclick: closeSettings,
                    }),
                ),
            );

            form.addEventListener('submit', async (event) => {
                event.preventDefault();
                const raw = mirror.value.trim();
                const normalized = raw ? normalizeMirror(raw) : DEFAULT_SETTINGS.mirror;
                if (!normalized) {
                    mirror.setAttribute('aria-invalid', 'true');
                    hint.classList.add('is-error');
                    hint.textContent = 'Не похоже на адрес сайта. Пример: sspoisk.ru';
                    mirror.focus();
                    return;
                }
                await options.saveSettings({ mirror: normalized, openInNewTab: newTab.checked });
                closeSettings();
            });
            mirror.addEventListener('input', () => {
                mirror.removeAttribute('aria-invalid');
                hint.classList.remove('is-error');
            });
            return form;
        }

        function renderCard(data) {
            const bgImage = h('div', { class: 'bg-image' });
            if (data.poster) bgImage.style.backgroundImage = `url(${JSON.stringify(data.poster)})`;

            const poster = data.poster
                ? h('img', {
                      class: 'poster-image',
                      src: data.poster,
                      alt: data.title ? `Постер: ${data.title}` : 'Постер',
                      referrerpolicy: 'no-referrer',
                      decoding: 'async',
                  })
                : h('div', { class: 'poster-image poster-placeholder', 'aria-hidden': 'true' }, icon('play'));

            return h(
                'section',
                { class: 'surface card', role: 'region', 'aria-label': `Kinopoisk Ease: ${data.title || 'фильм'}` },
                h('div', { class: 'background', 'aria-hidden': 'true' }, bgImage, h('div', { class: 'bg-gradient' })),
                h(
                    'div',
                    { class: 'content' },
                    h(
                        'div',
                        { class: 'poster-container' },
                        poster,
                        h('a', {
                            class: 'poster-footer',
                            href: AUTHOR_URL,
                            target: '_blank',
                            rel: 'noopener noreferrer',
                            text: 'by Romariohakoo',
                        }),
                    ),
                    h(
                        'div',
                        { class: 'media-wrapper', 'data-role': 'body' },
                        state.settingsOpen ? renderSettings() : [renderInfo(data), renderButtons()],
                    ),
                ),
                h(
                    'button',
                    {
                        type: 'button',
                        class: 'close-button',
                        'aria-label': 'Свернуть',
                        title: 'Свернуть',
                        'data-role': 'collapse',
                        onclick: () => setCollapsed(true),
                    },
                    icon('close'),
                ),
            );
        }

        function currentSurface() {
            return stage.querySelector('.surface:not(.is-leaving)');
        }

        function desiredView() {
            if (state.collapsed) return 'collapsed';
            return state.data ? 'card' : 'loading';
        }

        /**
         * Привести экран к текущему состоянию. Смены выполняются по очереди, а вид выбирается
         * в момент выполнения — быстрые переключения схлопываются, анимации не накладываются.
         */
        function update() {
            queue = queue.then(async () => {
                await styled;
                if (state.destroyed) return;

                const view = desiredView();
                const previous = currentSurface();
                if (previous && state.view === view && (view !== 'card' || state.renderedData === state.data)) return;

                const next =
                    view === 'loading'
                        ? renderLoading()
                        : view === 'collapsed'
                          ? renderCollapsed()
                          : renderCard(state.data);
                next.dataset.view = view;

                // Загрузка ↔ содержимое — мягкая подмена на месте; свернуть/развернуть — уезжает и въезжает.
                const inPlace = previous && (state.view === 'loading' || view === 'loading');
                if (previous && !inPlace) {
                    previous.classList.add('is-leaving');
                    await animationDone(previous);
                    if (state.destroyed) return;
                }
                if (previous) previous.remove();

                next.classList.add(inPlace ? 'is-fading-in' : 'is-entering');
                stage.append(next);
                state.view = view;
                state.renderedData = view === 'card' ? state.data : null;
            });
            return queue;
        }

        function setCollapsed(collapsed) {
            if (state.collapsed === collapsed) return queue;
            state.collapsed = collapsed;
            state.settingsOpen = false;
            options.onCollapsedChange(collapsed);
            return update();
        }

        function replaceBody() {
            const body = stage.querySelector('.card [data-role="body"]');
            if (!body) return;
            body.replaceChildren(
                ...(state.settingsOpen ? [renderSettings()] : [renderInfo(state.data), renderButtons()]),
            );
            const focusTarget = state.settingsOpen
                ? body.querySelector('input[name="mirror"]')
                : body.querySelector('[data-role="settings"]');
            if (focusTarget) focusTarget.focus();
        }

        function openSettings() {
            state.settingsOpen = true;
            replaceBody();
        }

        function closeSettings() {
            state.settingsOpen = false;
            replaceBody();
        }

        /** Настройки поменялись (в этой или другой вкладке) — обновить ссылки «Смотреть». */
        function refreshLinks() {
            const settings = options.getSettings();
            for (const link of stage.querySelectorAll('a[data-role="watch"]')) {
                link.href = options.getWatchUrl();
                link.target = settings.openInNewTab ? '_blank' : '_self';
            }
        }

        return {
            host,
            /** Открыта страница другого фильма: забыть старые данные и показать загрузку (или свёрнутую плашку). */
            reset({ collapsed }) {
                state.data = null;
                state.collapsed = collapsed;
                state.settingsOpen = false;
                refreshLinks();
                return update();
            },
            setData(data) {
                state.data = data;
                return update();
            },
            setCollapsed,
            refreshLinks,
            /** Сайт перерисовал body и выкинул плашку — вернуть её на место. */
            ensureAttached() {
                if (state.mounted && !state.destroyed && !host.isConnected) attach();
            },
            destroy({ animate = true } = {}) {
                state.data = null;
                queue = queue.then(async () => {
                    if (state.destroyed) return;
                    const surface = currentSurface();
                    if (surface && animate && host.isConnected) {
                        surface.classList.add('is-leaving');
                        await animationDone(surface);
                    }
                    state.destroyed = true;
                    host.remove();
                });
                return queue;
            },
        };
    }

    Object.assign(root.KPE, { createWidget, HOST_TAG });
})(globalThis);
