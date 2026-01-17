/* ==========================================
   CONTENT LOADER - Load and Display Content
   ========================================== */

const ContentLoader = (function() {
    'use strict';

    let allContent = [];
    let currentPage = 0;
    const itemsPerPage = 9;

    // Load manifest and all content
    async function loadManifest() {
        try {
            const response = await fetch('content/manifest.json');
            const manifest = await response.json();
            return manifest;
        } catch (error) {
            console.error('Error loading manifest:', error);
            return { blogs: [], projects: [] };
        }
    }

    // Load individual content item
    async function loadContentItem(type, id) {
        try {
            const response = await fetch(`content/${type}s/${id}.json`);
            const data = await response.json();
            return { ...data, type };
        } catch (error) {
            console.error(`Error loading ${type} ${id}:`, error);
            return null;
        }
    }

    // Load all content
    async function loadAllContent(filterType = 'all') {
        const manifest = await loadManifest();
        const promises = [];

        if (filterType === 'all' || filterType === 'blog') {
            manifest.blogs.forEach(id => {
                promises.push(loadContentItem('blog', id));
            });
        }

        if (filterType === 'all' || filterType === 'project') {
            manifest.projects.forEach(id => {
                promises.push(loadContentItem('project', id));
            });
        }

        const results = await Promise.all(promises);
        allContent = results.filter(item => item !== null);

        // Sort by date (newest first)
        allContent.sort((a, b) => new Date(b.date) - new Date(a.date));

        return allContent;
    }

    // Create card HTML
    function createCard(item) {
        const url = item.type === 'blog'
            ? Router.createBlogUrl(item.id)
            : Router.createProjectUrl(item.id);

        const categoryLabel = item.type === 'blog' ? 'Blog' : 'Project';
        const imageSrc = item.image || 'images/placeholder.jpg';

        return `
            <div class="card fade-in" onclick="window.location.href='${url}'">
                <img src="${imageSrc}" alt="${item.title}" class="card-image" loading="lazy">
                <div class="card-content">
                    <span class="card-category">${categoryLabel}</span>
                    <h3 class="card-title">${item.title}</h3>
                    <p class="card-excerpt">${item.excerpt}</p>
                    <div class="card-meta">
                        <span class="card-date">${formatDate(item.date)}</span>
                        ${item.readTime ? `<span class="card-read-time">${item.readTime}</span>` : ''}
                    </div>
                </div>
            </div>
        `;
    }

    // Render content to grid
    function renderContent(content, gridElement, append = false) {
        if (!append) {
            gridElement.innerHTML = '';
        }

        const html = content.map(item => createCard(item)).join('');

        if (append) {
            gridElement.insertAdjacentHTML('beforeend', html);
        } else {
            gridElement.innerHTML = html;
        }
    }

    // Load more content
    function loadMore(gridElement) {
        currentPage++;
        const start = currentPage * itemsPerPage;
        const end = start + itemsPerPage;
        const nextBatch = allContent.slice(start, end);

        renderContent(nextBatch, gridElement, true);

        return end >= allContent.length;
    }

    // Get initial content
    function getInitialContent() {
        currentPage = 0;
        const start = 0;
        const end = itemsPerPage;
        return allContent.slice(start, end);
    }

    // Format date
    function formatDate(dateString) {
        const date = new Date(dateString);
        const options = { year: 'numeric', month: 'short', day: 'numeric' };
        return date.toLocaleDateString('en-US', options);
    }

    // Load and display article
    async function loadArticle(type, id) {
        try {
            const article = await loadContentItem(type, id);
            if (!article) {
                throw new Error('Article not found');
            }

            // Update page title
            document.title = `${article.title} - Your Name`;

            // Update meta description
            const metaDesc = document.querySelector('meta[name="description"]');
            if (metaDesc) {
                metaDesc.content = article.excerpt;
            }

            // Render hero image
            const heroElement = document.getElementById('article-hero');
            if (heroElement && article.image) {
                heroElement.innerHTML = `<img src="${article.image}" alt="${article.title}">`;
            }

            // Render metadata
            const metaElement = document.getElementById('article-meta');
            if (metaElement) {
                metaElement.innerHTML = `
                    <span>${formatDate(article.date)}</span>
                    ${article.readTime ? `<span>•</span><span>${article.readTime} read</span>` : ''}
                    ${article.category ? `<span>•</span><span>${article.category}</span>` : ''}
                `;
            }

            // Render title
            const titleElement = document.getElementById('article-title');
            if (titleElement) {
                titleElement.textContent = article.title;
            }

            // Render content (supports markdown-like formatting)
            const contentElement = document.getElementById('article-content');
            if (contentElement) {
                contentElement.innerHTML = formatContent(article.content);
            }

            // Render project links if available
            if (type === 'project' && article.links) {
                const linksElement = document.getElementById('project-links');
                if (linksElement) {
                    const linksHTML = Object.entries(article.links)
                        .map(([label, url]) => `
                            <a href="${url}" class="project-link" target="_blank" rel="noopener noreferrer">
                                ${label}
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                                    <polyline points="15 3 21 3 21 9"></polyline>
                                    <line x1="10" y1="14" x2="21" y2="3"></line>
                                </svg>
                            </a>
                        `).join('');
                    linksElement.innerHTML = linksHTML;
                }
            }

            // Load related content
            if (article.related && article.related.length > 0) {
                await loadRelatedContent(type, article.related);
            }

            // Setup share buttons
            setupShareButtons(article.title);

        } catch (error) {
            console.error('Error loading article:', error);
            const contentElement = document.getElementById('article-content');
            if (contentElement) {
                contentElement.innerHTML = '<p>Sorry, this content could not be loaded.</p>';
            }
        }
    }

    // Format content (basic markdown-like formatting)
    function formatContent(content) {
        // Convert **bold** to <strong>
        content = content.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

        // Convert *italic* to <em>
        content = content.replace(/\*(.*?)\*/g, '<em>$1</em>');

        // Convert line breaks to paragraphs
        const paragraphs = content.split('\n\n');
        return paragraphs.map(p => `<p>${p.replace(/\n/g, '<br>')}</p>`).join('');
    }

    // Load related content
    async function loadRelatedContent(currentType, relatedIds) {
        const relatedGrid = document.getElementById('related-grid');
        if (!relatedGrid) return;

        const promises = relatedIds.slice(0, 3).map(id => {
            // Try to determine type from the id or assume same type
            return loadContentItem(currentType, id);
        });

        const relatedItems = await Promise.all(promises);
        const validItems = relatedItems.filter(item => item !== null);

        renderContent(validItems, relatedGrid);
    }

    // Setup share buttons
    function setupShareButtons(title) {
        const url = window.location.href;
        const text = `Check out: ${title}`;

        const twitterBtn = document.getElementById('share-twitter');
        if (twitterBtn) {
            twitterBtn.onclick = () => {
                window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`, '_blank');
            };
        }

        const linkedinBtn = document.getElementById('share-linkedin');
        if (linkedinBtn) {
            linkedinBtn.onclick = () => {
                window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`, '_blank');
            };
        }

        const copyBtn = document.getElementById('share-copy');
        if (copyBtn) {
            copyBtn.onclick = async () => {
                try {
                    await navigator.clipboard.writeText(url);
                    alert('Link copied to clipboard!');
                } catch (err) {
                    console.error('Failed to copy:', err);
                }
            };
        }
    }

    return {
        loadAllContent,
        renderContent,
        getInitialContent,
        loadMore,
        loadArticle
    };
})();

// Make loadArticle available globally for inline scripts
window.loadArticle = ContentLoader.loadArticle;
