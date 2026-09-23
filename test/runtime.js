// Headless-browser tests for the runtime. Usage: node test/runtime.js
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const lib = fs.readFileSync(path.join(__dirname, '..', 'src', 'qna.js'), 'utf8');
const fx = n => fs.readFileSync(path.join(__dirname, /^(goto|load)_/.test(n) ? 'fixtures_runtime' : 'fixtures', n), 'utf8');
const tpl = n => fs.readFileSync(path.join(__dirname, 'oracle', 'templates', n), 'utf8');

function page(markup, attrs = '') {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body>
<script>${lib}</script>
<script type="text/qna" ${attrs}>${markup.replace(/<\/script/gi, '<\\/script')}</script>
</body></html>`;
}

let failed = 0;
function check(name, cond, info) {
  if (cond) console.log('PASS ' + name);
  else { failed++; console.log('FAIL ' + name + (info !== undefined ? ' -> ' + JSON.stringify(info) : '')); }
}

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext();
  const p = await ctx.newPage();
  const errors = [];
  p.on('pageerror', e => errors.push(String(e)));
  p.on('dialog', async d => { dialogs.push(d.message()); if (d.type() === 'confirm' && confirmOk) await d.accept(); else await d.dismiss(); });
  let dialogs = [], confirmOk = false;

  const bubbles = () => p.$$eval('#QandA .question_text, #QandA .ans_text', els => els.map(e => { const c = e.cloneNode(true); c.querySelectorAll('script,style').forEach(s => s.remove()); return (e.className.includes('ans') ? 'U:' : 'B:') + c.textContent.trim(); }));
  const buttons = () => p.$$eval('#Choices a.qabutton', els => els.map(e => e.textContent.trim()));
  const clickAnswer = async (text) => {
    const el = (await p.$$('#Choices a.qabutton')).filter(async () => true);
    for (const b of await p.$$('#Choices a.qabutton')) {
      if ((await b.textContent()).trim() === text) { await b.click(); await p.waitForTimeout(400); return; }
    }
    throw new Error('no button ' + text);
  };

  /* ---- drink: variables + GOTO ---- */
  await p.setContent(page(fx('drink.txt')));
  await p.waitForSelector('#QandA .question_text');
  check('drink: first question shown', (await bubbles())[0] === 'B:Coffee or tea?', await bubbles());
  check('drink: two buttons', JSON.stringify(await buttons()) === '["coffee","tea"]', await buttons());
  await clickAnswer('tea');
  check('drink: GOTO followed to extras', (await bubbles()).slice(-1)[0] === 'B:Milk and sugar?', await bubbles());
  await clickAnswer('Milk only.');
  check('drink: <x> substitution', (await bubbles()).slice(-1)[0] === 'B:Got it. You like tea with milk.', await bubbles());
  check('drink: no further buttons, has back/restart', (await buttons()).length === 0 && await p.$('#Choices .qna-back') !== null);
  const t = await p.evaluate(() => transcript());
  check('drink: transcript()', t === 'BOT: Coffee or tea?\nUSER: tea\nBOT: Milk and sugar?\nUSER: Milk only.\nBOT: Got it. You like tea with milk.\n', t);
  const j = await p.evaluate(() => json_str());
  check('drink: json_str()', j === '{"drink":"tea","extras":"milk","gotit":""}', j);
  check('drink: variable readable via getElementById', await p.evaluate(() => document.getElementById('extras').innerHTML) === 'milk');
  // go back one
  await p.click('#Choices .qna-back'); await p.waitForTimeout(100);
  check('drink: go back re-shows extras question', (await bubbles()).slice(-1)[0] === 'B:Milk and sugar?' && (await buttons()).length === 4, await bubbles());
  check('drink: json after go back', await p.evaluate(() => json_str()) === '{"drink":"tea","extras":"","gotit":""}');
  await p.click('#Choices .qna-restart'); await p.waitForTimeout(100);
  check('drink: start over', (await bubbles()).length === 1 && (await buttons()).length === 2, await bubbles());

  /* ---- name: X input ---- */
  await p.setContent(page(fx('name.txt')));
  await p.waitForSelector('#Choices input.xinput');
  dialogs = [];
  await p.click('#Choices a.xbutton'); await p.waitForTimeout(100);
  check('name: empty input rejected', dialogs.length === 1 && /empty/.test(dialogs[0]), dialogs);
  await p.fill('#Choices input.xinput', '  Dav<b>id  ');
  await p.keyboard.press('Enter'); await p.waitForTimeout(400);
  check('name: X answer bubble (escaped)', (await bubbles())[1] === 'U:Dav<b>id', await bubbles());
  check('name: <x>name</x> swapped', (await bubbles())[2] === 'B:Nice to meet you Dav<b>id.', await bubbles());
  await p.click('#Choices .qna-back'); await p.waitForTimeout(100);
  check('name: go back prefills input', await p.inputValue('#Choices input.xinput') === 'Dav<b>id');

  /* ---- shopping: DOC + javascript: hrefs + save2 ---- */
  await p.setContent(page(fx('shopping.txt')));
  await p.waitForSelector('#QandA .question_text');
  await clickAnswer('Mac and Cheese');
  dialogs = [];
  await clickAnswer('In an alert box.');
  check('shopping: doc() via javascript href alert', dialogs.length === 1 && /SHOPPING LIST/.test(dialogs[0]) && /Mac and Cheese/.test(dialogs[0]) && !/Garlic/.test(dialogs[0]), dialogs);
  check('shopping: after GOTO:3', (await bubbles()).slice(-1)[0] === 'B:Enjoy the grub.', await bubbles());
  const d = await p.evaluate(() => doc());
  check('shopping: doc() content order', d.startsWith('SHOPPING LIST') && d.indexOf('Mac and Cheese') > 0, d);

  /* ---- lawreview: X + GOTO to X question + DOC + bubble at top ---- */
  await p.setContent(page(tpl('lawreview.txt')));
  await p.waitForSelector('#Choices input.xinput');
  check('lawreview: Before: content rendered', await p.$eval('#conversation h2', e => e.textContent) === 'How to Title a Law Journal Article/Note');
  await p.fill('#Choices input.xinput', 'Ipsum Loquitur'); await p.keyboard.press('Enter'); await p.waitForTimeout(400);
  await clickAnswer('No.'); await clickAnswer('No.'); await clickAnswer('No.');
  check('lawreview: GOTO:mytitle loops back to X question', (await bubbles()).slice(-1)[0] === 'B:What is your working title?' && await p.$('#Choices input.xinput') !== null, await bubbles());
  await p.fill('#Choices input.xinput', 'Res Ipsa'); await p.keyboard.press('Enter'); await p.waitForTimeout(400);
  await clickAnswer('Yes.');
  check('lawreview: variable overwritten', (await bubbles()).slice(-1)[0].indexOf('Res Ipsa') > 0, await bubbles());
  check('lawreview: doc() uses latest var', (await p.evaluate(() => doc())).trim() === '<b>Res Ipsa</b>', await p.evaluate(() => doc()));
  check('lawreview: credits present', await p.$eval('#credits', e => e.textContent).then(x => /Law Journal/.test(x)));

  /* ---- primer: bubble break <br><br> and GOTO mid-text ---- */
  await p.setContent(page(tpl('primer.txt')));
  await p.waitForSelector('#QandA .question_text');
  await clickAnswer('Yes.'); await clickAnswer('Yes.'); await clickAnswer('Yes.');
  await clickAnswer("What's the asterisk for?"); await clickAnswer("What's that?");
  await clickAnswer('Yes. Again, again!');
  check('primer: GOTO loop re-asks', (await bubbles()).slice(-1)[0].startsWith('B:Well, sometimes you do need the numbers'), await bubbles().then(b => b.slice(-2)));
  await clickAnswer("What's that?"); await clickAnswer("No. Let's move on.");
  await p.fill('#Choices input.xinput', 'Ada'); await p.keyboard.press('Enter'); await p.waitForTimeout(400);
  const bb = await bubbles();
  check('primer: <br><br> splits into bubbles', bb.slice(-3)[0].startsWith('B:Pleased to meet you Ada.') && bb.slice(-2)[0].startsWith('B:You can do a lot') && bb.slice(-1)[0].startsWith('B:Do you want me'), bb.slice(-3));
  check('primer: A:[href] opens new window', await p.$eval('#Choices a.qabutton', e => e.target + '|' + e.getAttribute('href')) === '_blank|http://www.qnamarkup.org/syntax/');

  /* ---- error rendering ---- */
  await p.setContent(page(fx('err_misq.txt')));
  await p.waitForSelector('li.error');
  check('errors: rendered as list', /Misaligned Q/.test(await p.$eval('li.error', e => e.textContent)));

  /* ---- options via data-attributes; only script tags are sources ---- */
  await p.setContent(`<!DOCTYPE html><html><body><script>${lib}</script>
    <div id="tgt"></div>
    <script type="text/qna" data-comp-bg="ff0000" data-font-size="22" data-footer="false" data-start="2" data-target="#tgt">Q(1): one\nA: a\n\tQ: two\nQ(2): second start <b>bold</b> <\\/script>\nA: b\n\tQ: three</script>
    <div class="qna-markup">Q: should not render\nA: x\n\tQ: y</div></body></html>`);
  await p.waitForSelector('#QandA .question_text');
  const st = await p.$eval('#QandA .question_text', e => getComputedStyle(e).backgroundColor + '|' + getComputedStyle(e).fontSize);
  check('options: data attributes applied', st === 'rgb(255, 0, 0)|22px', st);
  check('options: start=2, data-target, <\\/script> unescaped', (await bubbles())[0] === 'B:second start bold' && await p.$('#tgt #QandA') !== null, await bubbles());
  check('options: footer hidden', await p.$eval('.qna-footer', e => e.style.display) === 'none');
  check('hidden div is not a source', (await p.$$('#QandA')).length === 1);

  /* ---- hash encode/decode round trip + legacy query ---- */
  const rt = await p.evaluate(async () => {
    const h = await QnA.encodeHash({ markup: 'Q: hi\nA: yo\n\tQ: ok', fontSize: 18 });
    const back = await QnA.decodeHash('#' + h);
    const legacy = await QnA.decodeHash('?markup=Q%3A+hi%0AA%3A+yo&font_size=12&comp_bg=abcdef');
    return { h: h.slice(0, 2), back, legacy };
  });
  check('hash: round trip', rt.h === 'z=' && rt.back.markup === 'Q: hi\nA: yo\n\tQ: ok' && rt.back.fontSize === 18, rt);
  check('hash: legacy ?markup= query', rt.legacy.markup === 'Q: hi\nA: yo' && rt.legacy.fontSize === '12' && rt.legacy.compBg === 'abcdef', rt.legacy);

  /* ---- scripts written in the markup (Before:, After:, Q text) ---- */
  // an external script that arrives late: everything written after it must still wait for it
  await p.route('https://scripts.test/**', async route => {
    const u = route.request().url();
    if (/missing/.test(u)) return route.fulfill({ status: 404, body: 'nope' });
    await new Promise(r => setTimeout(r, 400));
    route.fulfill({ status: 200, contentType: 'application/javascript', body: 'window.order.push("ext"); window.fromExt = function (s) { return "[" + s + "]"; };' });
  });
  const scripted = [
    'Title: Scripts',
    'Before: <h1 id="ttl">Scripts</h1>',
    '<script>',
    'window.order = ["before"];',
    '// the QnA frame exists, the first question does not yet',
    'window.seenAtBefore = { qna: !!document.getElementById("QandA"), bubbles: document.querySelectorAll(".question_text").length, inst: !!(QnA.current && document.currentScript.closest(".qna").qna === QnA.current) };',
    'function greet(n) {',
    '\tif (n.length < 1 && n > "") { return ""; }',
    '\treturn "Hello, " + n + "!";',
    '}',
    'var counter = 0;',
    '</script>',
    'After: <script src="https://scripts.test/lib.js"></script>',
    '<script>window.order.push("after:" + typeof fromExt);</script>',
    '<script type="application/json" id="data">{"a": 1}</script>',
    '<script src="https://scripts.test/missing.js"></script>',
    '<script>window.order.push("after-missing");</script>',
    '',
    'Q(name): Name?',
    'X:',
    '\tQ(greeting): <span id="out"></span> <script>',
    '\tcounter++;',
    '\tdocument.getElementById("out").textContent = greet(JSON.parse(json_str()).name) + (QnA.current.replaying ? " (again)" : "");',
    '\t</script>',
    '\tA[javascript:document.title = greet("button") + counter;]: Run',
    '\t\tQ: Done <script>window.order.push("last");</script>'
  ].join('\n');
  errors.length = 0;
  await p.setContent(page(scripted)); await p.waitForTimeout(150);
  let sc = await p.evaluate(() => ({ order: window.order.slice(), seen: window.seenAtBefore, greet: typeof window.greet, q: document.querySelector('.question_text').textContent.trim(), json: document.getElementById('data').textContent }));
  check('scripts: Before script runs, globally, before the first question is drawn', sc.greet === 'function' && sc.seen.qna && sc.seen.bubbles === 0 && sc.seen.inst && sc.q === 'Name?', sc);
  await p.waitForTimeout(700);
  sc = await p.evaluate(() => ({ order: window.order.slice(), json: document.getElementById('data').textContent }));
  check('scripts: external then inline, in the order written (inline waits for the slow external one); a failed load does not block the rest', JSON.stringify(sc.order) === '["before","ext","after:function","after-missing"]', sc.order);
  check('scripts: non-JavaScript script blocks are left alone', sc.json === '{"a": 1}');
  await p.fill('input.xinput', 'Ada'); await p.keyboard.press('Enter'); await p.waitForTimeout(500);
  check('scripts: a script in a Q runs when its bubble is drawn and can use Before functions and QnA helpers', await p.$eval('#out', e => e.textContent) === 'Hello, Ada!' && await p.evaluate(() => window.counter) === 1, await p.$eval('#out', e => e.textContent));
  check('scripts: code is not shown in bubbles or transcripts', await p.evaluate(() => !/counter|greet/.test(document.querySelector('#QandA').innerText) && !/counter|greet|script/.test(transcript()) && !/counter\+\+/.test(transcript('1')) && /BOT: Name\?/.test(transcript())), await p.evaluate(() => transcript('1')));
  await clickAnswer('Run');
  check('scripts: A[javascript:] buttons can call functions defined in Before', await p.title() === 'Hello, button!1', await p.title());
  check('scripts: later questions queue behind earlier scripts', await p.evaluate(() => window.order[window.order.length - 1]) === 'last');
  await p.click('.qna-back'); await p.waitForTimeout(300);
  check('scripts: Q scripts run again when the conversation is redrawn (GO BACK), flagged as replaying', await p.$eval('#out', e => e.textContent) === 'Hello, Ada! (again)' && await p.evaluate(() => window.counter) === 2, await p.$eval('#out', e => e.textContent));
  check('scripts: only the expected load error', errors.length === 0, errors);
  // a second render of the same markup into the same element (what QnA.render does on every call)
  await p.evaluate(m => { window.order = null; QnA.render(document.querySelector('.qna'), m); }, scripted); await p.waitForTimeout(900);
  check('scripts: header scripts run again on a fresh render', JSON.stringify(await p.evaluate(() => window.order)) === '["before","ext","after:function","after-missing"]', await p.evaluate(() => window.order));
  errors.length = 0;

  /* ---- the hidden Settings: tag ---- */
  const tagged = 'Q: Styled?\nA: Yes\n\tQ: Good.\n\nSettings: fontSize=19; compBg=336699; comp_txt=ffff00; footer=false; editorUrl=https://evil.example/; bogus=1\n';
  await p.setContent(page(tagged, 'data-comp-bg="aa0000"')); await p.waitForTimeout(200);
  const tg = await p.evaluate(() => { const q = document.querySelector('.question_text'), cs = getComputedStyle(q), i = document.querySelector('.qna').qna; return { text: document.querySelector('.qna').innerText, size: cs.fontSize, bg: cs.backgroundColor, color: cs.color, footer: i.options.footer, editorUrl: i.options.editorUrl, bogus: i.options.bogus, markup: i.result.markup }; });
  check('settings tag: not shown, not part of the markup', !/Settings|fontSize/.test(tg.text) && !/Settings/.test(tg.markup) && /Styled\?/.test(tg.text), tg);
  check('settings tag: its values style the QnA', tg.size === '19px' && tg.color === 'rgb(255, 255, 0)' && tg.footer === false, tg);
  check('settings tag: attributes on the script tag override it', tg.bg === 'rgb(170, 0, 0)', tg.bg);
  check('settings tag: only Settings-screen options are accepted', tg.bogus === undefined && !/evil/.test(tg.editorUrl), tg);
  const sp = await p.evaluate(() => ({ mid: QnA.splitSettings('Q: a\nSettings: fontSize=30\nA: b').settings, none: QnA.parse('Q: a\nA: b').settings, round: QnA.splitSettings('Q: a\n\n' + QnA.settingsTag({ fontFamily: "Georgia, 'Times New Roman', serif", radius: 3 })).settings, same: QnA.parse('Q: a\nA: b\n\tQ: c').code === QnA.parse('Q: a\nA: b\n\tQ: c\n\nSettings: radius=2').code.replace(/\n$/, '') }));
  check('settings tag: only recognised as the last line; round-trips through settingsTag(); parse result otherwise unchanged', sp.mid === null && sp.none === null && sp.round.fontFamily === "Georgia, 'Times New Roman', serif" && sp.round.radius === '3' && sp.same, sp);

  /* ---- chat style (SMS / LLM) ---- */
  const chat = 'Title: T\nQ: Hello <a href="#">link</a>\nA: Hi\n\tQ(name): What is your name?\n\tX:\n\t\tQ: Bye';
  const styleOf = () => p.evaluate(() => { const g = s => getComputedStyle(document.querySelector(s)); const q = g('.question_text'), a = document.querySelector('.ans_text') ? g('.ans_text') : null, c = g('.qna-conversation');
    return { qBg: q.backgroundColor, qTxt: q.color, qLink: g('.question_text a').color, pad: q.padding, margin: q.margin, radius: q.borderRadius, arrow: g('.question_arrow').display, ansTop: a && a.marginTop, ansBg: a && a.backgroundColor, bodyBg: c.backgroundColor, bodyTxt: c.color, opts: document.querySelector('.qna').qna.options }; });
  await p.setContent(page(chat, 'data-comp-bg="336699" data-body-bg="fafad2" data-body-txt="112233" data-body-link="aa0000"')); await p.waitForTimeout(200);
  await clickAnswer('Hi');
  const sms = await styleOf();
  check('chat style: SMS is the default and is unchanged', sms.opts.chatStyle === 'sms' && sms.qBg === 'rgb(51, 102, 153)' && sms.arrow === 'block' && sms.radius === '15px' && sms.ansTop === '0px', sms);
  await p.setContent(page(chat, 'data-chat-style="LLM" data-comp-bg="336699" data-body-bg="fafad2" data-body-txt="112233" data-body-link="aa0000"')); await p.waitForTimeout(200);
  await clickAnswer('Hi');
  const llm = await styleOf();
  check('chat style: LLM questions take the Body Colors', llm.opts.chatStyle === 'llm' && llm.qBg === 'rgb(250, 250, 210)' && llm.qTxt === 'rgb(17, 34, 51)' && llm.qLink === 'rgb(170, 0, 0)', llm);
  check('chat style: LLM keeps the System Text values in the options', llm.opts.compBg === '336699', llm.opts.compBg);
  check('chat style: LLM question has no bubble (8px top padding only) and no arrow', llm.pad === '8px 0px 0px' && llm.margin === '0px' && llm.radius === '0px' && llm.arrow === 'none', llm);
  check('chat style: LLM answers sit 8px lower and stay bubbles', llm.ansTop === '8px' && llm.ansBg === 'rgb(238, 238, 238)', llm);
  await p.setContent(page(chat + '\n\nSettings: chat_style=llm\n', 'data-chat-style="sms"')); await p.waitForTimeout(200);
  check('chat style: set by the Settings tag, overridden by the attribute; junk means SMS', await p.evaluate(() => document.querySelector('.qna').qna.options.chatStyle === 'sms' && QnA.parse('Q: a\n\nSettings: chatStyle=llm').settings.chatStyle === 'llm' && QnA.normalizeOptions({ chatStyle: 'irc' }).chatStyle === 'sms'));

  /* ---- button colours, bold, divider ---- */
  const btnOf = () => p.evaluate(() => { const g = (s, prop) => { const e = document.querySelector(s); return e ? getComputedStyle(e)[prop] : null; };
    return { bg: g('.qabutton', 'backgroundColor'), txt: g('.qabutton', 'color'), weight: g('.qabutton', 'fontWeight'), sBg: g('.sbutton', 'backgroundColor'), sTxt: g('.sbutton', 'color'), sWeight: g('.sbutton', 'fontWeight'), sBorder: g('.sbutton', 'borderTopColor'), qBorder: g('.qabutton', 'borderTopColor'), xdivBorder: g('.xdiv', 'borderTopColor'), xinBorder: g('.xinput', 'borderBottomColor'),
      std: g('.standard_buttons', 'borderTopColor'), foot: g('.qna-footer', 'borderTopColor'), xBg: g('.xbutton', 'backgroundColor'), xTxt: g('.xbutton', 'color'), xWeight: g('.xbutton', 'fontWeight'), xdiv: g('.xdiv', 'backgroundColor'), xin: g('.xinput', 'backgroundColor'), opts: document.querySelector('.qna').qna.options }; });
  const btnMarkup = 'Q: Hello\nA: Hi\n\tQ(name): What is your name?\n\tX:\n\t\tQ: Bye\nA: Other\n\tQ: Pick\n\tA: One\n\t\tQ: x';
  await p.setContent(page(btnMarkup)); await p.waitForTimeout(200);
  await clickAnswer('Other'); await p.waitForSelector('.sbutton');
  const b0 = await btnOf();
  check('buttons: defaults are unchanged (eee / 000 / normal weight / ddd rules)', b0.bg === 'rgb(238, 238, 238)' && b0.txt === 'rgb(0, 0, 0)' && b0.weight === '400' && b0.std === 'rgb(221, 221, 221)' && b0.foot === 'rgb(221, 221, 221)' && b0.sBorder === 'rgb(136, 136, 136)' && b0.opts.btnBorder === '888888' && b0.opts.btnBold === false, b0);
  check('buttons: default hover shade is still #dddddd', await p.evaluate(() => /a\.qabutton:hover,a\.qabutton:active\{background:#dddddd;\}/.test(QnA.css({})) && /a\.sbutton:active\{background:#dddddd;\}/.test(QnA.css({})) && /a\.xbutton:active\{[^}]*background:#dddddd;\}/.test(QnA.css({}))));
  await p.setContent(page(btnMarkup, 'data-btn-bg="#102030" data-btn-txt="FFEEDD" data-btn-bold="true" data-btn-border="00aa55" data-btn-divider="aa0000"')); await p.waitForTimeout(200);
  await clickAnswer('Other'); await p.waitForSelector('.sbutton');
  const b1a = await btnOf();
  await p.click('.qna-back'); await p.waitForTimeout(500);
  await clickAnswer('Hi'); await p.waitForSelector('.xbutton');
  const b1 = Object.assign(await btnOf(), { bg: b1a.bg, txt: b1a.txt, weight: b1a.weight, qBorder: b1a.qBorder });
  check('buttons: background and text colour apply to answer, standard and text-input buttons', [b1.bg, b1.sBg, b1.xBg, b1.xdiv].every(c => c === 'rgb(16, 32, 48)') && [b1.txt, b1.sTxt, b1.xTxt].every(c => c === 'rgb(255, 238, 221)'), b1);
  check('buttons: bold applies to every button; input field stays white', [b1.weight, b1.sWeight, b1.xWeight].every(w => w === '700') && b1.xin === 'rgb(255, 255, 255)' , b1);
  check('buttons: border colour applies to buttons, the text-input box and the line under its field', [b1.sBorder, b1.qBorder, b1.xdivBorder, b1.xinBorder].every(c => c === 'rgb(0, 170, 85)'), b1);
  check('buttons: divider colours the top border of standard_buttons and qna-footer', b1.std === 'rgb(170, 0, 0)' && b1.foot === 'rgb(170, 0, 0)', b1);
  check('buttons: hover shade is derived from the two colours (dark buttons lighten)', await p.evaluate(() => /a\.qabutton:hover,a\.qabutton:active\{background:#212f3c;\}/.test(QnA.css({ btnBg: '102030', btnTxt: 'ffeedd' }))));
  // the credits box follows the button background and text colour, but not the bold
  const credOf = () => p.evaluate(() => { document.querySelector('.qna-credits-link').click(); const g = (s, prop) => getComputedStyle(document.querySelector(s))[prop];
    return { bg: g('.credits', 'backgroundColor'), txt: g('.credit_text', 'color'), weight: g('.credit_text p:nth-child(2)', 'fontWeight'), link: g('.credit_text a', 'color'), shown: g('.credits', 'display') }; });
  const credMarkup = 'Title: T\nAuthor: <a href="https://example.com/never-visited">Me</a>\n' + btnMarkup;
  await p.setContent(page(credMarkup)); await p.waitForTimeout(200);
  const c0 = await credOf();
  check('credits: defaults unchanged (eee, black, standard link blue)', c0.shown === 'block' && c0.bg === 'rgb(238, 238, 238)' && c0.txt === 'rgb(0, 0, 0)' && c0.link === 'rgb(0, 0, 238)' && c0.weight === '400', c0);
  await p.setContent(page(credMarkup, 'data-btn-bg="102030" data-btn-txt="ffeedd" data-btn-bold="true"')); await p.waitForTimeout(200);
  const c1 = await credOf();
  check('credits: take the button background and text colour; links follow the text colour', c1.bg === 'rgb(16, 32, 48)' && c1.txt === 'rgb(255, 238, 221)' && c1.link === 'rgb(255, 238, 221)', c1);
  check('credits: bold buttons leave the credit text unchanged', c1.weight === '400' && await p.evaluate(() => getComputedStyle(document.querySelector('.qabutton')).fontWeight) === '700', c1);
  const bt = await p.evaluate(() => ({ tag: QnA.settingsTag({ btn_bg: '123456', btnBold: 'true' }), round: QnA.splitSettings('Q: a\n\nSettings: btnBg=123456; btn_txt=abcdef; btnBold=true; btnDivider=zzz').settings, norm: QnA.normalizeOptions({ btnBg: 'red', btnDivider: '#ABCDEF', btnBold: '0', btn_border: '#00AA55' }) }));
  check('buttons: Settings tag, legacy names and validation', /bodyLink=0000ff; btnBg=123456; btnTxt=000000; btnBold=true; btnBorder=888888; btnDivider=dddddd; chatStyle=sms;/.test(bt.tag) && bt.round.btnBg === '123456' && bt.round.btnTxt === 'abcdef' && bt.round.btnBold === 'true' && bt.norm.btnBg === 'eeeeee' && bt.norm.btnDivider === 'abcdef' && bt.norm.btnBorder === '00aa55' && bt.norm.btnBold === false, bt);
  await p.setContent(page(btnMarkup + '\n\nSettings: btnBg=123456; btnBold=true; btnDivider=00aa00\n', 'data-btn-bg="654321"')); await p.waitForTimeout(200);
  await clickAnswer('Other'); await p.waitForSelector('.sbutton');
  const b2 = await btnOf();
  check('buttons: set by the Settings tag, overridden by the attribute', b2.bg === 'rgb(101, 67, 33)' && b2.weight === '700' && b2.std === 'rgb(0, 170, 0)', b2);

  /* ---- button and footer link text ---- */
  await p.setContent(page(chat, 'data-label-save="Send" data-label-back="&lt;b&gt;Back&lt;/b&gt;" data-label-restart="Again; 100%" data-label-credits="about" data-label-edit="remix" data-label_code="make one"')); await p.waitForTimeout(200);
  await clickAnswer('Hi');
  const lb = await p.evaluate(() => ({ save: document.querySelector('.xbutton').textContent, back: document.querySelector('.qna-back').innerHTML, restart: document.querySelector('.qna-restart').textContent, footer: document.querySelector('.qna-footer > p').textContent }));
  check('labels: buttons and footer links use the given text', lb.save === 'Send' && lb.restart === 'Again; 100%' && lb.footer === 'about | remix | make one', lb);
  check('labels: text is escaped, not HTML', lb.back === '&lt;b&gt;Back&lt;/b&gt;', lb.back);
  await p.click('.qna-back'); await p.waitForTimeout(300);
  check('labels: renamed buttons still work', (await bubbles()).length === 1, await bubbles());
  const lt = await p.evaluate(() => { const tag = QnA.settingsTag({ labelRestart: 'Again; 100% = done', labelBack: '   ' }); const back = QnA.splitSettings('Q: a\n\n' + tag).settings; return { tag, restart: back.labelRestart, n: QnA.normalizeOptions(back) }; });
  check('labels: round-trip through the Settings tag (";" and "%" escaped); blank means the default', /labelRestart=Again%3B 100%25 = done;/.test(lt.tag) && lt.restart === 'Again; 100% = done' && lt.n.labelRestart === 'Again; 100% = done' && lt.n.labelBack === 'GO BACK ONE' && lt.n.labelSave === 'Save above text as answer.', lt);
  await p.setContent(page(chat + '\n\nSettings: label_back=Previous; labelCode=build one\n')); await p.waitForTimeout(200);
  await clickAnswer('Hi');
  check('labels: set by the Settings tag', await p.evaluate(() => document.querySelector('.qna-back').textContent === 'Previous' && /build one$/.test(document.querySelector('.qna-footer > p').textContent)));

  /* ---- X[javascript:...] ---- */
  const xjs = pos => 'Q(name): What is your name?\n' + (pos === 'left' ? 'X[javascript:\n\t// after the variable is saved\n\twindow.got = (window.got || [\\]).concat(document.getElementById("name").value + "|" + JSON.parse(json_str()).name);\n\twindow.arr = [1, 2\\];\n]:' : 'X:[javascript:window.got = (window.got || [\\]).concat(document.getElementById("name").value)]') + '\n\tQ(pet): Hi <x>name</x>. Your pet?\n\tX:\n\t\tQ: Bye';
  dialogs = [];
  await p.setContent(page(xjs('left')));
  await p.click('.xbutton'); await p.waitForTimeout(200);
  check('x script: not run when the empty field is refused', dialogs.length === 1 && (await p.evaluate(() => window.got)) === undefined, dialogs);
  dialogs = [];
  await p.fill('input.xinput', 'Ada'); await p.press('input.xinput', 'Enter'); await p.waitForTimeout(500);
  check('x script: runs on Enter, after the variable is updated (multi-line, comment dropped, \\] unescaped)', JSON.stringify(await p.evaluate(() => [window.got, window.arr])) === '[["Ada|Ada"],[1,2]]', await p.evaluate(() => [window.got, window.arr]));
  check('x script: the conversation carries on', (await bubbles()).join('|') === 'B:What is your name?|U:Ada|B:Hi Ada. Your pet?', await bubbles());
  await p.fill('input.xinput', 'Rex'); await p.click('.xbutton'); await p.waitForTimeout(500);
  check('x script: an X without a bracket runs nothing', (await p.evaluate(() => window.got.length)) === 1);
  await p.click('.qna-back'); await p.waitForTimeout(300); await p.click('.qna-back'); await p.waitForTimeout(300);
  check('x script: not run again by GO BACK redraws', (await p.evaluate(() => window.got.length)) === 1);
  await p.fill('input.xinput', 'Bob'); await p.click('.xbutton'); await p.waitForTimeout(500);
  check('x script: runs on the button, with the new value', JSON.stringify(await p.evaluate(() => window.got)) === '["Ada|Ada","Bob|Bob"]', await p.evaluate(() => window.got));
  await p.evaluate(() => { delete window.got; });
  await p.setContent(page(xjs('right')));
  await p.fill('input.xinput', 'Cy'); await p.press('input.xinput', 'Enter'); await p.waitForTimeout(500);
  check('x script: X:[javascript:] behaves the same (no new window, same run)', JSON.stringify(await p.evaluate(() => window.got)) === '["Cy"]' && ctx.pages().length === 1, await p.evaluate(() => window.got));
  const xe = await p.evaluate(() => { const e = m => QnA.parse('Q(n): Name?\n' + m + '\n\tQ: Bye').errors.map(x => x.line + ':' + x.message.replace(/<[^>]+>/g, '')); const ok = m => { const r = QnA.parse('Q(n): Name?\n' + m + '\n\tQ: Bye'); return r.ok && r.answers[0].isVar && r.answers[0].script; };
    return { empty: e('X[]:'), emptyR: e('X:[]'), noPrefix: e('X[alert(1)]:'), noPrefixR: e('X:[http://example.com]'), two: e('X[javascript:a()][javascript:b()]:'), space: e('X: [javascript:a()]'), left: ok('X[javascript:a()]:'), right: ok('X:[JavaScript:a()]'), bare: ok('X[javascript:]:'), plain: QnA.parse('Q(n): Name?\nX:\n\tQ: Bye').answers[0].script, code: QnA.parse('Q(n): Name?\nX[javascript:a()]:\n\tQ: Bye').code }; });
  check('x script: [] and brackets without javascript: are errors, either side of the colon', [xe.empty, xe.emptyR].every(a => a.length === 1 && /^2:.*These are empty/.test(a[0])) && [xe.noPrefix, xe.noPrefixR].every(a => a.length === 1 && /^2:.*prefix is missing/.test(a[0])), xe);
  check('x script: two brackets, or a space before the bracket, are errors', xe.two.length === 1 && /single/.test(xe.two[0]) && xe.space.length === 1 && /no space/.test(xe.space[0]), xe);
  check('x script: parsed on either side; kept in the code; plain X unchanged', xe.left === 'a()' && xe.right === 'a()' && xe.bare === '' && xe.plain === '' && /\nX\[javascript:a\(\)\]:\n/.test(xe.code), xe);

  /* ---- goto() and getvar() ---- */
  const typeX = async (v, how) => { await p.fill('input.xinput', v); if (how === 'click') await p.click('.xbutton'); else await p.press('input.xinput', 'Enter'); await p.waitForTimeout(600); };
  for (const attrs of ['', 'data-animate="false"']) {
    const tag = 'goto' + (attrs ? ' (no animation)' : '') + ': ';
    await p.setContent(page(fx('goto_number.txt'), attrs));
    await p.waitForSelector('input.xinput');
    const Q = "B:What's the answer to the ultimate question of life, the universe and everything?";
    await typeX('7');
    check(tag + 'jumps to the named question, which follows its own GOTO:', (await bubbles()).join('|') === [Q, 'U:7', 'B:Too low.', Q].join('|'), await bubbles());
    await typeX('99', 'click');
    check(tag + 'second pass, other branch', (await bubbles()).slice(-3).join('|') === ['U:99', 'B:Too High.', Q].join('|'), await bubbles());
    await typeX('fish');
    check(tag + 'getvar() returns the saved text', (await bubbles()).slice(-3).join('|') === ['U:fish', "B:So it turns out the answer is a number, and that's not a number.", Q].join('|'), await bubbles());
    await p.click('.qna-back'); await p.waitForTimeout(300);
    check(tag + 'GO BACK ONE undoes the answer and its jump, text back in the field', (await bubbles()).slice(-3).join('|') === ['U:99', 'B:Too High.', Q].join('|') && (await bubbles()).length === 7 && await p.inputValue('input.xinput') === 'fish', await bubbles());
    await p.click('.qna-back'); await p.waitForTimeout(300); await p.click('.qna-back'); await p.waitForTimeout(300);
    check(tag + 'GO BACK ONE all the way to the first question', (await bubbles()).join('|') === Q && await p.inputValue('input.xinput') === '7', await bubbles());
    await typeX('42');
    check(tag + 'no "missing question" bubble, the end has no choices', (await bubbles()).join('|') === [Q, 'U:42', "B:That's right!"].join('|') && await p.$('input.xinput') === null && await p.$('.qna-back') !== null, await bubbles());
    check(tag + 'transcript() and getvar()', await p.evaluate(() => transcript() + '|' + getvar('number') + '|' + getvar('nope')) === "BOT: What's the answer to the ultimate question of life, the universe and everything?\nUSER: 42\nBOT: That's right!\n|42|undefined");
    check(tag + 'nothing left behind the typing indicator', await p.$('.qna-pending') === null && await p.$('.qna-typing') === null);
  }
  // Magic 8 ball: numeric targets, random, loops for ever
  await p.setContent(page(fx('goto_8ball.txt')));
  await p.waitForSelector('input.xinput');
  for (let i = 0; i < 4; i++) await typeX('Will it rain ' + i + '?');
  const eight = await bubbles();
  check('goto 8 ball: each answer is followed by a reply and "Another question?"', eight.length === 13 && [0, 1, 2, 3].every(i => eight[1 + i * 3] === 'U:Will it rain ' + i + '?' && /^B:/.test(eight[2 + i * 3]) && eight[3 + i * 3] === 'B:Another question? Ask away.'), eight);
  await p.click('.qna-back'); await p.waitForTimeout(300); await p.click('.qna-back'); await p.waitForTimeout(300);
  const eight2 = await bubbles();
  check('goto 8 ball: GO BACK ONE keeps the replies already given (no re-roll)', eight2.length === 7 && eight2.join('|') === eight.slice(0, 7).join('|') && await p.inputValue('input.xinput') === 'Will it rain 2?', eight2);
  check('goto 8 ball: the flowchart data is untouched (goto() is not a GOTO:)', await p.evaluate(() => { const r = QnA.current.result; return r.ok && r.questions.filter(q => q.goto !== null).length === 21 && r.questions[0].goto === null; }));
  // an answer's own next question is replaced; a goto() in a Q's script; one made later; saved progress
  const gmix = 'Q(a): Start\nA[javascript:if (window.skip) goto("z")]: go\n\tDOC: child doc\n\tQ(child): Child\n\tA: on\n\t\tQ(c2): After child\nQ(s): Script <script>goto("z")<\\/script>\nQ(z): Zed\nA: more\n\tQ(z2): Zed two';
  // (served from an http origin: localStorage is not available to setContent pages)
  await p.route('http://qna.test/*', r => r.fulfill({ contentType: 'text/html', body: page(gmix, 'data-save-progress="true"') }));
  await p.goto('http://qna.test/mix');
  await p.evaluate(() => { localStorage.clear(); window.skip = false; });
  await clickAnswer('go');
  check('goto mix: without goto() the answer leads to its own question', (await bubbles()).join('|') === 'B:Start|U:go|B:Child', await bubbles());
  await p.click('.qna-back'); await p.waitForTimeout(300);
  await p.evaluate(() => { window.skip = true; });
  await clickAnswer('go');
  check('goto mix: goto() in an answer script replaces that question (and its DOC)', (await bubbles()).join('|') === 'B:Start|U:go|B:Zed' && await p.evaluate(() => doc()) === '' && JSON.stringify(await buttons()) === '["more"]', [await bubbles(), await p.evaluate(() => doc())]);
  await p.evaluate(() => { setTimeout(() => goto('s'), 0); }); await p.waitForTimeout(700);
  check('goto mix: called later it adds the target; a goto() in a Q script is followed', (await bubbles()).join('|') === 'B:Start|U:go|B:Zed|B:Script|B:Zed', await bubbles());
  const savedHist = await p.evaluate(() => JSON.parse(localStorage.getItem(QnA.current.progressKey())).history);
  check('goto mix: jumps are saved with the answer', JSON.stringify(savedHist) === '[{"label":"1.1","value":null,"skip":true,"jumps":["3","2","3"]}]', savedHist);
  await p.goto('http://qna.test/mix2'); await p.waitForTimeout(600);
  check('goto mix: saved progress restores the jumps without re-running them', (await bubbles()).join('|') === 'B:Start|U:go|B:Zed|B:Script|B:Zed', await bubbles());
  await clickAnswer('more');
  await p.click('.qna-back'); await p.waitForTimeout(300); await p.click('.qna-back'); await p.waitForTimeout(300);
  check('goto mix: GO BACK ONE past the jumps', (await bubbles()).join('|') === 'B:Start' && JSON.stringify(await buttons()) === '["go"]', await bubbles());
  await p.evaluate(() => localStorage.clear());

  /* ---- loadQnA() and prior answers ---- */
  {
    const files = { 'sub/sub.txt': fx('load_sub.txt'), 'sub/sub2.txt': fx('load_sub2.txt') };
    let fetched = [];
    const serve = async (attrs, extra) => { await p.unroute('http://load.test/**'); await p.route('http://load.test/**', r => {
      const u = new URL(r.request().url()), f = u.pathname.slice(1);
      if (f === 'host.html') return r.fulfill({ contentType: 'text/html', body: page(fx('load_host.txt'), attrs || '') });
      if (extra && extra[f] !== undefined) { fetched.push(f); return r.fulfill(extra[f]); }
      if (files[f] !== undefined) { fetched.push(f); return r.fulfill({ contentType: 'text/plain', body: files[f] }); }
      fetched.push(f); return r.fulfill({ status: 404, body: 'nope' });
    }); };
    const loaded = async (n) => { await p.waitForFunction(n => document.querySelectorAll('#QandA .question_text').length >= n, n, { timeout: 4000 }); await p.waitForTimeout(500); };
    const HOST = ['B:Welcome. What is your name?', 'U:Ada', 'B:Do you have a cat or a dog, Ada?', 'U:A cat!', 'B:Ready to load another QnA?', 'U:Yes, load it.'];
    await serve('data-save-progress="true"');
    await p.goto('http://load.test/host.html'); await p.evaluate(() => localStorage.clear()); await p.goto('http://load.test/host.html?v=again');
    await p.waitForSelector('input.xinput');
    await typeX('Ada'); await clickAnswer('A cat!'); await clickAnswer('Yes, load it.');
    await loaded(6);
    check('load: the loaded QnA starts where the answer\'s question would be; questions already answered in the host are filled in', (await bubbles()).join('|') === HOST.concat(['B:(Sub) What is your name?', 'U:Earlier you entered: Ada', 'B:(Sub) Cat or dog?', 'U:Earlier you entered: cat', 'B:(Sub) Pick a number under 3.']).join('|'), await bubbles());
    check('load: fetched once, relative to the page; no missing-question bubble; no confirm for an exact match', fetched.join(',') === 'sub/sub.txt' && !/missing/.test((await bubbles()).join('|')) && dialogs.length === 0, [fetched, dialogs]);
    check('load: filled-in answers ran their scripts; the loaded Before: and Settings: are ignored', await p.evaluate(() => window.subx === 1 && window.subcat === 1 && !document.getElementById('subbefore') && getComputedStyle(document.querySelector('.question_text')).fontSize === '14px' && document.querySelector('.qna-back').textContent === 'GO BACK ONE'), await p.evaluate(() => [window.subx, window.subcat]));
    check('load: labels prefixed; author names shared; machine names prefixed; json_str() has every unit', await p.evaluate(() => { const i = QnA.current; return i.current === 'L1.1.1.1' && i.byLabel['L1.1'].name === 'name' && i.byLabel['L1.1.1.1'].name === 'n' && JSON.stringify(Object.keys(JSON.parse(json_str())).sort()) === JSON.stringify(['1.1.1.2', 'L1.1.1.3', 'check', 'done', 'end', 'go', 'n', 'name', 'pet']) && JSON.parse(json_str()).pet === 'cat' && i.byLabel['L1.1.1.1.1'].name === 'check'; }), await p.evaluate(() => { const i = QnA.current; return [i.current, i.byLabel['L1.1'].name, i.byLabel['L1.1.1.1'].name, i.byLabel['L1.1.1.1.1'].name, json_str()]; }));
    check('load: the history records the auto answers and the load with its text', await p.evaluate(() => { const h = QnA.current.history; return h.length === 5 && h[2].skip === true && h[2].jumps.length === 1 && h[2].jumps[0].url === 'http://load.test/sub/sub.txt' && /^Title: Sub/.test(h[2].jumps[0].text) && h[2].jumps[0].redirect.done === '2' && h[3].auto === true && h[3].value === 'Ada' && h[4].auto === true && h[4].value === null; }), await p.evaluate(() => JSON.stringify(QnA.current.history.map(e => [e.label, e.value, e.auto, e.skip, (e.jumps || []).map(j => typeof j === 'string' ? j : 'load')]))));
    // a goto() inside a loaded question's script resolves within the loaded QnA
    await typeX('5');
    check('load: goto() in a loaded Q resolves to the loaded QnA\'s question', (await bubbles()).slice(-3).join('|') === 'U:5|B:(Sub) Good.|B:(Sub) Pick a number under 3.' && await p.$('input.xinput') !== null, await bubbles());
    await typeX('2'); await clickAnswer('finish');
    check('load: find/replace: arriving at the loaded "done" (via GOTO) continues at the host\'s "end"', (await bubbles()).slice(-4).join('|') === 'U:2|B:(Sub) Good.|U:finish|B:Back home. Bye.' && await p.$('input.xinput') === null && (await buttons()).length === 0, await bubbles());
    check('load: transcript() carries the whole conversation', /USER: Earlier you entered: Ada\nBOT: \(Sub\) Cat or dog\?\nUSER: Earlier you entered: cat\n/.test(await p.evaluate(() => transcript())));
    // GO BACK ONE, back through the loaded QnA and its filled-in answers
    await p.click('.qna-back'); await p.waitForTimeout(300);
    check('load: GO BACK ONE from the host end returns into the loaded QnA', (await bubbles()).slice(-1)[0] === 'B:(Sub) Good.' && JSON.stringify(await buttons()) === '["finish"]', await bubbles());
    await p.click('.qna-back'); await p.waitForTimeout(300);
    check('load: GO BACK ONE again: the X field holds the number', (await bubbles()).slice(-1)[0] === 'B:(Sub) Pick a number under 3.' && await p.inputValue('input.xinput') === '2', await bubbles());
    await p.click('.qna-back'); await p.waitForTimeout(300); await p.click('.qna-back'); await p.waitForTimeout(300);
    check('load: GO BACK ONE stops on a filled-in A question and shows its buttons', (await bubbles()).slice(-1)[0] === 'B:(Sub) Cat or dog?' && JSON.stringify(await buttons()) === '["cat","dog","neither"]' && fetched.length === 1, [await bubbles(), fetched]);
    await p.click('.qna-back'); await p.waitForTimeout(300);
    check('load: GO BACK ONE stops on a filled-in X question with the answer in the field', (await bubbles()).slice(-1)[0] === 'B:(Sub) What is your name?' && await p.inputValue('input.xinput') === 'Ada', await bubbles());
    await typeX('Bob');
    check('load: an edited answer sets the shared variable; the earlier bubble keeps its text', (await bubbles()).slice(-4, -1).join('|') === 'U:Bob|B:(Sub) Cat or dog?|U:Earlier you entered: cat' && await p.evaluate(() => getvar('name') === 'Bob' && QnA.current.varUnit.name === 'L1' && document.querySelectorAll('#QandA .ans_text')[0].textContent === 'Ada'), await p.evaluate(() => [getvar('name'), QnA.current.varUnit.name, document.querySelectorAll('#QandA .ans_text')[0].textContent]));
    check('load: scripts ran for the typed X and the re-filled A, never for redraws', await p.evaluate(() => window.subx === 2 && window.subcat === 2), await p.evaluate(() => [window.subx, window.subcat]));
    // saved progress: restored from the stored text, nothing fetched
    fetched = [];
    await p.goto('http://load.test/host.html?v=restore'); await p.waitForTimeout(800);
    check('load: saved progress restores the loaded QnA from the stored text, without fetching', (await bubbles()).join('|') === HOST.concat(['B:(Sub) What is your name?', 'U:Bob', 'B:(Sub) Cat or dog?', 'U:Earlier you entered: cat', 'B:(Sub) Pick a number under 3.']).join('|') && fetched.length === 0 && await p.evaluate(() => QnA.current.byLabel['L1.1'].unit === 'L1'), [await bubbles(), fetched]);
    // nested load with a relative URL (resolved against the loaded QnA's URL), goto(2) inside it
    await p.click('.qna-back'); await p.waitForTimeout(300);
    check('load: GO BACK ONE after a restore', (await bubbles()).slice(-1)[0] === 'B:(Sub) Cat or dog?' && JSON.stringify(await buttons()) === '["cat","dog","neither"]', await bubbles());
    await clickAnswer('neither'); await clickAnswer('yes'); await loaded(7);
    check('load: a loaded QnA loads another, relative to its own URL', fetched.join(',') === 'sub/sub2.txt' && (await bubbles()).slice(-2).join('|') === 'U:yes|B:(Sub2) One.' && await p.evaluate(() => QnA.current.current === 'L2.1'), [fetched, await bubbles()]);
    await clickAnswer('two');
    check('load: nested unit prefixes are L1 / L2; <x>1</x> in Sub2 is its own (machine-named) variable', (await bubbles()).slice(-2).join('|') === 'U:two|B:(Sub2) Two. two' && await p.evaluate(() => QnA.current.current === 'L2.2' && QnA.current.history.slice(-1)[0].label === 'L2.1.1' && QnA.current.history.slice(-1)[0].skip === true), await bubbles());
    await p.evaluate(() => localStorage.clear());

    // confirm on a normalized match; no confirm when nothing matches; the confirm text is a setting
    const hostB = 'Q(pet): Pet?\nA(cat): A cat!\n\tQ(go): Load?\n\tA[javascript:loadQnA("pets.txt")]: go\nA(bird): Bird\n\tQ: GOTO:go\nA(Fish): Fish\n\tQ: GOTO:go';
    const petsSub = 'Q(pet): (Sub) Which pet?\nA: Cat\n\tQ(c): (Sub) Meow.\nA: Dog\n\tQ(d): (Sub) Woof.\nA: Fish!\n\tQ(f1): (Sub) Blub.\nA: fish.\n\tQ(f2): (Sub) Glub.';
    for (const [pick, ok, expect, want] of [['A cat!', true, 'U:Earlier you entered: Cat|B:(Sub) Meow.', 1], ['A cat!', false, 'B:(Sub) Which pet?', 1], ['Bird', true, 'B:(Sub) Which pet?', 0], ['Fish', true, 'B:(Sub) Which pet?', 0]]) {
      dialogs = []; confirmOk = ok;
      await p.route('http://load.test/pets.txt', r => r.fulfill({ contentType: 'text/plain', body: petsSub }));
      await p.route('http://load.test/hostb.html', r => r.fulfill({ contentType: 'text/html', body: page(hostB, 'data-label-confirm="Use &lt;x&gt;answer&lt;/x&gt;?" data-label-earlier="Before:"') }));
      await p.goto('http://load.test/hostb.html'); await p.waitForSelector('a.qabutton');
      await clickAnswer(pick); await clickAnswer('go'); await loaded(3);
      const b = await bubbles();
      check('confirm: ' + pick + (ok ? ' / OK' : ' / Cancel') + ' -> ' + (want ? 'asked' : 'no dialog') + (expect.indexOf('Before') >= 0 ? ', taken with the Prior Answers text' : ', question shown'), b.slice(-(expect.split('|').length)).join('|') === expect.replace('Earlier you entered:', 'Before:') && dialogs.length === want && (!want || dialogs[0] === 'Use Cat?'), [b, dialogs]);
    }
    confirmOk = false;
    // a loop inside the loaded QnA re-asks a question that was filled in once; qShare off shares nothing
    const hostC = 'Q(n): Number?\nX:\n\tQ: Load?\n\tA[javascript:loadQnA("loop.txt")]: go';
    const loopSub = 'Q(n): (Sub) Number?\nX:\n\tQ(low): (Sub) Too low. GOTO:n';
    await p.route('http://load.test/loop.txt', r => r.fulfill({ contentType: 'text/plain', body: loopSub }));
    for (const share of [true, false]) {
      await p.route('http://load.test/hostc.html', r => r.fulfill({ contentType: 'text/html', body: page(hostC, share ? '' : 'data-q-share="false"') }));
      await p.goto('http://load.test/hostc.html'); await p.waitForSelector('input.xinput');
      await typeX('1'); await clickAnswer('go'); await loaded(3);
      const b = await bubbles();
      if (share) check('prior: a loaded question filled in once is asked again when its own GOTO loops back', b.slice(-4).join('|') === 'B:(Sub) Number?|U:Earlier you entered: 1|B:(Sub) Too low.|B:(Sub) Number?' && await p.$('input.xinput') !== null, b);
      else check('prior: with qShare off nothing is filled in and the loaded names are prefixed', b.slice(-1)[0] === 'B:(Sub) Number?' && await p.evaluate(() => QnA.current.byLabel['L1.1'].name === 'L1.n' && json_str() === '{"n":"1","1.1":"go","L1.n":""}'), [b, await p.evaluate(() => json_str())]);
    }
    // sources: an HTML page, a viewer link with ?markup=, a ?source= link, a #z= link; failures
    const hostD = 'Q: Pick\nA[javascript:loadQnA("page.html")]: html\nA[javascript:loadQnA("i/?markup=Q%3A%20(Q)%20From%20a%20query%0AA%3A%20ok")]: query\nA[javascript:loadQnA("i/?source=/sub/sub2.txt")]: source\nA[javascript:loadQnA(window.zlink)]: z\nA[javascript:loadQnA("missing.txt")]: missing\nA[javascript:loadQnA("bad.txt")]: bad\nA[javascript:loadQnA("plain.html")]: noqna';
    const extra = {
      'page.html': { contentType: 'text/html', body: '<!DOCTYPE html><html><body><p>x</p><script type="text/qna">\nQ: (Page) Hi <script>window.pg=1<\\/script>\nA: ok\n</script></body></html>' },
      'bad.txt': { contentType: 'text/plain', body: 'Q: no answers here' },
      'plain.html': { contentType: 'text/html', body: '<!DOCTYPE html><html><body>nothing</body></html>' }
    };
    await serve('', extra);
    await p.route('http://load.test/hostd.html', r => r.fulfill({ contentType: 'text/html', body: page(hostD, 'data-animate="false"') }));
    for (const [pick, expect] of [['html', 'B:(Page) Hi'], ['query', 'B:(Q) From a query'], ['source', 'B:(Sub2) One.'], ['z', 'B:(Z) Zed'], ['missing', 'B:[QnA: could not load http://load.test/missing.txt: HTTP 404]'], ['bad', /^B:\[QnA: could not load http:\/\/load\.test\/bad\.txt: the QnA has errors/], ['noqna', 'B:[QnA: could not load http://load.test/plain.html: the page has no <script type="text/qna">]']]) {
      fetched = [];
      await p.goto('http://load.test/hostd.html'); await p.waitForSelector('a.qabutton');
      await p.evaluate(() => QnA.encodeHash({ markup: 'Q: (Z) Zed\nA: k' }).then(h => { window.zlink = 'http://load.test/i/#' + h; }));
      await clickAnswer(pick); await p.waitForTimeout(600);
      const last = (await bubbles()).slice(-1)[0];
      check('load source ' + pick, typeof expect === 'string' ? last === expect : expect.test(last), [last, fetched]);
      if (pick === 'html') check('load source html: scripts in the loaded page\'s QnA run; <\\/script> unescaped', await p.evaluate(() => window.pg === 1));
      if (pick === 'query' || pick === 'z') check('load source ' + pick + ': decoded locally, nothing fetched', fetched.length === 0, fetched);
      if (pick === 'missing') check('load: after a failure GO BACK ONE is offered and works', await p.$('.qna-back') !== null && (await p.click('.qna-back'), await p.waitForTimeout(300), (await bubbles()).length === 1), await bubbles());
    }
    // the other way round: a loaded QnA answers first, then the host's own question is filled in; a filled-in
    // answer whose script calls goto() replaces its next question; loadQnA() from a script inside a question
    const hostE = 'Q(1): <script>if (window.autoload) loadQnA("e.txt", "done", "name")</script>Load?\nA[javascript:loadQnA("e.txt", "done", "name")]: go\nQ(name): (Host) Your name?\nX:\n\tQ(hi): Hi <x>name</x>.\n\tA[javascript:goto("bye")]: ok\n\t\tQ: never shown\nQ(bye): Bye <x>name</x>.';
    const subE = 'Q(name): (Sub) Name?\nX:\n\tQ(hi): (Sub) Hello <x>name</x>.\n\tA[javascript:goto("done")]: ok\n\t\tQ: never shown\nQ(done): (Sub) Done.';
    await p.route('http://load.test/e.txt', r => r.fulfill({ contentType: 'text/plain', body: subE }));
    await p.route('http://load.test/hoste.html*', r => r.fulfill({ contentType: 'text/html', body: page(hostE, 'data-save-progress="true"') }));
    await p.goto('http://load.test/hoste.html'); await p.evaluate(() => localStorage.clear()); await p.goto('http://load.test/hoste.html?v=1'); await p.waitForSelector('a.qabutton');
    await clickAnswer('go'); await loaded(2);
    await typeX('Eve'); await clickAnswer('ok');
    check('prior: a name answered in the loaded QnA fills in the host\'s question; goto() in a filled-in A replaces its next question', (await bubbles()).join('|') === 'B:Load?|U:go|B:(Sub) Name?|U:Eve|B:(Sub) Hello Eve.|U:ok|B:(Host) Your name?|U:Earlier you entered: Eve|B:Hi Eve.|U:Earlier you entered: ok|B:Bye Eve.' && (await buttons()).length === 0, await bubbles());
    await p.goto('http://load.test/hoste.html?v=2'); await p.waitForTimeout(600);
    check('prior: all of that is restored from saved progress', (await bubbles()).join('|') === 'B:Load?|U:go|B:(Sub) Name?|U:Eve|B:(Sub) Hello Eve.|U:ok|B:(Host) Your name?|U:Earlier you entered: Eve|B:Hi Eve.|U:Earlier you entered: ok|B:Bye Eve.', await bubbles());
    await p.evaluate(() => localStorage.clear());
    await p.route('http://load.test/hoste.html*', r => r.fulfill({ contentType: 'text/html', body: '<script>window.autoload = true</script>' + page(hostE, 'data-save-progress="true"') }));
    await p.goto('http://load.test/hoste.html?v=3'); await loaded(2);
    check('load: loadQnA() from a script inside the first question loads after it (recorded before any answer)', (await bubbles()).join('|') === 'B:Load?|B:(Sub) Name?' && await p.evaluate(() => QnA.current.pre.jumps.length === 1 && typeof QnA.current.pre.jumps[0] === 'object'), await bubbles());
    await typeX('Zed');
    await p.goto('http://load.test/hoste.html?v=4'); await p.waitForTimeout(600);
    check('load: … and is restored from saved progress too', (await bubbles()).join('|') === 'B:Load?|B:(Sub) Name?|U:Zed|B:(Sub) Hello Zed.', await bubbles());
    await p.evaluate(() => localStorage.clear());
    await p.unroute('http://load.test/**');
  }
  // the parser: an answer that loads may not have a Q beneath it; what it reads from scripts
  {
    const QnA = require('../src/qna.js');
    const e = m => QnA.parse(m).errors.map(x => x.line + ':' + x.message.replace(/<[^>]+>/g, '').slice(0, 60));
    const nested = e('Q: a\nA[javascript:loadQnA("x.txt")]: go\n\tQ: under\nQ: b\nX[javascript:if (1) loadQnA("y")]:\n\tQ: under x');
    check('parse: a Q under an answer that calls loadQnA() is an error (A and X)', nested.length === 2 && /^3:An answer that calls loadQnA\(\) cannot have a Q beneath it/.test(nested[0]) && /^6:/.test(nested[1]), nested);
    check('parse: loadQnA() without a nested Q is fine, beside answers that have one', e('Q: a\nA[javascript:loadQnA("x.txt")]: go\nA: stay\n\tQ: here').length === 0);
    const r = QnA.parse('Q(a): A <script>goto("c")</script>\nA[javascript:loadQnA("f.txt", "done", "c")]: one\nA[javascript:loadQnA(u, {end: "a", x: "zz"})]: two\nA[javascript:goto(3); goto("nope"); goto(\'c\')]: three\n\tQ: under three\nQ(c): C\nA: k');
    check('parse: answers carry loads / returns / jumps as labels; unknown targets dropped', JSON.stringify(r.answers.map(x => [x.loads, x.returns, x.jumps])) === '[["f.txt",["2"],[]],[true,["1"],[]],[null,[],["2"]],[null,[],[]]]' && JSON.stringify(r.questions.map(q => q.jumps)) === '[["2"],[],[]]', [r.answers.map(x => [x.loads, x.returns, x.jumps]), r.questions.map(q => q.jumps)]);
    check('normalizeValue: case, spaces, punctuation and tags dropped; letters, digits and emoji kept', QnA.normalizeValue(' <b>Yes</b>, Please!! 👍🏽 #1 ') === 'yesplease👍🏽1' && QnA.normalizeValue('Café') === 'café' && QnA.normalizeValue('&lt;3') === '3', QnA.normalizeValue(' <b>Yes</b>, Please!! 👍🏽 #1 '));
  }

  check('no page errors', errors.length === 0, errors);
  await browser.close();
  console.log(failed ? `\n${failed} failure(s)` : '\nAll runtime tests passed.');
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
