/* ==========================================
   ROUTER - Client-side Routing
   ========================================== */

const Router = (function() {
    'use strict';

    function navigateTo(url) {
        window.location.href = url;
    }

    function getQueryParam(param) {
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.get(param);
    }

    function createBlogUrl(id) {
        return `blog.html?id=${id}`;
    }

    function createProjectUrl(id) {
        return `project.html?id=${id}`;
    }

    return {
        navigateTo,
        getQueryParam,
        createBlogUrl,
        createProjectUrl
    };
})();
