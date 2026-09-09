/**
 * MODO ESPECIAL - ARCHINIME (VERSIÓN FULLSCREEN SIN ESPACIOS)
 * - Ocupa todo el espacio disponible debajo del navbar
 * - Sin bordes negros, sin márgenes, sin scroll
 * - Probabilidad al 100% para pruebas (cambiar a 0.10 para producción)
 */

const SPECIAL_PROBABILITY = 1.0; // 100% para pruebas (0.10 en producción)
const SPECIAL_VIDEOS = [
  'assets/videos/atrevete.mp4'
];

window.isSpecialMode = false;

// ===== OBTENER ALTURA DEL NAVBAR =====
function getNavHeight() {
  const nav = document.querySelector('.cyber-nav');
  return nav ? nav.offsetHeight : 68;
}

// ===== ACTIVAR MODO ESPECIAL =====
function activarModoEspecial() {
  if (window.isSpecialMode) return;
  window.isSpecialMode = true;

  console.log('🌟 MODO ESPECIAL ACTIVADO (SIN ESPACIOS)');

  // Detener música
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
  const audioIndicator = document.getElementById('specialAudioIndicator');
  const bannerContainer = document.getElementById('bannerContainer');

  if (!carousel || !specialBanner || !videoElement || !bannerContainer) {
    console.error('Faltan elementos del banner especial');
    return;
  }

  // 1. Ocultar carrusel y su contenedor
  carousel.style.display = 'none';
  bannerContainer.style.display = 'none'; // ← CLAVE: elimina el espacio del contenedor

  // 2. Mostrar banner especial
  specialBanner.style.display = 'block';

  // 3. Forzar estilos para ocupar todo el espacio disponible
  const navHeight = getNavHeight();
  specialBanner.style.position = 'relative';
  specialBanner.style.width = '100%';
  specialBanner.style.maxWidth = '100%';
  specialBanner.style.height = `calc(100vh - ${navHeight}px)`;
  specialBanner.style.margin = '0';
  specialBanner.style.padding = '0';
  specialBanner.style.borderRadius = '0';
  specialBanner.style.border = 'none';
  specialBanner.style.boxShadow = 'none';
  specialBanner.style.overflow = 'hidden';
  specialBanner.style.backgroundColor = '#000';

  // 4. Configurar video
  videoElement.style.width = '100%';
  videoElement.style.height = '100%';
  videoElement.style.objectFit = 'cover';
  videoElement.style.display = 'block';

  // Elegir video aleatorio
  const randomIndex = Math.floor(Math.random() * SPECIAL_VIDEOS.length);
  videoElement.src = SPECIAL_VIDEOS[randomIndex];
  videoElement.loop = true;
  videoElement.muted = false;
  videoElement.volume = 0.9;

  // Animación de entrada
  specialBanner.classList.remove('special-exit');
  specialBanner.classList.add('special-enter');

  // Indicador de audio
  function updateAudioIndicator(hasAudio) {
    if (!audioIndicator) return;
    if (hasAudio) {
      audioIndicator.innerHTML = '<i class="fas fa-volume-up"></i><span class="indicator-text">Sonido activo</span>';
      audioIndicator.classList.remove('muted');
      audioIndicator.classList.add('active');
    } else {
      audioIndicator.innerHTML = '<i class="fas fa-volume-mute"></i><span class="indicator-text">Sin sonido</span>';
      audioIndicator.classList.remove('active');
      audioIndicator.classList.add('muted');
    }
  }

  // Intentar reproducción con sonido
  const playPromise = videoElement.play();
  if (playPromise !== undefined) {
    playPromise.then(() => {
      console.log('✅ Sonido activado');
      updateAudioIndicator(true);
    }).catch(error => {
      console.warn('⚠️ Autoplay bloqueado, mute temporal');
      videoElement.muted = true;
      videoElement.play().then(() => {
        updateAudioIndicator(false);
        const activateAudio = () => {
          videoElement.muted = false;
          videoElement.volume = 0.9;
          videoElement.play().then(() => {
            updateAudioIndicator(true);
          }).catch(() => {});
          document.removeEventListener('click', activateAudio);
          document.removeEventListener('touchstart', activateAudio);
        };
        document.addEventListener('click', activateAudio, { once: true });
        document.addEventListener('touchstart', activateAudio, { once: true });
        specialBanner.addEventListener('click', activateAudio, { once: true });
      }).catch(err => {
        console.error('Error al reproducir:', err);
        updateAudioIndicator(false);
      });
    });
  }

  document.body.classList.add('special-mode');

  // Asegurar que el navbar se vea por encima
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
      // Restaurar estilos
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
        video.pause();
        video.src = '';
      }
    }, 600);
  }

  // Restaurar carrusel y contenedor
  if (carousel) carousel.style.display = 'block';
  if (bannerContainer) {
    bannerContainer.style.display = ''; // volver a su estado original
  }

  if (nav) {
    nav.style.position = '';
    nav.style.zIndex = '';
  }

  document.body.classList.remove('special-mode');

  if (window.startMusic && typeof window.startMusic === 'function') {
    window.startMusic();
  }
  console.log('🔇 Modo especial desactivado');
}

// ===== INICIALIZACIÓN =====
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
    const bannerContainer = document.getElementById('bannerContainer');
    if (bannerContainer) bannerContainer.style.display = '';
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initSpecialMode);
} else {
  initSpecialMode();
}

// Reajuste al redimensionar (para cambiar altura del navbar)
window.addEventListener('resize', () => {
  if (window.isSpecialMode) {
    const banner = document.getElementById('specialBanner');
    if (banner) {
      const navHeight = getNavHeight();
      banner.style.height = `calc(100vh - ${navHeight}px)`;
    }
  }
});

// Exponer funciones
window.activarModoEspecial = activarModoEspecial;
window.desactivarModoEspecial = desactivarModoEspecial;