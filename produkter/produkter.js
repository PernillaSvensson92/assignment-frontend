/* =========================================================
   PRODUKTER – renderar produktkort från products.json
   - Kategorifilter överst (Alla / Bänkpapper / Massageoljor / ...)
   - Rullista för storlek/variant visar pris och uppdaterar priset på kortet
   - Antal (− / +) innan man lägger i varukorgen, med summa
   - Produkter med bara ett alternativ visas utan rullista
   - "Lägg i varukorg" skickar händelsen cart:add som den
     kommande varukorgen kan lyssna på
========================================================= */

// Sökvägen räknas från HTML-sidan (produkter.html), inte från den här filen
const PRODUCTS_URL = "products.json";
const DEFAULT_UNIT = "förp";
const MAX_QUANTITY = 99;

// Nyckeln är "category" i products.json
const CATEGORIES = {
  bankpapper: "Bänkpapper",
  massageoljor: "Massageoljor",
  forbrukning: "Förbrukningsartiklar",
};

const grid = document.getElementById("product-grid");
const filterBar = document.getElementById("product-filter");
const countLabel = document.getElementById("product-count");
const productsById = new Map();

// Sökning från sökpanelen: produkter.html?q=bänkpapper (kräver search.js på sidan)
const searchQuery = (new URLSearchParams(location.search).get("q") || "").trim();
let searchIds = null; // id:n på produkter som matchar sökningen (null = ingen sökning)


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

function formatPrice(price) {
  return `${price.toLocaleString("sv-SE")} kr`;
}

function unitOf(product, variant) {
  return (variant && variant.unit) || product.unit || DEFAULT_UNIT;
}

// Tillbehör (t.ex. doseringspump) räknas inte när "Från"-priset visas,
// annars skulle en massageolja visa "Från 40 kr". De går ändå att välja.
function availableVariants(product) {
  return product.variants.filter((variant) => !variant.outOfStock && !variant.accessory);
}

function lowestVariant(product) {
  const list = availableVariants(product);
  if (list.length === 0) return null;
  return list.reduce((low, v) => (v.price < low.price ? v : low), list[0]);
}

// Vad priset ska visa: valt alternativ, annars "Från" lägsta priset
function priceState(product, variantId) {
  const chosen = product.variants.find((v) => v.id === variantId && !v.outOfStock);
  if (chosen) {
    return { from: false, price: chosen.price, unit: unitOf(product, chosen) };
  }
  const low = lowestVariant(product);
  if (!low) return null;
  return {
    from: product.variants.length > 1,
    price: low.price,
    unit: unitOf(product, low),
  };
}

// Det alternativ som är valt på kortet (null om inget är valt än)
function selectedVariant(card, product) {
  const select = card.querySelector(".product-card__select");
  if (!select) return product.variants[0];
  return product.variants.find((v) => v.id === select.value) || null;
}

function getQuantity(card) {
  const input = card.querySelector(".quantity__input");
  const value = parseInt(input.value, 10);
  if (!Number.isFinite(value)) return 1;
  return Math.min(MAX_QUANTITY, Math.max(1, value));
}


/* ---------- Kortets markup ---------- */

function cardTemplate(product) {
  const hasChoice = product.variants.length > 1;
  const price = priceState(product, "");
  const soldOut = price === null;
  const selectLabel = product.selectLabel || "Storlek";

  // Priset står med i rullistan så att man kan jämföra alla alternativ.
  // Det står FÖRST, för på smala skärmar klipps slutet av långa alternativ.
  const options = product.variants
    .map((variant) => {
      const text = variant.outOfStock
        ? `${variant.label} (restad)`
        : `${formatPrice(variant.price)} · ${variant.label}`;
      return `<option value="${escapeHtml(variant.id)}"${variant.outOfStock ? " disabled" : ""}>${escapeHtml(text)}</option>`;
    })
    .join("");

  const field = hasChoice
    ? `
        <div class="product-card__field">
          <label for="size-${escapeHtml(product.id)}">${escapeHtml(selectLabel)}</label>
          <select id="size-${escapeHtml(product.id)}" class="product-card__select">
            <option value="">Välj ${escapeHtml(selectLabel.toLowerCase())}</option>
            ${options}
          </select>
        </div>`
    : "";

  const paragraphs = (product.details || [])
    .map((text) => `<p>${escapeHtml(text)}</p>`)
    .join("");
  const features = product.features && product.features.length
    ? `<ul class="product-card__features">${product.features
        .map((text) => `<li>${escapeHtml(text)}</li>`)
        .join("")}</ul>`
    : "";
  const more = paragraphs || features
    ? `
        <details class="product-card__more">
          <summary>Läs mer</summary>
          <div class="product-card__more-body">${paragraphs}${features}</div>
        </details>`
    : "";

  const priceHtml = soldOut
    ? `<p class="product-card__price product-card__price--soldout">Restad</p>`
    : `<p class="product-card__price" aria-live="polite">
          <span class="product-card__price-prefix"${price.from ? "" : " hidden"}>Från</span>
          <strong class="product-card__price-value">${formatPrice(price.price)}</strong>
          <span class="product-card__price-unit">/ ${escapeHtml(price.unit)}</span>
        </p>
        <p class="product-card__total" aria-live="polite" hidden></p>`;

  const quantity = soldOut
    ? ""
    : `
          <div class="quantity" role="group" aria-label="Antal">
            <button class="quantity__btn" type="button" data-step="-1" aria-label="Minska antal">−</button>
            <input class="quantity__input" type="number" inputmode="numeric" min="1" max="${MAX_QUANTITY}" value="1" aria-label="Antal">
            <button class="quantity__btn" type="button" data-step="1" aria-label="Öka antal">+</button>
          </div>`;

  return `
    <article class="product-card" data-product-id="${escapeHtml(product.id)}" data-category="${escapeHtml(product.category)}">
      <div class="product-card__image">
        <img src="${escapeHtml(product.image)}" alt="${escapeHtml(product.imageAlt || product.name)}" loading="lazy"
             onerror="this.parentElement.classList.add('is-missing'); this.remove();">
      </div>

      <div class="product-card__body">
        <p class="product-card__category">${escapeHtml(CATEGORIES[product.category] || "")}</p>
        <h3 class="product-card__title">${escapeHtml(product.name)}</h3>
        <p class="product-card__description">${escapeHtml(product.description)}</p>
        ${more}
        ${field}
        ${priceHtml}
        <p class="product-card__error" role="alert" hidden>Välj ${escapeHtml(selectLabel.toLowerCase())} först.</p>

        <div class="product-card__buy">${quantity}
          <button class="button product-card__button" type="button"${soldOut ? " disabled" : ""}>${soldOut ? "Restad" : "Lägg i varukorg"}</button>
        </div>
      </div>
    </article>
  `;
}


/* ---------- Uppdatera pris och summa ---------- */

function updatePrice(card, product, variantId) {
  const state = priceState(product, variantId);
  if (!state) return;

  card.querySelector(".product-card__price-prefix").hidden = !state.from;
  card.querySelector(".product-card__price-value").textContent = formatPrice(state.price);
  card.querySelector(".product-card__price-unit").textContent = `/ ${state.unit}`;
  card.querySelector(".product-card__error").hidden = true;
}

// Visar t.ex. "3 × 910 kr = 2 730 kr" när antalet är fler än ett
function updateTotal(card, product) {
  const total = card.querySelector(".product-card__total");
  if (!total) return;

  const variant = selectedVariant(card, product);
  const quantity = getQuantity(card);

  if (variant && !variant.outOfStock && quantity > 1) {
    total.hidden = false;
    total.textContent = `${quantity} × ${formatPrice(variant.price)} = ${formatPrice(quantity * variant.price)}`;
  } else {
    total.hidden = true;
    total.textContent = "";
  }
}

function setQuantity(card, product, value) {
  const input = card.querySelector(".quantity__input");
  input.value = Math.min(MAX_QUANTITY, Math.max(1, value));
  updateTotal(card, product);
}


/* ---------- Varukorg (platshållare) ---------- */

function addToCart(product, variant, quantity) {
  const detail = {
    productId: product.id,
    variantId: variant.id,
    name: product.name,
    label: variant.label,
    price: variant.price,
    unit: unitOf(product, variant),
    // Full adress, så att bilden hittas även när varukorgen visas på en annan sida
    image: product.image ? new URL(product.image, document.baseURI).href : "",
    // Vilken rabatt som gäller ("bulk" = storkundsrabatt, "oil6" = köp 6 betala för 5).
    // Tillbehör som doseringspumpar är aldrig rabatterade.
    group: variant.accessory ? "" : product.discount || "",
    quantity,
  };

  // Varukorgen kan senare lyssna med:
  // document.addEventListener("cart:add", (e) => { ... e.detail ... });
  // cart.js tar emot den och lägger varan i varukorgen
  document.dispatchEvent(new CustomEvent("cart:add", { detail }));
}

// Kort bekräftelse på knappen så att man ser att något hände
function confirmAdded(button) {
  clearTimeout(button._resetTimer);
  button.textContent = "Tillagd ✓";
  button._resetTimer = setTimeout(() => {
    button.textContent = "Lägg i varukorg";
  }, 1600);
}


/* ---------- Filter ---------- */

function applyFilter(category) {
  let visible = 0;

  grid.querySelectorAll(".product-card").forEach((card) => {
    const inCategory = category === "alla" || card.dataset.category === category;
    const inSearch = !searchIds || searchIds.has(card.dataset.productId);
    const show = inCategory && inSearch;
    card.hidden = !show;
    if (show) visible += 1;
  });

  if (filterBar) {
    filterBar.querySelectorAll(".filter-button").forEach((button) => {
      button.setAttribute("aria-pressed", String(button.dataset.category === category));
    });
  }

  if (countLabel) {
    const text = `Visar ${visible} ${visible === 1 ? "produkt" : "produkter"}`;

    if (searchIds) {
      countLabel.innerHTML =
        `${escapeHtml(text)} för ”${escapeHtml(searchQuery)}” ` +
        `<button class="product-count__clear" type="button">Rensa sökning</button>`;
    } else {
      countLabel.textContent = text;
    }
  }

  showEmptyMessage(visible);
}

function showEmptyMessage(visible) {
  let empty = grid.querySelector(".product-grid__empty");

  if (visible > 0) {
    if (empty) empty.remove();
    return;
  }

  if (!empty) {
    empty = document.createElement("p");
    empty.className = "product-grid__error product-grid__empty";
    grid.append(empty);
  }
  empty.textContent = searchIds
    ? `Inga produkter matchar ”${searchQuery}” i den här kategorin.`
    : "Inga produkter i den här kategorin.";
}

// Länk från sökningen: produkter.html#wise-natur
// Visar alla produkter, scrollar till kortet och markerar det en stund.
function highlightFromHash() {
  const id = decodeURIComponent(location.hash.slice(1));
  if (!productsById.has(id)) return;

  searchIds = null; // ett valt kort ska alltid synas, även om man sökt på något annat
  applyFilter("alla");

  const card = grid.querySelector(`.product-card[data-product-id="${CSS.escape(id)}"]`);
  if (!card) return;

  grid.querySelectorAll(".is-highlighted").forEach((c) => c.classList.remove("is-highlighted"));
  card.classList.add("is-highlighted");

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  card.scrollIntoView({ block: "center", behavior: reduceMotion ? "auto" : "smooth" });

  setTimeout(() => card.classList.remove("is-highlighted"), 3500);
}

function setupFilter(products) {
  if (!filterBar) return "alla";

  const present = Object.keys(CATEGORIES).filter((key) =>
    products.some((product) => product.category === key)
  );

  const buttons = [["alla", "Alla produkter"], ...present.map((key) => [key, CATEGORIES[key]])];
  filterBar.innerHTML = buttons
    .map(
      ([key, label]) =>
        `<button class="filter-button" type="button" data-category="${key}" aria-pressed="false">${label}</button>`
    )
    .join("");

  filterBar.addEventListener("click", (event) => {
    const button = event.target.closest(".filter-button");
    if (!button) return;

    const category = button.dataset.category;
    applyFilter(category);

    // Gör att man kan länka direkt, t.ex. produkter.html#massageoljor
    history.replaceState(null, "", location.pathname + location.search + (category === "alla" ? "" : `#${category}`));
  });

  const fromHash = location.hash.slice(1);
  return present.includes(fromHash) ? fromHash : "alla";
}


/* ---------- Händelser (en lyssnare för hela rutnätet) ---------- */

function cardAndProduct(element) {
  const card = element.closest(".product-card");
  return [card, productsById.get(card.dataset.productId)];
}

function setupEvents() {
  // Val av storlek/variant
  grid.addEventListener("change", (event) => {
    const select = event.target.closest(".product-card__select");
    if (select) {
      const [card, product] = cardAndProduct(select);
      updatePrice(card, product, select.value);
      updateTotal(card, product);
      return;
    }

    // Antal skrivet för hand: håll det mellan 1 och MAX_QUANTITY
    const input = event.target.closest(".quantity__input");
    if (input) {
      const [card, product] = cardAndProduct(input);
      setQuantity(card, product, getQuantity(card));
    }
  });

  // Summan följer med medan man skriver
  grid.addEventListener("input", (event) => {
    const input = event.target.closest(".quantity__input");
    if (!input) return;
    const [card, product] = cardAndProduct(input);
    updateTotal(card, product);
  });

  grid.addEventListener("click", (event) => {
    // − / +
    const step = event.target.closest(".quantity__btn");
    if (step) {
      const [card, product] = cardAndProduct(step);
      setQuantity(card, product, getQuantity(card) + Number(step.dataset.step));
      return;
    }

    // Lägg i varukorg
    const button = event.target.closest(".product-card__button");
    if (!button) return;

    const [card, product] = cardAndProduct(button);
    const select = card.querySelector(".product-card__select");
    const error = card.querySelector(".product-card__error");
    const variant = selectedVariant(card, product);

    // Produkter med flera alternativ kräver att man har valt ett
    if (!variant) {
      error.hidden = false;
      select.focus();
      return;
    }

    addToCart(product, variant, getQuantity(card));
    setQuantity(card, product, 1);
    confirmAdded(button);
  });
}


/* ---------- Starta ---------- */

async function loadProducts() {
  if (!grid) return;

  try {
    const response = await fetch(PRODUCTS_URL);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const products = await response.json();
    products.forEach((product) => productsById.set(product.id, product));

    // Sökning (?q=...) använder samma sökning som sökpanelen
    if (searchQuery && window.ProductSearch) {
      searchIds = new Set(window.ProductSearch.search(products, searchQuery).map((r) => r.product.id));
    }

    grid.innerHTML = products.map(cardTemplate).join("");
    setupEvents();
    applyFilter(setupFilter(products));

    // "Rensa sökning" och länkar till en enskild produkt
    if (countLabel) {
      countLabel.addEventListener("click", (event) => {
        if (event.target.closest(".product-count__clear")) location.href = location.pathname;
      });
    }
    highlightFromHash();
    window.addEventListener("hashchange", highlightFromHash);
  } catch (error) {
    console.error("Kunde inte ladda produkterna:", error);
    grid.innerHTML =
      '<p class="product-grid__error">Produkterna kunde inte laddas just nu. Försök igen senare.</p>';
  }
}

loadProducts();