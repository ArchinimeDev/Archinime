// state.js - Central de estado y eventos
// Mejorado: persistencia en localStorage para algunas claves, más eventos

window.ArchinimeState = (function() {
  const STORAGE_KEY = 'archinime_state';

  // Cargar estado desde localStorage (solo para algunas claves)
  let savedState = {};
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) savedState = JSON.parse(stored);
  } catch(e) {}

  let state = {
    currentUser: null,
    currentUserColor: null,
    comentariosAnimeId: null,
    comentariosSeason: null,
    comentariosEpisode: null,
    theme: 'dark',
    ...savedState
  };

  const listeners = {};

  function emit(event, data) {
    if (listeners[event]) {
      listeners[event].forEach(cb => {
        try { cb(data); } catch(e) { console.warn('Error en listener:', e); }
      });
    }
  }

  function on(event, callback) {
    if (!listeners[event]) listeners[event] = [];
    listeners[event].push(callback);
  }

  function off(event, callback) {
    if (listeners[event]) {
      listeners[event] = listeners[event].filter(cb => cb !== callback);
    }
  }

  function set(key, value) {
    if (state[key] !== value) {
      state[key] = value;
      emit(key, value);
      // Persistir algunas claves en localStorage
      if (['theme'].includes(key)) {
        try {
          const toStore = { theme: state.theme };
          localStorage.setItem(STORAGE_KEY, JSON.stringify(toStore));
        } catch(e) {}
      }
    }
  }

  function get(key) {
    return state[key];
  }

  // Escuchar cambios de autenticación si Firebase está disponible
  if (typeof firebase !== 'undefined' && firebase.auth) {
    firebase.auth().onAuthStateChanged(async (user) => {
      set('currentUser', user);
      if (user) {
        try {
          const userDoc = await firebase.firestore().collection('users').doc(user.uid).get();
          const color = userDoc.exists && userDoc.data().customColor ? userDoc.data().customColor : null;
          set('currentUserColor', color);
        } catch(e) { console.warn('Error al obtener color:', e); }
      } else {
        set('currentUserColor', null);
      }
    });
  }

  return {
    set,
    get,
    on,
    off
  };
})();