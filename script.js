/* =========================================================
   MENY – script.js
   Fungerar med både .header-nav (startsidan) och .site-nav
   (undersidorna). Menyn öppnas och stängs med knappen, stängs när
   man väljer en länk, trycker Esc eller klickar utanför.
========================================================= */
(function () {
  "use strict";

  const menuButton = document.querySelector(".menu-button");
  const headerNav = document.querySelector(".header-nav, .site-nav");

  // Sidor utan meny ska inte ge fel
  if (!menuButton || !headerNav) return;

  const menuLinks = headerNav.querySelectorAll("a");
  const icon = menuButton.querySelector("i");
  // Sidor som använder ☰ som text i stället för Font Awesome-ikon
  const textIcon = icon ? null : menuButton.querySelector(".header-icon");

  function setMenuOpen(isOpen) {
    headerNav.classList.toggle("is-open", isOpen);
    menuButton.setAttribute("aria-expanded", String(isOpen));
    menuButton.setAttribute("aria-label", isOpen ? "Stäng menyn" : "Öppna menyn");

    // Hamburgaren blir ett kryss när menyn är öppen
    if (icon) {
      icon.classList.toggle("fa-bars", !isOpen);
      icon.classList.toggle("fa-xmark", isOpen);
    } else if (textIcon) {
      textIcon.textContent = isOpen ? "✕" : "☰";
    }
  }

  function toggleMenu() {
    setMenuOpen(!headerNav.classList.contains("is-open"));
  }

  function closeMenu() {
    setMenuOpen(false);
  }

  menuButton.addEventListener("click", toggleMenu);

  menuLinks.forEach(function (link) {
    link.addEventListener("click", closeMenu);
  });

  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape" && headerNav.classList.contains("is-open")) {
      closeMenu();
      menuButton.focus();
    }
  });

  // Klick utanför menyn stänger den
  document.addEventListener("click", function (event) {
    if (!headerNav.classList.contains("is-open")) return;
    if (headerNav.contains(event.target) || menuButton.contains(event.target)) return;
    closeMenu();
  });
})();