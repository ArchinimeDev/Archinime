/**
 * MODO ESPECIAL - ARCHINIME (VERSIÓN ADAPTATIVA CON REINTENTO)
 * - En PC: Ocupa toda la pantalla (fullscreen) con object-fit: cover
 * - En móviles: Se muestra como un banner normal, con object-fit: contain
 * - Si un video falla al cargar, intenta con el siguiente
 * - Probabilidad al 100% para pruebas (cambiar a 0.10 para producción)
 */

const SPECIAL_PROBABILITY = 1.0; // 100% para pruebas (0.10 en producción)
const SPECIAL_VIDEOS = [
  'https://cdn.jsdelivr.net/gh/ArchinimeDev/Archinime@main/assets/videos/atrevete.mp4',
  'https://cdn.jsdelivr.net/gh/ArchinimeDev/Archinime@main/assets/videos/baki.mp4',
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

// ===== FUNCIÓN PARA INTENTAR REPRODUCIR UN VIDEO, CON REINTENTO =====
function intentarReproducirVideo(videoElement, videoList, index) {
  // Si ya no hay más videos, salir
  if (index >= videoList.length) {
    console.error('❌ Todos los videos fallaron. Usando el primero como fallback.');
    // Forzar el primer video (puede que tampoco funcione, pero al menos lo intenta)
    videoElement.src = videoList[0];
    videoElement.load();
    videoElement.play().catch(() => {});
    return;
  }

  const src = videoList[index];
  console.log(`🎬 Intentando cargar: ${src}`);

  // Remover listeners anteriores para evitar acumulación
  videoElement.removeEventListener('error', onVideoError);
  videoElement.removeEventListener('loadeddata', onVideoLoaded);

  // Definir manejadores
  function onVideoError(e) {
    console.warn(`⚠️ Error al cargar ${src}, pasando al siguiente...`);
    // Intentar con el siguiente
    intentarReproducirVideo(videoElement, videoList, index + 1);
  }

  function onVideoLoaded() {
    console.log(`✅ Video cargado correctamente: ${src}`);
    // Reproducir
    videoElement.play().catch(() => {});
  }

  videoElement.addEventListener('error', onVideoError);
  videoElement.addEventListener('loadeddata', onVideoLoaded);

  // Asignar src y cargar
  videoElement.src = src;
  videoElement.load();
  // Si el video ya está en caché y se carga rápido, puede que no dispare 'loadeddata'
  // así que intentamos reproducir directamente
  videoElement.play().catch(() => {});
}

function activarModoEspecial() {
  if (window.isSpecialMode) return;
  window.isSpecialMode = true;

  console.log('🌟 MODO ESPECIAL ACTIVADO');

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
  const bannerContainer = document.getElementById('bannerContainer');

  if (!carousel || !specialBanner || !videoElement || !bannerContainer) {
    console.error('Faltan elementos del banner especial');
    return;
  }

  // Ocultar carrusel
  carousel.style.display = 'none';
  bannerContainer.style.padding = '0';
  bannerContainer.style.margin = '0';
  bannerContainer.style.maxWidth = '100%';

  // Mostrar banner especial
  specialBanner.style.display = 'block';

  const isMobile = isMobileDevice();

  // Estilos generales
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

  // Configuración según dispositivo
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

  // Elegir un índice aleatorio para empezar
  const randomIndex = Math.floor(Math.random() * SPECIAL_VIDEOS.length);
  // Empezar la reproducción con reintento
  intentarReproducirVideo(videoElement, SPECIAL_VIDEOS, randomIndex);

  videoElement.loop = true;
  videoElement.muted = false;
  videoElement.volume = 0.9;

  // Animación de entrada
  specialBanner.classList.remove('special-exit');
  specialBanner.classList.add('special-enter');

  // Reproducción con sonido (el reintento ya maneja la carga, pero el play puede fallar por autoplay)
  const playPromise = videoElement.play();
  if (playPromise !== undefined) {
    playPromise.then(() => {
      console.log('✅ Sonido activado');
    }).catch(error => {
      console.warn('⚠️ Autoplay bloqueado, mute temporal');
      videoElement.muted = true;
      videoElement.play().then(() => {
        // El usuario puede hacer clic en cualquier parte para activar el sonido
        const activateAudio = () => {
          videoElement.muted = false;
          videoElement.volume = 0.9;
          videoElement.play().then(() => {
            console.log('🔊 Sonido activado tras interacción');
          }).catch(() => {});
          document.removeEventListener('click', activateAudio);
          document.removeEventListener('touchstart', activateAudio);
        };
        document.addEventListener('click', activateAudio, { once: true });
        document.addEventListener('touchstart', activateAudio, { once: true });
        specialBanner.addEventListener('click', activateAudio, { once: true });
      }).catch(err => {
        console.error('Error al reproducir:', err);
      });
    });
  }

  document.body.classList.add('special-mode');

  const nav = document.querySelector('.cyber-nav');
  if (nav) {
    nav.style.position = 'relative';
    nav.style.zIndex = '1000';
  }
}

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
        video.style.margin = '';
        video.pause();
        video.src = '';
        // Eliminar listeners para evitar fugas
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

  if (window.startMusic && typeof window.startMusic === 'function') {
    window.startMusic();
  }
  console.log('🔇 Modo especial desactivado');
}

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