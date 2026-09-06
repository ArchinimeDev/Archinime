// video-player-core.js - Versión con catálogo local + Firestore
// CORREGIDO: Ruta de proxy.html, avatar invitado.avif, y otros detalles
// MEJORADO: Descarga única, barra de progreso, soporte múltiples partes
// SOPORTE: Múltiples opciones, selección automática, títulos dinámicos
// NUEVO: Prioridad máxima para hubu.cloud

class VideoPlayer {
  constructor() {
    this.params = new URLSearchParams(location.search);
    this.animeId = this.params.get('anime');
    this.season = this.params.get('s');
    this.episode = this.params.get('e');
    
    this.auth = null;
    this.db = null;
    this.animeData = null;
    this.currentDownloadUrls = [];
    this.currentPeerTubeUrl = null;
    this.currentEpisodeData = null;
    this.authReady = false;
    this.pendingMarks = [];
    this.currentPartIndex = 0;
    this.activeOptionLabel = 'Opción 1';
    this.activeOptionKey = 'link';
    this.currentVideoElement = null;
    this.isDownloading = false;
    this.proxyDomains = ['cdn12', 'cdn33', 'cdn44'];
    this.retryDomainIndex = 0;
    this.totalRetryCount = 0;
    this.blankTabOpened = false;
    this.pixelDrainFileId = null;
    this.pixelDrainVideo = null;
    this.pixelDrainStatusDiv = null;
    this.pixelDrainModal = null;
    this.lastOpenedProxyUrl = null;
    this.lastLoadedProxyUrl = null;
    this.isRetrying = false;
    this.isPixelDrain = false;
    
    window.comentariosAnimeId = this.animeId;
    window.comentariosSeason = this.season;
    window.comentariosEpisode = this.episode;
    
    this.initFirebase();
    this.initUI();
    this.waitForCatalogAndLoad();
    this.setupAuthUI();
    this.setupAuthMigration();

    this.checkBraveAndShowBanner();

    window.videoPlayerMethods = {
      toggleStickerPanel: () => this.toggleStickerPanel(),
      enviarComentario: () => this.enviarComentario(),
      quitarStickerPreview: () => this.quitarStickerPreview(),
      openLoginModal: () => this.openLoginModal(),
      closeAuthModal: () => this.closeAuthModal(),
      loginWithEmail: () => this.loginWithEmail(),
      registerWithEmail: () => this.registerWithEmail(),
      loginWithGoogle: () => this.loginWithGoogle(),
      loginWithGitHub: () => this.loginWithGitHub(),
      switchStickerTab: (tab) => this.switchStickerTab(tab)
    };
    window.videoPlayer = window.videoPlayerMethods;
    
    window.addEventListener('focus', () => {
      if (this.blankTabOpened) {
        this.blankTabOpened = false;
        if (this.pixelDrainFileId && this.pixelDrainVideo && this.lastLoadedProxyUrl) {
          console.log('🔄 Recargando video al volver de la pestaña en blanco');
          this.loadProxyUrl(this.lastLoadedProxyUrl);
        }
      }
    });
  }
  
  isStandalone() {
    return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
  }

  isDoomStreamUrl(url) {
    if (!url) return false;
    return /(playmogo\.com|doomstream\.com)\/e\//i.test(url);
  }

  generateDirectLink(url) {
    if (!url) return "#";
    if (this.isDoomStreamUrl(url)) return url.replace(/\/e\//, '/d/');
    if (url.includes('mp4upload.com/embed-')) {
      const match = url.match(/embed-([^\.]+)(\.html)?/);
      if (match && match[1]) return `https://www.mp4upload.com/${match[1]}`;
    }
    if (url.includes("drive.google.com")) {
      if (url.includes('drive.usercontent.google.com/download')) return url;
      const match = url.match(/\/d\/(.+?)\//);
      if (match && match[1]) return `https://drive.usercontent.google.com/download?id=${match[1]}&export=download&authuser=0`;
      const altMatch = url.match(/id=([a-zA-Z0-9_-]+)/);
      if (altMatch && altMatch[1]) return `https://drive.usercontent.google.com/download?id=${altMatch[1]}&export=download&authuser=0`;
      const ucMatch = url.match(/uc\?export=download&id=([a-zA-Z0-9_-]+)/);
      if (ucMatch && ucMatch[1]) return `https://drive.usercontent.google.com/download?id=${ucMatch[1]}&export=download&authuser=0`;
    }
    if (url.includes("dropbox.com") && url.includes("dl=0")) return url.replace('dl=0', 'dl=1');
    if (url.includes("ok.ru/")) {
      const match = url.match(/ok\.ru\/video(?:embed)?\/(\d+)/);
      if (match && match[1]) return `https://anydownloader.com/en/#url=https://ok.ru/video/${match[1]}`;
    }
    if (url.includes("odysee.com")) {
      let claimStr = url.split("/embed/")[1];
      if (claimStr) {
        if (claimStr.includes('/')) claimStr = claimStr.split('/').pop();
        claimStr = claimStr.replace(':', '/');
        return `https://odysee.com/$/download/${claimStr}`;
      }
      return url;
    }
    return url;
  }

  extractPixelDrainId(url) {
    if (!url) return null;
    const match = url.match(/pixeldrain\.com\/(?:u|l|d)\/([a-zA-Z0-9]+)/);
    if (match) return match[1];
    if (/^[a-zA-Z0-9]{8,}$/.test(url.trim())) return url.trim();
    return null;
  }

  buildPixelDrainProxy(fileId, domain) {
    return `https://${domain}.pixeldrain.eu.cc/api/file/${fileId}`;
  }

  updateLogoBlocker(url) {
    const logo = document.querySelector('.logo-blocker');
    if (!logo) return;
    const isDrive = url && url.includes('drive.google.com');
    const isOdysee = url && url.includes('odysee.com');
    if (isDrive || isOdysee) {
      logo.style.display = 'flex';
    } else {
      logo.style.display = 'none';
    }
  }

  updateDownloadButtonState(isPixelDrain) {
    const downloadBtn = document.getElementById('downloadBtn');
    if (!downloadBtn) return;
    if (isPixelDrain) {
      downloadBtn.disabled = true;
      downloadBtn.style.opacity = '0.5';
      downloadBtn.style.cursor = 'not-allowed';
      downloadBtn.title = 'Descarga no disponible para enlaces de PixelDrain';
    } else {
      downloadBtn.disabled = false;
      downloadBtn.style.opacity = '1';
      downloadBtn.style.cursor = 'pointer';
      downloadBtn.title = '';
    }
  }

  loadProxyUrl(proxyUrl) {
    if (!this.pixelDrainVideo || !proxyUrl) return;
    const video = this.pixelDrainVideo;
    this.lastLoadedProxyUrl = proxyUrl;
    
    if (this.pixelDrainStatusDiv && !this.pixelDrainStatusDiv.textContent.includes('✅') && !this.pixelDrainStatusDiv.textContent.includes('❌')) {
      this.pixelDrainStatusDiv.textContent = '⏳ Cargando...';
      this.pixelDrainStatusDiv.style.color = '#ffd200';
    }
    
    video.src = proxyUrl;
    video.load();
    video.play().catch(() => {});
    
    const newVideo = video.cloneNode(true);
    video.parentNode.replaceChild(newVideo, video);
    this.pixelDrainVideo = newVideo;
    this.currentVideoElement = newVideo;
    
    const onCanPlay = () => {
      if (this.pixelDrainStatusDiv) {
        this.pixelDrainStatusDiv.textContent = '✅ Video cargado correctamente';
        this.pixelDrainStatusDiv.style.color = '#4caf50';
      }
      if (this.pixelDrainModal) {
        setTimeout(() => { this.pixelDrainModal.style.display = 'none'; }, 800);
      }
      this.totalRetryCount = 0;
      this.isRetrying = false;
      newVideo.removeEventListener('canplay', onCanPlay);
      newVideo.removeEventListener('error', onError);
      clearTimeout(timeoutId);
    };
    const onError = () => {
      newVideo.removeEventListener('canplay', onCanPlay);
      newVideo.removeEventListener('error', onError);
      clearTimeout(timeoutId);
      this.retryWithNextDomain();
    };
    newVideo.addEventListener('canplay', onCanPlay);
    newVideo.addEventListener('error', onError);
    
    const timeoutId = setTimeout(() => {
      if (!newVideo.currentTime) {
        newVideo.removeEventListener('canplay', onCanPlay);
        newVideo.removeEventListener('error', onError);
        this.retryWithNextDomain();
      }
    }, 12000);
    newVideo.addEventListener('canplay', () => { clearTimeout(timeoutId); }, { once: true });
  }

  retryWithNextDomain() {
    if (!this.pixelDrainFileId) return;
    if (this.isRetrying) return;
    this.isRetrying = true;
    
    this.retryDomainIndex = (this.retryDomainIndex + 1) % this.proxyDomains.length;
    const domain = this.proxyDomains[this.retryDomainIndex];
    const proxyUrl = this.buildPixelDrainProxy(this.pixelDrainFileId, domain);
    this.totalRetryCount++;
    
    if (this.pixelDrainStatusDiv && !this.pixelDrainStatusDiv.textContent.includes('✅') && !this.pixelDrainStatusDiv.textContent.includes('❌')) {
      this.pixelDrainStatusDiv.textContent = '⏳ Cargando...';
      this.pixelDrainStatusDiv.style.color = '#ffd200';
    }
    
    setTimeout(() => {
      this.isRetrying = false;
      this.loadProxyUrl(proxyUrl);
    }, 3000);
  }

  createPixelDrainUI(url) {
    const container = document.createElement('div');
    container.id = 'pixelDrainContainer';
    container.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: #000;
      overflow: hidden;
      z-index: 1;
    `;

    const fileId = this.extractPixelDrainId(url);
    if (!fileId) {
      const errorMsg = document.createElement('div');
      errorMsg.style.cssText = 'color:#fff; display:flex; align-items:center; justify-content:center; height:100%; font-size:1.2rem;';
      errorMsg.textContent = '⚠️ No se pudo extraer el ID del enlace de PixelDrain.';
      container.appendChild(errorMsg);
      return container;
    }

    this.pixelDrainFileId = fileId;
    this.retryDomainIndex = 0;
    this.totalRetryCount = 0;
    this.isRetrying = false;

    const video = document.createElement('video');
    video.muted = false;
    video.autoplay = true;
    video.controls = true;
    video.playsInline = true;
    video.referrerPolicy = 'no-referrer';
    video.style.cssText = `
      width: 100%;
      height: 100%;
      object-fit: contain;
      background: #000;
    `;
    container.appendChild(video);
    this.currentVideoElement = video;
    this.pixelDrainVideo = video;

    const modal = document.createElement('div');
    modal.id = 'pixelDrainModal';
    modal.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      background: rgba(11, 11, 11, 0.92);
      backdrop-filter: blur(4px);
      z-index: 10;
      padding: 0.5rem 0.8rem;
      box-sizing: border-box;
      pointer-events: auto;
      transition: opacity 0.3s ease;
      overflow: hidden;
    `;
    this.pixelDrainModal = modal;

    const title = document.createElement('p');
    title.style.cssText = 'color:#ccc; font-size:0.85rem; margin-bottom:0.3rem; text-align:center;';
    title.textContent = '🔗 Elige un servidor:';

    const optionsContainer = document.createElement('div');
    optionsContainer.style.cssText = `
      width: 100%;
      max-width: 95%;
      display: flex;
      flex-direction: column;
      gap: 6px;
      margin: 0.2rem 0;
    `;

    const shortNames = ['cdn12', 'cdn33', 'cdn44'];
    const domainUrls = shortNames.map(d => `https://${d}.pixeldrain.eu.cc/api/file/${fileId}`);

    domainUrls.forEach((proxyUrl, index) => {
      const optionDiv = document.createElement('div');
      optionDiv.style.cssText = `
        background: rgba(255,255,255,0.04);
        border-radius: 8px;
        padding: 4px 8px;
        border: 1px solid rgba(255,255,255,0.06);
        display: flex;
        align-items: center;
        gap: 6px;
        flex-wrap: wrap;
      `;

      const nameSpan = document.createElement('span');
      nameSpan.textContent = shortNames[index];
      nameSpan.style.cssText = `
        color: #7aaaff;
        font-weight: 600;
        font-size: 0.7rem;
        min-width: 40px;
        font-family: monospace;
      `;

      const btnGroup = document.createElement('div');
      btnGroup.style.cssText = 'display:flex; gap:4px; flex:1; justify-content:flex-end; flex-wrap:wrap;';

      const copyBtn = document.createElement('button');
      copyBtn.textContent = '📋 Copiar';
      copyBtn.style.cssText = `
        padding: 3px 8px;
        border: none;
        border-radius: 16px;
        font-size: 0.6rem;
        font-weight: 600;
        cursor: pointer;
        transition: 0.2s;
        background: rgba(255,255,255,0.08);
        color: #fff;
        border: 1px solid rgba(255,255,255,0.1);
      `;
      copyBtn.addEventListener('mouseenter', () => { copyBtn.style.background = 'rgba(255,255,255,0.15)'; });
      copyBtn.addEventListener('mouseleave', () => { copyBtn.style.background = 'rgba(255,255,255,0.08)'; });

      const openBtn = document.createElement('button');
      openBtn.style.cssText = `
        padding: 3px 8px;
        border: none;
        border-radius: 16px;
        font-size: 0.6rem;
        font-weight: 600;
        cursor: pointer;
        transition: 0.2s;
        background: rgba(255,215,0,0.15);
        color: #ffd200;
        border: 1px solid rgba(255,215,0,0.3);
        display: none;
      `;
      const img = document.createElement('img');
      img.src = 'https://cdn.jsdelivr.net/gh/Archinime/Archivos-data@main/chrome.avif';
      img.alt = 'Abrir';
      img.style.cssText = 'height: 1rem; width: auto; vertical-align: middle;';
      openBtn.appendChild(img);

      copyBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const proxy = proxyUrl;
        if (!proxy) return;
        navigator.clipboard.writeText(proxy)
          .then(() => {
            alert('📋 Enlace copiado al portapapeles.');
            copyBtn.style.display = 'none';
            openBtn.style.display = 'inline-block';
          })
          .catch(() => {
            const range = document.createRange();
            const tempDiv = document.createElement('div');
            tempDiv.textContent = proxy;
            tempDiv.style.position = 'fixed';
            tempDiv.style.opacity = '0';
            document.body.appendChild(tempDiv);
            range.selectNode(tempDiv);
            window.getSelection().removeAllRanges();
            window.getSelection().addRange(range);
            document.execCommand('copy');
            document.body.removeChild(tempDiv);
            alert('📋 Enlace copiado (método manual).');
            copyBtn.style.display = 'none';
            openBtn.style.display = 'inline-block';
          });
      });

      openBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const proxy = proxyUrl;
        if (!proxy) return;
        this.lastOpenedProxyUrl = proxy;

        // ✅ RUTA CORREGIDA: proxy.html en lugar de ejem.html
        const instruccionesUrl = `proxy.html?url=${encodeURIComponent(proxy)}`;

        const fallbackOpen = (url) => {
          try {
            const win = window.open(url, '_blank');
            if (win) {
              win.focus();
              this.mostrarToast('📋 Abriendo instrucciones...');
              return true;
            }
          } catch (err) {
            console.warn('Error en fallback window.open:', err);
          }

          navigator.clipboard.writeText(proxy)
            .then(() => {
              alert('📋 Enlace copiado al portapapeles.\n\nAbre tu navegador y pégalo en la barra de direcciones.');
            })
            .catch(() => {
              const range = document.createRange();
              const tempDiv = document.createElement('div');
              tempDiv.textContent = proxy;
              tempDiv.style.position = 'fixed';
              tempDiv.style.opacity = '0';
              document.body.appendChild(tempDiv);
              range.selectNode(tempDiv);
              window.getSelection().removeAllRanges();
              window.getSelection().addRange(range);
              document.execCommand('copy');
              document.body.removeChild(tempDiv);
              alert('📋 Enlace copiado (método manual).\n\nAbre tu navegador y pégalo en la barra de direcciones.');
            });
          return false;
        };

        const isStandalone = this.isStandalone();

        if (isStandalone) {
          if (navigator.share) {
            navigator.share({
              title: 'Abrir enlace en tu navegador',
              text: 'Abre esta página para ver las instrucciones y pegar el enlace.',
              url: instruccionesUrl
            })
            .then(() => {
              console.log('📤 Instrucciones compartidas exitosamente');
              this.mostrarToast('✅ Selecciona tu navegador favorito');
            })
            .catch((err) => {
              if (err.name === 'AbortError') {
                console.log('Compartir cancelado por el usuario');
                return;
              }
              console.warn('Error en navigator.share:', err);
              fallbackOpen(instruccionesUrl);
            });
          } else {
            fallbackOpen(instruccionesUrl);
          }
        } else {
          try {
            const win = window.open(instruccionesUrl, '_blank');
            if (win) {
              win.focus();
              this.mostrarToast('📋 Abriendo instrucciones...');
            } else {
              fallbackOpen(instruccionesUrl);
            }
          } catch (err) {
            console.warn('Error en window.open:', err);
            fallbackOpen(instruccionesUrl);
          }
        }
      });

      btnGroup.appendChild(copyBtn);
      btnGroup.appendChild(openBtn);
      optionDiv.appendChild(nameSpan);
      optionDiv.appendChild(btnGroup);
      optionsContainer.appendChild(optionDiv);
    });

    const statusDiv = document.createElement('div');
    statusDiv.id = 'pixelDrainStatus';
    statusDiv.style.cssText = `
      margin-top: 0.2rem;
      color: #ffd200;
      font-size: 0.7rem;
      text-align: center;
      min-height: 20px;
      font-weight: 400;
    `;
    statusDiv.textContent = '⏳ Cargando...';
    this.pixelDrainStatusDiv = statusDiv;

    modal.appendChild(title);
    modal.appendChild(optionsContainer);
    modal.appendChild(statusDiv);

    container.appendChild(modal);

    const firstProxy = domainUrls[0];
    this.loadProxyUrl(firstProxy);

    return container;
  }

  mostrarToast(mensaje) {
    let toast = document.getElementById('pixelDrainToast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'pixelDrainToast';
      toast.style.cssText = `
        position: fixed;
        bottom: 80px;
        left: 50%;
        transform: translateX(-50%);
        background: rgba(0,0,0,0.85);
        color: #fff;
        padding: 12px 24px;
        border-radius: 30px;
        font-size: 0.9rem;
        font-weight: 600;
        z-index: 99999;
        border: 1px solid rgba(255,215,0,0.3);
        box-shadow: 0 0 20px rgba(0,0,0,0.7);
        transition: opacity 0.3s ease;
        opacity: 0;
        pointer-events: none;
        backdrop-filter: blur(8px);
      `;
      document.body.appendChild(toast);
    }
    toast.textContent = mensaje;
    toast.style.opacity = '1';
    if (this.toastTimeout) clearTimeout(this.toastTimeout);
    this.toastTimeout = setTimeout(() => {
      toast.style.opacity = '0';
    }, 3000);
  }

  prioritizeOptions(options) {
    const getPriority = (urls) => {
      if (!urls || urls.length === 0) return 3;
      const firstUrl = urls[0] || '';
      if (firstUrl.includes('hubu.cloud')) return 0;
      if (firstUrl.includes('pixeldrain.com')) return 0;
      if (firstUrl.includes('mp4upload.com')) return 1;
      if (firstUrl.includes('drive.google.com')) return 3;
      return 2;
    };

    options.sort((a, b) => getPriority(a.urls) - getPriority(b.urls));

    const labels = ['Opción 1', 'Opción 2', 'Opción 3', 'Opción 4'];
    options.forEach((opt, index) => {
      opt.label = labels[index] || `Opción ${index + 1}`;
      opt.originalKey = opt.key;
    });

    return options;
  }

  updateDownloadUrls(urls) {
    this.currentDownloadUrls = urls.map(url => this.generateDirectLink(url));
    this.currentPeerTubeUrl = (urls.length > 0 && this.isPeerTubeUrl(urls[0])) ? urls[0] : null;
    const isPixelDrain = urls.some(u => u && u.includes('pixeldrain.com'));
    this.isPixelDrain = isPixelDrain;
    this.updateDownloadButtonState(isPixelDrain);
  }

  playPart(partIndex, urlsArray) {
    if (!urlsArray || partIndex >= urlsArray.length) return;
    const url = urlsArray[partIndex];
    if (!url) return;
    
    const container = document.getElementById('mediaContainer');
    container.innerHTML = '';

    if (url.includes('pixeldrain.com')) {
      this.isPixelDrain = true;
      this.updateDownloadButtonState(true);
      const ui = this.createPixelDrainUI(url);
      container.appendChild(ui);
      this.currentVideoElement = ui.querySelector('video') || null;
      this.updateLogoBlocker(url);
      return;
    }

    this.isPixelDrain = false;
    this.updateDownloadButtonState(false);

    const isVideoFile = /\.(mp4|webm|ogg|mov|m3u8)$/i.test(url);
    if (isVideoFile && !url.includes('drive.google.com')) {
      const video = document.createElement('video');
      video.src = url;
      video.controls = true;
      video.style.width = '100%';
      video.style.height = '100%';
      container.appendChild(video);
      this.currentVideoElement = video;
      this.updateLogoBlocker(url);
      const onEnded = () => {
        if (partIndex + 1 < urlsArray.length) {
          this.playPart(partIndex + 1, urlsArray);
        } else {
          console.log('Episodio completado');
        }
      };
      video.addEventListener('ended', onEnded, { once: true });
    } else {
      const iframe = document.createElement('iframe');
      iframe.src = url;
      iframe.allow = 'autoplay; fullscreen';
      iframe.allowFullscreen = true;
      iframe.style.width = '100%';
      iframe.style.height = '100%';
      container.appendChild(iframe);
      this.currentVideoElement = null;
      this.updateLogoBlocker(url);
    }
  }

  async forceDownload(url, suggestedFilename = 'video.mp4') {
    this.showProgressBar();
    const percentSpan = document.getElementById('progressPercent');
    const fillDiv = document.getElementById('progressBarFill');

    try {
      const response = await fetch(url, { mode: 'cors' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const contentLength = response.headers.get('content-length');
      const total = contentLength ? parseInt(contentLength, 10) : 0;
      let loaded = 0;

      const reader = response.body.getReader();
      const chunks = [];
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        loaded += value.length;
        if (total) {
          const percent = Math.round((loaded / total) * 100);
          if (percentSpan) percentSpan.innerText = percent;
          if (fillDiv) fillDiv.style.width = percent + '%';
        } else {
          if (percentSpan) percentSpan.innerText = '...';
        }
      }
      const blob = new Blob(chunks, { type: response.headers.get('content-type') || 'video/mp4' });
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = suggestedFilename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(blobUrl);
    } catch (error) {
      console.warn(error);
      window.open(url, '_blank');
    } finally {
      // La barra se oculta en handleDownloadClick
    }
  }

  async handleDownloadClick() {
    if (this.isDownloading) {
      console.log('Descarga en curso, espera a que termine');
      return;
    }

    if (this.isPixelDrain) {
      alert('La descarga no está disponible para enlaces de PixelDrain.');
      return;
    }

    const user = this.getCurrentUser();
    if (!user) {
      this.openLoginModal();
      return;
    }
    
    let urlsToDownload = [...this.currentDownloadUrls];
    
    if (this.currentPeerTubeUrl) {
      const fallbackUrls = this.getActiveEpisodeUrls();
      if (fallbackUrls.length > 0) {
        urlsToDownload = fallbackUrls.map(url => this.generateDirectLink(url));
      } else {
        alert('No hay enlace alternativo para PeerTube.');
        return;
      }
    }
    
    if (urlsToDownload.length === 0 || urlsToDownload[0] === '#') {
      alert('No hay enlace de descarga disponible.');
      return;
    }
    
    const epTitleElem = document.getElementById('epTitle');
    let baseFilename = epTitleElem ? epTitleElem.innerText : 'video';
    baseFilename = baseFilename.replace(/[^a-z0-9ñáéíóúü \-_]/gi, '').replace(/\s+/g, '_');

    this.isDownloading = true;
    const downloadBtn = document.getElementById('downloadBtn');
    if (downloadBtn) {
      downloadBtn.disabled = true;
      downloadBtn.style.opacity = '0.6';
      downloadBtn.style.cursor = 'not-allowed';
      downloadBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Descargando...';
    }

    try {
      for (let i = 0; i < urlsToDownload.length; i++) {
        const url = urlsToDownload[i];
        
        if (this.isDoomStreamUrl(url)) {
          window.open(url, '_blank');
          continue;
        }

        const isCatbox = url.includes('catbox.moe');
        const isCrossOrigin = !url.startsWith(location.origin);
        
        let filename = `${baseFilename}`;
        if (urlsToDownload.length > 1) {
          filename = `${baseFilename}_parte${i+1}.mp4`;
        } else {
          filename = `${baseFilename}.mp4`;
        }
        
        if (isCatbox || isCrossOrigin) {
          await this.forceDownload(url, filename);
        } else {
          const link = document.createElement('a');
          link.href = url;
          link.download = filename;
          link.target = this.isMobile() ? '_blank' : '_self';
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          await new Promise(r => setTimeout(r, 500));
        }
      }
    } finally {
      this.isDownloading = false;
      if (downloadBtn) {
        downloadBtn.disabled = false;
        downloadBtn.style.opacity = '1';
        downloadBtn.style.cursor = 'pointer';
        downloadBtn.innerHTML = '⬇ Descargar';
      }
      this.hideProgressBar();
    }
  }

  async waitForCatalogAndLoad() {
    if (typeof catalogoArray !== 'undefined') {
      this.loadEpisodeData();
      return;
    }
    console.log('⏳ Esperando catalogoArray...');
    const checkInterval = setInterval(() => {
      if (typeof catalogoArray !== 'undefined') {
        clearInterval(checkInterval);
        this.loadEpisodeData();
      }
    }, 50);
    setTimeout(() => {
      clearInterval(checkInterval);
      if (typeof catalogoArray === 'undefined') {
        console.error('❌ No se cargó catalogoArray');
        document.getElementById('epTitle').innerText = 'Error: Catálogo no disponible';
      }
    }, 5000);
  }

  initFirebase() {
    const firebaseConfig = {
      apiKey: "AIzaSyBpzYARIxaJijLbbL-2S6F9MWecbAbvK_I",
      authDomain: "login-admin-archinime.firebaseapp.com",
      projectId: "login-admin-archinime",
      storageBucket: "login-admin-archinime.firebasestorage.app",
      messagingSenderId: "938164660242",
      appId: "1:938164660242:web:648e0dce0e0d18dd78d0cb"
    };
    if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
    firebase.auth().setPersistence(firebase.auth.Auth.Persistence.LOCAL);
    
    this.auth = firebase.auth();
    this.db = firebase.firestore();
    
    this.auth.onAuthStateChanged(user => {
      if (window.ArchinimeState) {
        window.ArchinimeState.set('currentUser', user);
      } else {
        this.currentUser = user;
      }
      this.authReady = true;
      this.updateCommentFormVisibility();
      
      if (typeof initComentariosSystem === 'function') {
        initComentariosSystem(this.db, this.auth);
      }
      if (typeof initStickersSystem === 'function') {
        initStickersSystem(this.db, this.auth);
      }
    });
  }

  getCurrentUser() {
    if (window.ArchinimeState) return window.ArchinimeState.get('currentUser');
    return this.currentUser;
  }

  async migrateLocalToFirestore(userId) {
    if (!userId) return;
    const watchedKeys = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('watched_')) watchedKeys.push(key);
    }
    if (watchedKeys.length === 0) return;
    
    console.log(`🔄 Migrando ${watchedKeys.length} registros...`);
    const historyRef = this.db.collection('watchHistory').doc(userId);
    
    for (const key of watchedKeys) {
      const parts = key.split('_');
      if (parts.length < 4) continue;
      const animeId = parts[1];
      const seasonNum = parseInt(parts[2]);
      const episodeNum = parseInt(parts[3]);
      if (isNaN(seasonNum) || isNaN(episodeNum)) continue;
      
      try {
        const doc = await historyRef.get();
        let data = doc.exists ? doc.data() : {};
        if (!data[animeId]) data[animeId] = {};
        if (!data[animeId][seasonNum]) data[animeId][seasonNum] = [];
        if (!data[animeId][seasonNum].includes(episodeNum)) {
          data[animeId][seasonNum].push(episodeNum);
        }
        await historyRef.set(data, { merge: true });
        localStorage.removeItem(key);
      } catch (e) { console.warn(e); }
    }
    console.log('✅ Migración completada');
  }

  setupAuthMigration() {
    this.auth.onAuthStateChanged(async (user) => {
      if (user) {
        await this.migrateLocalToFirestore(user.uid);
        if (this.pendingMarks.length > 0) {
          for (const mark of this.pendingMarks) {
            await this.saveToFirestore(mark.animeId, mark.season, mark.episode, user.uid);
          }
          this.pendingMarks = [];
        }
      }
    });
  }

  async saveToFirestore(animeId, seasonNum, episodeNum, userId) {
    if (!userId) return false;
    try {
      const docRef = this.db.collection('watchHistory').doc(userId);
      const doc = await docRef.get();
      let data = doc.exists ? doc.data() : {};
      if (!data[animeId]) data[animeId] = {};
      if (!data[animeId][seasonNum]) data[animeId][seasonNum] = [];
      if (!data[animeId][seasonNum].includes(episodeNum)) {
        data[animeId][seasonNum].push(episodeNum);
        await docRef.set(data, { merge: true });
      }
      return true;
    } catch (e) { return false; }
  }

  async autoMarkAsWatched() {
    const aId = this.animeId;
    const sNum = parseInt(this.season);
    const eNum = parseInt(this.episode);
    if (!aId || isNaN(sNum) || isNaN(eNum)) return;
    
    const user = this.getCurrentUser();
    const localKey = `watched_${aId}_${sNum}_${eNum}`;
    
    if (user && user.uid) {
      const success = await this.saveToFirestore(aId, sNum, eNum, user.uid);
      if (success) {
        localStorage.removeItem(localKey);
        return;
      }
    }
    
    localStorage.setItem(localKey, 'true');
    if (!user && !this.authReady) {
      this.pendingMarks.push({ animeId: aId, season: sNum, episode: eNum });
    }
  }

  initUI() {
    const backLink = document.getElementById('backLink');
    if (backLink && this.animeId) backLink.href = `anime-detail.html?id=${this.animeId}`;
    
    const textarea = document.getElementById('comentarioTexto');
    if (textarea) {
      textarea.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          this.enviarComentario();
        }
      });
      textarea.addEventListener('input', () => this.validateSendButton());
    }
    
    const downloadBtn = document.getElementById('downloadBtn');
    if (downloadBtn) {
      downloadBtn.addEventListener('click', (e) => {
        e.preventDefault();
        this.handleDownloadClick();
      });
    }
    
    document.querySelectorAll('.sticker-tab').forEach(tab => {
      tab.addEventListener('click', () => this.switchStickerTab(tab.dataset.tab));
    });

    const openBtn = document.getElementById('openTutorialBtn');
    const closeBtns = document.querySelectorAll('#closeTutorialBtn, #closeTutorialBtn2');
    const modal = document.getElementById('tutorialModal');
    if (openBtn) {
      openBtn.addEventListener('click', () => this.openTutorialModal());
    }
    closeBtns.forEach(btn => {
      if (btn) {
        btn.addEventListener('click', () => this.closeTutorialModal());
      }
    });
    if (modal) {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          this.closeTutorialModal();
        }
      });
    }
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.closeTutorialModal();
      }
    });
  }

  async checkBraveAndShowBanner() {
    const banner = document.getElementById('braveBanner');
    if (!banner) return;

    let isBrave = false;
    if (navigator.brave && typeof navigator.brave.isBrave === 'function') {
      try {
        isBrave = await navigator.brave.isBrave();
      } catch (e) {
        console.warn('Error detectando Brave:', e);
      }
    }

    if (!isBrave) {
      banner.style.display = 'flex';
    } else {
      banner.style.display = 'none';
    }
  }

  openTutorialModal() {
    const modal = document.getElementById('tutorialModal');
    if (!modal) return;
    modal.classList.add('show');
    const video = document.getElementById('tutorialVideo');
    if (video) {
      video.play().catch(() => {});
    }
    document.body.style.overflow = 'hidden';
  }

  closeTutorialModal() {
    const modal = document.getElementById('tutorialModal');
    if (!modal) return;
    modal.classList.remove('show');
    const video = document.getElementById('tutorialVideo');
    if (video) {
      video.pause();
    }
    document.body.style.overflow = '';
  }

  formatEpisodeTitle(season, epNum, episodeData) {
    const animeTitle = this.animeData?.title || 'Anime';
    const seasonName = season.name || `Temporada ${season.num}`;
    const episodeTitle = episodeData.title || `Capítulo ${epNum}`;
    return `${animeTitle} - ${seasonName} - ${episodeTitle}`;
  }

  normalizeUrls(urls) {
    if (!urls) return [];
    if (Array.isArray(urls)) return urls.filter(u => u && u.trim() !== '');
    if (typeof urls === 'string' && urls.trim() !== '') return [urls];
    return [];
  }

  createServerSelect(options, initialIndex) {
    const container = document.getElementById('serverOptions');
    container.innerHTML = '';
    
    const select = document.createElement('select');
    select.id = 'serverSelect';
    select.style.cssText = `
      width: 100%;
      padding: 4px 8px;
      background: rgba(0,0,0,0.7);
      border: 1px solid rgba(255,255,255,0.2);
      border-radius: 6px;
      color: #fff;
      font-size: 0.75rem;
      font-family: 'Poppins', sans-serif;
      cursor: pointer;
      appearance: none;
      -webkit-appearance: none;
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%23ffffff'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E");
      background-repeat: no-repeat;
      background-position: right 6px center;
      background-size: 14px;
      padding-right: 28px;
    `;
    
    options.forEach((opt, idx) => {
      const option = document.createElement('option');
      option.value = idx;
      option.textContent = opt.label;
      if (idx === initialIndex) option.selected = true;
      select.appendChild(option);
    });
    
    select.addEventListener('change', (e) => {
      const idx = parseInt(e.target.value);
      const selected = options[idx];
      if (selected) {
        this.activeOptionLabel = selected.label;
        this.activeOptionKey = selected.originalKey || 'link';
        this.updateDownloadUrls(selected.urls);
        this.playPart(0, selected.urls);
      }
    });
    
    container.appendChild(select);
    return select;
  }

  isPeerTubeUrl(url) {
    if (!url) return false;
    return /^(https?:\/\/)?([a-z0-9-]+\.)*peertube\.\w+\//i.test(url);
  }

  getActiveEpisodeUrls() {
    const episodeData = this.currentEpisodeData;
    if (!episodeData) return [];
    const key = this.activeOptionKey || 'link';
    return this.normalizeUrls(episodeData[key]);
  }

  showProgressBar() {
    if (document.getElementById('customDownloadProgress')) return;
    const div = document.createElement('div');
    div.id = 'customDownloadProgress';
    div.innerHTML = `
      <div style="position:fixed; bottom:20px; left:20px; right:20px; z-index:9999; background:rgba(0,0,0,0.9); border-radius:16px; padding:16px; border:1px solid var(--primary-color); backdrop-filter:blur(8px); text-align:center; font-family:'Poppins',sans-serif;">
        <div style="margin-bottom:8px; color:#fff;">⬇ Descargando video... <span id="progressPercent">0</span>%</div>
        <div style="background:#222; border-radius:50px; overflow:hidden; height:10px;">
          <div id="progressBarFill" style="width:0%; height:100%; background:linear-gradient(90deg, #00f3ff, #bc13fe); transition:width 0.2s;"></div>
        </div>
        <div style="font-size:0.7rem; color:#aaa; margin-top:8px;">No cierres la página hasta que termine</div>
      </div>
    `;
    document.body.appendChild(div);
  }

  hideProgressBar() {
    const el = document.getElementById('customDownloadProgress');
    if (el) el.remove();
  }

  isMobile() {
    return /android|webos|iphone|ipad|ipod|blackberry/i.test(navigator.userAgent.toLowerCase());
  }

  setupNavigation() {
    if (!this.animeData?.seasons) return;
    const flat = [];
    this.animeData.seasons.sort((a,b) => a.num - b.num).forEach(season => {
      season.eps?.forEach((ep, idx) => {
        const hasLink = (ep.link && (Array.isArray(ep.link) ? ep.link.length : ep.link)) ||
                        (ep.link2 && (Array.isArray(ep.link2) ? ep.link2.length : ep.link2)) ||
                        (ep.link3 && (Array.isArray(ep.link3) ? ep.link3.length : ep.link3)) ||
                        (ep.link4 && (Array.isArray(ep.link4) ? ep.link4.length : ep.link4));
        if (hasLink) {
          flat.push({ s: season.num, e: idx + 1, seasonObj: season, episodeData: ep });
        }
      });
    });
    const idx = flat.findIndex(i => i.s === parseInt(this.season) && i.e === parseInt(this.episode));
    const prevBtn = document.getElementById('prevBtn');
    const nextBtn = document.getElementById('nextBtn');
    
    if (idx > 0) {
      const prev = flat[idx-1];
      prevBtn.classList.remove('btn-hidden');
      prevBtn.href = `?anime=${this.animeId}&s=${prev.s}&e=${prev.e}`;
      prevBtn.setAttribute('title', this.formatEpisodeTitle(prev.seasonObj, prev.e, prev.episodeData));
    } else {
      prevBtn.classList.add('btn-hidden');
    }
    
    if (idx < flat.length - 1) {
      const next = flat[idx+1];
      nextBtn.classList.remove('btn-hidden');
      nextBtn.href = `?anime=${this.animeId}&s=${next.s}&e=${next.e}`;
      nextBtn.setAttribute('title', this.formatEpisodeTitle(next.seasonObj, next.e, next.episodeData));
    } else {
      nextBtn.classList.add('btn-hidden');
    }
  }

  setupAuthUI() {
    document.querySelectorAll('.auth-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        const tabName = tab.dataset.tab;
        document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        document.getElementById('authLoginForm').style.display = tabName === 'login' ? 'flex' : 'none';
        document.getElementById('authRegisterForm').style.display = tabName === 'register' ? 'flex' : 'none';
      });
    });
  }

  openLoginModal() { document.getElementById('authModal').classList.add('show'); }
  closeAuthModal() { 
    document.getElementById('authModal').classList.remove('show'); 
    const errEl = document.getElementById('authError');
    if (errEl) errEl.innerText = '';
  }

  async loginWithEmail() {
    const email = document.getElementById('loginEmail').value;
    const pass = document.getElementById('loginPassword').value;
    try { 
      await this.auth.signInWithEmailAndPassword(email, pass); 
      this.closeAuthModal(); 
    } catch (e) { 
      document.getElementById('authError').innerText = e.message; 
    }
  }

  async registerWithEmail() {
    const email = document.getElementById('registerEmail').value;
    const pass = document.getElementById('registerPassword').value;
    const confirm = document.getElementById('registerConfirm').value;
    if (pass !== confirm) { 
      document.getElementById('authError').innerText = 'Las contraseñas no coinciden'; 
      return; 
    }
    try { 
      await this.auth.createUserWithEmailAndPassword(email, pass); 
      this.closeAuthModal(); 
    } catch (e) { 
      document.getElementById('authError').innerText = e.message; 
    }
  }

  async loginWithGoogle() {
    const provider = new firebase.auth.GoogleAuthProvider();
    try { 
      await this.auth.signInWithPopup(provider); 
      this.closeAuthModal(); 
    } catch (e) { 
      document.getElementById('authError').innerText = e.message; 
    }
  }

  async loginWithGitHub() {
    const provider = new firebase.auth.GithubAuthProvider();
    try { 
      await this.auth.signInWithPopup(provider); 
      this.closeAuthModal(); 
    } catch (e) { 
      document.getElementById('authError').innerText = e.message; 
    }
  }

  updateCommentFormVisibility() {
    const user = this.getCurrentUser();
    const loginMsg = document.getElementById('comentarioLoginMessage');
    const form = document.getElementById('comentarioFormContainer');
    const avatar = document.getElementById('comentarioUserAvatar');
    const nameSpan = document.getElementById('comentarioUserName');
    if (user) {
      if (loginMsg) loginMsg.style.display = 'none';
      if (form) {
        form.style.display = 'block';
        // ✅ RUTA CORREGIDA: avatar por defecto
        if (avatar) avatar.src = user.photoURL || '../assets/img/invitado.avif';
        if (nameSpan) nameSpan.innerText = user.displayName || user.email?.split('@')[0] || 'Usuario';
      }
    } else {
      if (loginMsg) loginMsg.style.display = 'block';
      if (form) form.style.display = 'none';
    }
  }

  toggleStickerPanel() {
    const panel = document.getElementById('stickerPanelFull');
    if (panel) {
      panel.classList.toggle('active');
      if (panel.classList.contains('active') && typeof cargarStickersUsuario === 'function') {
        cargarStickersUsuario();
      }
    }
  }

  switchStickerTab(tabId) {
    if (typeof window.switchStickerTab === 'function') {
      window.switchStickerTab(tabId);
    } else {
      document.querySelectorAll('.sticker-tab').forEach(t => t.classList.remove('active'));
      document.querySelector(`.sticker-tab[data-tab="${tabId}"]`)?.classList.add('active');
      document.querySelectorAll('.sticker-tab-content').forEach(c => c.classList.remove('active'));
      document.getElementById(tabId === 'mis' ? 'misStickersTab' : 'subirStickersTab')?.classList.add('active');
    }
  }

  validateSendButton() {
    const textarea = document.getElementById('comentarioTexto');
    const btn = document.getElementById('enviarComentarioBtn');
    if (textarea && btn) {
      const hasContent = textarea.value.trim().length > 0 || window.stickerSeleccionadoParaEnviar;
      btn.disabled = !hasContent;
      btn.style.opacity = hasContent ? '1' : '0.5';
    }
  }

  enviarComentario() { 
    if (typeof enviarComentarioTexto === 'function') enviarComentarioTexto();
  }

  quitarStickerPreview() { 
    if (typeof quitarStickerPreview === 'function') { quitarStickerPreview(); } 
    this.validateSendButton();
  }

  async loadEpisodeData() {
    try {
      const anime = catalogoArray.find(a => a.id == this.animeId);
      if (!anime) {
        document.getElementById('epTitle').innerText = 'Anime no encontrado';
        return;
      }
      this.animeData = anime;
      const seasons = this.animeData.seasons || [];
      const season = seasons.find(s => s.num === parseInt(this.season));
      if (!season) {
        document.getElementById('epTitle').innerText = 'Temporada no encontrada';
        return;
      }
      const epIndex = parseInt(this.episode) - 1;
      const episodeData = season.eps?.[epIndex];
      if (!episodeData) {
        document.getElementById('epTitle').innerText = 'Episodio no encontrado';
        return;
      }
      
      this.currentEpisodeData = episodeData;
      const formattedTitle = this.formatEpisodeTitle(season, parseInt(this.episode), episodeData);
      document.title = `Ver ${formattedTitle} - Archinime`;
      document.getElementById('epTitle').innerText = formattedTitle;
      
      let options = [
        { label: 'Latino', key: 'link', urls: this.normalizeUrls(episodeData.link) },
        { label: 'Opción 2', key: 'link2', urls: this.normalizeUrls(episodeData.link2) },
        { label: 'Opción 3', key: 'link3', urls: this.normalizeUrls(episodeData.link3) },
        { label: 'Opción 4', key: 'link4', urls: this.normalizeUrls(episodeData.link4) }
      ].filter(opt => opt.urls.length > 0);

      if (options.length === 0) {
        document.getElementById('epTitle').innerText = 'No hay enlaces disponibles';
        return;
      }

      options = this.prioritizeOptions(options);
      this.createServerSelect(options, 0);

      const firstOption = options[0];
      this.activeOptionLabel = firstOption.label;
      this.activeOptionKey = firstOption.originalKey || 'link';
      this.updateDownloadUrls(firstOption.urls);
      this.playPart(0, firstOption.urls);
      
      this.setupNavigation();
      await this.autoMarkAsWatched();
    } catch (error) {
      console.error(error);
      document.getElementById('epTitle').innerText = 'Error al cargar el episodio';
    }
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => new VideoPlayer());
} else {
  new VideoPlayer();
}

window.openLoginModalFromComent = () => window.videoPlayer?.openLoginModal();
window.toggleStickerPanelSistema = () => window.videoPlayer?.toggleStickerPanel();