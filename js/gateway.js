import { ThemeManager } from './shared/theme-manager.js';

document.addEventListener('DOMContentLoaded', () => {
    ThemeManager.init();

    const themeToggleBtn = document.getElementById('theme-toggle');
    if (themeToggleBtn) {
        themeToggleBtn.addEventListener('click', () => {
            ThemeManager.toggleTheme();
        });
    }
});
