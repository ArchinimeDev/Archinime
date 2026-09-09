/* Archivo: musica_fondo.js 
   Lista de canciones (Nightcore/Anime) para el reproductor de fondo 
   (Rutas absolutas via CDN)
   Compatible con el Modo Especial (detiene la música cuando está activo)
*/

// ===== LISTA DE CANCIONES =====
const musicListGlobal = [
  'https://cdn.jsdelivr.net/gh/ArchinimeDev/Archinime@main/assets/music/Nightcore%20-%20How%20Do%20You%20Do%20(Remix)%20✕.mp3',
  'https://cdn.jsdelivr.net/gh/ArchinimeDev/Archinime@main/assets/music/Nightcore%20-%20Battlecry%20(Heart%20of%20Courage)%20(Lyrics).mp3',
  'https://cdn.jsdelivr.net/gh/ArchinimeDev/Archinime@main/assets/music/Nightcore%20-%20Centuries.mp3',
  'https://cdn.jsdelivr.net/gh/ArchinimeDev/Archinime@main/assets/music/Nightcore%20-%20Go%20Go%20Go%20Go!.mp3',
  'https://cdn.jsdelivr.net/gh/ArchinimeDev/Archinime@main/assets/music/Nightcore%20-%20How%20Do%20You%20Do%20(Remix)%20✕.mp3',
  'https://cdn.jsdelivr.net/gh/ArchinimeDev/Archinime@main/assets/music/Nightcore%20-%20Monster%20[NMV].mp3',
  'https://cdn.jsdelivr.net/gh/ArchinimeDev/Archinime@main/assets/music/Nightcore%20-%20PLAY%20x%20Unity%20x%20Faded%20Alan%20Walker%20(Mashup%20Switching%20Vocals)%20Lyrics.mp3',
  'https://cdn.jsdelivr.net/gh/ArchinimeDev/Archinime@main/assets/music/Nightcore%20-%20Sweet%20Little%20Bumblebee%20(lyric%20video).mp3',
  'https://cdn.jsdelivr.net/gh/ArchinimeDev/Archinime@main/assets/music/Nightcore%20-%20Take%20A%20Hint.mp3',
  'https://cdn.jsdelivr.net/gh/ArchinimeDev/Archinime@main/assets/music/Nightcore%20-%20Thunder%20(Gabry%20Ponte%2C%20LUM!X%2C%20Prezioso)%20-%20(Lyrics).mp3',
  'https://cdn.jsdelivr.net/gh/ArchinimeDev/Archinime@main/assets/music/Nightcore%20-%20When%20You%20Leave%20(Numa%20Numa).mp3',
  'https://cdn.jsdelivr.net/gh/ArchinimeDev/Archinime@main/assets/music/Nightcore%20-%20Yo%20y%20los%20que%20tuvieron%20etapa%20Vocaloid%20cuando%20suena.mp3',
  'https://cdn.jsdelivr.net/gh/ArchinimeDev/Archinime@main/assets/music/FLOW%20-%20HERO%20-Kibou%20no%20uta-.mp3',
  'https://cdn.jsdelivr.net/gh/ArchinimeDev/Archinime@main/assets/music/Caramella%20Girls.mp3'
];

// ===== VARIABLES GLOBALES =====
window.isMusicStarted = false;
window.currentAudio = null;

// ===== FUNCIÓN PARA REPRODUCIR LA SIGUIENTE CANCIÓN =====
function playNextTrack() {
  // Si la música no está iniciada o el modo especial está activo, no hacer nada
  if (!window.isMusicStarted || window.isSpecialMode) {
    return;
  }

  // Detener el audio actual si existe
  if (window.currentAudio) {
    window.currentAudio.pause();
    window.currentAudio.onended = null;
    window.currentAudio = null;
  }

  // Elegir una canción aleatoria de la lista
  const track = musicListGlobal[Math.floor(Math.random() * musicListGlobal.length)];
  if (!track) {
    // Si no hay canciones, reintentar después de un tiempo
    setTimeout(playNextTrack, 5000);
    return;
  }

  // Crear y reproducir el nuevo audio
  window.currentAudio = new Audio(track);
  window.currentAudio.volume = 0.25;
  window.currentAudio.onended = playNextTrack; // Reproducir siguiente al terminar

  window.currentAudio.play().catch((error) => {
    // Si falla la reproducción (ej. por política de autoplay), reintentar después de un tiempo
    console.warn('Error al reproducir música:', error);
    setTimeout(playNextTrack, 3000);
  });
}

// ===== INICIAR MÚSICA =====
function startMusic() {
  // Si el modo especial está activo, NO iniciar la música
  if (window.isSpecialMode) {
    console.log('🎵 Modo especial activo: música desactivada');
    return;
  }

  // Si ya está iniciada, no hacer nada
  if (window.isMusicStarted) return;

  window.isMusicStarted = true;
  console.log('🎵 Música de fondo iniciada');
  playNextTrack();
}

// ===== DETENER MÚSICA =====
function stopMusic() {
  if (window.currentAudio) {
    window.currentAudio.pause();
    window.currentAudio.onended = null;
    window.currentAudio = null;
  }
  window.isMusicStarted = false;
  console.log('🔇 Música detenida');
}

// ===== EXPONER FUNCIONES GLOBALMENTE =====
window.startMusic = startMusic;
window.stopMusic = stopMusic;

// ===== AUTO-INICIO AL CARGAR LA PÁGINA =====
// Se ejecuta cuando el DOM está listo, pero solo si el modo especial NO está activo.
// La verificación se hace dentro de startMusic().
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    // Pequeño retraso para asegurar que el modo especial se haya evaluado primero
    setTimeout(startMusic, 500);
  });
} else {
  setTimeout(startMusic, 500);
}

// También escuchar el evento de visibilidad para reanudar si el usuario vuelve a la pestaña
document.addEventListener('visibilitychange', () => {
  if (!document.hidden && window.isMusicStarted && window.currentAudio?.paused) {
    window.currentAudio.play().catch(() => {});
  }
});

console.log('🎵 Sistema de música de fondo cargado correctamente');