// anime-detail-core.js - Versión con catálogo local (catalogo.js)
// MEJORADO: Carga más rápida, mejor manejo de errores, 12 sugerencias
// INCLUYE: Búsqueda rápida, votaciones, historial de visualización

function escapeHtml(text) {
  if (!text) return text;
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

const firebaseConfig = {
  apiKey: "AIzaSyBpzYARIxaJijLbbL-2S6F9MWecbAbvK_I",
  authDomain: "login-admin-archinime.firebaseapp.com",
  projectId: "login-admin-archinime",
  storageBucket: "login-admin-archinime.firebasestorage.app",
  messagingSenderId: "938164660242",
  appId: "1:938164660242:web:648e0dce0e0d18dd78d0cb"
};
if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

let audioCtx = null;
function initAudio() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (audioCtx.state === 'suspended') audioCtx.resume();
}
window._playUISound = function(type) {
  initAudio();
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.connect(gain); gain.connect(audioCtx.destination);
  const now = audioCtx.currentTime;
  if (type === 'hover') {
    osc.type = 'sine';
    osc.frequency.setValueAtTime(800, now);
    osc.frequency.exponentialRampToValueAtTime(1200, now+0.05);
    gain.gain.setValueAtTime(0.02, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now+0.05);
    osc.start(now); osc.stop(now+0.05);
  } else if (type === 'click') {
    osc.type = 'square';
    osc.frequency.setValueAtTime(300, now);
    osc.frequency.exponentialRampToValueAtTime(100, now+0.1);
    gain.gain.setValueAtTime(0.05, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now+0.1);
    osc.start(now); osc.stop(now+0.1);
  }
};
window.playUISound = window._playUISound;

let currentAudio = null, playlist = [], currentTrackIndex = -1;
let userInteractedDetail = false;

function playTrack(idx) {
  if (!playlist.length) return;
  if (currentAudio) { currentAudio.pause(); currentAudio.onended = null; }
  let track = playlist[idx];
  const fullUrl = track.startsWith('http') ? track : `musica/${track}`;
  currentAudio = new Audio(fullUrl);
  currentAudio.volume = 0.3;
  currentAudio.loop = false;
  currentAudio.onended = () => {
    currentTrackIndex = (currentTrackIndex + 1) % playlist.length;
    playTrack(currentTrackIndex);
  };
  const playPromise = currentAudio.play();
  if (playPromise !== undefined) {
    playPromise.catch(e => {
      console.log('Autoplay bloqueado, esperando interacción:', e);
      if (!userInteractedDetail) {
        const resumeOnce = () => {
          if (!userInteractedDetail) {
            userInteractedDetail = true;
            currentAudio.play().catch(err => console.warn('No se pudo reproducir:', err));
            ['click', 'touchstart', 'keydown'].forEach(evt => {
              document.removeEventListener(evt, resumeOnce, { once: true });
            });
          }
        };
        ['click', 'touchstart', 'keydown'].forEach(evt => {
          document.addEventListener(evt, resumeOnce, { once: true });
        });
      }
    });
  }
}

function playMusicFromArray(musicArray) {
  if (!musicArray || musicArray.length === 0) return;
  playlist = musicArray;
  currentTrackIndex = Math.floor(Math.random() * playlist.length);
  playTrack(currentTrackIndex);
}

let currentUserId = null;
let currentAnimeId = null;
let animeData = null;
let animeRatingData = { avg: 0, count: 0 };
let currentUserRating = null;
const params = new URLSearchParams(location.search);
const animeId = params.get('id');
currentAnimeId = animeId;
let searchCache = [];

function showToast(msg, isError = false) {
  let toast = document.getElementById('toast');
  if (!toast) { toast = document.createElement('div'); toast.id = 'toast'; toast.className = 'toast'; document.body.appendChild(toast); }
  toast.innerHTML = `<i class="fas ${isError ? 'fa-exclamation-triangle' : 'fa-check-circle'}"></i> ${msg}`;
  toast.style.display = 'block';
  setTimeout(() => toast.style.display = 'none', 3000);
}

function getLocalKey(animeId, s, e) { return `watched_${animeId}_${s}_${e}`; }
async function markEpisodeWatched(animeId, s, e) {
  if (currentUserId) {
    const docRef = db.collection('watchHistory').doc(currentUserId);
    const doc = await docRef.get();
    let data = doc.exists ? doc.data() : {};
    if (!data[animeId]) data[animeId] = {};
    if (!data[animeId][s]) data[animeId][s] = [];
    if (!data[animeId][s].includes(e)) data[animeId][s].push(e);
    await docRef.set(data, { merge: true });
    showToast('Episodio marcado como visto');
  } else {
    localStorage.setItem(getLocalKey(animeId, s, e), 'true');
    showToast('Episodio marcado (local)');
  }
}
async function removeEpisodeWatched(animeId, s, e) {
  if (currentUserId) {
    const docRef = db.collection('watchHistory').doc(currentUserId);
    const doc = await docRef.get();
    if (doc.exists) {
      let data = doc.data();
      if (data[animeId]?.[s]) {
        data[animeId][s] = data[animeId][s].filter(n => n !== e);
        if (data[animeId][s].length === 0) delete data[animeId][s];
        if (Object.keys(data[animeId]).length === 0) delete data[animeId];
        await docRef.set(data);
        showToast('Episodio eliminado');
      }
    }
  } else {
    localStorage.removeItem(getLocalKey(animeId, s, e));
    showToast('Episodio eliminado (local)');
  }
}
async function loadWatchedEpisodes(animeId) {
  if (currentUserId) {
    const doc = await db.collection('watchHistory').doc(currentUserId).get();
    return doc.exists ? (doc.data()[animeId] || {}) : {};
  } else {
    const watched = {};
    for (let i=0; i<localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(`watched_${animeId}_`)) {
        const parts = key.split('_');
        const s = parseInt(parts[2]), e = parseInt(parts[3]);
        if (!watched[s]) watched[s] = [];
        watched[s].push(e);
      }
    }
    return watched;
  }
}

window.reloadSeason = async function(details, animeId, seasonIdx) {
  if (!details?.open) return;
  const list = details.querySelector('.video-list');
  if (list) { list.innerHTML = ''; await toggleSeason(details, animeId, seasonIdx); }
};

window.toggleSeason = async function(details, animeId, seasonIdx) {
  if (!details.open) return;
  playUISound('click');
  const list = details.querySelector('.video-list');
  if (list.children.length) return;
  const loading = details.querySelector(`#loading-${seasonIdx}`);
  if (loading) loading.style.display = 'block';
  const season = animeData.seasons[seasonIdx];
  if (!season || !season.eps) {
    if (loading) loading.style.display = 'none';
    return;
  }
  const episodes = season.eps;
  const total = episodes.length;
  const seasonNum = season.num;
  const watched = await loadWatchedEpisodes(animeId);
  let processed = 0;
  const CHUNK = 30;

  function chunk() {
    const frag = document.createDocumentFragment();
    const end = Math.min(processed+CHUNK, total);
    for (let i=processed; i<end; i++) {
      const ep = episodes[i];
      const epNum = i+1;
      const isWatched = watched[seasonNum]?.includes(epNum);
      const btn = document.createElement('a');
      btn.href = `video-player.html?anime=${animeId}&s=${seasonNum}&e=${epNum}`;
      btn.className = 'ep-btn' + (isWatched ? ' watched' : '');
      btn.onmouseenter = () => playUISound('hover');
      
      const action = document.createElement('button');
      action.className = 'ep-action-btn';
      action.innerHTML = isWatched ? '<i class="fas fa-trash-alt"></i>' : '<i class="fas fa-check-circle"></i>';
      action.onclick = async (e) => {
        e.preventDefault(); e.stopPropagation();
        if (isWatched) await removeEpisodeWatched(animeId, seasonNum, epNum);
        else await markEpisodeWatched(animeId, seasonNum, epNum);
        await reloadSeason(details, animeId, seasonIdx);
      };
      btn.appendChild(action);
      
      const span = document.createElement('span');
      span.textContent = `▶ ${ep.title || `Episodio ${epNum}`}`;
      btn.appendChild(span);
      if (isWatched) {
        const tag = document.createElement('div');
        tag.className = 'watched-tag';
        tag.innerHTML = '<i class="fas fa-check"></i> VISTO';
        btn.appendChild(tag);
      }
      frag.appendChild(btn);
    }
    list.appendChild(frag);
    processed += CHUNK;
    if (processed < total) requestAnimationFrame(chunk);
    else if (loading) loading.style.display = 'none';
  }
  requestAnimationFrame(chunk);
};

async function loadAnimeRating(animeId) {
  try {
    const doc = await db.collection('animeRatings').doc(String(animeId)).get();
    if (doc.exists) {
      animeRatingData = doc.data();
    } else {
      animeRatingData = { avg: 0, count: 0 };
    }
    updateRatingDisplay();
    updateRatingLabel(animeRatingData.avg);
  } catch (error) {
    console.error("Error al cargar animeRating:", error);
    animeRatingData = { avg: 0, count: 0 };
    updateRatingDisplay();
    updateRatingLabel(0);
  }
}

function updateRatingDisplay() {
  const avgSpan = document.getElementById('averageRatingDisplay');
  const countSpan = document.getElementById('voteCountDisplay');
  if (avgSpan) avgSpan.textContent = (animeRatingData.count > 0) ? animeRatingData.avg.toFixed(1) : '--';
  if (countSpan) countSpan.textContent = (animeRatingData.count === 0) ? '(Sin votos)' : `(${animeRatingData.count} ${animeRatingData.count === 1 ? 'voto' : 'votos'})`;
  updateRatingLabel(animeRatingData.avg);
}

function updateRatingLabel(avg) {
  const labelSpan = document.getElementById('ratingLabel');
  if (!labelSpan) return;
  let text = 'Valoración media:';
  let color = '#ccc';
  if (avg >= 1 && avg <= 2.9) { text = '⭐ Valoración baja'; color = '#ff8888'; }
  else if (avg >= 3 && avg <= 4.0) { text = '👍 Valoración media'; color = '#ffcc88'; }
  else if (avg >= 4.1 && avg <= 5) { text = '🔥 Valoración alta'; color = '#ffaa44'; }
  labelSpan.innerHTML = text;
  labelSpan.style.color = color;
}

function renderStars(currentValue = 0) {
  const container = document.getElementById('starRatingWidget');
  if (!container) return;
  container.innerHTML = '';
  for (let i=1; i<=5; i++) {
    const star = document.createElement('i');
    star.className = 'fas fa-star star';
    if (currentValue >= i) star.classList.add('selected');
    star.setAttribute('data-value', i);
    
    star.addEventListener('mouseenter', () => highlightStars(i));
    star.addEventListener('mouseleave', () => resetStars(currentUserRating || 0));
    star.addEventListener('click', () => voteAnime(i));
    
    container.appendChild(star);
  }
}

function highlightStars(val) {
  document.querySelectorAll('#starRatingWidget .star').forEach((s, idx) => {
    if (idx < val) s.classList.add('hover'); else s.classList.remove('hover');
  });
}

function resetStars(val) {
  document.querySelectorAll('#starRatingWidget .star').forEach((s, idx) => {
    s.classList.remove('hover');
    if (idx < val) s.classList.add('selected'); else s.classList.remove('selected');
  });
}

async function voteAnime(newVal) {
  if (!currentUserId) {
    const msg = 'Tienes que iniciar sesión para votar.';
    showToast('🔐 ' + msg, true);
    document.getElementById('ratingMessage').innerHTML = `<i class="fas fa-exclamation-triangle"></i> ${msg}`;
    return;
  }

  const ratingRef = db.collection('animeRatings').doc(String(currentAnimeId));
  const userRef = ratingRef.collection('userRatings').doc(currentUserId);
  
  try {
    await db.runTransaction(async (t) => {
      const ratingDoc = await t.get(ratingRef);
      const userDoc = await t.get(userRef);
      
      let oldValue = userDoc.exists ? userDoc.data().value : null;
      let currentAvg = ratingDoc.exists ? ratingDoc.data().avg : 0;
      let currentCount = ratingDoc.exists ? ratingDoc.data().count : 0;
      
      let newAvg, newCount;
      
      if (oldValue !== null && oldValue === newVal) {
        if (currentCount === 1) {
          newAvg = 0;
          newCount = 0;
        } else {
          newAvg = (currentAvg * currentCount - oldValue) / (currentCount - 1);
          newCount = currentCount - 1;
        }
        if (newCount === 0) {
          t.set(ratingRef, { avg: 0, count: 0, updatedAt: firebase.firestore.FieldValue.serverTimestamp() });
        } else {
          t.set(ratingRef, { avg: newAvg, count: newCount, updatedAt: firebase.firestore.FieldValue.serverTimestamp() });
        }
        t.delete(userRef);
        animeRatingData = { avg: newAvg, count: newCount };
        currentUserRating = null;
        document.getElementById('ratingMessage').innerHTML = '<i class="fas fa-info-circle"></i> Has eliminado tu voto.';
      }
      else if (oldValue !== null && oldValue !== newVal) {
        newAvg = (currentAvg * currentCount - oldValue + newVal) / currentCount;
        newCount = currentCount;
        t.set(ratingRef, { avg: newAvg, count: newCount, updatedAt: firebase.firestore.FieldValue.serverTimestamp() });
        t.set(userRef, { value: newVal, timestamp: firebase.firestore.FieldValue.serverTimestamp() });
        animeRatingData = { avg: newAvg, count: newCount };
        currentUserRating = newVal;
        document.getElementById('ratingMessage').innerHTML = '<i class="fas fa-check-circle"></i> Voto actualizado.';
      }
      else if (oldValue === null) {
        if (currentCount === 0) {
          newAvg = newVal;
          newCount = 1;
        } else {
          newAvg = (currentAvg * currentCount + newVal) / (currentCount + 1);
          newCount = currentCount + 1;
        }
        t.set(ratingRef, { avg: newAvg, count: newCount, updatedAt: firebase.firestore.FieldValue.serverTimestamp() });
        t.set(userRef, { value: newVal, timestamp: firebase.firestore.FieldValue.serverTimestamp() });
        animeRatingData = { avg: newAvg, count: newCount };
        currentUserRating = newVal;
        document.getElementById('ratingMessage').innerHTML = '<i class="fas fa-check-circle"></i> ¡Gracias por tu voto!';
      }
    });
    
    updateRatingDisplay();
    renderStars(currentUserRating || 0);
    setTimeout(() => {
      const msg = document.getElementById('ratingMessage');
      if (msg && (msg.innerHTML.includes('Gracias') || msg.innerHTML.includes('actualizado') || msg.innerHTML.includes('eliminado'))) {
        msg.innerHTML = '';
      }
    }, 3000);
  } catch (error) {
    console.error("Error en transacción de voto:", error);
    let errorMsg = "Error al procesar el voto. Revisa tu conexión o inicia sesión nuevamente.";
    if (error.code === "permission-denied") {
      errorMsg = "Permiso denegado. Asegúrate de estar autenticado y de que las reglas de Firestore sean correctas.";
    } else if (error.message) {
      errorMsg = `Error: ${error.message}`;
    }
    document.getElementById('ratingMessage').innerHTML = `<i class="fas fa-times-circle"></i> ${errorMsg}`;
    showToast(errorMsg, true);
  }
}

async function loadUserRating(animeId, userId) {
  if (!userId) return;
  try {
    const doc = await db.collection('animeRatings').doc(String(animeId)).collection('userRatings').doc(userId).get();
    currentUserRating = doc.exists ? doc.data().value : null;
    renderStars(currentUserRating || 0);
  } catch(e) {
    console.warn("Error al cargar voto del usuario:", e);
  }
}

async function renderRecommendations(currentId) {
  const grid = document.getElementById('rec-grid');
  try {
    const allAnimes = (typeof catalogoArray !== 'undefined') ? catalogoArray : [];
    const others = allAnimes.filter(a => String(a.id) !== String(currentId));
    const random = others.sort(() => 0.5 - Math.random()).slice(0, 12);
    
    if (!random.length) {
      grid.innerHTML = '<p style="color:#666;">Sin recomendaciones</p>';
      return;
    }

    const frag = document.createDocumentFragment();
    for (let i = 0; i < random.length; i++) {
      const a = random[i];
      const card = document.createElement('div');
      card.className = 'rec-card';
      card.setAttribute('onclick', `playUISound('click'); location.href='anime-detail.html?id=${a.id}'`);
      card.setAttribute('onmouseenter', `playUISound('hover')`);
      // 🔥 IMAGEN CON LOADING EAGER Y DECODING ASYNC
      card.innerHTML = `
        <img src="${a.img}" alt="${a.title}" loading="eager" decoding="async" 
             style="background: #0a0a0c; min-height: 100%;">
        <p>${a.title}</p>
      `;
      frag.appendChild(card);
    }
    grid.innerHTML = '';
    grid.appendChild(frag);
  } catch(e) {
    console.error('Error cargando recomendaciones:', e);
    grid.innerHTML = '<p style="color:#666;">Error al cargar recomendaciones</p>';
  }
}

async function renderMainContent() {
  const container = document.getElementById('contenido');
  if (!animeData) {
    container.innerHTML = "<h2 style='text-align:center;padding:50px;'>Anime no encontrado</h2>";
    return;
  }
  document.title = `${animeData.title || 'Anime'} - Archinime OS`;

  const genres = animeData.genres || [];
  const genreHtml = genres.map(g => `<span class="genre-chip">${escapeHtml(g)}</span>`).join('');
  const desc = animeData.desc || 'Sin descripción disponible.';

  // 🔥 Portada con loading eager
  let html = `
    <div class="anime-cover">
      <img src="${animeData.img || ''}" alt="cover" loading="eager" decoding="async" 
           style="background: #0a0a0c; min-height: 200px;">
    </div>
    <h1>${animeData.title || ''}</h1>
    <div class="genres-wrap">${genreHtml || '<span class="genre-chip">Sin géneros</span>'}</div>
    <p class="desc">${desc}</p>
    <div class="rating-section">
      <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:15px;">
        <div class="rating-stats">
          <span id="ratingLabel">Valoración media:</span>
          <span id="averageRatingDisplay">--</span>
          <span id="voteCountDisplay">(Sin votos)</span>
        </div>
        <div id="starRatingWidget" style="display:flex; gap:8px;"></div>
      </div>
      <div id="ratingMessage"></div>
    </div>
  `;

  if (animeData.seasons && Array.isArray(animeData.seasons)) {
    animeData.seasons.forEach((s, idx) => {
      if (!s) return;
      html += `
        <details data-season-index="${idx}" data-anime-id="${animeId}">
          <summary>${s.name || 'Temporada ' + (s.num || idx+1)}</summary>
          <div class="season-content">
            ${s.cover ? `<img src="${s.cover}" style="width:100%; border-radius:12px; margin-bottom:15px;" loading="lazy" decoding="async">` : ''}
            <div class="video-list" id="list-${idx}"></div>
            <div id="loading-${idx}" style="display:none; text-align:center; padding:10px;">Cargando...</div>
          </div>
        </details>
      `;
    });
  }
  container.innerHTML = html;

  renderStars(0);
  await renderRecommendations(animeId);
  await loadAnimeRating(animeId);
  
  if (currentUserId) {
    await loadUserRating(animeId, currentUserId);
  }

  const musicList = animeData.music || [];
  if (musicList.length > 0) {
    playMusicFromArray(musicList);
  }

  document.querySelectorAll('details').forEach(d => {
    if (d.hasAttribute('data-listener')) return;
    d.setAttribute('data-listener', 'true');
    const aid = d.dataset.animeId;
    const idx = d.dataset.seasonIndex;
    if (aid && idx) d.ontoggle = () => toggleSeason(d, aid, parseInt(idx));
  });
}

function loadSearchCache() {
  if (typeof catalogoArray !== 'undefined') {
    searchCache = catalogoArray.map(item => ({
      id: item.id,
      title: item.title || '',
      img: item.img || '',
      aliases: item.aliases || []
    }));
    console.log(`📦 Caché de búsqueda cargada localmente: ${searchCache.length} animes`);
  } else {
    console.warn('catalogoArray no está definido aún. Se reintentará...');
    setTimeout(loadSearchCache, 100);
  }
}

function initSearch() {
  const searchInput = document.getElementById('quick-search');
  let floatingDropdown = null;
  let isScrolling = false;

  function createFloatingDropdown() {
    if (floatingDropdown) floatingDropdown.remove();
    floatingDropdown = document.createElement('div');
    floatingDropdown.className = 'floating-dropdown';
    document.body.appendChild(floatingDropdown);
    return floatingDropdown;
  }
  function updateDropdownPosition() {
    if (!floatingDropdown || floatingDropdown.style.display === 'none') return;
    const rect = searchInput.getBoundingClientRect();
    let top = rect.bottom + window.scrollY + 5;
    let left = rect.left + window.scrollX;
    const dropdownWidth = floatingDropdown.offsetWidth;
    const viewportWidth = window.innerWidth;
    if (left + dropdownWidth > viewportWidth - 10) left = viewportWidth - dropdownWidth - 10;
    if (left < 10) left = 10;
    floatingDropdown.style.top = top + 'px';
    floatingDropdown.style.left = left + 'px';
    if (window.innerWidth <= 768) {
      floatingDropdown.style.width = '90%';
      floatingDropdown.style.left = '5%';
      floatingDropdown.style.right = '5%';
    } else {
      floatingDropdown.style.width = rect.width + 'px';
    }
  }
  function showDropdown(results) {
    if (!floatingDropdown) createFloatingDropdown();
    if (!results.length) { floatingDropdown.style.display = 'none'; return; }
    floatingDropdown.innerHTML = results.map(item => `
      <div class="search-item" data-id="${item.id}">
        <img src="${item.img}" loading="lazy" decoding="async">
        <div class="search-item-info">
          <span class="search-item-title">${item.title}</span>
        </div>
      </div>
    `).join('');
    floatingDropdown.querySelectorAll('.search-item').forEach(el => {
      el.addEventListener('click', () => { window.location.href = `anime-detail.html?id=${el.dataset.id}`; });
      el.addEventListener('mouseenter', () => playUISound('hover'));
    });
    updateDropdownPosition();
    floatingDropdown.style.display = 'block';
  }
  function hideDropdown() { if (floatingDropdown) floatingDropdown.style.display = 'none'; }

  searchInput.addEventListener('input', function() {
    const q = this.value.trim().toLowerCase();
    if (!q) { hideDropdown(); return; }
    
    const matches = searchCache.filter(item => {
      if (String(item.id) === String(currentAnimeId)) return false;
      const titlesToCheck = [item.title, ...(item.aliases || [])];
      return titlesToCheck.some(t => t.toLowerCase().startsWith(q));
    }).slice(0, 10);
    
    showDropdown(matches);
  });

  const scrollHandler = () => {
    if (!isScrolling) {
      window.requestAnimationFrame(() => { updateDropdownPosition(); isScrolling = false; });
      isScrolling = true;
    }
  };
  window.addEventListener('resize', scrollHandler, { passive: true });
  window.addEventListener('scroll', scrollHandler, { passive: true });
  document.addEventListener('click', (e) => {
    if (!searchInput.contains(e.target) && !floatingDropdown?.contains(e.target)) hideDropdown();
  });
  searchInput.addEventListener('focus', () => { if (searchInput.value.trim()) searchInput.dispatchEvent(new Event('input')); });
}

function initAuthListener() {
  if (window.ArchinimeState) {
    ArchinimeState.on('currentUser', async (user) => {
      const previousUserId = currentUserId;
      currentUserId = user ? user.uid : null;
      
      if (currentAnimeId && animeData) {
        if (currentUserId && !previousUserId) {
          await loadUserRating(currentAnimeId, currentUserId);
        }
        if (!currentUserId && previousUserId) {
          currentUserRating = null;
          renderStars(0);
        }
        
        const details = document.querySelectorAll('details');
        for (let d of details) {
          if (d.open) {
            const aid = d.dataset.animeId;
            const sidx = d.dataset.seasonIndex;
            if (aid && sidx) await reloadSeason(d, aid, parseInt(sidx));
          }
        }
      }
    });
  } else {
    console.warn("ArchinimeState no encontrado, usando auth.onAuthStateChanged como fallback");
    auth.onAuthStateChanged(async (user) => {
      const previousUserId = currentUserId;
      currentUserId = user ? user.uid : null;
      
      if (currentAnimeId && animeData) {
        if (currentUserId && !previousUserId) {
          await loadUserRating(currentAnimeId, currentUserId);
        }
        if (!currentUserId && previousUserId) {
          currentUserRating = null;
          renderStars(0);
        }
        
        const details = document.querySelectorAll('details');
        for (let d of details) {
          if (d.open) {
            const aid = d.dataset.animeId;
            const sidx = d.dataset.seasonIndex;
            if (aid && sidx) await reloadSeason(d, aid, parseInt(sidx));
          }
        }
      }
    });
  }
}

function waitForCatalog() {
  return new Promise((resolve) => {
    if (typeof catalogoArray !== 'undefined') {
      resolve();
    } else {
      console.log('⏳ Esperando a que catalogoArray esté disponible...');
      const checkInterval = setInterval(() => {
        if (typeof catalogoArray !== 'undefined') {
          clearInterval(checkInterval);
          console.log('✅ catalogoArray cargado.');
          resolve();
        }
      }, 50);
      setTimeout(() => {
        clearInterval(checkInterval);
        if (typeof catalogoArray === 'undefined') {
          console.error('❌ No se pudo cargar catalogoArray después de 5 segundos.');
          document.getElementById('contenido').innerHTML = '<h2 style="text-align:center;padding:50px;">Error: Catálogo no cargado. Recarga la página.</h2>';
        }
        resolve();
      }, 5000);
    }
  });
}

(async function init() {
  await waitForCatalog();
  loadSearchCache();
  initAuthListener();

  if (!animeId) {
    document.getElementById('contenido').innerHTML = "<h2 style='text-align:center;padding:50px;'>ID de anime no proporcionado</h2>";
    return;
  }
  
  if (typeof catalogoArray === 'undefined') {
    document.getElementById('contenido').innerHTML = "<h2 style='text-align:center;padding:50px;'>Error: Catálogo no cargado</h2>";
    return;
  }
  
  const foundAnime = catalogoArray.find(a => String(a.id) === String(animeId));
  if (!foundAnime) {
    document.getElementById('contenido').innerHTML = "<h2 style='text-align:center;padding:50px;'>Anime no encontrado</h2>";
    return;
  }
  
  animeData = foundAnime;
  
  try {
    await renderMainContent();
    initSearch();
    document.getElementById('share-detail')?.addEventListener('click', () => {
      playUISound('click');
      navigator.clipboard.writeText(location.href);
      showToast('Enlace copiado');
    });
  } catch(e) {
    console.error('Error crítico renderizando anime:', e);
    document.getElementById('contenido').innerHTML = `<h2 style='text-align:center;padding:50px;color:red;'>Error al cargar el anime: ${e.message}</h2>`;
  }
})();