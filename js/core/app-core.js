// app-core.js
// Inicialización central de Firebase y estado del usuario
// v24.3 - Modal de perfil rediseñado: círculo sólido + paleta nativa + presets + chip hex
// v24.2 - (revertido) botón "Opciones" vuelve a abrir modal interno

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

// Colores preset para el modal
const PRESET_COLORS_MODAL = ['#00f0ff', '#b114ff', '#ff1a6b', '#ffd700', '#00ff33', '#00aaff'];

// ========== UTILIDADES ==========
function getNeonColor(str) {
  const colors = ['#00f0ff','#ff1a6b','#b114ff','#ffd700','#00ff33','#ffaa00'];
  let h = 0;
  for (let i = 0; i < (str || '').length; i++) h = str.charCodeAt(i) + ((h << 5) - h);
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

function firestoreTimestampToMs(ts) {
  if (!ts) return 0;
  if (typeof ts.toMillis === 'function') return ts.toMillis();
  if (typeof ts.seconds === 'number') return ts.seconds * 1000;
  if (typeof ts === 'number') return ts;
  return 0;
}

function setProfileStatus(msg, color) {
  const el = document.getElementById('profileStatusMsg');
  if (!el) {
    console.log('[profileStatus]', msg);
    return;
  }
  el.style.color = color || 'var(--neon-blue)';
  el.textContent = msg;
  if (msg) {
    el.style.background = 'rgba(0,0,0,0.5)';
    el.style.border = `1px solid ${color || 'var(--neon-blue)'}`;
    el.style.boxShadow = `0 0 15px ${color || 'var(--neon-blue)'}`;
  } else {
    el.style.background = 'transparent';
    el.style.border = 'none';
    el.style.boxShadow = 'none';
  }
}

// ========== PRESETS + PREVIEW DE COLOR EN EL MODAL ==========
function renderProfileColorPresets(activeColor) {
  const container = document.getElementById('profileColorPresets');
  if (!container) return;
  container.innerHTML = '';
  PRESET_COLORS_MODAL.forEach(color => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'preset-dot' + (color.toLowerCase() === (activeColor || '').toLowerCase() ? ' active' : '');
    btn.style.background = color;
    btn.style.color = color;
    btn.dataset.color = color;
    btn.title = color.toUpperCase();
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const input = document.getElementById('profileNameColor');
      if (input) input.value = color;
      updateProfileColorPreview(color);
    });
    container.appendChild(btn);
  });
}

function updateProfileColorPreview(color) {
  // Círculo sólido del modal
  const circle = document.getElementById('profileColorCircle');
  if (circle) {
    circle.style.background = color;
    circle.style.boxShadow = `0 0 0 3px rgba(255,255,255,0.08), 0 0 18px ${color}, 0 0 32px ${color}`;
  }
  // Dot del chip hex
  const dot = document.getElementById('profileColorDot');
  if (dot) {
    dot.style.background = color;
    dot.style.boxShadow = `0 0 10px ${color}, 0 0 18px ${color}80`;
  }
  // Texto HEX
  const hexText = document.getElementById('profileColorHexText');
  if (hexText) hexText.textContent = (color || '#00F0FF').toUpperCase();
  // Avatar del modal
  const avatar = document.getElementById('profileAvatar');
  if (avatar) {
    avatar.style.borderColor = color;
    avatar.style.boxShadow = `0 0 25px ${color}80, 0 0 45px ${color}40`;
  }
  // Marcar preset activo
  document.querySelectorAll('#profileColorPresets .preset-dot').forEach(el => {
    if ((el.dataset.color || '').toLowerCase() === (color || '').toLowerCase()) {
      el.classList.add('active');
    } else {
      el.classList.remove('active');
    }
  });
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
    if (dName) dName.textContent = user.displayName || (user.email ? user.email.split('@')[0] : 'Usuario');
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

  const sidePanel = document.getElementById('sidePanel');
  if (sidePanel && sidePanel.classList.contains('open') && typeof window.actualizarEstadoChatPanel === 'function') {
    window.actualizarEstadoChatPanel();
  }

  document.dispatchEvent(new CustomEvent('userChanged', { detail: { user } }));
}

auth.onAuthStateChanged(updateUserUI);

// ========== FUNCIONES DE AUTENTICACIÓN ==========
async function loginWithEmail() {
  const emailEl = document.getElementById('loginEmail');
  const passEl = document.getElementById('loginPassword');
  if (!emailEl || !passEl) return;
  const email = emailEl.value;
  const pass = passEl.value;
  try {
    await auth.signInWithEmailAndPassword(email, pass);
    closeAuthModal();
  } catch (e) {
    const errEl = document.getElementById('authError');
    if (errEl) errEl.textContent = e.message;
  }
}

async function registerWithEmail() {
  const emailEl = document.getElementById('registerEmail');
  const passEl = document.getElementById('registerPassword');
  const confEl = document.getElementById('registerConfirm');
  if (!emailEl || !passEl || !confEl) return;
  const email = emailEl.value;
  const pass = passEl.value;
  const conf = confEl.value;
  if (pass !== conf) {
    const errEl = document.getElementById('authError');
    if (errEl) errEl.textContent = 'Las contraseñas no coinciden';
    return;
  }
  try {
    await auth.createUserWithEmailAndPassword(email, pass);
    closeAuthModal();
  } catch (e) {
    const errEl = document.getElementById('authError');
    if (errEl) errEl.textContent = e.message;
  }
}

async function loginWithGoogle() {
  try {
    await auth.signInWithPopup(providerGoogle);
    closeAuthModal();
  } catch (e) {
    const errEl = document.getElementById('authError');
    if (errEl) errEl.textContent = e.message;
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
  newAvatarUrl = currentUser.photoURL || null;
  const uidInput = document.getElementById('profileUid');
  if (uidInput) uidInput.value = currentUser.uid;
  const nameInput = document.getElementById('profileDisplayName');
  if (nameInput) nameInput.value = currentUser.displayName || (currentUser.email ? currentUser.email.split('@')[0] : 'Usuario');

  // Color inicial + render de presets + preview
  let initialColor = getNeonColor(currentUser.uid);
  const colorInput = document.getElementById('profileNameColor');
  if (colorInput) colorInput.value = initialColor;

  db.collection('users').doc(currentUser.uid).get().then(doc => {
    const color = doc.exists && doc.data().customColor ? doc.data().customColor : getNeonColor(currentUser.uid);
    if (colorInput) colorInput.value = color;
    if (doc.exists && doc.data().lastProfileUpdate) {
      lastProfileUpdate = firestoreTimestampToMs(doc.data().lastProfileUpdate);
      console.log('📅 lastProfileUpdate:', new Date(lastProfileUpdate));
    } else {
      lastProfileUpdate = 0;
    }
    updateProfileColorPreview(color);
    renderProfileColorPresets(color);
  }).catch(console.error);

  // Render inmediato con el color por defecto (mientras llega Firestore)
  updateProfileColorPreview(initialColor);
  renderProfileColorPresets(initialColor);

  setProfileStatus('');
  const modal = document.getElementById('profileModal');
  if (modal) modal.classList.add('show');
  disableBodyScroll();
}

function closeProfileModal() {
  const modal = document.getElementById('profileModal');
  if (modal) modal.classList.remove('show');
  enableBodyScroll();
  setProfileStatus('');
}

function copiarUID() {
  const uidEl = document.getElementById('profileUid');
  if (!uidEl) return;
  const uid = uidEl.value;
  if (!uid) return;
  navigator.clipboard.writeText(uid).then(() => {
    setProfileStatus('¡ID copiado!', 'var(--neon-blue)');
    setTimeout(() => {
      const msg = document.getElementById('profileStatusMsg');
      if (msg && msg.textContent.includes('copiado')) setProfileStatus('');
    }, 3000);
  }).catch(() => {
    setProfileStatus('No se pudo copiar el ID.', 'var(--neon-pink)');
  });
}

async function guardarCambiosPerfil() {
  console.log('🟡 guardarCambiosPerfil invocado');

  if (!currentUser) {
    console.warn('guardarCambiosPerfil: currentUser es null');
    setProfileStatus('⚠️ No hay sesión activa.', 'var(--neon-pink)');
    return;
  }

  const btn = document.getElementById('profileSaveBtn');
  const nameInput = document.getElementById('profileDisplayName');
  const colorInput = document.getElementById('profileNameColor');

  if (!nameInput || !colorInput) {
    console.error('❌ Faltan inputs del perfil (profileDisplayName / profileNameColor)');
    setProfileStatus('Error: campos del formulario no encontrados.', 'var(--neon-pink)');
    return;
  }

  const name = nameInput.value.trim();
  const color = colorInput.value;

  if (!name) {
    setProfileStatus('El nombre no puede estar vacío.', 'var(--neon-pink)');
    return;
  }

  const isAdmin = currentUser.email === 'archinime12@gmail.com';
  const now = Date.now();
  const fiveDays = 5 * 24 * 60 * 60 * 1000;
  if (!isAdmin && lastProfileUpdate > 0 && (now - lastProfileUpdate < fiveDays)) {
    const days = Math.ceil((fiveDays - (now - lastProfileUpdate)) / (1000 * 60 * 60 * 24));
    setProfileStatus(`⏳ Espera ${days} día(s) para cambiar de nuevo.`, 'var(--neon-pink)');
    console.warn('⏳ Cooldown activo. Última actualización:', new Date(lastProfileUpdate));
    return;
  }

  if (btn) {
    btn.disabled = true;
    btn.textContent = 'GUARDANDO...';
  }
  setProfileStatus('Guardando cambios...', 'var(--neon-blue)');

  try {
    const profileUpdates = { displayName: name };
    if (newAvatarUrl && typeof newAvatarUrl === 'string' && newAvatarUrl.startsWith('http')) {
      profileUpdates.photoURL = newAvatarUrl;
    }
    console.log('📝 profileUpdates:', profileUpdates);
    await currentUser.updateProfile(profileUpdates);
    console.log('✅ updateProfile OK');

    await db.collection('users').doc(currentUser.uid).set({
      customColor: color,
      lastProfileUpdate: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
    console.log('✅ Firestore set OK');

    try {
      setProfileStatus('Actualizando comentarios...', 'var(--neon-blue)');
      const commentsRef = db.collection('comments').where('userId', '==', currentUser.uid);
      const snap = await commentsRef.get();
      const batch = db.batch();
      snap.forEach(d => batch.update(d.ref, {
        userName: name,
        userAvatar: newAvatarUrl || currentUser.photoURL || 'assets/img/invitado.avif',
        customColor: color
      }));
      if (snap.size > 0) await batch.commit();
      console.log('✅ Comentarios actualizados:', snap.size);
    } catch (commentsErr) {
      console.warn('⚠️ No se pudieron actualizar comentarios históricos:', commentsErr);
    }

    lastProfileUpdate = Date.now();
    setProfileStatus('✅ ¡Cambios guardados exitosamente!', 'var(--neon-blue)');

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

    currentUser.displayName = name;
    if (profileUpdates.photoURL) currentUser.photoURL = profileUpdates.photoURL;

    if (window.ArchinimeState) {
      window.ArchinimeState.set('currentUser', currentUser);
      window.ArchinimeState.set('currentUserColor', color);
    }

  } catch (err) {
    console.error('❌ Error al guardar perfil:', err);
    setProfileStatus('Error al guardar: ' + (err.message || 'desconocido'), 'var(--neon-pink)');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = 'GUARDAR CAMBIOS';
    }
  }
}

// ========== SETUP DE LISTENERS ==========
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
          setProfileStatus('Avatar subido. Pulsa GUARDAR para aplicar.', 'var(--neon-blue)');
        }
      } catch (err) {
        alert('Error al subir');
      } finally {
        if (label) label.innerHTML = '<i class="fas fa-upload"></i> Subir avatar';
      }
    });
  }

  // Listener del color picker nativo → actualiza preview en vivo
  const colorInput = document.getElementById('profileNameColor');
  if (colorInput) {
    colorInput.addEventListener('input', (e) => updateProfileColorPreview(e.target.value));
    colorInput.addEventListener('change', (e) => updateProfileColorPreview(e.target.value));
  }

  // Click en el header del dropdown → abre el modal
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
window.updateProfileColorPreview = updateProfileColorPreview;
window.renderProfileColorPresets = renderProfileColorPresets;

console.log('✅ app-core.js cargado correctamente (v24.3)');