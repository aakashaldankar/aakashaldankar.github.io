/* ==========================================
   THEME TOGGLE - Dark/Light Mode
   ========================================== */

(function() {
    'use strict';

    // Check for saved theme preference or default to light mode
    const currentTheme = localStorage.getItem('theme') || 'dark';

    // Apply theme on page load
    document.documentElement.setAttribute('data-theme', currentTheme);

    // Wait for DOM to be ready
    document.addEventListener('DOMContentLoaded', function() {
        const themeToggle = document.querySelector('.theme-toggle');

        if (!themeToggle) return;

        // Set initial theme
        updateThemeUI(currentTheme);

        // Toggle theme on button click
        themeToggle.addEventListener('click', function() {
            const currentTheme = document.documentElement.getAttribute('data-theme');
            const newTheme = currentTheme === 'light' ? 'dark' : 'light';

            // Update DOM and storage
            document.documentElement.setAttribute('data-theme', newTheme);
            localStorage.setItem('theme', newTheme);

            // Update UI
            updateThemeUI(newTheme);
        });
    });

    function updateThemeUI(theme) {
        // You can add additional UI updates here if needed
        console.log('Theme switched to:', theme);
    }
})();
