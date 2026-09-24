/*
 * Плавающая плашка. Живёт в Shadow DOM: стили сайта её не ломают, а её стили не трогают сайт.
 * Одна «поверхность» с тремя видами — скелетон, компактный и развёрнутый; между ними она плавно перетекает.
 */
(function (root) {
    'use strict';

    const { formatRating, ratingTone, formatDuration, formatSeasons, ui } = root.KPE;
    const { h, icon } = ui;

    const HOST_TAG = 'kinopoisk-ease-widget';
    const MORPH = { duration: 280, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)' };

    /**
     * @param {object} options
     * @param {() => string} options.getWatchUrl
     * @param {() => string} options.getMirror       — домен зеркала для подписи на кнопке
     * @param {() => object} options.getSettings
     * @param {(expanded: boolean) => void} options.onExpandedChange
     * @param {() => void} options.onHideTitle
     * @param {() => void} options.onOpenSettings
     * @param {() => void} options.onOnboardingDone
     */
    function createWidget(options) {
        ui.loadFonts();

        const state = {
            data: null,
            expanded: false,
            visible: false,
            onboarding: false,
            accent: null,
            mounted: false,
            destroyed: false,
        };

        const host = document.createElement(HOST_TAG);
        host.setAttribute('data-hidden', '');
        const shadow = host.attachShadow({ mode: 'open' });
        const stage = h('div', { class: 'stage' });
        const surface = h('div', { class: 'surface', role: 'region' });
        stage.append(surface);
        shadow.append(stage);
        stage.inert = true;

        ui.isolateKeys(stage);
        stage.addEventListener('keydown', (event) => {
            if (event.key === 'Escape' && state.expanded) setExpanded(false);
        });

        const styled = ui.adoptStyles(shadow, ['src/widget.css']).then(() => {
            if (state.destroyed) return;
            state.mounted = true;
            attach();
        });

        function attach() {
            (document.body || document.documentElement).append(host);
        }

        // ---------- Части ----------

        function watchLink({ wide }) {
            const settings = options.getSettings();
            const mirror = options.getMirror();
            return h(
                'a',
                {
                    class: wide ? 'cta cta-wide' : 'cta',
                    href: options.getWatchUrl(),
                    target: settings.openInNewTab ? '_blank' : '_self',
                    rel: 'noopener noreferrer',
                    title: settings.hotkey ? `Смотреть на ${mirror} (Shift+W)` : `Смотреть на ${mirror}`,
                    'data-role': 'watch',
                },
                icon('play'),
                h('span', { class: 'cta-label', text: wide ? `Смотреть на ${mirror}` : 'Смотреть' }),
            );
        }

        function iconButton(role, label, iconName, onclick, extra = {}) {
            return h(
                'button',
                {
                    type: 'button',
                    class: 'icon-btn',
                    'aria-label': label,
                    title: label,
                    'data-role': role,
                    onclick,
                    ...extra,
                },
                icon(iconName),
            );
        }

        /** На верхней позиции плашка раскрывается вниз — стрелки переворачиваются. */
        function arrows() {
            const top = options.getSettings().position === 'top-right';
            return { open: top ? 'chevronDown' : 'chevronUp', close: top ? 'chevronUp' : 'chevronDown' };
        }

        function poster(data, className) {
            if (!data || !data.poster) {
                return h('div', { class: `${className} is-empty`, 'aria-hidden': 'true' }, icon('play'));
            }
            return h('img', {
                class: className,
                src: data.poster,
                alt: data.title ? `Постер: ${data.title}` : 'Постер',
                referrerpolicy: 'no-referrer',
                decoding: 'async',
            });
        }

        function durationChip(data, perEpisode) {
            return h('span', {
                class: 'chip',
                'data-role': 'duration',
                title: perEpisode ? 'Длительность серии' : 'Длительность',
                text: formatDuration(data.duration, { perEpisode }),
            });
        }

        function ratingChip(data, size) {
            return h(
                'span',
                {
                    class: `chip rating tone-${ratingTone(data.rating)}`,
                    'data-role': 'rating',
                    title: 'Рейтинг Кинопоиска',
                },
                icon('star', size),
                h('span', { text: formatRating(data.rating) }),
            );
        }

        /** Компактная строка: цветной рейтинг и «2011–2019 · 8 сезонов» обычным текстом с многоточием. */
        function compactMeta(data) {
            const rest = [data.year, data.seasons ? formatSeasons(data.seasons) : ''];
            if (!data.seasons && data.duration) rest.push(formatDuration(data.duration, { perEpisode: data.series }));
            const text = rest.filter(Boolean).join(' · ');
            return [
                data.rating != null ? ratingChip(data, 11) : null,
                text ? h('span', { class: 'meta-text', title: text, text }) : null,
            ];
        }

        function chips(data) {
            const parts = [];
            if (data.rating != null) parts.push(ratingChip(data, 12));
            if (data.kind) parts.push(h('span', { class: 'chip', 'data-role': 'kind', text: data.kind }));
            if (data.year) parts.push(h('span', { class: 'chip', 'data-role': 'year', text: data.year }));
            if (data.seasons) {
                parts.push(h('span', { class: 'chip', 'data-role': 'seasons', text: formatSeasons(data.seasons) }));
            }
            if (data.duration) parts.push(durationChip(data, data.series));
            return parts;
        }

        function renderSkeleton() {
            return h(
                'div',
                { class: 'view compact is-loading', 'aria-busy': 'true' },
                h('div', { class: 'thumb skeleton' }),
                h(
                    'div',
                    { class: 'info', 'aria-hidden': 'true' },
                    h('div', { class: 'skeleton line line-title' }),
                    h('div', { class: 'skeleton line line-meta' }),
                ),
                watchLink({ wide: false }),
                h('span', { class: 'sr-only', role: 'status', text: 'Загружаем данные о фильме' }),
            );
        }

        function renderCompact(data) {
            return h(
                'div',
                { class: 'view compact' },
                poster(data, 'thumb'),
                h(
                    'div',
                    { class: 'info' },
                    h('div', {
                        class: 'name',
                        'data-role': 'title',
                        title: data.title,
                        text: data.title || 'Без названия',
                    }),
                    h('div', { class: 'meta', 'data-role': 'meta' }, compactMeta(data)),
                ),
                watchLink({ wide: false }),
                iconButton('expand', 'Подробнее', arrows().open, () => setExpanded(true), { 'aria-expanded': 'false' }),
            );
        }

        function renderExpanded(data) {
            const settings = options.getSettings();
            return h(
                'div',
                { class: 'view expanded' },
                h(
                    'div',
                    { class: 'head' },
                    poster(data, 'poster'),
                    h(
                        'div',
                        { class: 'head-info' },
                        h('h2', { class: 'title', 'data-role': 'title', text: data.title || 'Без названия' }),
                        h('div', { class: 'chips' }, chips(data)),
                        data.description
                            ? h('p', { class: 'description', 'data-role': 'description', text: data.description })
                            : null,
                    ),
                ),
                h(
                    'div',
                    { class: 'actions' },
                    watchLink({ wide: true }),
                    iconButton('settings', 'Настройки', 'settings', options.onOpenSettings),
                ),
                h(
                    'div',
                    { class: 'footer' },
                    h('button', {
                        type: 'button',
                        class: 'link-btn',
                        'data-role': 'hide',
                        text: 'Скрыть на этом тайтле',
                        onclick: options.onHideTitle,
                    }),
                    settings.hotkey ? h('span', { class: 'hint', text: 'Shift+W — смотреть' }) : null,
                ),
                iconButton('collapse', 'Свернуть', arrows().close, () => setExpanded(false), {
                    'aria-expanded': 'true',
                    class: 'icon-btn corner',
                }),
            );
        }

        function renderOnboarding() {
            return h(
                'div',
                {
                    class: 'onboarding',
                    role: 'dialog',
                    'aria-label': 'Подсказка Kinopoisk Ease',
                    'data-role': 'onboarding',
                },
                h('p', { class: 'onboarding-title', text: 'Kinopoisk Ease' }),
                h(
                    'ul',
                    null,
                    h('li', { text: '«Смотреть» открывает фильм на зеркале' }),
                    h('li', { text: 'Стрелка — подробности: рейтинг, описание' }),
                    options.getSettings().hotkey ? h('li', { text: 'Shift+W — смотреть с клавиатуры' }) : null,
                    h('li', { text: 'Настройки и зеркала — в иконке расширения' }),
                ),
                h('button', {
                    type: 'button',
                    class: 'onboarding-ok',
                    'data-role': 'onboarding-ok',
                    text: 'Понятно',
                    onclick: () => {
                        state.onboarding = false;
                        renderOnboardingState();
                        options.onOnboardingDone();
                    },
                }),
            );
        }

        // ---------- Отрисовка ----------

        function canAnimate() {
            return host.isConnected && state.visible && !ui.prefersReducedMotion();
        }

        /** Перерисовать поверхность; при morph — плавно перетечь из старого размера в новый (FLIP). */
        function render({ morph = false, focus = null } = {}) {
            const before = morph && canAnimate() ? surface.getBoundingClientRect() : null;
            let view = renderSkeleton();
            if (state.data) view = state.expanded ? renderExpanded(state.data) : renderCompact(state.data);

            const image = h('div', { class: 'backdrop-image' });
            if (state.data && state.data.poster)
                image.style.backgroundImage = `url(${JSON.stringify(state.data.poster)})`;
            const backdrop = h('div', { class: 'backdrop', 'aria-hidden': 'true' }, image, h('div', { class: 'glow' }));

            const title = state.data && state.data.title;
            surface.className = `surface ${state.expanded && state.data ? 'is-expanded' : 'is-compact'}`;
            surface.setAttribute('aria-label', title ? `Kinopoisk Ease: ${title}` : 'Kinopoisk Ease');
            surface.style.setProperty('--accent', state.accent || 'transparent');
            surface.replaceChildren(backdrop, view);

            if (before) {
                const after = surface.getBoundingClientRect();
                for (const animation of surface.getAnimations()) animation.cancel();
                surface.animate(
                    [
                        { width: `${before.width}px`, height: `${before.height}px` },
                        { width: `${after.width}px`, height: `${after.height}px` },
                    ],
                    MORPH,
                );
                view.animate([{ opacity: 0 }, { opacity: 1 }], {
                    duration: 200,
                    delay: 90,
                    easing: 'ease-out',
                    fill: 'backwards',
                });
            }
            if (focus) {
                const target = surface.querySelector(`[data-role="${focus}"]`);
                if (target) target.focus();
            }
        }

        function renderOnboardingState() {
            const current = stage.querySelector('.onboarding');
            if (state.onboarding && state.visible && !current) stage.prepend(renderOnboarding());
            if ((!state.onboarding || !state.visible) && current) current.remove();
        }

        function setExpanded(expanded) {
            if (state.expanded === expanded) return;
            state.expanded = expanded;
            options.onExpandedChange(expanded);
            render({ morph: true, focus: expanded ? 'collapse' : 'expand' });
        }

        function applyAppearance() {
            const settings = options.getSettings();
            host.setAttribute('data-position', settings.position);
            host.setAttribute('data-theme', ui.resolveTheme(settings.theme));
        }

        applyAppearance();
        render();

        return {
            host,
            /** Открыт другой тайтл: скелетон с уже рабочей кнопкой «Смотреть». */
            reset({ expanded }) {
                state.data = null;
                state.accent = null;
                state.expanded = expanded;
                applyAppearance();
                render();
            },
            setData(data) {
                const wasLoading = !state.data;
                state.data = data;
                applyAppearance();
                render({ morph: wasLoading });
                ui.extractAccent(data.poster).then((accent) => {
                    if (state.data !== data || !accent) return;
                    state.accent = accent;
                    surface.style.setProperty('--accent', accent);
                });
            },
            setExpanded,
            setVisible(visible) {
                if (state.visible === visible) return;
                state.visible = visible;
                styled.then(() => {
                    if (state.visible !== visible || state.destroyed) return;
                    if (visible) host.removeAttribute('data-hidden');
                    else host.setAttribute('data-hidden', '');
                    stage.inert = !visible;
                    renderOnboardingState();
                });
            },
            setOnboarding(show) {
                state.onboarding = show;
                renderOnboardingState();
            },
            /** Настройки поменялись: тема, позиция, подписи и ссылки. */
            refresh() {
                applyAppearance();
                render();
            },
            /** Сайт перерисовал body и выкинул плашку — вернуть её на место. */
            ensureAttached() {
                if (state.mounted && !state.destroyed && !host.isConnected) attach();
            },
            destroy() {
                if (state.destroyed) return;
                state.destroyed = true;
                if (!host.isConnected || !state.visible || ui.prefersReducedMotion()) {
                    host.remove();
                    return;
                }
                host.setAttribute('data-hidden', '');
                stage.inert = true;
                setTimeout(() => host.remove(), 250);
            },
        };
    }

    Object.assign(root.KPE, { createWidget, WIDGET_TAG: HOST_TAG });
})(globalThis);
