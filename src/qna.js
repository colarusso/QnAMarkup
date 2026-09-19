/*!
 * QnA Markup — client-side interpreter
 * https://www.qnamarkup.org/  |  https://github.com/colarusso/QnAMarkup
 *
 * A JavaScript port of the original PHP/JS implementation. Parses QnA Markup
 * in the browser and renders an interactive question-and-answer session.
 *
 * Usage (auto-init):
 *   <script src="qna.min.js"><\/script>
 *   <script type="text/qna">
 *   Q: Hello?
 *   A: Hi.
 *   	Q: Nice.
 *   <\/script>
 *
 * Programmatic:
 *   QnA.render(element, markup, options)
 *   QnA.parse(markup) -> { ok, errors, code, header, questions, answers, names }
 *
 * MIT License.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) { module.exports = factory(root); }
  else { root.QnA = factory(root); }
})(typeof window !== 'undefined' ? window : this, function (root) {
  'use strict';
 
  var QnA = { version: '2.1.0' };
 
  /* ------------------------------------------------------------------ */
  /*  Defaults                                                           */
  /* ------------------------------------------------------------------ */
 
  QnA.defaults = {
    fontFamily: 'Verdana, Geneva, sans-serif',
    fontSize: 14,
    lineHeight: 20,
    colWidth: 500,
    framePad: 15,
    radius: 15,
    compBg: '5489eb',
    compTxt: 'ffffff',
    compLink: 'e3fbfc',
    usrBg: 'eeeeee',
    usrTxt: '000000',
    usrLink: '0000ff',
    bodyBg: 'ffffff',       // page / QnA background
    bodyTxt: '000000',      // text outside the bubbles (Before/After content, footer; not the grey credits box)
    bodyLink: '0000ff',     // links outside the bubbles
    chatStyle: 'sms',       // 'sms': questions and answers in speech bubbles; 'llm': questions as plain text on the body (see QnA.css)
    // the text of the built-in buttons and footer links (plain text, not HTML)
    labelSave: 'Save above text as answer.',
    labelBack: 'GO BACK ONE',
    labelRestart: 'START OVER',
    labelCredits: 'credits',
    labelEdit: 'edit',
    labelCode: 'code your own',
    start: '1',
    footer: true,           // show credits / edit / code-your-own footer
    saveProgress: false,    // remember the user's answers in localStorage and resume on return
    loadTimeout: 30000,     // max ms to wait for a question's images before showing it anyway (broken images resolve at once; this only guards hung requests)
    editorUrl: 'https://www.qnamarkup.org/',
    animate: true,          // 300ms pause before the next question appears
    scroll: true,           // scroll new questions into view
    injectCss: true         // add a <style> with the bubble CSS
  };
 
  // Map of legacy (snake_case, as used in URLs / PHP) option names.
  var LEGACY_KEYS = {
    font_family: 'fontFamily', font_size: 'fontSize', line_height: 'lineHeight',
    col_width: 'colWidth', frame_pad: 'framePad', radius: 'radius',
    comp_bg: 'compBg', comp_txt: 'compTxt', comp_link: 'compLink',
    usr_bg: 'usrBg', usr_txt: 'usrTxt', usr_link: 'usrLink', body_bg: 'bodyBg', body_txt: 'bodyTxt', body_link: 'bodyLink', start: 'start',
    save_progress: 'saveProgress', editor_url: 'editorUrl', chat_style: 'chatStyle',
    label_save: 'labelSave', label_back: 'labelBack', label_restart: 'labelRestart',
    label_credits: 'labelCredits', label_edit: 'labelEdit', label_code: 'labelCode'
  };
  var LABEL_KEYS = ['labelSave', 'labelBack', 'labelRestart', 'labelCredits', 'labelEdit', 'labelCode'];
 
  function normalizeOptions(opts) {
    var o = {}, k;
    for (k in QnA.defaults) o[k] = QnA.defaults[k];
    if (opts) {
      for (k in opts) {
        if (!Object.prototype.hasOwnProperty.call(opts, k)) continue;
        var key = LEGACY_KEYS[k] || k;
        if (opts[k] === undefined || opts[k] === null || opts[k] === '') continue;
        o[key] = opts[k];
      }
    }
    // Validation mirrors the PHP defaults logic.
    if (!/^([a-zA-Z,\s\-'])+$/.test(String(o.fontFamily))) o.fontFamily = QnA.defaults.fontFamily;
    ['fontSize', 'lineHeight', 'colWidth', 'framePad', 'radius'].forEach(function (n) {
      if (!/^\d+$/.test(String(o[n]))) o[n] = QnA.defaults[n];
      o[n] = parseInt(o[n], 10);
    });
    ['compBg', 'compTxt', 'compLink', 'usrBg', 'usrTxt', 'usrLink', 'bodyBg', 'bodyTxt', 'bodyLink'].forEach(function (n) {
      var v = String(o[n]).replace(/^#/, '').toLowerCase();
      if (!/^[0-9a-f]{6}$/.test(v)) v = QnA.defaults[n];
      o[n] = v;
    });
    o.chatStyle = /^llm$/i.test(trim(o.chatStyle)) ? 'llm' : 'sms';
    // labels are one line of plain text (escaped when drawn); a blank one falls back to the default
    LABEL_KEYS.forEach(function (n) {
      var v = trim(String(o[n]).replace(/\s+/g, ' ')).slice(0, 200);
      o[n] = v === '' ? QnA.defaults[n] : v;
    });
    if (!o.start) o.start = '1';
    ['footer', 'saveProgress', 'animate', 'scroll', 'injectCss'].forEach(function (n) {
      if (typeof o[n] === 'string') o[n] = !/^(false|0|no|off)$/i.test(o[n]);
      else o[n] = !!o[n];
    });
    return o;
  }
  QnA.normalizeOptions = normalizeOptions;
 
  /* ------------------------------------------------------------------ */
  /*  Helpers                                                            */
  /* ------------------------------------------------------------------ */
 
  function escapeHtml(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function escapeRe(s) { return String(s).replace(/[.*+?^${}()|[\]\\\/-]/g, '\\$&'); }
  function rtrim(s) { return String(s).replace(/\s+$/, ''); }
  function trim(s) { return String(s).replace(/^\s+|\s+$/g, ''); }
  function isNumericLabel(s) { return /^\d+(\.\d+)*$/.test(s); }
  function parentLabel(label) { return label.replace(/\.\d+$/, ''); }
  QnA.escapeHtml = escapeHtml;
 
  /* ------------------------------------------------------------------ */
  /*  Parser                                                             */
  /* ------------------------------------------------------------------ */
 
  // Non-header tags. Same expression as the original PHP implementation.
  // Non-header tags, with any mix of tabs and spaces as indentation.
  // A bracket ([href] or [javascript:…]) may span lines; write a literal ] inside it as \].
  // An X tag may carry one too, X[javascript:…]: or X:[javascript:…] (checked in the tag walk below).
  var TAG_RE = /(^|\n)[ \t]*((Q(\((.*)\))?|DOC\(?(\d?)(.\s*\d+)*\)?):|(A((\(.*\))|)|X)((\[(?:[^\]\\]|\\[\s\S])*\])+:|:(\[(?:[^\]\\]|\\[\s\S])*\])?))/g;
 
  /**
   * Nesting level of each tag from its indentation. Tabs and spaces both work
   * (a tab counts as advancing to the next multiple of 4 columns); what
   * matters is that tags at the same level line up. Levels are assigned by
   * the distinct indentation widths seen, so 2-space, 4-space and tab
   * indentation are all fine as long as a file is consistent with itself.
   */
  function indentLevels(values) {
    var levels = [], odd = [], stack = [0];
    for (var i = 0; i < values.length; i++) {
      var ws = (values[i].match(/^\n?([ \t]*)/) || ['', ''])[1], w = 0;
      for (var c = 0; c < ws.length; c++) w = ws[c] === '\t' ? (Math.floor(w / 4) + 1) * 4 : w + 1;
      var popped = false;
      while (stack.length > 1 && w < stack[stack.length - 1]) { stack.pop(); popped = true; }
      if (w > stack[stack.length - 1]) {
        if (popped) odd[i] = true;          // dedented to a width no earlier tag used: does not line up
        else stack.push(w);
      }
      levels.push(stack.length - 1);
    }
    levels.odd = odd;
    return levels;
  }
  var HEADER_RE = /^(Title|Author|Description|Before|After):/gim;
  var GOTO_END_RE = /GOTO:\s?([a-zA-Z0-9._\-]*)\s*$/i;
 
  function ErrorList() { this.items = []; this.line = null; }
  // `line` is the 1-based line of the tag being examined; callers set it before add()
  ErrorList.prototype.add = function (message, near) {
    this.items.push({ message: message, near: near, line: this.line });
  };
 
  /**
   * Bracket contents as written -> usable href. "\]" becomes "]". For
   * javascript: hrefs, which may be written over several lines, each line is
   * trimmed and //-comments are dropped so the code is tidy whether it ends
   * up executed directly (as this runtime does) or copied into a real href.
   */
  function unescapeHref(h) {
    h = String(h).replace(/\\\]/g, ']');
    if (!/^\s*javascript:/i.test(h) || h.indexOf('\n') < 0) return trim(h);
    var lines = h.split('\n').map(function (l) {
      // strip a trailing // comment unless the // is inside quotes (crude but safe: quotes counted)
      var i = l.indexOf('//');
      while (i >= 0) {
        var before = l.slice(0, i), q = (before.match(/'/g) || []).length, dq = (before.match(/"/g) || []).length, bt = (before.match(/`/g) || []).length;
        if (q % 2 === 0 && dq % 2 === 0 && bt % 2 === 0 && !/:$/.test(before)) { l = before; break; }
        i = l.indexOf('//', i + 2);
      }
      return trim(l);
    }).filter(function (l) { return l !== ''; });
    return lines.join('\n');
  }
 
  function nearText(value, text) {
    var n = trim(value) + String(text || '').substr(0, 50) + '...';
    return n;
  }
 
  /* --- the hidden Settings: tag ---
   * The editor's "Save to File" writes the Settings screen (fonts, colours, ...) into the saved text as
   * one last line:   Settings: fontSize=18; compBg=336699; footer=false
   * It is not part of the conversation: it is taken off before the markup is parsed, and only when it is
   * the last non-blank line. Its values style the QnA unless the same option is given explicitly (a data-
   * attribute on the script tag, or an option passed to QnA.render), which always wins. Only the options
   * on the Settings screen can be set this way, and each goes through the usual validation.
   * Pairs are separated by semicolons, so in a label's text ";" is written %3B (and "%" %25).
   */
  var SETTINGS_KEYS = ['fontFamily', 'fontSize', 'lineHeight', 'colWidth', 'framePad', 'radius', 'compBg', 'compTxt', 'compLink',
    'usrBg', 'usrTxt', 'usrLink', 'bodyBg', 'bodyTxt', 'bodyLink', 'chatStyle'].concat(LABEL_KEYS, ['footer', 'saveProgress', 'start']);
  var SETTINGS_RE = /(^|\n)[ \t]*Settings:([^\n]*)\s*$/i;

  /** Split markup into { markup (without the tag), settings (object, or null when there is no tag) }. */
  QnA.splitSettings = function (markup) {
    var content = String(markup == null ? '' : markup).replace(/\r\n?/g, '\n');
    var m = SETTINGS_RE.exec(content);
    if (!m) return { markup: content, settings: null };
    var settings = {};
    m[2].split(';').forEach(function (pair) {
      var i = pair.indexOf('=');
      if (i < 0) return;
      var k = trim(pair.slice(0, i)), v = trim(pair.slice(i + 1));
      k = LEGACY_KEYS[k] || k;
      if (LABEL_KEYS.indexOf(k) >= 0) v = trim(v.replace(/%([0-9a-fA-F]{2})/g, function (all, hex) { return String.fromCharCode(parseInt(hex, 16)); }));
      if (SETTINGS_KEYS.indexOf(k) >= 0 && v !== '') settings[k] = v;
    });
    // the markup keeps the line break that ended its last real line (when it had one)
    var rest = content.slice(0, m.index).replace(/\s+$/, '');
    return { markup: rest + (rest ? '\n' : ''), settings: settings };
  };

  /** The Settings: line for `options`: every option on the Settings screen, in a fixed order. */
  QnA.settingsTag = function (options) {
    var o = normalizeOptions(options);
    return 'Settings: ' + SETTINGS_KEYS.map(function (k) {
      var v = String(o[k]);
      if (LABEL_KEYS.indexOf(k) >= 0) v = v.replace(/[%;]/g, function (c) { return c === '%' ? '%25' : '%3B'; });
      return k + '=' + v;
    }).join('; ');
  };

  /**
   * Parse QnA Markup.
   * @param {string} markup
   * @returns {object} result
   *   ok        {boolean}   true if well formed
   *   errors    {Array}     [{message (html), near (text)}]
   *   code      {string}    markup with computed ids (Q(1.1):) filled in
   *   header    {object}    {title, author, description, before, after}
   *   questions {Array}     [{label, name, text, doc, goto, display}]
   *   answers   {Array}     [{label, parent, text, href, target, value, isVar, script (X tags only)}]
   *   names     {Array}     [[label, name], ...]  (QVnames in the original)
   *   settings  {object}    values from a trailing hidden Settings: tag, or null (the tag is not in code/markup)
   */
  QnA.parse = function (markup) {
    var split = QnA.splitSettings(markup);
    var content = split.markup;
    var errors = new ErrorList();
 
    /* --- Split on tags ---------------------------------------------- */
    var values = [], text = [], m, last = 0;
    TAG_RE.lastIndex = 0;
    var lineOf = [];   // 1-based line number of each tag
    while ((m = TAG_RE.exec(content)) !== null) {
      text.push(content.slice(last, m.index));
      values.push(m[0]);
      var tagStart = m.index + (m[1] === '\n' ? 1 : 0);
      lineOf.push((content.slice(0, tagStart).match(/\n/g) || []).length + 1);
      last = m.index + m[0].length;
      if (m[0].length === 0) TAG_RE.lastIndex++;
    }
    text.push(content.slice(last));
    // text[0] = header; text[i] = content following values[i-1]
 
    /* --- Pre-compute the labels every Q will receive ------------------- */
    // (depends only on tag kinds and nesting, so it can run before validation)
    var computedLabels = {};
    var levels = indentLevels(values);
    (function () {
      var nl = [], node = 0, ln = -1;
      for (var i = 0; i < values.length; i++) {
        var tb = values[i].replace(/^\n?[ \t]*/, '');
        var n = levels[i];
        if (/^Q/.test(tb)) {
          if (n === 0) { ln = -1; node++; }
          nl[n] = 0;
          var lb = String(node), j = 0;
          while (j < n && nl[j]) { lb += '.' + nl[j]; j++; }
          computedLabels[lb] = true;
          ln = n;
        } else if (!/^DOC/.test(tb)) {   // A and X
          nl[n] = (nl[n] || 0) + 1;
          ln = n;
        }
      }
    })();
 
    /* --- GOTO ambiguity pre-pass ------------------------------------ */
    // A GOTO target is valid if exactly one Q in the source carries that name,
    // or (when none does) if it matches the id a Q will receive after numbering.
    // Targets pointing at nothing become GOTO:????, at more than one Q GOTO:???
    var gotoRe = /GOTO:\s?([a-zA-Z0-9._\-]*)\s*(\n|$)/g, gm;
    var seen = {};
    while ((gm = gotoRe.exec(content)) !== null) {
      var target = gm[1];
      if (target === '' || seen[target]) continue;
      seen[target] = true;
      var qRe = new RegExp('(^|\\n)+[ \\t]*(Q\\(' + escapeRe(target) + '\\):)', 'gi');
      var count = (content.match(qRe) || []).length;
      var repl = null;
      if (count === 0 && !computedLabels.hasOwnProperty(target)) repl = 'GOTO:????';
      else if (count > 1) repl = 'GOTO:???';
      if (repl) {
        var re = new RegExp('GOTO:\\s?' + escapeRe(target) + '(?![a-zA-Z0-9._\\-])', 'gi');
        for (var ti = 0; ti < text.length; ti++) text[ti] = text[ti].replace(re, repl);
      }
    }
 
    /* --- Header ------------------------------------------------------ */
    var header = { title: '', author: '', description: '', before: '', after: '' };
    var hm, hits = [];
    HEADER_RE.lastIndex = 0;
    while ((hm = HEADER_RE.exec(text[0])) !== null) {
      hits.push({ key: hm[1].toLowerCase(), start: hm.index, end: hm.index + hm[0].length });
    }
    for (var h = 0; h < hits.length; h++) {
      var end = h + 1 < hits.length ? hits[h + 1].start : text[0].length;
      var val = text[0].slice(hits[h].end, end);
      if (hits[h].key === 'title' || hits[h].key === 'author' || hits[h].key === 'description') val = trim(val);
      header[hits[h].key] = val;
    }
    var stripTags = function (s) { return trim(String(s).replace(/<[^>]*>/g, '').replace(/[\r\n]+/g, ' ')); };
    header.titleText = stripTags(header.title);
    header.descriptionText = stripTags(header.description);
 
    /* --- Walk tags ---------------------------------------------------- */
    var numberline = [];
    var lastnest = -1, lastvalue = '', lastWasQ = false;
    var Qnode = 0;
    var questions = [], answers = [], names = [];
    var pendingDoc = null;           // DOC content waiting for its Q
    var pendingDocLabel = null;
    var renumber = {};               // stale numeric label -> new label
    var xCount = {};                 // parent label -> number of X tags
    var customNames = {};            // name -> count (for uniqueness)
    var code = text[0];
 
    // Pre-count Q(name): occurrences in the (pre-pass-modified) content for uniqueness checks.
    function countQ(name) {
      var re = new RegExp('Q\\(' + escapeRe(name) + '\\):', 'g');
      return (content.match(re) || []).length;
    }
 
    function buildLabel(nested) {
      var label = String(Qnode), j = 0;
      while (j < nested && numberline[j]) { label += '.' + numberline[j]; j++; }
      return label;
    }
 
    for (var i = 0; i < values.length; i++) {
      var value = values[i];
      var body = text[i + 1];
      var nested = levels[i];
      var tagBody = value.replace(/^\n?[ \t]*/, '');   // e.g. "Q(1):"
      errors.line = lineOf[i];
      if (levels.odd[i]) {
        errors.add('Indentation does not line up with any earlier tag (mixing tabs and spaces?).', nearText(value, text[i + 1]));
      }
      var kind;
      if (/^Q/.test(tagBody)) kind = 'Q';
      else if (/^X[:\[]/.test(tagBody)) kind = 'X';
      else if (/^DOC/.test(tagBody)) kind = 'DOC';
      else kind = 'A';
      var outValue = value;
 
      if (kind === 'Q') {
        if (nested === 0) { lastnest = -1; Qnode++; }
        numberline[nested] = 0;
        var label = buildLabel(nested);
        var pm = /^Q(?:\((.*)\))?:/.exec(tagBody);
        var given = pm && pm[1] !== undefined ? pm[1] : '';
        var name;
        if (given === '' || isNumericLabel(given)) {
          if (given !== '' && given !== label) renumber[given] = label;
          outValue = value.replace(/Q(\((.*)\))?:/, 'Q(' + label + '):');
          name = label;
        } else {
          name = given;
        }
        names.push([label, name]);
 
        if (nested - lastnest !== 1) {
          errors.add('Misaligned Q.', nearText(value, body));
        }
        if (lastWasQ && lastnest !== -1) {
          errors.add('Mismatched Q and Q.', nearText(value, body));
        }
        // GOTO problems are reported on the line the GOTO is on (a question may run over several lines)
        var gi = body.search(/GOTO:/i), gotoRow = gi >= 0 ? (body.slice(0, gi).match(/\n/g) || []).length : 0;
        var gotoNear = gotoRow > 0 ? trim(body.split('\n')[gotoRow]).substr(0, 60) : nearText(value, body);
        errors.line = lineOf[i] + gotoRow;
        if (/GOTO:\?\?\?\?/i.test(body)) {
          errors.add('The target of this GOTO does not exist (or was removed).', gotoNear);
        } else if (/GOTO:\?\?\?/i.test(body)) {
          errors.add('The target of this GOTO appears more than once, so the call was disabled. Look for "GOTO:???".', gotoNear);
        } else if (/GOTO:/i.test(body) && !GOTO_END_RE.test(body)) {
          errors.add('Poorly-formed GOTO call: GOTO must be the last thing in a Q tag, written GOTO:target.', gotoNear);
        }
        errors.line = lineOf[i];
        if (!/^[a-z0-9._\-]*$/i.test(name)) {
          errors.add('Variable names must contain only letters, numbers, periods, underscores, or dashes.', nearText(value, body));
        }
        if (countQ(name) > 1) {
          errors.add('Variable names must be unique (not repeated).', nearText(value, body));
        }
 
        var gotoM = GOTO_END_RE.exec(body);
        var q = {
          label: label,
          name: name,
          text: body,
          display: trim(gotoM ? body.replace(GOTO_END_RE, '') : body),
          goto: gotoM ? gotoM[1] : null,   // name (resolved to a label below)
          doc: null
        };
        if (pendingDoc !== null) { q.doc = pendingDoc; pendingDoc = null; }
        questions.push(q);
        lastnest = nested; lastvalue = value; lastWasQ = true;
 
      } else if (kind === 'A') {
        numberline[nested] = (numberline[nested] || 0) + 1;
        var alabel = buildLabel(nested) + '.' + numberline[nested];
        if (nested - lastnest > 0) {
          errors.add('Misaligned A.', nearText(value, body));
        }
        if (/GOTO:/.test(body)) {
          errors.add('GOTO calls not allowed in A tags.', nearText(value, body));
        }
        var am = /^A(?:\((.*)\))?((?:\[(?:[^\]\\]|\\[\s\S])*\])+:|:(?:\[(?:[^\]\\]|\\[\s\S])*\])?)/.exec(tagBody);
        var a = { label: alabel, parent: parentLabel(alabel), text: body, href: "javascript:void('');", target: '', value: '', isVar: false };
        var hb;
        if ((hb = /^A(?:\(.*\))?:\[((?:[^\]\\]|\\[\s\S])*)\]/.exec(tagBody))) {          // A:[href] -> new window
          a.href = hb[1]; a.target = '_blank';
        } else if ((hb = /^A(?:\(.*\))?\[((?:[^\]\\]|\\[\s\S])*)\]:/.exec(tagBody))) {   // A[href]: -> same window
          a.href = hb[1];
        }
        a.href = unescapeHref(a.href);
        if (am && am[1] !== undefined) a.value = am[1]; else a.value = trim(body);
        answers.push(a);
        lastnest = nested; lastvalue = value; lastWasQ = false;
 
      } else if (kind === 'X') {
        numberline[nested] = (numberline[nested] || 0) + 1;
        var xlabel = buildLabel(nested) + '.' + numberline[nested];
        var xparent = parentLabel(xlabel);
        if (nested - lastnest > 0) {
          errors.add('Misaligned X.', nearText(value, body));
        }
        body = body.replace(/\s+$/, '');       // trailing whitespace is dropped from the code
        if (/^[ \t]+\[\s*javascript:/i.test(body)) {
          errors.add('To run JavaScript from an X tag, put the bracket right against the colon, with no space between them: <code>X:[javascript:…]</code> or <code>X[javascript:…]:</code>.', nearText(value, body));
        } else if (!/^\s*$/.test(body)) {
          body = body.replace(/\s/g, '');
          errors.add('Starting in September 2016, the space after an X (variable) tag must be left blank. Variable names are now pulled from the parent question\'s target_id. That is, the number or letters in parentheses between the "Q" and ":". For example: <p><code>Q(<em style="color:red">target_id</em>):</code></p><p>See <a href="https://www.qnamarkup.org/syntax/#x" target="_blank">Documentation</a>.', nearText(value, body));
        }
        xCount[xparent] = (xCount[xparent] || 0) + 1;
        if (xCount[xparent] > 1) {
          errors.add('Limit one variable per answer set.', nearText(value, body));
        }
        // X[javascript:…]: or X:[javascript:…] (the side of the colon makes no difference): code to run once
        // the visitor's text has been saved to the question's variable. There is no href to fill here, so the
        // bracket can hold nothing else: an empty one, or one without the javascript: prefix, is an error.
        var xscript = '';
        var xb = tagBody.match(/\[(?:[^\]\\]|\\[\s\S])*\]/g);
        if (xb) {
          var xcode = unescapeHref(xb[0].slice(1, -1));
          if (xb.length > 1) {
            errors.add('An X tag takes a single <code>[javascript:…]</code>.', nearText(value, body));
          } else if (!/^javascript:/i.test(xcode)) {
            errors.add('Square brackets on an X tag must hold JavaScript, written <code>X[javascript:…]:</code> or <code>X:[javascript:…]</code>. ' +
              (trim(xcode) === '' ? 'These are empty.' : 'The <code>javascript:</code> prefix is missing.') +
              ' The code runs after the visitor\'s text is saved to the question\'s variable. See <a href="https://www.qnamarkup.org/syntax/#x" target="_blank">Documentation</a>.', nearText(value, body));
          } else {
            xscript = xcode.replace(/^javascript:/i, '');
          }
        }
        answers.push({ label: xlabel, parent: xparent, text: '<variable>', href: "javascript:void('');", target: '', value: '', isVar: true, script: xscript });
        lastnest = nested; lastvalue = value; lastWasQ = false;
 
      } else if (kind === 'DOC') {
        var wasTop = false;
        if (nested === 0 && !/^DOC/.test(lastvalue.replace(/^\n?[ \t]*/, ''))) {
          lastnest = -1; lastvalue = 'Q:'; Qnode++; wasTop = true;
        }
        numberline[nested] = 0;
        var dlabel = buildLabel(nested);
        if (wasTop) Qnode--;
        outValue = value.replace(/DOC\(?(\d?)(.\s*\d+)*\)?:/, 'DOC(' + dlabel + '):');
        if (nested - lastnest !== 1) {
          errors.add('Misaligned DOC.', nearText(value, body));
        }
        if (lastWasQ && lastnest !== -1) {
          errors.add('Mismatched DOC.', nearText(value, body));
        }
        pendingDoc = body; pendingDocLabel = dlabel;
        if (wasTop) { lastWasQ = true; }
        // lastnest/lastvalue are otherwise left untouched by DOC tags (as in the original)
      }
 
      code += outValue + body;
    }
 
    errors.line = null;
    if (!questions.length) {
      errors.add('You must have at least one Q: tag.', nearText(values[values.length - 1] || '', text[text.length - 1]));
    }
    if (!answers.length) {
      errors.add('You must have at least one A: tag.', nearText(values[values.length - 1] || '', text[text.length - 1]));
    }
 
    /* --- Renumber GOTOs whose (numeric) targets moved ------------------ */
    if (Object.keys(renumber).length) {
      code = code.replace(/GOTO:(\s?)([0-9.]+)(\s*(?=\n|$))/gi, function (all, sp, t, tail) {
        return renumber.hasOwnProperty(t) ? 'GOTO:' + sp + renumber[t] + tail : all;
      });
      questions.forEach(function (q) {
        if (q.goto && renumber.hasOwnProperty(q.goto)) q.goto = renumber[q.goto];
      });
    }
 
    /* --- Resolve GOTO names to labels ---------------------------------- */
    var byName = {};
    names.forEach(function (p) { if (!byName.hasOwnProperty(p[1])) byName[p[1]] = p[0]; });
    questions.forEach(function (q) {
      q.gotoName = q.goto;
      q.goto = q.goto === null ? null : (byName.hasOwnProperty(q.goto) ? byName[q.goto] : null);
    });
 
    return {
      ok: errors.items.length === 0,
      errors: errors.items,
      code: code,
      header: header,
      questions: questions,
      answers: answers,
      names: names,
      markup: content,
      settings: split.settings
    };
  };
 
  QnA.errorsHtml = function (result) {
    return result.errors.map(function (e) {
      var where = e.line ? '<b class="qna-error-line">Line ' + e.line + ':</b> ' : '';
      return '<li class="error"' + (e.line ? ' data-line="' + e.line + '"' : '') + '>' + where + e.message +
        (e.near ? '<br><code>' + escapeHtml(e.near) + '</code>' : '') + '</li>';
    }).join('');
  };
 
  /* ------------------------------------------------------------------ */
  /*  CSS (port of lib/css.php)                                          */
  /* ------------------------------------------------------------------ */
 
  QnA.css = function (opts, scope) {
    var o = normalizeOptions(opts);
    var lh = o.lineHeight, r = o.radius;
    var S = scope ? scope + ' ' : '';
    var font = 'font-family:' + o.fontFamily + ';font-size:' + o.fontSize + 'px;line-height:' + lh + 'px;';
    var pad = 'padding:' + (lh * 0.5) + 'px ' + (lh * 0.75) + 'px ' + (lh * 0.70) + 'px ' + (lh * 0.75) + 'px;';
    var bpad = 'padding:' + (lh * 0.5) + 'px 0 ' + (lh * 0.6) + 'px 0;';
    // Chat style. 'sms' draws questions and answers as speech bubbles. 'llm' sets the questions straight on
    // the body, as a chat assistant's replies are: they take the Body Colors (the System Text colours are
    // kept in the options but not used), lose their bubble (no padding but 8px on top, no margin, no radius)
    // and their arrow; answers stay bubbles, set 8px further down.
    var llm = o.chatStyle === 'llm';
    var qBg = llm ? o.bodyBg : o.compBg, qTxt = llm ? o.bodyTxt : o.compTxt, qLink = llm ? o.bodyLink : o.compLink;
    var qBox = llm ? 'border-radius:0;padding:8px 0 0 0;margin:0;' : 'border-radius:' + r + 'px;' + pad + 'margin-right:' + (r + 30) + 'px;';
    return [
      scope ? '' : 'script[type="text/qna"],#rawmarkup{display:none;}',
      '' + S + '.qna-conversation,' + S + '#QandA{display:flow-root;}',
      // the QnA's own background; pages that are nothing but a QnA (viewer, full page) also put it on <body class="qna-page">
      '' + S + '.qna-conversation{' + font + 'background:#' + o.bodyBg + ';color:#' + o.bodyTxt + ';}',
      // links outside the bubbles; :where() keeps this at zero specificity so bubble links and buttons keep their own colours
      '' + S + '.qna-conversation :where(a){color:#' + o.bodyLink + ';}',
      scope ? '' : 'body.qna-page{' + font + 'background:#' + o.bodyBg + ';color:#' + o.bodyTxt + ';}',
      '' + S + '#QandA img{max-width:100%;}',
      '' + S + 'div.frame{float:left;width:100%;margin:5px 0 5px 0;}',
      '' + S + 'div.full{float:left;width:100%;}',
      '' + S + 'div.question_text{float:left;' + font + 'color:#' + qTxt + ';min-width:30px;background:#' + qBg + ';' + qBox + '}',
      '' + S + 'div.question_text a:link,' + S + 'div.question_text a:hover,' + S + 'div.question_text a:active,' + S + 'div.question_text a:visited{color:#' + qLink + ';}',
      '' + S + 'div.question_arrow{' + (llm ? 'display:none;' : '') + 'float:left;width:0;height:0;border-left:5px solid transparent;border-right:10px solid transparent;border-top:15px solid #' + qBg + ';margin:0 ' + (r + 5) + 'px;}',
      '' + S + 'div.ans_text{float:right;' + font + 'color:#' + o.usrTxt + ';min-width:' + (r + 15) + 'px;background:#' + o.usrBg + ';border-radius:' + r + 'px;' + pad + 'margin-left:' + (r + 30) + 'px;' + (llm ? 'margin-top:8px;' : '') + '}',
      '' + S + 'div.ans_text a:link,' + S + 'div.ans_text a:hover,' + S + 'div.ans_text a:active,' + S + 'div.ans_text a:visited{color:#' + o.usrLink + ';}',
      '' + S + 'div.ans_arrow{float:right;width:0;height:0;border-left:10px solid transparent;border-right:5px solid transparent;border-top:15px solid #' + o.usrBg + ';margin:0 ' + (r + 5) + 'px;}',
      '' + S + 'div.choices{float:left;width:100%;margin:15px 0 0 0;}',
      '' + S + 'div.standard_buttons{float:left;width:100%;margin-top:5px;border-top:1px solid #ddd;padding-top:12px;}',
      '' + S + 'div.credits{float:left;width:100%;background:#eee;margin:0 0 15px 0;}',
      // credits always sit on grey, so they keep black text and standard link colours whatever the body colours are
      '' + S + 'div.credit_text{' + font + 'color:#000;padding:4px 15px 10px 15px;}',
      '' + S + 'div.credit_text a:link{color:#0000ee;}',
      '' + S + 'div.credit_text a:visited{color:#551a8b;}',
      '' + S + 'li.error{list-style-type:none;background:#ffdddd;margin:10px 0 0 0;padding:5px;}',
      '' + S + '.qpad{float:left;padding:0 ' + (lh * 0.75) + 'px;}',
      '' + S + 'a.sbutton{float:left;' + font + 'width:48%;background:#eee;border-radius:8px;' + bpad + 'margin:0 0 3px 0;border:solid 1px #888;text-align:center;color:#000;text-decoration:none;cursor:pointer;}',
      '' + S + 'a.sbutton:hover,' + S + 'a.sbutton:active{background:#ddd;}',
      '' + S + 'a.qabutton{float:left;' + font + 'width:100%;background:#eee;border-radius:8px;' + bpad + 'margin:0 0 8px 0;border:solid 1px #888;text-align:left;color:#000;text-decoration:none;cursor:pointer;box-sizing:border-box;}',
      '' + S + 'a.qabutton:hover,' + S + 'a.qabutton:active{background:#ddd;}',
      '' + S + 'div.xdiv{float:left;width:100%;margin:0 0 8px 0;background:#eee;border:solid 1px #888;border-radius:8px;box-sizing:border-box;}',
      '' + S + 'input.xinput{box-sizing:border-box;float:left;width:100%;' + font + 'background:#fff;border-top-left-radius:8px;border-top-right-radius:8px;padding:' + (lh * 0.5) + 'px ' + (lh * 0.5) + 'px ' + (lh * 0.6) + 'px ' + (lh * 0.5) + 'px;border:solid 0 #888;border-bottom:solid 1px #888;text-align:left;color:#000;}',
      '' + S + 'a.xbutton{float:left;width:100%;text-align:left;' + font + 'background:#eee;border-radius:8px;' + bpad + 'color:#000;text-decoration:none;cursor:pointer;}',
      '' + S + 'a.xbutton:hover,' + S + 'a.xbutton:active{border-top-left-radius:0;border-top-right-radius:0;background:#ddd;}',
      '' + S + '.qna-jump{float:left;width:100%;height:1px;}',
      '' + S + '.qna-pending{float:left;width:100%;position:relative;min-height:' + (llm ? lh + 18 : Math.round(lh * 2.2 + 25)) + 'px;}',
      '' + S + '.qna-pending .qna-typing{position:absolute;top:0;left:0;width:100%;margin:5px 0 0 0;}',
      '' + S + '.qna-pending-body{float:left;width:100%;visibility:hidden;}',
      '' + S + '.qna-pending-body.qna-revealed{visibility:visible;animation:qna-fadein .15s ease-in;}',
      '' + S + '.qna-dots{display:inline-block;line-height:' + lh + 'px;}',
      '' + S + '.qna-dots i{display:inline-block;width:' + Math.max(5, Math.round(o.fontSize * 0.45)) + 'px;height:' + Math.max(5, Math.round(o.fontSize * 0.45)) + 'px;margin:0 2px;border-radius:50%;background:currentColor;opacity:.35;animation:qna-blink 1.2s infinite ease-in-out;}',
      '' + S + '.qna-dots i:nth-child(2){animation-delay:.2s;}',
      '' + S + '.qna-dots i:nth-child(3){animation-delay:.4s;}',
      scope ? '' : '@keyframes qna-blink{0%,80%,100%{opacity:.35;transform:translateY(0);}40%{opacity:1;transform:translateY(-2px);}}',
      scope ? '' : '@keyframes qna-fadein{from{opacity:0;}to{opacity:1;}}',
      '' + S + '.qna-footer{float:left;width:100%;margin:15px 0 0 0;border-top:solid 1px #ddd;}',
      '' + S + '.qna-spacer{float:left;width:100%;height:0;}',
      '' + S + '.qna-footer p{text-align:center;}',
      '' + S + '.qna-error-list{margin:0;padding:0;font-family:Verdana,Geneva,sans-serif;font-size:13px;}'
    ].join('\n');
  };
 
  QnA.injectCss = function (opts, scope, doc) {
    doc = doc || root.document;
    var id = scope ? 'qna-style-' + scope.replace(/[^a-z0-9_-]/gi, '') : 'qna-style';
    var el = doc.getElementById(id);
    if (!el) {
      el = doc.createElement('style');
      el.id = id;
      (doc.head || doc.getElementsByTagName('head')[0] || doc.body).appendChild(el);
    }
    el.textContent = QnA.css(opts, scope);
    return el;
  };
 
  /* ------------------------------------------------------------------ */
  /*  URL hash encoding (deflate + base64url) for sharing links          */
  /* ------------------------------------------------------------------ */
 
  function b64urlEncode(bytes) {
    var s = '';
    for (var i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
    return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  function b64urlDecode(str) {
    str = str.replace(/-/g, '+').replace(/_/g, '/');
    while (str.length % 4) str += '=';
    var bin = atob(str), out = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }
  function pipe(bytes, stream) {
    var writer = stream.writable.getWriter();
    writer.write(bytes); writer.close();
    return new Response(stream.readable).arrayBuffer().then(function (ab) { return new Uint8Array(ab); });
  }
  var hasStreams = typeof root.CompressionStream === 'function' && typeof root.DecompressionStream === 'function';
 
  /**
   * Encode {markup, ...options} into a URL fragment string (without the '#').
   * Resolves to "z=<base64url deflate-raw JSON>" or, if compression is
   * unavailable, "j=<uri-encoded JSON>".
   */
  QnA.encodeHash = function (payload) {
    var json = JSON.stringify(payload);
    if (!hasStreams) return Promise.resolve('j=' + encodeURIComponent(json));
    var bytes = new TextEncoder().encode(json);
    return pipe(bytes, new root.CompressionStream('deflate-raw')).then(function (out) {
      return 'z=' + b64urlEncode(out);
    });
  };
 
  /**
   * Decode a fragment (with or without '#') or a full query string produced by
   * either this library or the original PHP editor (?markup=...&font_size=...).
   * Resolves to {markup, ...options} or null.
   */
  QnA.decodeHash = function (hash) {
    hash = String(hash || '').replace(/^[#?]/, '');
    if (!hash) return Promise.resolve(null);
    // Plain markup with no key at all (e.g. "#Q%3A%20hi..."): anything that
    // does not look like a key=value list is taken as the markup itself.
    if (!/^[A-Za-z_][A-Za-z0-9_]*=/.test(hash)) {
      var raw;
      try { raw = decodeURIComponent(hash.replace(/\+/g, ' ')); } catch (e) { raw = hash; }
      return Promise.resolve({ markup: raw });
    }
    var params = {};
    hash.split('&').forEach(function (kv) {
      var i = kv.indexOf('='); if (i < 0) return;
      var k = decodeURIComponent(kv.slice(0, i));
      var v = kv.slice(i + 1);
      params[k] = k === 'z' ? v : decodeURIComponent(v.replace(/\+/g, ' '));
    });
    if (params.z) {
      if (!hasStreams) return Promise.reject(new Error('This browser cannot decompress the link.'));
      return pipe(b64urlDecode(params.z), new root.DecompressionStream('deflate-raw')).then(function (out) {
        return JSON.parse(new TextDecoder().decode(out));
      });
    }
    if (params.j) return Promise.resolve(JSON.parse(params.j));
    if (params.markup !== undefined || params.m !== undefined || params.q !== undefined) {
      var o = { markup: params.markup !== undefined ? params.markup : (params.m !== undefined ? params.m : params.q) };
      for (var k in LEGACY_KEYS) if (params[k] !== undefined) o[LEGACY_KEYS[k]] = params[k];
      if (params.sharing === '2') o.footer = false;
      return Promise.resolve(o);
    }
    return Promise.resolve(null);
  };
 
  /* ------------------------------------------------------------------ */
  /*  Runtime                                                            */
  /* ------------------------------------------------------------------ */
 
  var instances = [];
  QnA.current = null;
  QnA._styleKey = null;
  QnA._scopeSeq = 0;
 
  /* --- scripts written in the markup ---
   * Everything a QnA displays goes into the page through innerHTML, and a script element created
   * that way never runs. So after each insertion the script tags in it are swapped for freshly
   * made copies, which the browser does run: as ordinary page scripts, in the global scope, so a
   * function defined in Before: can be called from an A[javascript:...] button, from a later
   * script, or from the page itself. They run strictly in the order written: an external script
   * (src) holds back the ones after it until it has loaded, as it would in a page. Script tags
   * that are not JavaScript (a JSON or template block, or another QnA) are left as they are.
   */
  var JS_TYPE = /^(module|(text|application)\/(x-)?(java|ecma|j)script(1\.\d)?)?$/i;
  var scriptQueue = [], scriptBusy = false;
  function pumpScripts() {
    var d = root.document;
    while (!scriptBusy && scriptQueue.length) {
      var old = scriptQueue.shift();
      // gone from the page in the meantime (the QnA was restarted or rendered again): skip it
      if (!old.parentNode || !d.documentElement.contains(old)) continue;
      var s = d.createElement('script');
      for (var i = 0; i < old.attributes.length; i++) s.setAttribute(old.attributes[i].name, old.attributes[i].value);
      if (old.nonce) s.nonce = old.nonce;
      s.text = old.text;
      if (s.src) {
        // dynamically inserted external scripts would otherwise run whenever they arrive
        scriptBusy = true;
        s.async = false;
        s.onload = s.onerror = (function (el) {
          return function (ev) {
            el.onload = el.onerror = null;
            if (ev && ev.type === 'error' && root.console) console.error('QnA: could not load script ' + el.src);
            scriptBusy = false; pumpScripts();
          };
        })(s);
      }
      old.parentNode.replaceChild(s, old);   // an inline script runs here, before replaceChild returns
    }
  }
  function runScripts(nodes) {
    for (var n = 0; n < nodes.length; n++) {
      var node = nodes[n];
      if (!node || node.nodeType !== 1) continue;
      var list = node.tagName === 'SCRIPT' ? [node] : node.querySelectorAll('script');
      for (var i = 0; i < list.length; i++) {
        if (JS_TYPE.test(trim(list[i].getAttribute('type') || ''))) scriptQueue.push(list[i]);
      }
    }
    pumpScripts();
  }
  // for text-only views (transcripts): a script or style block is code, not conversation
  function dropCode(html) { return String(html).replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, ''); }

  function Instance(container, result, options) {
    this.container = container;
    // set before anything is drawn, so a script in the markup can already reach its QnA
    // (QnA.current, or document.currentScript.closest('.qna').qna when there are several)
    container.qna = this;
    QnA.current = this;
    this.result = result;
    this.options = options;
    this.byLabel = {};
    this.byName = {};
    this.answersByQ = {};
    this.answerByLabel = {};
    var self = this;
    result.questions.forEach(function (q) { self.byLabel[q.label] = q; if (!self.byName[q.name]) self.byName[q.name] = q; });
    result.answers.forEach(function (a) {
      self.answerByLabel[a.label] = a;
      (self.answersByQ[a.parent] = self.answersByQ[a.parent] || []).push(a);
    });
    this.history = [];      // [{label, value}] answers chosen so far
    this.timer = null;
    this.pendingToken = 0;
    this.typingEl = null;
    this.pendingWrap = null;
    this.lastAnchor = null;
    this.build();
    this.start(options.start);
  }
 
  Instance.prototype.build = function () {
    var r = this.result, o = this.options, c = this.container;
    var html = '<form name="FORM" id="FORM" class="qna-form" onsubmit="return false;">' +
      '<div id="conversation" class="qna-conversation" style="margin:' + o.framePad + 'px auto 0 auto;padding:0 ' + o.framePad + 'px;max-width:' + o.colWidth + 'px">' +
      r.header.before +
      '<div id="QandA" class="QandA"></div>' +
      '<div id="Choices" class="choices"></div>' +
      '<div class="qna-vars" style="display:none"></div>' +
      '<div class="qna-footer"></div>' +
      '<div class="qna-spacer"></div>' +
      '</div></form>' + r.header.after;
    c.innerHTML = html;
    this.form = c.querySelector('form.qna-form');
    this.qanda = c.querySelector('#QandA');
    this.choices = c.querySelector('#Choices');
    this.varsEl = c.querySelector('.qna-vars');
    this.footer = c.querySelector('.qna-footer');
    this.spacer = c.querySelector('.qna-spacer');
    if (o.footer) this.buildFooter();
    else this.footer.style.display = 'none';
    // Before: and After: scripts run now: the QnA's frame is in the page, the first question is not yet.
    runScripts([c]);
  };
 
  Instance.prototype.buildFooter = function () {
    var h = this.result.header, self = this;
    var html = '';
    var hasCredits = h.title || h.author || h.description;
    if (hasCredits) {
      html += '<div id="credits" class="credits" style="display:none;"><div class="credit_text">';
      if (h.title) html += '<p><b>' + h.title + '</b></p>';
      if (h.author) html += '<p>By ' + h.author + '</p>';
      if (h.description) html += '<p>' + h.description + '</p>';
      html += '</div></div>';
    }
    html += '<p>';
    if (hasCredits) html += '<a href="javascript:void(\'\');" class="qna-credits-link">' + escapeHtml(this.options.labelCredits) + '</a> | ';
    html += '<a href="' + escapeHtml(this.options.editorUrl) + '" class="qna-edit-link" target="_top">' + escapeHtml(this.options.labelEdit) + '</a> | ';
    html += '<a href="' + escapeHtml(this.options.editorUrl) + '" class="qna-code-link" target="_top">' + escapeHtml(this.options.labelCode) + '</a></p>';
    this.footer.innerHTML = html;
    var cl = this.footer.querySelector('.qna-credits-link');
    if (cl) cl.addEventListener('click', function () {
      var el = self.footer.querySelector('#credits');
      el.style.display = el.style.display === 'none' ? 'block' : 'none';
    });
    var edit = this.footer.querySelector('.qna-edit-link');
    var payload = { markup: this.result.markup };
    // every Settings-screen option that differs from the default goes along (the footer is showing, so not that one)
    SETTINGS_KEYS.forEach(function (k) {
      if (k !== 'footer' && self.options[k] !== QnA.defaults[k]) payload[k] = self.options[k];
    });
    QnA.encodeHash(payload).then(function (hash) {
      edit.href = self.options.editorUrl + '#' + hash;
    }).catch(function () {});
    edit.addEventListener('click', function () {
      alert('You are about to edit a copy of this QnA. Any edits will not change this instance.');
    });
  };
 
  /* --- state helpers --- */
 
  Instance.prototype.reset = function () {
    if (this.timer) { clearTimeout(this.timer); this.timer = null; }
    this.pendingToken = (this.pendingToken || 0) + 1;
    this.typingEl = null;
    this.pendingWrap = null;
    this.choices.style.display = '';
    this.qanda.innerHTML = '';
    this.choices.innerHTML = '';
    this.varsEl.innerHTML = '';
    this.convo = [];
    this.docs = [];
    this.vars = {};
    this.current = null;
    this.qnum = 0;
  };
 
  Instance.prototype.setVar = function (name, value) {
    this.vars[name] = value;
    var list = this.varsEl.querySelectorAll('textarea');
    for (var i = 0; i < list.length; i++) if (list[i].name === name) { list[i].parentNode.removeChild(list[i]); }
    var ta = root.document.createElement('textarea');
    ta.id = name; ta.name = name; ta.setAttribute('data-var', name);
    ta.textContent = value;
    this.varsEl.appendChild(ta);
  };
 
  Instance.prototype.swapvar = function (input) {
    var out = String(input);
    for (var name in this.vars) {
      if (!Object.prototype.hasOwnProperty.call(this.vars, name)) continue;
      out = out.replace(new RegExp('<x>' + escapeRe(name) + '<\\/x>', 'gi'), this.vars[name]);
    }
    return out;
  };
 
  Instance.prototype.appendHtml = function (html) {
    var tmp = root.document.createElement('div');
    tmp.innerHTML = html;
    var nodes = [];
    var target = this.pendingWrap || this.qanda;
    while (tmp.firstChild) { nodes.push(tmp.firstChild); target.appendChild(tmp.firstChild); }
    // A script in a Q (or A) runs each time its bubble is drawn. That includes the redraw after GO BACK
    // and when saved progress is restored; this.replaying is true then, for scripts that care.
    runScripts(nodes);
    return nodes;
  };
 
  // true when a bubble would show nothing: only whitespace, &nbsp; and <br>s
  function isBlank(html) { return /^(\s|&nbsp;|<br\s*\/?>)*$/i.test(String(html)); }
 
  Instance.prototype.questionBubbles = function (text) {
    // <br><br> splits a bubble in two; "<br> <br>" does not. Empty bubbles are skipped.
    var parts = text.split(/<br\s*\/?><br\s*\/?>/i);
    var html = '';
    for (var i = 0; i < parts.length; i++) {
      var p = this.swapvar(parts[i]);
      if (isBlank(p)) continue;
      html += "<div class='frame'><div class='full'><div class='question_text'>" + p + "</div></div><div class='question_arrow'></div></div>";
      this.convo.push('BOT: ' + dropCode(p) + '\n');
    }
    this.appendHtml(html);
  };
 
  Instance.prototype.answerBubble = function (html) {
    html = html.replace(/(<br\s*\/?>){2}/gi, '<br> <br>');
    this.appendHtml("<div class='frame'><div class='full'><div class='ans_text'>" + html + "</div></div><div class='ans_arrow'></div></div>");
  };
 
  /**
   * Display question `label`, following any GOTO chain. Returns the label of
   * the question that ends up current (or null if none exists).
   */
  Instance.prototype.showQuestion = function (label) {
    var guard = 0;
    while (label !== null && guard++ < 500) {
      var q = this.byLabel[label];
      if (!q) {
        this.appendHtml("<div class='frame'><div class='full'><div class='question_text'>[QnA: missing question " + escapeHtml(label) + "]</div></div><div class='question_arrow'></div></div>");
        return null;
      }
      if (q.doc !== null) this.docs.push(q.doc);
      if (q.goto !== null) {
        if (!isBlank(q.display)) this.questionBubbles(q.display);
        label = q.goto;
        continue;
      }
      if (q.goto === null && q.gotoName !== null) {   // unresolved GOTO (shouldn't happen when well formed)
        if (!isBlank(q.display)) this.questionBubbles(q.display);
        return null;
      }
      if (!isBlank(q.display)) this.questionBubbles(q.display);
      return label;
    }
    return null;
  };
 
  Instance.prototype.renderChoices = function () {
    var self = this, html = '', xId = null;
    var list = this.current !== null ? (this.answersByQ[this.current] || []) : [];
    list.forEach(function (a) {
      if (a.isVar) {
        xId = 'Xi-' + a.label;
        // an X tag's [javascript:…] goes on both the field (Enter) and the button
        var xs = a.script ? ' data-script="' + escapeHtml(a.script) + '"' : '';
        html += '<div class="xdiv"><input type="text" id="' + xId + '" name="' + xId + '" class="xinput" data-answer="' + a.label + '"' + xs + ' autocomplete="off"/>' +
          '<a href="javascript:void(\'\');" class="xbutton" data-answer="' + a.label + '"' + xs + '><span class="qpad">' + escapeHtml(self.options.labelSave) + '</span></a></div>';
      } else {
        var txt = a.text.replace(/(<br\s*\/?>){2}/gi, '<br> <br>');
        var href = a.href, script = '';
        if (/^javascript:/i.test(href) && href !== "javascript:void('');") {
          script = href.replace(/^javascript:/i, '');
          href = "javascript:void('');";
        }
        html += '<a href="' + escapeHtml(href) + '" class="qabutton" data-answer="' + a.label + '"' +
          (script ? ' data-script="' + escapeHtml(script) + '"' : '') +
          (a.target ? ' target="' + a.target + '"' : '') + '><span class="qpad">' + txt + '</span></a>';
      }
    });
    if (this.history.length > 0 || this.qnum > 1) {
      html += '<div class="standard_buttons">' +
        '<a href="javascript:void(\'\');" class="sbutton qna-back">' + escapeHtml(this.options.labelBack) + '</a>' +
        '<a href="javascript:void(\'\');" class="sbutton qna-restart" style="float:right">' + escapeHtml(this.options.labelRestart) + '</a></div>';
    }
    this.choices.innerHTML = html;
 
    var els = this.choices.querySelectorAll('[data-answer]');
    for (var i = 0; i < els.length; i++) {
      (function (el) {
        // The answer is taken first, then its script runs: for an X tag that means the variable already
        // holds the new text (and nothing runs when an empty field was refused).
        var choose = function () {
          if (!self.answer(el.getAttribute('data-answer'))) return;
          var s = el.getAttribute('data-script');
          if (s) { try { (0, eval)(s); } catch (err) { if (root.console) console.error('QnA: error in answer script:', err); } }
        };
        if (el.tagName === 'INPUT') {
          el.addEventListener('keydown', function (e) {
            if (e.keyCode === 13 || e.key === 'Enter') { e.preventDefault(); choose(); }
          });
        } else {
          el.addEventListener('click', choose);
        }
      })(els[i]);
    }
    var back = this.choices.querySelector('.qna-back');
    if (back) back.addEventListener('click', function () { self.goBack(); });
    var restart = this.choices.querySelector('.qna-restart');
    if (restart) restart.addEventListener('click', function () { self.clearProgress(); self.start(self.options.start, false); });
 
    if (xId && this.prefill !== undefined && this.prefill !== null) {
      root.document.getElementById(xId).value = this.prefill;
    }
    this.prefill = null;
  };
 
  Instance.prototype.presentQuestion = function (label, animate) {
    var anchor = null;
    if (this.qnum > 0) {
      var nodes = this.appendHtml('<div class="qna-jump">&nbsp;</div>');
      anchor = nodes[0];
    }
    this.current = this.showQuestion(label);
    this.renderChoices();
    this.qnum++;
    this.lastAnchor = anchor;
    if (!this.pendingWrap && !this.replaying) this.revealScroll(animate);
  };
  Instance.prototype.revealScroll = function (animate) {
    if (this.lastAnchor && this.options.scroll) this.scrollToAnchor(animate);
    this.focusInput();
  };
  Instance.prototype.focusInput = function () {
    var x = this.choices.querySelector('input.xinput');
    if (!x) return;
    // Inside a frame (an embed, or the editor's preview), only take focus when the frame already has it,
    // so a QnA never pulls the cursor out of the page around it.
    if (root.self !== root.top && !(root.document.hasFocus && root.document.hasFocus())) return;
    // Likewise don't steal focus from someone typing elsewhere on the page:
    // only take it when nothing editable outside this QnA is focused.
    var a = root.document.activeElement;
    if (a && !this.container.contains(a) && (/^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName) || a.isContentEditable)) return;
    try { x.focus({ preventScroll: true }); } catch (e) { try { x.focus(); } catch (e2) {} }
  };
 
  /** The element that scrolls this QnA: the nearest scrollable ancestor, else the window. */
  Instance.prototype.scroller = function () {
    var el = this.container.parentNode, d = root.document;
    while (el && el !== d.body && el !== d.documentElement) {
      var cs = getComputedStyle(el), oy = cs.overflowY;
      if ((oy === 'auto' || oy === 'scroll' || oy === 'overlay') && el.scrollHeight > el.clientHeight) return el;
      el = el.parentNode;
    }
    return null;   // window
  };
 
  /**
   * Scroll so the top of the newest exchange (this.lastAnchor) sits at the top
   * of the QnA's scrolling area. A spacer at the end of the conversation is
   * grown as needed so there is always enough room below for that to be
   * possible, even for the last exchange in a short conversation.
   */
  Instance.prototype.scrollToAnchor = function (animate) {
    var anchor = this.lastAnchor, d = root.document;
    if (!anchor || !anchor.parentNode) return;
    var sc = this.scroller();
    var viewH = sc ? sc.clientHeight : (root.innerHeight || d.documentElement.clientHeight);
    // room needed below the anchor: the visible area minus what the conversation has after it
    var anchorTop = anchor.getBoundingClientRect().top;
    var endBottom = this.spacer.getBoundingClientRect().top;   // everything except the spacer
    var need = Math.max(0, Math.ceil(viewH - (endBottom - anchorTop)));
    var cur = parseFloat(this.spacer.style.height) || 0;
    if (need > cur) this.spacer.style.height = need + 'px';   // only ever grows (shrinking would jump the view)
    var scTop = sc ? sc.getBoundingClientRect().top : 0;
    var delta = anchor.getBoundingClientRect().top - scTop;
    var behavior = animate ? 'smooth' : 'auto';
    try {
      if (sc) sc.scrollTo({ top: sc.scrollTop + delta, behavior: behavior });
      else root.scrollTo({ top: (root.pageYOffset || d.documentElement.scrollTop) + delta, behavior: behavior });
    } catch (e) {
      if (sc) sc.scrollTop += delta; else root.scrollTo(0, (root.pageYOffset || 0) + delta);
    }
  };
 
  /** Apply an answer to the state and DOM (user bubble + variables). */
  Instance.prototype.applyAnswer = function (entry) {
    var a = this.answerByLabel[entry.label];
    if (!a) return;
    var parent = this.byLabel[a.parent];
    var name = parent ? parent.name : a.parent;
    var shown = a.isVar ? entry.value : trim(a.text);
    var value = a.isVar ? entry.value : a.value;
    this.setVar(name, value);
    this.answerBubble(shown);
    this.convo.push('USER: ' + dropCode(shown) + '\n');
  };
 
  /* --- typing indicator & media preloading --- */
 
  /** Resolve once every <img> in `container` has loaded and decoded (or failed), or after options.loadTimeout. */
  Instance.prototype.waitForImages = function (container) {
    var imgs = Array.prototype.slice.call(container.querySelectorAll('img'));
    if (!imgs.length) return Promise.resolve(false);
    var timeout = this.options.loadTimeout;
    return new Promise(function (resolve) {
      var left = imgs.length, done = false;
      var finish = function () { if (!done) { done = true; resolve(true); } };
      var one = function () { if (--left <= 0) finish(); };
      imgs.forEach(function (img) {
        var settle = function () {
          // decode() makes sure the first paint is not delayed by decoding a large image
          if (img.decode) img.decode().then(one, one); else one();
        };
        if (img.complete) settle();
        else { img.addEventListener('load', settle); img.addEventListener('error', one); }
      });
      setTimeout(finish, timeout);
    });
  };
 
  Instance.prototype.hideTyping = function () {
    if (this.typingEl && this.typingEl.parentNode) this.typingEl.parentNode.removeChild(this.typingEl);
    this.typingEl = null;
  };
 
  /**
   * Render the next question straight into the conversation, in normal flow
   * but visibility:hidden, with the typing indicator laid over it. Being in
   * flow means the browser lays out and loads its images exactly as they will
   * be displayed (and img.decode() pre-decodes them), so revealing is just a
   * fade-in with no reflow, no re-decode and no scrolling. The reveal waits for the images
   * (up to options.loadTimeout) and at least `minDelay` ms; a reset() in the
   * meantime cancels it.
   */
  Instance.prototype.presentSoon = function (label, minDelay) {
    var self = this, token = ++this.pendingToken;
    var d = root.document;
    var wrap = d.createElement('div');
    wrap.className = 'qna-pending';
    var body = d.createElement('div');
    body.className = 'qna-pending-body';
    wrap.appendChild(body);
    this.qanda.appendChild(wrap);
    this.pendingWrap = body;
    this.presentQuestion(label, true);
    this.pendingWrap = null;
    var hasImages = body.querySelector('img') !== null;
    var reveal = function () {
      if (token !== self.pendingToken) return;   // reset/restart happened meanwhile
      self.hideTyping();
      body.classList.add('qna-revealed');
      self.choices.style.display = '';
      var done = function () {
        if (token !== self.pendingToken) return;
        while (body.firstChild) wrap.parentNode.insertBefore(body.firstChild, wrap);
        if (wrap.parentNode) wrap.parentNode.removeChild(wrap);
        self.focusInput();
      };
      // unwrap after the fade so the transition is not interrupted
      self.timer = setTimeout(function () { self.timer = null; done(); }, 180);
    };
    if (!hasImages && !minDelay) {
      body.classList.add('qna-revealed');
      self.choices.style.display = '';
      while (body.firstChild) wrap.parentNode.insertBefore(body.firstChild, wrap);
      wrap.parentNode.removeChild(wrap);
      this.revealScroll(true);
      return;
    }
    this.choices.style.display = 'none';
    // typing indicator, laid over the top of the pending bubble
    var typing = d.createElement('div');
    typing.className = 'frame qna-typing';
    typing.innerHTML = "<div class='full'><div class='question_text'><span class='qna-dots'><i></i><i></i><i></i></span></div></div><div class='question_arrow'></div>";
    wrap.insertBefore(typing, body);
    this.typingEl = typing;
    // bring the spot where the question will appear to the top now, so nothing moves at reveal
    if (this.options.scroll && this.qnum > 1) this.scrollToAnchor(true);
    var started = Date.now();
    this.waitForImages(body).then(function () {
      if (token !== self.pendingToken) return;
      var wait = Math.max(0, minDelay - (Date.now() - started));
      // Now that the images have their size, scroll the (still hidden) bubble
      // into its final place while the dots are showing, so the reveal itself
      // does not move anything.
      if (self.options.scroll && self.qnum > 1 && self.lastAnchor) {
        var sc = self.scroller(), scTop = sc ? sc.getBoundingClientRect().top : 0;
        var off = self.lastAnchor.getBoundingClientRect().top - scTop;
        if (off > 4 || off < -4) { self.scrollToAnchor(true); wait = Math.max(wait, 350); }
      }
      self.timer = setTimeout(function () { self.timer = null; reveal(); }, wait);
    });
  };
 
  /* --- progress saving (localStorage, opt in) --- */
 
  Instance.prototype.progressKey = function () {
    // key on the markup itself so a changed QnA never restores stale answers
    var h = 5381, m = this.result.markup;
    for (var i = 0; i < m.length; i++) h = ((h << 5) + h + m.charCodeAt(i)) | 0;
    return 'qna-progress-' + (h >>> 0).toString(36) + '-' + m.length;
  };
  Instance.prototype.saveProgress = function () {
    if (!this.options.saveProgress) return;
    try {
      if (this.history.length) root.localStorage.setItem(this.progressKey(), JSON.stringify({ history: this.history, ts: Date.now() }));
      else root.localStorage.removeItem(this.progressKey());
    } catch (e) {}
  };
  Instance.prototype.loadProgress = function () {
    if (!this.options.saveProgress) return null;
    try {
      var raw = root.localStorage.getItem(this.progressKey());
      var data = raw ? JSON.parse(raw) : null;
      if (data && data.history && data.history.length) return data.history;
    } catch (e) {}
    return null;
  };
  Instance.prototype.clearProgress = function () {
    try { root.localStorage.removeItem(this.progressKey()); } catch (e) {}
  };
 
  /* --- public actions --- */
 
  /** Start (or restart) at `label`. Restores saved progress when enabled and `resume` is not false. */
  Instance.prototype.start = function (label, resume) {
    QnA.current = this;
    this.history = [];
    this.reset();
    if (this.spacer) this.spacer.style.height = '0px';
    var saved = resume === false ? null : this.loadProgress();
    if (saved) {
      var self = this;
      var valid = saved.every(function (e) { return e && self.answerByLabel[e.label]; });
      if (valid) { this.history = saved; this.replay(this.options.animate); return; }
      this.clearProgress();
    }
    if (this.options.animate) this.presentSoon(String(label || '1'), 0);
    else this.presentQuestion(String(label || '1'), false);
    if (this.options.scroll && this.qnum > 1) root.scrollTo(0, 0);
  };
 
  Instance.prototype.answer = function (label) {
    QnA.current = this;
    var a = this.answerByLabel[label];
    if (!a) return false;
    var entry = { label: label, value: null };
    if (a.isVar) {
      var input = root.document.getElementById('Xi-' + label);
      var v = input ? trim(input.value) : '';
      if (v === '') {
        alert('Your answer appears to be empty.');
        if (input) input.focus();
        return false;
      }
      entry.value = v.replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }
    this.history.push(entry);
    this.applyAnswer(entry);
    this.saveProgress();
    this.choices.innerHTML = '';
    if (this.options.animate) this.presentSoon(label, 300);
    else this.presentQuestion(label, false);
    return true;
  };
 
  /**
   * Re-render the whole conversation from history. Synchronous by default
   * (goBack: everything is already on screen). With `waitForMedia` (resuming
   * saved progress on a fresh page) the conversation is built hidden behind a
   * typing indicator until its images have loaded, then revealed at once.
   */
  Instance.prototype.replay = function (waitForMedia, noScroll) {
    var hist = this.history.slice();
    this.reset();
    this.history = hist;
    this.replaying = true;
    var self = this, token = this.pendingToken, d = root.document;
    var wrap = null, body = null;
    if (waitForMedia) {
      wrap = d.createElement('div'); wrap.className = 'qna-pending';
      body = d.createElement('div'); body.className = 'qna-pending-body';
      wrap.appendChild(body);
      this.qanda.appendChild(wrap);
      this.pendingWrap = body;
    }
    this.presentQuestion(String(this.options.start), false);
    for (var i = 0; i < hist.length; i++) {
      this.applyAnswer(hist[i]);
      this.presentQuestion(hist[i].label, false);
    }
    this.replaying = false;
    if (!waitForMedia) { if (noScroll) this.focusInput(); else this.revealScroll(false); return; }
    this.pendingWrap = null;
    var finish = function () {
      if (token !== self.pendingToken) return;
      self.hideTyping();
      body.classList.add('qna-revealed');
      self.choices.style.display = '';
      self.timer = setTimeout(function () {
        self.timer = null;
        if (token !== self.pendingToken) return;
        while (body.firstChild) wrap.parentNode.insertBefore(body.firstChild, wrap);
        if (wrap.parentNode) wrap.parentNode.removeChild(wrap);
        self.revealScroll(false);
      }, 180);
    };
    if (!body.querySelector('img')) {
      body.classList.add('qna-revealed');
      while (body.firstChild) wrap.parentNode.insertBefore(body.firstChild, wrap);
      wrap.parentNode.removeChild(wrap);
      this.revealScroll(false);
      return;
    }
    this.choices.style.display = 'none';
    var typing = d.createElement('div');
    typing.className = 'frame qna-typing';
    typing.innerHTML = "<div class='full'><div class='question_text'><span class='qna-dots'><i></i><i></i><i></i></span></div></div><div class='question_arrow'></div>";
    wrap.insertBefore(typing, body);
    this.typingEl = typing;
    this.waitForImages(body).then(finish);
  };
 
  Instance.prototype.goBack = function () {
    QnA.current = this;
    if (!this.history.length) { this.start(this.options.start); return; }
    var popped = this.history.pop();
    var a = this.answerByLabel[popped.label];
    this.prefill = a && a.isVar ? popped.value.replace(/&lt;/g, '<').replace(/&gt;/g, '>') : null;
    // Remove the last exchange in place with no scrolling of our own. The
    // spacer drops to 15px so the remaining conversation fills the view
    // rather than leaving an empty screen where the removed exchange was.
    this.replay(false, true);
    if (this.spacer) this.spacer.style.height = '15px';
    this.saveProgress();
  };
 
  Instance.prototype.transcript = function (format) {
    var out = this.convo.join('');
    return String(format) === '1' ? out : out.replace(/<[^>]*>/g, '');
  };
 
  Instance.prototype.doc = function () {
    return this.swapvar(this.docs.join(''));
  };
 
  Instance.prototype.json = function () {
    var obj = {}, self = this;
    this.result.questions.forEach(function (q) {
      if (q.gotoName !== null) return;
      obj[q.name] = self.vars.hasOwnProperty(q.name) ? self.vars[q.name] : '';
    });
    return obj;
  };
  Instance.prototype.json_str = function () { return JSON.stringify(this.json()); };
 
  Instance.prototype.submit2 = function (action, method, docAs, instructions, transcriptAs, jsonAs, target) {
    var form = this.form, d = root.document;
    form.action = action;
    form.method = method || 'POST';
    form.target = target || '_self';
    form.removeAttribute('onsubmit'); form.onsubmit = null;
    function add(name, value) {
      var ta = d.createElement('textarea');
      ta.style.display = 'none'; ta.name = name; ta.value = value;
      form.appendChild(ta);
    }
    if (docAs) {
      add(docAs, this.doc());
      if (instructions) add('i', instructions);
    }
    if (transcriptAs) add(transcriptAs, this.transcript());
    if (jsonAs) add(jsonAs, this.json_str());
    form.submit();
  };
 
  /* --- global helper functions (API compatible with the original) --- */
 
  function cur() {
    if (!QnA.current) throw new Error('QnA: no active QnA instance');
    return QnA.current;
  }
  QnA.transcript = function (format) { return cur().transcript(format); };
  QnA.doc = function () { return cur().doc(); };
  QnA.json_str = function () { return cur().json_str(); };
  QnA.mail2 = function (to, subject, body) {
    root.location.href = 'mailto:' + encodeURIComponent(to) + '?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(body);
  };
  QnA.save2 = function (filename, content) {
    // Works in every current browser, in iframes included (no FileSystem-API check like the original,
    // which only Chrome ever passed). If the download attribute is unsupported, the file opens in a
    // new tab instead so the user can save it from there.
    var blob = new Blob([String(content)], { type: 'text/plain;charset=utf-8' });
    var url = root.URL.createObjectURL(blob);
    var a = root.document.createElement('a');
    if ('download' in a) {
      a.download = filename;
      a.href = url;
      a.style.display = 'none';
      root.document.body.appendChild(a);
      a.click();
      setTimeout(function () { root.URL.revokeObjectURL(url); if (a.parentNode) a.parentNode.removeChild(a); }, 1000);
    } else {
      var w = root.open(url, '_blank');
      if (!w) root.location.href = url;
    }
  };
  QnA.submit2 = function (action, method, docAs, instructions, transcriptAs, jsonAs, target) {
    return cur().submit2(action, method, docAs, instructions, transcriptAs, jsonAs, target);
  };
  /**
   * Open the QnA's document (see doc()) in an editable overlay with
   * Print / Save / Copy buttons. A client-side stand-in for the original
   * server-side document parser pages. Usage: A[javascript:showdoc('Proof read your letter.');]:
   */
  QnA.showdoc = function (instructions, content) {
    var d = root.document;
    var html = content !== undefined ? content : cur().doc();
    var old = d.getElementById('qna-docview');
    if (old) old.parentNode.removeChild(old);
    var wrap = d.createElement('div');
    wrap.id = 'qna-docview';
    wrap.innerHTML =
      '<style>' +
      '#qna-docview{position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:99999;overflow:auto;padding:30px 10px;box-sizing:border-box;font-family:Verdana,Geneva,sans-serif;font-size:14px;}' +
      '#qna-docview .qna-docbox{background:#fff;max-width:820px;margin:0 auto;border-radius:6px;box-shadow:0 10px 40px rgba(0,0,0,.4);}' +
      '#qna-docview .qna-docbar{padding:10px 15px;border-bottom:1px solid #ddd;display:flex;gap:8px;flex-wrap:wrap;align-items:center;}' +
      '#qna-docview .qna-docbar button{font:inherit;padding:6px 12px;border:1px solid #888;border-radius:6px;background:#eee;cursor:pointer;}' +
      '#qna-docview .qna-docbar button:hover{background:#ddd;}' +
      '#qna-docview .qna-docbar .qna-spacer{flex:1;}' +
      '#qna-docview .qna-docinstr{background:#ddffdd;padding:12px 15px;}' +
      '#qna-docview .qna-doctext{padding:25px 30px;min-height:300px;outline:none;line-height:1.5;}' +
      '@media print{body>*:not(#qna-docview){display:none!important;}#qna-docview{position:static;background:none;padding:0;}#qna-docview .qna-docbox{box-shadow:none;max-width:none;}#qna-docview .qna-docbar,#qna-docview .qna-docinstr{display:none;}}' +
      '</style>' +
      '<div class="qna-docbox"><div class="qna-docbar">' +
      '<button type="button" data-act="print">Print</button>' +
      '<button type="button" data-act="save">Save as HTML</button>' +
      '<button type="button" data-act="copy">Copy text</button>' +
      '<span class="qna-spacer"></span>' +
      '<button type="button" data-act="close">Close</button></div>' +
      (instructions ? '<div class="qna-docinstr">' + instructions + '</div>' : '') +
      '<div class="qna-doctext" contenteditable="true"></div></div>';
    d.body.appendChild(wrap);
    var box = wrap.querySelector('.qna-doctext');
    box.innerHTML = html;
    wrap.addEventListener('click', function (e) {
      var act = e.target.getAttribute && e.target.getAttribute('data-act');
      if (!act && e.target === wrap) act = 'close';
      if (act === 'close') wrap.parentNode.removeChild(wrap);
      else if (act === 'print') root.print();
      else if (act === 'save') QnA.save2('QnA_document.html', '<!DOCTYPE html><html><head><meta charset="utf-8"><title>QnA document</title></head><body>' + box.innerHTML + '</body></html>');
      else if (act === 'copy') {
        var txt = box.innerText || box.textContent;
        if (root.navigator.clipboard) root.navigator.clipboard.writeText(txt);
      }
    });
    return wrap;
  };
  QnA.startAT = function (label) { return cur().start(label); };
  QnA.answerQ = function (label) { return cur().answer(label); };
  QnA.goback = function () { return cur().goBack(); };
  QnA.shoh = function (id) {
    var el = root.document.getElementById(id);
    if (el) el.style.display = el.style.display === 'none' ? 'block' : 'none';
  };
 
  // Expose the legacy globals so A[javascript:...] hrefs written for the
  // original implementation keep working.
  QnA.exposeGlobals = function (target) {
    target = target || root;
    ['transcript', 'doc', 'json_str', 'mail2', 'save2', 'submit2', 'showdoc', 'startAT', 'answerQ', 'goback', 'shoh'].forEach(function (n) {
      QnA[n]._qna = true;
      // Don't clobber a page's own function of the same name; do replace one
      // installed by an earlier QnA (e.g. after document.write).
      if (typeof target[n] === 'undefined' || (target[n] && target[n]._qna)) target[n] = QnA[n];
    });
  };
 
  /* ------------------------------------------------------------------ */
  /*  Rendering entry points                                             */
  /* ------------------------------------------------------------------ */
 
  /**
   * Render markup into `target` (element or selector).
   * Returns the Instance, or null (with errors rendered) if malformed.
   */
  QnA.render = function (target, markup, options) {
    var d = root.document;
    var el = typeof target === 'string' ? d.querySelector(target) : target;
    if (!el) throw new Error('QnA.render: target not found');
    var result = QnA.parse(markup);
    // a hidden Settings: tag styles the QnA; anything given explicitly overrides it
    var given = {}, gk;
    if (result.settings) for (gk in result.settings) given[gk] = result.settings[gk];
    if (options) for (gk in options) {
      if (Object.prototype.hasOwnProperty.call(options, gk) && options[gk] !== undefined && options[gk] !== null && options[gk] !== '') given[LEGACY_KEYS[gk] || gk] = options[gk];
    }
    var o = normalizeOptions(given);
    var styleKey = JSON.stringify(QnA.css(o));
    if (o.injectCss) {
      // The first QnA on a page gets the plain, unscoped stylesheet (so custom
      // CSS written for the original output still applies). Further QnAs with
      // different style options get a scoped override of their own.
      if (!QnA._styleKey || QnA._styleKey === styleKey || el.qnaStyleScope === 'global') {
        QnA.injectCss(o); QnA._styleKey = styleKey; el.qnaStyleScope = 'global';
        el.classList.remove.apply(el.classList, Array.prototype.filter.call(el.classList, function (c) { return /^qna-s\d+$/.test(c); }));
      } else {
        var scope = el.qnaStyleScope && el.qnaStyleScope !== 'global' ? el.qnaStyleScope : 'qna-s' + (++QnA._scopeSeq);
        el.qnaStyleScope = scope;
        el.classList.add(scope);
        QnA.injectCss(o, '.' + scope);
      }
    }
    QnA.exposeGlobals();
    if (!result.ok) {
      el.innerHTML = '<ul class="qna-error-list">' + QnA.errorsHtml(result) + '</ul>';
      el.qna = null;
      return null;
    }
    var inst = new Instance(el, result, o);
    el.qna = inst;   // (also set by the constructor, before any script in the markup runs)
    instances.push(inst);
    return inst;
  };
 
  function optionsFromDataset(el) {
    var o = {}, ds = el.dataset || {};
    for (var k in ds) {
      if (!Object.prototype.hasOwnProperty.call(ds, k)) continue;
      var key = LEGACY_KEYS[k] || k;
      var v = ds[k];
      if (v === 'true') v = true; else if (v === 'false') v = false;
      o[key] = v;
    }
    return o;
  }
 
  function sourceText(el) {
    // A script tag's contents are left untouched by the HTML parser; the one
    // sequence that cannot appear inside it (a closing script tag) may be written with a backslash before the slash.
    return el.textContent.replace(/<\\\/script/gi, '<' + '/script');
  }
 
  /**
   * Find every <script type="text/qna"> in `scope` and render it, into the
   * element named by its data-target (a selector) or into a new
   * <div class="qna"> inserted right after the script tag.
   */
  QnA.init = function (scope) {
    var d = root.document;
    scope = scope || d;
    var nodes = scope.querySelectorAll('script[type="text/qna"]');
    var out = [];
    for (var i = 0; i < nodes.length; i++) {
      var src = nodes[i];
      if (src.getAttribute('data-qna-done')) continue;
      src.setAttribute('data-qna-done', '1');
      var markup = sourceText(src);
      var opts = optionsFromDataset(src);
      var targetSel = src.getAttribute('data-target');
      var target = targetSel ? d.querySelector(targetSel) : null;
      if (!target) {
        target = d.createElement('div');
        target.className = 'qna';
        src.parentNode.insertBefore(target, src.nextSibling);
      }
      out.push(QnA.render(target, markup, opts));
    }
    return out;
  };
 
  QnA.instances = instances;
 
  if (root.document && root.document.addEventListener) {
    var thisScript = root.document.currentScript;
    var auto = function () {
      if (root.QNA_NO_AUTOINIT) return;
      if (thisScript && thisScript.getAttribute('data-auto') === 'false') return;
      QnA.init();
    };
    if (root.document.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', auto);
    else setTimeout(auto, 0);
  }
 
  return QnA;
});