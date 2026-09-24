/*
 * Кнопка «Смотреть» прямо на странице фильма — рядом со штатными кнопками Кинопоиска.
 * Пока она видна, плавающая плашка не нужна; когда страница прокручена, плашка появляется.
 */
(function (root) {
    'use strict';

    const { collapseSpaces, ui } = root.KPE;
    const { h, icon } = ui;

    const HOST_TAG = 'kinopoisk-ease-button';
    const OWN_TAGS = new Set([HOST_TAG.toUpperCase(), 'KINOPOISK-EASE-WIDGET']);

    /** Поднимается по обёрткам с единственным ребёнком: <div><button>…</button></div> → div. */
    function outermostWrapper(el) {
        let node = el;
        while (
            node.parentElement &&
            node.parentElement.childElementCount === 1 &&
            node.parentElement !== document.body
        ) {
            node = node.parentElement;
        }
        return node;
    }

    /**
     * Куда вставить кнопку. По порядку: рядом с «Буду смотреть» → в блок кнопок → после короткого
     * описания → после заголовка. Нет ничего подходящего — null (тогда работает только плавающая плашка).
     */
    function findAnchor(doc) {
        for (const el of doc.querySelectorAll('button, a, [role="button"]')) {
            if (OWN_TAGS.has(el.tagName)) continue;
            if (/^буду смотреть$/i.test(collapseSpaces(el.textContent))) {
                return { node: outermostWrapper(el), placement: 'row' };
            }
        }
        const buttons = doc.querySelector('[class*="styles_buttonsContainer"], [class*="styles_buttons__"]');
        if (buttons) return { node: buttons, placement: 'append' };
        const topText = doc.querySelector('[class^="styles_topText"]');
        if (topText) return { node: topText, placement: 'block' };
        const heading = doc.querySelector('h1[itemprop="name"], h1[class*="styles_title"]');
        if (heading) return { node: heading.closest('[class*="styles_header"]') || heading, placement: 'block' };
        return null;
    }

    /**
     * @param {object} options
     * @param {() => string} options.getWatchUrl
     * @param {() => string} options.getMirror
     * @param {() => object} options.getSettings
     * @param {(visible: boolean) => void} options.onVisibilityChange
     */
    function createInlineButton(options) {
        ui.loadFonts();

        const host = document.createElement(HOST_TAG);
        const shadow = host.attachShadow({ mode: 'open' });
        const link = h('a', { class: 'inline-cta', 'data-role': 'inline-watch', rel: 'noopener noreferrer' });
        shadow.append(link);
        ui.isolateKeys(link);

        const state = { mounted: false, inView: false, destroyed: false };
        const styled = ui.adoptStyles(shadow, ['src/inline.css']);

        const observer = new IntersectionObserver(
            (entries) => {
                const entry = entries[entries.length - 1];
                const inView = entry.isIntersecting;
                if (inView === state.inView) return;
                state.inView = inView;
                options.onVisibilityChange(inView);
            },
            // Сверху — поправка на липкую шапку сайта: кнопка под ней уже не видна.
            { threshold: 0.5, rootMargin: '-80px 0px 0px 0px' },
        );

        function refresh() {
            const settings = options.getSettings();
            const mirror = options.getMirror();
            link.href = options.getWatchUrl();
            link.target = settings.openInNewTab ? '_blank' : '_self';
            link.title = settings.hotkey ? `Смотреть на ${mirror} (Shift+W)` : `Смотреть на ${mirror}`;
            link.replaceChildren(icon('play', 16), h('span', { text: `Смотреть на ${mirror}` }));
            // Кнопка контрастна фону страницы: на светлой — тёмная, на тёмной — светлая.
            host.setAttribute('data-theme', ui.resolveTheme('auto') === 'dark' ? 'light' : 'dark');
        }

        /** Вставить кнопку на страницу; false — подходящего места нет. */
        function mount() {
            if (state.destroyed) return false;
            if (host.isConnected) return true;
            const anchor = findAnchor(document);
            if (!anchor) {
                state.mounted = false;
                return false;
            }
            refresh();
            host.setAttribute('data-placement', anchor.placement);
            if (anchor.placement === 'append') anchor.node.append(host);
            else anchor.node.after(host);
            state.mounted = true;
            observer.observe(host);
            return true;
        }

        return {
            host,
            styled,
            mount,
            refresh,
            isMounted: () => state.mounted && host.isConnected,
            isInView: () => state.inView,
            /** Кнопку выкинул перерендер сайта — вставить заново (место могло смениться). */
            ensureAttached() {
                if (!state.mounted || state.destroyed || host.isConnected) return false;
                observer.unobserve(host);
                state.inView = false;
                const attached = mount();
                if (!attached) options.onVisibilityChange(false);
                return true;
            },
            destroy() {
                state.destroyed = true;
                observer.disconnect();
                host.remove();
            },
        };
    }

    Object.assign(root.KPE, { createInlineButton, findInlineAnchor: findAnchor, INLINE_TAG: HOST_TAG });
})(globalThis);
