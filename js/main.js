/* ==========================================
   MAIN - Application Entry Point
   ========================================== */

(function() {
    'use strict';

    // Wait for DOM to be ready
    document.addEventListener('DOMContentLoaded', async function() {

        // Get elements
        const contentGrid = document.getElementById('content-grid');
        const loadingSpinner = document.getElementById('loading');
        const loadMoreBtn = document.getElementById('load-more');
        const filterPills = document.querySelectorAll('.filter-pill');

        // Check if we're on a page that needs content loading
        if (!contentGrid) return;

        // Determine filter type
        let filterType = window.FILTER_TYPE || 'all';

        // Initialize
        await loadInitialContent(filterType);

        // Setup filter pills (only on home page)
        if (filterPills.length > 0) {
            filterPills.forEach(pill => {
                pill.addEventListener('click', async function() {
                    const filter = this.dataset.filter;

                    // Update active state
                    filterPills.forEach(p => p.classList.remove('active'));
                    this.classList.add('active');

                    // Reload content with filter
                    await loadInitialContent(filter);
                });
            });
        }

        // Setup load more button
        if (loadMoreBtn) {
            loadMoreBtn.addEventListener('click', function() {
                loadingSpinner.style.display = 'flex';

                setTimeout(() => {
                    const isComplete = ContentLoader.loadMore(contentGrid);
                    loadingSpinner.style.display = 'none';

                    if (isComplete) {
                        loadMoreBtn.style.display = 'none';
                    }

                    // Re-initialize masonry after loading
                    Masonry.updateMasonry(contentGrid);
                }, 300);
            });
        }

        // Load initial content
        async function loadInitialContent(filter) {
            loadingSpinner.style.display = 'flex';
            contentGrid.innerHTML = '';

            try {
                await ContentLoader.loadAllContent(filter);
                const initialContent = ContentLoader.getInitialContent();

                ContentLoader.renderContent(initialContent, contentGrid);

                // Show load more button if there's more content
                if (loadMoreBtn) {
                    const hasMore = initialContent.length < ContentLoader.loadAllContent.length;
                    loadMoreBtn.style.display = hasMore ? 'block' : 'none';
                }

                // Initialize masonry
                Masonry.initMasonry(contentGrid);

            } catch (error) {
                console.error('Error loading content:', error);
                contentGrid.innerHTML = '<p style="text-align: center; color: var(--text-secondary); padding: 2rem;">Failed to load content. Please try again later.</p>';
            } finally {
                loadingSpinner.style.display = 'none';
            }
        }
    });
})();
