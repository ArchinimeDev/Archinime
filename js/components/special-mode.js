/**
 * MODO ESPECIAL - ARCHINIME (VERSIÓN FULLSCREEN)
 * - Banner ocupa 100vh (toda la pantalla)
 * - Video sin recortes (object-fit: cover en PC, contain en móviles)
 * - Reproducción automática con sonido
 * - Probabilidad al 100% para pruebas (cambiar a 0.10 para producción)
 */

// ===== CONFIGURACIÓN =====
const SPECIAL_PROBABILITY = 1.0; // 100% para pruebas (cambia a 0.10 para producción)

// Lista de videos para el modo especial (añade los que quieras)
const SPECIAL_VIDEOS = [
  'assets/videos/atrevete.mp4'
];

// Variable global para saber si el modo especial está activo
window.isSpecialMode = false;

// ===== DETECCIÓN DE MÓVIL =====
function isMobileDevice() {
  return window.innerWidth <= 768;
}

// ===== FUNCIÓN PRINCIPAL =====
function activarModoEspecial() {
  if (window.isSpecialMode) return;
  window.isSpecialMode = true;

  console.log('🌟 MODO ESPECIAL ACTIVADO (FULLSCREEN)');

  // 1. Detener la música de fondo
  if (window.stopMusic && typeof window.stopMusic === 'function') {
    window.stopMusic();
  } else {
    if (window.currentAudio) {
      window.currentAudio.pause();
      window.currentAudio = null;
    }
    window.isMusicStarted = false;
  }

  // 2. Obtener elementos del DOM
  const carousel = document.getElementById('bannerCarousel');
  const specialBanner = document.getElementById('specialBanner');
  const videoElement = document.getElementById('specialVideo');
  const audioIndicator = document.getElementById('specialAudioIndicator');

  if (!carousel || !specialBanner || !videoElement) {
    console.error('No se encontraron los elementos del banner especial');
    return;
  }

  // 3. Ocultar carrusel y mostrar banner especial con animación
  carousel.style.display = 'none';
  specialBanner.style.display = 'block';
  
  // Aplicar estilos para que el banner ocupe toda la pantalla
  specialBanner.style.width = '100%';
  specialBanner.style.maxWidth = '100%';
  specialBanner.style.height = isMobileDevice() ? '100dvh' : '100vh';
  specialBanner.style.borderRadius = '0';
  specialBanner.style.margin = '0';
  specialBanner.style.border = 'none';
  specialBanner.style.boxShadow = '0 0 60px rgba(0, 240, 255, 0.5)';
  specialBanner.style.position = 'relative';
  specialBanner.style.overflow = 'hidden';
  specialBanner.style.backgroundColor = '#000';
  
  // Añadir clase para animación de entrada
  specialBanner.classList.remove('special-exit');
  specialBanner.classList.add('special-enter');

  // 4. Elegir un video aleatorio de la lista
  const randomIndex = Math.floor(Math.random() * SPECIAL_VIDEOS.length);
  const videoSrc = SPECIAL_VIDEOS[randomIndex];
  videoElement.src = videoSrc;
  videoElement.loop = true;
  videoElement.muted = false;
  videoElement.volume = 0.9;
  videoElement.style.width = '100%';
  videoElement.style.height = '100%';
  // En móviles usar 'contain' para que se vea completo, en PC 'cover'
  videoElement.style.objectFit = isMobileDevice() ? 'contain' : 'cover';

  // 5. Función para actualizar el indicador de audio
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

  // 6. Intentar reproducir con sonido directamente
  const playPromise = videoElement.play();

  if (playPromise !== undefined) {
    playPromise.then(() => {
      console.log('✅ Video especial con sonido activado');
      updateAudioIndicator(true);
    }).catch(error => {
      console.warn('⚠️ Autoplay con sonido bloqueado. Reproduciendo con mute...');
      videoElement.muted = true;
      videoElement.play().then(() => {
        console.log('✅ Video especial con mute activado. Esperando interacción para sonido.');
        updateAudioIndicator(false);
        // Escuchar el primer clic en cualquier parte para activar sonido
        const activateAudio = () => {
          videoElement.muted = false;
          videoElement.volume = 0.9;
          videoElement.play().then(() => {
            console.log('🔊 Sonido activado tras interacción');
            updateAudioIndicator(true);
          }).catch(() => {
            console.warn('No se pudo activar el sonido tras clic');
          });
          document.removeEventListener('click', activateAudio);
          document.removeEventListener('touchstart', activateAudio);
        };
        document.addEventListener('click', activateAudio, { once: true });
        document.addEventListener('touchstart', activateAudio, { once: true });
        // También si el usuario hace clic en el banner
        specialBanner.addEventListener('click', activateAudio, { once: true });
      }).catch(err => {
        console.error('Error al reproducir incluso con mute:', err);
        updateAudioIndicator(false);
      });
    });
  }

  // 7. Añadir clase al body
  document.body.classList.add('special-mode');

  // 8. Ajustar el contenedor del banner para que no tenga márgenes laterales
  const bannerContainer = document.getElementById('bannerContainer');
  if (bannerContainer) {
    bannerContainer.style.padding = '0';
    bannerContainer.style.margin = '0';
    bannerContainer.style.maxWidth = '100%';
  }

  // 9. Asegurar que el navbar se vea por encima
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
      // Restaurar estilos originales
      specialBanner.style.width = '';
      specialBanner.style.maxWidth = '';
      specialBanner.style.height = '';
      specialBanner.style.borderRadius = '';
      specialBanner.style.margin = '';
      specialBanner.style.border = '';
      specialBanner.style.boxShadow = '';
      specialBanner.style.position = '';
      specialBanner.style.overflow = '';
      specialBanner.style.backgroundColor = '';
      if (video) {
        video.style.width = '';
        video.style.height = '';
        video.style.objectFit = '';
      }
    }, 600);
  }
  if (carousel) carousel.style.display = 'block';
  if (video) { video.pause(); video.src = ''; }
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

  // Reactivar la música
  if (window.startMusic && typeof window.startMusic === 'function') {
    window.startMusic();
  }
  console.log('🔇 Modo especial desactivado, música reanudada');
}

// ===== AUTO-EJECUCIÓN AL CARGAR =====
function initSpecialMode() {
  if (window.isSpecialMode) return;

  const shouldActivate = Math.random() < SPECIAL_PROBABILITY;
  if (shouldActivate) {
    activarModoEspecial();
  } else {
    console.log('🎵 Modo normal (sin modo especial)');
    const carousel = document.getElementById('bannerCarousel');
    if (carousel) carousel.style.display = 'block';
    const specialBanner = document.getElementById('specialBanner');
    if (specialBanner) specialBanner.style.display = 'none';
  }
}

// Ejecutar cuando el DOM esté listo
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initSpecialMode);
} else {
  initSpecialMode();
}

// ===== REAJUSTE AL CAMBIAR DE ORIENTACIÓN =====
window.addEventListener('resize', () => {
  if (window.isSpecialMode) {
    const video = document.getElementById('specialVideo');
    const banner = document.getElementById('specialBanner');
    if (video && banner) {
      const mobile = isMobileDevice();
      video.style.objectFit = mobile ? 'contain' : 'cover';
      banner.style.height = mobile ? '100dvh' : '100vh';
    }
  }
});

// Exponer funciones globalmente
window.activarModoEspecial = activarModoEspecial;
window.desactivarModoEspecial = desactivarModoEspecial;