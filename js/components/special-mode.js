/**
 * MODO ESPECIAL - ARCHINIME (v5 - OPTIMIZADO)
 * - En PC: fullscreen con object-fit: cover
 * - En móviles: banner normal con object-fit: contain
 * - Modo especial: oculta partículas, chroma key, cursor y sparks.
 *   El bg-video (galaxia) y el overlay morado se MANTIENEN.
 * - ⚡ Detiene por completo el bucle rAF del chroma key con
 *   window.stopChroma() → 0% CPU en chroma mientras está activo.
 */

const SPECIAL_PROBABILITY = 0.10; // 10% modo especial (sube a 1.0 para probar siempre)
const SPECIAL_VIDEOS = [
  'https://cdn.jsdelivr.net/gh/ArchinimeDev/Archinime@main/assets/videos/atrevete.mp4',
  'https://cdn.jsdelivr.net/gh/ArchinimeDev/Archinime@main/assets/videos/bakihanma.mp4',
  'https://cdn.jsdelivr.net/gh/ArchinimeDev/Archinime@main/assets/videos/efecto.mp4'
];

window.isSpecialMode = false;

function isMobileDevice() {
  return window.innerWidth <= 768;
}

function getNavHeight() {
  const nav = document.querySelector('.cyber-nav');
  return nav ? nav.offsetHeight : 68;
}

// ===== REPRODUCIR VIDEO CON REINTENTO =====
function intentarReproducirVideo(videoElement, videoList, index) {
  if (index >= videoList.length) {
    console.error('❌ Todos los videos fallaron. Usando el primero como fallback.');
    videoElement.src = videoList[0];
    videoElement.load();
    videoElement.play().catch(() => {});
    return;
  }

  const src = videoList[index];
  console.log(`🎬 Intentando cargar: ${src}`);

  videoElement.removeEventListener('error', onVideoError);
  videoElement.removeEventListener('loadeddata', onVideoLoaded);

  function onVideoError() {
    console.warn(`⚠️ Error al cargar ${src}, pasando al siguiente...`);
    intentarReproducirVideo(videoElement, videoList, index + 1);
  }

  function onVideoLoaded() {
    console.log(`✅ Video cargado correctamente: ${src}`);
    videoElement.play().catch(() => {});
  }

  videoElement.addEventListener('error', onVideoError);
  videoElement.addEventListener('loadeddata', onVideoLoaded);

  videoElement.src = src;
  videoElement.load();
  videoElement.play().catch(() => {});
}

// ===== PAUSAR ANIMACIONES DE FONDO =====
// Detiene POR COMPLETO el chroma key (cancela el rAF).
// El bg-video NO se toca: sigue corriendo para mantener el fondo galaxia.
function pausarAnimacionesFondo() {
  try {
    const fgVideo = document.getElementById('fgVideo');
    if (fgVideo && !fgVideo.paused) fgVideo.pause();

    // ⚡ Detener el bucle rAF del chroma → 0% CPU
    if (typeof window.stopChroma === 'function') {
      window.stopChroma();
    }

    console.log('⏸️ Chroma key detenido por completo (modo especial)');
  } catch (e) {
    console.warn('Error pausando animaciones:', e);
  }
}

// ===== REANUDAR ANIMACIONES DE FONDO =====
function reanudarAnimacionesFondo() {
  try {
    const isMobile = window.matchMedia('(max-width: 768px)').matches;

    if (!isMobile) {
      // ⚡ Reiniciar el bucle rAF del chroma
      if (typeof window.startChroma === 'function') {
        window.startChroma();
      }
      const fgVideo = document.getElementById('fgVideo');
      if (fgVideo) fgVideo.play().catch(() => {});
    }

    // Limpiar estilos inline residuales
    const cursor = document.getElementById('customCursor');
    if (cursor) {
      cursor.style.display = '';
      cursor.style.visibility = '';
      cursor.style.opacity = '';
    }

    const particles = document.getElementById('particlesCanvas');
    if (particles) {
      particles.style.display = '';
      particles.style.visibility = '';
      particles.style.opacity = '';
    }

    console.log('▶️ Animaciones de fondo reanudadas');
  } catch (e) {
    console.warn('Error reanudando animaciones:', e);
  }
}

// ===== ACTIVAR MODO ESPECIAL =====
function activarModoEspecial() {
  if (window.isSpecialMode) return;
  window.isSpecialMode = true;

  console.log('🌟 MODO ESPECIAL ACTIVADO');

  if (window.stopMusic && typeof window.stopMusic === 'function') {
    window.stopMusic();
  } else {
    if (window.currentAudio) {
      window.currentAudio.pause();
      window.currentAudio = null;
    }
    window.isMusicStarted = false;
  }

  const carousel = document.getElementById('bannerCarousel');
  const specialBanner = document.getElementById('specialBanner');
  const videoElement = document.getElementById('specialVideo');
  const bannerContainer = document.getElementById('bannerContainer');

  if (!carousel || !specialBanner || !videoElement || !bannerContainer) {
    console.error('Faltan elementos del banner especial');
    return;
  }

  carousel.style.display = 'none';
  bannerContainer.style.padding = '0';
  bannerContainer.style.margin = '0';
  bannerContainer.style.maxWidth = '100%';

  specialBanner.style.display = 'block';

  const isMobile = isMobileDevice();

  specialBanner.style.position = 'relative';
  specialBanner.style.width = '100%';
  specialBanner.style.maxWidth = '100%';
  specialBanner.style.margin = '0';
  specialBanner.style.padding = '0';
  specialBanner.style.borderRadius = '0';
  specialBanner.style.border = 'none';
  specialBanner.style.boxShadow = 'none';
  specialBanner.style.overflow = 'hidden';
  specialBanner.style.backgroundColor = '#000';

  if (isMobile) {
    specialBanner.style.height = 'auto';
    videoElement.style.width = '100%';
    videoElement.style.height = 'auto';
    videoElement.style.objectFit = 'contain';
    videoElement.style.display = 'block';
    videoElement.style.margin = '0 auto';
  } else {
    const navHeight = getNavHeight();
    specialBanner.style.height = `calc(100vh - ${navHeight}px)`;
    videoElement.style.width = '100%';
    videoElement.style.height = '100%';
    videoElement.style.objectFit = 'cover';
    videoElement.style.display = 'block';
  }

  const randomIndex = Math.floor(Math.random() * SPECIAL_VIDEOS.length);
  intentarReproducirVideo(videoElement, SPECIAL_VIDEOS, randomIndex);

  videoElement.loop = true;
  videoElement.muted = false;
  videoElement.volume = 0.9;

  specialBanner.classList.remove('special-exit');
  specialBanner.classList.add('special-enter');

  const playPromise = videoElement.play();
  if (playPromise !== undefined) {
    playPromise.then(() => {
      console.log('✅ Sonido activado');
    }).catch(() => {
      console.warn('⚠️ Autoplay bloqueado, mute temporal');
      videoElement.muted = true;
      videoElement.play().then(() => {
        const activateAudio = () => {
          videoElement.muted = false;
          videoElement.volume = 0.9;
          videoElement.play().catch(() => {});
          document.removeEventListener('click', activateAudio);
          document.removeEventListener('touchstart', activateAudio);
        };
        document.addEventListener('click', activateAudio, { once: true });
        document.addEventListener('touchstart', activateAudio, { once: true });
        specialBanner.addEventListener('click', activateAudio, { once: true });
      }).catch(err => console.error('Error al reproducir:', err));
    });
  }

  // Ocultar SOLO las animaciones que compiten con el tráiler.
  // El bg-video sigue corriendo.
  document.body.classList.add('special-mode');
  pausarAnimacionesFondo();

  const nav = document.querySelector('.cyber-nav');
  if (nav) {
    nav.style.position = 'relative';
    nav.style.zIndex = '1000';
  }
}

// ===== DESACTIVAR MODO ESPECIAL =====
function desactivarModoEspecial() {
  if (!window.isSpecialMode) return;
  window.isSpecialMode = false;

  const specialBanner = document.getElementById('specialBanner');
  const carousel = document.getElementById('bannerCarousel');
  const video = document.getElementById('specialVideo');
  const bannerContainer = document.getElementById('bannerContainer');
  const nav = document.querySelector('.cyber-nav');

  if (specialBanner) {
    specialBanner.classList.remove('special-enter');
    specialBanner.classList.add('special-exit');
    setTimeout(() => {
      specialBanner.style.display = 'none';
      specialBanner.classList.remove('special-exit');
      specialBanner.style.position = '';
      specialBanner.style.width = '';
      specialBanner.style.maxWidth = '';
      specialBanner.style.height = '';
      specialBanner.style.margin = '';
      specialBanner.style.padding = '';
      specialBanner.style.borderRadius = '';
      specialBanner.style.border = '';
      specialBanner.style.boxShadow = '';
      specialBanner.style.overflow = '';
      specialBanner.style.backgroundColor = '';
      if (video) {
        video.style.width = '';
        video.style.height = '';
        video.style.objectFit = '';
        video.style.display = '';
        video.style.margin = '';
        video.pause();
        video.src = '';
        video.removeEventListener('error', null);
        video.removeEventListener('loadeddata', null);
      }
    }, 600);
  }

  if (carousel) carousel.style.display = 'block';
  if (bannerContainer) {
    bannerContainer.style.padding = '';
    bannerContainer.style.margin = '';
    bannerContainer.style.maxWidth = '';
  }
  if (nav) {
    nav.style.position = '';
    nav.style.zIndex = '';
  }

  document.body.classList.remove('special-mode');
  reanudarAnimacionesFondo();

  if (window.startMusic && typeof window.startMusic === 'function') {
    window.startMusic();
  }
  console.log('🔇 Modo especial desactivado');
}

// ===== INIT =====
function initSpecialMode() {
  if (window.isSpecialMode) return;
  const shouldActivate = Math.random() < SPECIAL_PROBABILITY;
  if (shouldActivate) {
    activarModoEspecial();
  } else {
    console.log('🎵 Modo normal');

    const carousel = document.getElementById('bannerCarousel');
    if (carousel) carousel.style.display = 'block';

    const specialBanner = document.getElementById('specialBanner');
    if (specialBanner) specialBanner.style.display = 'none';

    // El bg-video se arranca desde index.html (startVisualMedia)
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initSpecialMode);
} else {
  initSpecialMode();
}

// Reajuste al redimensionar
window.addEventListener('resize', () => {
  if (window.isSpecialMode) {
    const banner = document.getElementById('specialBanner');
    const video = document.getElementById('specialVideo');
    if (banner && video) {
      const isMobile = isMobileDevice();
      if (isMobile) {
        banner.style.height = 'auto';
        video.style.height = 'auto';
        video.style.objectFit = 'contain';
      } else {
        const navHeight = getNavHeight();
        banner.style.height = `calc(100vh - ${navHeight}px)`;
        video.style.height = '100%';
        video.style.objectFit = 'cover';
      }
    }
  }
});

window.activarModoEspecial = activarModoEspecial;
window.desactivarModoEspecial = desactivarModoEspecial;