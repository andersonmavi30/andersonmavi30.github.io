const root = document.documentElement;
const themeToggle = document.querySelector(".theme-toggle");
const themeIcon = themeToggle.querySelector("span");
const languageToggle = document.querySelector(".language-toggle");

function applyTheme(theme) {
  root.dataset.theme = theme;
  const isDark = theme === "dark";
  themeToggle.setAttribute("aria-pressed", String(isDark));
  themeToggle.setAttribute("aria-label", isDark ? "Activar modo claro" : "Activar modo oscuro");
  themeIcon.textContent = isDark ? "☀︎" : "☾";
}

function applyLanguage(language) {
  root.lang = language;

  document.querySelectorAll("[data-es][data-en]").forEach((element) => {
    element.textContent = element.dataset[language];
  });

  const isSpanish = language === "es";
  languageToggle.textContent = isSpanish ? "EN" : "ES";
  languageToggle.setAttribute(
    "aria-label",
    isSpanish ? "Cambiar idioma a inglés" : "Switch language to Spanish"
  );

  document.title = isSpanish
    ? "Anderson Martinez Virviescas | Network Automation & NetDevOps"
    : "Anderson Martinez Virviescas | Network Automation & NetDevOps";

  document.querySelector('meta[name="description"]').content = isSpanish
    ? "Portafolio técnico de Anderson Martinez Virviescas sobre Network Automation, NetDevOps, redes, Linux y seguridad."
    : "Technical portfolio of Anderson Martinez Virviescas focused on Network Automation, NetDevOps, networking, Linux, and security.";
}

applyTheme(localStorage.getItem("theme") || "light");
applyLanguage(localStorage.getItem("language") || "es");

themeToggle.addEventListener("click", () => {
  const nextTheme = root.dataset.theme === "light" ? "dark" : "light";
  localStorage.setItem("theme", nextTheme);
  applyTheme(nextTheme);
});

languageToggle.addEventListener("click", () => {
  const nextLanguage = root.lang === "es" ? "en" : "es";
  localStorage.setItem("language", nextLanguage);
  applyLanguage(nextLanguage);
});

document.querySelector("#year").textContent = new Date().getFullYear();
