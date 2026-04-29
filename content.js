const style = document.createElement('style');
style.textContent = `
  @font-face {
    font-family: 'Manrope';
    src: url('${chrome.runtime.getURL("fonts/Manrope/static/Manrope-Regular.ttf")}') format('truetype');
    font-weight: 400;
  }
  @font-face {
    font-family: 'Manrope';
    src: url('${chrome.runtime.getURL("fonts/Manrope/static/Manrope-Bold.ttf")}') format('truetype');
    font-weight: 700;
  }
  @font-face {
    font-family: 'Montserrat Alternates';
    src: url('${chrome.runtime.getURL("fonts/Montserrat_Alternates/MontserratAlternates-Bold.ttf")}') format('truetype');
    font-weight: 700;
  }
  @font-face {
    font-family: 'Roboto';
    src: url('${chrome.runtime.getURL("fonts/Roboto/static/Roboto-Regular.ttf")}') format('truetype');
    font-weight: 400;
  }
`;
document.head.appendChild(style);


let currentUrl = window.location.href;

window.addEventListener('load', () => {
    checkAndRenderWidget();

    const observer = new MutationObserver(() => {
        if (window.location.href !== currentUrl) {
            currentUrl = window.location.href;
            checkAndRenderWidget();
        }
    });
    observer.observe(document.body, { childList: true, subtree: true });
});

function checkAndRenderWidget() {
    const existingWidget = document.getElementById('kp-widget');

    if (!/\/film\/\d+/.test(window.location.href)) {
        if (existingWidget) existingWidget.remove();
        return;
    }

    if (existingWidget) {
        existingWidget.remove();
    }

    startWidgetLoading();
}

function startWidgetLoading() {
    const widget = document.createElement('div');
    widget.id = 'kp-widget';
    widget.className = 'widget-enter-animation';
    document.body.appendChild(widget);

    widget.innerHTML = `
        <div class="loader-container">
            <div class="spinner"></div>
            <div class="loader-title">Kinopoisk Ease</div>
        </div>
    `;

    let attempts = 0;
    const checkInterval = setInterval(() => {
        attempts++;
        const descriptionElement = document.querySelector('[class^="styles_topText"] p') || document.querySelector('[data-tid="bfd38da2"]');
        const ratingElement = document.querySelector('.film-rating-value, [class^="styles_rating"]');

        if ((descriptionElement && ratingElement) || attempts > 20) {
            clearInterval(checkInterval);
            renderFullWidget(widget);
        }
    }, 100);
}

function renderFullWidget(widget) {
    const title = document.querySelector('meta[property="og:title"]')?.content.split(' (')[0] || document.title.split(' — ')[0] || "Неизвестный фильм";

    let coverUrl = document.querySelector('.film-poster')?.src || "";
    if (coverUrl.startsWith('//')) {
        coverUrl = 'https:' + coverUrl;
    }

    const ratingElement = document.querySelector('.film-rating-value, [class^="styles_rating"]');
    const fullRating = ratingElement ? ratingElement.textContent.trim() : "—";
    const mainRating = fullRating !== "—" ? fullRating.substring(0, 3).replace('.', ',') : "—";

    const duration = document.querySelector('[data-test-id="duration"] [class^="styles_value"]')?.textContent.trim() || "";

    const descriptionElement = document.querySelector('[class^="styles_topText"] p') || document.querySelector('[data-tid="bfd38da2"]');
    const description = descriptionElement ? descriptionElement.textContent.trim() : "Описание отсутствует";

    const iconClose = `<svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M11.2106 3.37381L3.04398 11.5405M3.04395 3.37378L11.2106 11.5405" stroke="#E0E2EA" stroke-width="1.5" stroke-linecap="round"/></svg>`;
    const iconStar = `<svg width="13" height="13" viewBox="0 0 13 13" fill="none" xmlns="http://www.w3.org/2000/svg"><mask id="mask0_1062_52" style="mask-type:alpha" maskUnits="userSpaceOnUse" x="0" y="0" width="13" height="13"><rect width="13" height="13" fill="#D9D9D9"/></mask><g mask="url(#mask0_1062_52)"><path d="M3.96422 10.8867C3.6616 11.0692 3.28825 10.7984 3.3679 10.454L3.98082 7.80434C4.01421 7.65999 3.96508 7.50901 3.85313 7.41196L1.797 5.62935C1.52999 5.39785 1.67237 4.95918 2.02443 4.92861L4.74296 4.69263C4.89063 4.67981 5.01911 4.58638 5.07681 4.44985L6.13123 1.95502C6.26889 1.62931 6.73046 1.62931 6.86812 1.95502L7.92254 4.44985C7.98024 4.58638 8.10872 4.67981 8.25639 4.69263L10.9749 4.92861C11.327 4.95918 11.4694 5.39785 11.2023 5.62935L9.14621 7.41196C9.03427 7.50901 8.98514 7.65999 9.01853 7.80434L9.63145 10.454C9.7111 10.7984 9.33775 11.0692 9.03513 10.8867L6.70629 9.48185C6.57921 9.40519 6.42014 9.40519 6.29306 9.48185L3.96422 10.8867Z" fill="#E0E2EA"/></g></svg>`;
    const iconSettings = `<svg width="21" height="21" viewBox="0 0 21 21" fill="none" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" clip-rule="evenodd" d="M12.4939 1.88321C12.1699 1.75 11.7591 1.75 10.9375 1.75C10.1159 1.75 9.70506 1.75 9.38105 1.88321C8.94897 2.06083 8.6057 2.40151 8.42674 2.8303C8.34504 3.02605 8.31307 3.25369 8.30055 3.58574C8.28217 4.07372 8.03001 4.5254 7.6039 4.76956C7.17778 5.01372 6.65756 5.0046 6.22255 4.77641C5.92653 4.62114 5.7119 4.53479 5.50024 4.50714C5.03658 4.44656 4.56766 4.57125 4.19664 4.8538C3.91837 5.06571 3.71296 5.41879 3.30216 6.12494C2.89136 6.8311 2.68596 7.18417 2.64018 7.5293C2.57913 7.98945 2.70478 8.45483 2.98948 8.82306C3.11943 8.99115 3.30205 9.13237 3.58549 9.30912C4.00217 9.569 4.27028 10.0117 4.27025 10.5C4.27023 10.9883 4.00213 11.4309 3.58549 11.6907C3.302 11.8675 3.11935 12.0089 2.98939 12.1769C2.70469 12.5451 2.57905 13.0105 2.64009 13.4706C2.68587 13.8157 2.89128 14.1689 3.30207 14.875C3.71288 15.5811 3.91828 15.9343 4.19655 16.1461C4.56757 16.4286 5.03649 16.5533 5.50015 16.4928C5.71181 16.4651 5.92642 16.3788 6.22241 16.2236C6.65745 15.9954 7.17771 15.9862 7.60385 16.2304C8.02999 16.4746 8.28216 16.9263 8.30055 17.4143C8.31307 17.7463 8.34504 17.974 8.42674 18.1697C8.6057 18.5985 8.94897 18.9392 9.38105 19.1168C9.70506 19.25 10.1159 19.25 10.9375 19.25C11.7591 19.25 12.1699 19.25 12.4939 19.1168C12.926 18.9392 13.2693 18.5985 13.4482 18.1697C13.5299 17.974 13.562 17.7463 13.5745 17.4143C13.5929 16.9263 13.8449 16.4746 14.2711 16.2304C14.6972 15.9862 15.2175 15.9954 15.6525 16.2236C15.9485 16.3788 16.1631 16.4651 16.3747 16.4927C16.8384 16.5533 17.3073 16.4286 17.6783 16.1461C17.9567 15.9342 18.162 15.5811 18.5728 14.8749C18.9836 14.1688 19.189 13.8157 19.2349 13.4706C19.2958 13.0105 19.1702 12.545 18.8856 12.1768C18.7555 12.0088 18.5729 11.8674 18.2894 11.6907C17.8728 11.4309 17.6047 10.9882 17.6047 10.4999C17.6047 10.0116 17.8728 9.56909 18.2894 9.3093C18.573 9.13246 18.7556 8.99124 18.8856 8.82306C19.1703 8.45489 19.2959 7.98951 19.2349 7.52935C19.1891 7.18423 18.9837 6.83115 18.5729 6.125C18.1621 5.41885 17.9567 5.06577 17.6784 4.85386C17.3074 4.57131 16.8385 4.44662 16.3748 4.5072C16.1632 4.53485 15.9485 4.62119 15.6526 4.77645C15.2176 5.00464 14.6973 5.01377 14.2712 4.76959C13.845 4.52542 13.5929 4.0737 13.5744 3.5857C13.5619 3.25367 13.5299 3.02604 13.4482 2.8303C13.2693 2.40151 12.926 2.06083 12.4939 1.88321ZM10.9375 13.125C12.3983 13.125 13.5824 11.9498 13.5824 10.5C13.5824 9.05021 12.3983 7.875 10.9375 7.875C9.47669 7.875 8.29251 9.05021 8.29251 10.5C8.29251 11.9498 9.47669 13.125 10.9375 13.125Z" fill="white"/></svg>`;

    widget.innerHTML = `
        <div class="fade-in-content" style="width: 100%; height: 100%;">
            <div class="background">
              <div class="bg-image" style="background-image: url('${coverUrl}');"></div>
              <div class="bg-gradient"></div>
            </div>
            
            <div class="content-wrapper">
              <div class="poster-container">
                <img src="${coverUrl}" class="poster-image" alt="${title}">
                <a href="https://t.me/iamromariohakoo" target="_blank" class="poster-footer">by Romariohakoo</a>
              </div>
                
              <div class="media-wrapper">
                <div class="media-container">
                  <div class="header-container">
                    <h1 class="title">${title}</h1>
                    <div class="media-info-wrapper">
                      <div class="media-info first">
                        <p>${mainRating}</p>
                        ${iconStar}
                      </div>
                      <div class="media-info last">
                        <p>${duration}</p>
                      </div>
                    </div>
                  </div>
                  <p class="media-description">${description}</p>
                </div>
                <div class="media-button-row">
                  <button id="watch" class="button first">Смотреть</button>
                  <button id="settings" class="button icon last">${iconSettings}</button>
                </div>
              </div>
            </div>
            
            <button id="close" class="close-button">${iconClose}</button>
        </div>
    `;

    document.getElementById('watch').addEventListener('click', () => {
        const currentUrl = window.location.href;
        const newUrl = currentUrl.replace(/(kinopoisk)\.[a-z]+/i, 'sspoisk.ru');
        window.location.href = newUrl;
    });

    document.getElementById('close').addEventListener('click', () => {
        widget.style.opacity = '0';
        widget.style.transform = 'translateY(-20px) scale(0.95)';
        setTimeout(() => widget.remove(), 300);
    });
}