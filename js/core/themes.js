/* ============================================================
   ARCHINIME — SISTEMA DE TEMAS v28
   ------------------------------------------------------------
   📁 Ubicación: js/core/themes.js
   ------------------------------------------------------------
   ➕ Para añadir un nuevo tema, agrega un objeto dentro de THEMES.
      No hace falta tocar index.html.

   Estructura de cada tema:
   {
     id:       'identificador-unico',   // obligatorio
     name:     'Nombre visible',
     swatch:   '#colorHex',
     isDefault: false,                  // true SOLO en el tema base
     bgVideo:  'https://...',           // opcional: video de fondo
     vars: {                            // variables CSS a sobreescribir
       '--neon-1': '#xxx',
       '--neon-2': '#xxx',
       '--neon-3': '#xxx',
       '--neon-4': '#xxx',
       '--bg-deep': '#xxx'
     }
   }
   ============================================================ */
(function() {
  'use strict';

  // =========================================================
  // 📋 REGISTRO DE TEMAS
  // =========================================================
  const THEMES = {

    // =========================================================
    // 🌌 GALAXY — TEMA POR DEFECTO (video + paleta neón cósmica)
    // =========================================================
    galaxy: {
      id: 'galaxy',
      name: 'Galaxy',
      swatch: '#bf4dff',
      isDefault: true,
      bgVideo: 'https://cdn.jsdelivr.net/gh/ArchinimeDev/Archinime@main/assets/videos/galaxia.mp4',
      vars: {
        // Violeta neón puro — brilla con fuerza sobre el fondo morado
        '--neon-1': '#bf4dff',
        // Cian neón clásico — contraste fuerte y limpio sobre la galaxia
        '--neon-2': '#00f0ff',
        // Rosa neón intenso — vibrante, tipo hot pink fluorescente
        '--neon-3': '#ff2eb8',
        // Amarillo neón intenso — acento final brillante
        '--neon-4': '#ffe600',
        // Fondo violeta muy oscuro, coherente con el video
        '--bg-deep': '#08051a'
      }
    },

    cyan: {
      id: 'cyan',
      name: 'Cyan',
      swatch: '#00f0ff',
      vars: {} // usa los valores de :root
    },

    magenta: {
      id: 'magenta',
      name: 'Magenta',
      swatch: '#ff1a6b',
      vars: {
        '--neon-1': '#ff1a6b',
        '--neon-2': '#ff9a00',
        '--neon-3': '#b114ff',
        '--neon-4': '#ffd700',
        '--bg-deep': '#0a050a'
      }
    },

    emerald: {
      id: 'emerald',
      name: 'Emerald',
      swatch: '#7dff5c',
      vars: {
        '--neon-1': '#7dff5c',
        '--neon-2': '#00f0ff',
        '--neon-3': '#00ff9d',
        '--neon-4': '#ffd700',
        '--bg-deep': '#030806'
      }
    }

    // ➕➕➕ AÑADE MÁS TEMAS AQUÍ ➕➕➕
  };

  const THEME_KEY = 'archinime_theme';
  const DEFAULT_THEME = Object.values(THEMES).find(t => t.isDefault)?.id
                        || Object.keys(THEMES)[0];

  let currentTheme = DEFAULT_THEME;
  let bgVideoEl = null;

  // =========================================================
  // 🎬 VIDEO DE FONDO POR TEMA
  // =========================================================
  const VIDEO_EL_ID = 'themeBgVideo';

  function injectVideoStyles() {
    if (document.getElementById('archinime-theme-video-styles')) return;
    const style = document.createElement('style');
    style.id = 'archinime-theme-video-styles';
    style.textContent = `
      #${VIDEO_EL_ID} {
        position: fixed;
        inset: 0;
        width: 100vw;
        height: 100vh;
        object-fit: cover;
        z-index: -4;              /* detrás de aurora (-3), grid (-2), noise (-1) */
        pointer-events: none;
        opacity: 0;
        transition: opacity 1.1s ease;
        will-change: opacity;
        background: #000;
        transform: translateZ(0);

        /* 🎬 FILTRO UNIFICADO:
           El video se ve IGUAL en fluida, media y alta.
           Antes solo fluida tenía este filtro; ahora se aplica siempre. */
        filter: brightness(0.55) saturate(1.05);
      }
      #${VIDEO_EL_ID}.active { opacity: 1; }

      /* Cuando hay video activo, suavizamos el resto de efectos
         para que la galaxia respire y los textos se lean bien */
      html.theme-has-video .aurora     { opacity: 0.12 !important; }
      html.theme-has-video .grid-floor { opacity: 0.18 !important; }
      html.theme-has-video .vignette {
        background: radial-gradient(
          ellipse at center,
          transparent 28%,
          color-mix(in srgb, var(--bg-deep) 92%, transparent) 100%
        ) !important;
      }

      /* Accesibilidad: sin video si el usuario prefiere menos movimiento */
      @media (prefers-reduced-motion: reduce) {
        #${VIDEO_EL_ID} { display: none !important; }
      }
    `;
    document.head.appendChild(style);
  }

  function ensureVideoEl() {
    if (bgVideoEl && bgVideoEl.isConnected) return bgVideoEl;
    let el = document.getElementById(VIDEO_EL_ID);
    if (!el) {
      el = document.createElement('video');
      el.id = VIDEO_EL_ID;
      el.muted = true;
      el.loop = true;
      el.playsInline = true;
      el.autoplay = true;
      el.preload = 'auto';
      el.setAttribute('playsinline', '');
      el.setAttribute('webkit-playsinline', '');
      el.setAttribute('aria-hidden', 'true');
      // Lo insertamos como primer hijo del body para que quede al fondo
      document.body.insertBefore(el, document.body.firstChild);
    }
    bgVideoEl = el;
    return el;
  }

  function playVideo(url) {
    injectVideoStyles();
    const el = ensureVideoEl();

    if (el.dataset.currentSrc !== url) {
      el.src = url;
      el.dataset.currentSrc = url;
      el.load();
    }

    document.documentElement.classList.add('theme-has-video');

    requestAnimationFrame(() => {
      el.classList.add('active');
      const p = el.play();
      if (p && p.catch) {
        p.catch(() => {
          // Autoplay bloqueado → reintentar en el primer gesto del usuario
          const tryPlay = () => {
            el.play().catch(() => {});
            document.removeEventListener('touchstart', tryPlay);
            document.removeEventListener('click', tryPlay);
            document.removeEventListener('keydown', tryPlay);
          };
          document.addEventListener('touchstart', tryPlay, { once: true, passive: true });
          document.addEventListener('click', tryPlay, { once: true });
          document.addEventListener('keydown', tryPlay, { once: true });
        });
      }
    });
  }

  function stopVideo() {
    document.documentElement.classList.remove('theme-has-video');
    const el = document.getElementById(VIDEO_EL_ID);
    if (!el) return;

    el.classList.remove('active');
    // Esperamos a que termine el fade-out y liberamos recursos
    setTimeout(() => {
      if (!document.documentElement.classList.contains('theme-has-video')) {
        try { el.pause(); } catch (e) {}
        el.removeAttribute('src');
        el.dataset.currentSrc = '';
        try { el.load(); } catch (e) {}
      }
    }, 1150);
  }

  // =========================================================
  // 🧹 UTILIDADES DE VARIABLES
  // =========================================================
  function allThemeVars() {
    const set = new Set();
    Object.values(THEMES).forEach(t => {
      if (t.vars) Object.keys(t.vars).forEach(k => set.add(k));
    });
    return set;
  }

  function clearInlineVars() {
    allThemeVars().forEach(k => document.documentElement.style.removeProperty(k));
  }

  // =========================================================
  // 🎨 APLICAR TEMA
  // =========================================================
  function aplicarTema(themeId, persist = true) {
    const theme = THEMES[themeId] || THEMES[DEFAULT_THEME];
    if (!theme) return;

    clearInlineVars();

    if (theme.vars && Object.keys(theme.vars).length > 0) {
      Object.entries(theme.vars).forEach(([k, v]) => {
        document.documentElement.style.setProperty(k, v);
      });
    }

    if (theme.id === DEFAULT_THEME) {
      document.documentElement.removeAttribute('data-theme');
    } else {
      document.documentElement.dataset.theme = theme.id;
    }

    // 🎬 Video de fondo
    if (theme.bgVideo) {
      playVideo(theme.bgVideo);
    } else {
      stopVideo();
    }

    currentTheme = theme.id;

    // Marcar dots activos
    document.querySelectorAll('[data-theme-set]').forEach(d => {
      d.classList.toggle('active', d.dataset.themeSet === theme.id);
    });

    if (persist) {
      try { localStorage.setItem(THEME_KEY, theme.id); } catch (e) {}
    }

    try {
      window.dispatchEvent(new CustomEvent('archinime:theme-changed', { detail: theme }));
    } catch (e) {}
  }

  // =========================================================
  // 📥 CARGAR TEMA GUARDADO
  // =========================================================
  function cargarTemaGuardado() {
    let saved = null;
    try { saved = localStorage.getItem(THEME_KEY); } catch (e) {}
    if (saved && THEMES[saved]) {
      aplicarTema(saved, false);
    } else {
      // Por defecto → galaxy (definido con isDefault: true)
      aplicarTema(DEFAULT_THEME, false);
    }
  }

  // =========================================================
  // 🎯 RENDER DE DOTS
  // =========================================================
  function renderNavDots() {
    const container = document.querySelector('.theme-dots');
    if (!container) return;
    container.innerHTML = '';
    Object.values(THEMES).forEach(theme => {
      const btn = document.createElement('button');
      btn.className = 'theme-dot';
      btn.dataset.themeSet = theme.id;
      btn.title = `Tema ${theme.name}`;
      btn.setAttribute('aria-label', `Tema ${theme.name}`);
      btn.style.background = theme.swatch;
      btn.style.boxShadow = `0 0 10px ${theme.swatch}`;
      container.appendChild(btn);
    });
  }

  function renderConfigDots() {
    const container = document.querySelector('.config-theme-dots');
    if (!container) return;
    container.innerHTML = '';
    Object.values(THEMES).forEach(theme => {
      const btn = document.createElement('button');
      btn.className = 'config-theme-dot';
      btn.dataset.themeSet = theme.id;
      btn.setAttribute('aria-label', `Tema ${theme.name}`);
      btn.innerHTML =
        `<span class="config-theme-swatch" style="background:${theme.swatch};color:${theme.swatch};"></span>` +
        `<span class="config-theme-name">${theme.name}</span>`;
      container.appendChild(btn);
    });
  }

  // =========================================================
  // 🖱️ DELEGACIÓN DE CLICK
  //    · Dots del NAV     → cambia tema sin recargar
  //    · Dots del MODAL   → cambia tema y recarga para refrescar todo
  // =========================================================
  document.addEventListener('click', (e) => {
    const dot = e.target.closest('[data-theme-set]');
    if (dot && dot.dataset.themeSet) {
      const inConfig = !!dot.closest('#configModal');
      aplicarTema(dot.dataset.themeSet);
      if (inConfig) {
        if (typeof window.showToastSticker === 'function') {
          try {
            const t = THEMES[dot.dataset.themeSet];
            window.showToastSticker('🎨 Aplicando tema ' + (t ? t.name : '') + '...');
          } catch(_) {}
        }
        setTimeout(() => { window.location.reload(); }, 400);
      }
    }
  });

  // =========================================================
  // 🌐 API PÚBLICA
  // =========================================================
  window.cambiarTema = aplicarTema;
  window.ArchinimeThemes = {
    themes: THEMES,
    apply: aplicarTema,
    list: () => Object.values(THEMES),
    get: (id) => THEMES[id],
    getCurrent: () => currentTheme,
    add(theme) {
      if (!theme || !theme.id) return;
      THEMES[theme.id] = theme;
      renderNavDots();
      renderConfigDots();
      aplicarTema(currentTheme, false);
    },
    remove(id) {
      if (id === DEFAULT_THEME) return;
      delete THEMES[id];
      renderNavDots();
      renderConfigDots();
      if (currentTheme === id) aplicarTema(DEFAULT_THEME);
    }
  };

  // =========================================================
  // 🚀 INIT
  // =========================================================
  renderNavDots();
  renderConfigDots();
  cargarTemaGuardado();

  console.log(
    '%c🎨 ArchinimeThemes cargado · ' + Object.keys(THEMES).length + ' temas' +
    (Object.values(THEMES).some(t => t.bgVideo) ? ' (con video)' : '') +
    ' · Default: ' + DEFAULT_THEME,
    'color:#b114ff;font-family:monospace;font-weight:bold;'
  );
})();