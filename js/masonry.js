/* ==========================================
   MASONRY - Grid Layout Manager
   ========================================== */

const Masonry = (function() {
    'use strict';

    // The masonry layout is handled via CSS columns
    // This module provides utilities for managing the grid

    function initMasonry(gridElement) {
        if (!gridElement) return;

        // Add any initialization logic here if needed
        // The actual masonry layout is handled by CSS column-count
    }

    function updateMasonry(gridElement) {
        if (!gridElement) return;

        // Force a reflow to ensure proper layout
        gridElement.style.display = 'none';
        gridElement.offsetHeight; // Force reflow
        gridElement.style.display = '';
    }

    function addItems(gridElement, items) {
        if (!gridElement) return;

        // Items are added by the ContentLoader
        // This function can be used for any post-processing
        updateMasonry(gridElement);
    }

    return {
        initMasonry,
        updateMasonry,
        addItems
    };
})();
