/* =========================================================
   VARUKORG – cart.js
   Laddas på ALLA sidor (efter att headern finns i HTML:en).

   - Lyssnar på händelsen "cart:add" från produktkorten
   - Visar antal på kundvagnsikonen i headern
   - Öppnar en panel med varorna när man klickar på ikonen
   - Räknar ut rabatter och visar vad som saknas för nästa nivå
   - Sparar i localStorage, så varukorgen följer med mellan sidor
     och finns kvar efter omladdning (och synkas mellan flikar)

   RABATTER (ändra reglerna här under):
     "bulk" = storkundsrabatt, gäller varor med discount: "bulk" i products.json
     "oil6" = köp 6, betala för 5, gäller varor med discount: "oil6"

   Utifrån kan du använda:
     Cart.add({...})  Cart.remove(variantId)  Cart.clear()
     Cart.items()  Cart.count()  Cart.subtotal()  Cart.total()
     Cart.pricing()  Cart.open()  Cart.close()
   Och lyssna på:
     document.addEventListener("cart:change", (e) => e.detail)
     document.addEventListener("cart:checkout", (e) => e.detail)
========================================================= */

(function () {
  "use strict";

  const STORAGE_KEY = "arcus-cart";
  const MAX_QUANTITY = 99;
  const DEFAULT_UNIT = "förp";

  // ---- Rabattregler ----

  // Storkundsrabatt: antal förpackningar -> procent (blandade färger och storlekar räknas ihop)
  const BULK_TIERS = [
    { min: 5, percent: 5 },
    { min: 10, percent: 10 },
  ];

  // Massageoljor: för varje OIL_SET flaskor är den billigaste gratis
  const OIL_SET = 6;

  const GROUPS = ["bulk", "oil6"];

  // Kundvagnsknappen i headern (aria-label="Varukorg")
  const TOGGLE_SELECTOR = '.header-actions button[aria-label^="Varukorg"]';

  let items = load();

  let toggle = null;
  let badge = null;
  let drawer = null;
  let overlay = null;
  let announcer = null;
  let lastFocus = null;

  const el = {}; // element i panelen


  /* ---------- Lagring ---------- */

  // Kontrollerar och rensar en rad så att trasig data aldrig kraschar sidan
  function clean(raw) {
    if (!raw || typeof raw.variantId !== "string" || raw.variantId === "") return null;

    const price = Number(raw.price);
    const quantity = Math.floor(Number(raw.quantity));
    if (!Number.isFinite(price) || price < 0) return null;
    if (!Number.isFinite(quantity) || quantity < 1) return null;

    return {
      variantId: raw.variantId,
      productId: String(raw.productId || ""),
      name: String(raw.name || ""),
      label: String(raw.label || ""),
      price,
      unit: String(raw.unit || DEFAULT_UNIT),
      image: typeof raw.image === "string" ? raw.image : "",
      group: GROUPS.includes(raw.group) ? raw.group : "",
      quantity: Math.min(MAX_QUANTITY, quantity),
    };
  }

  function load() {
    try {
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
      return Array.isArray(stored) ? stored.map(clean).filter(Boolean) : [];
    } catch (error) {
      return [];
    }
  }

  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch (error) {
      // Privat läge eller full lagring: varukorgen fungerar då bara på den här sidan
    }
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

  function formatPrice(price) {
    return `${price.toLocaleString("sv-SE")} kr`;
  }

  function count() {
    return items.reduce((sum, item) => sum + item.quantity, 0);
  }

  function subtotal() {
    return items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  }

  function itemsLabel(n) {
    return `${n} ${n === 1 ? "vara" : "varor"}`;
  }

  function packs(n) {
    return `${n} ${n === 1 ? "förpackning" : "förpackningar"}`;
  }

  function bottles(n) {
    return `${n} ${n === 1 ? "massageolja" : "massageoljor"}`;
  }


  /* ---------- Rabatter ---------- */

  function pricing() {
    const sub = subtotal();

    // Storkundsrabatt: alla förpackningar i gruppen räknas ihop
    const bulkItems = items.filter((i) => i.group === "bulk");
    const bulkCount = bulkItems.reduce((sum, i) => sum + i.quantity, 0);
    const bulkSubtotal = bulkItems.reduce((sum, i) => sum + i.price * i.quantity, 0);

    let tier = null;
    BULK_TIERS.forEach((t) => {
      if (bulkCount >= t.min) tier = t;
    });
    const nextTier = BULK_TIERS.find((t) => t.min > bulkCount) || null;
    const bulkDiscount = tier ? Math.round((bulkSubtotal * tier.percent) / 100) : 0;

    // Massageoljor: sortera dyrast först och dela upp i set om OIL_SET.
    // Den billigaste flaskan i varje fullt set är gratis.
    const units = [];
    items
      .filter((i) => i.group === "oil6")
      .forEach((i) => {
        for (let n = 0; n < i.quantity; n += 1) units.push(i.price);
      });
    units.sort((a, b) => b - a);

    const oilSets = Math.floor(units.length / OIL_SET);
    let oilDiscount = 0;
    for (let s = 1; s <= oilSets; s += 1) oilDiscount += units[s * OIL_SET - 1];
    const oilRemainder = units.length % OIL_SET;

    const lines = [];
    if (bulkDiscount > 0) {
      lines.push({ type: "bulk", label: `Storkundsrabatt ${tier.percent} %`, amount: bulkDiscount });
    }
    if (oilDiscount > 0) {
      lines.push({ type: "oil6", label: `Köp ${OIL_SET} – betala för ${OIL_SET - 1}`, amount: oilDiscount });
    }
    const discountTotal = lines.reduce((sum, line) => sum + line.amount, 0);

    return {
      subtotal: sub,
      discounts: lines,
      discountTotal,
      total: sub - discountTotal,
      bulk: {
        count: bulkCount,
        percent: tier ? tier.percent : 0,
        next: nextTier,
        needed: nextTier ? nextTier.min - bulkCount : 0,
      },
      oil: {
        count: units.length,
        sets: oilSets,
        // Flaskor kvar till nästa gratis flaska (0 = ingen halvfärdig omgång)
        needed: units.length > 0 && oilRemainder !== 0 ? OIL_SET - oilRemainder : 0,
      },
    };
  }

  function total() {
    return pricing().total;
  }

  // Meddelanden som visar vad som är aktivt och vad som saknas för nästa nivå
  function promoMessages(p) {
    const messages = [];

    if (p.bulk.count > 0) {
      if (p.bulk.percent > 0) {
        const more = p.bulk.next
          ? `Lägg till ${packs(p.bulk.needed)} till för ${p.bulk.next.percent} % rabatt.`
          : "Du har nått högsta rabattnivån.";
        messages.push({ active: true, title: `Storkundsrabatt ${p.bulk.percent} % aktiverad`, text: more });
      } else {
        messages.push({
          active: false,
          title: "Storkundsrabatt",
          text: `Lägg till ${packs(p.bulk.needed)} till för ${p.bulk.next.percent} % rabatt.`,
        });
      }
    }

    if (p.oil.count > 0) {
      if (p.oil.sets > 0) {
        const more = p.oil.needed
          ? `Lägg till ${bottles(p.oil.needed)} till för en gratis flaska till.`
          : "Den billigaste flaskan i varje sexpack är gratis.";
        messages.push({ active: true, title: `Köp ${OIL_SET} – betala för ${OIL_SET - 1} aktiverat`, text: more });
      } else {
        messages.push({
          active: false,
          title: `Köp ${OIL_SET} – betala för ${OIL_SET - 1}`,
          text: `Lägg till ${bottles(p.oil.needed)} till så får du den billigaste på köpet.`,
        });
      }
    }

    return messages;
  }


  /* ---------- Ändra varukorgen ---------- */

  function snapshot() {
    const p = pricing();
    return {
      items: items.map((i) => ({ ...i })),
      count: count(),
      subtotal: p.subtotal,
      discounts: p.discounts.map((d) => ({ ...d })),
      total: p.total,
    };
  }

  function commit(message) {
    save();
    render();
    announce(message);
    document.dispatchEvent(new CustomEvent("cart:change", { detail: snapshot() }));
  }

  function add(detail) {
    const item = clean(detail);
    if (!item) return;

    const existing = items.find((i) => i.variantId === item.variantId);
    if (existing) {
      existing.quantity = Math.min(MAX_QUANTITY, existing.quantity + item.quantity);
      // Senaste uppgifterna gäller (pris, bild, rabattgrupp)
      existing.price = item.price;
      existing.group = item.group;
      if (item.image) existing.image = item.image;
    } else {
      items.push(item);
    }

    commit(`${item.quantity} × ${item.name} lades i varukorgen`);
    bump();
  }

  function setQuantity(variantId, quantity) {
    const item = items.find((i) => i.variantId === variantId);
    if (!item) return;

    item.quantity = Math.min(MAX_QUANTITY, Math.max(1, quantity));
    commit(`Antal ${item.name}: ${item.quantity}`);
  }

  function remove(variantId) {
    const item = items.find((i) => i.variantId === variantId);
    if (!item) return;

    items = items.filter((i) => i.variantId !== variantId);
    commit(`${item.name} togs bort från varukorgen`);
  }

  function clear() {
    items = [];
    commit("Varukorgen är tömd");
  }


  /* ---------- Panelen ---------- */

  function buildDrawer() {
    overlay = document.createElement("div");
    overlay.className = "cart-overlay";

    drawer = document.createElement("aside");
    drawer.className = "cart-drawer";
    drawer.id = "cart-drawer";
    drawer.setAttribute("role", "dialog");
    drawer.setAttribute("aria-modal", "true");
    drawer.setAttribute("aria-labelledby", "cart-title");
    drawer.inert = true;
    drawer.innerHTML = `
      <div class="cart-drawer__header">
        <h2 class="cart-drawer__title" id="cart-title">Varukorg <span class="cart-drawer__count"></span></h2>
        <button class="cart-drawer__close" type="button" aria-label="Stäng varukorgen">&times;</button>
      </div>

      <div class="cart-drawer__body">
        <p class="cart-empty">Din varukorg är tom.</p>
        <div class="cart-promos"></div>
        <ul class="cart-list"></ul>
      </div>

      <div class="cart-drawer__footer">
        <dl class="cart-summary" hidden></dl>
        <p class="cart-total"><span>Totalt</span><strong class="cart-total__value"></strong></p>
        <p class="cart-note" role="status" hidden></p>
        <button class="button cart-checkout" type="button">Gå till kassan</button>
        <div class="cart-drawer__links">
          <button class="cart-link" type="button" data-action="continue">Fortsätt handla</button>
          <button class="cart-link" type="button" data-action="clear">Töm varukorgen</button>
        </div>
      </div>
    `;

    announcer = document.createElement("div");
    announcer.className = "cart-announcer";
    announcer.setAttribute("aria-live", "polite");

    document.body.append(overlay, drawer, announcer);

    el.list = drawer.querySelector(".cart-list");
    el.empty = drawer.querySelector(".cart-empty");
    el.promos = drawer.querySelector(".cart-promos");
    el.footer = drawer.querySelector(".cart-drawer__footer");
    el.count = drawer.querySelector(".cart-drawer__count");
    el.summary = drawer.querySelector(".cart-summary");
    el.total = drawer.querySelector(".cart-total__value");
    el.note = drawer.querySelector(".cart-note");
    el.close = drawer.querySelector(".cart-drawer__close");

    overlay.addEventListener("click", close);
    el.close.addEventListener("click", close);
    drawer.addEventListener("keydown", trapFocus);
    drawer.addEventListener("click", onDrawerClick);
  }

  function itemTemplate(item) {
    const id = escapeHtml(item.variantId);
    return `
      <li class="cart-item" data-id="${id}">
        ${imageTemplate(item)}
        <div class="cart-item__main">
        <div class="cart-item__info">
          <p class="cart-item__name">${escapeHtml(item.name)}</p>
          <p class="cart-item__label">${escapeHtml(item.label)}</p>
          <p class="cart-item__unit-price">${formatPrice(item.price)} / ${escapeHtml(item.unit)}</p>
        </div>
        <div class="cart-item__controls">
          <div class="cart-qty" role="group" aria-label="Antal ${escapeHtml(item.name)}">
            <button class="cart-qty__btn" type="button" data-action="dec" data-id="${id}" aria-label="Minska antal"${item.quantity <= 1 ? " disabled" : ""}>−</button>
            <span class="cart-qty__value" aria-live="polite">${item.quantity}</span>
            <button class="cart-qty__btn" type="button" data-action="inc" data-id="${id}" aria-label="Öka antal"${item.quantity >= MAX_QUANTITY ? " disabled" : ""}>+</button>
          </div>
          <p class="cart-item__line-price">${formatPrice(item.price * item.quantity)}</p>
          <button class="cart-link cart-item__remove" type="button" data-action="remove" data-id="${id}" aria-label="Ta bort ${escapeHtml(item.name)}">Ta bort</button>
        </div>
        </div>
      </li>
    `;
  }

  // Liten bild. Namnet står bredvid, så bilden är dekorativ (tom alt-text).
  // Saknas bilden eller går den inte att ladda visas en neutral ruta.
  function imageTemplate(item) {
    if (!item.image) {
      return `<div class="cart-item__image is-missing" aria-hidden="true"></div>`;
    }
    return `
        <div class="cart-item__image" aria-hidden="true">
          <img src="${escapeHtml(item.image)}" alt="" loading="lazy"
               onerror="this.parentElement.classList.add('is-missing'); this.remove();">
        </div>`;
  }

  function promoTemplate(message) {
    return `
      <p class="cart-promo${message.active ? " cart-promo--active" : ""}">
        <span class="cart-promo__icon" aria-hidden="true">${message.active ? "✓" : "%"}</span>
        <span class="cart-promo__text"><strong>${escapeHtml(message.title)}</strong>
        <span>${escapeHtml(message.text)}</span></span>
      </p>`;
  }

  function render() {
    const n = count();

    // Ikonen i headern
    if (toggle) {
      toggle.setAttribute("aria-label", n > 0 ? `Varukorg, ${itemsLabel(n)}` : "Varukorg");
    }
    if (badge) {
      badge.hidden = n === 0;
      badge.textContent = n > MAX_QUANTITY ? `${MAX_QUANTITY}+` : String(n);
    }

    // Panelen
    if (!drawer) return;

    const p = pricing();

    el.list.innerHTML = items.map(itemTemplate).join("");
    el.empty.hidden = items.length > 0;
    el.footer.hidden = items.length === 0;
    el.count.textContent = items.length > 0 ? `(${itemsLabel(n)})` : "";

    // Rabattmeddelanden ovanför varorna
    el.promos.innerHTML = promoMessages(p).map(promoTemplate).join("");

    // Delsumma och rabatter, bara om det finns någon rabatt
    if (p.discountTotal > 0) {
      el.summary.hidden = false;
      el.summary.innerHTML =
        `<div class="cart-summary__row"><dt>Delsumma</dt><dd>${formatPrice(p.subtotal)}</dd></div>` +
        p.discounts
          .map(
            (d) =>
              `<div class="cart-summary__row cart-summary__row--discount"><dt>${escapeHtml(d.label)}</dt><dd>−${formatPrice(d.amount)}</dd></div>`
          )
          .join("");
    } else {
      el.summary.hidden = true;
      el.summary.innerHTML = "";
    }

    el.total.textContent = formatPrice(p.total);
    el.note.hidden = true;
  }

  function onDrawerClick(event) {
    const button = event.target.closest("[data-action], .cart-checkout");
    if (!button) return;

    if (button.classList.contains("cart-checkout")) {
      checkout();
      return;
    }

    const { action, id } = button.dataset;
    const item = items.find((i) => i.variantId === id);

    if (action === "continue") {
      close();
    } else if (action === "clear") {
      if (window.confirm("Vill du tömma hela varukorgen?")) {
        clear();
        el.close.focus();
      }
    } else if (action === "inc" && item) {
      setQuantity(id, item.quantity + 1);
      refocus(id, "inc");
    } else if (action === "dec" && item) {
      setQuantity(id, item.quantity - 1);
      refocus(id, "dec");
    } else if (action === "remove" && item) {
      remove(id);
      el.close.focus();
    }
  }

  // Panelen ritas om vid varje ändring, så fokus måste flyttas tillbaka
  function refocus(id, action) {
    const next = drawer.querySelector(`[data-id="${CSS.escape(id)}"][data-action="${action}"]`);
    if (next && !next.disabled) next.focus();
  }

  function checkout() {
    document.dispatchEvent(new CustomEvent("cart:checkout", { detail: snapshot() }));

    // Tills kassan finns: tala om att det är en prototyp
    el.note.hidden = false;
    el.note.textContent = "Kassan är inte kopplad än – det här är en prototyp.";
  }


  /* ---------- Öppna / stäng ---------- */

  function open() {
    if (!drawer) return;

    lastFocus = document.activeElement;
    drawer.inert = false;
    drawer.classList.add("is-open");
    overlay.classList.add("is-open");
    document.body.classList.add("cart-open");
    if (toggle) toggle.setAttribute("aria-expanded", "true");

    el.close.focus();
  }

  function close() {
    if (!drawer || !drawer.classList.contains("is-open")) return;

    drawer.classList.remove("is-open");
    overlay.classList.remove("is-open");
    document.body.classList.remove("cart-open");
    drawer.inert = true;
    if (toggle) toggle.setAttribute("aria-expanded", "false");

    if (lastFocus && typeof lastFocus.focus === "function") lastFocus.focus();
  }

  // Håller tangentbordsfokus inuti panelen
  function trapFocus(event) {
    if (event.key !== "Tab") return;

    const focusable = [
      ...drawer.querySelectorAll("button:not([disabled]), a[href], input, select, textarea"),
    ].filter((node) => !node.hidden && node.offsetParent !== null);
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


  /* ---------- Små detaljer ---------- */

  function announce(message) {
    if (!announcer) return;
    // Tomt först, så att skärmläsare läser upp även samma text två gånger
    announcer.textContent = "";
    setTimeout(() => {
      announcer.textContent = message;
    }, 50);
  }

  function bump() {
    if (!badge) return;
    badge.classList.remove("is-bump");
    void badge.offsetWidth; // startar om animationen
    badge.classList.add("is-bump");
  }


  /* ---------- Starta ---------- */

  function init() {
    toggle = document.querySelector(TOGGLE_SELECTOR);

    if (toggle) {
      toggle.classList.add("cart-toggle");
      toggle.setAttribute("aria-haspopup", "dialog");
      toggle.setAttribute("aria-controls", "cart-drawer");
      toggle.setAttribute("aria-expanded", "false");

      badge = document.createElement("span");
      badge.className = "cart-badge";
      badge.setAttribute("aria-hidden", "true");
      badge.hidden = true;
      toggle.append(badge);

      toggle.addEventListener("click", open);
    }

    buildDrawer();
    render();

    // Från produktkorten
    document.addEventListener("cart:add", (event) => add(event.detail));

    // Esc stänger panelen, oavsett var fokus ligger
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && drawer.classList.contains("is-open")) {
        event.preventDefault();
        close();
      }
    });

    // Ändringar i en annan flik
    window.addEventListener("storage", (event) => {
      if (event.key !== STORAGE_KEY) return;
      items = load();
      render();
    });
  }

  window.Cart = {
    add,
    remove,
    clear,
    open,
    close,
    items: () => items.map((i) => ({ ...i })),
    count,
    subtotal,
    total,
    pricing,
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();