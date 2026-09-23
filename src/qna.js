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
 
  var QnA = { version: '2.5.0' };
 
  /* ------------------------------------------------------------------ */
  /*  Defaults                                                           */
  /* ------------------------------------------------------------------ */
 
  QnA.defaults = {
    // (since 2.5.0 these three match the editor's Settings defaults in config.js; up to 2.4.0 they were Verdana 14/20)
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, sans-serif",
    fontSize: 16,
    lineHeight: 22,
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
    bodyTxt: '000000',      // text outside the bubbles (Before/After content, footer; not the credits box, which follows the buttons)
    bodyLink: '0000ff',     // links outside the bubbles
    // the buttons (answers, text-input box, GO BACK ONE / START OVER) and the rules that set them off
    btnBg: 'eeeeee',        // button background (the hover shade is worked out from it, see QnA.css)
    btnTxt: '000000',       // button text
    btnBold: false,         // button text in bold
    btnBorder: '888888',    // the outline of the buttons and of the text-input box (and the line between its field and its button)
    btnDivider: 'dddddd',   // the top border of standard_buttons and qna-footer, which act as dividers near the buttons
    chatStyle: 'sms',       // 'sms': questions and answers in speech bubbles; 'llm': questions as plain text on the body (see QnA.css)
    // the text of the built-in buttons and footer links (plain text, not HTML)
    labelSave: 'Save above text as answer.',
    labelBack: 'GO BACK ONE',
    labelRestart: 'START OVER',
    labelCredits: 'credits',
    labelEdit: 'edit',
    labelCode: 'code your own',
    labelEmpty: 'Your answer appears to be empty.',   // the alert when an X tag's field is submitted blank
    labelEditWarn: 'You are about to edit a copy of this QnA. Any edits will not change this instance.',   // the alert behind the footer's edit link
    // QnAs loaded into this one with loadQnA() (see Instance.prototype.loadQnA)
    qShare: true,           // an author-named variable means the same thing in every loaded QnA: a question whose answer is already known is not asked again
    labelEarlier: 'Earlier you entered:',   // put before the known answer when such a question is filled in
    labelConfirm: 'It looks like you may have answered this before; click OK to use <x>answer</x> as your answer.',   // asked when the known answer only roughly matches a button
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
    btn_bg: 'btnBg', btn_txt: 'btnTxt', btn_bold: 'btnBold', btn_border: 'btnBorder', btn_divider: 'btnDivider',
    label_save: 'labelSave', label_back: 'labelBack', label_restart: 'labelRestart',
    label_credits: 'labelCredits', label_edit: 'labelEdit', label_code: 'labelCode',
    q_share: 'qShare', label_earlier: 'labelEarlier', label_confirm: 'labelConfirm',
    label_empty: 'labelEmpty', label_edit_warn: 'labelEditWarn'
  };
  var LABEL_KEYS = ['labelSave', 'labelEmpty', 'labelBack', 'labelRestart', 'labelCredits', 'labelEdit', 'labelEditWarn', 'labelCode', 'labelEarlier', 'labelConfirm'];
 
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
    ['compBg', 'compTxt', 'compLink', 'usrBg', 'usrTxt', 'usrLink', 'bodyBg', 'bodyTxt', 'bodyLink', 'btnBg', 'btnTxt', 'btnBorder', 'btnDivider'].forEach(function (n) {
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
    ['btnBold', 'qShare', 'footer', 'saveProgress', 'animate', 'scroll', 'injectCss'].forEach(function (n) {
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
  var JS_TYPE = /^(module|(text|application)\/(x-)?(java|ecma|j)script(1\.\d)?)?$/i;   // script types the runtime runs
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
 
  function ErrorList() { this.items = []; this.warnings = []; this.line = null; }
  // `line` is the 1-based line of the tag being examined; callers set it before add()
  ErrorList.prototype.add = function (message, near) {
    this.items.push({ message: message, near: near, line: this.line });
  };
  // a warning does not make the markup ill-formed; the editor shows it above the outputs
  ErrorList.prototype.warn = function (message, near) {
    this.warnings.push({ message: message, near: near, line: this.line });
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
 
  /* --- what a script does, as far as it can be read from the code ---
   * The flowchart is drawn from the tags, but two of the predefined functions change where a
   * conversation goes: loadQnA() hands over to another QnA and goto() jumps. When their arguments are
   * written as plain string (or number) literals they can be shown; computed ones cannot.
   *   loads    the URL given to loadQnA(), or true when it is not a literal; null when there is no call
   *   returns  the `replace` targets of that call (names, resolved to labels by the parser)
   *   jumps    the literal targets of goto() calls (likewise resolved)
   */
  var LOAD_RE = /\bloadQnA\s*\(/;
  // a quoted string: group N the quote, N+1 the text
  function STR(n) { return "(['\"])((?:(?!\\" + n + ")[^\\\\]|\\\\.)*)\\" + n; }
  var LOAD_ARGS_RE = new RegExp('\\bloadQnA\\s*\\(\\s*(?:' + STR(1) + "|([^,()'\"]+?))" + '\\s*(?:,\\s*(?:' + STR(4) + '\\s*,\\s*' + STR(6) + '|(\\{[^}]*\\})))?\\s*[,)]');
  function scriptInfo(code) {
    var info = { loads: null, returns: [], jumps: [] };
    code = String(code || '');
    if (!code) return info;
    if (LOAD_RE.test(code)) {
      info.loads = true;
      var lm = LOAD_ARGS_RE.exec(code);
      if (lm) {
        if (lm[2] !== undefined) info.loads = lm[2];
        if (lm[7] !== undefined) info.returns.push(lm[7]);
        else if (lm[8]) {
          var pr = /(['"]?)([A-Za-z0-9._\-]+)\1\s*:\s*(['"])([A-Za-z0-9._\-]*)\3/g, pm;
          while ((pm = pr.exec(lm[8])) !== null) info.returns.push(pm[4]);
        }
      }
    }
    var gr = /\bgoto\s*\(\s*(?:(['"])([A-Za-z0-9._\-]*)\1|(\d+(?:\.\d+)*))\s*\)/g, gm;
    while ((gm = gr.exec(code)) !== null) info.jumps.push(gm[2] !== undefined ? gm[2] : gm[3]);
    return info;
  }
  // the JavaScript inside <script> tags of a question's text (the ones the runtime runs when it is shown)
  function inlineScripts(html) {
    var out = [], re = /<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi, m;
    while ((m = re.exec(String(html || ''))) !== null) {
      var type = (/\btype\s*=\s*["']?([^"'\s>]*)/i.exec(m[1]) || [])[1] || '';
      if (JS_TYPE.test(trim(type)) && !/\bsrc\s*=/i.test(m[1])) out.push(m[2]);
    }
    return out.join('\n');
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
    'usrBg', 'usrTxt', 'usrLink', 'bodyBg', 'bodyTxt', 'bodyLink', 'btnBg', 'btnTxt', 'btnBold', 'btnBorder', 'btnDivider', 'chatStyle', 'qShare'].concat(LABEL_KEYS, ['footer', 'saveProgress', 'start']);
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
   *   errors    {Array}     [{message (html), near (text), line}]
   *   warnings  {Array}     same shape; things worth telling the author that do not stop the QnA from running
   *   code      {string}    markup with computed ids (Q(1.1):) filled in
   *   header    {object}    {title, author, description, before, after}
   *   questions {Array}     [{label, name, text, doc, goto, display, jumps}]
   *   answers   {Array}     [{label, parent, text, href, target, value, isVar, script, inputType (X tags only), loads, returns, jumps}]
   *                         (loads / returns / jumps: what the answer's script does, see scriptInfo)
   *   names     {Array}     [[label, name], ...]  (QVnames in the original)
   *   settings  {object}    values from a trailing hidden Settings: tag, or null (the tag is not in code/markup)
   */
  // The form controls in a piece of HTML: [{tag, name, type, html}]. Buttons and file pickers are left out (a
  // button holds no answer; a file cannot be kept as text). Attribute parsing is deliberately simple: this is
  // for names, not for validating HTML.
  var FIELD_RE = /<(input|select|textarea)\b([^>]*)>/gi;
  function fieldsIn(html) {
    var out = [], m;
    FIELD_RE.lastIndex = 0;
    html = String(html).replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, '');
    while ((m = FIELD_RE.exec(html)) !== null) {
      var attrs = m[2], tag = m[1].toLowerCase();
      var attr = function (n) { var r = new RegExp('(?:^|\\s)' + n + '\\s*=\\s*(?:"([^"]*)"|\'([^\']*)\'|([^\\s"\'>]+))', 'i').exec(attrs); return r ? (r[1] !== undefined ? r[1] : r[2] !== undefined ? r[2] : r[3]) : ''; };
      var type = tag === 'input' ? (attr('type') || 'text').toLowerCase() : tag;
      if (/^(button|submit|reset|image|file)$/.test(type)) continue;
      out.push({ tag: tag, name: trim(attr('name')), type: type, html: m[0] });
    }
    return out;
  }
  QnA.fieldsIn = fieldsIn;

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
    var loadsAt = {};                // nesting level -> the last A/X there calls loadQnA()
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
        if (nested > 0 && loadsAt[nested - 1]) {
          errors.add('An answer that calls <code>loadQnA()</code> cannot have a Q beneath it: the loaded QnA takes its place. To bring the visitor back to a question in this QnA, use the <code>find</code> and <code>replace</code> arguments of <code>loadQnA()</code>. See <a href="https://www.qnamarkup.org/syntax/#loadQnA()" target="_blank">Documentation</a>.', nearText(value, body));
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
          doc: null,
          jumps: scriptInfo(inlineScripts(body)).jumps,   // literal goto() targets in the question's own scripts (resolved below)
          fields: [],                                      // names of the form fields written in the question's HTML (see fieldsIn, below)
          line: lineOf[i]
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
        var ai = scriptInfo(/^javascript:/i.test(a.href) ? a.href.replace(/^javascript:/i, '') : '');
        a.loads = ai.loads; a.returns = ai.returns; a.jumps = ai.jumps;
        loadsAt[nested] = ai.loads !== null;
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
        // The field is named by the parent Q's id, so nothing needs to follow the colon. One word is understood
        // there: `number` (X:number) makes the field a number input. Anything else is ignored, with a warning.
        var inputType = 'text';
        if (/^[ \t]+\[\s*javascript:/i.test(body)) {
          errors.add('To run JavaScript from an X tag, put the bracket right against the colon, with no space between them: <code>X:[javascript:…]</code> or <code>X[javascript:…]:</code>.', nearText(value, body));
        } else if (/^\s*number\s*$/i.test(body)) {
          inputType = 'number'; body = 'number';
        } else if (!/^\s*$/.test(body)) {
          body = body.replace(/\s/g, '');
          errors.warn('The text after this <code>X:</code> tag has no effect and will be ignored. The field is named by its question\'s id, the part in parentheses in <code>Q(<em>name</em>):</code>, so nothing needs to follow the colon. The one word that means something there is <code>number</code>: <code>X:number</code> makes the field accept only a number. See <a href="https://www.qnamarkup.org/syntax/#x" target="_blank">Documentation</a>.', nearText(value, body));
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
        var xi = scriptInfo(xscript);
        loadsAt[nested] = xi.loads !== null;
        answers.push({ label: xlabel, parent: xparent, text: '<variable>', href: "javascript:void('');", value: '', target: '', isVar: true, script: xscript, inputType: inputType, loads: xi.loads, returns: xi.returns, jumps: xi.jumps });
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
    var labelSet = {};
    names.forEach(function (p) { labelSet[p[0]] = true; });

    /* --- Form fields written in questions ------------------------------ */
    // A question's HTML may hold ordinary form controls (<input>, <select>, <textarea>). At run time a control
    // with a name becomes a variable of that name (see Instance.prototype.captureFields), so the parser lists
    // the names and warns about a control that has none (nothing it holds is kept) or one whose name is also a
    // question's id or name (the two would write the same variable).
    questions.forEach(function (q) {
      errors.line = q.line;
      fieldsIn(q.text).forEach(function (f) {
        if (!f.name) {
          errors.warn('A form field in this question has no <code>name</code> attribute, so nothing entered in it is saved: give it one (<code>&lt;' + f.tag + ' name="…"</code>) to make it a variable.', nearText('', f.html));
          return;
        }
        if (q.fields.indexOf(f.name) < 0) q.fields.push(f.name);
        if (byName.hasOwnProperty(f.name) || labelSet[f.name]) {
          errors.warn('The form field <code>' + escapeHtml(f.name) + '</code> has the same name as a question, so the two would share one variable and overwrite each other. Give the field another name.', nearText('', f.html));
        }
      });
    });
    errors.line = null;
    // a goto() / replace target written as a literal: a name, or an id; unknown ones are dropped
    var toLabel = function (t) { return byName.hasOwnProperty(t) ? byName[t] : (labelSet[t] ? t : null); };
    var toLabels = function (list) { return list.map(toLabel).filter(function (l) { return l !== null; }); };
    questions.forEach(function (q) {
      q.gotoName = q.goto;
      q.goto = q.goto === null ? null : (byName.hasOwnProperty(q.goto) ? byName[q.goto] : null);
      q.jumps = toLabels(q.jumps);
    });
    answers.forEach(function (a) { a.jumps = toLabels(a.jumps); a.returns = toLabels(a.returns); });
 
    return {
      ok: errors.items.length === 0,
      errors: errors.items,
      warnings: errors.warnings,
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
 
  // a colour `t` of the way from hex colour `a` to hex colour `b` (both six digits, no #)
  function mixHex(a, b, t) {
    var out = '';
    for (var i = 0; i < 6; i += 2) {
      var v = Math.round(parseInt(a.substr(i, 2), 16) * (1 - t) + parseInt(b.substr(i, 2), 16) * t);
      out += (v < 16 ? '0' : '') + v.toString(16);
    }
    return out;
  }

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
    // Buttons. The hover shade is the background moved 1/14 of the way to the text colour, which for the
    // default eeeeee / 000000 is the dddddd it has always been, and darkens a light button / lightens a dark one.
    var btnHover = mixHex(o.btnBg, o.btnTxt, 1 / 14);
    var btn = 'background:#' + o.btnBg + ';', btnTxt = 'color:#' + o.btnTxt + ';' + (o.btnBold ? 'font-weight:bold;' : '');
    var btnOver = 'background:#' + btnHover + ';';
    var creditLinks = o.btnTxt !== QnA.defaults.btnTxt;   // see div.credit_text below
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
      '' + S + 'div.standard_buttons{float:left;width:100%;margin-top:5px;border-top:1px solid #' + o.btnDivider + ';padding-top:12px;}',
      '' + S + 'div.credits{float:left;width:100%;' + btn + 'margin:0 0 15px 0;}',
      // the credits box is dressed like the buttons: their background and text colour (Button Body), but never their bold.
      // Its links keep the standard blue / purple while the button text is the default black; with any other
      // text colour they take it (still underlined), since standard link colours are only safe on a light box
      '' + S + 'div.credit_text{' + font + 'color:#' + o.btnTxt + ';padding:4px 15px 10px 15px;}',
      '' + S + 'div.credit_text a:link{color:#' + (creditLinks ? o.btnTxt : '0000ee') + ';}',
      '' + S + 'div.credit_text a:visited{color:#' + (creditLinks ? o.btnTxt : '551a8b') + ';}',
      '' + S + 'li.error{list-style-type:none;background:#ffdddd;margin:10px 0 0 0;padding:5px;}',
      '' + S + '.qpad{float:left;padding:0 ' + (lh * 0.75) + 'px;}',
      '' + S + 'a.sbutton{float:left;' + font + 'width:48%;' + btn + 'border-radius:8px;' + bpad + 'margin:0 0 3px 0;border:solid 1px #' + o.btnBorder + ';text-align:center;' + btnTxt + 'text-decoration:none;cursor:pointer;}',
      '' + S + 'a.sbutton:hover,' + S + 'a.sbutton:active{' + btnOver + '}',
      '' + S + 'a.qabutton{float:left;' + font + 'width:100%;' + btn + 'border-radius:8px;' + bpad + 'margin:0 0 8px 0;border:solid 1px #' + o.btnBorder + ';text-align:left;' + btnTxt + 'text-decoration:none;cursor:pointer;box-sizing:border-box;}',
      '' + S + 'a.qabutton:hover,' + S + 'a.qabutton:active{' + btnOver + '}',
      '' + S + 'div.xdiv{float:left;width:100%;margin:0 0 8px 0;' + btn + 'border:solid 1px #' + o.btnBorder + ';border-radius:8px;box-sizing:border-box;}',
      '' + S + 'input.xinput{box-sizing:border-box;float:left;width:100%;' + font + 'background:#fff;border-top-left-radius:8px;border-top-right-radius:8px;padding:' + (lh * 0.5) + 'px ' + (lh * 0.5) + 'px ' + (lh * 0.6) + 'px ' + (lh * 0.5) + 'px;border:solid 0 #' + o.btnBorder + ';border-bottom:solid 1px #' + o.btnBorder + ';text-align:left;color:#000;}',
      '' + S + 'a.xbutton{float:left;width:100%;text-align:left;' + font + '' + btn + 'border-radius:8px;' + bpad + '' + btnTxt + 'text-decoration:none;cursor:pointer;}',
      '' + S + 'a.xbutton:hover,' + S + 'a.xbutton:active{border-top-left-radius:0;border-top-right-radius:0;' + btnOver + '}',
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
      '' + S + '.qna-footer{float:left;width:100%;margin:15px 0 0 0;border-top:solid 1px #' + o.btnDivider + ';}',
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
    this.rebuildTables();
    this.history = [];      // [{label, value, jumps?, skip?}] answers chosen so far (jumps / skip: see goto())
    this.pre = { jumps: [] };   // goto() calls made before the first answer
    this.jumpQueue = [];
    this.presenting = false;
    this.scriptStep = null;
    this.checkpoint = null;
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
    var self = this, onField = function (ev) { self.onFieldChange(ev); };
    this.qanda.addEventListener('input', onField);
    this.qanda.addEventListener('change', onField);
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
      alert(self.options.labelEditWarn);
    });
  };
 
  /* --- units: the QnA itself and the QnAs loaded into it with loadQnA() ---
   * Every question and answer belongs to a unit. The host QnA is unit '' and keeps its labels; a loaded QnA
   * is unit 'L1', 'L2', … (numbered in the order loaded) and its labels are prefixed, 1.1 -> L1.1.1, so
   * nothing collides however many QnAs load each other. Machine-made names are prefixed the same way;
   * author-given names are kept when qShare is on (they mean the same thing in every unit) and prefixed
   * when it is off. A unit's own GOTO targets are already labels when it arrives, so they stay inside it.
   */
  function unitOf(label) { var m = /^(L\d+)\./.exec(String(label)); return m ? m[1] : ''; }
  var hasOwn = function (o, k) { return Object.prototype.hasOwnProperty.call(o, k); };
 
  Instance.prototype.rebuildTables = function () {
    this.byLabel = {}; this.byName = {}; this.answersByQ = {}; this.answerByLabel = {}; this.allQuestions = [];
    this.units = {}; this.loadCount = 0;
    this.addUnit({ id: '', prefix: '', url: null, result: this.result, redirect: null });
  };
 
  Instance.prototype.addUnit = function (unit) {
    var self = this, p = unit.prefix ? unit.prefix + '.' : '', share = this.options.qShare;
    unit.byName = {};
    this.units[unit.id] = unit;
    unit.result.questions.forEach(function (q0) {
      var q = {
        label: p + q0.label,
        name: (p && (isNumericLabel(q0.name) || !share)) ? p + q0.name : q0.name,
        text: q0.text, display: q0.display, doc: q0.doc, jumps: q0.jumps, fields: q0.fields || [],
        goto: q0.goto === null ? null : p + q0.goto, gotoName: q0.gotoName,
        unit: unit.id,
        redirect: null   // label of a host question that takes this one's place (loadQnA's find / replace)
      };
      self.byLabel[q.label] = q;
      if (!hasOwn(self.byName, q.name)) self.byName[q.name] = q;
      unit.byName[q0.name] = q;
      self.allQuestions.push(q);
    });
    unit.result.answers.forEach(function (a0) {
      var a = {};
      for (var k in a0) if (hasOwn(a0, k)) a[k] = a0[k];
      a.label = p + a0.label; a.parent = p + a0.parent; a.unit = unit.id;
      self.answerByLabel[a.label] = a;
      (self.answersByQ[a.parent] = self.answersByQ[a.parent] || []).push(a);
    });
    if (unit.redirect) {
      for (var find in unit.redirect) {
        if (!hasOwn(unit.redirect, find)) continue;
        var q = unit.byName[find] || self.byLabel[p + find];
        if (q) q.redirect = unit.redirect[find];
        else if (root.console) console.error('QnA: loadQnA(): the loaded QnA has no question "' + find + '" to replace.');
      }
    }
    return unit;
  };
 
  /** Parse `text` and add it as the next loaded unit. Throws when it does not parse. */
  Instance.prototype.installUnit = function (text, url, redirect) {
    var result = QnA.parse(text);
    if (!result.ok) throw new Error('the QnA has errors (' + String(result.errors[0].message).replace(/<[^>]*>/g, '') + ')');
    if (!result.questions.length) throw new Error('no questions found');
    var id = 'L' + (++this.loadCount);
    return this.addUnit({ id: id, prefix: id, url: url, result: result, redirect: redirect || null });
  };
 
  /** The unit whose script is running, if one is: an answer's (scriptStep) or a question's (presenting). */
  Instance.prototype.currentUnit = function () {
    if (this.scriptStep) return unitOf(this.scriptStep.label);
    if (this.presenting) return this.presentingUnit || '';
    return '';
  };
 
  /** A goto() / replace target as written (a name or an id) -> a label, looked up in `unit` first, then everywhere. */
  Instance.prototype.resolveLabel = function (target, unit) {
    var t = trim(target === undefined || target === null ? '' : target);
    if (unit && this.units[unit]) {
      if (hasOwn(this.units[unit].byName, t)) return this.units[unit].byName[t].label;
      if (hasOwn(this.byLabel, unit + '.' + t)) return unit + '.' + t;
    }
    if (hasOwn(this.byName, t)) return this.byName[t].label;
    return t;
  };
 
  /* --- prior answers ---
   * With qShare on, a question is not asked when its variable already holds a value set by a DIFFERENT
   * unit (a unit re-asking its own question, GOTO:number, still asks). An X takes the value as typed; an A
   * question takes the button whose value is the same, else the one whose value is the same once both are
   * reduced to letters, digits and emoji, after asking (confirm); no match, or two buttons alike, asks.
   */
  var NORM_RE = null;
  function normalizeValue(v) {
    var s = String(v === undefined || v === null ? '' : v).replace(/<[^>]*>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').toLowerCase();
    if (NORM_RE === null) {
      try { NORM_RE = new RegExp('[^\\p{L}\\p{N}\\p{Extended_Pictographic}\\p{Emoji_Modifier}\\u200d\\ufe0f]', 'gu'); } catch (e) { NORM_RE = /[^a-z0-9]/g; }
    }
    return s.replace(NORM_RE, '');
  }
  QnA.normalizeValue = normalizeValue;
 
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
    this.varUnit = {};      // variable name -> the unit that set it
    this.autoDone = {};     // question label -> filled in from a prior answer (so it is asked if reached again)
    this.pending = {};      // values of the form fields in the current (unanswered) exchange, kept with saved progress
    this.fieldSeen = {};    // every form-field variable name met so far (for json() and submit2())
    // (this.pendingFill, field values to put back once the current exchange is drawn, is set by GO BACK ONE / a restore right before replay)
    this.loading = false;
    this.current = null;
    this.qnum = 0;
    if (this.loadCount) this.rebuildTables();   // loaded units go; a replay puts back the ones in the history
  };
 
  Instance.prototype.setVar = function (name, value, unit) {
    this.vars[name] = value;
    this.varUnit[name] = unit || '';
    var list = this.varsEl.querySelectorAll('textarea');
    for (var i = 0; i < list.length; i++) if (list[i].name === name) { list[i].parentNode.removeChild(list[i]); }
    var ta = root.document.createElement('textarea');
    ta.id = name; ta.name = name; ta.setAttribute('data-var', name);
    ta.textContent = varText(value);
    this.varsEl.appendChild(ta);
  };
  // a variable's value as text: form fields with several values (a group of checkboxes, a multiple select) hold arrays
  function varText(v) { return Array.isArray(v) ? v.join(', ') : String(v); }
 
  /** <x>name</x> -> the variable's value. Text from a loaded QnA (`unit`) sees that QnA's own variables first. */
  Instance.prototype.swapvar = function (input, unit) {
    var out = String(input), name, p = unit ? unit + '.' : '';
    if (p) for (name in this.vars) {
      if (hasOwn(this.vars, name) && name.indexOf(p) === 0) out = out.replace(new RegExp('<x>' + escapeRe(name.slice(p.length)) + '<\\/x>', 'gi'), varText(this.vars[name]));
    }
    for (name in this.vars) {
      if (!hasOwn(this.vars, name)) continue;
      out = out.replace(new RegExp('<x>' + escapeRe(name) + '<\\/x>', 'gi'), varText(this.vars[name]));
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
 
  Instance.prototype.questionBubbles = function (text, unit) {
    // <br><br> splits a bubble in two; "<br> <br>" does not. Empty bubbles are skipped.
    var parts = text.split(/<br\s*\/?><br\s*\/?>/i);
    var html = '';
    for (var i = 0; i < parts.length; i++) {
      var p = this.swapvar(parts[i], unit);
      if (isBlank(p)) continue;
      html += "<div class='frame' data-exchange='" + this.qnum + "'><div class='full'><div class='question_text'>" + p + "</div></div><div class='question_arrow'></div></div>";
      this.convo.push('BOT: ' + dropCode(p) + '\n');
    }
    this.appendHtml(html);
  };
 
  Instance.prototype.answerBubble = function (html) {
    html = html.replace(/(<br\s*\/?>){2}/gi, '<br> <br>');
    this.appendHtml("<div class='frame'><div class='full'><div class='ans_text'>" + html + "</div></div><div class='ans_arrow'></div></div>");
  };
 
  /* --- form fields written in questions ---------------------------------
   * A question's HTML may hold ordinary controls (<input>, <select>, <textarea>). One with a name is a variable
   * of that name: its value is read when the bubble is drawn and whenever it changes (so it is in saved progress
   * before the question is answered), then fixed on the answer's history entry and the controls disabled.
   * GO BACK ONE re-enables them with their values; a restore puts the unanswered values back too. A control
   * that fails its own validation (required, min, pattern, …) stops the answer with the browser's message.
   */
  function isField(el) {
    if (!el || !el.name) return false;
    if (el.tagName === 'INPUT') return !/^(button|submit|reset|image|file)$/i.test(el.type);
    return el.tagName === 'SELECT' || el.tagName === 'TEXTAREA';
  }
  /** The named controls in the bubbles of exchange `n` (the nth question shown; the current one is this.qnum - 1). */
  Instance.prototype.exchangeControls = function (n) {
    var sel = ['input', 'select', 'textarea'].map(function (t) { return ".frame[data-exchange='" + n + "'] " + t + '[name]'; }).join(',');
    return Array.prototype.filter.call(this.qanda.querySelectorAll(sel), isField);
  };
  // {name: value}: text for one control, an array for a group of checkboxes or a multiple select; < > escaped as for X answers
  function fieldValues(controls) {
    var groups = {}, order = [], out = {};
    var clean = function (v) { return String(v).replace(/</g, '&lt;').replace(/>/g, '&gt;'); };
    controls.forEach(function (c) { if (!groups[c.name]) { groups[c.name] = []; order.push(c.name); } groups[c.name].push(c); });
    order.forEach(function (name) {
      var g = groups[name], c = g[0];
      if (c.tagName === 'INPUT' && c.type === 'checkbox') {
        var on = g.filter(function (x) { return x.checked; }).map(function (x) { return clean(x.value); });
        out[name] = g.length > 1 ? on : (on.length ? on[0] : '');
      } else if (c.tagName === 'INPUT' && c.type === 'radio') {
        var r = g.filter(function (x) { return x.checked; });
        out[name] = r.length ? clean(r[0].value) : '';
      } else if (c.tagName === 'SELECT' && c.multiple) {
        out[name] = Array.prototype.filter.call(c.options, function (o) { return o.selected; }).map(function (o) { return clean(o.value); });
      } else out[name] = clean(g[g.length - 1].value);
    });
    return out;
  }
  // the reverse: put saved values back into the controls
  function fillFields(controls, values) {
    var raw = function (v) { return String(v).replace(/&lt;/g, '<').replace(/&gt;/g, '>'); };
    controls.forEach(function (c) {
      if (!hasOwn(values, c.name)) return;
      var v = values[c.name], list = Array.isArray(v) ? v.map(raw) : [raw(v)];
      if (c.tagName === 'INPUT' && (c.type === 'checkbox' || c.type === 'radio')) c.checked = list.indexOf(c.value) >= 0;
      else if (c.tagName === 'SELECT' && c.multiple) Array.prototype.forEach.call(c.options, function (o) { o.selected = list.indexOf(o.value) >= 0; });
      else c.value = list.length ? list[list.length - 1] : '';
    });
  }
  function fieldsNote(values) {
    return Object.keys(values).map(function (k) { return k + '=' + varText(values[k]); }).join('; ');
  }
  /** Read exchange `n`'s fields into this.pending and the variables. */
  Instance.prototype.captureFields = function (n) {
    var controls = this.exchangeControls(n);
    if (!controls.length) { this.pending = {}; return null; }
    var vals = fieldValues(controls), q = this.current !== null ? this.byLabel[this.current] : null, self = this;
    Object.keys(vals).forEach(function (name) { self.setVar(name, vals[name], q ? q.unit : ''); self.fieldSeen[name] = true; });
    this.pending = vals;
    return vals;
  };
  /** Disable every control in exchange `n` (named or not): an answered question is not edited in place; GO BACK ONE reopens it. */
  Instance.prototype.freezeFields = function (n) {
    var sel = ".frame[data-exchange='" + n + "'] input,.frame[data-exchange='" + n + "'] select,.frame[data-exchange='" + n + "'] textarea";
    Array.prototype.forEach.call(this.qanda.querySelectorAll(sel), function (c) { c.disabled = true; c.setAttribute('data-qna-frozen', '1'); });
  };
  /** A change in the current exchange's fields: keep the variables and saved progress up to date. */
  Instance.prototype.onFieldChange = function (ev) {
    var t = ev.target;
    if (!isField(t) || t.disabled) return;
    var f = t.closest ? t.closest('.frame[data-exchange]') : null;
    if (!f || f.getAttribute('data-exchange') !== String(this.qnum - 1)) return;
    this.captureFields(this.qnum - 1);
    this.saveProgress();
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
      if (q.redirect !== null) { label = q.redirect; continue; }   // loadQnA(url, find, replace): the host's question takes over here
      if (q.doc !== null) this.docs.push({ text: q.doc, unit: q.unit });
      this.presentingUnit = q.unit;
      if (q.goto !== null) {
        if (!isBlank(q.display)) this.questionBubbles(q.display, q.unit);
        label = q.goto;
        continue;
      }
      if (q.goto === null && q.gotoName !== null) {   // unresolved GOTO (shouldn't happen when well formed)
        if (!isBlank(q.display)) this.questionBubbles(q.display, q.unit);
        return null;
      }
      if (!isBlank(q.display)) this.questionBubbles(q.display, q.unit);
      var prior = this.priorAnswer(q);
      if (prior) { label = prior.next; continue; }
      return label;
    }
    return null;
  };

  /**
   * Fill in question `q` from a prior answer when there is one (see "prior answers" above). The answer is
   * recorded in the history as an ordinary exchange flagged `auto`, drawn with the Prior Answers text, and
   * its own [javascript:…] runs as it would after a click. Returns {next: label to continue with} or null.
   */
  Instance.prototype.priorAnswer = function (q) {
    if (this.replaying || !this.options.qShare || this.autoDone[q.label]) return null;
    if (!hasOwn(this.vars, q.name) || this.varUnit[q.name] === q.unit) return null;
    var known = this.vars[q.name], list = this.answersByQ[q.label] || [], pick = null, i;
    var knownRaw = String(known).replace(/&lt;/g, '<').replace(/&gt;/g, '>');
    for (i = 0; i < list.length && !pick; i++) if (!list[i].isVar && (list[i].value === known || list[i].value === knownRaw)) pick = list[i];
    for (i = 0; i < list.length && !pick; i++) if (list[i].isVar) pick = list[i];
    if (!pick) {
      var key = normalizeValue(known), alike = [];
      for (i = 0; i < list.length; i++) if (!list[i].isVar && normalizeValue(list[i].value) === key) alike.push(list[i]);
      if (key !== '' && alike.length === 1) {
        var shown = trim(String(alike[0].text).replace(/<[^>]*>/g, ''));
        if (root.confirm(this.options.labelConfirm.replace(/<x>answer<\/x>/gi, shown))) pick = alike[0];
      }
    }
    if (!pick) return null;
    var entry = { label: pick.label, value: pick.isVar ? known : null, auto: true };
    this.history.push(entry);
    this.applyAnswer(entry);
    var next = pick.label;
    var script = pick.isVar ? pick.script : (/^javascript:/i.test(pick.href) && pick.href !== "javascript:void('');" ? pick.href.replace(/^javascript:/i, '') : '');
    if (script) {
      // a goto() (or loadQnA()) in the script takes the place of the answer's own next question, as after a click
      var was = this.jumpQueue.length;
      this.scriptStep = entry;
      try { (0, eval)(script); } catch (err) { if (root.console) console.error('QnA: error in answer script:', err); }
      this.scriptStep = null;
      if (this.jumpQueue.length > was) { entry.skip = true; next = this.jumpQueue.splice(was, 1)[0]; }
      else if (entry.skip) next = null;
    }
    this.saveProgress();
    return { next: next };
  };
 
  Instance.prototype.renderChoices = function () {
    var self = this, html = '', xId = null;
    var list = this.current !== null ? (this.answersByQ[this.current] || []) : [];
    list.forEach(function (a) {
      if (a.isVar) {
        xId = 'Xi-' + a.label;
        // an X tag's [javascript:…] goes on both the field (Enter) and the button
        var xs = a.script ? ' data-script="' + escapeHtml(a.script) + '"' : '';
        var xt = a.inputType === 'number' ? 'number" step="any" inputmode="decimal' : 'text';
        html += '<div class="xdiv"><input type="' + xt + '" id="' + xId + '" name="' + xId + '" class="xinput" data-answer="' + a.label + '"' + xs + ' autocomplete="off"/>' +
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
          if (!s) return;
          // while the script runs, a goto() in it takes the place of the answer's own next question
          self.scriptStep = self.history[self.history.length - 1];
          try { (0, eval)(s); } catch (err) { if (root.console) console.error('QnA: error in answer script:', err); }
          self.scriptStep = null;
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
 
  /**
   * `label` is the question to show, or (on replay) a list: the question followed by the goto() jumps
   * recorded after it. A goto() called while the question is being drawn (a script in the Q itself) is
   * queued and followed here, once the question and any GOTO: chain of its own are on screen.
   */
  Instance.prototype.presentQuestion = function (label, animate) {
    var anchor = null;
    if (this.qnum > 0) {
      var nodes = this.appendHtml('<div class="qna-jump">&nbsp;</div>');
      anchor = nodes[0];
    }
    var list = [].concat(label), cur = null, guard = 0;
    this.presenting = true;
    this.jumpQueue = [];
    for (var i = 0; i < list.length; i++) {
      if (list[i] && typeof list[i] === 'object') {   // a recorded loadQnA(): put the unit back and show its first question
        var u = this.installUnit(list[i].text, list[i].url, list[i].redirect);
        cur = this.showQuestion(u.prefix + '.1');
      } else cur = this.showQuestion(String(list[i]));
    }
    while (this.jumpQueue.length && guard++ < 500) cur = this.showQuestion(this.jumpQueue.shift());
    this.jumpQueue = [];
    this.presenting = false;
    if (this.pendingLoad) { var pl = this.pendingLoad; this.pendingLoad = null; setTimeout(pl, 0); }
    this.current = cur;
    this.renderChoices();
    this.captureFields(this.qnum);   // the fields' starting values (a checked box, a value="…") count until changed
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
    if (entry.auto) {
      // filled in from a prior answer: the variable keeps the value (and the unit) it already has
      shown = escapeHtml(this.options.labelEarlier) + ' ' + shown;
      this.autoDone[a.parent] = true;
    } else this.setVar(name, value, a.unit);
    // the form fields of the exchange being answered: their values go with the entry, and the controls are frozen
    // (an auto answer is applied while its exchange is still being drawn, so that exchange is this.qnum)
    var ex = entry.auto ? this.qnum : this.qnum - 1, self = this, note = '';
    if (entry.fields) {
      fillFields(this.exchangeControls(ex), entry.fields);
      Object.keys(entry.fields).forEach(function (k) { self.setVar(k, entry.fields[k], a.unit); self.fieldSeen[k] = true; });
      note = ' (' + fieldsNote(entry.fields) + ')';
    }
    this.freezeFields(ex);
    this.pending = {};
    this.answerBubble(shown);
    this.convo.push('USER: ' + dropCode(shown) + note + '\n');
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
      var pend = Object.keys(this.pending || {}).length ? this.pending : null;   // fields typed into a question not yet answered
      if (this.history.length || pend) root.localStorage.setItem(this.progressKey(), JSON.stringify({ history: this.history, pre: this.pre.jumps, pending: pend || undefined, ts: Date.now() }));
      else root.localStorage.removeItem(this.progressKey());
    } catch (e) {}
  };
  Instance.prototype.loadProgress = function () {
    if (!this.options.saveProgress) return null;
    try {
      var raw = root.localStorage.getItem(this.progressKey());
      var data = raw ? JSON.parse(raw) : null;
      if (data && Array.isArray(data.history) && (data.history.length || (data.pending && Object.keys(data.pending).length))) return data;
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
    this.pre = { jumps: [] };
    this.checkpoint = null;
    this.reset();
    if (this.spacer) this.spacer.style.height = '0px';
    var saved = resume === false ? null : this.loadProgress();
    if (saved) {
      var self = this;
      var isJump = function (t) { return typeof t === 'string' || (t && typeof t === 'object' && typeof t.url === 'string' && typeof t.text === 'string'); };
      var isJumps = function (j) { return j === undefined || (Array.isArray(j) && j.every(isJump)); };
      // answers in loaded QnAs (labels L1.…) are checked as the replay puts their units back
      var valid = saved.history.every(function (e) { return e && typeof e.label === 'string' && (unitOf(e.label) || self.answerByLabel[e.label]) && isJumps(e.jumps); }) && isJumps(saved.pre);
      if (valid) {
        this.history = saved.history; this.pre = { jumps: saved.pre || [] };
        this.pendingFill = saved.pending && typeof saved.pending === 'object' ? saved.pending : null;
        try { this.replay(this.options.animate); return; }
        catch (e) {
          if (root.console) console.error('QnA: saved progress could not be restored:', e);
          this.history = []; this.pre = { jumps: [] }; this.replaying = false; this.pendingFill = null; this.reset();
        }
      }
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
        alert(this.options.labelEmpty);
        if (input) input.focus();
        return false;
      }
      entry.value = v.replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }
    // the exchange's form fields: the browser's own checks first (required, min/max, pattern, type), then the values
    var controls = this.exchangeControls(this.qnum - 1);
    for (var ci = 0; ci < controls.length; ci++) {
      var c = controls[ci];
      if (!c.disabled && c.checkValidity && !c.checkValidity()) {
        if (c.reportValidity) c.reportValidity(); else alert(c.validationMessage || this.options.labelEmpty);
        return false;
      }
    }
    if (controls.length) {
      var fields = this.captureFields(this.qnum - 1);
      if (fields && Object.keys(fields).length) entry.fields = fields;
    }
    this.history.push(entry);
    this.applyAnswer(entry);
    this.saveProgress();
    this.choices.innerHTML = '';
    // where the conversation stood before the answer's own next question was drawn: a goto() in the
    // answer's script rolls back to here and shows its target instead
    this.checkpoint = { entry: entry, convo: this.convo.length, docs: this.docs.length, qnum: this.qnum, last: this.qanda.lastChild };
    if (this.options.animate) this.presentSoon(label, 300);
    else this.presentQuestion(label, false);
    return true;
  };

  /** What a history entry puts on screen: the answer's own next question (unless a goto() replaced it), then its jumps. */
  function stepLabels(entry) {
    return (entry.skip ? [] : [entry.label]).concat(entry.jumps || []);
  }

  /** Finish, at once, a question still waiting behind the typing indicator. */
  Instance.prototype.flushPending = function () {
    if (this.timer) { clearTimeout(this.timer); this.timer = null; }
    this.pendingToken++;
    this.hideTyping();
    this.pendingWrap = null;
    var wraps = this.qanda.querySelectorAll('.qna-pending');
    for (var i = 0; i < wraps.length; i++) {
      var w = wraps[i], b = w.querySelector('.qna-pending-body');
      while (b && b.firstChild) w.parentNode.insertBefore(b.firstChild, w);
      w.parentNode.removeChild(w);
    }
    this.choices.style.display = '';
  };

  /**
   * Jump to question `target` (a Q's name or id), as a GOTO: at the end of a Q tag does. This is the
   * predefined goto() function, for driving a QnA from JavaScript.
   *  - Called from an answer's script (A[javascript:…] or X[javascript:…]), the target takes the place of
   *    the question that would otherwise follow that answer.
   *  - Called from a script inside a Q, the jump is made once that question is on screen, as if its text
   *    ended in GOTO:target.
   *  - Called at any other time (a timer, a fetch that has returned, the page around the QnA), the target
   *    is added after the question now showing.
   * Each jump is recorded with the answer it followed, so GO BACK ONE and saved progress redraw the
   * conversation with the jumps that were actually made, without running any script again. While the
   * conversation is being redrawn (this.replaying) goto() does nothing, for the same reason.
   * Returns true when the jump was made (or queued).
   */
  Instance.prototype.goto = function (target) {
    QnA.current = this;
    if (this.replaying) return false;
    var label = this.resolveLabel(target, this.currentUnit());
    if (!this.byLabel[label] && root.console) console.error('QnA: goto(' + JSON.stringify(String(target)) + '): there is no such question.');
    var step = this.history.length ? this.history[this.history.length - 1] : this.pre;
    if (this.presenting) {
      (step.jumps = step.jumps || []).push(label);
      this.jumpQueue.push(label);
      this.saveProgress();
      return true;
    }
    this.claimSlot(step);
    (step.jumps = step.jumps || []).push(label);
    this.saveProgress();
    if (this.options.animate) this.presentSoon(label, 300);
    else this.presentQuestion(label, false);
    return true;
  };

  /**
   * Make room for a jump or a load. From an answer's script (the answer is `step`): the answer's own next
   * question, drawn when the answer was taken, is undone and `step` marked skip. At any other time a
   * question still behind the typing indicator is shown at once, and the target will follow it.
   */
  Instance.prototype.claimSlot = function (step) {
    var cp = this.checkpoint;
    if (this.scriptStep && this.scriptStep === step && cp && cp.entry === step) {
      // undo the answer's own next question (drawn, perhaps still hidden, when the answer was taken)
      if (this.timer) { clearTimeout(this.timer); this.timer = null; }
      this.pendingToken++;
      this.typingEl = null;
      this.pendingWrap = null;
      while (this.qanda.lastChild && this.qanda.lastChild !== cp.last) this.qanda.removeChild(this.qanda.lastChild);
      this.convo.length = cp.convo;
      this.docs.length = cp.docs;
      this.qnum = cp.qnum;
      this.choices.innerHTML = '';
      this.choices.style.display = '';
      step.skip = true;
      step.jumps = [];
    } else {
      this.flushPending();
    }
  };

  /** The value saved for variable `name` (a Q's name or id), or undefined if that question has not been answered. */
  Instance.prototype.getvar = function (name) {
    name = trim(name === undefined || name === null ? '' : name);
    var unit = this.currentUnit();
    if (unit && hasOwn(this.vars, unit + '.' + name)) return this.vars[unit + '.' + name];
    return hasOwn(this.vars, name) ? this.vars[name] : undefined;
  };

  /* --- loadQnA() ---
   * Bring another QnA into this conversation. `url` is a raw markup file, an HTML page holding a
   * <script type="text/qna">, or an editor / viewer link (#z=…, ?markup=…, ?source=…). Called from an
   * answer's script, the loaded QnA's first question takes the place of the question that would have
   * followed the answer (the parser refuses a Q nested under such an answer). The loaded QnA's header
   * (Title, Before, After, …) and Settings are ignored. `find` / `replace`: the loaded question named
   * `find` is replaced by this QnA's question `replace` (any arrival there continues here); `find` may
   * also be an object of several such pairs. Recorded, with the text fetched, on the answer's history
   * entry, so GO BACK ONE and saved progress restore the same conversation without fetching again.
   * Returns a promise of the new unit's prefix, or null when the call could not be made.
   */
  Instance.prototype.loadQnA = function (url, find, replace) {
    QnA.current = this;
    if (this.replaying || this.loading) return null;
    var self = this, unit = this.currentUnit();
    var base = (this.units[unit] && this.units[unit].url) || root.document.baseURI || root.location.href;
    var abs; try { abs = new root.URL(String(url), base).href; } catch (e) { abs = String(url); }
    var redirect = {}, k;
    if (find && typeof find === 'object') { for (k in find) if (hasOwn(find, k)) redirect[k] = this.resolveLabel(find[k], unit); }
    else if (find !== undefined && find !== null && String(find) !== '') redirect[String(find)] = this.resolveLabel(replace, unit);
    for (k in redirect) if (!this.byLabel[redirect[k]] && root.console) console.error('QnA: loadQnA(): there is no question "' + k + '" to go to.');
    if (this.presenting) {
      // from a script inside a question, or an answer filled in for the visitor: once that is on screen
      if (this.scriptStep) this.scriptStep.skip = true;
      var args = [url, find, replace];
      this.pendingLoad = function () { self.loadQnA.apply(self, args); };
      return null;
    }
    var step = this.history.length ? this.history[this.history.length - 1] : this.pre;
    this.claimSlot(step);
    this.loading = true;
    var d = root.document, typing = d.createElement('div');
    typing.className = 'frame qna-typing';
    typing.innerHTML = "<div class='full'><div class='question_text'><span class='qna-dots'><i></i><i></i><i></i></span></div></div><div class='question_arrow'></div>";
    this.qanda.appendChild(typing);
    this.typingEl = typing;
    this.choices.innerHTML = '';
    var token = ++this.pendingToken;
    return QnA.fetchMarkup(abs).then(function (text) {
      if (token !== self.pendingToken) return null;
      self.loading = false;
      self.hideTyping();
      var u = self.installUnit(text, abs, redirect);
      (step.jumps = step.jumps || []).push({ url: abs, text: text, redirect: redirect });
      self.saveProgress();
      if (self.options.animate) self.presentSoon(u.prefix + '.1', 300);
      else self.presentQuestion(u.prefix + '.1', false);
      return u.prefix;
    }).catch(function (e) {
      if (token !== self.pendingToken) return null;
      self.loading = false;
      self.hideTyping();
      if (root.console) console.error('QnA: loadQnA(' + JSON.stringify(abs) + ') failed:', e);
      self.appendHtml("<div class='frame'><div class='full'><div class='question_text'>[QnA: could not load " + escapeHtml(abs) + ': ' + escapeHtml(e && e.message ? e.message : e) + "]</div></div><div class='question_arrow'></div></div>");
      self.current = null;
      self.renderChoices();
      self.revealScroll(true);
      return null;
    });
  };

  /**
   * The markup behind `url`: a raw markup file; an HTML page with a <script type="text/qna"> (the first);
   * a viewer / editor link, ?source= followed, #z= / #j= / ?markup= decoded here without a request.
   */
  QnA.fetchMarkup = function (url) {
    var u;
    try { u = new root.URL(String(url), root.location.href); } catch (e) { return Promise.reject(new Error('not a valid URL')); }
    var hash = u.hash.replace(/^#/, ''), q = u.searchParams;
    if (q.has('source')) return QnA.fetchMarkup(new root.URL(q.get('source'), u.href).href);
    if (/^(z|j|markup)=/.test(hash)) return QnA.decodeHash(hash).then(function (p) { return p.markup; });
    if (q.has('markup') || q.has('m') || q.has('q')) return QnA.decodeHash(u.search).then(function (p) { return p.markup; });
    return root.fetch(u.href).then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.text(); }).then(function (text) {
      var m = /<script\b[^>]*\btype\s*=\s*["']?text\/qna["']?[^>]*>([\s\S]*?)<\/script\s*>/i.exec(text);
      if (m) return m[1].replace(/<\\\/script/gi, '<' + '/script');
      if (/^\s*(<!doctype\s+html|<html)/i.test(text)) throw new Error('the page has no <script type="text/qna">');
      return text;
    });
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
    // text to put back in an X field (GO BACK ONE) belongs to the last question drawn, not the first
    var prefill = this.prefill;
    this.prefill = hist.length ? null : prefill;
    this.presentQuestion([String(this.options.start)].concat(this.pre.jumps), false);
    for (var i = 0; i < hist.length; i++) {
      if (!this.answerByLabel[hist[i].label]) throw new Error('no answer ' + hist[i].label);
      this.applyAnswer(hist[i]);
      if (i === hist.length - 1) this.prefill = prefill;
      this.presentQuestion(stepLabels(hist[i]), false);
    }
    if (this.pendingFill) {   // what was in the current exchange's fields (GO BACK ONE: the popped answer's; a restore: the unanswered ones)
      fillFields(this.exchangeControls(this.qnum - 1), this.pendingFill);
      this.pendingFill = null;
      this.captureFields(this.qnum - 1);
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
    this.pendingFill = popped.fields || null;   // the exchange's form fields come back editable, as they were
    // Remove the last exchange in place with no scrolling of our own. The
    // spacer drops to 15px so the remaining conversation fills the view
    // rather than leaving an empty screen where the removed exchange was.
    this.checkpoint = null;
    this.replay(false, true);
    if (this.spacer) this.spacer.style.height = '15px';
    this.saveProgress();
  };
 
  Instance.prototype.transcript = function (format) {
    var out = this.convo.join('');
    return String(format) === '1' ? out : out.replace(/<[^>]*>/g, '');
  };
 
  Instance.prototype.doc = function () {
    var self = this;
    return this.docs.map(function (d) { return self.swapvar(d.text, d.unit); }).join('');
  };
 
  Instance.prototype.json = function () {
    var obj = {}, self = this;
    var put = function (name) { obj[name] = self.vars.hasOwnProperty(name) ? self.vars[name] : ''; };
    this.allQuestions.forEach(function (q) {
      if (q.gotoName !== null) return;
      put(q.name);
    });
    // form fields written in questions: those the parser saw, and any met at run time (a script may add controls)
    this.allQuestions.forEach(function (q) { (q.fields || []).forEach(function (f) { if (!hasOwn(obj, f)) put(f); }); });
    Object.keys(this.fieldSeen).forEach(function (f) { if (!hasOwn(obj, f)) put(f); });
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
    // Every variable, form fields included, travels in the hidden .qna-vars textareas (arrays joined with ", ";
    // `jsonAs` carries them as arrays). The fields of an unanswered question are read once more, and their live
    // controls are held out of the post so each name is sent once.
    if (this.qnum) this.captureFields(this.qnum - 1);
    var live = this.exchangeControls(this.qnum - 1).filter(function (c) { return !c.disabled; });
    live.forEach(function (c) { c.disabled = true; });
    try { form.submit(); } finally { live.forEach(function (c) { c.disabled = false; }); }
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
  QnA.goto = function (target) { return cur().goto(target); };
  QnA.getvar = function (name) { return cur().getvar(name); };
  QnA.loadQnA = function (url, find, replace) { return cur().loadQnA(url, find, replace); };
  QnA.shoh = function (id) {
    var el = root.document.getElementById(id);
    if (el) el.style.display = el.style.display === 'none' ? 'block' : 'none';
  };
 
  // Expose the legacy globals so A[javascript:...] hrefs written for the
  // original implementation keep working.
  QnA.exposeGlobals = function (target) {
    target = target || root;
    ['transcript', 'doc', 'json_str', 'mail2', 'save2', 'submit2', 'showdoc', 'startAT', 'answerQ', 'goback', 'goto', 'getvar', 'loadQnA', 'shoh'].forEach(function (n) {
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