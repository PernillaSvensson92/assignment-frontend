/* =========================================================
   KONTAKTFORMULÄR – kontakt-form.js
   Skickar formuläret med fetch till en formulärtjänst (Formspree)
   utan att sidan laddas om, och visar tydligt om det gick bra.
   Fungerar även utan JS: då skickas formuläret på vanligt sätt.
   Läggs bara på kontaktsidan.
========================================================= */
(function () {
  "use strict";

  const form = document.querySelector(".contact-form");
  if (!form) return;

  const button = form.querySelector('[type="submit"]');
  const buttonText = button ? button.textContent : "";

  // Gör att webbläsarens egna felbubblor inte används, vi visar egna meddelanden
  form.setAttribute("novalidate", "");

  // Plats för meddelanden (skärmläsare får höra dem via role="status")
  const status = document.createElement("p");
  status.className = "form-status";
  status.setAttribute("role", "status");
  status.tabIndex = -1;
  form.append(status);

  function showStatus(message, type) {
    status.textContent = message;
    status.className = `form-status form-status--${type}`;
  }

  function fieldError(field, message) {
    const wrap = field.closest(".form-field") || field.parentElement;
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
      error.id = `${field.id || field.name}-error`;
      wrap.append(error);
    }
    error.textContent = message;
    field.setAttribute("aria-invalid", "true");
    field.setAttribute("aria-describedby", error.id);
  }

  function validateField(field) {
    if (field.type === "hidden" || field.type === "submit" || field.disabled) return true;
    if (field.name === "_gotcha") return true;

    const value = field.value.trim();
    let message = "";

    if (field.required && !value) {
      message = "Fyll i det här fältet.";
    } else if (field.type === "email" && value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      message = "Skriv en giltig e-postadress, till exempel namn@foretag.se.";
    } else if (field.type === "checkbox" && field.required && !field.checked) {
      message = "Du behöver godkänna för att skicka.";
    }

    fieldError(field, message);
    return !message;
  }

  // Rätta direkt när man lämnar ett fält som varit fel
  form.addEventListener("focusout", (event) => {
    const field = event.target;
    if (field.matches("input, select, textarea") && (field.getAttribute("aria-invalid") || field.value)) {
      validateField(field);
    }
  });

  form.addEventListener("input", (event) => {
    if (event.target.getAttribute("aria-invalid")) validateField(event.target);
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    showStatus("", "");

    const fields = [...form.querySelectorAll("input, select, textarea")];
    const invalid = fields.filter((field) => !validateField(field));

    if (invalid.length) {
      invalid[0].focus();
      showStatus("Något saknas eller är fel ifyllt. Se markerade fält.", "error");
      return;
    }

    // Skräppost-skydd: ett dolt fält som människor aldrig fyller i
    const trap = form.querySelector('[name="_gotcha"]');
    if (trap && trap.value) return;

    button.disabled = true;
    button.textContent = "Skickar …";

    try {
      const response = await fetch(form.action, {
        method: "POST",
        body: new FormData(form),
        headers: { Accept: "application/json" },
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      form.reset();
      showStatus("Tack! Din förfrågan är skickad. Vi återkommer så snart vi kan.", "success");
      status.focus();
    } catch (error) {
      console.error("Formuläret kunde inte skickas:", error);
      showStatus("Något gick fel och meddelandet skickades inte. Försök igen om en stund eller ring oss.", "error");
    } finally {
      button.disabled = false;
      button.textContent = buttonText;
    }
  });
})();