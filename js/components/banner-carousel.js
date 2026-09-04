// banner-carousel.js
// Carrusel de banners con almacenamiento local, actualización en caliente
// y reproducción inteligente de video (solo el visible se reproduce)

(function() {
  const STORAGE_KEY = 'archinime_banners';
  const DEFAULT_BANNERS = [
    { 
      title: "Jujutsu Kaisen", 
      desc: "", 
      media: "https://cdn.jsdelivr.net/gh/Archinime/Banners@main/toji%20(2)%20(1).mp4", 
      link: "https://archinime.github.io/-Archinime-/anime-detail.html?id=2" 
    },
    { 
      title: "Demon Slayer", 
      desc: "", 
      media: "https://cdn.jsdelivr.net/gh/Archinime/Banners@main/damonsd.mp4", 
      link: "https://archinime.github.io/-Archinime-/anime-detail.html?id=10" 
    },
    { 
      title: "Solo Leveling", 
      desc: "", 
      media: "https://cdn.jsdelivr.net/gh/Archinime/Banners@main/jin%20(1).mp4", 
      link: "https://archinime.github.io/-Archinime-/anime-detail.html?id=67" 
    }
  ];

  function getBanners() {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (parsed && parsed.length) return parsed;
      } catch (e) {}
    }
    return DEFAULT_BANNERS;
  }

  const banners = getBanners();
  const carousel = document.getElementById('bannerCarousel');
  const dotsContainer = document.getElementById('bannerDots');
  let currentBanner = 0;
  let intervalId = null;

  // --- FUNCIÓN PARA CONTROLAR LA REPRODUCCIÓN DE VIDEOS ---
  function controlVideoPlayback(activeIndex) {
    const slides = carousel.querySelectorAll('.banner-slide');
    slides.forEach((slide, index) => {
      const video = slide.querySelector('video');
      if (!video) return;
      
      if (index === activeIndex) {
        // Reproducir el video activo (con catch para evitar errores de autoplay)
        video.play().catch(() => {});
      } else {
        // Pausar los videos ocultos
        video.pause();
      }
    });
  }

  function renderBanners() {
    // Limpiar elementos anteriores
    carousel.querySelectorAll('.banner-slide').forEach(el => el.remove());
    dotsContainer.innerHTML = '';

    banners.forEach((b, i) => {
      const slide = document.createElement('div');
      slide.className = `banner-slide ${i === 0 ? 'active' : ''}`;
      
      const isVideo = b.media && (b.media.endsWith('.mp4') || b.media.endsWith('.webm') || b.media.includes('youtube.com') || b.media.includes('youtu.be'));

      if (isVideo) {
        // --- Configuración para VIDEOS ---
        slide.style.background = '#000';
        const videoEl = document.createElement('video');
        videoEl.src = b.media;
        // No ponemos autoplay aquí para controlarlo manualmente
        videoEl.muted = true;
        videoEl.loop = true;
        videoEl.playsInline = true;
        videoEl.style.position = 'absolute';
        videoEl.style.inset = '0';
        videoEl.style.width = '100%';
        videoEl.style.height = '100%';
        videoEl.style.objectFit = 'cover';
        videoEl.style.zIndex = '0';
        slide.appendChild(videoEl);

        // Overlay oscuro para mejorar legibilidad del texto
        const overlay = document.createElement('div');
        overlay.style.position = 'absolute';
        overlay.style.inset = '0';
        overlay.style.background = 'rgba(0,0,0,0.4)';
        overlay.style.zIndex = '1';
        slide.appendChild(overlay);
        
        // Si es el primer slide, lo reproducimos; si no, lo dejamos pausado
        if (i === 0) {
          videoEl.play().catch(() => {});
        } else {
          videoEl.pause();
        }

      } else {
        // --- Configuración para IMÁGENES ---
        slide.style.backgroundImage = `url(${b.media})`;
        slide.style.backgroundSize = 'cover';
        slide.style.backgroundPosition = 'center';
      }

      // --- Información (Título y Descripción) ---
      const info = document.createElement('div');
      info.className = 'banner-info';
      info.style.position = 'relative';
      info.style.zIndex = '2';
      info.innerHTML = `
        <h2>${b.title}</h2>
        <p>${b.desc || ''}</p>
      `;
      slide.appendChild(info);

      // --- Enlace (Click) - Ahora navega en la misma pestaña ---
      if (b.link && b.link !== '#') {
        slide.style.cursor = 'pointer';
        slide.addEventListener('click', () => {
          // Cambio: en lugar de window.open con '_blank', usamos location.href
          window.location.href = b.link;
        });
      }

      carousel.appendChild(slide);

      // --- Dot (Indicador) ---
      const dot = document.createElement('button');
      dot.className = `banner-dot ${i === 0 ? 'active' : ''}`;
      dot.addEventListener('click', () => goTo(i));
      dotsContainer.appendChild(dot);
    });

    // Aseguramos que solo el video del primer banner esté corriendo al inicio
    controlVideoPlayback(0);
  }

  function goTo(index) {
    const slides = carousel.querySelectorAll('.banner-slide');
    const dots = dotsContainer.querySelectorAll('.banner-dot');
    
    // Cambiar clases CSS de visibilidad
    slides.forEach((s, i) => s.classList.toggle('active', i === index));
    dots.forEach((d, i) => d.classList.toggle('active', i === index));
    
    // Controlar reproducción de videos (pausar ocultos, reproducir activo)
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

  // --- INICIALIZAR ---
  renderBanners();
  resetInterval();

  // --- ESCUCHAR CAMBIOS EN LOCALSTORAGE (otras pestañas) ---
  window.addEventListener('storage', (e) => {
    if (e.key === STORAGE_KEY) {
      const newBanners = getBanners();
      if (JSON.stringify(newBanners) !== JSON.stringify(banners)) {
        // Actualizar array de banners
        banners.length = 0;
        banners.push(...newBanners);
        // Re-renderizar y reiniciar el carrusel
        renderBanners();
        resetInterval();
        // Asegurar que el video correcto está reproduciéndose
        controlVideoPlayback(currentBanner);
      }
    }
  });
})();