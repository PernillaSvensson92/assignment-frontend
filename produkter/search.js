/* =========================================================
   SÖK – search.js
   Laddas på ALLA sidor, i samma mapp som products.json och
   produkter.html (sökvägarna räknas från den här filen).

   - Sökikonen i headern öppnar en sökpanel
   - Träffar visas medan man skriver (söker i namn, kategori,
     storlekar och beskrivning, och struntar i å/ä/ö och stora/små bokstäver)
   - Klick på en träff går till produkten på produktsidan
   - Enter / "Visa alla träffar" går till produkter.html?q=...

   Utifrån kan du använda:
     ProductSearch.search(products, "text")  ->  [{ product, score }]
========================================================= */

(function () {
  "use strict";

  // Alla adresser räknas från var den här filen ligger
  const SCRIPT_URL = document.currentScript ? document.currentScript.src : location.href;
  const PRODUCTS_URL = new URL("products.json", SCRIPT_URL).href;
  const PRODUCT_PAGE = new URL("produkter.html", SCRIPT_URL).href;

  // Sökknappen i headern (aria-label="Sök")
  const TOGGLE_SELECTOR = '.header-actions button[aria-label="Sök"]';

  const MAX_RESULTS = 6;
  const MIN_QUERY_LENGTH = 2;
  const SUGGESTIONS = ["bänkpapper", "massageolja", "handskar", "desinfektion", "60×195"];

  // Nyckeln är "category" i products.json
  const CATEGORIES = {
    bankpapper: "Bänkpapper",
    massageoljor: "Massageoljor",
    forbrukning: "Förbrukningsartiklar",
  };

  // Sidor som kan hittas i sökningen. Sökningen tittar på titel och sökord
  // ("keywords"), inte på beskrivningen, som bara visas under träffen.
  //   file     = filnamn (i samma mapp som search.js)
  //   featured = visas som förslag när en sökning inte ger några träffar
  const PAGES = [
    {
      title: "Leverans",
      file: "../leverans/leverans.html",
      text: "Leverans med arCus-bilen till flera distrikt, eller med DHL.",
      keywords: "frakt skicka skickas skickar hemkörning utkörning bil arcusbilen arcus-bilen dhl distrikt leveransområde leveransdag leverera levererar påfyllning",
      featured: true,
    },
    {
      title: "Storkundsrabatt",
      file: "../storkundsrabatt/storkundsrabatt.html",
      text: "5 % rabatt från 5 förpackningar, 10 % från 10. Köp 6 massageoljor, betala för 5.",
      keywords: "rabatt mängdrabatt prisexempel spara billigare 5% 10% köp 6 betala för 5 flera förpackningar massageoljor massageolja olja oljor",
      featured: true,
    },
    {
      title: "Kontakt",
      file: "../kontakt/kontakt.html",
      text: "Frågor om produkter, beställning, storkundsrabatt eller leverans.",
      keywords: "kontakta telefon ring mejl e-post epost instagram förfrågan fråga formulär adress",
      featured: true,
    },
    {
      title: "Om oss",
      file: "../om-oss/om-oss.html",
      text: "Sedan 2010 har arCus levererat bänkpapper och förbrukningsartiklar till professionella behandlare.",
      keywords: "företaget historia om arcus vilka är vi hållbarhet hållbara svensktillverkat kvalitet personlig service",
      featured: true,
    },
    {
      title: "Produkter",
      file: "produkter.html",
      text: "Bänkpapper, massageoljor och förbrukningsartiklar.",
      keywords: "sortiment webbutik webshop shop butik alla produkter katalog",
    },
    {
      title: "Hem",
      file: "../index.html",
      text: "Startsidan.",
      keywords: "start startsida hem",
    },
  ];


  /* ---------- Sökning ---------- */

  // Gemener utan accenter, och × blir x. Alltid ett tecken in -> ett tecken ut,
  // så att positioner i den bearbetade texten stämmer med originaltexten.
  function foldChar(ch) {
    if (ch === "×") return "x";
    const base = ch.normalize("NFD")[0] || ch;
    return base.toLowerCase()[0] || ch;
  }

  function fold(text) {
    let out = "";
    for (let i = 0; i < text.length; i += 1) out += foldChar(text[i]);
    return out;
  }

  function tokens(query) {
    return fold(String(query)).split(/\s+/).filter(Boolean);
  }

  const indexCache = new Map();

  function indexOf(product) {
    if (indexCache.has(product.id)) return indexCache.get(product.id);

    const more = [].concat(product.details || [], product.features || []).join(" ");
    const sizes = (product.variants || []).map((v) => v.label).join(" ");
    const entry = {
      name: fold(product.name || ""),
      category: fold(CATEGORIES[product.category] || ""),
      variants: fold(sizes),
      text: fold(`${product.description || ""} ${more}`),
    };
    indexCache.set(product.id, entry);
    return entry;
  }

  // Alla sökord måste hittas någonstans. Träff i namnet väger tyngst.
  function score(product, words) {
    const ix = indexOf(product);
    let total = 0;

    for (const word of words) {
      let s = 0;
      if (ix.name.includes(word)) {
        s += 10;
        if (ix.name.startsWith(word) || ix.name.includes(` ${word}`)) s += 5;
      }
      if (ix.category.includes(word)) s += 4;
      if (ix.variants.includes(word)) s += 3;
      if (ix.text.includes(word)) s += 1;
      if (s === 0) return 0;
      total += s;
    }
    return total;
  }

  function search(products, query) {
    const words = tokens(query);
    if (words.length === 0) return [];

    return products
      .map((product, order) => ({ product, order, score: score(product, words) }))
      .filter((r) => r.score > 0)
      .sort((a, b) => b.score - a.score || a.order - b.order)
      .map(({ product, score: s }) => ({ product, score: s }));
  }

  // Sidor: alla sökord måste finnas i titeln eller i sökorden
  function searchPages(query) {
    const words = tokens(query);
    if (words.length === 0) return [];

    return PAGES.map((page, order) => {
      const title = fold(page.title);
      const keywords = fold(page.keywords || "");
      let total = 0;

      for (const word of words) {
        let s = 0;
        if (title.includes(word)) {
          s += 10;
          if (title.startsWith(word)) s += 5;
        }
        if (keywords.includes(word)) s += 4;
        if (s === 0) return { page, order, score: 0 };
        total += s;
      }
      return { page, order, score: total };
    })
      .filter((r) => r.score > 0)
      .sort((a, b) => b.score - a.score || a.order - b.order)
      .map(({ page, score: s }) => ({ page, score: s }));
  }


  /* ---------- Hjälpfunktioner ---------- */

  function escapeHtml(text) {
    return String(text).replace(/[&<>"']/g, (ch) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    })[ch]);
  }

  // Markerar de ställen i texten där sökorden hittades
  function highlight(text, words) {
    const folded = fold(text);
    const marked = new Array(text.length).fill(false);

    words.forEach((word) => {
      let at = folded.indexOf(word);
      while (at !== -1) {
        for (let k = at; k < at + word.length; k += 1) marked[k] = true;
        at = folded.indexOf(word, at + word.length);
      }
    });

    let html = "";
    let open = false;
    for (let i = 0; i < text.length; i += 1) {
      if (marked[i] && !open) {
        html += "<mark>";
        open = true;
      } else if (!marked[i] && open) {
        html += "</mark>";
        open = false;
      }
      html += escapeHtml(text[i]);
    }
    return open ? `${html}</mark>` : html;
  }

  function formatPrice(price) {
    return `${price.toLocaleString("sv-SE")} kr`;
  }

  function priceText(product) {
    const buyable = (product.variants || []).filter((v) => !v.accessory);
    const inStock = buyable.filter((v) => !v.outOfStock);
    if (inStock.length === 0) return "Restad";

    const low = inStock.reduce((a, b) => (b.price < a.price ? b : a), inStock[0]);
    const unit = low.unit || product.unit || "förp";
    return `${buyable.length > 1 ? "Från " : ""}${formatPrice(low.price)} / ${unit}`;
  }


  /* ---------- Produktdata (hämtas första gången man söker) ---------- */

  let products = null;
  let loading = null;
  let failed = false;

  function loadProducts() {
    if (products) return Promise.resolve(products);
    if (loading) return loading;

    loading = fetch(PRODUCTS_URL)
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json();
      })
      .then((data) => {
        products = data;
        failed = false;
        return products;
      })
      .catch((error) => {
        console.error("Sökningen kunde inte ladda produkterna:", error);
        failed = true;
        loading = null; // gör att man kan försöka igen
        return null;
      });

    return loading;
  }


  /* ---------- Panelen ---------- */

  let toggle = null;
  let overlay = null;
  let panel = null;
  let lastFocus = null;
  const el = {};

  function build() {
    overlay = document.createElement("div");
    overlay.className = "search-overlay";

    panel = document.createElement("div");
    panel.className = "search-panel";
    panel.id = "search-panel";
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-modal", "true");
    panel.setAttribute("aria-label", "Sök produkter");
    panel.inert = true;
    panel.innerHTML = `
      <div class="search-panel__bar">
        <form class="search-form" role="search" action="${escapeHtml(PRODUCT_PAGE)}" method="get">
          <label class="search-sr" for="search-input">Sök produkter</label>
          <input class="search-input" id="search-input" name="q" type="search"
                 autocomplete="off" enterkeyhint="search" placeholder="Sök produkter, t.ex. bänkpapper">
          <button class="search-submit" type="submit" aria-label="Sök">
            <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" focusable="false">
              <circle cx="10.5" cy="10.5" r="6.5" fill="none" stroke="currentColor" stroke-width="2.4"/>
              <path d="M15.5 15.5 21 21" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>
            </svg>
          </button>
        </form>
        <button class="search-close" type="button" aria-label="Stäng sökningen">&times;</button>
      </div>
      <div class="search-body"></div>
      <p class="search-sr" role="status"></p>
    `;

    document.body.append(overlay, panel);

    el.form = panel.querySelector(".search-form");
    el.input = panel.querySelector(".search-input");
    el.body = panel.querySelector(".search-body");
    el.status = panel.querySelector('[role="status"]');
    el.close = panel.querySelector(".search-close");

    overlay.addEventListener("click", close);
    el.close.addEventListener("click", close);
    el.input.addEventListener("input", update);
    el.form.addEventListener("submit", onSubmit);
    panel.addEventListener("keydown", onKeydown);
    panel.addEventListener("click", onPanelClick);
  }

  function resultTemplate(product, words) {
    const src = product.image ? new URL(product.image, PRODUCT_PAGE).href : "";
    const image = src
      ? `<img src="${escapeHtml(src)}" alt="" loading="lazy" onerror="this.parentElement.classList.add('is-missing'); this.remove();">`
      : "";

    return `
      <li>
        <a class="search-result" href="${escapeHtml(PRODUCT_PAGE)}#${encodeURIComponent(product.id)}">
          <span class="search-result__image${src ? "" : " is-missing"}" aria-hidden="true">${image}</span>
          <span class="search-result__text">
            <span class="search-result__name">${highlight(product.name, words)}</span>
            <span class="search-result__meta">${escapeHtml(CATEGORIES[product.category] || "")} · ${escapeHtml(priceText(product))}</span>
          </span>
        </a>
      </li>`;
  }

  function suggestionsTemplate() {
    return `
      <p class="search-hint">Prova att söka på:</p>
      <ul class="search-suggestions">
        ${SUGGESTIONS.map(
          (word) => `<li><button class="search-chip" type="button" data-query="${escapeHtml(word)}">${escapeHtml(word)}</button></li>`
        ).join("")}
      </ul>`;
  }

  // Ritar om innehållet beroende på vad som står i sökrutan
  function update() {
    const query = el.input.value.trim();

    if (query.length < MIN_QUERY_LENGTH) {
      el.body.innerHTML = suggestionsTemplate();
      el.status.textContent = "";
      return;
    }

    if (failed) {
      el.body.innerHTML = `<p class="search-message">Sökningen kunde inte laddas just nu. Försök igen senare.</p>`;
      el.status.textContent = "Sökningen kunde inte laddas";
      return;
    }

    if (!products) {
      el.body.innerHTML = `<p class="search-message">Söker …</p>`;
      loadProducts().then(update);
      return;
    }

    const words = tokens(query);
    const results = search(products, query);
    const shown = results.slice(0, MAX_RESULTS);
    const pageResults = searchPages(query);

    if (results.length === 0 && pageResults.length === 0) {
      const featured = PAGES.filter((p) => p.featured);
      el.body.innerHTML = `
        <p class="search-message">Inga träffar på <strong>”${escapeHtml(query)}”</strong>.
        Prova ett annat ord, eller <a class="search-all" href="${escapeHtml(PRODUCT_PAGE)}">se alla produkter</a>.</p>
        <p class="search-hint">Eller gå till:</p>
        <ul class="search-suggestions">
          ${featured.map((p) => `<li><a class="search-chip" href="${escapeHtml(pageUrl(p))}">${escapeHtml(p.title)}</a></li>`).join("")}
        </ul>`;
      el.status.textContent = `Inga träffar på ${query}`;
      return;
    }

    const more =
      results.length > shown.length
        ? `<a class="search-all" href="${escapeHtml(PRODUCT_PAGE)}?q=${encodeURIComponent(query)}">Visa alla ${results.length} produkter →</a>`
        : "";

    const productSection = results.length
      ? { score: results[0].score, html: sectionTemplate("Produkter", shown.map((r) => resultTemplate(r.product, words)).join(""), more) }
      : null;
    const pageSection = pageResults.length
      ? { score: pageResults[0].score, html: sectionTemplate("Sidor", pageResults.map((r) => pageTemplate(r.page, words)).join("")) }
      : null;

    // Den sektion som har bäst träff kommer först
    const sections = [productSection, pageSection].filter(Boolean);
    if (sections.length === 2 && pageSection.score > productSection.score) sections.reverse();

    const showHeadings = sections.length > 1;
    el.body.innerHTML = sections
      .map((s) => (showHeadings ? s.html : s.html.replace(/<h2 class="search-heading">.*?<\/h2>/, "")))
      .join("");

    const parts = [];
    if (results.length) parts.push(`${results.length} ${results.length === 1 ? "produkt" : "produkter"}`);
    if (pageResults.length) parts.push(`${pageResults.length} ${pageResults.length === 1 ? "sida" : "sidor"}`);
    el.status.textContent = parts.join(" och ");
  }

  function pageUrl(page) {
    return new URL(page.file, SCRIPT_URL).href;
  }

  function pageTemplate(page, words) {
    return `
      <li>
        <a class="search-result search-result--page" href="${escapeHtml(pageUrl(page))}">
          <span class="search-result__image search-result__icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/></svg>
          </span>
          <span class="search-result__text">
            <span class="search-result__name">${highlight(page.title, words)}</span>
            <span class="search-result__meta">${escapeHtml(page.text)}</span>
          </span>
        </a>
      </li>`;
  }

  function sectionTemplate(title, items, after = "") {
    return `
      <section>
        <h2 class="search-heading">${escapeHtml(title)}</h2>
        <ul class="search-results">${items}</ul>
        ${after}
      </section>`;
  }

  function onSubmit(event) {
    // Tom sökning: gå inte vidare
    if (tokens(el.input.value).length === 0) {
      event.preventDefault();
      el.input.focus();
    }
    // Annars skickas formuläret som vanligt till produkter.html?q=...
  }

  function onPanelClick(event) {
    const chip = event.target.closest(".search-chip");
    if (chip) {
      el.input.value = chip.dataset.query;
      el.input.focus();
      update();
      return;
    }

    // Gick man till en produkt på samma sida måste panelen stängas
    if (event.target.closest("a.search-result, a.search-all, a.search-chip")) close();
  }

  // Piltangenter flyttar mellan sökrutan och träffarna, Tab hålls inuti panelen
  function onKeydown(event) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      const links = [...panel.querySelectorAll(".search-result, .search-all, a.search-chip")];
      if (links.length === 0) return;

      event.preventDefault();
      const at = links.indexOf(document.activeElement);

      if (event.key === "ArrowDown") {
        (links[at + 1] || links[at] || links[0]).focus();
      } else if (at <= 0) {
        el.input.focus();
      } else {
        links[at - 1].focus();
      }
      return;
    }

    if (event.key !== "Tab") return;

    const focusable = [
      ...panel.querySelectorAll("button:not([disabled]), a[href], input"),
    ].filter((node) => node.offsetParent !== null);
    if (focusable.length === 0) return;

    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }


  /* ---------- Öppna / stäng ---------- */

  function open() {
    if (!panel) return;

    lastFocus = document.activeElement;
    panel.inert = false;
    panel.classList.add("is-open");
    overlay.classList.add("is-open");
    document.body.classList.add("search-open");
    if (toggle) toggle.setAttribute("aria-expanded", "true");

    el.input.focus();
    el.input.select();
    update();
    loadProducts().then(update); // hämta i förväg, så att träffarna kommer direkt
  }

  function close() {
    if (!panel || !panel.classList.contains("is-open")) return;

    panel.classList.remove("is-open");
    overlay.classList.remove("is-open");
    document.body.classList.remove("search-open");
    panel.inert = true;
    if (toggle) toggle.setAttribute("aria-expanded", "false");

    if (lastFocus && typeof lastFocus.focus === "function") lastFocus.focus();
  }


  /* ---------- Starta ---------- */

  function init() {
    toggle = document.querySelector(TOGGLE_SELECTOR);

    build();

    if (toggle) {
      toggle.setAttribute("aria-haspopup", "dialog");
      toggle.setAttribute("aria-controls", "search-panel");
      toggle.setAttribute("aria-expanded", "false");
      toggle.addEventListener("click", open);
    }

    // Esc stänger, oavsett var fokus ligger
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && panel.classList.contains("is-open")) {
        event.preventDefault();
        close();
      }
    });
  }

  window.ProductSearch = { search, searchPages, tokens, fold, pages: PAGES, open, close };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();