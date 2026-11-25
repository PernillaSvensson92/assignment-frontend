/* =========================================================
   BESTÄLLNINGSFÖRFRÅGAN – checkout.js
   Laddas på ALLA sidor, efter cart.js. Öppnas när man trycker på
   knappen i varukorgen. Skickar innehållet i varukorgen och
   kunduppgifterna till en formulärtjänst (Formspree).
   Ingen betalning sker – företaget bekräftar beställningen.
========================================================= */
(function () {
  "use strict";

  // ↓↓↓ BYT UT mot din egen adress från Formspree ↓↓↓
  const ENDPOINT = "https://formspree.io/f/maeolzpk";

  let dialog = null;
  let el = {};
  let sending = false;

  const kr = (n) => `${Math.round(n).toLocaleString("sv-SE")} kr`;

  function escapeHtml(text) {
    return String(text).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }


  /* ---------- Sammanfattning ---------- */

  function linesText(items, p) {
    const rows = items.map((i) => {
      const unit = i.unit ? `/${i.unit}` : "";
      return `${i.quantity} × ${i.name}${i.label ? ` (${i.label})` : ""} – ${kr(i.price)}${unit} = ${kr(i.price * i.quantity)}`;
    });
    rows.push("");
    rows.push(`Delsumma: ${kr(p.subtotal)}`);
    p.discounts.forEach((d) => rows.push(`${d.label}: −${kr(d.amount)}`));
    rows.push(`Totalt: ${kr(p.total)}`);
    return rows.join("\n");
  }

  function summaryHtml(items, p) {
    const rows = items
      .map(
        (i) => `
        <li class="checkout-summary__row">
          <span>${i.quantity} × ${escapeHtml(i.name)}${i.label ? `<small>${escapeHtml(i.label)}</small>` : ""}</span>
          <span>${kr(i.price * i.quantity)}</span>
        </li>`
      )
      .join("");

    const discounts = p.discounts
      .map((d) => `<li class="checkout-summary__row checkout-summary__row--discount"><span>${escapeHtml(d.label)}</span><span>−${kr(d.amount)}</span></li>`)
      .join("");

    return `
      <ul class="checkout-summary__list">${rows}${discounts}</ul>
      <p class="checkout-summary__total"><span>Totalt</span><strong>${kr(p.total)}</strong></p>`;
  }


  /* ---------- Dialogen ---------- */

  function build() {
    dialog = document.createElement("dialog");
    dialog.className = "checkout";
    dialog.setAttribute("aria-labelledby", "checkout-title");

    dialog.innerHTML = `
      <div class="checkout__header">
        <h2 id="checkout-title">Skicka beställningsförfrågan</h2>
        <button class="checkout__close" type="button" aria-label="Stäng">&times;</button>
      </div>

      <div class="checkout__body" data-view="form">
        <div class="checkout-summary" data-summary></div>

        <p class="checkout__note">
          Det här är en förfrågan, ingen betalning sker nu. Vi går igenom
          den och hör av oss för att bekräfta beställningen.
        </p>

        <form class="checkout-form" novalidate>
          <div class="form-field">
            <label for="co-name">Namn</label>
            <input id="co-name" name="name" autocomplete="name" required />
          </div>
          <div class="form-field">
            <label for="co-company">Företag (valfritt)</label>
            <input id="co-company" name="company" autocomplete="organization" />
          </div>
          <div class="form-field">
            <label for="co-email">E-post</label>
            <input id="co-email" name="email" type="email" autocomplete="email" required />
          </div>
          <div class="form-field">
            <label for="co-phone">Telefon</label>
            <input id="co-phone" name="phone" type="tel" autocomplete="tel" required />
          </div>
          <fieldset class="checkout-delivery">
            <legend>Hur vill du ha din leverans?</legend>
            <label class="checkout-delivery__option">
              <input type="radio" name="delivery" value="arCus-bilen" required />
              <span>Leverans med arCus-bilen</span>
            </label>
            <label class="checkout-delivery__option">
              <input type="radio" name="delivery" value="Skickas med DHL" required />
              <span>Skickas med DHL</span>
            </label>
            <p class="checkout-delivery__error form-error" hidden>Välj hur du vill ha din leverans.</p>
          </fieldset>
          <div class="form-field">
            <label for="co-address">Leveransadress</label>
            <input id="co-address" name="address" autocomplete="street-address" required />
          </div>
          <div class="checkout-form__row">
            <div class="form-field">
              <label for="co-zip">Postnummer</label>
              <input id="co-zip" name="zip" inputmode="numeric" autocomplete="postal-code" required />
            </div>
            <div class="form-field">
              <label for="co-city">Ort</label>
              <input id="co-city" name="city" autocomplete="address-level2" required />
            </div>
          </div>
          <div class="form-field">
            <label for="co-message">Meddelande (valfritt)</label>
            <textarea id="co-message" name="message" rows="3"></textarea>
          </div>

          <input class="form-hp" type="text" name="_gotcha" tabindex="-1" autocomplete="off" aria-hidden="true" />

          <p class="checkout__status" role="status" tabindex="-1"></p>

          <button class="button checkout__submit" type="submit">Skicka beställningsförfrågan</button>
          <button class="checkout__back" type="button">Tillbaka till varukorgen</button>
        </form>
      </div>

      <div class="checkout__body checkout__done" data-view="done" hidden>
        <h3 class="checkout__done-title" tabindex="-1">Tack för din förfrågan!</h3>
        <p>Vi har tagit emot den och hör av oss så snart vi kan.</p>
        <button class="button checkout__done-close" type="button">Stäng</button>
      </div>
    `;

    document.body.append(dialog);

    el = {
      summary: dialog.querySelector("[data-summary]"),
      form: dialog.querySelector(".checkout-form"),
      status: dialog.querySelector(".checkout__status"),
      submit: dialog.querySelector(".checkout__submit"),
      formView: dialog.querySelector('[data-view="form"]'),
      doneView: dialog.querySelector('[data-view="done"]'),
    };

    dialog.querySelector(".checkout__close").addEventListener("click", () => dialog.close());
    dialog.querySelector(".checkout__back").addEventListener("click", () => dialog.close());
    dialog.querySelector(".checkout__done-close").addEventListener("click", () => dialog.close());

    // Klick utanför rutan stänger
    dialog.addEventListener("click", (event) => {
      if (event.target === dialog) dialog.close();
    });

    dialog.addEventListener("close", onClose);
    el.form.addEventListener("submit", onSubmit);
    el.form.addEventListener("change", (event) => {
      if (event.target.name === "delivery") el.form.querySelector(".checkout-delivery__error").hidden = true;
    });
    el.form.addEventListener("input", (event) => {
      if (event.target.getAttribute("aria-invalid")) validateField(event.target);
    });
    el.form.addEventListener("focusout", (event) => {
      const field = event.target;
      if (field.matches("input:not([type=radio]), textarea") && (field.getAttribute("aria-invalid") || field.value)) validateField(field);
    });
  }

  function open() {
    if (!window.Cart || window.Cart.count() === 0) return;
    if (!dialog) build();

    const items = window.Cart.items();
    const p = window.Cart.pricing();

    el.summary.innerHTML = summaryHtml(items, p);
    el.formView.hidden = false;
    el.doneView.hidden = true;
    setStatus("", "");

    window.Cart.close();
    dialog.showModal();
    dialog.querySelector("#co-name").focus();
  }

  // Stängdes utan att skicka: tillbaka till varukorgen. Skickades den: varukorgen är tom.
  function onClose() {
    if (!el.doneView.hidden) return;
    if (window.Cart && window.Cart.count() > 0) window.Cart.open();
  }


  /* ---------- Kontroll av fälten ---------- */

  function setStatus(message, type) {
    el.status.textContent = message;
    el.status.className = `checkout__status${type ? ` checkout__status--${type}` : ""}`;
  }

  function fieldError(field, message) {
    const wrap = field.closest(".form-field");
    let error = wrap.querySelector(".form-error");

    if (!message) {
      if (error) error.remove();
      field.removeAttribute("aria-invalid");
      field.removeAttribute("aria-describedby");
      return;
    }

    if (!error) {
      error = document.createElement("p");
      error.className = "form-error";
      error.id = `${field.id}-error`;
      wrap.append(error);
    }
    error.textContent = message;
    field.setAttribute("aria-invalid", "true");
    field.setAttribute("aria-describedby", error.id);
  }

  function validateField(field) {
    if (field.name === "_gotcha") return true;

    const value = field.value.trim();
    let message = "";

    if (field.required && !value) {
      message = "Fyll i det här fältet.";
    } else if (field.type === "email" && value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      message = "Skriv en giltig e-postadress, till exempel namn@foretag.se.";
    } else if (field.name === "zip" && value && !/^\d{3}\s?\d{2}$/.test(value)) {
      message = "Skriv postnumret med fem siffror.";
    } else if (field.type === "tel" && value && value.replace(/\D/g, "").length < 6) {
      message = "Skriv ett giltigt telefonnummer.";
    }

    fieldError(field, message);
    return !message;
  }


  /* ---------- Skicka ---------- */

  async function onSubmit(event) {
    event.preventDefault();
    if (sending) return;

    const fields = [...el.form.querySelectorAll("input:not([type=radio]), textarea")];
    const invalid = fields.filter((field) => !validateField(field));

    const deliveryError = el.form.querySelector(".checkout-delivery__error");
    const deliveryChosen = el.form.querySelector('[name="delivery"]:checked');
    deliveryError.hidden = Boolean(deliveryChosen);
    if (!deliveryChosen) invalid.unshift(el.form.querySelector('[name="delivery"]'));

    if (invalid.length) {
      invalid[0].focus();
      setStatus("Något saknas eller är fel ifyllt. Se markerade fält.", "error");
      return;
    }

    if (el.form.elements._gotcha.value) return;

    const items = window.Cart.items();
    if (items.length === 0) {
      dialog.close();
      return;
    }
    const p = window.Cart.pricing();

    const data = new FormData(el.form);
    data.set("_subject", `Orderförfrågan från ${data.get("name")}`);
    data.set("order", linesText(items, p) + `\nLeverans: ${data.get("delivery")}`);
    data.set("order_total", kr(p.total));

    sending = true;
    el.submit.disabled = true;
    el.submit.textContent = "Skickar …";
    setStatus("", "");

    try {
      const response = await fetch(ENDPOINT, {
        method: "POST",
        body: data,
        headers: { Accept: "application/json" },
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      el.form.reset();
      el.formView.hidden = true;
      el.doneView.hidden = false;
      window.Cart.clear();
      dialog.querySelector(".checkout__done-title").focus();
    } catch (error) {
      console.error("Förfrågan kunde inte skickas:", error);
      setStatus("Något gick fel och förfrågan skickades inte. Din varukorg finns kvar – försök igen om en stund eller kontakta oss.", "error");
    } finally {
      sending = false;
      el.submit.disabled = false;
      el.submit.textContent = "Skicka beställningsförfrågan";
    }
  }

  document.addEventListener("cart:checkout", open);
  window.Checkout = { open };
})();