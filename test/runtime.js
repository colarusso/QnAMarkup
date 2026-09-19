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

  check('no page errors', errors.length === 0, errors);
  await browser.close();
  console.log(failed ? `\n${failed} failure(s)` : '\nAll runtime tests passed.');
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
