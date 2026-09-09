/**
 * MODO ESPECIAL - ARCHINIME (FULLSCREEN CON FONDO DESENFOCADO EN MÓVIL)
 * - En PC: video con object-fit: cover (rellena sin bordes)
 * - En móvil: video con object-fit: contain (se ve completo) + fondo desenfocado del mismo video
 * - Probabilidad al 100% para pruebas (cambiar a 0.10 para producción)
 */

const SPECIAL_PROBABILITY = 1.0; // 100% para pruebas (0.10 en producción)
const SPECIAL_VIDEOS = [
  'assets/videos/atrevete.mp4'
];

window.isSpecialMode = false;

function isMobileDevice() {
  return window.innerWidth <= 768;
}

function getNavHeight() {
  const nav = document.querySelector('.cyber-nav');
  return nav ? nav.offsetHeight : 68;
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
  const audioIndicator = document.getElementById('specialAudioIndicator');
  const bannerContainer = document.getElementById('bannerContainer');

  if (!carousel || !specialBanner || !videoElement || !bannerContainer) {
    console.error('Faltan elementos del banner especial');
    return;
  }

  // Ocultar carrusel y su contenedor
  carousel.style.display = 'none';
  bannerContainer.style.display = 'none';

  // Mostrar banner especial
  specialBanner.style.display = 'block';

  const navHeight = getNavHeight();
  const isMobile = isMobileDevice();

  // Configurar banner
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

  // Limpiar cualquier fondo previo
  const existingBg = specialBanner.querySelector('.special-bg-blur');
  if (existingBg) existingBg.remove();

  // En móvil: añadir fondo desenfocado detrás del video
  if (isMobile) {
    const bgBlur = document.createElement('div');
    bgBlur.className = 'special-bg-blur';
    bgBlur.style.position = 'absolute';
    bgBlur.style.top = '0';
    bgBlur.style.left = '0';
    bgBlur.style.width = '100%';
    bgBlur.style.height = '100%';
    bgBlur.style.overflow = 'hidden';
    bgBlur.style.zIndex = '0';
    bgBlur.style.background = '#000';

    const bgVideo = document.createElement('video');
    bgVideo.src = SPECIAL_VIDEOS[Math.floor(Math.random() * SPECIAL_VIDEOS.length)];
    bgVideo.muted = true;
    bgVideo.loop = true;
    bgVideo.playsInline = true;
    bgVideo.style.width = '100%';
    bgVideo.style.height = '100%';
    bgVideo.style.objectFit = 'cover';
    bgVideo.style.filter = 'blur(20px) brightness(0.6)';
    bgVideo.style.transform = 'scale(1.1)';
    bgVideo.style.display = 'block';
    bgVideo.autoplay = true;
    bgVideo.play().catch(() => {});

    bgBlur.appendChild(bgVideo);
    specialBanner.appendChild(bgBlur);
  }

  // Configurar video principal
  videoElement.style.position = 'relative';
  videoElement.style.zIndex = '1';
  videoElement.style.width = '100%';
  videoElement.style.height = '100%';
  // En móvil: contain para que se vea completo, en PC: cover para rellenar
  videoElement.style.objectFit = isMobile ? 'contain' : 'cover';
  videoElement.style.display = 'block';

  // Elegir video aleatorio
  const randomIndex = Math.floor(Math.random() * SPECIAL_VIDEOS.length);
  const videoSrc = SPECIAL_VIDEOS[randomIndex];
  videoElement.src = videoSrc;
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
        video.style.position = '';
        video.style.zIndex = '';
        video.style.width = '';
        video.style.height = '';
        video.style.objectFit = '';
        video.style.display = '';
        video.pause();
        video.src = '';
      }
      // Eliminar fondo desenfocado
      const bg = specialBanner.querySelector('.special-bg-blur');
      if (bg) bg.remove();
    }, 600);
  }

  if (carousel) carousel.style.display = 'block';
  if (bannerContainer) bannerContainer.style.display = '';

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
    const bannerContainer = document.getElementById('bannerContainer');
    if (bannerContainer) bannerContainer.style.display = '';
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initSpecialMode);
} else {
  initSpecialMode();
}

window.addEventListener('resize', () => {
  if (window.isSpecialMode) {
    const banner = document.getElementById('specialBanner');
    const video = document.getElementById('specialVideo');
    if (banner && video) {
      const navHeight = getNavHeight();
      banner.style.height = `calc(100vh - ${navHeight}px)`;
      const isMobile = isMobileDevice();
      video.style.objectFit = isMobile ? 'contain' : 'cover';
      // Actualizar fondo desenfocado si existe
      const bg = banner.querySelector('.special-bg-blur');
      if (bg && !isMobile) {
        bg.remove();
      } else if (!bg && isMobile) {
        // Recrear fondo si es necesario
        const newBg = document.createElement('div');
        newBg.className = 'special-bg-blur';
        newBg.style.position = 'absolute';
        newBg.style.top = '0';
        newBg.style.left = '0';
        newBg.style.width = '100%';
        newBg.style.height = '100%';
        newBg.style.overflow = 'hidden';
        newBg.style.zIndex = '0';
        newBg.style.background = '#000';
        const bgVideo = document.createElement('video');
        bgVideo.src = video.src;
        bgVideo.muted = true;
        bgVideo.loop = true;
        bgVideo.playsInline = true;
        bgVideo.style.width = '100%';
        bgVideo.style.height = '100%';
        bgVideo.style.objectFit = 'cover';
        bgVideo.style.filter = 'blur(20px) brightness(0.6)';
        bgVideo.style.transform = 'scale(1.1)';
        bgVideo.style.display = 'block';
        bgVideo.autoplay = true;
        bgVideo.play().catch(() => {});
        newBg.appendChild(bgVideo);
        banner.prepend(newBg);
      }
    }
  }
});

window.activarModoEspecial = activarModoEspecial;
window.desactivarModoEspecial = desactivarModoEspecial;