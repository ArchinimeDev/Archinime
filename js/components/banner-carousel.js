// banner-carousel.js  (v2 — robusto + fallback + versionado)
// Carrusel de banners con almacenamiento local, actualización en caliente
// y reproducción inteligente de video (solo el visible se reproduce)
// ✅ FIX v2:
//   - Versionado de localStorage (invalida configs viejas automáticamente)
//   - Fallback a imagen si el video falla o tarda demasiado
//   - Logs de debug claros
//   - Nunca deja un slide completamente negro y vacío

(function() {
  const STORAGE_KEY = 'archinime_banners';
  const STORAGE_VERSION_KEY = 'archinime_banners_version';
  const CURRENT_VERSION = '2';   // ⬅️ sube esto si cambias DEFAULT_BANNERS

  // Fallback de imagen (se usa si el video falla)
  const FALLBACK_IMG = 'assets/img/galaxia-morado1.avif';

  const DEFAULT_BANNERS = [
    {
      title: "Jujutsu Kaisen",
      desc: "",
      media: "assets/videos/jujutsukaisen.mp4",
      fallbackImg: FALLBACK_IMG,
      link: "pages/anime-detail.html?id=2"
    },
    {
      title: "Demon Slayer",
      desc: "",
      media: "assets/videos/demonslayer.mp4",
      fallbackImg: FALLBACK_IMG,
      link: "pages/anime-detail.html?id=10"
    },
    {
      title: "Solo Leveling",
      desc: "",
      media: "assets/videos/sololeveling.mp4",
      fallbackImg: FALLBACK_IMG,
      link: "pages/anime-detail.html?id=67"
    }
  ];

  function getBanners() {
    // ✅ Si la versión guardada no coincide, invalidamos la config vieja
    const storedVersion = localStorage.getItem(STORAGE_VERSION_KEY);
    if (storedVersion !== CURRENT_VERSION) {
      console.log('🔄 Banner config: versión desactualizada → usando DEFAULT_BANNERS');
      localStorage.removeItem(STORAGE_KEY);
      localStorage.setItem(STORAGE_VERSION_KEY, CURRENT_VERSION);
      return DEFAULT_BANNERS;
    }

    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (parsed && parsed.length) {
          console.log('📦 Banners cargados desde localStorage:', parsed.length);
          return parsed;
        }
      } catch (e) {
        console.warn('⚠️ localStorage corrupto, usando DEFAULT_BANNERS:', e);
      }
    }
    console.log('🎬 Banners por defecto:', DEFAULT_BANNERS.length);
    return DEFAULT_BANNERS;
  }

  const banners = getBanners();
  const carousel = document.getElementById('bannerCarousel');
  const dotsContainer = document.getElementById('bannerDots');

  if (!carousel || !dotsContainer) {
    console.error('❌ banner-carousel: faltan #bannerCarousel o #bannerDots');
    return;
  }

  let currentBanner = 0;
  let intervalId = null;

  // --- CONTROL DE REPRODUCCIÓN ---
  function controlVideoPlayback(activeIndex) {
    const slides = carousel.querySelectorAll('.banner-slide');
    slides.forEach((slide, index) => {
      const video = slide.querySelector('video');
      if (!video) return;
      if (index === activeIndex) {
        video.play().catch(() => {});
      } else {
        video.pause();
      }
    });
  }

  // --- RENDER ---
  function renderBanners() {
    carousel.querySelectorAll('.banner-slide').forEach(el => el.remove());
    dotsContainer.innerHTML = '';

    banners.forEach((b, i) => {
      const slide = document.createElement('div');
      slide.className = `banner-slide ${i === 0 ? 'active' : ''}`;

      const isVideo = b.media && (
        b.media.endsWith('.mp4') ||
        b.media.endsWith('.webm') ||
        b.media.includes('youtube.com') ||
        b.media.includes('youtu.be')
      );

      if (isVideo) {
        slide.style.background = '#000';

        // ✅ Fallback de imagen: se ve MIENTRAS carga el video, y si falla
        if (b.fallbackImg) {
          slide.style.backgroundImage = `url(${b.fallbackImg})`;
          slide.style.backgroundSize = 'cover';
          slide.style.backgroundPosition = 'center';
        }

        const videoEl = document.createElement('video');
        videoEl.src = b.media;
        videoEl.muted = true;
        videoEl.loop = true;
        videoEl.playsInline = true;
        videoEl.setAttribute('muted', '');
        videoEl.setAttribute('playsinline', '');
        videoEl.style.position = 'absolute';
        videoEl.style.inset = '0';
        videoEl.style.width = '100%';
        videoEl.style.height = '100%';
        videoEl.style.objectFit = 'cover';
        videoEl.style.zIndex = '0';
        videoEl.style.opacity = '0';
        videoEl.style.transition = 'opacity 0.6s';

        // ✅ Cuando carga bien, lo mostramos
        videoEl.addEventListener('loadeddata', () => {
          console.log(`✅ Banner video OK: ${b.media}`);
          videoEl.style.opacity = '1';
        }, { once: true });

        // ✅ Si falla, dejamos la imagen de fondo (ya está puesta arriba)
        videoEl.addEventListener('error', () => {
          console.warn(`❌ Banner video falló (404 o codec): ${b.media}`);
          videoEl.style.display = 'none';
        }, { once: true });

        // Timeout: si en 4s no cargó, asumimos que no va a cargar
        setTimeout(() => {
          if (videoEl.readyState < 2) {
            console.warn(`⏱️ Banner video lento/fallido: ${b.media}`);
          }
        }, 4000);

        slide.appendChild(videoEl);

        // Overlay para legibilidad
        const overlay = document.createElement('div');
        overlay.style.position = 'absolute';
        overlay.style.inset = '0';
        overlay.style.background = 'rgba(0,0,0,0.4)';
        overlay.style.zIndex = '1';
        slide.appendChild(overlay);

        if (i === 0) videoEl.play().catch(() => {});
        else videoEl.pause();

      } else {
        // IMAGEN
        slide.style.backgroundImage = `url(${b.media})`;
        slide.style.backgroundSize = 'cover';
        slide.style.backgroundPosition = 'center';
      }

      // INFO
      const info = document.createElement('div');
      info.className = 'banner-info';
      info.style.position = 'relative';
      info.style.zIndex = '2';
      info.innerHTML = `<h2>${b.title}</h2><p>${b.desc || ''}</p>`;
      slide.appendChild(info);

      // CLICK
      if (b.link && b.link !== '#') {
        slide.style.cursor = 'pointer';
        slide.addEventListener('click', () => {
          window.location.href = b.link;
        });
      }

      carousel.appendChild(slide);

      // DOT
      const dot = document.createElement('button');
      dot.className = `banner-dot ${i === 0 ? 'active' : ''}`;
      dot.addEventListener('click', () => goTo(i));
      dotsContainer.appendChild(dot);
    });

    controlVideoPlayback(0);
  }

  function goTo(index) {
    const slides = carousel.querySelectorAll('.banner-slide');
    const dots = dotsContainer.querySelectorAll('.banner-dot');
    slides.forEach((s, i) => s.classList.toggle('active', i === index));
    dots.forEach((d, i) => d.classList.toggle('active', i === index));
    controlVideoPlayback(index);
    currentBanner = index;
    resetInterval();
  }

  function nextBanner() {
    const total = banners.length;
    goTo((currentBanner + 1) % total);
  }

  function resetInterval() {
    if (intervalId) clearInterval(intervalId);
    intervalId = setInterval(nextBanner, 5000);
  }

  // --- INIT ---
  renderBanners();
  resetInterval();

  // --- SYNC ENTRE PESTAÑAS ---
  window.addEventListener('storage', (e) => {
    if (e.key === STORAGE_KEY) {
      const newBanners = getBanners();
      if (JSON.stringify(newBanners) !== JSON.stringify(banners)) {
        banners.length = 0;
        banners.push(...newBanners);
        currentBanner = 0;
        renderBanners();
        resetInterval();
      }
    }
  });
})();