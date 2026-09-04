// app-core.js
// Inicialización central de Firebase y estado del usuario
// ACTUALIZADO: Usa ArchinimeState para el estado global

// ========== CONFIGURACIÓN DE FIREBASE ==========
const firebaseConfig = {
  apiKey: "AIzaSyBpzYARIxaJijLbbL-2S6F9MWecbAbvK_I",
  authDomain: "login-admin-archinime.firebaseapp.com",
  projectId: "login-admin-archinime",
  storageBucket: "login-admin-archinime.firebasestorage.app",
  messagingSenderId: "938164660242",
  appId: "1:938164660242:web:648e0dce0e0d18dd78d0cb"
};

// Inicializar Firebase solo si no está ya inicializado
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

// Establecer persistencia local para la sesión
firebase.auth().setPersistence(firebase.auth.Auth.Persistence.LOCAL);

// Exportar instancias globales
const auth = firebase.auth();
const db = firebase.firestore();

// ========== ESTADO GLOBAL DEL USUARIO ==========
// Variable de respaldo para compatibilidad con código antiguo
window.currentUser = null;

// Función para actualizar la UI en función del usuario (puedes sobrescribirla)
function updateUserUI(user) {
  // Esta función puede ser redefinida por otros scripts
  // Por defecto, simplemente actualiza window.currentUser
  window.currentUser = user;
  
  // Si existe un sistema de notificaciones, lo refrescamos
  if (user) {
    if (window.syncNotificationsWithCloud) {
      requestIdleCallback(() => window.syncNotificationsWithCloud(user.uid));
    }
    if (window.listenForReplies) {
      requestIdleCallback(() => window.listenForReplies(user.uid));
    }
  }
  
  // Disparar evento personalizado para que otros scripts reaccionen
  const event = new CustomEvent('userChanged', { detail: { user } });
  document.dispatchEvent(event);
}

// Escuchar cambios de autenticación y actualizar el estado central
auth.onAuthStateChanged(user => {
  // Actualizar variable de compatibilidad
  window.currentUser = user;
  
  // Actualizar el estado central si existe
  if (window.ArchinimeState) {
    window.ArchinimeState.set('currentUser', user);
  }
  
  // Llamar a la función de UI
  updateUserUI(user);
  
  // Sincronizar notificaciones y respuestas (si están disponibles)
  if (user) {
    if (window.syncNotificationsWithCloud) {
      requestIdleCallback(() => window.syncNotificationsWithCloud(user.uid));
    }
    if (window.listenForReplies) {
      requestIdleCallback(() => window.listenForReplies(user.uid));
    }
  } else {
    // Limpiar suscripciones si es necesario
    if (window.repliesUnsubscribe) window.repliesUnsubscribe();
  }
});

// ========== FUNCIONES DE AUTENTICACIÓN ==========
// (Conectan con los botones del modal)

window.loginWithEmail = async () => {
  const email = document.getElementById('loginEmail')?.value;
  const password = document.getElementById('loginPassword')?.value;
  if (!email || !password) {
    alert('Completa todos los campos');
    return;
  }
  try {
    await auth.signInWithEmailAndPassword(email, password);
    // Cerrar modal si existe
    const modal = document.getElementById('authModal');
    if (modal) modal.classList.remove('show');
  } catch (error) {
    console.error('Error en login:', error);
    const errorEl = document.getElementById('authError');
    if (errorEl) errorEl.innerText = error.message;
    else alert(error.message);
  }
};

window.registerWithEmail = async () => {
  const email = document.getElementById('registerEmail')?.value;
  const password = document.getElementById('registerPassword')?.value;
  const confirm = document.getElementById('registerConfirm')?.value;
  if (!email || !password || !confirm) {
    alert('Completa todos los campos');
    return;
  }
  if (password !== confirm) {
    alert('Las contraseñas no coinciden');
    return;
  }
  try {
    await auth.createUserWithEmailAndPassword(email, password);
    const modal = document.getElementById('authModal');
    if (modal) modal.classList.remove('show');
  } catch (error) {
    console.error('Error en registro:', error);
    const errorEl = document.getElementById('authError');
    if (errorEl) errorEl.innerText = error.message;
    else alert(error.message);
  }
};

window.loginWithGoogle = async () => {
  const provider = new firebase.auth.GoogleAuthProvider();
  try {
    await auth.signInWithPopup(provider);
    const modal = document.getElementById('authModal');
    if (modal) modal.classList.remove('show');
  } catch (error) {
    console.error('Error con Google:', error);
    const errorEl = document.getElementById('authError');
    if (errorEl) errorEl.innerText = error.message;
    else alert(error.message);
  }
};

window.loginWithGitHub = async () => {
  const provider = new firebase.auth.GithubAuthProvider();
  try {
    await auth.signInWithPopup(provider);
    const modal = document.getElementById('authModal');
    if (modal) modal.classList.remove('show');
  } catch (error) {
    console.error('Error con GitHub:', error);
    const errorEl = document.getElementById('authError');
    if (errorEl) errorEl.innerText = error.message;
    else alert(error.message);
  }
};

window.logout = async () => {
  try {
    await auth.signOut();
    // Opcional: recargar la página o redirigir
    // location.reload();
  } catch (error) {
    console.error('Error al cerrar sesión:', error);
  }
};

// ========== FUNCIÓN PARA MOSTRAR/MODAL DE AUTENTICACIÓN ==========
window.showAuthModal = () => {
  const modal = document.getElementById('authModal');
  if (modal) modal.classList.add('show');
};

window.closeAuthModal = () => {
  const modal = document.getElementById('authModal');
  if (modal) modal.classList.remove('show');
  const errorEl = document.getElementById('authError');
  if (errorEl) errorEl.innerText = '';
};

// ========== INICIALIZACIÓN ADICIONAL ==========
// Si el documento ya está cargado, ejecutar; si no, esperar
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    console.log('✅ app-core.js cargado y listo');
  });
} else {
  console.log('✅ app-core.js cargado y listo');
}