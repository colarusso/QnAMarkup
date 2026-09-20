// The QnA Markup editor. Loaded by index.html; kept in its own file so the page can be served with a
// Content-Security-Policy that forbids inline script (the preview runs in a sandboxed iframe, preview.html).
(function () {
  'use strict';
  var CONFIG = window.QNA_CONFIG || {};
  var $ = function (id) { return document.getElementById(id); };
  var HERE = new URL('./', location.href).href;          // this editor's base URL
  var VIEWER = CONFIG.viewerUrl || HERE + 'i/';           // the viewer lives on the rendering origin (config.js)
  var EDITOR_URL = CONFIG.editorUrl || HERE;
  var CDN = CONFIG.cdn || HERE + 'dist/qna.min.js';
  var INTEGRITY = CONFIG.integrity || '';
  var STYLE_KEYS = ['fontFamily', 'fontSize', 'lineHeight', 'colWidth', 'framePad', 'radius', 'compBg', 'compTxt', 'compLink', 'usrBg', 'usrTxt', 'usrLink', 'bodyBg', 'bodyTxt', 'bodyLink', 'btnBg', 'btnTxt', 'btnBorder', 'btnDivider'];
  var COLOR_KEYS = ['compBg', 'compTxt', 'compLink', 'usrBg', 'usrTxt', 'usrLink', 'bodyBg', 'bodyTxt', 'bodyLink', 'btnBg', 'btnTxt', 'btnBorder', 'btnDivider'];
  var COMP_KEYS = ['compBg', 'compTxt', 'compLink'];   // System Text colours: not used (so greyed out) when the chat style is LLM
  var LABEL_KEYS = ['labelSave', 'labelBack', 'labelRestart', 'labelCredits', 'labelEdit', 'labelCode'];
  var LS_KEY = 'qna-editor-state';
  var libText = window.QNA_LIB_SOURCE || null;   // library source, for the "embed the library" option (dist/qna.inline.js)
  var lastResult = null;
  var liveTimer = null;

  /* ---------- nav / config ---------- */
  (CONFIG.nav || []).forEach(function (n) {
    var a = document.createElement('a');
    a.href = n.href; a.textContent = n.label; if (n.blank) a.target = '_blank';
    $('nav').appendChild(a);
  });
  if (CONFIG.bugs) { $('bug_report').href = CONFIG.bugs; $('bug_report').style.display = ''; }
  Object.keys(window.QNA_TEMPLATES || {}).forEach(function (k) {
    var o = document.createElement('option');
    o.value = k; o.textContent = window.QNA_TEMPLATES[k].name;
    $('template').appendChild(o);
  });

  /* ---------- style options ---------- */
  var SETTINGS_KEYS = STYLE_KEYS.concat(['btnBold', 'chatStyle'], LABEL_KEYS, ['footer', 'start', 'saveProgress']);
  // The Settings screen's defaults: the library's, with anything config.js sets (defaults: {...}) on top.
  // Only Settings-screen options count, and each goes through the library's validation. These are what a
  // first visit and "Restore Defaults" show. Outputs are still compared with the LIBRARY's defaults
  // (nonDefaultOptions), because that is what a page without the option gets.
  var DEFAULTS = (function () {
    var given = CONFIG.defaults || {}, picked = {};
    Object.keys(given).forEach(function (k) {
      var key = k.replace(/_([a-z])/g, function (all, c) { return c.toUpperCase(); });
      if (SETTINGS_KEYS.indexOf(key) >= 0) picked[key] = given[k];
    });
    return QnA.normalizeOptions(picked);
  })();
  function editorDefaults() { var o = {}; SETTINGS_KEYS.forEach(function (k) { o[k] = DEFAULTS[k]; }); return o; }
  $('start').placeholder = DEFAULTS.start;
  function getOptions() {
    var o = {};
    STYLE_KEYS.forEach(function (k) { o[k] = $(k).value; });   // disabled (LLM) System Text fields still hold, and give, their values
    o.btnBold = $('btnBold').checked;
    o.chatStyle = $('chatStyle').value;
    LABEL_KEYS.forEach(function (k) { o[k] = $(k).value.trim() || DEFAULTS[k]; });   // blank = the default text
    o.footer = $('footer').value === 'true';
    o.saveProgress = $('saveProgress').value === 'true';
    o.start = $('start').value.trim() || DEFAULTS.start;
    return QnA.normalizeOptions(o);
  }
  function setOptions(o) {
    o = QnA.normalizeOptions(o || {});
    STYLE_KEYS.forEach(function (k) {
      var el = $(k);
      if (el.tagName === 'SELECT') {
        var found = false;
        for (var i = 0; i < el.options.length; i++) if (el.options[i].value === o[k]) found = true;
        if (!found) { var opt = document.createElement('option'); opt.value = o[k]; opt.textContent = o[k]; el.appendChild(opt); }
      }
      el.value = o[k];
    });
    COLOR_KEYS.forEach(function (k) { document.querySelector('input[type=color][data-for=' + k + ']').value = '#' + o[k]; });
    $('btnBold').checked = o.btnBold === true;
    $('chatStyle').value = o.chatStyle;
    syncChatStyle();
    LABEL_KEYS.forEach(function (k) { $(k).value = o[k]; });
    $('footer').value = String(o.footer !== false);
    $('saveProgress').value = String(o.saveProgress === true);
    $('start').value = o.start === DEFAULTS.start ? '' : o.start;
  }
  // LLM chat style: the System Text colours are not used, so their fields are disabled. They keep their
  // values (which are still saved and written to every output), ready for a switch back to SMS.
  function syncChatStyle() {
    var llm = $('chatStyle').value === 'llm';
    COMP_KEYS.forEach(function (k) {
      $(k).disabled = llm;
      document.querySelector('input[type=color][data-for=' + k + ']').disabled = llm;
      $(k).closest('label').classList.toggle('off', llm);
    });
  }
  $('chatStyle').addEventListener('change', syncChatStyle);
  LABEL_KEYS.forEach(function (k) {
    $(k).addEventListener('input', function () { scheduleLive(); });
    // a label left blank means the default, so show it
    $(k).addEventListener('change', function () { if (!$(k).value.trim()) $(k).value = DEFAULTS[k]; });
  });
  function nonDefaultOptions() {
    var o = getOptions(), out = {};
    SETTINGS_KEYS.forEach(function (k) { if (String(o[k]) !== String(QnA.defaults[k])) out[k] = o[k]; });
    return out;
  }
  // colour pickers <-> hex fields
  COLOR_KEYS.forEach(function (k) {
    var pick = document.querySelector('input[type=color][data-for=' + k + ']');
    pick.addEventListener('input', function () { $(k).value = pick.value.slice(1); scheduleLive(); });
    $(k).addEventListener('input', function () {
      var v = $(k).value.replace(/^#/, '');
      if (/^[0-9a-fA-F]{6}$/.test(v)) { pick.value = '#' + v; scheduleLive(); }
    });
  });
  $('restore').addEventListener('click', function () { setOptions(editorDefaults()); update(); });
  $('clear_progress').addEventListener('click', function () {
    var n = 0;
    try { Object.keys(localStorage).filter(function (k) { return /^qna-progress-/.test(k); }).forEach(function (k) { localStorage.removeItem(k); n++; }); } catch (e) {}
    $('clear_progress_note').textContent = n ? 'Removed saved progress for ' + n + ' interview' + (n === 1 ? '' : 's') + '.' : 'Nothing was saved in this browser.';
  });
  $('styleblock').addEventListener('change', function () { scheduleLive(); });

  /* ---------- tabs ---------- */
  var tabs = document.querySelectorAll('.tab');
  function showTab(id) {
    for (var i = 0; i < tabs.length; i++) tabs[i].classList.toggle('active', tabs[i].getAttribute('data-tab') === id);
    $('editor').style.display = id === 'codeblock' ? '' : 'none';
    $('styleblock').style.display = id === 'styleblock' ? '' : 'none';
    $('wrap_box').style.visibility = id === 'codeblock' ? '' : 'hidden';
  }
  for (var t = 0; t < tabs.length; t++) tabs[t].addEventListener('click', function () { showTab(this.getAttribute('data-tab')); });

  /* ---------- editor textarea ---------- */
  var ta = $('markup');
  ta.addEventListener('keydown', function (e) {
    if (e.key === 'Tab' && !e.ctrlKey && !e.altKey && !e.metaKey) {
      e.preventDefault();
      var s = ta.selectionStart, en = ta.selectionEnd, v = ta.value;
      if (s === en && !e.shiftKey) {                       // plain tab
        ta.value = v.slice(0, s) + '\t' + v.slice(en);
        ta.selectionStart = ta.selectionEnd = s + 1;
      } else {                                             // indent / outdent selected lines
        var ls = v.lastIndexOf('\n', s - 1) + 1;
        var le = v.indexOf('\n', en); if (le < 0) le = v.length;
        var block = v.slice(ls, le);
        var out = e.shiftKey ? block.replace(/^\t/gm, '') : block.replace(/^/gm, '\t');
        ta.value = v.slice(0, ls) + out + v.slice(le);
        ta.selectionStart = ls; ta.selectionEnd = ls + out.length;
      }
      dirty();
    } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault(); update();
    } else if (e.key === 'Enter' && !e.shiftKey) {         // keep indentation
      var st = ta.selectionStart, val = ta.value;
      var lineStart = val.lastIndexOf('\n', st - 1) + 1;
      var indent = (val.slice(lineStart, st).match(/^[ \t]*/) || [''])[0];
      if (indent) {
        e.preventDefault();
        ta.value = val.slice(0, st) + '\n' + indent + val.slice(ta.selectionEnd);
        ta.selectionStart = ta.selectionEnd = st + 1 + indent.length;
        dirty();
      }
    }
  });
  ta.addEventListener('input', dirty);
  function dirty() { saveState(); scheduleLive(); }

  /* ---------- syntax highlighting ---------- */
  var hlEl = $('hl');
  function hlEsc(t) { return t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  // HTML inside text: tags green, attribute values orange, comments grey, <x>var</x> with the name in red
  function hlHtml(t, st) {
    var out = '', i = 0;
    while (i < t.length) {
      if (st.comment) {
        var end = t.indexOf('-->', i);
        if (end < 0) { out += '<span class="c">' + hlEsc(t.slice(i)) + '</span>'; return out; }
        out += '<span class="c">' + hlEsc(t.slice(i, end + 3)) + '</span>'; i = end + 3; st.comment = false; continue;
      }
      var lt = t.indexOf('<', i);
      if (lt < 0) { out += hlEsc(t.slice(i)); break; }
      out += hlEsc(t.slice(i, lt));
      if (t.substr(lt, 4) === '<!--') { st.comment = true; i = lt; continue; }
      var xv = /^<x>([^<]*)<\/x>/i.exec(t.slice(lt));
      if (xv) { out += '<span class="h">&lt;x&gt;</span><span class="p">' + hlEsc(xv[1]) + '</span><span class="h">&lt;/x&gt;</span>'; i = lt + xv[0].length; continue; }
      var gt = t.indexOf('>', lt);
      var tag = /^<\/?[a-zA-Z][^<>]*>?/.exec(t.slice(lt));
      if (!tag) { out += hlEsc('<'); i = lt + 1; continue; }
      var raw = gt < 0 ? t.slice(lt) : t.slice(lt, gt + 1);
      out += '<span class="h">' + hlEsc(raw).replace(/(=\s*)(&quot;[^&]*&quot;|"[^"]*"|'[^']*')/g, '$1<span class="s">$2</span>') + '</span>';
      i = lt + raw.length;
    }
    return out;
  }
  function hlText(t, st) {
    // GOTO:target at the end of a line
    var m = /^([\s\S]*?)(GOTO:)(\s?)([a-zA-Z0-9._-]*)(\s*)$/.exec(t);
    if (m) return hlHtml(m[1], st) + '<span class="t">GOTO</span><span class="b">:</span>' + m[3] + '<span class="p">' + hlEsc(m[4]) + '</span>' + m[5];
    return hlHtml(t, st);
  }
  function highlight(src) {
    var lines = src.split('\n'), st = { comment: false, bracket: false }, out = [];
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i], m;
      if (st.bracket) {
        // inside a multi-line [ ... ] (e.g. javascript) that began on an earlier A or X tag line
        var close = /^((?:[^\]\\]|\\.)*)\](:?)(?:(\[)((?:[^\]\\]|\\.)*)(\])?)?/.exec(line);
        if (close) {
          st.bracket = false;
          var rest = line.slice(close[0].length), tail = '';
          if (close[3]) { tail = '<span class="b">[</span><span class="p">' + hlEsc(close[4]) + '</span>' + (close[5] ? '<span class="b">]</span>' : ''); if (!close[5]) st.bracket = true; }
          out.push('<span class="p">' + hlEsc(close[1]) + '</span><span class="b">]</span>' + (close[2] ? '<span class="b">:</span>' : '') + tail + (st.bracket ? '' : hlText(rest, st)));
        } else {
          out.push('<span class="p">' + hlEsc(line) + '</span>');
        }
        continue;
      }
      if (!st.comment && (m = /^(Title|Author|Description|Before|After)(:)/i.exec(line))) {
        out.push('<span class="t">' + m[1] + '</span><span class="b">:</span>' + hlText(line.slice(m[0].length), st));
      } else if (!st.comment && (m = /^([ \t]*)(Q|A|X|DOC)(\(([^)]*)\))?(\[((?:[^\]\\]|\\.)*)\])?(:)(\[((?:[^\]\\]|\\.)*)\])?/.exec(line))) {
        var h = hlEsc(m[1]) + '<span class="t">' + m[2] + '</span>';
        if (m[3] !== undefined) h += '<span class="b">(</span><span class="p">' + hlEsc(m[4]) + '</span><span class="b">)</span>';
        if (m[5] !== undefined) h += '<span class="b">[</span><span class="p">' + hlEsc(m[6]) + '</span><span class="b">]</span>';
        h += '<span class="b">:</span>';
        if (m[8] !== undefined) h += '<span class="b">[</span><span class="p">' + hlEsc(m[9]) + '</span><span class="b">]</span>';
        out.push(h + hlText(line.slice(m[0].length), st));
      } else if (!st.comment && (m = /^([ \t]*)(A|X)(\(([^)]*)\))?(:?)(\[)((?:[^\]\\]|\\.)*)$/.exec(line))) {
        // an A (or X) tag whose [ bracket ] continues on the next line(s)
        var h2 = hlEsc(m[1]) + '<span class="t">' + m[2] + '</span>';
        if (m[3] !== undefined) h2 += '<span class="b">(</span><span class="p">' + hlEsc(m[4]) + '</span><span class="b">)</span>';
        if (m[5]) h2 += '<span class="b">:</span>';
        out.push(h2 + '<span class="b">[</span><span class="p">' + hlEsc(m[7]) + '</span>');
        st.bracket = true;
      } else {
        out.push(hlText(line, st));
      }
    }
    var errLines = {};
    (lastResult && !lastResult.ok ? lastResult.errors : []).forEach(function (e) { if (e.line) errLines[e.line] = true; });
    return out.map(function (h, i) { return '<span class="ln' + (errLines[i + 1] ? ' err' : '') + '">' + h + '\n</span>'; }).join('');
  }
  // The coloured text is a layer under a transparent textarea, so the two must wrap lines identically or
  // the caret drifts away from the text it edits. A scrollbar that takes up room (Windows/Linux, and macOS
  // with a mouse attached or "Show scroll bars: always") narrows the textarea's text column but not the
  // layer's, which never scrolls on its own. Lines that wrap at a space usually hide the difference; a long
  // URL, broken wherever the column ends, shows it as edits landing a couple of characters left of the
  // caret. So the layer gives up the same room: its right / bottom padding grows by the scrollbar's size.
  var gutter = { w: -1, h: -1, padR: 0, padB: 0 };
  function syncGutter() {
    var w = ta.offsetWidth - ta.clientWidth, h = ta.offsetHeight - ta.clientHeight;   // the textarea has no border
    if (w === gutter.w && h === gutter.h) return;
    if (gutter.w < 0) { var cs = getComputedStyle(ta); gutter.padR = parseFloat(cs.paddingRight) || 0; gutter.padB = parseFloat(cs.paddingBottom) || 0; }
    gutter.w = w; gutter.h = h;
    hlEl.style.paddingRight = (gutter.padR + w) + 'px';
    hlEl.style.paddingBottom = (gutter.padB + h) + 'px';
  }
  var lastHl = null, hlErrKey = '';
  function refreshHighlight() {
    var ek = lastResult && !lastResult.ok ? lastResult.errors.map(function (e) { return e.line; }).join(',') : '';
    if (ta.value !== lastHl || ek !== hlErrKey) { lastHl = ta.value; hlErrKey = ek; hlEl.innerHTML = highlight(ta.value); }
    syncGutter();
    hlEl.scrollTop = ta.scrollTop; hlEl.scrollLeft = ta.scrollLeft;
    requestAnimationFrame(refreshHighlight);
  }
  requestAnimationFrame(refreshHighlight);
  ta.addEventListener('scroll', function () { hlEl.scrollTop = ta.scrollTop; hlEl.scrollLeft = ta.scrollLeft; });
  ta.addEventListener('focus', function () { $('editor').classList.add('focus'); });
  ta.addEventListener('blur', function () { $('editor').classList.remove('focus'); });

  $('wrap').addEventListener('change', function () { ta.classList.toggle('wrap', $('wrap').checked); $('hl').classList.toggle('wrap', $('wrap').checked); saveState(); });
  $('live').addEventListener('change', saveState);

  /* ---------- templates / files / new ---------- */
  $('template').addEventListener('change', function () {
    var k = $('template').value; if (!k) return;
    if (ta.value.trim() && !confirm('Replace the current markup with the "' + window.QNA_TEMPLATES[k].name + '" template?')) { $('template').value = ''; return; }
    ta.value = window.QNA_TEMPLATES[k].text;
    $('template').value = '';
    showTab('codeblock'); update();
  });
  $('new').addEventListener('click', function () {
    if (ta.value.trim() && !confirm('Start a new QnA? The current markup will be replaced.')) return;
    ta.value = (window.QNA_TEMPLATES && window.QNA_TEMPLATES['new']) ? window.QNA_TEMPLATES['new'].text : 'Title:\nAuthor:\nDescription:\n\nQ:\nA:\n\tQ:\nA:\n\tQ:';
    showTab('codeblock'); update(); ta.focus();
  });
  $('load_file').addEventListener('click', function () { $('upload').click(); });
  $('upload').addEventListener('change', function () {
    var f = $('upload').files[0]; if (!f) return;
    var r = new FileReader();
    r.onload = function () {
      // A file saved from here ends with a hidden Settings: tag. It never reaches the text area:
      // its values go to the Settings screen (anything it does not mention returns to the default).
      var loaded = QnA.splitSettings(String(r.result));
      ta.value = loaded.markup;
      if (loaded.settings) setOptions(loaded.settings);
      showTab('codeblock'); update();
    };
    r.readAsText(f);
    $('upload').value = '';
  });
  function stamp() {
    var d = new Date(), z = function (n) { return (n < 10 ? '0' : '') + n; };
    // colons are not allowed in file names on Windows (and show as "/" on macOS), so the time uses a dash
    return d.getFullYear() + '-' + z(d.getMonth() + 1) + '-' + z(d.getDate()) + 'T' + z(d.getHours()) + '-' + z(d.getMinutes());
  }
  function markupFilename() {
    var title = '';
    try { title = QnA.parse(ta.value).header.titleText || ''; } catch (e) {}
    var name = title.trim().replace(/\s+/g, '_').replace(/[^A-Za-z0-9_\-]/g, '').replace(/_+/g, '_').replace(/^_+|_+$/g, '');
    return (name || 'QnA_markup') + '_' + stamp() + '.txt';
  }
  window.markupFilename = markupFilename;
  // The saved file is the markup plus, as its last line, the Settings screen as a hidden Settings: tag.
  function markupForFile() {
    return QnA.splitSettings(ta.value).markup.replace(/\s+$/, '') + '\n\n' + QnA.settingsTag(getOptions()) + '\n';
  }
  window.markupForFile = markupForFile;
  $('save_markup').addEventListener('click', function () { QnA.save2(markupFilename(), markupForFile()); });

  /* ---------- outputs ---------- */
  var outSel = $('output');
  function hasErrors() { return !!(lastResult && !lastResult.ok); }
  function showOutput(id) {
    // While the markup has errors every other output would be broken by definition, so only
    // Interactive (which shows the errors) is available; other choices bounce back to it.
    if (id !== 'interact' && hasErrors()) {
      id = 'interact';
      var n = lastResult.errors.length;
      $('out_note').textContent = 'Fix the ' + (n === 1 ? 'error' : n + ' errors') + ' in the markup to use the other outputs.';
      $('out_note').classList.add('show');
      clearTimeout(showOutput.noteTimer);
      showOutput.noteTimer = setTimeout(function () { $('out_note').classList.remove('show'); }, 4000);
    }
    var divs = document.querySelectorAll('.out > div');
    for (var i = 0; i < divs.length; i++) divs[i].classList.toggle('active', divs[i].id === 'out_' + id);
    outSel.value = id;
    if (id === 'flow') renderFlow();
    applyPaneBg();
    saveState();
  }
  function applyPaneBg() {
    var out = document.querySelector('.out');
    out.style.background = outSel.value === 'interact' && lastResult ? '#' + getOptions().bodyBg : '';
  }

  /* ---------- flowchart ---------- */
  var flow = null, flowDirty = true;
  function renderFlow() {
    if (!flowDirty || !lastResult || !lastResult.ok) return;
    if (!$('out_flow').classList.contains('active')) return;   // render when visible so "fit" has a size
    flow = QnAFlow.render($('flow_canvas'), lastResult, getOptions());
    flowDirty = false;
  }
  $('flow_fit').addEventListener('click', function () { if (flow) flow.fit(); });
  $('flow_in').addEventListener('click', function () { if (flow) flow.zoomIn(); });
  $('flow_out').addEventListener('click', function () { if (flow) flow.zoomOut(); });
  $('flow_reset').addEventListener('click', function () { QnAFlow.clearMemory(); flowDirty = true; renderFlow(); });
  $('flow_png').addEventListener('click', function () {
    if (!flow) return;
    flow.toPng(2).then(function (blob) {
      var name = markupFilename().replace(/\.txt$/, '') .replace(/_\d{4}-\d{2}-\d{2}T\d{2}-\d{2}$/, '') + '_flowchart_' + stamp() + '.png';
      if (typeof blob === 'string') { var a = document.createElement('a'); a.href = blob; a.download = name; document.body.appendChild(a); a.click(); a.remove(); return; }
      var url = URL.createObjectURL(blob), a2 = document.createElement('a'); a2.href = url; a2.download = name; document.body.appendChild(a2); a2.click();
      setTimeout(function () { URL.revokeObjectURL(url); a2.remove(); }, 0);
    }).catch(function (e) { alert('Could not save the flowchart: ' + e.message); });
  });
  $('flow_svg').addEventListener('click', function () {
    if (!flow) return;
    var name = markupFilename().replace(/\.txt$/, '').replace(/_\d{4}-\d{2}-\d{2}T\d{2}-\d{2}$/, '') + '_flowchart_' + stamp() + '.svg';
    var blob = new Blob([flow.toSvg()], { type: 'image/svg+xml' }), url = URL.createObjectURL(blob), a = document.createElement('a');
    a.href = url; a.download = name; document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(url); a.remove(); }, 0);
  });
  window.addEventListener('resize', function () { if (flow && $('out_flow').classList.contains('active')) flow.fit(); });
  outSel.addEventListener('change', function () { showOutput(outSel.value); });

  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function dataAttrs(o) {
    return Object.keys(o).map(function (k) {
      return ' data-' + k.replace(/[A-Z]/g, function (c) { return '-' + c.toLowerCase(); }) + '="' + esc(o[k]) + '"';
    }).join('');
  }
  function markupForScript(m) { return m.replace(/<\/script/gi, '<\\/script'); }

  function libTag() {
    // pinned, versioned library URL with a Subresource Integrity hash (both from dist/meta.js via config.js)
    return '<script src="' + CDN + '"' + (INTEGRITY ? ' integrity="' + INTEGRITY + '" crossorigin="anonymous"' : '') + '><\/script>';
  }
  function snippet(markup, o, inline) {
    var lib = inline && libText ? '<script>\n' + libText.replace(/<\/script/gi, '<\\/script') + '\n<\/script>' : libTag();
    return '<!-- QnA Markup (https://www.qnamarkup.org/) -->\n' + lib + '\n' +
      '<script type="text/qna"' + dataAttrs(o) + '>\n' + markupForScript(markup) + '\n<\/script>';
  }
  function fullPage(markup, o, result, inline) {
    var h = result.header;
    var img = (markup.match(/<img[^>]+src=["']([^"']+)["']/i) || [])[1] || '';
    var lib = inline && libText ? '<script>\n' + libText.replace(/<\/script/gi, '<\\/script') + '\n<\/script>' : libTag();
    // (libText comes from dist/qna.inline.js, generated by build.js)
    return '<!DOCTYPE html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n' +
      '<title>' + esc(h.titleText || 'Untitled QnA') + '</title>\n' +
      '<meta name="viewport" content="width=device-width, initial-scale=1">\n' +
      '<meta property="og:type" content="website">\n' +
      (h.titleText ? '<meta property="og:title" content="' + esc(h.titleText) + '">\n' : '') +
      (h.descriptionText ? '<meta property="og:description" content="' + esc(h.descriptionText) + '">\n' : '') +
      (img ? '<meta property="og:image" content="' + esc(img) + '">\n' : '') +
      lib + '\n</head>\n<body class="qna-page">\n' +
      '<script type="text/qna"' + dataAttrs(o) + '>\n' + markupForScript(markup) + '\n<\/script>\n' +
      '</body>\n</html>';
  }

  /* ---------- update ---------- */
  function update() {
    clearTimeout(liveTimer);
    $('loading').style.display = 'block';
    setTimeout(function () {
      try { doUpdate(true); } finally { $('loading').style.display = 'none'; }
    }, 10);
  }
  function scheduleLive() {
    if (!$('live').checked) return;
    clearTimeout(liveTimer);
    liveTimer = setTimeout(function () { doUpdate(false); }, 500);
  }

  function doUpdate(rewrite) {
    var result = QnA.parse(ta.value);
    // A Settings: tag that arrived in the text (pasted from a saved file, or fetched with ?source=) is taken
    // in on a Update Outputs, like a loaded file: its values move to the Settings screen and the line goes
    // (result.code never contains it). While typing it is simply ignored; the Settings screen rules the preview.
    if (rewrite && result.settings) {
      setOptions(Object.assign(getOptions(), result.settings));
      ta.value = QnA.splitSettings(ta.value).markup;   // even when errors keep the rest of the text as typed
    }
    var o = getOptions();
    var opts = nonDefaultOptions();
    lastResult = result;
    showWarnings(result);
    flowDirty = true; renderFlow();

    // Preview (rendered in the sandboxed iframe, see preview.html)
    var previewOpts = Object.assign({}, o, { editorUrl: EDITOR_URL });
    // only render the id-filled code when it is valid; with errors, show them against the text as typed
    renderPreview(rewrite && result.ok ? result.code : ta.value, previewOpts);
    applyPaneBg();

    var openA = $('open_output');
    if (!result.ok) {
      $('status').textContent = result.errors.length + ' error' + (result.errors.length > 1 ? 's' : '');
      $('status').className = 'err';
      showOutput('interact');
      outSel.title = 'Other outputs are available once the markup has no errors.';
      openA.style.visibility = 'hidden';
      return;
    }
    $('status').textContent = result.questions.length + ' Q · ' + result.answers.length + ' A';
    $('status').className = 'ok';
    outSel.title = '';
    openA.style.visibility = '';

    if (rewrite && ta.value !== result.code) {
      var s = ta.selectionStart, top = ta.scrollTop;
      ta.value = result.code;
      ta.selectionStart = ta.selectionEnd = Math.min(s, ta.value.length);
      ta.scrollTop = top;
    }
    var markup = result.code;
    saveState();

    // Embed code & full page
    $('embed_text').value = snippet(markup, opts, $('inline_lib_embed').checked);
    $('html_text').value = fullPage(markup, opts, result, $('inline_lib').checked);

    // Link (compression is async)
    updateLink(markup, opts);
  }
  // Non-blocking warnings about things that will bite once the QnA is published.
  function showWarnings(result) {
    var warn = $('warn'), items = [];
    var re = /<(img|iframe|video|audio|source|script|embed)\b[^>]*\ssrc\s*=\s*["']?(http:\/\/[^"'\s>]+)/gi, m, seen = {};
    while ((m = re.exec(result.markup)) !== null) {
      var key = m[1].toLowerCase() + ' ' + m[2];
      if (!seen[key]) { seen[key] = true; items.push({ tag: m[1].toLowerCase(), url: m[2] }); }
    }
    if (!items.length) { warn.className = ''; warn.innerHTML = ''; return; }
    var html = '<b>Insecure (http://) media.</b> Published QnAs are almost always served over https, where browsers block or silently upgrade <code>http://</code> content: images may fail to appear' +
      (items.some(function (i) { return i.tag !== 'img'; }) ? ', and iframes/scripts/media are blocked outright' : '') +
      '. Use <code>https://</code> URLs where the host offers them.<ul>' +
      items.slice(0, 8).map(function (i) { return '<li><code>&lt;' + i.tag + '&gt;</code> <code>' + esc(i.url) + '</code></li>'; }).join('') +
      (items.length > 8 ? '<li>…and ' + (items.length - 8) + ' more</li>' : '') + '</ul>';
    warn.innerHTML = html; warn.className = 'show';
  }
  function linkMode() { return document.querySelector('input[name=link_mode]:checked').value; }
  // A link carries the whole QnA, so it can outgrow what will open. The plain form puts it in the query
  // string, which is sent to the web server, and servers commonly refuse a request line beyond about 8 KB
  // (414 URI Too Long). The compressed form rides in the #fragment, which never reaches the server, so
  // only browser limits apply (tens of thousands of characters, fewer in some). Past these sizes the
  // header's "open" link is hidden and the Link pane says why; the link itself stays in the pane.
  var LINK_MAX = { plain: 8000, z: 32000 };
  function linkTooLong(url, mode) {
    var max = LINK_MAX[mode] || LINK_MAX.z, big = url.length > max, w = $('link_warn');
    $('open_output').classList.toggle('toolong', big);
    w.className = big ? 'show' : '';
    w.innerHTML = !big ? '' : '<b>This link is probably too long to work.</b> It is ' + url.length.toLocaleString() + ' characters, and ' +
      (mode === 'plain'
        ? 'a plain-text link sends the whole QnA to the web server as part of the address; most servers refuse addresses longer than about ' + max.toLocaleString() + ' characters (error 414, "URI Too Long"). Try the <i>compressed</i> form, which is shorter and is never sent to the server'
        : 'beyond about ' + max.toLocaleString() + ' characters some browsers will not open a link, and most email, chat and social apps cut off or refuse links far shorter than that') +
      '. The <b>open \u2197</b> shortcut above has been hidden; the link below is still here to try. For a QnA this size, the <i>Embed Code</i> or <i>HTML full page</i> output is the dependable way to share it.';
  }
  function updateLink(markup, opts) {
    var openA = $('open_output');
    var payload = Object.assign({ markup: markup }, opts), mode = linkMode();
    var setUrl = function (url) {
      $('link_text').value = url;
      $('link_a').href = url; openA.href = url;
      linkTooLong(url, mode);
      $('link_note').textContent = url.length.toLocaleString() + ' characters' + (url.length > 8000 && url.length <= (LINK_MAX[mode] || LINK_MAX.z) ? ' — very long links may not work in every application; consider the HTML outputs instead.' : '');
    };
    if (linkMode() === 'plain') {
      // Plain, human-readable form: the legacy query-string format the PHP editor used.
      var q = 'markup=' + encodeURIComponent(markup);
      Object.keys(opts).forEach(function (k) {
        var legacy = { fontFamily: 'font_family', fontSize: 'font_size', lineHeight: 'line_height', colWidth: 'col_width', framePad: 'frame_pad', radius: 'radius', compBg: 'comp_bg', compTxt: 'comp_txt', compLink: 'comp_link', usrBg: 'usr_bg', usrTxt: 'usr_txt', usrLink: 'usr_link', bodyBg: 'body_bg', bodyTxt: 'body_txt', bodyLink: 'body_link', start: 'start', btnBg: 'btn_bg', btnTxt: 'btn_txt', btnBorder: 'btn_border', btnDivider: 'btn_divider', chatStyle: 'chat_style', labelSave: 'label_save', labelBack: 'label_back', labelRestart: 'label_restart', labelCredits: 'label_credits', labelEdit: 'label_edit', labelCode: 'label_code' }[k];
        if (legacy) q += '&' + legacy + '=' + encodeURIComponent(opts[k]);
        else if (k === 'footer' && opts[k] === false) q += '&sharing=2';
        else if (k === 'saveProgress' && opts[k] === true) q += '&save_progress=1';
        else if (k === 'btnBold' && opts[k] === true) q += '&btn_bold=1';
      });
      setUrl(VIEWER + '?' + q);
    } else {
      QnA.encodeHash(payload).then(function (hash) { setUrl(VIEWER + '#' + hash); });
    }
  }
  Array.prototype.forEach.call(document.querySelectorAll('input[name=link_mode]'), function (r) {
    r.addEventListener('change', function () { if (lastResult && lastResult.ok) updateLink(lastResult.code, nonDefaultOptions()); saveState(); });
  });
  $('inline_lib_embed').addEventListener('change', function () {
    if (lastResult && lastResult.ok) $('embed_text').value = snippet(lastResult.code, nonDefaultOptions(), $('inline_lib_embed').checked);
    saveState();
  });
  $('inline_lib').addEventListener('change', function () {
    if (lastResult && lastResult.ok) $('html_text').value = fullPage(lastResult.code, nonDefaultOptions(), lastResult, $('inline_lib').checked);
    saveState();
  });
  $('update').addEventListener('click', update);

  /* ---------- preview iframe ----------
     The QnA being edited can contain any HTML/JavaScript, so it is rendered in preview.html inside an
     iframe sandboxed without allow-same-origin: it gets an opaque origin and cannot reach this page's
     DOM or storage. Markup goes in, error-line clicks come back, both via postMessage. */
  var preview = $('preview'), previewLast = null;

  /* The interview is free to take the frame somewhere else: an A[href]: button, a link in a question,
     a script setting location. The editor does not second-guess that. But the page that replaces the
     preview cannot be reached from here (different origin, and the frame is sandboxed), so leaving is
     detected by asking: every time the frame finishes loading something it is sent a ping, which only
     preview.html answers. No answer means the frame now shows another page, and a BACK bar is laid
     across the top of the pane. BACK loads preview.html again and hands it the answers given so far
     (preview.html reports them as it is left), so the interview resumes where it was. */
  var previewAway = false, pingSeq = 0, pingTimer = null, previewProgress = null, resumeNext = null;
  function setAway(away) {
    previewAway = away;
    $('out_interact').classList.toggle('away', away);
  }
  function returnToPreview() {
    if (!previewAway) return;
    resumeNext = previewProgress;
    setAway(false);
    preview.setAttribute('src', 'preview.html');   // its "ready" message below gets it the markup (and the answers) again
  }
  $('preview_back').addEventListener('click', returnToPreview);
  preview.addEventListener('load', function () {
    var seq = ++pingSeq;
    clearTimeout(pingTimer);
    try { preview.contentWindow.postMessage({ type: 'qna-ping', seq: seq }, '*'); } catch (e) {}
    pingTimer = setTimeout(function () { if (seq === pingSeq) setAway(true); }, 500);
  });
  function editableHasFocus() {
    var a = document.activeElement;
    return !!(a && (/^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName) || a.isContentEditable));
  }
  function renderPreview(markup, opts) {
    // give the QnA focus (so an X input can take it) unless the author is typing somewhere in the editor
    previewLast = { type: 'qna-render', markup: markup, options: opts, focus: !editableHasFocus() };
    // an update while the frame is showing some other page brings the QnA back
    if (previewAway) { returnToPreview(); return; }
    // Post right away; if the frame is not listening yet the message is dropped, and its
    // "ready" announcement below makes us send the latest one again.
    if (previewLast.focus) { try { preview.focus({ preventScroll: true }); } catch (e) { preview.focus(); } }
    if (preview.contentWindow) preview.contentWindow.postMessage(previewLast, '*');
  }
  window.addEventListener('message', function (e) {
    if (e.source !== preview.contentWindow) return;
    var msg = e.data || {};
    if (msg.type === 'qna-pong') {
      if (msg.seq === pingSeq) { clearTimeout(pingTimer); pingSeq++; setAway(false); }
    } else if (msg.type === 'qna-progress') {
      // the answers given so far, reported by preview.html as it is being left
      previewProgress = { markup: msg.markup, history: msg.history };
    } else if (msg.type === 'qna-preview-ready') {
      clearTimeout(pingTimer); pingSeq++; setAway(false);
      if (previewLast && resumeNext && resumeNext.markup === previewLast.markup) previewLast.resume = resumeNext.history;
      resumeNext = null;
      // needLib: the frame could not load dist/qna.min.js itself (file://); hand it the source we already have
      if (previewLast) preview.contentWindow.postMessage(msg.needLib && libText ? Object.assign({ lib: libText }, previewLast) : previewLast, '*');
      if (previewLast) delete previewLast.resume;
    } else if (msg.type === 'qna-error-line') {
      selectLine(msg.line);
    }
  });

  function selectLine(line) {
    var lines = ta.value.split('\n');
    if (!line || line > lines.length) return;
    var start = lines.slice(0, line - 1).join('\n').length + (line > 1 ? 1 : 0), end = start + lines[line - 1].length;
    showTab('codeblock');
    ta.focus(); ta.setSelectionRange(start, end);
    // scroll the line into the middle of the editor
    var lh = parseFloat(getComputedStyle(ta).lineHeight) || 19;
    ta.scrollTop = Math.max(0, (line - 1) * lh - ta.clientHeight / 2 + lh);
  }

  function copy(id) {
    var el = $(id); el.select();
    if (navigator.clipboard) navigator.clipboard.writeText(el.value); else document.execCommand('copy');
  }
  $('copy_link').addEventListener('click', function () { copy('link_text'); });
  $('copy_embed').addEventListener('click', function () { copy('embed_text'); });
  $('copy_html').addEventListener('click', function () { copy('html_text'); });
  //$('save_embed').addEventListener('click', function () { QnA.save2('QnA_embed.html', $('embed_text').value); });
  $('save_html').addEventListener('click', function () { QnA.save2('QnA_page.html', $('html_text').value); });

  /* ---------- persistence ---------- */
  function saveState() {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify({
        markup: ta.value, options: getOptions(), wrap: $('wrap').checked, live: $('live').checked, output: outSel.value,
        linkMode: linkMode(), inlineLib: $('inline_lib').checked, inlineLibEmbed: $('inline_lib_embed').checked,
        rightW: window.paneSizes ? window.paneSizes().rightW : undefined, rightH: window.paneSizes ? window.paneSizes().rightH : undefined
      }));
    } catch (e) {}
  }
  function loadState() {
    try { return JSON.parse(localStorage.getItem(LS_KEY)); } catch (e) { return null; }
  }

  /* ---------- initial load ---------- */
  function loadFromUrl() {
    var q = new URLSearchParams(location.search);
    var src = q.get('source');
    if (src) {
      if (/^https?:\/\//i.test(src)) {
        return fetch(src).then(function (r) { if (!r.ok) throw new Error(r.status); return r.text(); })
          .then(function (text) { return { markup: text }; })
          .catch(function (e) { alert('Could not load ' + src + ' (' + e.message + '). The file must be served with CORS headers.'); return null; });
      }
      var tpl = window.QNA_TEMPLATES && window.QNA_TEMPLATES[src];
      return Promise.resolve(tpl ? { markup: tpl.text } : null);
    }
    var frag = location.hash.length > 1 ? location.hash : (q.has('markup') ? location.search : '');
    if (!frag) return Promise.resolve(null);
    return QnA.decodeHash(frag).catch(function (e) { alert('Could not read the QnA from this link: ' + e.message); return null; });
  }

  if (!libText) { $('inline_lib_embed').disabled = true; $('inline_lib').disabled = true; $('inline_lib').parentNode.title = 'dist/qna.inline.js did not load; run build.js.'; }

  /* ---------- resizable panes ---------- */
  (function () {
    var splitter = $('splitter'), left = $('left'), right = $('right'), main = document.querySelector('main');
    var MIN = 300, MIN_H = 200, MIN_LEFT_H = 200;
    function stacked() { return getComputedStyle(main).flexDirection === 'column'; }
    // main's content box (its padding is not available to the panes)
    function avail() {
      var cs = getComputedStyle(main), r = main.getBoundingClientRect();
      return { width: r.width - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight), height: r.height - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom) };
    }
    function applySaved() {
      var st = loadState() || {};
      if (!stacked() && st.rightW) right.style.width = st.rightW + 'px';
      if (stacked() && st.rightH) right.style.height = st.rightH + 'px';
      clamp();
    }
    function clamp() {
      var rect = avail();
      // only the dimension that matters for the current layout may be set inline
      if (stacked()) right.style.width = ''; else right.style.height = '';
      if (stacked()) {
        var maxH = rect.height - MIN_LEFT_H - splitter.offsetHeight;
        var h = right.getBoundingClientRect().height;
        if (h > maxH) right.style.height = Math.max(MIN_H, maxH) + 'px';
      } else {
        var maxW = rect.width - MIN - splitter.offsetWidth;
        var w = right.getBoundingClientRect().width;
        if (w > maxW) right.style.width = Math.max(MIN, maxW) + 'px';
        if (w < MIN) right.style.width = MIN + 'px';
      }
    }
    var drag = null;
    splitter.addEventListener('pointerdown', function (e) {
      e.preventDefault();
      var vertical = stacked();
      drag = { vertical: vertical, start: vertical ? e.clientY : e.clientX, size: vertical ? right.getBoundingClientRect().height : right.getBoundingClientRect().width };
      splitter.setPointerCapture(e.pointerId);
      document.body.classList.add('resizing'); document.body.classList.toggle('vertical', vertical);
    });
    splitter.addEventListener('pointermove', function (e) {
      if (!drag) return;
      var rect = avail();
      if (drag.vertical) {
        var h = drag.size - (e.clientY - drag.start);
        h = Math.max(MIN_H, Math.min(h, rect.height - MIN_LEFT_H - splitter.offsetHeight));
        right.style.height = h + 'px';
      } else {
        var w = drag.size - (e.clientX - drag.start);
        w = Math.max(MIN, Math.min(w, rect.width - MIN - splitter.offsetWidth));
        right.style.width = w + 'px';
      }
    });
    function end(e) {
      if (!drag) return;
      drag = null;
      document.body.classList.remove('resizing', 'vertical');
      try { saveState(); } catch (err) {}
    }
    splitter.addEventListener('pointerup', end);
    splitter.addEventListener('pointercancel', end);
    splitter.addEventListener('dblclick', function () { right.style.width = ''; right.style.height = ''; saveState(); });
    window.addEventListener('resize', clamp);
    window.paneSizes = function () { return { rightW: !stacked() ? Math.round(right.getBoundingClientRect().width) : (loadState() || {}).rightW, rightH: stacked() ? Math.round(right.getBoundingClientRect().height) : (loadState() || {}).rightH }; };
    applySaved();
  })();

  window.addEventListener('hashchange', function () {
    if (location.hash.length < 2) return;
    QnA.decodeHash(location.hash).then(function (payload) {
      if (!payload || payload.markup === undefined) return;
      if (ta.value.trim() && ta.value !== payload.markup && !confirm('Load the QnA from this link? The current markup will be replaced.')) return;
      ta.value = payload.markup; setOptions(payload);
      history.replaceState(null, '', location.pathname);
      showTab('codeblock'); showOutput('interact'); update();
    }).catch(function () {});
  });

  loadFromUrl().then(function (fromUrl) {
    var st = loadState();
    if (fromUrl && fromUrl.markup !== undefined) {
      ta.value = fromUrl.markup;
      setOptions(fromUrl);
      if (location.hash || location.search) history.replaceState(null, '', location.pathname);
    } else if (st && st.markup !== undefined) {
      ta.value = st.markup;
      setOptions(st.options);
    } else {
      ta.value = window.QNA_TEMPLATES.primer ? window.QNA_TEMPLATES.primer.text : '';
      setOptions(editorDefaults());
    }
    if (st) {
      $('wrap').checked = !!st.wrap; ta.classList.toggle('wrap', !!st.wrap); $('hl').classList.toggle('wrap', !!st.wrap);
      $('live').checked = st.live !== false;
      if (st.output === 'snippet') st.output = 'embed';
      if (st.output) showOutput(st.output);
      if (st.linkMode) { var lm = document.querySelector('input[name=link_mode][value=' + st.linkMode + ']'); if (lm) lm.checked = true; }
      if (st.inlineLib && !$('inline_lib').disabled) $('inline_lib').checked = true;
      if (st.inlineLibEmbed && !$('inline_lib_embed').disabled) $('inline_lib_embed').checked = true;
    }
    update();
  });
})();
