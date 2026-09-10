// state.js - Central de estado y eventos
// CORREGIDO: Espera a que Firebase esté inicializado antes de usarlo

window.ArchinimeState = (function() {
  const STORAGE_KEY = 'archinime_state';

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
    // 🔥 CLAVE: Si ya hay un valor para este evento, dispara el callback inmediatamente
    if (state[event] !== undefined && state[event] !== null) {
      try { callback(state[event]); } catch(e) { console.warn(e); }
    }
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

  // 🔥 CLAVE: Esperar a que Firebase esté inicializado
  function setupFirebaseListener() {
    if (typeof firebase === 'undefined' || !firebase.apps || !firebase.apps.length) {
      // Firebase aún no está listo, reintentar en un momento
      setTimeout(setupFirebaseListener, 50);
      return;
    }

    try {
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
    } catch (e) {
      console.warn('No se pudo registrar onAuthStateChanged en state.js:', e);
    }
  }

  setupFirebaseListener();

  return { set, get, on, off };
})();