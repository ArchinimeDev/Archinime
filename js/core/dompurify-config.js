// dompurify-config.js
// Configuración centralizada de DOMPurify para Archinime
// Prevención de XSS en comentarios y stickers
// Mejorado: permite más atributos útiles y optimiza el rendimiento

(function() {
  if (typeof DOMPurify === 'undefined') {
    console.warn('DOMPurify no está cargado. La sanitización no funcionará.');
    return;
  }

  const purifyConfig = {
    ALLOWED_TAGS: [
      'b', 'i', 'em', 'strong', 'a', 'span', 'div', 'p', 'br',
      'img', 'video', 'source', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'ul', 'ol', 'li', 'code', 'pre', 'blockquote', 'hr'
    ],
    ALLOWED_ATTR: [
      'href', 'target', 'rel', 'src', 'alt', 'title', 'width', 'height',
      'class', 'style', 'controls', 'autoplay', 'loop', 'muted', 'playsinline',
      'loading', 'decoding', 'data-sticker-url', 'id', 'role', 'aria-label'
    ],
    FORBID_TAGS: ['script', 'object', 'embed', 'form', 'input', 'button', 'iframe'],
    FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'onfocus', 'onblur', 'onchange'],
    ALLOW_ARIA_ATTR: true,
    ALLOW_DATA_ATTR: true,
    USE_PROFILES: { html: true },
    ALLOWED_URI_REGEXP: /^(?:(?:(?:f|ht)tps?|mailto|tel|callto|cid|xmpp|data):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i
  };

  // Función principal de sanitización
  window.sanitizeHTML = function(dirty) {
    if (dirty == null) return '';
    return DOMPurify.sanitize(String(dirty), purifyConfig);
  };

  // Escapar para atributos
  window.escapeAttr = function(text) {
    if (text == null) return '';
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  };

  // Alias
  window.escapeHtmlComent = window.sanitizeHTML;

  console.log('✅ DOMPurify configurado y listo.');
})();