// Светлая / тёмная тема на основе цветовых режимов Bootstrap 5.3 (атрибут data-bs-theme).
// Скрипт подключён в <head> без defer, чтобы тема применилась до отрисовки страницы.
(function () {
  const THEME_KEY = 'technest-theme';
  let saved = null;

  try {
    saved = localStorage.getItem(THEME_KEY);
  } catch (error) {
    saved = null;
  }

  const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  const theme = saved === 'dark' || saved === 'light' ? saved : (prefersDark ? 'dark' : 'light');

  document.documentElement.setAttribute('data-bs-theme', theme);
})();
