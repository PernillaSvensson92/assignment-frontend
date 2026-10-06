const menuButton = document.querySelector(".menu-button")
const headerNav = document.querySelector(".header-nav")
const menuLinks = document.querySelectorAll(".header-nav a")

function setMenuOpen(isOpen){
  headerNav.classList.toggle("is-open")
  menuButton.setAttribute("aria-expanded", isOpen)
}


function toggleMenu() {
  const isOpen = headerNav.classList.contains("is-open");
  setMenuOpen(!isOpen);
}

function closeMenu() {
  setMenuOpen(false);
}

menuButton.addEventListener("click", toggleMenu)

menuLinks.forEach(function (link) {
  link.addEventListener("click", closeMenu);
});