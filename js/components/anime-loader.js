// anime-loader.js - Sistema completo de paginación y filtros
(function() {
    // ========== DEPENDENCIAS ==========
    // Aseguramos que Firebase y db estén disponibles
    if (typeof firebase === 'undefined') {
        console.error('Firebase no cargado. Asegúrate de incluir Firebase antes de este script.');
        return;
    }
    // Si db no está definida globalmente, la obtenemos
    if (typeof db === 'undefined' && firebase.firestore) {
        window.db = firebase.firestore();
    }
    const dbRef = (typeof db !== 'undefined') ? db : window.db;
    if (!dbRef) {
        console.error('No se pudo obtener instancia de Firestore.');
        return;
    }

    // ========== ESTADO GLOBAL ==========
    let lastVisibleAnime = null;
    let isFetchingAnimes = false;
    let hasMoreAnimes = true;
    const ANIMES_PER_PAGE = 20;

    // Almacenamiento de ratings
    let firestoreRatings = new Map();

    // Estado para filtros (se sincroniza con el HTML)
    let currentFilters = {
        search: '',
        genre: '',
        demographic: '',
        rating: ''
    };

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

    // ========== RENDERIZADO ==========
    window.renderAnimes = function(animes, append = false) {
        const grid = document.getElementById('grid');
        if (!grid) return;
        if (!append) grid.innerHTML = '';
        if (!animes.length && !append) {
            mostrarNoResultados();
            return;
        }
        const frag = document.createDocumentFragment();
        animes.forEach(anime => {
            const card = document.createElement('div');
            card.className = 'card';
            card.dataset.id = anime.id;
            card.setAttribute('onclick', `location='anime-detail.html?id=${anime.id}'`);
            const rating = getDisplayRating(anime);
            card.innerHTML = `<img src="${anime.img}" alt="${anime.title}" loading="lazy"><div class="info"><strong>${anime.title}</strong><span class="rating-value">⭐ ${rating}</span></div>`;
            frag.appendChild(card);
        });
        grid.appendChild(frag);
        
        // Efecto tilt solo en desktop
        const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
        if (!isTouch) {
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
    };

    function mostrarNoResultados() {
        const grid = document.getElementById('grid');
        if (!grid) return;
        grid.innerHTML = `<div class="cyber-no-results" style="grid-column:1/-1; display:flex; flex-direction:column; align-items:center; padding:60px; background:rgba(10,12,16,0.7); border:1px solid var(--neon-purple); border-radius:16px;">
            <i class="fas fa-satellite-dish" style="font-size:3rem; color:var(--neon-cyan);"></i>
            <h2 style="font-family:Orbitron; margin:20px 0;">Sin Resultados</h2>
            <p>Prueba con otros filtros o busca por alias.</p>
            <button onclick="window.reiniciarPaginacion()" style="margin-top:20px; background:transparent; border:2px solid var(--neon-pink); color:#fff; padding:12px 30px; border-radius:8px; cursor:pointer;">Restaurar Radares</button>
        </div>`;
    }

    // ========== CARGA PAGINADA (con cursor) ==========
    async function cargarAnimesPaginado(reset = false) {
        if (reset) {
            lastVisibleAnime = null;
            hasMoreAnimes = true;
            isFetchingAnimes = false;
            document.getElementById('grid').innerHTML = '';
        }
        if (isFetchingAnimes || !hasMoreAnimes) return;
        
        isFetchingAnimes = true;
        
        try {
            let query = dbRef.collection('catalogo')
                          .orderBy('title')
                          .limit(ANIMES_PER_PAGE);

            if (lastVisibleAnime && !reset) {
                query = query.startAfter(lastVisibleAnime);
            }

            const snapshot = await query.get();

            if (snapshot.empty) {
                hasMoreAnimes = false;
                return;
            }

            lastVisibleAnime = snapshot.docs[snapshot.docs.length - 1];
            const animes = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            
            window.renderAnimes(animes, !reset);
            
            // Disparar evento cuando se carga la primera página
            if (reset || (lastVisibleAnime && snapshot.docs.length === ANIMES_PER_PAGE && !window._firstLoaded)) {
                if (!window._firstLoaded) {
                    window._firstLoaded = true;
                    const event = new CustomEvent('firstAnimesLoaded');
                    window.dispatchEvent(event);
                }
            }
        } catch (error) {
            console.error("Error en paginación:", error);
        } finally {
            isFetchingAnimes = false;
        }
    }

    // ========== FILTRADO AVANZADO (con consulta a Firestore) ==========
    window.filtrarAnimes = async function(filtros) {
        // Guardar filtros actuales
        currentFilters = { ...filtros };
        
        // Resetear paginación
        lastVisibleAnime = null;
        hasMoreAnimes = true;
        isFetchingAnimes = false;
        const grid = document.getElementById('grid');
        if (grid) grid.innerHTML = '<div style="text-align:center; padding:40px;"><i class="fas fa-spinner fa-spin"></i> Filtrando...</div>';
        
        try {
            let query = dbRef.collection('catalogo');
            
            // Aplicar filtro de género si existe (array-contains)
            if (currentFilters.genre) {
                query = query.where('genres', 'array-contains', currentFilters.genre);
            }
            
            // Ordenar por título (necesario para paginación)
            query = query.orderBy('title');
            
            // Ejecutar consulta (sin paginación adicional, traemos hasta 200 para filtrar en cliente)
            const snapshot = await query.limit(200).get();
            let animes = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            
            // Filtrar por demografía (si existe, en client-side porque es subcampo de genres)
            if (currentFilters.demographic) {
                animes = animes.filter(a => a.genres && a.genres.includes(currentFilters.demographic));
            }
            
            // Búsqueda por título o alias
            if (currentFilters.search) {
                const searchTerm = normalizeText(currentFilters.search);
                animes = animes.filter(a => {
                    const titles = [a.title, ...(a.aliases || [])];
                    return titles.some(t => normalizeText(t).startsWith(searchTerm));
                });
            }
            
            // Filtrar por rating
            if (currentFilters.rating) {
                animes = animes.filter(a => {
                    const r = getNumericRating(a);
                    if (currentFilters.rating === 'excellent') return r >= 4.8;
                    if (currentFilters.rating === 'good') return r >= 4.6 && r < 4.8;
                    if (currentFilters.rating === 'regular') return r < 4.6;
                    return true;
                });
            }
            
            window.renderAnimes(animes, false);
            if (animes.length === 0) mostrarNoResultados();
            
            // Deshabilitar scroll infinito mientras hay filtros activos
            hasMoreAnimes = false;
        } catch (err) {
            console.error('Error en filtros:', err);
            if (grid) grid.innerHTML = `<div class="error-message">Error: ${err.message}</div>`;
        }
    };

    // ========== REINICIAR PAGINACIÓN (quita filtros) ==========
    window.reiniciarPaginacion = function() {
        // Limpiar inputs del HTML
        const searchInput = document.getElementById('search');
        const genreSelect = document.getElementById('genre-select');
        const demographicSelect = document.getElementById('demographic-select');
        const ratingSelect = document.getElementById('rating-select');
        if (searchInput) searchInput.value = '';
        if (genreSelect) genreSelect.value = '';
        if (demographicSelect) demographicSelect.value = '';
        if (ratingSelect) ratingSelect.value = '';
        
        // Resetear estado de filtros
        currentFilters = { search: '', genre: '', demographic: '', rating: '' };
        
        // Resetear paginación
        lastVisibleAnime = null;
        hasMoreAnimes = true;
        isFetchingAnimes = false;
        
        // Cargar primera página
        cargarAnimesPaginado(true);
    };

    // ========== INFINITE SCROLL ==========
    function onScroll() {
        // Solo actuar si no hay filtros activos
        const hasActiveFilters = currentFilters.search || currentFilters.genre || currentFilters.demographic || currentFilters.rating;
        if (hasActiveFilters) return;
        
        const scrollPosition = window.innerHeight + window.scrollY;
        const threshold = document.body.offsetHeight - 500;
        if (scrollPosition >= threshold && !isFetchingAnimes && hasMoreAnimes) {
            cargarAnimesPaginado(false);
        }
    }
    
    window.addEventListener('scroll', onScroll);
    
    // ========== INICIALIZAR RATINGS Y PRIMERA CARGA ==========
    async function initRatings() {
        try {
            const snapshot = await dbRef.collection('animeRatings').get();
            snapshot.forEach(doc => {
                const data = doc.data();
                if (typeof data.avg === 'number') {
                    firestoreRatings.set(parseInt(doc.id), { avg: data.avg, count: data.count || 0 });
                }
            });
        } catch (e) {
            console.warn('Error cargando ratings:', e);
        }
    }
    
    // Esperar a que el DOM esté listo
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            initRatings().then(() => cargarAnimesPaginado(true));
        });
    } else {
        initRatings().then(() => cargarAnimesPaginado(true));
    }
})();