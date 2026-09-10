// app-core.js
// Inicialización central de Firebase y estado del usuario
// ACTUALIZADO: Single source of truth para Firebase + Auth + Profile

// ========== CONFIGURACIÓN DE FIREBASE ==========
const firebaseConfig = {
  apiKey: "AIzaSyBpzYARIxaJijLbbL-2S6F9MWecbAbvK_I",
  authDomain: "login-admin-archinime.firebaseapp.com",
  projectId: "login-admin-archinime",
  storageBucket: "login-admin-archinime.firebasestorage.app",
  messagingSenderId: "938164660242",
  appId: "1:938164660242:web:648e0dce0e0d18dd78d0cb"
};

if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

const auth = firebase.auth();
const db = firebase.firestore();
window.auth = auth;
window.db = db;

auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);
const providerGoogle = new firebase.auth.GoogleAuthProvider();
window.providerGoogle = providerGoogle;

// ========== ESTADO ==========
let currentUser = null;
let newAvatarUrl = null;
let lastProfileUpdate = 0;
window.currentUser = null;
const CLOUDINARY_URL = 'https://api.cloudinary.com/v1_1/dbcqcai1q/upload';
const CLOUDINARY_PRESET = 'stickers_archinime';

// ========== UTILIDADES ==========
function getNeonColor(str) {
  const colors = ['#00f0ff','#ff1a6b','#b114ff','#ffd700','#00ff33','#ffaa00'];
  let h = 0;
  for (let i = 0; i < str.length; i++) h = str.charCodeAt(i) + ((h << 5) - h);
  return colors[Math.abs(h) % colors.length];
}

function disableBodyScroll() {
  const sw = window.innerWidth - document.documentElement.clientWidth;
  document.body.style.paddingRight = sw + 'px';
  document.body.classList.add('modal-open');
}

function enableBodyScroll() {
  document.body.style.paddingRight = '';
  document.body.classList.remove('modal-open');
}

// ========== UI DEL USUARIO ==========
function updateUserUI(user) {
  currentUser = user;
  window.currentUser = user;

  const avatar = document.getElementById('userAvatarBtn');
  const dAvatar = document.getElementById('dropdownAvatar');
  const dName = document.getElementById('dropdownName');
  const loginItem = document.getElementById('loginBtnItem');

  if (user) {
    const photo = user.photoURL || 'assets/img/invitado.avif';
    if (avatar) avatar.src = photo;
    if (dAvatar) dAvatar.src = photo;
    if (dName) dName.textContent = user.displayName || user.email.split('@')[0];
    if (loginItem) {
      loginItem.innerHTML = '<i class="fas fa-sign-out-alt"></i> Cerrar sesión';
      loginItem.onclick = logoutUser;
    }
    db.collection('users').doc(user.uid).get().then(doc => {
      const color = doc.exists && doc.data().customColor ? doc.data().customColor : getNeonColor(user.uid);
      if (avatar) {
        avatar.style.borderColor = color;
        avatar.style.boxShadow = `0 0 20px ${color}`;
      }
      if (dAvatar) {
        dAvatar.style.borderColor = color;
        dAvatar.style.boxShadow = `0 0 20px ${color}`;
      }
      if (dName) {
        dName.style.color = color;
        dName.style.textShadow = `0 0 10px ${color}`;
      }
    }).catch(console.error);
  } else {
    if (avatar) { avatar.src = 'assets/img/invitado.avif'; avatar.style.borderColor = 'var(--neon-blue)'; avatar.style.boxShadow = 'none'; }
    if (dAvatar) { dAvatar.src = 'assets/img/invitado.avif'; dAvatar.style.borderColor = 'var(--neon-blue)'; dAvatar.style.boxShadow = 'none'; }
    if (dName) { dName.textContent = 'Invitado'; dName.style.color = 'var(--neon-blue)'; dName.style.textShadow = 'none'; }
    if (loginItem) {
      loginItem.innerHTML = '<i class="fas fa-sign-in-alt"></i> Iniciar sesión';
      loginItem.onclick = showAuthModal;
    }
  }

  // Actualizar chat si el panel está abierto
  const sidePanel = document.getElementById('sidePanel');
  if (sidePanel && sidePanel.classList.contains('open') && typeof window.actualizarEstadoChatPanel === 'function') {
    window.actualizarEstadoChatPanel();
  }

  // Disparar evento para otros scripts
  document.dispatchEvent(new CustomEvent('userChanged', { detail: { user } }));
}

auth.onAuthStateChanged(updateUserUI);

// ========== FUNCIONES DE AUTENTICACIÓN ==========
async function loginWithEmail() {
  const email = document.getElementById('loginEmail').value;
  const pass = document.getElementById('loginPassword').value;
  try {
    await auth.signInWithEmailAndPassword(email, pass);
    closeAuthModal();
  } catch (e) {
    const errEl = document.getElementById('authError');
    if (errEl) errEl.textContent = e.message;
  }
}

async function registerWithEmail() {
  const email = document.getElementById('registerEmail').value;
  const pass = document.getElementById('registerPassword').value;
  const conf = document.getElementById('registerConfirm').value;
  if (pass !== conf) {
    document.getElementById('authError').textContent = 'Las contraseñas no coinciden';
    return;
  }
  try {
    await auth.createUserWithEmailAndPassword(email, pass);
    closeAuthModal();
  } catch (e) {
    document.getElementById('authError').textContent = e.message;
  }
}

async function loginWithGoogle() {
  try {
    await auth.signInWithPopup(providerGoogle);
    closeAuthModal();
  } catch (e) {
    document.getElementById('authError').textContent = e.message;
  }
}

function logoutUser() {
  auth.signOut().then(() => location.reload());
}

// ========== MODALES DE AUTH ==========
function showAuthModal() {
  const modal = document.getElementById('authModal');
  if (modal) modal.classList.add('show');
  disableBodyScroll();
}

function closeAuthModal() {
  const modal = document.getElementById('authModal');
  if (modal) modal.classList.remove('show');
  enableBodyScroll();
  const errEl = document.getElementById('authError');
  if (errEl) errEl.textContent = '';
}

// ========== MODAL DE PERFIL ==========
function showProfileModal() {
  if (!currentUser) {
    showAuthModal();
    const errEl = document.getElementById('authError');
    if (errEl) errEl.textContent = "⚠️ Inicia sesión para configurar.";
    return;
  }
  const avatar = document.getElementById('profileAvatar');
  if (avatar) avatar.src = currentUser.photoURL || 'assets/img/invitado.avif';
  newAvatarUrl = currentUser.photoURL;
  const uidInput = document.getElementById('profileUid');
  if (uidInput) uidInput.value = currentUser.uid;
  const nameInput = document.getElementById('profileDisplayName');
  if (nameInput) nameInput.value = currentUser.displayName || currentUser.email.split('@')[0];
  
  db.collection('users').doc(currentUser.uid).get().then(doc => {
    const color = doc.exists && doc.data().customColor ? doc.data().customColor : getNeonColor(currentUser.uid);
    const colorInput = document.getElementById('profileNameColor');
    if (colorInput) colorInput.value = color;
    if (doc.exists && doc.data().lastProfileUpdate) lastProfileUpdate = doc.data().lastProfileUpdate.toMillis();
  }).catch(console.error);
  
  const modal = document.getElementById('profileModal');
  if (modal) modal.classList.add('show');
  disableBodyScroll();
}

function closeProfileModal() {
  const modal = document.getElementById('profileModal');
  if (modal) modal.classList.remove('show');
  enableBodyScroll();
}

function copiarUID() {
  const uid = document.getElementById('profileUid').value;
  if (!uid) return;
  navigator.clipboard.writeText(uid);
  const msg = document.getElementById('profileStatusMsg');
  if (!msg) return;
  msg.style.color = 'var(--neon-blue)';
  msg.textContent = '¡ID copiado!';
  setTimeout(() => {
    if (msg.textContent.includes('copiado')) msg.textContent = '';
  }, 3000);
}

async function guardarCambiosPerfil() {
  if (!currentUser) return;
  const btn = document.getElementById('profileSaveBtn');
  const msg = document.getElementById('profileStatusMsg');
  const name = document.getElementById('profileDisplayName').value.trim();
  const color = document.getElementById('profileNameColor').value;
  
  if (!name) {
    msg.style.color = 'var(--neon-pink)';
    msg.textContent = 'El nombre no puede estar vacío.';
    return;
  }

  const isAdmin = currentUser.email === 'archinime12@gmail.com';
  const now = Date.now();
  const fiveDays = 5 * 24 * 60 * 60 * 1000;
  if (!isAdmin && lastProfileUpdate > 0 && (now - lastProfileUpdate < fiveDays)) {
    const days = Math.ceil((fiveDays - (now - lastProfileUpdate)) / (1000 * 60 * 60 * 24));
    msg.style.color = 'var(--neon-pink)';
    msg.textContent = `⏳ Espera ${days} días para cambiar de nuevo.`;
    return;
  }

  btn.disabled = true;
  btn.textContent = 'GUARDANDO...';
  msg.textContent = '';

  try {
    await currentUser.updateProfile({ displayName: name, photoURL: newAvatarUrl });
    await db.collection('users').doc(currentUser.uid).set({
      customColor: color,
      lastProfileUpdate: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

    const commentsRef = db.collection('comments').where('userId', '==', currentUser.uid);
    const snap = await commentsRef.get();
    const batch = db.batch();
    snap.forEach(d => batch.update(d.ref, { userName: name, userAvatar: newAvatarUrl, customColor: color }));
    if (snap.size > 0) await batch.commit();

    lastProfileUpdate = Date.now();
    msg.style.color = 'var(--neon-blue)';
    msg.textContent = '¡Cambios guardados!';

    const userAvatarBtn = document.getElementById('userAvatarBtn');
    const dropdownAvatar = document.getElementById('dropdownAvatar');
    const dropdownName = document.getElementById('dropdownName');
    if (userAvatarBtn) {
      userAvatarBtn.src = newAvatarUrl || 'assets/img/invitado.avif';
      userAvatarBtn.style.borderColor = color;
      userAvatarBtn.style.boxShadow = `0 0 20px ${color}`;
    }
    if (dropdownAvatar) {
      dropdownAvatar.src = newAvatarUrl || 'assets/img/invitado.avif';
      dropdownAvatar.style.borderColor = color;
      dropdownAvatar.style.boxShadow = `0 0 20px ${color}`;
    }
    if (dropdownName) {
      dropdownName.textContent = name;
      dropdownName.style.color = color;
      dropdownName.style.textShadow = `0 0 10px ${color}`;
    }
  } catch (err) {
    msg.style.color = 'var(--neon-pink)';
    msg.textContent = 'Error al guardar.';
    console.error(err);
  } finally {
    btn.disabled = false;
    btn.textContent = 'GUARDAR CAMBIOS';
  }
}

// ========== SETUP DE LISTENERS (cuando el DOM está listo) ==========
function setupAuthUI() {
  // Tabs de login/registro
  document.querySelectorAll('.auth-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      const target = tab.dataset.tab;
      const loginForm = document.getElementById('authLoginForm');
      const registerForm = document.getElementById('authRegisterForm');
      if (loginForm) loginForm.style.display = target === 'login' ? 'flex' : 'none';
      if (registerForm) registerForm.style.display = target === 'register' ? 'flex' : 'none';
    });
  });

  // Avatar en el modal de perfil
  const avatarInput = document.getElementById('profileAvatarInput');
  if (avatarInput) {
    avatarInput.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file || file.size > 2 * 1024 * 1024) {
        alert('Máximo 2 MB');
        e.target.value = '';
        return;
      }
      const label = document.querySelector('#profileModal .profile-upload-btn');
      if (label) label.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Subiendo...';
      try {
        const fd = new FormData();
        fd.append('file', file);
        fd.append('upload_preset', CLOUDINARY_PRESET);
        const res = await fetch(CLOUDINARY_URL, { method: 'POST', body: fd });
        const data = await res.json();
        if (data.secure_url) {
          newAvatarUrl = data.secure_url;
          const profAvatar = document.getElementById('profileAvatar');
          if (profAvatar) profAvatar.src = newAvatarUrl;
        }
      } catch (err) {
        alert('Error al subir');
      } finally {
        if (label) label.innerHTML = '<i class="fas fa-upload"></i> Subir avatar';
      }
    });
  }

  // Click en el header del dropdown para abrir perfil
  const profileDropdownBtn = document.getElementById('profileDropdownBtn');
  if (profileDropdownBtn) {
    profileDropdownBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      showProfileModal();
    });
  }

  // Toggle del dropdown de usuario
  const userAvatarBtn = document.getElementById('userAvatarBtn');
  if (userAvatarBtn) {
    userAvatarBtn.addEventListener('click', e => {
      e.stopPropagation();
      const dropdown = document.getElementById('userDropdown');
      if (dropdown) dropdown.classList.toggle('active');
    });
  }

  // Cerrar dropdown al hacer clic fuera
  document.addEventListener('click', e => {
    const dropdown = document.getElementById('userDropdown');
    if (dropdown && !e.target.closest('.user-menu')) {
      dropdown.classList.remove('active');
    }
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', setupAuthUI);
} else {
  setupAuthUI();
}

// ========== EXPOSICIÓN GLOBAL ==========
window.loginWithEmail = loginWithEmail;
window.registerWithEmail = registerWithEmail;
window.loginWithGoogle = loginWithGoogle;
window.logoutUser = logoutUser;
window.showAuthModal = showAuthModal;
window.closeAuthModal = closeAuthModal;
window.showProfileModal = showProfileModal;
window.closeProfileModal = closeProfileModal;
window.copiarUID = copiarUID;
window.guardarCambiosPerfil = guardarCambiosPerfil;
window.getNeonColor = getNeonColor;
window.disableBodyScroll = disableBodyScroll;
window.enableBodyScroll = enableBodyScroll;

console.log('✅ app-core.js cargado correctamente');