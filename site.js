// Rewrites the cross-site links on the static pages (syntax/, doc/) so they point at the right
// origin: anything under ../i/ or ../doc/ goes to the viewer origin, ../ and ../syntax/ to the
// editor origin (see config.js). On a single local origin every rewrite is the identity.
(function () {
  var c = window.QNA_CONFIG; if (!c) return;
  var viewerBase = c.viewerUrl.replace(/i\/$/, ''), editorBase = c.editorUrl;
  function fix(v) {
    var m = /^\.\.\/(i|doc)\/(.*)$/.exec(v);
    if (m) return viewerBase + m[1] + '/' + m[2];
    if (v === '../') return editorBase;
    m = /^\.\.\/(syntax)\/(.*)$/.exec(v); if (m) return editorBase + m[1] + '/' + m[2];
    return null;
  }
  function run() {
    ['href', 'src'].forEach(function (attr) {
      var els = document.querySelectorAll('[' + attr + '^="../"]');
      for (var i = 0; i < els.length; i++) { var n = fix(els[i].getAttribute(attr)); if (n !== null) els[i].setAttribute(attr, n); }
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run); else run();
})();
