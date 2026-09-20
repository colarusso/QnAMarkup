// Headless-browser tests for the runtime. Usage: node test/runtime.js
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const lib = fs.readFileSync(path.join(__dirname, '..', 'src', 'qna.js'), 'utf8');
const fx = n => fs.readFileSync(path.join(__dirname, 'fixtures', n), 'utf8');
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
  p.on('dialog', async d => { dialogs.push(d.message()); await d.dismiss(); });
  let dialogs = [];

  const bubbles = () => p.$$eval('#QandA .question_text, #QandA .ans_text', els => els.map(e => (e.className.includes('ans') ? 'U:' : 'B:') + e.textContent.trim()));
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

  check('no page errors', errors.length === 0, errors);
  await browser.close();
  console.log(failed ? `\n${failed} failure(s)` : '\nAll runtime tests passed.');
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
