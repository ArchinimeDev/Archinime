// ============================================
// SISTEMA DE COMENTARIOS "PREMIUM" CYBERPUNK v11.0
// MEJORADO: Rendimiento, accesibilidad, animaciones, scroll perfecto
// ============================================

let comentariosDb = null;
let comentariosAuth = null;
let comentariosUnsubscribe = null;
let comentariosInicializados = false;

window.stickerSeleccionadoParaEnviar = null;
window.respondiendoA = null;
window.lastPostedCommentId = null;
window.hasScrolledToTarget = false;

// --- FUNCIÓN DE LIMPIEZA INDUSTRIAL (DOMPurify) ---
function archinimeClean(html, isSticker = false) {
    if (typeof DOMPurify !== 'undefined') {
        const config = isSticker 
            ? { ALLOWED_TAGS: ['img'], ALLOWED_ATTR: ['src', 'class', 'alt', 'style'] }
            : { ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'span', 'br', 'img', 'a', 'blockquote'], 
                ALLOWED_ATTR: ['src', 'class', 'style', 'alt', 'href', 'target', 'rel'] };
        return DOMPurify.sanitize(html, config);
    }
    // Fallback seguro
    return html.replace(/<script\b[^>]*>([\s\S]*?)<\/script>/gim, "");
}

function initComentariosSystem(db, auth) {
    if (comentariosInicializados) return;
    comentariosInicializados = true;

    comentariosDb = db;
    comentariosAuth = auth;
    injectCommentsCSS();

    const procesarUsuario = async (user) => {
        if (user) {
            try {
                const userDoc = await db.collection('users').doc(user.uid).get();
                if (userDoc.exists && userDoc.data().customColor) {
                    if(window.ArchinimeState) ArchinimeState.set('currentUserColor', userDoc.data().customColor);
                    else window.comentariosCurrentUserColor = userDoc.data().customColor;
                } else {
                    if(window.ArchinimeState) ArchinimeState.set('currentUserColor', null);
                    else window.comentariosCurrentUserColor = null;
                }
            } catch(e) { console.warn(e); }
        } else {
            if(window.ArchinimeState) ArchinimeState.set('currentUserColor', null);
            else window.comentariosCurrentUserColor = null;
        }
        updateComentariosUI();
    };

    if (window.ArchinimeState) {
        ArchinimeState.on('currentUser', procesarUsuario);
        procesarUsuario(ArchinimeState.get('currentUser'));
    } else {
        auth.onAuthStateChanged((user) => {
            window.currentUserForComent = user;
            procesarUsuario(user);
        });
    }

    if (window.comentariosAnimeId && window.comentariosSeason && window.comentariosEpisode) {
        setupComentariosRealtimeListener();
    } else {
        const container = document.getElementById('comentariosList');
        if(container) container.innerHTML = '<div class="empty-comments" style="color:var(--cm-neon-alert);">Error: Faltan datos del episodio en la URL.</div>';
    }

    setTimeout(() => {
        const textarea = document.getElementById('comentarioTexto');
        if (textarea) {
            textarea.addEventListener('keydown', function(e) {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    if(this.value.trim().length > 0 || window.stickerSeleccionadoParaEnviar) {
                        enviarComentarioTexto();
                    }
                }
            });
            textarea.addEventListener('input', function() {
                autoResizeTextarea(this);
                validarBotonPrincipal(this);
            });
        }
        const stickerBtn = document.querySelector('.sticker-btn');
        if (stickerBtn) stickerBtn.innerHTML = '🖼️';
    }, 1000);

    document.addEventListener('click', () => closeAllCommentMenus());
}

function autoResizeTextarea(el) {
    el.style.height = 'auto';
    el.style.height = (el.scrollHeight) + 'px';
}

function injectCommentsCSS() {
    if (document.getElementById('archinime-comments-css')) return;
    const style = document.createElement('style');
    style.id = 'archinime-comments-css';
    style.innerHTML = `
        :root {
            --cm-neon-primary: #00fff7;
            --cm-neon-secondary: #bc13fe;
            --cm-neon-alert: #ff0055;
            --cm-bg-glass: rgba(15, 18, 25, 0.65);
            --cm-bg-glass-hover: rgba(22, 26, 36, 0.85);
            --cm-border: rgba(255, 255, 255, 0.05);
            --cm-text-main: #e2e8f0;
            --cm-text-muted: #94a3b8;
        }
        
        .comentario-user-info { display: flex !important; align-items: center !important; gap: 12px !important; margin-bottom: 15px !important; }
        #comentarioUserAvatar { width: 42px !important; height: 42px !important; border-radius: 50% !important; object-fit: cover !important; border: 2px solid var(--cm-neon-primary); transition: all 0.3s; }
        #comentarioUserName { font-family: 'Orbitron', sans-serif !important; font-weight: 700 !important; font-size: 1.05rem !important; letter-spacing: 0.5px; transition: all 0.3s; }

        .comentario-item { 
            position: relative;
            background: var(--cm-bg-glass);
            backdrop-filter: blur(12px);
            border: 1px solid var(--cm-border);
            border-left: 3px solid var(--user-color, var(--cm-neon-primary));
            border-radius: 12px;
            margin-bottom: 12px;
            padding: 16px;
            display: flex;
            flex-direction: row;
            gap: 15px;
            transition: all 0.3s ease;
            box-shadow: 0 4px 15px rgba(0,0,0,0.2);
            will-change: transform, background;
        }
        .comentario-item:hover { background: var(--cm-bg-glass-hover); border-color: rgba(255,255,255,0.1); box-shadow: 0 6px 20px rgba(0,0,0,0.4); }

        .comentario-item.is-reply { background: rgba(10, 12, 16, 0.4); border-radius: 8px; padding: 12px 16px; margin-bottom: 8px; }

        .comentario-avatar { flex-shrink: 0; }
        .comentario-avatar img { width: 45px; height: 45px; border-radius: 50%; object-fit: cover; border: 2px solid var(--user-color); box-shadow: 0 0 10px var(--user-color-glow); }
        .is-reply .comentario-avatar img { width: 35px; height: 35px; }

        .comentario-content { flex: 1; min-width: 0; display: flex; flex-direction: column; }
        .comentario-header { display: flex; align-items: center; margin-bottom: 4px; }
        .comentario-user { font-family: 'Orbitron', sans-serif; font-weight: 800; font-size: 0.95rem; color: var(--user-color); text-shadow: 0 0 8px var(--user-color-glow); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 90%; }
        .comentario-texto { color: var(--cm-text-main); font-size: 0.95rem; line-height: 1.5; word-wrap: break-word; }

        .comentario-footer { display: flex; align-items: center; flex-wrap: wrap; gap: 15px; margin-top: 10px; }
        .comentario-fecha { color: var(--cm-text-muted); font-size: 0.8rem; font-weight: 600; }
        .comentario-badge-edit { font-size: 0.7rem; font-style: italic; opacity: 0.7; margin-left: 5px; }
        
        .btn-responder-ghost { background: transparent; border: none; color: var(--cm-text-muted); font-family: 'Poppins', sans-serif; font-size: 0.8rem; font-weight: 700; cursor: pointer; padding: 0; transition: color 0.2s; text-transform: uppercase; letter-spacing: 0.5px; }
        .btn-responder-ghost:hover { color: var(--cm-neon-primary); text-shadow: 0 0 8px rgba(0,255,247,0.5); }

        .comentario-item.is-reply::before { content: ''; position: absolute; left: -22px; top: 25px; width: 22px; height: 2px; background: rgba(255, 255, 255, 0.1); border-radius: 2px 0 0 2px; }
        .replies-thread { margin-left: 24px; padding-left: 20px; border-left: 2px solid rgba(255, 255, 255, 0.08); margin-top: 5px; margin-bottom: 5px; display: flex; flex-direction: column; }
        .nested-reply .replies-thread { margin-left: 16px; padding-left: 14px; }
        .nested-reply .comentario-item.is-reply::before { left: -14px; width: 14px; }

        .comment-options-container { position: absolute; top: 12px; right: 12px; z-index: 10; }
        .kebab-btn { background: transparent; border: none; color: #666; font-size: 1.1rem; cursor: pointer; padding: 5px; transition: 0.2s; border-radius: 50%; width: 30px; height: 30px; display: flex; align-items: center; justify-content: center; }
        .kebab-btn:hover { color: #fff; background: rgba(255,255,255,0.1); }
        
        .comment-dropdown { position: absolute; top: 100%; right: 0; background: rgba(15, 15, 20, 0.98); border: 1px solid var(--cm-border); box-shadow: 0 10px 30px rgba(0,0,0,0.8); border-radius: 12px; padding: 8px 0; min-width: 140px; opacity: 0; pointer-events: none; transform: translateY(-10px); transition: 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275); z-index: 100; }
        .comment-dropdown.show { opacity: 1; pointer-events: auto; transform: translateY(0); }
        .comment-dropdown-btn { background: transparent; border: none; color: #ccc; padding: 10px 18px; width: 100%; text-align: left; font-family: 'Poppins', sans-serif; font-size: 0.85rem; font-weight: 600; cursor: pointer; transition: 0.2s; display: flex; align-items: center; gap: 10px; }
        .comment-dropdown-btn:hover { background: rgba(255,255,255,0.05); color: #fff; padding-left: 22px; }

        .toggle-respuestas-btn { background: transparent; border: none; color: var(--cm-text-muted); cursor: pointer; font-family: 'Poppins', sans-serif; font-weight: 700; font-size: 0.8rem; margin: 4px 0 12px 0; display: inline-flex; align-items: center; gap: 8px; transition: 0.2s; }
        .toggle-respuestas-btn:hover { color: var(--cm-neon-primary); }
        .toggle-respuestas-btn::before { content: ''; width: 25px; height: 2px; background: rgba(255,255,255,0.1); display: inline-block; border-radius: 2px; transition: 0.2s; }
        .toggle-respuestas-btn:hover::before { background: var(--cm-neon-primary); box-shadow: 0 0 8px var(--cm-neon-primary); }

        .btn-more-replies { background: transparent; border: 1px dashed rgba(255,255,255,0.2); color: var(--cm-text-muted); width: 100%; padding: 10px; border-radius: 8px; cursor: pointer; font-weight: 600; transition: 0.2s; margin-top: 5px; }
        .btn-more-replies:hover { background: rgba(255,255,255,0.05); color: #fff; border-color: rgba(255,255,255,0.4); }

        .reply-box-container { margin: 10px 0; padding: 16px; background: rgba(0, 0, 0, 0.4); border-radius: 16px; border: 1px solid rgba(255,255,255,0.05); display:flex; flex-direction:column; gap:12px; animation: slideIn 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275); }
        .reply-box-header { display: flex; justify-content: space-between; align-items: center; color: var(--cm-text-muted); font-size: 0.8rem; }
        .reply-box-header b { color: var(--cm-neon-primary); font-weight: 800; }
        .reply-box-close { background: rgba(255,255,255,0.05); border: none; color: #aaa; width: 28px; height: 28px; border-radius: 50%; cursor: pointer; transition: 0.2s; display: flex; align-items: center; justify-content: center; }
        .reply-box-close:hover { background: var(--cm-neon-alert); color: #fff; transform: rotate(90deg); }
        .reply-box-body { display: flex; gap: 12px; }
        .reply-box-avatar { width: 36px; height: 36px; border-radius: 50%; object-fit: cover; border: 1px solid rgba(255,255,255,0.1); }
        .reply-box-textarea { width: 100%; background: rgba(15,15,20,0.8); border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; padding: 12px; color: #fff; font-family: 'Poppins', sans-serif; font-size: 0.9rem; resize: none; outline: none; transition: 0.3s; min-height: 60px; }
        .reply-box-textarea:focus { border-color: var(--cm-neon-primary); box-shadow: inset 0 0 10px rgba(0,255,247,0.1); }
        .reply-box-tools { display: flex; gap: 8px; margin-top: 8px; }
        .reply-box-tool-btn { background: rgba(255,255,255,0.05); border: 1px solid transparent; border-radius: 8px; padding: 6px 12px; cursor: pointer; color: #fff; transition: 0.2s; }
        .reply-box-tool-btn:hover { background: rgba(255,255,255,0.1); border-color: rgba(255,255,255,0.2); transform: translateY(-2px); }
        .reply-box-submit { background: var(--cm-neon-primary); border: none; color: #000; font-weight: 800; padding: 8px 20px; border-radius: 20px; font-size: 0.85rem; cursor: pointer; transition: 0.3s; box-shadow: 0 0 15px rgba(0,255,247,0.3); }
        .reply-box-submit:hover:not(.btn-disabled) { background: #fff; box-shadow: 0 0 20px rgba(255,255,255,0.5); transform: translateY(-2px); }

        .comentario-media-wrapper { margin-top: 10px; border-radius: 12px; overflow: hidden; display: inline-block; border: 1px solid rgba(255,255,255,0.1); }
        .comentario-media { display: block; max-width: 200px; max-height: 250px; object-fit: contain; }

        .comentario-sticker-preview {
            margin: 12px 0; padding: 8px; background: rgba(0, 0, 0, 0.4); border-radius: 16px; border: 1px solid rgba(0, 243, 255, 0.3); display: flex; align-items: center; gap: 12px; max-width: 100%; overflow: hidden;
        }
        .preview-sticker-wrapper {
            position: relative; display: inline-block; max-width: 80px; max-height: 80px; background: rgba(0,0,0,0.6); border-radius: 12px; overflow: hidden; border: 1px solid var(--cm-neon-primary);
        }
        .preview-sticker-wrapper img,
        .preview-sticker-wrapper video {
            width: auto; height: auto; max-width: 80px; max-height: 80px; object-fit: contain; display: block; margin: 0 auto;
        }
        .remove-sticker-btn {
            position: absolute; top: -8px; right: -8px; background: #ff0055; border: none; color: white; border-radius: 50%; width: 24px; height: 24px; font-size: 12px; cursor: pointer; display: flex; align-items: center; justify-content: center; box-shadow: 0 0 8px rgba(255,0,85,0.6); transition: transform 0.2s;
        }
        .remove-sticker-btn:hover { transform: scale(1.1); background: #ff3366; }

        @keyframes slideIn { from { opacity: 0; transform: translateY(-15px) scale(0.98); } to { opacity: 1; transform: translateY(0) scale(1); } }
        .new-comment-fx { animation: slideIn 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards !important; }

        @keyframes targetHighlight {
            0%   { box-shadow: 0 0 0 0 var(--cm-neon-primary); background: rgba(0, 243, 255, 0.3); }
            50%  { box-shadow: 0 0 30px 10px var(--cm-neon-primary); background: rgba(0, 243, 255, 0.6); }
            100% { box-shadow: 0 0 0 0 var(--cm-neon-primary); background: var(--cm-bg-glass); }
        }
        .comment-targeted { animation: targetHighlight 2.5s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards !important; border-color: var(--cm-neon-primary) !important; }

        @media (max-width: 768px) {
            .comentario-item { padding: 12px !important; gap: 10px !important; border-radius: 10px !important; }
            .comentario-avatar img { width: 38px !important; height: 38px !important; }
            .is-reply .comentario-avatar img { width: 30px !important; height: 30px !important; }
            .replies-thread { margin-left: 12px; padding-left: 12px; }
            .nested-reply .replies-thread { margin-left: 8px; padding-left: 8px; }
            .comentario-item.is-reply::before { left: -12px; width: 12px; }
            .comentario-texto { font-size: 0.85rem; }
            .comentario-footer { gap: 10px; margin-top: 8px; }
            .comment-options-container { top: 8px; right: 8px; }
            .preview-sticker-wrapper { max-width: 60px; max-height: 60px; }
            .preview-sticker-wrapper img,
            .preview-sticker-wrapper video { max-width: 60px; max-height: 60px; }
        }
    `;
    document.head.appendChild(style);
}

function getCurrentUser() {
    if (window.ArchinimeState) return ArchinimeState.get('currentUser');
    return window.currentUserForComent || null;
}

function getCurrentUserColor() {
    if (window.ArchinimeState) return ArchinimeState.get('currentUserColor');
    return window.comentariosCurrentUserColor || null;
}

window.toggleCommentMenu = function(id, event) {
    event.stopPropagation();
    const currentMenu = document.getElementById(`dropdown-${id}`);
    const isShowing = currentMenu.classList.contains('show');
    closeAllCommentMenus();
    if (!isShowing) {
        currentMenu.classList.add('show');
        const commentBox = document.getElementById(`comment-${id}`);
        if(commentBox) commentBox.style.zIndex = '9999';
    }
};

window.closeAllCommentMenus = function() {
    document.querySelectorAll('.comment-dropdown').forEach(m => m.classList.remove('show'));
    document.querySelectorAll('.comentario-item').forEach(m => m.style.zIndex = '');
};

function getNeonColorByString(str) {
    const neonColors = ['#00fff7', '#ff0055', '#bc13fe', '#00ff33', '#ffff00', '#ffaa00', '#ff00aa', '#00aaff'];
    let hash = 0;
    for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
    return neonColors[Math.abs(hash) % neonColors.length];
}

function hexToRgbA(hex, alpha) {
    let r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function setupComentariosRealtimeListener() {
    if (comentariosUnsubscribe) comentariosUnsubscribe();
    
    const tempSeason = parseInt(window.comentariosSeason);
    const tempEpisode = parseInt(window.comentariosEpisode);

    if (!window.comentariosAnimeId || isNaN(tempSeason) || isNaN(tempEpisode)) {
        const container = document.getElementById('comentariosList');
        if (container) container.innerHTML = '<div class="empty-comments" style="color:var(--cm-neon-alert);">No se pudieron cargar los comentarios. La URL está incompleta.</div>';
        return;
    }

    const commentsRef = comentariosDb.collection('comments')
        .where('animeId', '==', window.comentariosAnimeId)
        .where('season', '==', tempSeason)
        .where('episode', '==', tempEpisode)
        .orderBy('timestamp', 'desc')
        .limit(150);

    comentariosUnsubscribe = commentsRef.onSnapshot((snapshot) => {
        const container = document.getElementById('comentariosList');
        if (!container) return;
        
        if (snapshot.empty) {
            container.innerHTML = `<div class="empty-comments" style="text-align: center; padding: 40px 20px;"><i class="fas fa-ghost" style="font-size: 3rem; color: var(--cm-border); margin-bottom: 15px; display:block;"></i><p style="font-size: 1rem; color: var(--cm-text-muted); font-weight: 600;">El vacío espacial... Sé el primero en comentar.</p></div>`;
            return;
        }

        // Guardar estado de contenedores abiertos
        const openContainers = new Set();
        document.querySelectorAll('.replies-thread').forEach(el => {
            if (el.style.display !== 'none') openContainers.add(el.id);
        });

        const docsReversed = [...snapshot.docs].reverse();
        const allComments = docsReversed.map(doc => ({ id: doc.id, ...doc.data() }));
        const commentMap = new Map();
        allComments.forEach(c => commentMap.set(c.id, { ...c, replies: [] }));
      
        const roots = [];
        allComments.forEach(c => {
            if (c.replyToId && commentMap.has(c.replyToId)) {
                commentMap.get(c.replyToId).replies.push(commentMap.get(c.id));
            } else {
                roots.push(commentMap.get(c.id));
            }
        });

        roots.sort((a, b) => {
            const scoreA = Object.keys(a.reactions || {}).length + (a.replies ? a.replies.length : 0);
            const scoreB = Object.keys(b.reactions || {}).length + (b.replies ? b.replies.length : 0);
            if (scoreB !== scoreA) return scoreB - scoreA;
            return (b.timestamp?.toMillis() || 0) - (a.timestamp?.toMillis() || 0);
        });

        function countAllReplies(node) {
            let count = node.replies.length;
            node.replies.forEach(r => count += countAllReplies(r));
            return count;
        }

        function renderNode(node, level = 0, isHiddenRoot = false, rootId = null) {
            let nodeHtml = '';
            const isNew = window.lastPostedCommentId === node.id;
            const hiddenClass = isHiddenRoot ? `hidden-reply-${rootId}` : '';
            const hiddenStyle = isHiddenRoot ? 'display: none;' : '';
            
            nodeHtml += `<div class="${hiddenClass}" style="${hiddenStyle}">`;
            nodeHtml += generarHtmlComentario(node, level > 0, isNew, level);

            if (node.replies && node.replies.length > 0) {
                node.replies.sort((a, b) => (a.timestamp?.toMillis() || 0) - (b.timestamp?.toMillis() || 0));
                if (level === 0) {
                    const totalCount = countAllReplies(node);
                    const textoBtn = totalCount === 1 ? 'Ver 1 respuesta' : `Ver ${totalCount} respuestas`;
                    nodeHtml += `<div>
                                    <button class="toggle-respuestas-btn" onclick="toggleRespuestas('${node.id}')">
                                        <span id="text-${node.id}" data-total="${totalCount}">${textoBtn}</span>
                                    </button>
                                 </div>`;
                    nodeHtml += `<div class="replies-thread" id="container-${node.id}" style="display: none;">`;
                    node.replies.forEach((reply, index) => {
                        const isHidden = index >= 5;
                        nodeHtml += renderNode(reply, level + 1, isHidden, node.id);
                    });
                    if (node.replies.length > 5) {
                        const remaining = node.replies.length - 5;
                        nodeHtml += `<button id="showMore-${node.id}" onclick="showMoreReplies('${node.id}')" class="btn-more-replies">Cargar ${remaining} respuestas más...</button>`;
                    }
                    nodeHtml += `</div>`;
                } else {
                    nodeHtml += `<div class="replies-thread nested-reply">`;
                    node.replies.forEach(reply => nodeHtml += renderNode(reply, level + 1, false, null));
                    nodeHtml += `</div>`;
                }
            }
            nodeHtml += `</div>`;
            return nodeHtml;
        }

        let html = '';
        roots.forEach(root => html += renderNode(root, 0, false, null));
        container.innerHTML = html;

        // Restaurar contenedores abiertos
        openContainers.forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                el.style.display = 'flex';
                const rootId = id.replace('container-', '');
                const textSpan = document.getElementById(`text-${rootId}`);
                if (textSpan) textSpan.innerText = 'Ocultar respuestas';
            }
        });

        window.lastPostedCommentId = null;

        // Scroll perfecto a comentario destino (desde URL)
        const urlParams = new URLSearchParams(window.location.search);
        const targetCommentId = urlParams.get('targetComment');
        
        if (targetCommentId && !window.hasScrolledToTarget) {
            const expandFullyAndScroll = (attempt = 0) => {
                const targetEl = document.getElementById(`comment-${targetCommentId}`);
                if (!targetEl) {
                    if (attempt < 30) {
                        setTimeout(() => expandFullyAndScroll(attempt + 1), 200);
                    } else {
                        console.warn('No se encontró el comentario destino:', targetCommentId);
                    }
                    return;
                }

                // Expandir padres
                let parent = targetEl.parentElement;
                const parentsToExpand = [];
                while (parent && parent.id !== 'comentariosList') {
                    if (parent.classList && parent.classList.contains('replies-thread') && parent.style.display === 'none') {
                        parentsToExpand.push(parent);
                    }
                    parent = parent.parentElement;
                }
                parentsToExpand.reverse().forEach(thread => {
                    thread.style.display = 'flex';
                    const rootId = thread.id.replace('container-', '');
                    const textSpan = document.getElementById(`text-${rootId}`);
                    if (textSpan) textSpan.innerText = 'Ocultar respuestas';
                });

                // Si está dentro de hidden-reply
                let hiddenContainer = targetEl.closest('[class*="hidden-reply-"]');
                if (hiddenContainer) {
                    const match = hiddenContainer.className.match(/hidden-reply-([^ ]+)/);
                    if (match && match[1]) {
                        const rootId = match[1];
                        document.querySelectorAll(`.hidden-reply-${rootId}`).forEach(el => el.style.display = 'block');
                        const moreBtn = document.getElementById(`showMore-${rootId}`);
                        if (moreBtn) moreBtn.style.display = 'none';
                    }
                }

                setTimeout(() => {
                    const finalTarget = document.getElementById(`comment-${targetCommentId}`);
                    if (finalTarget) {
                        const rect = finalTarget.getBoundingClientRect();
                        const absoluteTop = rect.top + window.pageYOffset;
                        window.scrollTo({
                            top: absoluteTop - 100,
                            behavior: 'smooth'
                        });
                        finalTarget.classList.add('comment-targeted');
                        window.hasScrolledToTarget = true;
                        
                        const cleanUrl = window.location.protocol + "//" + window.location.host + window.location.pathname + `?anime=${window.comentariosAnimeId}&s=${window.comentariosSeason}&e=${window.comentariosEpisode}`;
                        window.history.replaceState({path: cleanUrl}, '', cleanUrl);
                    }
                }, 150);
            };
            
            setTimeout(() => expandFullyAndScroll(0), 400);
        }
    }, (error) => {
        console.error('Error en comentarios:', error);
        const container = document.getElementById('comentariosList');
        if (container) {
            container.innerHTML = `<div class="empty-comments" style="color:var(--cm-neon-alert); border: 1px dashed var(--cm-neon-alert); padding: 20px;"><b>Error de sistema:</b><br>${error.message}<br><br><span style="font-size:0.8rem; color:#aaa;">(Si eres el creador, verifica que tienes los "Índices compuestos" configurados en tu consola de Firestore).</span></div>`;
        }
    });
}

window.eliminarComentarioSistema = async function(id) {
    if (!confirm("¿Seguro que quieres eliminar este comentario?\nSe borrarán también todas las respuestas vinculadas permanentemente.")) return;
    try {
        async function borrarHilo(commentId) {
            const replies = await comentariosDb.collection('comments').where('replyToId', '==', commentId).get();
            for (const doc of replies.docs) {
                await borrarHilo(doc.id);
                await doc.ref.delete();
            }
        }
        await borrarHilo(id);
        await comentariosDb.collection('comments').doc(id).delete();
        showToastComent('🗑️ Datos eliminados.');
    } catch(e) {
        alert("Error de permisos / Sistema: " + e.message);
    }
};

function generarHtmlComentario(c, isReply, isNew = false, level = 0) {
    let fecha = 'Justo ahora';
    if (c.timestamp?.toDate) fecha = obtenerTiempoRelativo(c.timestamp.toDate());
    
    const currentUser = getCurrentUser();
    const isAdmin = currentUser?.email === 'archinime12@gmail.com';
    const isOwner = currentUser?.uid === c.userId;
    const avatar = c.userAvatar || 'invitado.avif';
    const userName = c.userName || 'Usuario';
    const neonColor = c.customColor || getNeonColorByString(c.userId || userName);
    const neonGlow = hexToRgbA(neonColor, 0.4);

    let contenidoHtml = procesarTextoComentario(c.texto || '');
    let badgeEditado = c.editado ? '<span class="comentario-badge-edit">(Editado)</span>' : '';
    
    if (c.esSticker && c.stickerUrl && !contenidoHtml.includes(c.stickerUrl)) {
        const isVideo = c.stickerUrl.match(/\.(mp4|webm)$/i);
        const tagMedia = isVideo ? 'video autoplay loop muted playsinline' : 'img loading="lazy"';
        contenidoHtml += `
            <div class="comentario-media-wrapper" style="border-color: ${neonColor}; box-shadow: 0 4px 15px ${neonGlow}; cursor: pointer;"
            onclick="openStickerModal('${c.stickerUrl}')">
                <${tagMedia} src="${c.stickerUrl}" class="comentario-media" style="transition: transform 0.3s;"
                onmouseover="this.style.transform='scale(1.05)';" onmouseout="this.style.transform='scale(1)';"></${isVideo ? 'video' : 'img'}>
            </div>
        `;
    }
    
    const newFxClass = isNew ? 'new-comment-fx' : '';
    const editMenuBtn = isOwner ? `<button class="comment-dropdown-btn" onclick="iniciarEdicion('${c.id}'); closeAllCommentMenus();"><i class="fas fa-edit" style="color:var(--cm-neon-primary)"></i> Editar</button>` : '';
    const reportMenuBtn = `<button class="comment-dropdown-btn" onclick="reportarComentario('${c.id}'); closeAllCommentMenus();"><i class="fas fa-flag" style="color:var(--cm-neon-alert)"></i> Reportar</button>`;
    const deleteMenuBtn = isAdmin ?
    `<button class="comment-dropdown-btn" onclick="eliminarComentarioSistema('${c.id}'); closeAllCommentMenus();"><i class="fas fa-trash" style="color:var(--cm-neon-alert)"></i> Eliminar</button>` : '';
    const optionsMenu = `
        <div class="comment-options-container">
            <button class="kebab-btn" onclick="toggleCommentMenu('${c.id}', event)"><i class="fas fa-ellipsis-v"></i></button>
            <div class="comment-dropdown" id="dropdown-${c.id}">
                ${reportMenuBtn}
                ${editMenuBtn}
                ${deleteMenuBtn}
            </div>
        </div>
    `;

    let reaccionesBar = '';
    if (typeof procesarReaccionesHTML === 'function') reaccionesBar = procesarReaccionesHTML(c.id, c.reactions);
    
    const botonResponder = currentUser ?
    `<button class="btn-responder-ghost" onclick="prepararRespuesta('${c.id}', '${escapeHtmlComent(userName)}', '${c.userId}'); closeAllCommentMenus();">Responder</button>` : '';

    return `
        <div class="comentario-item ${isReply ? 'is-reply' : ''} ${newFxClass}" id="comment-${c.id}" 
            ondblclick="prepararRespuesta('${c.id}', '${escapeHtmlComent(userName)}', '${c.userId}'); closeAllCommentMenus();"
            style="--user-color: ${neonColor}; --user-color-glow: ${neonGlow};">
            
            ${optionsMenu}

            <div class="comentario-avatar">
                <img src="${avatar}" onerror="this.src='invitado.avif'">
            </div>
            
            <div class="comentario-content">
                <div class="comentario-header">
                    <span class="comentario-user">${escapeHtmlComent(userName)}</span>
                </div>
                
                <div class="comentario-texto" data-raw="${encodeURIComponent(c.texto || '')}">${contenidoHtml}</div>
               
                <div class="comentario-footer">
                    <span class="comentario-fecha">${fecha}${badgeEditado}</span>
                    ${botonResponder}
                    ${reaccionesBar}
                </div>
            </div>
        </div>
    `;
}

window.iniciarEdicion = function(commentId) {
    const textContainer = document.querySelector(`#comment-${commentId} .comentario-texto`);
    if (!textContainer || textContainer.classList.contains('editing')) return;
    const rawText = decodeURIComponent(textContainer.getAttribute('data-raw') || '');
    textContainer.setAttribute('data-original-html', textContainer.innerHTML);
    textContainer.classList.add('editing');
    
    const plainText = rawText.replace(/\[Sticker\]\([^)]+\)/g, '').trim();
    textContainer.innerHTML = `
        <div class="reply-box-container" style="animation: none; margin: 10px 0 0 0; background: rgba(0,0,0,0.2);">
            <textarea id="edit-input-${commentId}" class="reply-box-textarea">${escapeHtmlComent(plainText)}</textarea>
            <div style="display:flex; gap:10px; justify-content: flex-end; margin-top: 8px;">
                <button onclick="cancelarEdicion('${commentId}')" style="background:transparent; border:none; color:var(--cm-text-muted); cursor:pointer; font-weight:700; font-family:'Poppins', sans-serif;">Cancelar</button>
                <button onclick="guardarEdicion('${commentId}')" class="reply-box-submit">Guardar</button>
            </div>
        </div>
    `;
};

window.cancelarEdicion = function(commentId) {
    const textContainer = document.querySelector(`#comment-${commentId} .comentario-texto`);
    if (!textContainer) return;
    textContainer.innerHTML = textContainer.getAttribute('data-original-html');
    textContainer.classList.remove('editing');
};

window.guardarEdicion = async function(commentId) {
    const input = document.getElementById(`edit-input-${commentId}`);
    if (!input) return;
    const nuevoTexto = input.value.trim();
    try {
        const docRef = comentariosDb.collection('comments').doc(commentId);
        const doc = await docRef.get();
        if(doc.exists) {
            const data = doc.data();
            let textoFinal = nuevoTexto;
            if (data.esSticker && data.stickerUrl) {
                textoFinal += (nuevoTexto ? '\n' : '') + `[Sticker](${data.stickerUrl})`;
            }
            await docRef.update({ texto: textoFinal, editado: true });
            showToastComent('✏️ Editado');
        }
    } catch (error) { alert("Error: " + error.message); }
};

window.reportarComentario = function(id) {
    if(!getCurrentUser()) return openLoginModalFromComent();
    showToastComent('🚩 Reportado.');
};

window.toggleRespuestas = function(rootId) {
    const container = document.getElementById(`container-${rootId}`);
    const textSpan = document.getElementById(`text-${rootId}`);
    if(!container) return;
    if (container.style.display === 'none') {
        container.style.display = 'flex';
        if (textSpan) textSpan.innerText = 'Ocultar respuestas';
    } else {
        container.style.display = 'none';
        if (textSpan) {
            const count = textSpan.getAttribute('data-total');
            textSpan.innerText = count == 1 ? 'Ver 1 respuesta' : `Ver ${count} respuestas`;
        }
    }
};

window.showMoreReplies = function(rootId) {
    document.querySelectorAll(`.hidden-reply-${rootId}`).forEach(el => el.style.display = 'block');
    const btn = document.getElementById(`showMore-${rootId}`);
    if(btn) btn.style.display = 'none';
};

function obtenerTiempoRelativo(fecha) {
    const diff = Math.floor((new Date() - fecha) / 1000);
    if (diff < 60) return 'Hace un momento';
    if (diff < 3600) return `Hace ${Math.floor(diff / 60)} min`;
    if (diff < 86400) return `Hace ${Math.floor(diff / 3600)} h`;
    return fecha.toLocaleDateString();
}

function procesarTextoComentario(texto) {
    if (!texto) return '';
    let html = escapeHtmlComent(texto.trim());
    const emojisMap = { ':D': '😃', ':)': '😊', ':(': '😢', ':P': '😛', ';)': '😉', '<3': '❤️' };
    for (const [code, emoji] of Object.entries(emojisMap)) html = html.split(code).join(emoji);
    
    html = html.replace(/\n{2,}/g, '\n').replace(/\n/g, '<br>');
    const stickerRegex = /\[Sticker\]\(([^)]+)\)/g;
    html = html.replace(stickerRegex, (match, url) => {
        const isVideo = url.match(/\.(mp4|webm)$/i);
        const tag = isVideo ? 'video autoplay loop muted playsinline' : 'img loading="lazy"';
        return `<div class="comentario-media-wrapper"><${tag} src="${url}" class="comentario-media" onclick="openStickerModal('${url.replace(/'/g, "\\'")}')" style="cursor: pointer; transition: transform 0.2s;" onmouseover="this.style.transform='scale(1.05)';" onmouseout="this.style.transform='scale(1)';"></${isVideo ? 'video' : 'img'}></div>`;
    });
    const palabras = html.split(/(\s+)/);
    for (let i = 0; i < palabras.length; i++) {
        let palabra = palabras[i];
        if (palabra.startsWith('http://') || palabra.startsWith('https://')) {
            if (palabra.match(/\.(jpg|jpeg|png|gif|webp|avif)(\?.*)?$/i) && !palabra.includes('comentario-media')) {
                palabras[i] = `<div class="comentario-media-wrapper"><img src="${palabra}" loading="lazy" class="comentario-media"></div>`;
            } else if (palabra.match(/\.(mp4|webm)(\?.*)?$/i) && !palabra.includes('comentario-media')) {
                palabras[i] = `<div class="comentario-media-wrapper"><video src="${palabra}" autoplay loop muted playsinline class="comentario-media"></video></div>`;
            } else if (!palabra.includes('comentario-media')) {
                palabras[i] = `<a href="${palabra}" target="_blank" style="color: var(--cm-neon-primary); text-decoration: underline;">${palabra}</a>`;
            }
        }
    }
    return palabras.join('').replace(/^(<br>)+/, '').trim();
}

window.restaurarPanelesGlobales = function() {
    const originalContainer = document.getElementById('comentarioFormContainer');
    const sendBtn = document.getElementById('enviarComentarioBtn'); 
    
    const previewEl = document.getElementById('comentarioStickerPreview');
    const stickerEl = document.getElementById('stickerPanelFull');

    if (originalContainer && sendBtn) {
        if(previewEl) originalContainer.insertBefore(previewEl, sendBtn);
        if(stickerEl) originalContainer.insertBefore(stickerEl, sendBtn);
    } else if (originalContainer) {
        if(previewEl) originalContainer.appendChild(previewEl);
        if(stickerEl) originalContainer.appendChild(stickerEl);
    }
    
    if(stickerEl) stickerEl.classList.remove('active');
};

window.prepararRespuesta = function(commentId, userName, userId) {
    const currentUser = getCurrentUser();
    if (!currentUser) return openLoginModalFromComent();
    cancelarRespuesta(true);
    window.respondiendoA = { id: commentId, userName, userId };
    
    const commentEl = document.getElementById(`comment-${commentId}`);
    if (!commentEl) return;
    
    const replyBox = document.createElement('div');
    replyBox.id = `dynamicReplyBox-${commentId}`;
    replyBox.className = 'reply-box-container';
    replyBox.innerHTML = `
        <div class="reply-box-header">
            <span>Respondiendo a <b>@${escapeHtmlComent(userName)}</b></span>
            <button class="reply-box-close" onclick="cancelarRespuesta()"><i class="fas fa-times"></i></button>
        </div>
        <div class="reply-box-body">
            <img src="${currentUser.photoURL || 'invitado.avif'}" class="reply-box-avatar">
            <div style="flex: 1;">
                <textarea id="dynamicReplyText-${commentId}" class="reply-box-textarea" placeholder="Añade una respuesta pública..." maxlength="500"></textarea>
                <div class="reply-box-tools">
                    <button type="button" class="reply-box-tool-btn" onclick="toggleStickerPanelSistema()">🖼️</button>
                </div>
                <div id="dynamicPanelsDest-${commentId}" style="width: 100%; margin-top: 8px;"></div>
                <div style="display: flex; justify-content: flex-end; margin-top: 10px;">
                    <button id="btnEnviarRespuesta-${commentId}" onclick="enviarRespuestaDinamica()" class="reply-box-submit btn-disabled">Responder</button>
                </div>
            </div>
        </div>
    `;
    commentEl.parentNode.insertBefore(replyBox, commentEl.nextSibling);
    
    const panelDest = document.getElementById(`dynamicPanelsDest-${commentId}`);
    if (panelDest) {
        const p1 = document.getElementById('comentarioStickerPreview');
        const p3 = document.getElementById('stickerPanelFull');
        if(p1) panelDest.appendChild(p1);
        if(p3) { panelDest.appendChild(p3); p3.classList.remove('active'); }
    }
    
    const textArea = document.getElementById(`dynamicReplyText-${commentId}`);
    if(textArea) {
        textArea.focus();
        textArea.addEventListener('input', function() { autoResizeTextarea(this); validarBotonPrincipal(this); });
        textArea.addEventListener('keydown', function(e) {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                if(!document.getElementById(`btnEnviarRespuesta-${commentId}`).classList.contains('btn-disabled')) enviarRespuestaDinamica();
            }
        });
    }
};

window.cancelarRespuesta = function(forzarSync = false) {
    const box = window.respondiendoA ? document.getElementById(`dynamicReplyBox-${window.respondiendoA.id}`) : document.querySelector('[id^="dynamicReplyBox-"]');
    window.respondiendoA = null;
    restaurarPanelesGlobales(); 
    quitarStickerPreview();
    if (box) box.remove();
};

window.openStickerModal = function(url) {
    let modal = document.getElementById('stickerViewModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'stickerViewModal';
        modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(5,5,10,0.95);backdrop-filter: blur(10px);z-index:100000;display:flex;flex-direction:column;align-items:center;justify-content:center;padding: 20px; opacity:0; transition:0.3s;';
        modal.innerHTML = `
            <div style="position:relative; text-align:center; max-width:90vw;">
                <button onclick="closeStickerModal()" style="position:absolute;top:-50px;right:-10px;background:rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.2);color:#fff;width:40px;height:40px;border-radius:50%;font-size:1.2rem;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:0.2s;"><i class="fas fa-times"></i></button>
                <img id="stickerModalImg" src="" style="display:none; max-width:100%;max-height:70vh;border-radius:16px;box-shadow:0 10px 40px rgba(0,255,247,0.2);">
                <video id="stickerModalVid" src="" autoplay loop muted playsinline style="display:none; max-width:100%;max-height:70vh;border-radius:16px;box-shadow:0 10px 40px rgba(0,255,247,0.2);"></video>
                <br><button id="stickerModalStealBtn" style="margin-top:25px;background:var(--cm-neon-primary);border:none;color:#000;padding:12px 25px;border-radius:25px;font-weight:800;font-family:'Orbitron',sans-serif;letter-spacing:1px;cursor:pointer;box-shadow:0 0 15px rgba(0,255,247,0.4);transition:0.2s;">
                    <i class="fas fa-mask"></i> ROBAR STICKER
                </button>
            </div>
        `;
        document.body.appendChild(modal);
    }
    
    const isVideo = url.match(/\.(mp4|webm)$/i);
    const imgEl = document.getElementById('stickerModalImg');
    const vidEl = document.getElementById('stickerModalVid');
    
    if (isVideo) { imgEl.style.display = 'none'; vidEl.src = url; vidEl.style.display = 'block'; }
    else { vidEl.style.display = 'none'; imgEl.src = url; imgEl.style.display = 'block'; }
    
    document.getElementById('stickerModalStealBtn').onclick = () => {
        if(typeof window.robarStickerSistema === 'function') { window.robarStickerSistema(url); closeStickerModal(); }
        else alert("Inicia sesión primero.");
    };
    modal.style.display = 'flex';
    setTimeout(() => modal.style.opacity = '1', 10);
};

window.closeStickerModal = function() {
    let modal = document.getElementById('stickerViewModal');
    if (modal) { 
        modal.style.opacity = '0';
        setTimeout(() => { modal.style.display = 'none'; document.getElementById('stickerModalVid').src = ''; }, 300);
    }
};

window.validarBotonPrincipal = function(textarea) {
    if (!textarea) return;
    let btn = null;
    if (textarea.id && textarea.id.startsWith('dynamicReplyText') && window.respondiendoA) {
        btn = document.getElementById(`btnEnviarRespuesta-${window.respondiendoA.id}`);
    } else {
        btn = document.getElementById('enviarComentarioBtn');
    }
    if (!btn) return;
    const hasText = textarea.value.trim().length > 0;
    const hasSticker = !!window.stickerSeleccionadoParaEnviar;
    const enabled = hasText || hasSticker;
    if (enabled) {
        btn.disabled = false;
        btn.classList.remove('btn-disabled');
        btn.style.opacity = '1';
        btn.style.cursor = 'pointer';
    } else {
        btn.disabled = true;
        btn.classList.add('btn-disabled');
        btn.style.opacity = '0.5';
        btn.style.cursor = 'not-allowed';
    }
};

async function enviarComentarioTexto() {
    const currentUser = getCurrentUser();
    if (!currentUser) return openLoginModalFromComent();
    
    const textoInput = document.getElementById('comentarioTexto');
    if (!textoInput) return;

    const texto = textoInput.value.trim();
    const stickerUrl = window.stickerSeleccionadoParaEnviar;
    const btn = document.getElementById('enviarComentarioBtn');
    if ((!texto && !stickerUrl) || (btn && btn.disabled)) return;

    const originalTexto = texto;
    const originalSticker = stickerUrl;
    if (btn) {
        btn.disabled = true;
        btn.dataset.original = btn.innerHTML;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Enviando...';
    }
    
    let textoFinal = texto + (stickerUrl ? ((texto ? '\n' : '') + `[Sticker](${stickerUrl})`) : '');
    textoInput.value = '';
    textoInput.style.height = 'auto';
    quitarStickerPreview();
    document.getElementById('stickerPanelFull')?.classList.remove('active');
    
    validarBotonPrincipal(textoInput);
    try {
        const docRef = await comentariosDb.collection('comments').add({
            animeId: window.comentariosAnimeId,
            season: parseInt(window.comentariosSeason),
            episode: parseInt(window.comentariosEpisode),
            userId: currentUser.uid,
            userName: currentUser.displayName || currentUser.email.split('@')[0],
            userAvatar: currentUser.photoURL || 'invitado.avif',
            texto: textoFinal,
            customColor: getCurrentUserColor() || null,
            esSticker: !!stickerUrl,
            stickerUrl: stickerUrl || null,
            replyToId: null,
            replyToUser: null,
            replyToUserId: null,
            reactions: {},
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });
        window.lastPostedCommentId = docRef.id;
        showToastComent('✅ Comentario enviado');
    } catch (error) {
        console.error("Error al enviar:", error);
        textoInput.value = originalTexto;
        if (originalSticker) {
            window.stickerSeleccionadoParaEnviar = originalSticker;
            mostrarPreviewSticker(originalSticker);
        }
        showToastComent('❌ Error: ' + error.message);
        validarBotonPrincipal(textoInput);
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = btn.dataset.original;
            delete btn.dataset.original;
        }
    }
}

function mostrarPreviewSticker(url) {
    const previewContainer = document.getElementById('comentarioStickerPreview');
    const previewImg = document.getElementById('previewStickerImgObj');
    const previewVid = document.getElementById('previewStickerVidObj');
    if (!previewContainer) return;
    const isVideo = url.match(/\.(mp4|webm)$/i);
    if (isVideo) {
        previewImg.style.display = 'none';
        previewVid.src = url;
        previewVid.style.display = 'inline-block';
    } else {
        previewVid.style.display = 'none';
        previewImg.src = url;
        previewImg.style.display = 'inline-block';
    }
    previewContainer.style.display = 'block';
}

window.seleccionarStickerParaEnviar = function(url) {
    window.stickerSeleccionadoParaEnviar = url;
    mostrarPreviewSticker(url);
    const panel = document.getElementById('stickerPanelFull');
    if (panel) panel.classList.remove('active');
    let targetTextarea = document.getElementById('comentarioTexto');
    if (window.respondiendoA) {
        targetTextarea = document.getElementById(`dynamicReplyText-${window.respondiendoA.id}`);
    }
    if (targetTextarea) validarBotonPrincipal(targetTextarea);
};

window.quitarStickerPreview = function() {
    window.stickerSeleccionadoParaEnviar = null;
    const previewContainer = document.getElementById('comentarioStickerPreview');
    if (previewContainer) previewContainer.style.display = 'none';
    const img = document.getElementById('previewStickerImgObj');
    const vid = document.getElementById('previewStickerVidObj');
    if (img) img.src = '';
    if (vid) vid.src = '';
    let targetTextarea = document.getElementById('comentarioTexto');
    if (window.respondiendoA) {
        targetTextarea = document.getElementById(`dynamicReplyText-${window.respondiendoA.id}`);
    }
    if (targetTextarea) validarBotonPrincipal(targetTextarea);
};

async function crearNotificacionDeRespuesta(idUsuarioDestino, idAnime, nombreAnime, textoComentario) {
    try {
        const currentUser = getCurrentUser();
        await comentariosDb.collection('notifications').add({
            targetUserId: idUsuarioDestino, 
            fromUserId: currentUser.uid,
            fromUserName: currentUser.displayName || currentUser.email.split('@')[0] || "Un usuario",
            type: "reply",
            animeId: idAnime,
            animeTitle: nombreAnime,
            text: textoComentario.substring(0, 50) + "...",
            seen: false,
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });
    } catch (error) {
        console.warn("No se pudo crear la notificación (posible restricción de reglas):", error);
    }
}

window.enviarRespuestaDinamica = async function() {
    const currentUser = getCurrentUser();
    if (!currentUser) return openLoginModalFromComent();
    if (!window.respondiendoA) return;
    const replyContext = { ...window.respondiendoA };
    const textoInput = document.getElementById(`dynamicReplyText-${replyContext.id}`);
    if (!textoInput) return;

    const texto = textoInput.value.trim();
    const stickerUrl = window.stickerSeleccionadoParaEnviar;
    if (!texto && !stickerUrl) return;

    const btn = document.getElementById(`btnEnviarRespuesta-${replyContext.id}`);
    if (btn) btn.disabled = true;
    textoInput.disabled = true;
    
    let textoFinal = texto + (stickerUrl ? ((texto ? '\n' : '') + `[Sticker](${stickerUrl})`) : '');
    quitarStickerPreview();
    restaurarPanelesGlobales(); 

    try {
        const docRef = await comentariosDb.collection('comments').add({
            animeId: window.comentariosAnimeId,
            season: parseInt(window.comentariosSeason),
            episode: parseInt(window.comentariosEpisode),
            userId: currentUser.uid,
            userName: currentUser.displayName || currentUser.email.split('@')[0],
            userAvatar: currentUser.photoURL || 'invitado.avif',
            texto: textoFinal,
            customColor: getCurrentUserColor() || null,
            esSticker: !!stickerUrl,
            stickerUrl: stickerUrl || null,
            replyToId: replyContext.id,
            replyToUser: replyContext.userName,
            replyToUserId: replyContext.userId,
            reactions: {},
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });
        window.lastPostedCommentId = docRef.id;

        if (replyContext.userId && replyContext.userId !== currentUser.uid) {
            await crearNotificacionDeRespuesta(
                replyContext.userId, 
                window.comentariosAnimeId, 
                window.comentariosAnimeTitle || window.comentariosAnimeId, 
                textoFinal
            );
        }

        cancelarRespuesta(true);
        showToastComent('✅ Respuesta enviada');
    } catch (error) {
        alert('Error: ' + error.message);
    } finally {
        if (btn) btn.disabled = false;
        textoInput.disabled = false;
    }
};

function updateComentariosUI() {
    const currentUser = getCurrentUser();
    const loginMsg = document.getElementById('comentarioLoginMessage');
    const formContainer = document.getElementById('comentarioFormContainer');
    if (!currentUser) {
        if (loginMsg) loginMsg.style.display = 'block';
        if (formContainer) formContainer.style.display = 'none';
    } else {
        if (loginMsg) loginMsg.style.display = 'none';
        if (formContainer) formContainer.style.display = 'block';
        const avatar = document.getElementById('comentarioUserAvatar');
        const color = getCurrentUserColor() || getNeonColorByString(currentUser.uid || currentUser.email);
        if (avatar) {
            avatar.src = currentUser.photoURL || 'invitado.avif';
            avatar.style.borderColor = color;
            avatar.style.boxShadow = `0 0 15px ${hexToRgbA(color, 0.5)}`;
        }
        
        const name = document.getElementById('comentarioUserName');
        if (name) {
            name.innerText = currentUser.displayName || currentUser.email.split('@')[0];
            name.style.color = color;
            name.style.textShadow = `0 0 10px ${hexToRgbA(color, 0.5)}`;
        }
    }
}

function toggleStickerPanelSistema() {
    const panel = document.getElementById('stickerPanelFull');
    if (panel) { 
        panel.classList.toggle('active'); 
    }
}

function showToastComent(msg) {
    let toast = document.getElementById('toastComent');
    if (!toast) {
        toast = document.createElement('div'); toast.id = 'toastComent';
        toast.style.cssText = 'position:fixed;bottom:80px;left:50%;transform:translateX(-50%);background:var(--cm-bg-glass);backdrop-filter:blur(10px);color:var(--cm-neon-primary);padding:12px 25px;border-radius:25px;z-index:10000;font-weight:bold;border:1px solid var(--cm-neon-primary);box-shadow:0 0 20px rgba(0,255,247,0.3);';
        document.body.appendChild(toast);
    }
    toast.innerHTML = msg; toast.style.display = 'block';
    setTimeout(() => toast.style.display = 'none', 3000);
}

function openLoginModalFromComent() { 
    document.getElementById('authModal')?.classList.add('show');
}

function escapeHtmlComent(text) { 
    const div = document.createElement('div'); 
    div.textContent = text;
    return div.innerHTML; 
}