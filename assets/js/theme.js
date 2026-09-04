const root = document.documentElement;
const toggle = document.querySelector(".theme-toggle");
const icon = toggle.querySelector("span");
const savedTheme = localStorage.getItem("theme");
const systemPrefersLight = window.matchMedia("(prefers-color-scheme: light)").matches;

function applyTheme(theme) {
  root.dataset.theme = theme;
  const isLight = theme === "light";
  toggle.setAttribute("aria-pressed", String(isLight));
  toggle.setAttribute("aria-label", isLight ? "Activar modo oscuro" : "Activar modo claro");
  icon.textContent = isLight ? "☾" : "☀︎";
}

applyTheme(savedTheme || (systemPrefersLight ? "light" : "dark"));

toggle.addEventListener("click", () => {
  const nextTheme = root.dataset.theme === "dark" ? "light" : "dark";
  localStorage.setItem("theme", nextTheme);
  applyTheme(nextTheme);
});

document.querySelector("#year").textContent = new Date().getFullYear();
