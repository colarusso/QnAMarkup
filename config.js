// Site configuration for the QnA Markup editor and viewer.
//
// The site is served from two origins so that QnAs (which may contain
// anybody's HTML and JavaScript) never run on the same origin as the editor:
//
//   editorOrigin  the editor, syntax docs, templates and the library (dist/)
//   viewerOrigin  the viewer (i/) and the document page (doc/), which render
//                 whatever a link hands them
//
// On localhost / 127.0.0.1 / *.localhost / file: the same folder serves both
// roles from one origin and every URL below becomes relative, so the site can
// be developed and tested locally without any changes. `npm run serve --split`
// serves the folder on two ports to rehearse the cross-origin behaviour.
(function () {
  var SETTINGS = {
    editorOrigin: 'https://www.qnamarkup.org',
    viewerOrigin: 'https://www.qnamarkup.net',

    // Local two-port mode (node test/serve.js --split): pages on editorPort act as
    // the editor origin and pages on viewerPort as the viewer origin.
    local: { editorPort: 8000, viewerPort: 8001 },

    // Path, under editorOrigin, of the versioned library releases. Generated
    // snippets load <libraryPath>/<version>/qna.min.js with an integrity hash
    // (version and hash come from dist/meta.js, written by build.js).
    libraryPath: '/dist',

    // Navigation links shown in the editor header.
    nav: [
      { label: 'Syntax', href: 'syntax/'},
      { label: 'Video Primer', href: 'https://youtu.be/RVhzQ1JVi3s', blank: true},
      { label: 'GitHub', href: 'https://github.com/colarusso/QnAMarkup', blank: true }
    ],

    // "report bug/issue" link (empty to hide).
    bugs: 'https://github.com/colarusso/QnAMarkup/issues',

    // doc/ uses CKEditor 4.22.1 (the last open-source release). If you hold a
    // CKEditor 4 LTS licence, point doc/index.html at the LTS build and put the
    // key here. Leave empty in a public copy of this repository.
    ckeditorLicenseKey: ''
  };

  // ---- derive the URLs the pages use -----------------------------------------
  var loc = window.location;
  var host = loc.hostname;
  var isLocal = loc.protocol === 'file:' || host === 'localhost' || host === '127.0.0.1' || host === '[::1]' || /\.localhost$/.test(host);
  var meta = window.QNA_LIB || {};   // dist/meta.js: { version, integrity }

  // Base URL of the folder this site is served from (the repo root), for relative mode.
  // Pages live at /, /i/, /doc/, /syntax/, so the root is one level up for everything but the editor.
  var depth = (document.currentScript && document.currentScript.getAttribute('src') || 'config.js').split('/').filter(function (s) { return s === '..'; }).length;
  var here = new URL(depth ? '../'.repeat(depth) : './', loc.href).href;

  var editor, viewer, cdn, integrity = '';
  if (!isLocal) {
    editor = SETTINGS.editorOrigin + '/';
    viewer = SETTINGS.viewerOrigin + '/';
    cdn = SETTINGS.editorOrigin + SETTINGS.libraryPath + (meta.version ? '/' + meta.version : '') + '/qna.min.js';
    integrity = meta.integrity || '';
  } else if (loc.protocol !== 'file:' && SETTINGS.local && (String(loc.port) === String(SETTINGS.local.editorPort) || String(loc.port) === String(SETTINGS.local.viewerPort))) {
    // two-port rehearsal of the split
    var base = loc.protocol + '//' + host + ':';
    editor = base + SETTINGS.local.editorPort + '/';
    viewer = base + SETTINGS.local.viewerPort + '/';
    cdn = editor + 'dist/qna.min.js';
    integrity = meta.integrity || '';
  } else {
    editor = here; viewer = here;
    cdn = here + 'dist/qna.min.js';
    // (crossorigin scripts need CORS, which file: cannot provide, so no integrity attribute there)
    integrity = loc.protocol === 'file:' ? '' : (meta.integrity || '');
  }

  window.QNA_CONFIG = {
    editorUrl: editor,            // the editor (footer "edit" / "code your own" links point here)
    viewerUrl: viewer + 'i/',     // the viewer (share links)
    docUrl: viewer + 'doc/',      // the document page (submit2 … 'GET')
    cdn: cdn,                     // library URL written into embed code / full pages
    integrity: integrity,         // its SRI hash, when known
    isLocal: isLocal,
    isViewerOrigin: !isLocal ? (loc.origin === SETTINGS.viewerOrigin) : (viewer !== editor && loc.origin + '/' === viewer),
    nav: SETTINGS.nav,
    bugs: SETTINGS.bugs,
    ckeditorLicenseKey: SETTINGS.ckeditorLicenseKey,
    settings: SETTINGS
  };
})();
