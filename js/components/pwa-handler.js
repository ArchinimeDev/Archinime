/* Archivo: js/components/pwa-handler.js
   v2.0 — Detección robusta, localStorage, soporta iOS + Android + Desktop
   
   Uso: solo incluir <script src=".../pwa-handler.js"></script> en cualquier HTML
   que tenga los elementos #pwaNotif, #pwaInstallBtn, #pwaCloseBtn (opcionales).
   
   NO duplicar esta lógica inline en los HTMLs. Este módulo la maneja sola.
*/

(function() {
  'use strict';

  // ═══════════════════════════════════════════════════════════
  // CONFIG
  // ═══════════════════════════════════════════════════════════
  const STORAGE_KEY = 'archinime_pwa_install_dismissed';
  const COOLDOWN_MS = 30 * 24 * 60 * 60 * 1000; // 30 días
  let deferredPrompt = null;

  // ═══════════════════════════════════════════════════════════
  // DETECCIÓN
  // ═══════════════════════════════════════════════════════════
  const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent);

  function isStandalone() {
    if (window.navigator.standalone === true) return true;                    // iOS
    if (window.matchMedia('(display-mode: standalone)').matches) return true; // Android/Desktop
    if (window.matchMedia('(display-mode: fullscreen)').matches) return true;
    if (window.matchMedia('(display-mode: minimal-ui)').matches) return true;
    if (window.matchMedia('(display-mode: window-controls-overlay)').matches) return true;
    if (document.referrer.startsWith('android-app://')) return true;
    return false;
  }

  function fueDescartadoRecientemente() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return false;
      const ts = parseInt(raw, 10);
      if (isNaN(ts)) return false;
      return (Date.now() - ts) < COOLDOWN_MS;
    } catch (e) { return false; }
  }

  function marcarComoDescartado() {
    try { localStorage.setItem(STORAGE_KEY, String(Date.now())); } catch (e) {}
  }

  // ═══════════════════════════════════════════════════════════
  // VISIBILIDAD
  // ═══════════════════════════════════════════════════════════
  function actualizarVisibilidad() {
    const installBtn = document.getElementById('installBtn');
    const pwaNotif = document.getElementById('pwaNotif');
    const debeMostrarse = !isStandalone() && !fueDescartadoRecientemente();

    if (installBtn) {
      installBtn.style.display = debeMostrarse ? 'flex' : 'none';
    }
    if (pwaNotif && !debeMostrarse) {
      pwaNotif.classList.remove('show');
    }
  }

  // ═══════════════════════════════════════════════════════════
  // EVENTOS NATIVOS DEL NAVEGADOR
  // ═══════════════════════════════════════════════════════════
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    window.__deferredInstallPrompt = e;   // compat con código legacy
    actualizarVisibilidad();
  });

  window.addEventListener('appinstalled', () => {
    marcarComoDescartado();
    deferredPrompt = null;
    window.__deferredInstallPrompt = null;
    const pwaNotif = document.getElementById('pwaNotif');
    if (pwaNotif) pwaNotif.classList.remove('show');
    actualizarVisibilidad();
  });

  // ═══════════════════════════════════════════════════════════
  // API GLOBAL — usada por onclick="instalarPWA()" en los HTMLs
  // ═══════════════════════════════════════════════════════════
  window.instalarPWA = async function(opts) {
    opts = opts || {};
    const silent = opts.silent === true;

    if (isStandalone()) {
      if (!silent) {
        if (typeof window.showToast === 'function') window.showToast('✅ La app ya está instalada');
        else alert('✅ La app ya está instalada');
      }
      return;
    }

    if (isIos()) {
      const iosModal = document.getElementById('iosInstallModal');
      if (iosModal) {
        iosModal.style.display = 'block';
      } else if (!silent) {
        alert('📲 En iOS: Comparte → "Añadir a pantalla de inicio"');
      }
      return;
    }

    if (deferredPrompt) {
      try {
        deferredPrompt.prompt();
        const choice = await deferredPrompt.userChoice;
        // Descartar SIEMPRE (acepte o cancele), para no insistir
        marcarComoDescartado();
        deferredPrompt = null;
        window.__deferredInstallPrompt = null;
        actualizarVisibilidad();
      } catch (e) {
        console.warn('[PWA] Error al prompt:', e);
      }
      return;
    }

    if (!silent) {
      if (typeof window.showToast === 'function') {
        window.showToast('📲 Instálala desde el menú del navegador');
      } else {
        alert('📲 Instálala desde el menú del navegador');
      }
    }
  };

  window.cerrarPwaNotif = function() {
    marcarComoDescartado();
    const pwaNotif = document.getElementById('pwaNotif');
    if (pwaNotif) pwaNotif.classList.remove('show');
    actualizarVisibilidad();
  };

  // ═══════════════════════════════════════════════════════════
  // SETUP — conectar botones
  // ═══════════════════════════════════════════════════════════
  function setup() {
    const installBtn = document.getElementById('installBtn');
    if (installBtn && !installBtn._pwaBound) {
      installBtn._pwaBound = true;
      installBtn.addEventListener('click', () => window.instalarPWA());
    }

    const pwaCloseBtn = document.getElementById('pwaCloseBtn');
    if (pwaCloseBtn && !pwaCloseBtn._pwaBound) {
      pwaCloseBtn._pwaBound = true;
      pwaCloseBtn.addEventListener('click', (e) => {
        e.preventDefault();
        window.cerrarPwaNotif();
      });
    }

    const pwaInstallBtn = document.getElementById('pwaInstallBtn');
    if (pwaInstallBtn && !pwaInstallBtn._pwaBound) {
      pwaInstallBtn._pwaBound = true;
      pwaInstallBtn.addEventListener('click', () => window.instalarPWA());
    }

    actualizarVisibilidad();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setup);
  } else {
    setup();
  }

  window.addEventListener('resize', actualizarVisibilidad, { passive: true });
  window.addEventListener('orientationchange', () => setTimeout(actualizarVisibilidad, 300));

  console.log('✅ pwa-handler.js v2.0 cargado · Standalone:', isStandalone(), '· Descartado:', fueDescartadoRecientemente());

})();