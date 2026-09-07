// anime-loader.js - Sistema completo de paginación y filtros
// CORREGIDO: Usa catálogo local (catalogoArray) en lugar de Firestore
// CORREGIDO: Rutas a pages/anime-detail.html
// OPTIMIZADO: Carga instantánea, filtros en cliente, paginación local

(function() {
    // ========== DEPENDENCIAS ==========
    // Asegurar que el catálogo local esté disponible
    if (typeof catalogoArray === 'undefined') {
        console.error('❌ catalogoArray no está definido. Asegúrate de cargar catalogo.js primero.');
        return;
    }

    // ========== ESTADO GLOBAL ==========
    let allAnimes = [];
    let filteredAnimes = [];
    let currentPage = 1;
    const ANIMES_PER_PAGE = 36;
    let currentFilters = {
        search: '',
        genre: '',
        demographic: '',
        rating: ''
    };

    // Almacenamiento de ratings (desde Firestore, opcional)
    let firestoreRatings = new Map();

    // ========== FUNCIONES AUXILIARES ==========
    function normalizeText(s) {
        return (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    }

    function getDisplayRating(anime) {
        const animeId = parseInt(anime.id);
        if (firestoreRatings.has(animeId)) {
            const ratingObj = firestoreRatings.get(animeId);
            if (ratingObj && typeof ratingObj.avg === 'number') return ratingObj.avg.toFixed(1);
        }
        if (anime.rating != null && typeof anime.rating === 'number' && !isNaN(anime.rating)) return anime.rating.toFixed(1);
        return '—';
    }

    function getNumericRating(anime) {
        const animeId = parseInt(anime.id);
        if (firestoreRatings.has(animeId)) {
            const avg = firestoreRatings.get(animeId).avg;
            if (typeof avg === 'number') return avg;
        }
        if (anime.rating != null && typeof anime.rating === 'number') return anime.rating;
        return 0;
    }

    // ========== RENDERIZADO DE ANIMES ==========
    window.renderAnimes = function(animes, append = false) {
        const grid = document.getElementById('grid');
        if (!grid) return;
        if (!append) grid.innerHTML = '';
        if (!animes.length && !append) {
            mostrarNoResultados();
            return;
        }

        const frag = document.createDocumentFragment();
        const hasFilters = currentFilters.search || currentFilters.genre || currentFilters.demographic || currentFilters.rating;

        animes.forEach(anime => {
            const card = document.createElement('div');
            card.className = 'card';
            card.dataset.id = anime.id;
            // ✅ RUTA CORREGIDA: pages/anime-detail.html
            card.setAttribute('onclick', `location='pages/anime-detail.html?id=${anime.id}'`);
            
            const rating = getDisplayRating(anime);
            const ratingVal = getNumericRating(anime);
            const roundedRating = Math.round(ratingVal * 10) / 10;
            const badge = (roundedRating >= 4.9 && roundedRating <= 5.0) ? '<div class="badge">🔥 TOP</div>' : '';
            
            card.innerHTML = `
                <img src="${anime.img || 'assets/img/placeholder.webp'}" alt="${anime.title}" loading="lazy" decoding="async">
                ${badge}
                <div class="info">
                    <strong>${anime.title}</strong>
                    <span class="rating-value">⭐ ${rating}</span>
                </div>
            `;
            frag.appendChild(card);
        });

        grid.appendChild(frag);
        aplicarTilt();
    };

    function mostrarNoResultados() {
        const grid = document.getElementById('grid');
        if (!grid) return;
        grid.innerHTML = `
            <div class="cyber-no-results" style="grid-column:1/-1; display:flex; flex-direction:column; align-items:center; padding:60px; background:rgba(10,12,16,0.7); border:1px solid var(--neon-purple); border-radius:16px;">
                <i class="fas fa-satellite-dish" style="font-size:3rem; color:var(--neon-cyan);"></i>
                <h2 style="font-family:Orbitron; margin:20px 0;">Sin Resultados</h2>
                <p>Prueba con otros filtros o busca por alias.</p>
                <button onclick="window.reiniciarPaginacion()" style="margin-top:20px; background:transparent; border:2px solid var(--neon-pink); color:#fff; padding:12px 30px; border-radius:8px; cursor:pointer;">Restaurar Radares</button>
            </div>
        `;
    }

    // ========== FILTRADO LOCAL ==========
    function applyFilters() {
        let result = allAnimes.slice();
        
        if (currentFilters.genre) {
            result = result.filter(a => a.genres && a.genres.includes(currentFilters.genre));
        }
        if (currentFilters.demographic) {
            result = result.filter(a => a.genres && a.genres.includes(currentFilters.demographic));
        }
        if (currentFilters.search) {
            const term = normalizeText(currentFilters.search);
            result = result.filter(a => {
                const titleMatch = normalizeText(a.title).includes(term);
                if (titleMatch) return true;
                if (a.aliases) return a.aliases.some(alias => normalizeText(alias).includes(term));
                return false;
            });
        }
        if (currentFilters.rating) {
            result = result.filter(a => {
                const r = getNumericRating(a);
                if (currentFilters.rating === 'excellent') return r >= 4.8;
                if (currentFilters.rating === 'good') return r >= 4.6 && r < 4.8;
                if (currentFilters.rating === 'regular') return r < 4.6;
                return true;
            });
        }
        return result;
    }

    // ========== PAGINACIÓN ==========
    function renderPage() {
        const filtered = applyFilters();
        filteredAnimes = filtered;
        const start = (currentPage - 1) * ANIMES_PER_PAGE;
        const end = start + ANIMES_PER_PAGE;
        const pageItems = filtered.slice(start, end);
        window.renderAnimes(pageItems, false);
        renderPagination();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    function renderPagination() {
        const totalPages = Math.ceil(filteredAnimes.length / ANIMES_PER_PAGE);
        const container = document.getElementById('pagination');
        if (!container) return;
        if (totalPages <= 1) {
            container.innerHTML = '';
            return;
        }

        let html = `<button class="pagination-btn" ${currentPage===1?'disabled':''} onclick="changePage(${currentPage-1})"><i class="fas fa-chevron-left"></i></button>`;
        const maxV = 5;
        let s = Math.max(1, currentPage - Math.floor(maxV/2));
        let e = Math.min(totalPages, s + maxV - 1);
        if (e - s + 1 < maxV) s = Math.max(1, e - maxV + 1);
        
        if (s > 1) {
            html += `<button class="pagination-btn" onclick="changePage(1)">1</button>`;
            if (s > 2) html += `<span class="pagination-ellipsis">...</span>`;
        }
        for (let i = s; i <= e; i++) {
            html += `<button class="pagination-btn ${i===currentPage?'active':''}" onclick="changePage(${i})">${i}</button>`;
        }
        if (e < totalPages) {
            if (e < totalPages - 1) html += `<span class="pagination-ellipsis">...</span>`;
            html += `<button class="pagination-btn" onclick="changePage(${totalPages})">${totalPages}</button>`;
        }
        html += `<button class="pagination-btn" ${currentPage===totalPages?'disabled':''} onclick="changePage(${currentPage+1})"><i class="fas fa-chevron-right"></i></button>`;
        container.innerHTML = html;
    }

    window.changePage = function(p) {
        const totalPages = Math.ceil(filteredAnimes.length / ANIMES_PER_PAGE);
        if (p < 1 || p > totalPages) return;
        currentPage = p;
        renderPage();
    };

    // ========== REINICIAR FILTROS Y PAGINACIÓN ==========
    window.reiniciarPaginacion = function() {
        const searchInput = document.getElementById('search');
        const genreSelect = document.getElementById('genre-select');
        const demographicSelect = document.getElementById('demographic-select');
        const ratingSelect = document.getElementById('rating-select');
        if (searchInput) searchInput.value = '';
        if (genreSelect) genreSelect.value = '';
        if (demographicSelect) demographicSelect.value = '';
        if (ratingSelect) ratingSelect.value = '';
        currentFilters = { search: '', genre: '', demographic: '', rating: '' };
        currentPage = 1;
        renderPage();
    };

    // ========== CARGA DE RATINGS DESDE FIRESTORE (OPCIONAL) ==========
    async function initRatings() {
        if (typeof firebase === 'undefined' || !firebase.apps.length) {
            console.warn('⚠️ Firebase no disponible. Los ratings se obtendrán de los datos locales.');
            return;
        }
        try {
            const db = firebase.firestore();
            const snapshot = await db.collection('animeRatings').get();
            snapshot.forEach(doc => {
                const data = doc.data();
                if (typeof data.avg === 'number') {
                    firestoreRatings.set(parseInt(doc.id), { avg: data.avg, count: data.count || 0 });
                }
            });
            console.log(`📊 ${firestoreRatings.size} ratings cargados desde Firestore.`);
        } catch (e) {
            console.warn('⚠️ Error cargando ratings:', e);
        }
    }

    // ========== EFECTO TILT (SOLO ESCRITORIO) ==========
    function aplicarTilt() {
        const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
        if (isTouch) return;
        document.querySelectorAll('.card:not([data-tilt-init])').forEach(c => {
            c.dataset.tiltInit = 'true';
            c.addEventListener('mousemove', (e) => {
                if (c.tiltRAF) cancelAnimationFrame(c.tiltRAF);
                c.tiltRAF = requestAnimationFrame(() => {
                    const rect = c.getBoundingClientRect();
                    const x = e.clientX - rect.left;
                    const y = e.clientY - rect.top;
                    const rotX = ((y - rect.height/2) / (rect.height/2)) * -6;
                    const rotY = ((x - rect.width/2) / (rect.width/2)) * 6;
                    c.style.transform = `perspective(1200px) rotateX(${rotX}deg) rotateY(${rotY}deg) scale(1.02)`;
                });
            });
            c.addEventListener('mouseleave', () => {
                if (c.tiltRAF) cancelAnimationFrame(c.tiltRAF);
                c.style.transform = '';
            });
        });
    }

    // ========== INICIALIZACIÓN PRINCIPAL ==========
    function init() {
        if (typeof catalogoArray === 'undefined' || catalogoArray.length === 0) {
            console.warn('⏳ catalogoArray no disponible. Reintentando en 500ms...');
            setTimeout(init, 500);
            return;
        }

        allAnimes = catalogoArray.slice();
        filteredAnimes = allAnimes.slice();
        renderPage();

        // Conectar filtros del HTML
        const searchInput = document.getElementById('search');
        const genreSelect = document.getElementById('genre-select');
        const demographicSelect = document.getElementById('demographic-select');
        const ratingSelect = document.getElementById('rating-select');

        if (searchInput) {
            searchInput.addEventListener('input', function() {
                currentFilters.search = this.value.trim();
                currentPage = 1;
                renderPage();
            });
        }
        if (genreSelect) {
            genreSelect.addEventListener('change', function() {
                currentFilters.genre = this.value;
                currentPage = 1;
                renderPage();
            });
        }
        if (demographicSelect) {
            demographicSelect.addEventListener('change', function() {
                currentFilters.demographic = this.value;
                currentPage = 1;
                renderPage();
            });
        }
        if (ratingSelect) {
            ratingSelect.addEventListener('change', function() {
                currentFilters.rating = this.value;
                currentPage = 1;
                renderPage();
            });
        }

        // Disparar evento de carga completa para el loader
        setTimeout(() => {
            const event = new CustomEvent('firstAnimesLoaded');
            window.dispatchEvent(event);
        }, 100);

        console.log(`🚀 ${allAnimes.length} animes cargados localmente.`);
    }

    // ========== ARRANQUE ==========
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            initRatings().then(init);
        });
    } else {
        initRatings().then(init);
    }
})();