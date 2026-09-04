// reacciones.js
// SISTEMA DE REACCIONES TIPO FACEBOOK CYBERPUNK v5.0
// MEJORADO: Rendimiento, tooltips, accesibilidad, animaciones

const REACTIONS_MAP = {
    'like':  { emoji: '👍', color: '#00f3ff', name: 'Me gusta' },
    'love':  { emoji: '❤️', color: '#ff0055', name: 'Me encanta' },
    'haha':  { emoji: '😂', color: '#f1c40f', name: 'Me divierte' },
    'wow':   { emoji: '😮', color: '#bc13fe', name: 'Me asombra' },
    'sad':   { emoji: '😢', color: '#0066ff', name: 'Me entristece' },
    'angry': { emoji: '😡', color: '#ff4757', name: 'Me enoja' }
};

function injectReaccionesCSS() {
    if (document.getElementById('archinime-reacciones-css')) return;
    const style = document.createElement('style');
    style.id = 'archinime-reacciones-css';
    style.innerHTML = `
        .btn-reaccionar-container {
            position: relative;
            display: inline-flex;
            align-items: center;
        }

        .reactions-picker {
            position: absolute;
            bottom: calc(100% + 8px);
            left: 50%;
            transform: translateX(-50%) translateY(15px) scale(0.8);
            background: rgba(10, 10, 15, 0.98);
            backdrop-filter: blur(20px);
            border: 1px solid var(--neon-primary, #00f3ff);
            border-radius: 30px;
            padding: 8px 12px;
            display: flex;
            gap: 12px;
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.9), 0 0 20px rgba(0, 243, 255, 0.2);
            opacity: 0;
            pointer-events: none;
            transition: all 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
            z-index: 99999;
        }
        
        .reactions-picker::after {
            content: '';
            position: absolute;
            bottom: -15px;
            left: 0;
            width: 100%;
            height: 15px;
        }
        
        .btn-reaccionar-container:hover .reactions-picker,
        .reactions-picker:hover {
            opacity: 1;
            pointer-events: auto;
            transform: translateX(-50%) translateY(0) scale(1);
        }

        .reaction-icon {
            font-size: 1.6rem;
            cursor: pointer;
            transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1), filter 0.2s;
            filter: grayscale(0.6) opacity(0.8);
            position: relative;
            transform-origin: bottom;
        }
        .reaction-icon:hover {
            transform: scale(1.5) translateY(-5px);
            filter: grayscale(0) opacity(1);
            z-index: 10;
        }
        .reaction-icon:active { transform: scale(0.8); }

        .reactions-summary {
            display: flex;
            align-items: center;
            gap: 4px;
            background: rgba(255, 255, 255, 0.05);
            padding: 4px 10px;
            border-radius: 20px;
            border: 1px solid rgba(255,255,255,0.1);
            font-size: 0.8rem;
            color: #aaa;
            cursor: pointer;
            transition: all 0.2s;
            user-select: none;
        }
        .reactions-summary:hover {
            background: rgba(0, 243, 255, 0.1);
            border-color: rgba(0, 243, 255, 0.4);
            color: #fff;
        }
        .reactions-summary.user-reacted {
            background: rgba(255, 255, 255, 0.1);
            color: var(--neon-primary);
            border-color: currentColor;
            box-shadow: inset 0 0 8px currentColor;
        }
        
        .reactions-summary span.r-emoji {
            font-size: 1rem;
            margin-right: -4px;
            position: relative;
            z-index: 1;
            filter: drop-shadow(0 2px 2px rgba(0,0,0,0.8));
        }
        .reactions-summary span.r-emoji:nth-child(2) { z-index: 2; }
        .reactions-summary span.r-emoji:nth-child(3) { z-index: 3; margin-right: 4px; }
        .reactions-summary span.r-emoji:only-of-type { margin-right: 4px; }

        @media (max-width: 768px) {
            .reactions-picker { gap: 8px; padding: 6px 10px; }
            .reaction-icon { font-size: 1.4rem; }
            .reactions-summary { padding: 3px 8px; font-size: 0.75rem; }
        }
    `;
    document.head.appendChild(style);
}

function getCurrentUser() {
    return window.ArchinimeState ? window.ArchinimeState.get('currentUser') : null;
}

window.toggleReaccion = async function(commentId, tipoReaccion, event) {
    if (event) event.stopPropagation();
    const user = getCurrentUser();
    if (!user) {
        if (typeof openLoginModalFromComent === 'function') {
            openLoginModalFromComent();
        } else {
            alert("Inicia sesión para reaccionar");
        }
        return;
    }

    if (typeof comentariosDb === 'undefined' || !comentariosDb) {
        console.error("comentariosDb no está definido.");
        alert("Error interno. Recarga la página.");
        return;
    }

    const docRef = comentariosDb.collection('comments').doc(commentId);
    try {
        await docRef.update({
            [`reactions.${user.uid}`]: tipoReaccion
        });
        if (typeof playUISound === 'function') playUISound('click');
    } catch (e) {
        console.error("Error al reaccionar", e);
        if (e.message.includes("Missing or insufficient permissions")) {
            alert("No se pudo reaccionar. Las reglas de la base de datos (Firestore) te impiden modificar un comentario que no es tuyo.");
        } else {
            alert("Error al guardar la reacción. Inténtalo de nuevo.");
        }
    }
};

window.quitarReaccion = async function(commentId, event) {
    if (event) event.stopPropagation();
    const user = getCurrentUser();
    if (!user) return;

    if (typeof comentariosDb === 'undefined' || !comentariosDb) {
        console.error("comentariosDb no está definido.");
        return;
    }

    const docRef = comentariosDb.collection('comments').doc(commentId);
    try {
        await docRef.update({
            [`reactions.${user.uid}`]: firebase.firestore.FieldValue.delete()
        });
        if (typeof playUISound === 'function') playUISound('click');
    } catch (e) {
        console.error("Error al quitar reacción", e);
        alert("No se pudo quitar la reacción. Inténtalo de nuevo.");
    }
};

window.procesarReaccionesHTML = function(commentId, reactionsObj) {
    const reactions = reactionsObj || {};
    const currentUser = getCurrentUser();
    const userIds = Object.keys(reactions);
    const total = userIds.length;
    
    let currentUserReaction = null;
    if (currentUser && reactions[currentUser.uid]) {
        currentUserReaction = reactions[currentUser.uid];
    }

    const counts = {};
    userIds.forEach(uid => {
        const type = reactions[uid];
        if (REACTIONS_MAP[type]) {
            counts[type] = (counts[type] || 0) + 1;
        }
    });
    
    const sortedTypes = Object.keys(counts).sort((a, b) => counts[b] - counts[a]).slice(0, 3);
    const topIconsHTML = sortedTypes.map(type => `<span class="r-emoji">${REACTIONS_MAP[type].emoji}</span>`).join('');
    
    let summaryContent = '';
    let summaryClass = 'reactions-summary';
    let summaryStyle = '';
    let clickAction = '';
    
    if (total > 0) {
        if (currentUserReaction && REACTIONS_MAP[currentUserReaction]) {
            summaryClass += ' user-reacted';
            summaryStyle = `color: ${REACTIONS_MAP[currentUserReaction].color};`;
            clickAction = `onclick="quitarReaccion('${commentId}', event)" title="Clic para quitar reacción"`;
        }
        summaryContent = `${topIconsHTML} <strong>${total}</strong>`;
    } else {
        summaryContent = `<i class="far fa-smile" style="font-size: 1rem;"></i> <span>+</span>`;
    }

    const pickerHTML = `
        <div class="reactions-picker">
            ${Object.keys(REACTIONS_MAP).map(type => 
                `<span class="reaction-icon" title="${REACTIONS_MAP[type].name}" onclick="toggleReaccion('${commentId}', '${type}', event)">${REACTIONS_MAP[type].emoji}</span>`
            ).join('')}
        </div>
    `;
    
    return `
        <div class="btn-reaccionar-container">
            <div class="${summaryClass}" style="${summaryStyle}" ${clickAction}>
                ${summaryContent}
            </div>
            ${pickerHTML}
        </div>
    `;
};

injectReaccionesCSS();