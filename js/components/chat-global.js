// ============================================
// CHAT GLOBAL - ARCHINIME
// Sistema de mensajería en tiempo real
// Soporta texto, stickers, reacciones (like)
// ============================================

(function() {
  // --- Referencias a Firebase ---
  let db, auth;
  let currentUser = null;
  let mensajesUnsubscribe = null;
  let stickerSeleccionado = null;
  let chatIniciado = false;

  // Esperar a que Firebase esté listo
  function init() {
    if (typeof firebase === 'undefined' || !firebase.apps.length) {
      console.warn('Firebase no inicializado, reintentando...');
      setTimeout(init, 500);
      return;
    }
    db = firebase.firestore();
    auth = firebase.auth();

    // Escuchar cambios de usuario
    auth.onAuthStateChanged(user => {
      currentUser = user;
      updateChatUI();
      if (user) {
        // Cargar stickers del usuario (si existe la función)
        if (typeof loadUserStickers === 'function') {
          loadUserStickers();
        }
        // Si el modal está visible, iniciar escucha
        const modal = document.getElementById('chatModal');
        if (modal && modal.classList.contains('show')) {
          startListening();
        }
      } else {
        if (mensajesUnsubscribe) {
          mensajesUnsubscribe();
          mensajesUnsubscribe = null;
        }
        chatIniciado = false;
        const container = document.getElementById('chatMessages');
        if (container) {
          container.innerHTML = `
            <div style="text-align:center; padding:40px; color:var(--text-secondary);">
              <i class="fas fa-lock" style="font-size:2rem; display:block; margin-bottom:15px;"></i>
              Inicia sesión para ver y enviar mensajes.
            </div>
          `;
        }
      }
    });

    // Observar la apertura del modal con MutationObserver
    const modal = document.getElementById('chatModal');
    if (modal) {
      const observer = new MutationObserver(() => {
        if (modal.classList.contains('show')) {
          if (currentUser && !chatIniciado) {
            startListening();
          }
        } else {
          // Opcional: no cancelamos la suscripción al cerrar, para mantener mensajes al reabrir
          // pero podemos mantenerla activa.
        }
      });
      observer.observe(modal, { attributes: true, attributeFilter: ['class'] });
    }

    // Exponer función para iniciar el chat desde fuera
    window.iniciarChatGlobal = function() {
      if (currentUser && !chatIniciado) {
        startListening();
      }
    };
  }

  function startListening() {
    if (!db) return;
    if (mensajesUnsubscribe) mensajesUnsubscribe();
    if (!currentUser) return;

    chatIniciado = true;
    const query = db.collection('globalChat')
      .orderBy('timestamp', 'desc')
      .limit(100);

    mensajesUnsubscribe = query.onSnapshot(snapshot => {
      const container = document.getElementById('chatMessages');
      if (!container) return;

      if (snapshot.empty) {
        container.innerHTML = `
          <div style="text-align:center; padding:40px; color:var(--text-secondary);">
            <i class="fas fa-comment-dots" style="font-size:2rem; display:block; margin-bottom:15px;"></i>
            No hay mensajes aún. ¡Sé el primero en hablar!
          </div>
        `;
        return;
      }

      const docs = snapshot.docs.reverse();
      let html = '';
      docs.forEach(doc => {
        const data = doc.data();
        const userName = data.userName || 'Usuario';
        const userAvatar = data.userAvatar || 'invitado.avif';
        const texto = data.texto || '';
        const timestamp = data.timestamp?.toDate() || new Date();
        const fecha = timestamp.toLocaleString();
        const esSticker = data.esSticker || false;
        const stickerUrl = data.stickerUrl || null;
        const customColor = data.customColor || getNeonColor(data.userId || userName);
        const uid = data.userId || '';

        let contenido = escapeHtml(texto);
        contenido = contenido.replace(/\n/g, '<br>');
        const emojis = { ':D': '😃', ':)': '😊', ':(': '😢', ':P': '😛', ';)': '😉', '<3': '❤️' };
        for (const [key, val] of Object.entries(emojis)) {
          contenido = contenido.split(key).join(val);
        }

        let stickerHtml = '';
        if (esSticker && stickerUrl) {
          const isVideo = stickerUrl.match(/\.(mp4|webm)$/i);
          const tag = isVideo ? 'video autoplay loop muted playsinline' : 'img';
          stickerHtml = `
            <div class="chat-sticker-wrapper" style="margin-top:8px; border-radius:12px; overflow:hidden; max-width:150px; border:1px solid ${customColor};">
              <${tag} src="${stickerUrl}" style="width:100%; height:auto; display:block;" onclick="window.abrirStickerModal('${stickerUrl}')">
            </div>
          `;
        }

        const isOwner = currentUser && currentUser.uid === uid;
        const deleteBtn = isOwner ? `
          <button class="chat-delete-msg" data-id="${doc.id}" style="background:transparent; border:none; color:#ff0055; cursor:pointer; font-size:0.7rem; margin-left:12px;">
            <i class="fas fa-trash"></i>
          </button>
        ` : '';

        html += `
          <div class="chat-message" data-id="${doc.id}" style="display:flex; gap:12px; padding:12px 16px; border-bottom:1px solid rgba(255,255,255,0.03); align-items:flex-start;">
            <img src="${userAvatar}" style="width:40px; height:40px; border-radius:50%; border:2px solid ${customColor}; object-fit:cover; flex-shrink:0;">
            <div style="flex:1; min-width:0;">
              <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
                <span style="font-weight:700; color:${customColor}; text-shadow:0 0 8px ${customColor}40;">${escapeHtml(userName)}</span>
                <span style="font-size:0.65rem; color:var(--text-secondary);">${fecha}</span>
                ${deleteBtn}
              </div>
              <div style="word-wrap:break-word; margin-top:4px;">${contenido}</div>
              ${stickerHtml}
            </div>
          </div>
        `;
      });

      container.innerHTML = html;
      container.scrollTop = container.scrollHeight;

      container.querySelectorAll('.chat-delete-msg').forEach(btn => {
        btn.addEventListener('click', function(e) {
          e.stopPropagation();
          const id = this.dataset.id;
          if (confirm('¿Eliminar este mensaje?')) {
            eliminarMensaje(id);
          }
        });
      });
    }, error => {
      console.error('Error en chat global:', error);
      const container = document.getElementById('chatMessages');
      if (container) {
        container.innerHTML = `
          <div style="text-align:center; padding:40px; color:var(--neon-pink);">
            <i class="fas fa-exclamation-triangle" style="font-size:2rem; display:block; margin-bottom:15px;"></i>
            Error al cargar mensajes.<br>${error.message}
          </div>
        `;
      }
    });
  }

  function updateChatUI() {
    const inputContainer = document.getElementById('chatInputContainer');
    if (!inputContainer) return;
    if (currentUser) {
      inputContainer.style.display = 'flex';
      const avatarImg = document.querySelector('#chatInputContainer .chat-user-avatar');
      if (avatarImg) {
        avatarImg.src = currentUser.photoURL || 'invitado.avif';
      }
    } else {
      inputContainer.style.display = 'none';
    }
  }

  // ---- Enviar mensaje ----
  window.enviarMensajeChat = async function() {
    if (!currentUser) {
      alert('Inicia sesión para enviar mensajes');
      return;
    }
    const input = document.getElementById('chatInput');
    const texto = input.value.trim();
    const sticker = stickerSeleccionado;

    if (!texto && !sticker) return;

    const btn = document.getElementById('chatSendBtn');
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';

    try {
      let textoFinal = texto;
      if (sticker) {
        textoFinal += (texto ? '\n' : '') + `[Sticker](${sticker})`;
      }

      const color = window.getCurrentUserColor ? window.getCurrentUserColor() : null;

      await db.collection('globalChat').add({
        userId: currentUser.uid,
        userName: currentUser.displayName || currentUser.email.split('@')[0] || 'Usuario',
        userAvatar: currentUser.photoURL || 'invitado.avif',
        texto: textoFinal,
        esSticker: !!sticker,
        stickerUrl: sticker || null,
        customColor: color || null,
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
      });

      input.value = '';
      stickerSeleccionado = null;
      actualizarPreviewSticker();
      input.focus();
    } catch (error) {
      console.error(error);
      alert('Error al enviar: ' + error.message);
    } finally {
      btn.disabled = false;
      btn.innerHTML = '<i class="fas fa-paper-plane"></i> Enviar';
    }
  };

  // ---- Seleccionar sticker ----
  window.seleccionarStickerChat = function(url) {
    stickerSeleccionado = url;
    actualizarPreviewSticker();
  };

  function actualizarPreviewSticker() {
    const preview = document.getElementById('chatStickerPreview');
    const img = document.getElementById('chatPreviewImg');
    const vid = document.getElementById('chatPreviewVid');
    if (!preview) return;
    if (stickerSeleccionado) {
      const isVideo = stickerSeleccionado.match(/\.(mp4|webm)$/i);
      if (isVideo) {
        img.style.display = 'none';
        vid.src = stickerSeleccionado;
        vid.style.display = 'inline-block';
      } else {
        vid.style.display = 'none';
        img.src = stickerSeleccionado;
        img.style.display = 'inline-block';
      }
      preview.style.display = 'block';
    } else {
      preview.style.display = 'none';
      img.src = '';
      vid.src = '';
    }
  }

  window.quitarStickerChat = function() {
    stickerSeleccionado = null;
    actualizarPreviewSticker();
  };

  // ---- Eliminar mensaje ----
  async function eliminarMensaje(id) {
    if (!currentUser) return;
    try {
      const doc = await db.collection('globalChat').doc(id).get();
      if (!doc.exists) return;
      if (doc.data().userId !== currentUser.uid) {
        alert('No puedes eliminar mensajes de otros usuarios.');
        return;
      }
      await db.collection('globalChat').doc(id).delete();
    } catch (e) {
      alert('Error: ' + e.message);
    }
  }

  // ---- Abrir panel de stickers ----
  window.toggleStickerPanelChat = function() {
    const panel = document.getElementById('chatStickerPanel');
    if (panel) {
      panel.classList.toggle('active');
      if (panel.classList.contains('active') && typeof loadUserStickers === 'function') {
        loadUserStickers();
      }
    }
  };

  // ---- Utilidades ----
  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  function getNeonColor(str) {
    const colors = ['#00f0ff','#ff1a6b','#b114ff','#ffd700','#00ff33','#ffaa00'];
    let h = 0;
    for (let i=0; i<str.length; i++) h = str.charCodeAt(i) + ((h<<5)-h);
    return colors[Math.abs(h)%colors.length];
  }

  window.abrirStickerModal = function(url) {
    if (typeof openStickerModal === 'function') {
      openStickerModal(url);
    } else {
      window.open(url, '_blank');
    }
  };

  // ---- Inicializar ----
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Exponer funciones globales
  window.enviarMensajeChat = window.enviarMensajeChat;
  window.seleccionarStickerChat = window.seleccionarStickerChat;
  window.quitarStickerChat = window.quitarStickerChat;
  window.toggleStickerPanelChat = window.toggleStickerPanelChat;
  window.iniciarChatGlobal = window.iniciarChatGlobal;
})();