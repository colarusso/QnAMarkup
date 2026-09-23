// End-to-end test of the editor + viewer. Usage: node test/e2e.js
const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const root = path.join(__dirname, '..');
const types = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.txt': 'text/plain', '.png': 'image/png', '.ico': 'image/x-icon' };
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64');
const handler = dir => (req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0].split('#')[0]);
  if (p === '/slow.png') { setTimeout(() => { res.writeHead(200, { 'Content-Type': 'image/png', 'Cache-Control': 'no-store' }); res.end(PNG); }, 1500); return; }
  if (p.endsWith('/')) p += 'index.html';
  const file = path.join(dir, p);
  if (!file.startsWith(dir) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end('not found'); return; }
  res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream', 'Access-Control-Allow-Origin': '*' });
  res.end(fs.readFileSync(file));
};
const server = http.createServer(handler(root));
const listen = (srv, port) => new Promise((ok, no) => { srv.once('error', no); srv.listen(port, () => ok(srv)); });

let failed = 0;
const check = (n, c, info) => { if (c) console.log('PASS ' + n); else { failed++; console.log('FAIL ' + n + (info !== undefined ? ' -> ' + JSON.stringify(info) : '')); } };
const shots = path.join(__dirname, 'shots'); fs.mkdirSync(shots, { recursive: true });
// The editor renders its preview in a sandboxed iframe (preview.html); pv() returns that frame.
let page;
async function pv() { for (let i = 0; i < 100; i++) { const f = page.frame({ name: 'preview' }); if (f) return f; await page.waitForTimeout(50); } throw new Error('preview frame not found'); }

server.listen(0, async () => {
  const base = 'http://127.0.0.1:' + server.address().port + '/';
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('dialog', d => d.accept());
  try {
    /* ---- editor loads with primer ---- */
    await page.goto(base);
    await (await pv()).waitForSelector('.question_text');
    check('editor: primer loaded', (await page.inputValue('#markup')).startsWith('<!-- Note: you can turn on/off'));
    check('editor: Q ids filled in', /Q\(1\.1\):/.test(await page.inputValue('#markup')));
    check('editor: preview renders first question', (await (await pv()).$eval('.question_text', e => e.textContent)).startsWith('Would you like to write'));
    check('editor: status ok', await page.$eval('#status', e => e.className) === 'ok');
    await page.screenshot({ path: path.join(shots, 'editor.png') });
    const manifest = JSON.parse(fs.readFileSync(path.join(root, 'templates', 'templates.json'), 'utf8')).templates.map(t => t.name);
    const menu = await page.$$eval('#template option', o => o.map(x => x.textContent));
    check('editor: template menu follows templates.json', JSON.stringify(menu.filter(t => manifest.includes(t))) === JSON.stringify(manifest), menu);

    /* ---- type new markup, auto-number on update ---- */
    await page.fill('#markup', 'Title: Test\n\nQ: Red Sox or Yankees?\nA: Red Sox\n\tQ:GOTO:2\nA: Yankees\n\tQ: Seriously... GOTO:1\nQ(2): Cool.');
    await page.click('#update');
    await page.waitForTimeout(300);
    const code = await page.inputValue('#markup');
    check('editor: auto-numbered', code.indexOf('Q(1): Red Sox') > 0 && code.indexOf('\tQ(1.1):GOTO:2') > 0 && code.indexOf('\tQ(1.2): Seriously') > 0, code);
    check('editor: status shows counts', await page.$eval('#status', e => e.textContent) === '4 Q · 2 A', await page.$eval('#status', e => e.textContent));
    // interact in preview
    for (const b of await (await pv()).$$('a.qabutton')) if ((await b.textContent()).trim() === 'Yankees') await b.click();
    await page.waitForTimeout(400);
    const bubbles = await (await pv()).$$eval('.question_text', els => els.map(e => e.textContent.trim()));
    check('editor: preview GOTO loop works', bubbles.join('|') === 'Red Sox or Yankees?|Seriously...|Red Sox or Yankees?', bubbles);

    /* ---- error display ---- */
    await page.fill('#markup', 'Q: a\n\tA: too deep\n\t\tQ: c GOTO:zzz');
    await page.click('#update'); await page.waitForTimeout(300);
    check('editor: errors shown', (await (await pv()).$$('li.error')).length >= 2 && /Misaligned A/.test(await (await pv()).$eval('body', e => e.textContent)) && /GOTO:\?\?\?\?/.test(await (await pv()).$eval('body', e => e.textContent)), await (await pv()).$$eval('li.error', e => e.map(x => x.textContent)));
    check('editor: status err', await page.$eval('#status', e => e.className) === 'err');
    await page.selectOption('#output', 'link'); await page.waitForTimeout(100);
    check('editor: other outputs bounce back to Interactive while there are errors', await page.$eval('#output', s => s.value) === 'interact' && await page.$eval('#out_interact', d => d.classList.contains('active')) && /Fix the 2 errors/.test(await page.$eval('#out_note', e => e.textContent)) && await page.$eval('#out_note', e => e.classList.contains('show')));
    await page.selectOption('#output', 'flow'); await page.waitForTimeout(100);
    check('editor: flowchart also locked while there are errors', await page.$eval('#output', s => s.value) === 'interact' && !(await page.$eval('#out_flow', d => d.classList.contains('active'))));
    const errLines = await (await pv()).$$eval('li.error', li => li.map(l => l.getAttribute('data-line') + ':' + l.querySelector('.qna-error-line').textContent));
    check('editor: errors carry line numbers', JSON.stringify(errLines) === JSON.stringify(['2:Line 2:', '3:Line 3:']), errLines);
    check('editor: gutter has one numbered row per line and flags error lines', await page.evaluate(() => { const ln = document.querySelectorAll('#hl .ln'); return ln.length === 3 && /counter\(line\)|"2"/.test(getComputedStyle(ln[1], '::before').content) && ln[1].classList.contains('err') && ln[2].classList.contains('err'); }));
    await (await pv()).click('li.error[data-line="3"]'); await page.waitForTimeout(100);
    check('editor: clicking an error selects its line', await page.evaluate(() => { const t = document.getElementById('markup'); return document.activeElement === t && t.value.slice(t.selectionStart, t.selectionEnd) === '\t\tQ: c GOTO:zzz'; }));
    await page.screenshot({ path: path.join(shots, 'editor-errors.png') });

    /* ---- style tab + outputs ---- */
    await page.fill('#markup', 'Title: Styled\nDescription: A test.\n\nQ(hello): Hello <b>there</b>. What is your name?\nX:\n\tQ: Hi <x>hello</x>! <br><br> Bye.');
    await page.click('.tab[data-tab=styleblock]');
    await page.fill('#compBg', '336699');
    await page.fill('#fontSize', '18');
    await page.click('#update'); await page.waitForTimeout(600);
    const bg = await (await pv()).$eval('.question_text', e => getComputedStyle(e).backgroundColor + '|' + getComputedStyle(e).fontSize);
    check('editor: style applied to preview', bg === 'rgb(51, 102, 153)|18px', bg);
    check('editor: both "embed the library" boxes are checked by default', await page.isChecked('#inline_lib_embed') && await page.isChecked('#inline_lib') && !/<script src=/.test(await page.inputValue('#embed_text')) && !/<script src=/.test(await page.inputValue('#html_text')));
    await page.selectOption('#output', 'embed'); await page.uncheck('#inline_lib_embed'); await page.waitForTimeout(100);
    const snippet = await page.inputValue('#embed_text');
    check('editor: embed code has data attrs + markup', /data-comp-bg="336699"/.test(snippet) && /data-font-size="18"/.test(snippet) && /Q\(hello\): Hello/.test(snippet) && snippet.indexOf('<script src="' + base + 'dist/qna.min.js" integrity="sha384-') > 0 && /crossorigin="anonymous"/.test(snippet), snippet);
    const html = await page.inputValue('#html_text');
    check('editor: full page has title/og', /<title>Styled<\/title>/.test(html) && /og:description" content="A test."/.test(html), html.slice(0, 400));
    await page.selectOption('#output', 'html');
    await page.uncheck('#inline_lib'); await page.waitForTimeout(100);
    check('editor: unchecked, the full page loads the library by URL', (await page.inputValue('#html_text')).indexOf('<script src="' + base + 'dist/qna.min.js" integrity="sha384-') > 0);
    await page.check('#inline_lib'); await page.waitForTimeout(100);
    const htmlInline = await page.inputValue('#html_text');
    check('editor: inline library option', htmlInline.length > 20000 && /QnA Markup — client-side interpreter/.test(htmlInline) && !/<script src=/.test(htmlInline), htmlInline.length);
    // and the inlined page actually runs
    const inlPage = await ctx.newPage(); const inlErr = []; inlPage.on('pageerror', e => inlErr.push(String(e)));
    await inlPage.setContent(htmlInline); await inlPage.waitForSelector('.question_text');
    check('editor: inlined page renders', (await inlPage.$eval('.question_text', e => e.textContent)).indexOf('Hello there') === 0 && inlErr.length === 0, inlErr);
    await inlPage.close();
    await page.uncheck('#inline_lib');
    const link = await page.inputValue('#link_text');
    check('editor: link produced', link.startsWith(base + 'i/#z='), link.slice(0, 60));
    check('editor: no HTML snippet / iframe outputs', (await page.$('#out_snippet')) === null && !/<iframe/.test(snippet));
    await page.selectOption('#output', 'link');
    // plain-text link mode
    await page.check('input[name=link_mode][value=plain]'); await page.waitForTimeout(100);
    const plainLink = await page.inputValue('#link_text');
    check('editor: plain link mode', plainLink.startsWith(base + 'i/?markup=Title') && /comp_bg=336699/.test(plainLink) && !/#/.test(plainLink), plainLink.slice(0, 80));
    await page.check('input[name=link_mode][value=z]'); await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(shots, 'editor-link.png') });

    /* ---- viewer via link ---- */
    const v = await ctx.newPage();
    v.on('pageerror', e => errors.push('viewer: ' + e));
    await v.goto(link);
    await v.waitForSelector('#qna .question_text');
    check('viewer: renders from link', (await v.$eval('#qna .question_text', e => e.innerHTML)).indexOf('Hello <b>there</b>') === 0);
    check('viewer: title set', await v.title() === 'Styled');
    check('viewer: style carried', await v.$eval('#qna .question_text', e => getComputedStyle(e).backgroundColor) === 'rgb(51, 102, 153)');
    await v.fill('#qna input.xinput', 'Ada'); await v.keyboard.press('Enter'); await v.waitForTimeout(400);
    const vb = await v.$$eval('#qna .question_text', els => els.map(e => e.textContent.trim()));
    check('viewer: X + bubble break', vb.slice(-2).join('|') === 'Hi Ada!|Bye.', vb);
    const editHref = await v.$eval('#qna a.qna-edit-link', e => e.href);
    check('viewer: edit link points at editor with hash', editHref.startsWith(base + '#z='), editHref.slice(0, 60));
    await v.screenshot({ path: path.join(shots, 'viewer.png') });

    // Legacy-style link (old PHP query format) works in the viewer
    await v.goto(base + 'i/?markup=' + encodeURIComponent('Q: legacy?\nA: yes\n\tQ: ok') + '&comp_bg=ff0000&sharing=2');
    await v.waitForSelector('#qna .question_text');
    check('viewer: legacy ?markup= link', await v.$eval('#qna .question_text', e => e.textContent.trim() + '|' + getComputedStyle(e).backgroundColor) === 'legacy?|rgb(255, 0, 0)');
    check('viewer: legacy sharing=2 hides footer', await v.$eval('.qna-footer', e => e.style.display) === 'none');

    // ?source= (served locally with CORS)
    await v.goto(base + 'i/?source=' + base + 'templates/game.txt');
    await v.waitForSelector('#qna .question_text');
    check('viewer: ?source= fetch', (await v.$eval('#qna .question_text', e => e.textContent.trim())) === 'Shall we play a game?');

    // edit link -> editor loads that QnA
    await page.goto(editHref);
    await page.waitForTimeout(600);
    check('editor: opens from viewer edit link', /Q\(hello\)/.test(await page.inputValue('#markup')) && await page.inputValue('#compBg') === '336699');

    // editor ?source=template
    await page.goto(base + '?source=lawreview');
    await (await pv()).waitForSelector('.question_text');
    check('editor: ?source=template', /Law Journal/.test(await page.inputValue('#markup')));

    /* ---- doc page + showdoc ---- */
    await page.goto(base + 'doc/?t=' + encodeURIComponent('<b>Dear Santa</b>') + '&i=' + encodeURIComponent('Proof read.')); await page.waitForTimeout(1500);
    const docState = await page.evaluate(() => ({ data: (window.CKEDITOR && CKEDITOR.instances.t) ? CKEDITOR.instances.t.getData() : document.getElementById('t').value, instr: document.getElementById('instr').textContent, ck: !!window.CKEDITOR, url: location.search }));
    check('doc page: shows t and i (CKEditor or fallback)', /Dear Santa/.test(docState.data) && docState.instr === 'Proof read.' && docState.url === '', docState);

    await v.goto(base + 'i/#j=' + encodeURIComponent(JSON.stringify({ markup: "DOC(1): <b>Hello</b> <x>1</x>\nQ(1): Name?\nX:\n\tQ: Ok\n\tA[javascript:showdoc('Check it');]: Show doc\n\t\tQ: done" })));
    await v.waitForSelector('#qna input.xinput');
    await v.fill('#qna input.xinput', 'Zed'); await v.keyboard.press('Enter'); await v.waitForTimeout(400);
    await v.click('#qna a.qabutton'); await v.waitForTimeout(100);
    check('showdoc: overlay with doc content', await v.$eval('#qna-docview .qna-doctext', e => e.innerHTML.trim()) === '<b>Hello</b> Zed' && await v.$eval('#qna-docview .qna-docinstr', e => e.textContent) === 'Check it');
    await v.screenshot({ path: path.join(shots, 'showdoc.png') });

    // plain link produced by the editor, and raw markup in the hash
    await v.goto(plainLink); await v.waitForSelector('#qna .question_text');
    check('viewer: plain-text link from editor', (await v.$eval('#qna .question_text', e => e.textContent)).indexOf('Hello there') === 0);
    await v.goto(base + 'i/#' + encodeURIComponent('Q: raw hash?\nA: yep\n\tQ: fine')); await v.waitForTimeout(300);
    check('viewer: raw markup in hash', (await v.$eval('#qna .question_text', e => e.textContent.trim())) === 'raw hash?');
    await v.goto(base + 'i/#markup=' + encodeURIComponent('Q: keyed hash?\nA: yep\n\tQ: fine')); await v.waitForTimeout(300);
    check('viewer: markup= in hash', (await v.$eval('#qna .question_text', e => e.textContent.trim())) === 'keyed hash?');

    /* ---- min width of blank bubble ---- */
    await v.goto(base + 'i/#' + encodeURIComponent('Q: .\nA: a\n\tQ: b')); await v.waitForTimeout(300);
    check('tiny Q bubble >= 60px wide', (await v.$eval('#qna .question_text', e => e.getBoundingClientRect().width)) >= 60);
    await v.goto(base + 'i/#' + encodeURIComponent('Q:\nA: a\n\tQ: b')); await v.waitForTimeout(300);
    check('blank Q renders no bubble, just its answers', (await v.$$('#qna .question_text')).length === 0 && (await v.$$('#qna a.qabutton')).length === 1);

    /* ---- resizable panes ---- */
    await page.goto(base); await (await pv()).waitForSelector('.question_text');
    const w0 = await page.$eval('#right', e => e.getBoundingClientRect().width);
    const sp = await page.$eval('#splitter', e => { const r = e.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
    await page.mouse.move(sp.x, sp.y); await page.mouse.down(); await page.mouse.move(sp.x - 200, sp.y, { steps: 5 }); await page.mouse.up();
    const w1 = await page.$eval('#right', e => e.getBoundingClientRect().width);
    check('resize: drag widens output pane', Math.abs(w1 - (w0 + 200)) < 3, [w0, w1]);
    await page.mouse.move(sp.x - 200, sp.y); await page.mouse.down(); await page.mouse.move(sp.x + 900, sp.y, { steps: 5 }); await page.mouse.up();
    const w2 = await page.$eval('#right', e => e.getBoundingClientRect().width);
    check('resize: cannot shrink below minimum', w2 >= 300 && w2 < 320, w2);
    await page.mouse.move(sp.x + 900 - (w2 - w1) , sp.y);
    const sp2 = await page.$eval('#splitter', e => { const r = e.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
    await page.mouse.move(sp2.x, sp2.y); await page.mouse.down(); await page.mouse.move(sp2.x - 2000, sp2.y, { steps: 5 }); await page.mouse.up();
    const wl = await page.$eval('#left', e => e.getBoundingClientRect().width);
    check('resize: editor pane keeps its minimum', wl >= 300, wl);
    await page.reload(); await (await pv()).waitForSelector('.question_text');
    const w3 = await page.$eval('#right', e => e.getBoundingClientRect().width);
    check('resize: width persists across reload', Math.abs(w3 - (await page.evaluate(() => JSON.parse(localStorage.getItem('qna-editor-state')).rightW))) < 3, w3);
    // stacked (narrow) layout: vertical drag
    await page.setViewportSize({ width: 600, height: 900 }); await page.waitForTimeout(200);
    const h0 = await page.$eval('#right', e => e.getBoundingClientRect().height);
    const sv = await page.$eval('#splitter', e => { const r = e.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
    check('resize: splitter is horizontal when stacked', await page.$eval('#splitter', e => getComputedStyle(e).cursor) === 'row-resize');
    await page.mouse.move(sv.x, sv.y); await page.mouse.down(); await page.mouse.move(sv.x, sv.y - 120, { steps: 5 }); await page.mouse.up();
    const h1 = await page.$eval('#right', e => e.getBoundingClientRect().height);
    check('resize: vertical drag when stacked', Math.abs(h1 - (h0 + 120)) < 3, [h0, h1]);
    await page.mouse.move(sv.x, sv.y - 120); await page.mouse.down(); await page.mouse.move(sv.x, sv.y - 2000, { steps: 5 }); await page.mouse.up();
    check('resize: editor keeps min height when stacked', (await page.$eval('#left', e => e.getBoundingClientRect().height)) >= 200);
    check('resize: no page scroll when stacked & squeezed', await page.evaluate(() => document.documentElement.scrollHeight <= window.innerHeight + 1 && document.body.scrollHeight <= window.innerHeight + 1));
    await page.setViewportSize({ width: 600, height: 560 }); await page.waitForTimeout(200);
    check('resize: short window, panes stay within viewport', await page.evaluate(() => { const m = document.querySelector('main').getBoundingClientRect(); const l = document.getElementById('left').getBoundingClientRect(); const r = document.getElementById('right').getBoundingClientRect(); return document.documentElement.scrollHeight <= window.innerHeight + 1 && l.bottom <= m.bottom + 1 && r.bottom <= m.bottom + 1; }));
    await page.setViewportSize({ width: 1280, height: 800 }); await page.waitForTimeout(200);
    // squeeze the editor pane to its minimum width: nothing should overflow the page
    const sp3 = await page.$eval('#splitter', e => { const r = e.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
    await page.mouse.move(sp3.x, sp3.y); await page.mouse.down(); await page.mouse.move(sp3.x - 2000, sp3.y, { steps: 5 }); await page.mouse.up();
    check('resize: skinny editor, no page scroll', await page.evaluate(() => document.documentElement.scrollHeight <= window.innerHeight + 1 && document.documentElement.scrollWidth <= window.innerWidth + 1 && document.getElementById('right').getBoundingClientRect().bottom <= document.querySelector('main').getBoundingClientRect().bottom + 1));
    // output textareas fill the pane side by side, without a pane scrollbar
    await page.selectOption('#output', 'html'); await page.waitForTimeout(100);
    const fill = await page.evaluate(() => { const out = document.querySelector('.out'); const ta = document.getElementById('html_text'); return { taH: ta.getBoundingClientRect().height, outH: out.clientHeight, scroll: out.scrollHeight > out.clientHeight + 1 }; });
    check('outputs: textarea sized to pane, no pane scrollbar', fill.taH > 300 && !fill.scroll, fill);
    await page.setViewportSize({ width: 1280, height: 1000 }); await page.waitForTimeout(200);
    const fill2 = await page.evaluate(() => document.getElementById('html_text').getBoundingClientRect().height);
    check('outputs: textarea grows with the window', fill2 > fill.taH + 150, [fill.taH, fill2]);
    check('outputs: clicking textarea does not select all', await page.evaluate(() => { const ta = document.getElementById('html_text'); ta.focus(); ta.click(); return ta.selectionStart === ta.selectionEnd; }));
    check('style: color inputs are square', await page.evaluate(() => { const c = document.querySelector('input[type=color]'); const cs = getComputedStyle(c); return cs.borderTopLeftRadius === '0px'; }));
    await page.dblclick('#splitter'); await page.setViewportSize({ width: 1280, height: 800 }); await page.selectOption('#output', 'interact');

    /* ---- typing indicator waits for images ---- */
    await v.goto(base + 'i/#' + encodeURIComponent('Q: Ready?\nA: Go\n\tQ: <img src="' + base + 'slow.png?a"> Loaded.')); await v.waitForSelector('#qna .question_text');
    let slowHits = 0; const countHits = r => { if (/slow\.png\?a/.test(r.url())) slowHits++; }; v.on('request', countHits);
    await v.click('#qna a.qabutton'); await v.waitForTimeout(500);
    check('typing: dots shown while image loads, bubble held transparent', await v.$('#qna .qna-typing .qna-dots') !== null && await v.$eval('#qna .qna-pending-body', e => getComputedStyle(e).visibility === 'hidden') && await v.$eval('#qna .choices', e => e.style.display === 'none'));
    await v.waitForTimeout(1600);
    check('typing: bubble appears once image loaded', await v.$('#qna .qna-typing') === null && await v.$('#qna .qna-pending') === null && (await v.$$eval('#qna .question_text', e => e.map(x => x.textContent.trim()))).slice(-1)[0] === 'Loaded.' && await v.$eval('#qna .choices', e => e.style.display === ''));
    check('typing: image fetched only once, already complete on reveal', slowHits === 1 && await v.$eval('#qna img', i => i.complete && i.naturalWidth > 0), slowHits);
    v.off('request', countHits);
    await v.goto(base + 'i/#' + encodeURIComponent('Q: <img src="' + base + 'slow.png?b"> First has image\nA: ok\n\tQ: done')); await v.waitForTimeout(400);
    check('typing: dots on initial question with image', await v.$('#qna .qna-typing') !== null);
    await v.waitForTimeout(1800);
    check('typing: initial question shown after load', await v.$('#qna .qna-typing') === null && /First has image/.test(await v.$eval('#qna .question_text', e => e.textContent)));
    await v.goto(base + 'i/#' + encodeURIComponent('Q: A?\nA: b\n\tQ: no image here')); await v.waitForSelector('#qna .question_text');
    await v.click('#qna a.qabutton'); await v.waitForTimeout(600);
    check('typing: no lingering dots without images', await v.$('#qna .qna-typing') === null && (await v.$$('#qna .question_text')).length === 2);

    /* ---- save progress ---- */
    const spMarkup = 'Q(color): Favorite color?\nA: Red\n\tQ(next): Why red?\n\tX:\n\t\tQ: Thanks <x>next</x>.\nA: Blue\n\tQ: Blue it is.';
    await v.goto(base + 'i/#' + encodeURIComponent(spMarkup)); await v.waitForSelector('#qna .question_text');
    await v.click('#qna a.qabutton'); await v.waitForTimeout(500);
    await v.reload(); await v.waitForSelector('#qna .question_text');
    check('progress: off by default (reload restarts)', (await v.$$('#qna .question_text')).length === 1);
    await v.goto(base + 'i/#j=' + encodeURIComponent(JSON.stringify({ markup: spMarkup, saveProgress: true }))); await v.waitForSelector('#qna .question_text');
    await v.click('#qna a.qabutton'); await v.waitForTimeout(500);
    await v.fill('#qna input.xinput', 'because'); await v.keyboard.press('Enter'); await v.waitForTimeout(500);
    await v.reload(); await v.waitForSelector('#qna .question_text');
    const restored = await v.$$eval('#qna .question_text, #qna .ans_text', e => e.map(x => x.textContent.trim()));
    check('progress: restored after reload', restored.join('|') === 'Favorite color?|Red|Why red?|because|Thanks because.', restored);
    // resuming a conversation that contains an image: held behind the dots until the image is in
    const spImg = 'Q: Start?\nA: yes\n\tQ: <img src="' + base + 'slow.png?resume"> Picture. \n\tA: next\n\t\tQ: End.';
    await v.goto(base + 'i/#j=' + encodeURIComponent(JSON.stringify({ markup: spImg, saveProgress: true }))); await v.waitForSelector('#qna .question_text');
    await v.click('#qna a.qabutton'); await v.waitForTimeout(2200);
    const savedProgress = await v.evaluate(() => Object.keys(localStorage).filter(k => /^qna-progress-/.test(k)).map(k => [k, localStorage.getItem(k)]));
    // ...come back later in a browser with a cold cache (new context), progress carried over
    const ctx2 = await browser.newContext(); const v2 = await ctx2.newPage(); v2.on('pageerror', e => errors.push('resume: ' + e));
    await v2.goto(base + 'i/'); await v2.evaluate(items => items.forEach(([k, val]) => localStorage.setItem(k, val)), savedProgress);
    await v2.goto(base + 'i/#j=' + encodeURIComponent(JSON.stringify({ markup: spImg, saveProgress: true }))); await v2.waitForTimeout(400);
    check('progress: resume with image shows dots first', await v2.$('#qna .qna-typing') !== null && await v2.$eval('#qna .qna-pending-body', e => getComputedStyle(e).visibility === 'hidden') && await v2.$eval('#qna .choices', e => e.style.display === 'none'));
    await v2.waitForTimeout(1700);
    check('progress: resume revealed with image complete', await v2.$('#qna .qna-typing') === null && await v2.$('#qna .qna-pending') === null && await v2.$eval('#qna img', i => i.complete && i.naturalWidth > 0) && (await v2.$$('#qna .ans_text')).length === 1 && (await v2.$$('#qna a.qabutton')).length === 1);
    await ctx2.close();
    await v.goto(base + 'i/#j=' + encodeURIComponent(JSON.stringify({ markup: spMarkup, saveProgress: true }))); await v.waitForSelector('#qna .question_text');
    check('progress: variables restored', /^\{"color":"Red","next":"because"/.test(await v.evaluate(() => json_str())), await v.evaluate(() => json_str()));
    await v.click('#qna .qna-back'); await v.waitForTimeout(200); await v.reload(); await v.waitForSelector('#qna .question_text');
    check('progress: go back is saved too', (await v.$$('#qna .ans_text')).length === 1);
    await v.click('#qna .qna-restart'); await v.waitForTimeout(200); await v.reload(); await v.waitForSelector('#qna .question_text');
    check('progress: start over clears it', (await v.$$('#qna .ans_text')).length === 0);
    await v.goto(base + 'i/?markup=' + encodeURIComponent(spMarkup) + '&save_progress=1'); await v.waitForSelector('#qna .question_text');
    await v.click('#qna a.qabutton'); await v.waitForTimeout(500);
    await v.goto(base + 'i/?markup=' + encodeURIComponent(spMarkup + '\n') + '&save_progress=1'); await v.waitForSelector('#qna .question_text');
    check('progress: legacy save_progress=1 + changed markup does not restore', (await v.$$('#qna .ans_text')).length === 0);
    await v.goto(base + 'i/?markup=' + encodeURIComponent(spMarkup) + '&save_progress=1'); await v.waitForSelector('#qna .question_text');
    check('progress: legacy save_progress=1 restores same markup', (await v.$$('#qna .ans_text')).length === 1);
    // editor exposes it as a Settings option that flows into the outputs
    await page.goto(base); await (await pv()).waitForSelector('.question_text');
    check('editor: tab is called Settings', await page.$eval('.tab[data-tab=styleblock]', e => e.textContent) === 'Settings');
    await page.click('.tab[data-tab=styleblock]'); await page.selectOption('#saveProgress', 'true'); await page.click('#update'); await page.waitForTimeout(500);
    check('editor: save progress in embed code', /data-save-progress="true"/.test(await page.inputValue('#embed_text')));
    const spWarn = await page.$eval('#warn', e => e.className + '|' + e.textContent);
    check('editor: save progress shows a warning above the outputs', /^show\|/.test(spWarn) && /Save visitor progress is on/.test(spWarn) && /after the browser is closed/.test(spWarn) && /START OVER/.test(spWarn), spWarn);
    await page.selectOption('#output', 'link'); await page.check('input[name=link_mode][value=plain]'); await page.waitForTimeout(100);
    check('editor: save progress in plain link', /save_progress=1/.test(await page.inputValue('#link_text')));
    await page.check('input[name=link_mode][value=z]'); await page.selectOption('#saveProgress', 'false'); await page.selectOption('#output', 'interact'); await page.click('#update'); await page.waitForTimeout(300);
    check('editor: the save-progress warning goes when it is turned off', await page.$eval('#warn', e => e.className) === '');
    // the warning is about the QnA a visitor will use, so it stays off the Flowchart output
    await page.evaluate(() => { document.getElementById('saveProgress').value = 'true'; }); await page.click('#update'); await page.waitForTimeout(300);
    const warnState = () => page.$eval('#warn', e => e.className + '|' + getComputedStyle(e).display + '|' + [...e.querySelectorAll('.warn-item')].map(i => getComputedStyle(i).display).join(','));
    check('editor: save-progress warning with Interactive', await warnState() === 'show|block|block', await warnState());
    await page.selectOption('#output', 'flow'); await page.waitForTimeout(300);
    check('editor: … hidden with Flowchart', await warnState() === '|none|none', await warnState());
    await page.selectOption('#output', 'link'); await page.waitForTimeout(100);
    check('editor: … back with Link', await warnState() === 'show|block|block', await warnState());
    await page.selectOption('#output', 'interact'); await page.evaluate(() => { document.getElementById('saveProgress').value = 'false'; }); await page.click('#update'); await page.waitForTimeout(300);

    /* ---- X:number, and text after X: as a warning ---- */
    await page.click('.tab[data-tab=codeblock]'); await page.fill('#markup', 'Q(age): How old?\nX: age\n\tQ: Thanks'); await page.click('#update'); await page.waitForTimeout(400);
    const xw = await page.$eval('#warn', e => e.className + '|' + e.textContent);
    check('x text: text after X: is a warning, not an error', await page.$eval('#status', e => e.className) === 'ok' && /^show\|Line 2:.*has no effect.*X:number/.test(xw) && /X:age/.test(await page.inputValue('#markup')), xw);
    await page.selectOption('#output', 'flow'); await page.waitForTimeout(300);
    check('x text: the parser warning shows with the Flowchart as well', await page.$eval('#warn', e => e.className === 'show' && getComputedStyle(e.querySelector('.warn-item.parser')).display !== 'none'));
    await page.fill('#markup', 'Q(age): How old?\nX: Number\n\tQ: Thanks, <x>age</x>.'); await page.click('#update'); await page.waitForTimeout(400);
    check('x number: the warning clears and the code says X:number', await page.$eval('#warn', e => e.className) === '' && /\nX:number\n/.test(await page.inputValue('#markup')));
    check('x number: the flowchart edge is labelled Number: age', await page.$$eval('#flow_canvas .qf-label', t => t.some(x => x.textContent === 'Number: age' && /qf-var/.test(x.getAttribute('class')))));
    await page.selectOption('#output', 'interact'); await page.waitForTimeout(300);
    const xin = await (await pv()).$eval('input.xinput', i => [i.type, i.step, i.getAttribute('inputmode')]);
    check('x number: the field is a number input', xin[0] === 'number' && xin[1] === 'any' && xin[2] === 'decimal', xin);
    await (await pv()).fill('input.xinput', '41.5'); await (await pv()).click('.xbutton'); await page.waitForTimeout(500);
    check('x number: the value is stored and shown', /Thanks, 41\.5\./.test(await (await pv()).$eval('#qna', e => e.innerText)));
    check('x number: embed code carries X:number', /\nX:number\n/.test(await page.evaluate(() => document.getElementById('embed_text').value)));

    /* ---- form fields in questions: warnings and the flowchart marker ---- */
    await page.fill('#markup', 'Q(dob): Details<br><input type="date" name="dob"> <input type="text"> <select name="state"><option>MA</option></select>\nA: Go\n\tQ: ok'); await page.click('#update'); await page.waitForTimeout(400);
    const fwarn = await page.$eval('#warn', e => e.className + '|' + [...e.querySelectorAll('.warn-item.parser')].map(i => i.textContent.replace(/\s+/g, ' ')).join(' || '));
    check('fields: the editor warns about a nameless control and a name shared with a question', /^show\|/.test(fwarn) && /Line 1:.*same name as a question.*<input type="date" name="dob">/.test(fwarn) && /Line 1:.*no name attribute/.test(fwarn) && await page.$eval('#status', e => e.className) === 'ok', fwarn);
    await page.selectOption('#output', 'flow'); await page.waitForTimeout(300);
    check('fields: the flowchart marks the question and names the fields', await page.$eval('#flow_canvas .qf-node[data-id="1"] .qf-fields title', t => t.textContent) === 'Form fields: dob, state' && await page.$$eval('#flow_canvas .qf-fields', f => f.length) === 1);
    await page.selectOption('#output', 'interact');
    await page.fill('#markup', 'Q(who): Details<br><input type="date" name="dob"> <select name="state"><option>MA</option></select>\nA: Go\n\tQ: ok'); await page.click('#update'); await page.waitForTimeout(400);
    check('fields: … and is quiet when every control is named and distinct', await page.$eval('#warn', e => e.className) === '');

    /* ---- replacing the markup asks only when there is unsaved work ---- */
    const asked = []; const countDialogs = d => asked.push(d.message().slice(0, 30)); page.on('dialog', countDialogs);
    await page.click('.tab[data-tab=codeblock]'); await page.fill('#markup', 'Q: typed, not saved\nA: right\n\tQ: so ask'); await page.click('#update'); await page.waitForTimeout(300);
    await page.selectOption('#template', 'lawreview'); await page.waitForTimeout(600);
    check('unsaved: switching template asks when the markup was typed', asked.length === 1 && /Replace the current markup/.test(asked[0]) && /Law/.test(await page.inputValue('#markup')), asked);
    asked.length = 0; await page.selectOption('#template', 'game'); await page.waitForTimeout(600);
    check('unsaved: a template just loaded (ids filled in by Update) is replaced without asking', asked.length === 0 && !/Law/.test(await page.inputValue('#markup')), asked);
    await page.click('#new'); await page.waitForTimeout(400);
    check('unsaved: New replaces an untouched template without asking', asked.length === 0 && /^Title:/.test(await page.inputValue('#markup')), asked);
    // a Settings change alone is unsaved work too (settings travel in the saved file)
    await page.click('.tab[data-tab=styleblock]'); await page.fill('#fontSize', '19'); await page.dispatchEvent('#fontSize', 'change'); await page.waitForTimeout(700);
    check('unsaved: (the change is seen)', await page.evaluate(() => window.unsavedMarkup()));
    await page.selectOption('#template', 'game'); await page.waitForTimeout(600);
    check('unsaved: a changed setting makes a template switch ask', asked.length === 1 && /Replace the current markup/.test(asked[0]), asked);
    asked.length = 0;
    check('unsaved: the loaded template (with its own Settings: tag applied) counts as saved', !(await page.evaluate(() => window.unsavedMarkup())) && await page.inputValue('#fontSize') !== '19', await page.inputValue('#fontSize'));
    await page.click('.tab[data-tab=codeblock]');
    await page.fill('#markup', (await page.inputValue('#markup')) + '\nQ: typed since\nA: yes\n\tQ: ok'); await page.waitForTimeout(700);
    await page.selectOption('#template', 'primer'); await page.waitForTimeout(600);
    check('unsaved: typed markup asks again', asked.length === 1 && /typed since/.test(await page.inputValue('#markup')) === false, asked);   // (the dialog is accepted, so the template loads)
    asked.length = 0;
    await page.fill('#markup', 'Title: Mine\nQ: Keep me?\nA: yes\n\tQ: kept'); await page.click('#update'); await page.waitForTimeout(300);
    const [dlSave] = await Promise.all([page.waitForEvent('download'), page.click('#save_markup')]); await dlSave.path();
    await page.reload(); await (await pv()).waitForSelector('.question_text');
    await page.selectOption('#template', 'game'); await page.waitForTimeout(600);
    check('unsaved: after Save to File (and a reload) a template loads without asking', asked.length === 0 && !/Keep me/.test(await page.inputValue('#markup')), asked);
    page.off('dialog', countDialogs);
    // (templates carry Settings: tags; put the Settings screen back so later checks see the defaults)
    await page.click('.tab[data-tab=styleblock]'); await page.click('#restore'); await page.waitForTimeout(300); await page.click('.tab[data-tab=codeblock]');
    await page.fill('#markup', 'Q: after\nA: ok\n\tQ: fine'); await page.click('#update'); await page.waitForTimeout(300);

    /* ---- http:// media warning ---- */
    await page.goto(base); await (await pv()).waitForSelector('.question_text');
    await page.fill('#markup', 'Q: <img src="http://example.com/a.gif"> and <iframe src="http://example.com/x"></iframe> and <img src="https://example.com/ok.png">\nA: a\n\tQ: b');
    await page.click('#update'); await page.waitForTimeout(300);
    const warnText = await page.$eval('#warn', e => e.className + '|' + e.textContent);
    check('editor: warns about http:// media', /^show\|/.test(warnText) && /http:\/\/example\.com\/a\.gif/.test(warnText) && /blocked outright/.test(warnText) && !/ok\.png/.test(warnText), warnText);
    await page.evaluate(() => { document.getElementById('saveProgress').value = 'true'; }); await page.click('#update'); await page.waitForTimeout(300);
    check('editor: several warnings stack in the one box', await page.$eval('#warn', e => e.querySelectorAll('.warn-item').length === 2 && /Insecure/.test(e.textContent) && /Save visitor progress/.test(e.textContent)));
    await page.selectOption('#output', 'flow'); await page.waitForTimeout(300);
    check('editor: the http:// warning is hidden with the Flowchart too', await page.$eval('#warn', e => e.className === '' && [...e.querySelectorAll('.warn-item')].every(i => getComputedStyle(i).display === 'none')));
    await page.selectOption('#output', 'interact');
    await page.evaluate(() => { document.getElementById('saveProgress').value = 'false'; });
    await page.fill('#markup', 'Q: <img src="https://example.com/ok.png">\nA: a\n\tQ: b'); await page.click('#update'); await page.waitForTimeout(300);
    check('editor: warning clears for https', await page.$eval('#warn', e => e.className) === '');

    /* ---- scrolling: new exchange at top of the QnA area; go back does not scroll ---- */
    const scrollQ = 'Q: one\nA: a\n\tQ: two\n\tA: b\n\t\tQ: three\n\t\tA: c\n\t\t\tQ: four\n\t\t\tA: d\n\t\t\t\tQ: five';
    await v.setViewportSize({ width: 800, height: 400 });
    await v.goto(base + 'i/#' + encodeURIComponent(scrollQ)); await v.waitForSelector('#qna .question_text');
    for (let i = 0; i < 3; i++) { await v.click('#qna a.qabutton'); await v.waitForTimeout(900); }
    const anchorTop = await v.evaluate(() => { const a = document.querySelectorAll('#qna .qna-jump'); return Math.round(a[a.length - 1].getBoundingClientRect().top); });
    const lastQTop = await v.evaluate(() => { const q = document.querySelectorAll('#qna .question_text'); return Math.round(q[q.length - 1].getBoundingClientRect().top); });
    check('scroll: newest response bubble sits at the top of the viewport', anchorTop >= -2 && anchorTop <= 2 && lastQTop < 30, [anchorTop, lastQTop]);
    await v.click('#qna .qna-back'); await v.waitForTimeout(300);
    const gb = await v.evaluate(() => { const sp = document.querySelector('#qna .qna-spacer'); const q = document.querySelectorAll('#qna .question_text'); const r = q[q.length - 1].getBoundingClientRect(); return { spacer: sp.style.height, lastVisible: r.top >= 0 && r.bottom <= innerHeight, answers: document.querySelectorAll('#qna .ans_text').length }; });
    check('scroll: go back one trims spacer to 15px and leaves content on screen', gb.spacer === '15px' && gb.lastVisible && gb.answers === 2, gb);
    await v.setViewportSize({ width: 1280, height: 800 });
    // same thing inside the editor's scrolling preview pane
    await page.goto(base); await (await pv()).waitForSelector('.question_text');
    await page.fill('#markup', scrollQ); await page.click('#update'); await page.waitForTimeout(400);
    for (let i = 0; i < 3; i++) { await (await pv()).click('a.qabutton'); await page.waitForTimeout(900); }
    const paneOff = await (await pv()).evaluate(() => { const a = document.querySelectorAll('.qna-jump'); return Math.round(a[a.length - 1].getBoundingClientRect().top); });
    check('scroll: editor preview scrolls its own pane, not the page', paneOff >= -2 && paneOff <= 2 && await page.evaluate(() => window.scrollY === 0), paneOff);

    /* ---- syntax highlighting overlay ---- */
    await page.goto(base); await (await pv()).waitForSelector('.question_text');
    await page.fill('#markup', 'Title: T\nQ(name): Hi <b>you</b> <!-- c -->\nX:\n\tQ: <x>name</x> GOTO:2\nA[javascript:go()]: ok\n\tQ: fine\nQ(2): end'); await page.waitForTimeout(100);
    const hl = await page.evaluate(() => { const h = document.getElementById('hl'); const c = cls => Array.from(h.querySelectorAll('.' + cls)).map(e => e.textContent); return { t: c('t'), b: c('b'), p: c('p'), h: c('h'), cm: c('c'), text: h.textContent, taH: document.getElementById('markup').scrollHeight, hlH: h.scrollHeight, font: getComputedStyle(h).font === getComputedStyle(document.getElementById('markup')).font }; });
    check('highlight: tags blue', JSON.stringify(hl.t) === JSON.stringify(['Title', 'Q', 'X', 'Q', 'GOTO', 'A', 'Q', 'Q']), hl.t);
    check('highlight: params red', hl.p.indexOf('name') >= 0 && hl.p.indexOf('javascript:go()') >= 0 && hl.p.indexOf('2') >= 0, hl.p);
    check('highlight: boundaries purple', hl.b.indexOf('(') >= 0 && hl.b.indexOf('[') >= 0 && hl.b.indexOf(':') >= 0, hl.b);
    check('highlight: html green, comment grey', hl.h.indexOf('<b>') >= 0 && hl.cm.indexOf('<!-- c -->') >= 0, [hl.h, hl.cm]);
    check('highlight: overlay text mirrors textarea', hl.text === (await page.inputValue('#markup')) + '\n' && hl.taH === hl.hlH && hl.font, [hl.taH, hl.hlH]);

    /* ---- privacy: nothing stored when progress saving is off ---- */
    const ctx3 = await browser.newContext(); const v3 = await ctx3.newPage();
    await v3.goto(base + 'i/#' + encodeURIComponent('Q(name): Name?\nX:\n\tQ: Hi <x>name</x>\n\tA: ok\n\t\tQ: bye')); await v3.waitForSelector('#qna input.xinput');
    await v3.fill('#qna input.xinput', 'Secret Person'); await v3.keyboard.press('Enter'); await v3.waitForTimeout(500);
    await v3.click('#qna a.qabutton'); await v3.waitForTimeout(500);
    const stored = await v3.evaluate(() => ({ ls: Object.keys(localStorage), ss: Object.keys(sessionStorage), cookies: document.cookie }));
    check('privacy: progress off stores nothing', stored.ls.length === 0 && stored.ss.length === 0 && stored.cookies === '', stored);
    const idb = await v3.evaluate(async () => (indexedDB.databases ? (await indexedDB.databases()).length : 0));
    check('privacy: no IndexedDB either', idb === 0, idb);
    await ctx3.close();

    /* ---- multi-line javascript + escaped brackets ---- */
    const jsQ = ['Q: go?', 'A[javascript:', '  // comment', '  var x = "a\\]b"; // trailing', '  window.__ran = x;', ']: Run it', '\tQ: ran', 'A:[https://example.com/a\\]b] link', '\tQ: linked'].join('\n');
    await v.goto(base + 'i/#' + encodeURIComponent(jsQ)); await v.waitForSelector('#qna .question_text');
    const hrefs = await v.$$eval('#qna a.qabutton', a => a.map(x => [x.getAttribute('href'), x.getAttribute('data-script') || '', x.target]));
    check('js: multi-line bracket parsed, comments stripped, \\] unescaped', hrefs.length === 2 && /^\nvar x = "a\]b";\nwindow\.__ran = x;$/.test(hrefs[0][1]) && hrefs[1][0] === 'https://example.com/a]b' && hrefs[1][2] === '_blank', hrefs);
    await v.click('#qna a.qabutton'); await v.waitForTimeout(500);
    check('js: multi-line script runs', await v.evaluate(() => window.__ran) === 'a]b');
    // highlighter follows the multi-line bracket
    await page.goto(base); await (await pv()).waitForSelector('.question_text');
    await page.fill('#markup', jsQ); await page.waitForTimeout(150);
    const hlp = await page.evaluate(() => Array.from(document.querySelectorAll('#hl .p')).map(e => e.textContent));
    check('highlight: multi-line bracket stays red', hlp.indexOf('  // comment') >= 0 && hlp.indexOf('  window.__ran = x;') >= 0, hlp);
    // filename from Title + timestamp
    await page.fill('#markup', 'Title: My Great QnA! (v2)\nQ: a\nA: b\n\tQ: c'); await page.waitForTimeout(100);
    const fn = await page.evaluate(() => window.markupFilename());
    check('save: filename from title + timestamp', /^My_Great_QnA_v2_\d{4}-\d{2}-\d{2}T\d{2}-\d{2}\.txt$/.test(fn), fn);
    await page.fill('#markup', 'Q: a\nA: b\n\tQ: c'); await page.waitForTimeout(100);
    const fn2 = await page.evaluate(() => window.markupFilename());
    check('save: default filename + timestamp', /^QnA_markup_\d{4}-\d{2}-\d{2}T\d{2}-\d{2}\.txt$/.test(fn2), fn2);
    const fn3 = await page.evaluate(() => [window.htmlFilename(), window.flowFilename('png'), window.flowFilename('svg')]);
    check('save: HTML and flowchart default filenames', /^QnA_page_\d{4}-\d{2}-\d{2}T\d{2}-\d{2}\.html$/.test(fn3[0]) && /^QnA_flowchart_\d{4}-\d{2}-\d{2}T\d{2}-\d{2}\.png$/.test(fn3[1]) && /^QnA_flowchart_.*\.svg$/.test(fn3[2]), fn3);
    await page.fill('#markup', 'Title: My Great QnA! (v2)\nQ: a\nA: b\n\tQ: c'); await page.waitForTimeout(400);
    const fn4 = await page.evaluate(() => [window.htmlFilename(), window.flowFilename('png')]);
    check('save: HTML and flowchart filenames from title + timestamp', /^My_Great_QnA_v2_\d{4}-\d{2}-\d{2}T\d{2}-\d{2}\.html$/.test(fn4[0]) && /^My_Great_QnA_v2_flowchart_\d{4}-\d{2}-\d{2}T\d{2}-\d{2}\.png$/.test(fn4[1]), fn4);
    await page.selectOption('#output', 'html'); await page.waitForTimeout(200);
    const [hdl] = await Promise.all([page.waitForEvent('download'), page.click('#save_html')]);
    check('save: "Save HTML to File" downloads under that name', /^My_Great_QnA_v2_\d{4}-\d{2}-\d{2}T\d{2}-\d{2}\.html$/.test(hdl.suggestedFilename()), hdl.suggestedFilename());
    await page.fill('#markup', 'Q: a\nA: b\n\tQ: c'); await page.waitForTimeout(100);
    await page.selectOption('#output', 'interact');

    /* ---- flowchart output ---- */
    await page.goto(base); await (await pv()).waitForSelector('.question_text');
    await page.fill('#markup', 'Q(name): Name?\nX:\n\tDOC: doc\n\tQ: Coffee or tea?\n\tA: Coffee\n\t\tQ:GOTO:done\n\tA: Tea\n\t\tQ: Milk? GOTO:done\n\tA: Neither\nQ(done): Done.'); await page.click('#update'); await page.waitForTimeout(300);
    await page.selectOption('#output', 'flow'); await page.waitForTimeout(300);
    const fl = await page.evaluate(() => {
      const ids = Array.from(document.querySelectorAll('#flow_canvas .qf-node')).map(n => n.getAttribute('data-id'));
      const labels = Array.from(document.querySelectorAll('#flow_canvas .qf-label')).map(t => t.textContent + '|' + t.getAttribute('class'));
      return { ids, labels, ends: document.querySelectorAll('#flow_canvas .qf-endnode').length, doc: document.querySelectorAll('#flow_canvas .qf-doc').length, start: document.querySelector('#flow_canvas .qf-startnode') ? document.querySelector('#flow_canvas .qf-startnode').textContent : null, nodeFill: getComputedStyle(document.querySelector('#flow_canvas .qf-node[data-id="1"] rect')).fill, nodeFont: getComputedStyle(document.querySelector('#flow_canvas .qf-node[data-id="1"] text')).fontFamily };
    });
    check('flow: nodes = questions minus pure GOTOs', JSON.stringify(fl.ids) === JSON.stringify(['__start', '1', '1.1', '1.1.2', '2', 'end-1.1.3']), fl.ids);
    check('flow: all edges share one colour and one arrowhead', await page.evaluate(() => { const es = [...document.querySelectorAll('#out_flow .qf-edge')]; const strokes = new Set(es.map(e => getComputedStyle(e).stroke)); const markers = new Set(es.map(e => e.getAttribute('marker-end'))); return es.length >= 3 && strokes.size === 1 && markers.size === 1 && document.querySelectorAll('#out_flow marker').length === 1; }));
    check('flow: X edge labelled with variable name, GOTO edge dashed, dead end dot', fl.labels.some(l => l === 'Input: name|qf-label qf-var') && fl.labels.some(l => l === 'GOTO|qf-label qf-goto') && fl.labels.some(l => l.startsWith('Coffee|')) && fl.ends === 1 && fl.doc === 1 && fl.start === 'START', fl);
    check('flow: node colours/font follow settings', fl.nodeFill === 'rgb(84, 137, 235)' && /Segoe UI/.test(fl.nodeFont), [fl.nodeFill, fl.nodeFont]);
    const before = await page.$eval('#flow_canvas .qf-node[data-id="1.1"] rect', r => { const b = r.getBoundingClientRect(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; });
    await page.mouse.move(before.x, before.y); await page.mouse.down(); await page.mouse.move(before.x + 120, before.y + 30, { steps: 6 }); await page.mouse.up();
    const after = await page.$eval('#flow_canvas .qf-node[data-id="1.1"] rect', r => { const b = r.getBoundingClientRect(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; });
    check('flow: nodes are draggable', Math.abs(after.x - before.x - 120) < 3 && Math.abs(after.y - before.y - 30) < 3, [before, after]);
    await page.click('#update'); await page.waitForTimeout(300);
    const kept = await page.$eval('#flow_canvas .qf-node[data-id="1.1"] rect', r => { const b = r.getBoundingClientRect(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; });
    check('flow: dragged position survives re-render', Math.abs(kept.x - after.x) < 3 && Math.abs(kept.y - after.y) < 3, [after, kept]);
    // the START pill and the terminal dot move too, grabbed by their middles, and are remembered as well
    // (compared in world coordinates: moving an outer node changes the bounds, so the re-render's fit() changes the view)
    const mid = sel => page.$eval(sel, r => { const b = r.getBoundingClientRect(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; });
    const world = sel => page.$eval(sel, g => g.getAttribute('transform'));
    const dragBy = async (sel, dx, dy) => { const a = await mid(sel); await page.mouse.move(a.x, a.y); await page.mouse.down(); await page.mouse.move(a.x + dx, a.y + dy, { steps: 6 }); await page.mouse.up(); return [a, await mid(sel)]; };
    const view0 = await world('#flow_canvas .qf-world');
    const [s0, s1] = await dragBy('#flow_canvas .qf-startnode rect', -80, 20);
    check('flow: the START pill is draggable by its middle (not a pan)', Math.abs(s1.x - s0.x + 80) < 3 && Math.abs(s1.y - s0.y - 20) < 3 && await world('#flow_canvas .qf-world') === view0, [s0, s1]);
    const [e0, e1] = await dragBy('#flow_canvas .qf-node[data-id="end-1.1.3"] .qf-end', 60, 40);
    check('flow: the terminal dot is draggable', Math.abs(e1.x - e0.x - 60) < 3 && Math.abs(e1.y - e0.y - 40) < 3 && await world('#flow_canvas .qf-world') === view0, [e0, e1]);
    const sw1 = await world('#flow_canvas .qf-startnode'), ew1 = await world('#flow_canvas .qf-node[data-id="end-1.1.3"]');
    await page.click('#update'); await page.waitForTimeout(300);
    check('flow: START and dot positions survive re-render', await world('#flow_canvas .qf-startnode') === sw1 && await world('#flow_canvas .qf-node[data-id="end-1.1.3"]') === ew1, [sw1, ew1, await world('#flow_canvas .qf-startnode'), await world('#flow_canvas .qf-node[data-id="end-1.1.3"]')]);
    check('flow: the line into the dot follows it', await page.$eval('#flow_canvas .qf-node[data-id="end-1.1.3"]', g => { const tr = g.getAttribute('transform').match(/translate\(([^,]+),([^)]+)\)/); const x = +tr[1] + 6, y = +tr[2]; const ps = [...document.querySelectorAll('#flow_canvas .qf-edge')].map(p => { const q = p.getPointAtLength(p.getTotalLength()); return Math.hypot(q.x - x, q.y - y); }); return Math.min(...ps) < 2; }));
    // lines: the label in the middle of a line is a handle that re-routes it
    const hpos = sel => page.$eval(sel, r => { const b = r.getBoundingClientRect(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; });
    const teaKey = await page.evaluate(() => [...document.querySelectorAll('#flow_canvas .qf-handle')].find(h => h.querySelector('.qf-label').textContent === 'Tea').getAttribute('data-edge'));
    const teaSel = '#flow_canvas .qf-handle[data-edge="' + teaKey + '"]';
    const pathOf = () => page.$eval(teaSel, h => h.parentNode.querySelector('.qf-edge').getAttribute('d'));
    const l0 = await hpos(teaSel + ' .qf-label-bg'), d0 = await pathOf();
    await page.mouse.move(l0.x, l0.y); await page.mouse.down(); await page.mouse.move(l0.x + 40, l0.y + 10, { steps: 3 }); await page.mouse.move(l0.x + 90, l0.y - 25, { steps: 4 }); await page.mouse.up();
    const l1 = await hpos(teaSel + ' .qf-label-bg'), d1 = await pathOf();
    check('flow: line labels are draggable', Math.abs(l1.x - l0.x - 90) < 3 && Math.abs(l1.y - l0.y + 25) < 3, [l0, l1]);
    check('flow: a dragged line is re-routed through its label', d1 !== d0 && (d1.match(/C/g) || []).length === 2 && await page.$eval(teaSel, h => { const p = h.parentNode.querySelector('.qf-edge'), t = h.querySelector('text'); const x = +t.getAttribute('x'), y = +t.getAttribute('y') - 4; let best = 1e9; for (let i = 0, n = p.getTotalLength(); i <= n; i += 1) { const q = p.getPointAtLength(i); best = Math.min(best, Math.hypot(q.x - x, q.y - y)); } return best < 1.5; }), d1);
    check('flow: a dragged line still starts and ends on the edge of its boxes', await page.$eval(teaSel, h => { const p = h.parentNode.querySelector('.qf-edge'), n = p.getTotalLength(), w = document.querySelector('#flow_canvas .qf-world').getCTM(), svg = document.querySelector('#flow_canvas svg').getBoundingClientRect(); const on = (q, id) => { const r = document.querySelector('#flow_canvas .qf-node[data-id="' + id + '"] rect').getBoundingClientRect(), x = q.x * w.a + w.e + svg.x, y = q.y * w.d + w.f + svg.y; const onX = Math.abs(x - r.left) < 1.5 || Math.abs(x - r.right) < 1.5, onY = Math.abs(y - r.top) < 1.5 || Math.abs(y - r.bottom) < 1.5; return (onX && y >= r.top - 1 && y <= r.bottom + 1) || (onY && x >= r.left - 1 && x <= r.right + 1); }; return on(p.getPointAtLength(0), '1.1') && on(p.getPointAtLength(n), '1.1.2'); }), d1);
    check('flow: other lines are left alone', await page.evaluate(k => [...document.querySelectorAll('#flow_canvas .qf-handle')].filter(h => h.getAttribute('data-edge') !== k).every(h => !h.classList.contains('qf-moved') && (h.parentNode.querySelector('.qf-edge').getAttribute('d').match(/C/g) || []).length === 1), teaKey));
    await page.click('#update'); await page.waitForTimeout(300);
    const l2 = await hpos(teaSel + ' .qf-label-bg');
    check('flow: dragged line survives re-render', Math.abs(l2.x - l1.x) < 3 && Math.abs(l2.y - l1.y) < 3 && (await pathOf()) === d1, [l1, l2]);
    // moving a box afterwards carries the re-routed line with it
    const nb = await hpos('#flow_canvas .qf-node[data-id="1.1"] rect');
    await page.mouse.move(nb.x, nb.y); await page.mouse.down(); await page.mouse.move(nb.x - 60, nb.y, { steps: 4 }); await page.mouse.up();
    const l3 = await hpos(teaSel + ' .qf-label-bg');
    check('flow: a re-routed line follows its boxes', l3.x < l2.x - 5 && (await pathOf()) !== d1 && ((await pathOf()).match(/C/g) || []).length === 2, [l2, l3]);
    // the START line has no label: it gets a grip dot instead, which stays out of exports
    const g0 = await hpos('#flow_canvas .qf-handle[data-edge="start"] .qf-grip');
    await page.mouse.move(g0.x, g0.y); await page.mouse.down(); await page.mouse.move(g0.x + 50, g0.y, { steps: 4 }); await page.mouse.up();
    const g1 = await hpos('#flow_canvas .qf-handle[data-edge="start"] .qf-grip');
    check('flow: unlabelled line has a draggable grip', Math.abs(g1.x - g0.x - 50) < 3, [g0, g1]);
    check('flow: moved lines are marked', await page.$$eval('#flow_canvas .qf-handle.qf-moved', h => h.length) === 2);
    await page.mouse.dblclick(g1.x, g1.y); await page.waitForTimeout(50);
    const g2 = await hpos('#flow_canvas .qf-handle[data-edge="start"] .qf-grip');
    check('flow: double-click puts a line back on its automatic route', Math.abs(g2.x - g0.x) < 3 && await page.$$eval('#flow_canvas .qf-handle.qf-moved', h => h.length) === 1, [g0, g2]);
    const k0 = await page.evaluate(() => document.querySelector('#flow_canvas .qf-world').getAttribute('transform'));
    await page.click('#flow_in'); await page.click('#flow_in'); await page.click('#flow_out');
    const k1 = await page.evaluate(() => document.querySelector('#flow_canvas .qf-world').getAttribute('transform'));
    check('flow: +/- zoom buttons', k0 !== k1 && parseFloat(k1.match(/scale\(([^)]+)\)/)[1]) > parseFloat(k0.match(/scale\(([^)]+)\)/)[1]), [k0, k1]);
    await page.click('#flow_reset'); await page.waitForTimeout(200);
    const reset = await page.$eval('#flow_canvas .qf-node[data-id="1.1"] rect', r => { const b = r.getBoundingClientRect(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; });
    check('flow: reset layout restores', Math.abs(reset.x - before.x) < 3 && Math.abs(reset.y - before.y) < 3, [before, reset]);
    const lr = await hpos(teaSel + ' .qf-label-bg');
    check('flow: reset layout restores lines too', ((await pathOf()).match(/C/g) || []).length === 1 && await page.$eval(teaSel, h => { const p = h.parentNode.querySelector('.qf-edge'), m = p.getPointAtLength(p.getTotalLength() / 2), t = h.querySelector('text'); return Math.abs(m.x - t.getAttribute('x')) < 1 && Math.abs(m.y + 4 - t.getAttribute('y')) < 1; }) && await page.$$eval('#flow_canvas .qf-handle.qf-moved', h => h.length) === 0, [l0, lr]);
    const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#flow_png')]);
    const pngBuf = fs.readFileSync(await dl.path());
    check('flow: PNG download', /_flowchart_\d{4}-\d{2}-\d{2}T\d{2}-\d{2}\.png$/.test(dl.suggestedFilename()) && pngBuf.slice(1, 4).toString() === 'PNG' && pngBuf.length > 5000, [dl.suggestedFilename(), pngBuf.length]);
    // transparent corner pixel (PNG IHDR colour type 6 = RGBA; check via canvas in page)
    const alpha = await page.evaluate(b64 => new Promise(res => { const img = new Image(); img.onload = () => { const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const x = c.getContext('2d'); x.drawImage(img, 0, 0); res(x.getImageData(0, 0, 1, 1).data[3]); }; img.src = 'data:image/png;base64,' + b64; }), pngBuf.toString('base64'));
    check('flow: PNG background transparent', alpha === 0, alpha);
    const [dls] = await Promise.all([page.waitForEvent('download'), page.click('#flow_svg')]);
    const svgTxt = fs.readFileSync(await dls.path(), 'utf8');
    check('flow: SVG export leaves out grips, dot targets and tooltips', !/qf-grip"|qf-end-hit"|<title/.test(svgTxt) && /qf-handle/.test(svgTxt) && /qf-end"/.test(svgTxt));
    check('flow: SVG download', /\.svg$/.test(dls.suggestedFilename()) && /^<\?xml/.test(svgTxt) && /<svg/.test(svgTxt) && /START/.test(svgTxt) && !/fill="#ffffff"/.test(svgTxt) && /viewBox=/.test(svgTxt), dls.suggestedFilename());
    // settings colour flows into the chart
    await page.click('.tab[data-tab=styleblock]'); await page.fill('#compBg', '336699'); await page.click('#update'); await page.waitForTimeout(400);
    check('flow: recolours with System Text background', await page.$eval('#flow_canvas .qf-node[data-id="1"] rect', r => getComputedStyle(r).fill) === 'rgb(51, 102, 153)');
    await page.fill('#compBg', '5489eb');
    await page.selectOption('#output', 'interact');

    /* ---- goto(): runs in the editor's preview; the flowchart does not show it ---- */
    {
      const eight = fs.readFileSync(path.join(__dirname, 'fixtures_runtime', 'goto_8ball.txt'), 'utf8');
      await page.goto(base); await (await pv()).waitForSelector('.question_text');
      await page.fill('#markup', eight); await page.waitForTimeout(800);
      check('goto(): the example is well formed in the editor', await page.$eval('#status', e => e.className) === 'ok');
      let f = await pv();
      await f.fill('input.xinput', 'Will it work?'); await f.press('input.xinput', 'Enter'); await page.waitForTimeout(900);
      f = await pv();
      const gb = await f.$$eval('.question_text, .ans_text', els => els.map(e => e.textContent.trim()));
      check('goto(): preview jumps to a reply, then on to "more"', gb.length === 4 && gb[1] === 'Will it work?' && gb[3] === 'Another question? Ask away.' && !/missing/.test(gb.join('|')), gb);
      await f.click('.qna-back'); await page.waitForTimeout(400);
      f = await pv();
      check('goto(): GO BACK ONE in the preview', (await f.$$('.question_text')).length === 1 && await f.inputValue('input.xinput') === 'Will it work?');
      await page.selectOption('#output', 'flow'); await page.waitForTimeout(500);
      const withGoto = await page.$eval('#flow_canvas', e => e.querySelectorAll('.qf-edge').length + '/' + e.querySelectorAll('.qf-node, g[class*=node]').length);
      await page.fill('#markup', eight.replace(/X\[javascript:[^\n]*\]:/g, 'X:')); await page.waitForTimeout(800);
      const without = await page.$eval('#flow_canvas', e => e.querySelectorAll('.qf-edge').length + '/' + e.querySelectorAll('.qf-node, g[class*=node]').length);
      check('goto(): flowchart is the same with and without the goto() calls', withGoto === without && /^[1-9]/.test(withGoto), [withGoto, without]);
      await page.selectOption('#output', 'interact');
    }

    /* ---- syntax page: folded Advanced Usage, the skill files ---- */
    {
      const sp = await ctx.newPage();
      await sp.goto(base + 'syntax/'); await sp.waitForTimeout(300);
      const folded = await sp.$$eval('details.advanced', ds => ds.map(d => [d.open, d.querySelector('summary').textContent.trim()]));
      check('syntax: three Advanced Usage boxes, all folded', folded.length === 3 && folded.every(f => f[0] === false && f[1] === 'Advanced Usage'), folded);
      check('syntax: what is inside is hidden', !(await sp.$eval('a[name=links]', a => a.checkVisibility())));
      await sp.goto(base + 'syntax/#links'); await sp.waitForTimeout(300);
      check('syntax: a link into a box opens that box only', JSON.stringify(await sp.$$eval('details.advanced', ds => ds.map(d => d.open))) === '[true,false,false]' && await sp.$eval('a[name=links]', a => a.checkVisibility()));
      await sp.evaluate(() => { location.hash = '#xjs'; }); await sp.waitForTimeout(300);
      check('syntax: … and so does a hash change', JSON.stringify(await sp.$$eval('details.advanced', ds => ds.map(d => d.open))) === '[true,true,false]');
      const skillLinks = await sp.$$eval('a[href^="../skills/"]', as => as.map(a => a.getAttribute('href')));
      check('syntax: Bots Building Bots links to the skill files', skillLinks.indexOf('../skills/qna-markup.zip') >= 0 && skillLinks.indexOf('../skills/qna-markup/SKILL.md') >= 0 && (await sp.$$eval('#toc a, main ul li a[href="#bots"]', as => as.length)) >= 1, skillLinks);
      for (const f of ['skills/qna-markup.zip', 'skills/qna-markup/SKILL.md', 'skills/qna-markup/reference.md', 'skills/qna-markup/examples/letter.txt', 'skills/qna-markup/scripts/check.js']) {
        const r = await sp.request.get(base + f);
        check('syntax: ' + f + ' is served', r.ok() && (await r.body()).length > 200, r.status());
      }
      const sk = await (await sp.request.get(base + 'skills/qna-markup/SKILL.md')).text();
      check('skill: SKILL.md has the frontmatter a skill needs', /^---\nname: qna-markup\ndescription: .{50,}\n---\n/.test(sk), sk.slice(0, 120));
      await sp.close();
    }

    /* ---- embed code: inline library option ---- */
    await page.goto(base); await (await pv()).waitForSelector('.question_text');
    await page.selectOption('#output', 'embed'); await page.waitForTimeout(100);
    check('embed: an unchecked box is remembered; then the library goes by URL', (await page.inputValue('#embed_text')).indexOf('<script src="' + base + 'dist/qna.min.js" integrity="sha384-') > 0 && !(await page.isChecked('#inline_lib_embed')));
    {
      // a browser that last used 2.2.0 (its state has the old keys, both false) still gets the new default
      const fctx = await browser.newContext(); const fp = await fctx.newPage();
      await fp.goto(base); await fp.waitForTimeout(500);
      const key = await fp.evaluate(() => Object.keys(localStorage).find(k => { try { return JSON.parse(localStorage.getItem(k)).markup !== undefined; } catch (e) { return false; } }));
      await fp.evaluate(k => { const st = JSON.parse(localStorage.getItem(k)); delete st.embedLib; delete st.embedLibEmbed; st.inlineLib = false; st.inlineLibEmbed = false; localStorage.setItem(k, JSON.stringify(st)); }, key);
      await fp.goto(base + '?x=1'); await fp.waitForTimeout(500);
      check('embed: state saved by 2.2.0 gets the new checked default', !!key && await fp.isChecked('#inline_lib_embed') && await fp.isChecked('#inline_lib'), key);
      await fctx.close();
    }
    await page.check('#inline_lib_embed'); await page.waitForTimeout(100);
    const emb = await page.inputValue('#embed_text');
    check('embed: inline option embeds the library', !/<script src=/.test(emb) && /QnA Markup — client-side interpreter/.test(emb) && /<script type="text\/qna"/.test(emb), emb.length);
    await page.uncheck('#inline_lib_embed'); await page.selectOption('#output', 'interact');

    /* ---- blank bubbles are never shown ---- */
    await v.goto(base + 'i/#' + encodeURIComponent('Q: a\nA: b\n\tQ: <br><br>GOTO:2\nA: c\n\tQ: &nbsp; \n\tA: d\n\t\tQ: e<br><br>\nQ(2): end')); await v.waitForSelector('#qna .question_text');
    await v.click('#qna a.qabutton'); await v.waitForTimeout(500);
    let bl = await v.$$eval('#qna .question_text', e => e.map(x => x.textContent.trim()));
    check('blank: <br><br> before GOTO gives no empty bubble', bl.join('|') === 'a|end', bl);
    await v.goto(base + 'i/#' + encodeURIComponent('Q: a\nA: c\n\tQ: &nbsp; \n\tA: d\n\t\tQ: e<br><br>')); await v.waitForSelector('#qna .question_text');
    await v.click('#qna a.qabutton'); await v.waitForTimeout(500); await v.click('#qna a.qabutton'); await v.waitForTimeout(500);
    bl = await v.$$eval('#qna .question_text', e => e.map(x => x.textContent.trim()));
    check('blank: &nbsp;-only question and trailing <br><br> give no empty bubbles', bl.join('|') === 'a|e', bl);

    /* ---- body background + delete saved progress ---- */
    await page.goto(base); await (await pv()).waitForSelector('.question_text');
    await page.click('.tab[data-tab=styleblock]'); await page.fill('#bodyBg', 'fff8e1'); await page.click('#update'); await page.waitForTimeout(400);
    check('bodyBg: whole output pane and conversation take the colour', await page.evaluate(() => getComputedStyle(document.querySelector('.out')).backgroundColor === 'rgb(255, 248, 225)') && await (await pv()).evaluate(() => getComputedStyle(document.querySelector('.qna-conversation')).backgroundColor === 'rgb(255, 248, 225)' && getComputedStyle(document.body).backgroundColor === 'rgb(255, 248, 225)'));
    await page.selectOption('#output', 'embed'); await page.waitForTimeout(100);
    check('bodyBg: other outputs keep the plain pane', await page.evaluate(() => getComputedStyle(document.querySelector('.out')).backgroundColor === 'rgb(255, 255, 255)'));
    await page.selectOption('#output', 'interact');
    check('bodyBg: in embed code and full page', /data-body-bg="fff8e1"/.test(await page.inputValue('#embed_text')) && /<body class="qna-page">/.test(await page.inputValue('#html_text')));
    await page.selectOption('#output', 'link'); await page.waitForTimeout(300);
    const bgLink = await page.inputValue('#link_text');
    await v.goto(bgLink); await v.waitForSelector('#qna .question_text');
    check('bodyBg: viewer page body takes the colour', await v.evaluate(() => getComputedStyle(document.body).backgroundColor) === 'rgb(255, 248, 225)');
    await page.selectOption('#output', 'interact'); await page.fill('#bodyBg', 'ffffff'); await page.click('#update'); await page.waitForTimeout(200);
    check('bodyBg: default is white', await page.evaluate(() => getComputedStyle(document.querySelector('.out')).backgroundColor) === 'rgb(255, 255, 255)');
    check('output menu: Flowchart is last', await page.$$eval('#output option', o => o.map(x => x.value).join(',')) === 'interact,link,embed,html,flow');
    await page.click('.tab[data-tab=codeblock]'); await page.fill('#markup', 'Title: T\nBefore: <p>Intro <a href="#">link</a></p>\nQ: a <a href="#">bubble link</a>\nA: b\n\tQ: c'); await page.click('.tab[data-tab=styleblock]'); await page.fill('#bodyTxt', '336600'); await page.fill('#bodyLink', 'cc0000'); await page.click('#update'); await page.waitForTimeout(400);
    check('body colours: text and links outside bubbles', await (await pv()).evaluate(() => { const p = document.querySelector('.qna-conversation p'); const a = p.querySelector('a'); const ba = document.querySelector('.question_text a'); const btn = document.querySelector('a.qabutton'); return getComputedStyle(p).color === 'rgb(51, 102, 0)' && getComputedStyle(a).color === 'rgb(204, 0, 0)' && getComputedStyle(ba).color === 'rgb(227, 251, 252)' && getComputedStyle(btn).color === 'rgb(0, 0, 0)'; }));
    check('body colours: in embed code', /data-body-txt="336600" data-body-link="cc0000"/.test(await page.inputValue('#embed_text')) || (/data-body-txt="336600"/.test(await page.inputValue('#embed_text')) && /data-body-link="cc0000"/.test(await page.inputValue('#embed_text'))));
    await page.click('.tab[data-tab=codeblock]'); await page.fill('#markup', 'Title: T\nAuthor: Me <a href="#">site</a>\nQ: a\nA: b\n\tQ: c'); await page.click('.tab[data-tab=styleblock]'); await page.selectOption('#fontFamily', "Georgia, 'Times New Roman', serif"); await page.click('#update'); await page.waitForTimeout(400);
    await (await pv()).click('.qna-credits-link'); await page.waitForTimeout(100);
    check('body colours: credits stay black with standard links, but take the body font', await (await pv()).evaluate(() => { const c = document.querySelector('.credit_text'); const a = c.querySelector('a'); return getComputedStyle(c).color === 'rgb(0, 0, 0)' && getComputedStyle(a).color === 'rgb(0, 0, 238)' && /Georgia/.test(getComputedStyle(c).fontFamily) && /Georgia/.test(getComputedStyle(document.querySelector('.qna-footer')).fontFamily); }));
    await page.selectOption('#fontFamily', 'Verdana, Geneva, sans-serif'); await page.fill('#bodyTxt', '000000'); await page.fill('#bodyLink', '0000ff'); await page.click('#update'); await page.waitForTimeout(200);
    check('settings: Body Colors fieldset follows Body Text', await page.$$eval('#styleblock legend', l => l.map(x => x.textContent).slice(0, 2).join('|')) === 'Body Text|Body Colors');
    check('settings: colour inputs have a 1px border, no radius', await page.evaluate(() => { const cs = getComputedStyle(document.querySelector('input[type=color]')); return cs.borderTopWidth === '1px' && cs.borderTopStyle === 'solid' && cs.borderTopLeftRadius === '0px'; }));
    await page.evaluate(() => { localStorage.setItem('qna-progress-abc-1', '{"history":[]}'); localStorage.setItem('qna-progress-def-2', '{"history":[]}'); });
    await page.click('#clear_progress'); await page.waitForTimeout(100);
    check('settings: delete saved progress clears qna-progress keys only', await page.evaluate(() => Object.keys(localStorage).filter(k => /^qna-progress-/.test(k)).length === 0 && !!localStorage.getItem('qna-editor-state')) && /Removed saved progress for [2-9]\d* interviews/.test(await page.$eval("#clear_progress_note", e => e.textContent)), await page.$eval('#clear_progress_note', e => e.textContent));
    check('editor: gutter is narrow', await page.evaluate(() => parseFloat(getComputedStyle(document.getElementById('markup')).paddingLeft) <= 40));
    check('editor: error boxes are square', await page.evaluate(() => { const s = document.createElement('li'); s.className = 'error'; const u = document.createElement('ul'); u.className = 'qna-error-list'; u.appendChild(s); document.body.appendChild(u); const r = getComputedStyle(s).borderTopLeftRadius; u.remove(); return r === '0px'; }));

    /* ---- live preview must not steal focus from the editor ---- */
    await page.goto(base); await (await pv()).waitForSelector('.question_text');
    await page.fill('#markup', 'Q: Name?\nX:\n\tQ: Hi <x>1</x>.'); await page.click('#update'); await page.waitForTimeout(300);
    await page.focus('#markup'); await page.keyboard.press('End'); await page.keyboard.type(' ok'); await page.waitForTimeout(900);
    check('editor: live preview with an X input keeps focus in the editor', await page.evaluate(() => document.activeElement && document.activeElement.id === 'markup'));
    await page.click('#status'); await page.click('#update'); await page.waitForTimeout(300);
    check('editor: X input is focused when nothing editable has focus', await page.evaluate(() => document.activeElement && document.activeElement.id === 'preview') && await (await pv()).evaluate(() => document.hasFocus() && document.activeElement.classList.contains('xinput')));
    await (await pv()).fill('input.xinput', 'Ann'); await page.keyboard.press('Enter'); await page.waitForTimeout(400);
    await (await pv()).click('.qna-back'); await page.waitForTimeout(400);
    check('editor: X input regains focus after interacting with the output', await (await pv()).evaluate(() => document.hasFocus() && document.activeElement.classList.contains('xinput')));

    /* ---- syntax page ---- */
    await page.goto(base + 'syntax/');
    check('syntax page: loads', /Syntax & Usage/.test(await page.title()) || (await page.$('h1')) !== null);
    check('syntax page: embedding section', await page.$('a[name=embedding]') !== null);
    check('syntax page: no hidden-div references', !/(class|id)="qna-markup"/.test(await page.content()));
    await page.screenshot({ path: path.join(shots, 'syntax.png') });

    // mobile layout of editor
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(base); await (await pv()).waitForSelector('.question_text');
    check('editor: no horizontal overflow on phone', await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));
    await page.screenshot({ path: path.join(shots, 'editor-mobile.png') });

    /* ---- the two-origin split (config.js: localhost:8000 = editor origin, :8001 = viewer origin) ---- */
    let sA = null, sB = null;
    try { sA = await listen(http.createServer(handler(root)), 8000); sB = await listen(http.createServer(handler(root)), 8001); } catch (e) { console.log('SKIP split-origin tests: ports 8000/8001 busy (' + e.code + ')'); }
    if (sA && sB) {
      const ORG = 'http://localhost:8000/', NET = 'http://localhost:8001/';
      await page.goto(ORG); await (await pv()).waitForSelector('.question_text');
      await page.fill('#markup', 'Title: Split\nQ: Cross-origin?\nA: Yes\n\tQ: Good.'); await page.click('#update'); await page.waitForTimeout(400);
      const splitLink = await page.inputValue('#link_text');
      check('split: share link points at the viewer origin', splitLink.startsWith(NET + 'i/#z='), splitLink.slice(0, 40));
      await page.selectOption('#output', 'embed'); await page.uncheck('#inline_lib_embed'); await page.waitForTimeout(100);
      const splitEmbed = await page.inputValue('#embed_text');
      await page.selectOption('#output', 'interact');
      check('split: embed code loads the library from the editor origin with SRI', splitEmbed.indexOf('<script src="' + ORG + 'dist/qna.min.js" integrity="sha384-') > 0, splitEmbed.slice(0, 200));
      check('split: preview frame has an opaque origin and no storage', await (await pv()).evaluate(() => { let st = 'no-storage'; try { localStorage.getItem('x'); st = 'has-storage'; } catch (e) {} return self.origin === 'null' && st === 'no-storage'; }));
      check('split: preview still runs the QnA (buttons work)', await (await pv()).$('a.qabutton') !== null);
      await page.evaluate(() => localStorage.setItem('qna-split-probe', '1'));
      const v4 = await ctx.newPage();
      await v4.goto(splitLink); await v4.waitForSelector('#qna .question_text');
      check('split: viewer renders on the other origin', (await v4.$eval('#qna .question_text', e => e.textContent.trim())) === 'Cross-origin?');
      check('split: viewer cannot see editor storage', await v4.evaluate(() => localStorage.getItem('qna-split-probe') === null && localStorage.getItem('qna-editor-state') === null));
      const editBack = await v4.$eval('.qna-footer a.qna-edit-link', a => a.href);
      check('split: viewer footer links back to the editor origin', editBack.startsWith(ORG), editBack);
      await v4.goto(ORG + 'syntax/'); await v4.waitForTimeout(200);
      check('split: syntax page iframes/links point at the viewer origin', await v4.$$eval('iframe[src]', f => f.map(x => x.getAttribute('src'))).then(a => a.length > 0 && a.every(x => x.startsWith(NET + 'i/'))) && (await v4.$eval('a[href^="' + NET + 'i/?source=game"]', a => !!a).catch(() => false)));
      await v4.goto(NET + 'doc/?t=' + encodeURIComponent('<p>hi</p>') + '&i=x'); await v4.waitForTimeout(300);
      check('split: doc page links back to the editor origin', (await v4.$eval('#editor_link', a => a.href)) === ORG && (await v4.$eval('a[href="' + ORG + 'syntax/#docs"]', a => !!a).catch(() => false)));
      await v4.close();
      // the assembled deploy folders behave the same way
      require('child_process').execFileSync('node', [path.join(root, 'build.js'), '--site'], { stdio: 'ignore' });
      sA.close(); sB.close();
      sA = await listen(http.createServer(handler(path.join(root, 'site', 'org'))), 8000); sB = await listen(http.createServer(handler(path.join(root, 'site', 'net'))), 8001);
      await page.goto(ORG); await (await pv()).waitForSelector('.question_text');
      check('site/org: editor loads from the assembled folder', /Q\(1\.1\):/.test(await page.inputValue('#markup')));
      const siteLink = await page.inputValue('#link_text');
      const v5 = await ctx.newPage(); await v5.goto(siteLink); await v5.waitForSelector('#qna .question_text');
      check('site/net: viewer renders the editor\'s link', (await v5.$('#qna .question_text')) !== null);
      const ver = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).version;
      const rv = await v5.goto(ORG + 'dist/' + ver + '/qna.min.js');
      check('site/org: versioned library is published', rv.status() === 200 && /QnA Markup/.test(await rv.text()));
      const r404 = await v5.goto(NET + 'editor.js');
      check('site/net: carries no editor', r404.status() === 404);
      await v5.close();
      sA.close(); sB.close();
    }

    /* ---- scripts written in the markup run in every output ---- */
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(base); await (await pv()).waitForSelector('.question_text');
    const scriptQna = 'Title: Scripted\nBefore: <script>\nconst GREETING = "Hi";\nfunction greet(n) { return GREETING + ", " + n + "!"; }\n</script>\nAfter: <script>document.getElementById("conversation").setAttribute("data-after", greet("after"));</script>\n\nQ(1): <span id="o"></span><script>document.getElementById("o").textContent = greet("q");</script>\nA[javascript:document.getElementById("o").textContent = greet("button");]: Go\n\tQ(1.1): Done';
    const pvErr = []; page.on('console', m => { if (m.type() === 'error') pvErr.push(m.text()); });
    await page.fill('#markup', scriptQna); await page.click('#update'); await page.waitForTimeout(500);
    const scriptState = async f => ({ o: await f.$eval('#o', e => e.textContent), after: await f.$eval('#conversation', e => e.getAttribute('data-after')) });
    let ss = await scriptState(await pv());
    check('scripts: run in the editor preview (Before, After and Q)', ss.o === 'Hi, q!' && ss.after === 'Hi, after!', ss);
    // render again: the preview starts from a fresh page, so the top-level const does not collide with itself
    await page.fill('#markup', scriptQna.replace('"Hi"', '"Hey"')); await page.click('#update'); await page.waitForTimeout(900);
    ss = await scriptState(await pv());
    check('scripts: preview re-renders cleanly after a script has run (no "already declared")', ss.o === 'Hey, q!' && ss.after === 'Hey, after!' && !pvErr.some(t => /already been declared|SyntaxError/.test(t)), [ss, pvErr]);
    await (await pv()).click('a.qabutton'); await page.waitForTimeout(400);
    check('scripts: answer buttons reach functions defined in Before (preview)', await (await pv()).evaluate(() => typeof greet === 'function' && greet('x')) === 'Hey, x!');
    await page.selectOption('#output', 'embed'); await page.waitForTimeout(200);
    const scriptSnippet = await page.inputValue('#embed_text');
    check('scripts: embed code escapes closing script tags inside the markup', (scriptSnippet.match(/<\\\/script>/g) || []).length === 3 && (scriptSnippet.match(/<\/script>/g) || []).length === 2, scriptSnippet);
    await page.selectOption('#output', 'html'); await page.waitForTimeout(200); await page.check('#inline_lib'); await page.waitForTimeout(100);
    const sPage = await ctx.newPage(); const sErr = []; sPage.on('pageerror', e => sErr.push(String(e)));
    await sPage.setContent(await page.inputValue('#html_text')); await sPage.waitForSelector('.question_text');
    ss = await scriptState(sPage);
    check('scripts: run in the stand-alone HTML page', ss.o === 'Hey, q!' && ss.after === 'Hey, after!' && sErr.length === 0, [ss, sErr]);
    await sPage.click('a.qabutton'); await sPage.waitForTimeout(400);
    check('scripts: answer buttons reach Before functions in the stand-alone page', await sPage.evaluate(() => greet('z')) === 'Hey, z!' && sErr.length === 0, sErr);
    await sPage.close(); await page.uncheck('#inline_lib');
    await page.selectOption('#output', 'link'); await page.waitForTimeout(400);
    const sView = await ctx.newPage(); await sView.goto(await page.inputValue('#link_text')); await sView.waitForSelector('#qna .question_text');
    ss = await scriptState(sView);
    check('scripts: run in the viewer (shared link)', ss.o === 'Hey, q!' && ss.after === 'Hey, after!', ss);
    await sView.close();
    await page.selectOption('#output', 'flow'); await page.waitForTimeout(300);
    check('scripts: code stays out of flowchart boxes', await page.$$eval('#flow_canvas .qf-node text', t => !t.some(x => /getElementById|greet/.test(x.textContent))));
    await page.selectOption('#output', 'interact');

    /* ---- the interview may take the preview frame elsewhere; the editor offers a way BACK ---- */
    await page.goto(base); await (await pv()).waitForSelector('.question_text');
    const backShown = () => page.$eval('#preview_back', b => getComputedStyle(b).display !== 'none');
    check('back: no BACK bar while the preview shows the QnA', !(await backShown()));
    await page.fill('#markup', 'Q(name): Name?\nX:\n\tQ: Hi <x>name</x>. Where to?\n\tA[' + base + 'syntax/]: The docs, in this window\n\t\tQ: Welcome back, <x>name</x>.\n\tA:[' + base + 'syntax/] The docs, in a new window\n\t\tQ: Still here.\n\tA: Nowhere\n\t\tQ: <a id="lnk" href="' + base + 'examples/embed.html">a plain link</a>');
    await page.click('#update'); await page.waitForTimeout(400);
    await (await pv()).fill('input.xinput', 'Ada'); await (await pv()).press('input.xinput', 'Enter'); await page.waitForTimeout(600);
    const targets = await (await pv()).$$eval('a.qabutton', as => as.map(a => a.getAttribute('target')));
    check('back: A[href]: has no target, A:[href] asks for a new window, exactly as written', JSON.stringify(targets) === JSON.stringify([null, '_blank', null]), targets);
    let pops = 0; const onPop = () => pops++; ctx.on('page', onPop);
    await (await pv()).click('a.qabutton'); await page.waitForTimeout(1500);
    check('back: A[href]: changes the location of the preview frame (no new window)', pops === 0 && (await pv()).url() === base + 'syntax/', [(await pv()).url(), pops]);
    check('back: BACK bar appears once the frame has left the QnA', await backShown());
    const bar = await page.evaluate(() => { const b = document.getElementById('preview_back').getBoundingClientRect(), o = document.getElementById('out_interact').getBoundingClientRect(), f = document.getElementById('preview').getBoundingClientRect(); return { full: Math.abs(b.width - o.width) < 1 && Math.abs(b.left - o.left) < 1, top: Math.abs(b.top - o.top) < 1, above: Math.abs(f.top - b.bottom) < 1 && Math.abs(f.bottom - o.bottom) < 1, text: document.getElementById('preview_back').textContent }; });
    check('back: the bar spans the full width at the top of the frame', bar.full && bar.top && bar.above && /BACK/.test(bar.text), bar);
    // following a link inside the visited page keeps the bar
    await (await pv()).evaluate(u => { location.href = u; }, base + 'examples/embed.html'); await page.waitForTimeout(1500);
    check('back: bar stays while browsing on from there', await backShown() && /embed\.html$/.test((await pv()).url()));
    await page.click('#preview_back'); await page.waitForTimeout(1200);
    const resumed = await (await pv()).$$eval('#QandA .question_text, #QandA .ans_text', els => els.map(e => e.textContent.trim()));
    check('back: BACK returns to the interview where it left off', /preview\.html$/.test((await pv()).url()) && !(await backShown()) && JSON.stringify(resumed) === JSON.stringify(['Name?', 'Ada', 'Hi Ada. Where to?', 'The docs, in this window', 'Welcome back, Ada.']), resumed);
    // a plain link in a question leaves too; an update from the editor also brings the QnA back
    await (await pv()).click('.qna-back'); await page.waitForTimeout(300);
    await (await pv()).click('a.qabutton >> nth=2'); await page.waitForTimeout(600);
    await (await pv()).click('#lnk'); await page.waitForTimeout(1500);
    check('back: a link in a question also navigates the frame and raises the bar', await backShown() && /embed\.html$/.test((await pv()).url()));
    await page.click('#update'); await page.waitForTimeout(1200);
    check('back: Update Outputs brings the QnA back', !(await backShown()) && (await (await pv()).$eval('.question_text', e => e.textContent.trim())) === 'Name?');
    // the script-triggered reload of the preview must not raise the bar
    await page.fill('#markup', 'Before: <script>const Z = 1;</script>\nQ: one\nA: a\n\tQ: two'); await page.click('#update'); await page.waitForTimeout(500);
    await page.click('#update'); await page.waitForTimeout(1500);
    check('back: reloading the preview itself does not raise the bar', !(await backShown()) && (await (await pv()).$eval('.question_text', e => e.textContent.trim())) === 'one');
    ctx.off('page', onPop);

    /* ---- Save to File / Load File carry the Settings screen in a hidden Settings: tag ---- */
    await page.goto(base); await (await pv()).waitForSelector('.question_text');
    await page.fill('#markup', 'Title: Kept\nQ: Saved?\nA: Yes\n\tQ: Good.'); await page.click('#update'); await page.waitForTimeout(300);
    await page.click('.tab[data-tab=styleblock]').catch(() => {});
    await page.evaluate(() => { const set = (id, v) => { const e = document.getElementById(id); e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); }; set('fontSize', '17'); set('compBg', '224466'); set('footer', 'false'); });
    await page.click('#update'); await page.waitForTimeout(300);
    const [dlm] = await Promise.all([page.waitForEvent('download'), page.click('#save_markup')]);
    const savedTxt = fs.readFileSync(await dlm.path(), 'utf8');
    check('settings: saved file ends with the Settings: tag listing every setting', /^Title: Kept\nQ\(1\): Saved\?[\s\S]*\n\nSettings: fontFamily=[^\n]*; fontSize=17; [^\n]*compBg=224466; [^\n]*footer=false; saveProgress=false; start=1\n$/.test(savedTxt) && (savedTxt.match(/Settings:/g) || []).length === 1, savedTxt);
    check('settings: the tag never shows in the text area', !/Settings:/.test(await page.inputValue('#markup')));
    // back to defaults, then load the saved file
    await page.evaluate(() => { localStorage.clear(); }); await page.goto(base); await (await pv()).waitForSelector('.question_text');
    check('settings: (defaults before loading)', await page.inputValue('#fontSize') === '16' && await page.inputValue('#compBg') === '5489eb');
    await page.setInputFiles('#upload', { name: 'saved.txt', mimeType: 'text/plain', buffer: Buffer.from(savedTxt) }); await page.waitForTimeout(600);
    const afterLoad = { markup: await page.inputValue('#markup'), fs: await page.inputValue('#fontSize'), bg: await page.inputValue('#compBg'), footer: await page.inputValue('#footer'), pick: await page.$eval('input[type=color][data-for=compBg]', e => e.value) };
    check('settings: loading strips the tag and sets the Settings screen', !/Settings:/.test(afterLoad.markup) && /^Title: Kept\nQ\(1\): Saved\?/.test(afterLoad.markup) && afterLoad.fs === '17' && afterLoad.bg === '224466' && afterLoad.footer === 'false' && afterLoad.pick === '#224466', afterLoad);
    check('settings: and the preview is styled accordingly', await (await pv()).$eval('.question_text', e => getComputedStyle(e).backgroundColor + '|' + getComputedStyle(e).fontSize) === 'rgb(34, 68, 102)|17px');
    // a file without the tag leaves the Settings screen alone
    await page.setInputFiles('#upload', { name: 'plain.txt', mimeType: 'text/plain', buffer: Buffer.from('Q: Plain\nA: ok\n\tQ: fine') }); await page.waitForTimeout(600);
    check('settings: a file without the tag changes no settings', await page.inputValue('#fontSize') === '17' && /Q\(1\): Plain/.test(await page.inputValue('#markup')));
    // pasted text with a tag: ignored while typing, taken in on Update Outputs
    await page.fill('#markup', 'Q: Pasted\nA: ok\n\tQ: fine\n\nSettings: fontSize=21; radius=4'); await page.waitForTimeout(900);
    check('settings: a pasted tag is inert in the live preview', await (await pv()).$eval('.question_text', e => e.textContent.trim() + '|' + getComputedStyle(e).fontSize) === 'Pasted|17px' && !/Settings/.test(await (await pv()).$eval('#qna', e => e.innerText)));
    await page.click('#update'); await page.waitForTimeout(500);
    check('settings: Update Outputs takes a pasted tag in (other settings kept)', !/Settings:/.test(await page.inputValue('#markup')) && await page.inputValue('#fontSize') === '21' && await page.inputValue('#radius') === '4' && await page.inputValue('#compBg') === '224466');
    await page.selectOption('#output', 'embed').catch(() => {}); await page.uncheck('#inline_lib_embed'); await page.waitForTimeout(200);
    check('settings: embed code carries settings as attributes, not as a tag', !/Settings:/.test(await page.inputValue('#embed_text')) && /data-font-size="21"/.test(await page.inputValue('#embed_text')));
    await page.selectOption('#output', 'interact');
    await page.evaluate(() => { localStorage.clear(); });

    /* ---- chat style and button / link text on the Settings screen ---- */
    await page.goto(base); await (await pv()).waitForSelector('.question_text');
    await page.fill('#markup', 'Title: Chatty\nQ: Hello?\nA: Hi\n\tQ: Bye'); await page.click('#update'); await page.waitForTimeout(300);
    await page.click('.tab[data-tab=styleblock]').catch(() => {});
    const setField = (id, v) => page.evaluate(([id, v]) => { const e = document.getElementById(id); e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); }, [id, v]);
    await setField('compBg', '224466'); await setField('bodyBg', 'fafad2');
    check('chat: System Text fields enabled under SMS', !(await page.$eval('#compBg', e => e.disabled)));
    await page.selectOption('#chatStyle', 'llm');
    check('chat: LLM disables the System Text fields but keeps their values', await page.$eval('#compBg', e => e.disabled && e.value === '224466') && await page.$eval('input[type=color][data-for=compBg]', e => e.disabled) && await page.$eval('#compLink', e => e.disabled) && !(await page.$eval('#usrBg', e => e.disabled)) && !(await page.$eval('#chatStyle', e => e.disabled)));
    await setField('labelBack', 'Previous'); await setField('labelRestart', 'Again; please'); await setField('labelCode', 'make "one"'); await setField('labelEdit', '');
    check('labels: a blanked field shows the default again', await page.inputValue('#labelEdit') === 'edit');
    await page.click('#update'); await page.waitForTimeout(600);
    const pf = await pv(); await pf.click('a.qabutton'); await page.waitForTimeout(700);
    const chatPv = await pf.evaluate(() => { const q = getComputedStyle(document.querySelector('.question_text')); return { bg: q.backgroundColor, pad: q.padding, arrow: getComputedStyle(document.querySelector('.question_arrow')).display, ans: getComputedStyle(document.querySelector('.ans_text')).marginTop, back: document.querySelector('.qna-back').textContent, restart: document.querySelector('.qna-restart').textContent, footer: document.querySelector('.qna-footer > p').textContent }; });
    check('chat: preview shows LLM style', chatPv.bg === 'rgb(250, 250, 210)' && chatPv.pad === '8px 0px 0px' && chatPv.arrow === 'none' && chatPv.ans === '8px', chatPv);
    check('labels: preview shows the new text', chatPv.back === 'Previous' && chatPv.restart === 'Again; please' && chatPv.footer === 'credits | edit | make "one"', chatPv);
    const embedChat = await page.inputValue('#embed_text'), htmlChat = await page.inputValue('#html_text');
    check('chat + labels: in embed code and HTML page as data- attributes (saved System Text colour included)', [embedChat, htmlChat].every(t => /data-chat-style="llm"/.test(t) && /data-comp-bg="224466"/.test(t) && /data-label-back="Previous"/.test(t) && /data-label-restart="Again; please"/.test(t) && /data-label-code="make &quot;one&quot;"/.test(t) && !/data-label-edit/.test(t)), embedChat.slice(0, 600));
    // the link (compressed and plain) renders the same in the viewer
    const vc = await ctx.newPage();
    for (const mode of ['z', 'plain']) {
      await page.selectOption('#output', 'link'); await page.check('input[name=link_mode][value=' + mode + ']'); await page.waitForTimeout(400);
      const url = await page.inputValue('#link_text');
      await vc.goto('about:blank'); await vc.goto(url); await vc.waitForSelector('#qna .question_text'); await vc.click('#qna a.qabutton'); await vc.waitForTimeout(700);
      const got = await vc.evaluate(() => ({ arrow: getComputedStyle(document.querySelector('.question_arrow')).display, back: document.querySelector('.qna-back').textContent, restart: document.querySelector('.qna-restart').textContent, code: document.querySelector('.qna-code-link').textContent }));
      check('chat + labels: ' + mode + ' link carries them to the viewer', got.arrow === 'none' && got.back === 'Previous' && got.restart === 'Again; please' && got.code === 'make "one"' && (mode !== 'plain' || /chat_style=llm/.test(url) && /label_back=Previous/.test(url)), got);
    }
    await vc.close();
    await page.check('input[name=link_mode][value=z]'); await page.selectOption('#output', 'interact');
    // Save to File / Load File
    const [dlc] = await Promise.all([page.waitForEvent('download'), page.click('#save_markup')]);
    const savedChat = fs.readFileSync(await dlc.path(), 'utf8');
    check('chat + labels: saved in the Settings tag', /\nSettings: [^\n]*compBg=224466; [^\n]*chatStyle=llm; qShare=true; labelSave=Save above text as answer\.; labelEmpty=Your answer appears to be empty\.; labelBack=Previous; labelRestart=Again%3B please; labelCredits=credits; labelEdit=edit; labelEditWarn=You are about to edit a copy of this QnA\. Any edits will not change this instance\.; labelCode=make "one"; labelEarlier=Earlier you entered:; labelConfirm=It looks like you may have answered this before%3B click OK to use <x>answer<\/x> as your answer\.; footer=true; [^\n]*\n$/.test(savedChat), savedChat);
    await page.click('#restore'); await page.waitForTimeout(400);
    check('chat + labels: Restore Defaults returns to SMS and the standard text', await page.inputValue('#chatStyle') === 'sms' && !(await page.$eval('#compBg', e => e.disabled)) && await page.inputValue('#labelBack') === 'GO BACK ONE' && await page.inputValue('#compBg') === '5489eb');
    await page.setInputFiles('#upload', { name: 'chat.txt', mimeType: 'text/plain', buffer: Buffer.from(savedChat) }); await page.waitForTimeout(600);
    check('chat + labels: loading the file restores them', await page.inputValue('#chatStyle') === 'llm' && await page.$eval('#compBg', e => e.disabled && e.value === '224466') && await page.inputValue('#labelRestart') === 'Again; please' && await page.inputValue('#labelCode') === 'make "one"');
    await page.click('.tab[data-tab=styleblock]').catch(() => {});
    await page.selectOption('#chatStyle', 'sms'); await page.click('#update'); await page.waitForTimeout(600);
    check('chat: back to SMS, the old System Text colour is in use again', !(await page.$eval('#compBg', e => e.disabled)) && await (await pv()).$eval('.question_text', e => getComputedStyle(e).backgroundColor) === 'rgb(34, 68, 102)');
    // state survives a reload of the editor
    await page.selectOption('#chatStyle', 'llm'); await page.click('#update'); await page.waitForTimeout(400);
    await page.reload(); await (await pv()).waitForSelector('.question_text');
    check('chat + labels: remembered across an editor reload', await page.inputValue('#chatStyle') === 'llm' && await page.$eval('#compBg', e => e.disabled) && await page.inputValue('#labelBack') === 'Previous');
    await page.evaluate(() => { localStorage.clear(); });

    /* ---- loadQnA(): Settings cards, outputs, flowchart, preview ---- */
    {
      await page.goto(base); await (await pv()).waitForSelector('.question_text');
      await page.click('.tab[data-tab=styleblock]').catch(() => {});
      const legends = await page.$$eval('#styleblock fieldset legend', ls => ls.map(l => l.textContent));
      check('loadQnA settings: Q Sharing comes before Prior Answers, which sits next to Button Text', legends.indexOf('Q Sharing') === legends.indexOf('Prior Answers') - 1 && legends.indexOf('Prior Answers') === legends.indexOf('Button Text') - 1, legends);
      check('loadQnA settings: defaults', await page.inputValue('#qShare') === 'true' && await page.inputValue('#labelEarlier') === 'Earlier you entered:' && await page.inputValue('#labelConfirm') === 'It looks like you may have answered this before; click OK to use <x>answer</x> as your answer.' && !(await page.$eval('#labelEarlier', e => e.disabled)));
      await page.selectOption('#qShare', 'false'); await page.waitForTimeout(100);
      check('loadQnA settings: Q Sharing = No disables the Prior Answers card', await page.$eval('#labelEarlier', e => e.disabled) && await page.$eval('#labelConfirm', e => e.disabled) && await page.$eval('#prior_answers', e => e.classList.contains('off')));
      await page.selectOption('#qShare', 'true'); await page.waitForTimeout(100);
      check('loadQnA settings: … and Yes enables it again', !(await page.$eval('#labelEarlier', e => e.disabled)) && !(await page.$eval('#prior_answers', e => e.classList.contains('off'))));
      await setField('labelEarlier', 'You said:'); await setField('labelConfirm', 'Use <x>answer</x>; ok?'); await page.selectOption('#qShare', 'false'); await page.click('#update'); await page.waitForTimeout(500);
      const embedL = await page.inputValue('#embed_text');
      check('loadQnA settings: carried by embed code as data- attributes', /data-q-share="false"/.test(embedL) && /data-label-earlier="You said:"/.test(embedL) && /data-label-confirm="Use &lt;x&gt;answer&lt;\/x&gt;; ok\?"/.test(embedL), embedL.slice(0, 600));
      await page.selectOption('#output', 'link'); await page.check('input[name=link_mode][value=plain]'); await page.waitForTimeout(400);
      const plainL = await page.inputValue('#link_text');
      check('loadQnA settings: carried by the plain link', /&q_share=0/.test(plainL) && /&label_earlier=You%20said%3A/.test(plainL) && /&label_confirm=Use%20%3Cx%3Eanswer/.test(plainL), plainL);
      const vl = await ctx.newPage(); await vl.goto(plainL); await vl.waitForSelector('#qna .question_text');
      check('loadQnA settings: the viewer takes them from the link', await vl.evaluate(() => QnA.current.options.qShare === false && QnA.current.options.labelEarlier === 'You said:' && QnA.current.options.labelConfirm === 'Use <x>answer</x>; ok?'), await vl.evaluate(() => [QnA.current.options.qShare, QnA.current.options.labelEarlier, QnA.current.options.labelConfirm]));
      await vl.close();
      await page.check('input[name=link_mode][value=z]'); await page.selectOption('#output', 'interact');
      // the two alerts: empty X answer, edit link
      await page.click('.tab[data-tab=styleblock]').catch(() => {});
      await setField('labelEmpty', 'Say something!'); await setField('labelEditWarn', 'Copy; not the original.');
      await page.click('.tab[data-tab=codeblock]').catch(() => {});
      await page.fill('#markup', 'Title: T\nQ(name): Name?\nX:\n\tQ: Hi'); await page.click('#update'); await page.waitForTimeout(500);
      check('alerts: in the outputs as data- attributes', /data-label-empty="Say something!"/.test(await page.inputValue('#embed_text')) && /data-label-edit-warn="Copy; not the original\."/.test(await page.inputValue('#html_text')));
      const va = await ctx.newPage(); const heard = []; va.on('dialog', d => { heard.push(d.type() + ':' + d.message()); d.dismiss(); });
      await page.selectOption('#output', 'link'); await page.waitForTimeout(400);
      await va.goto(await page.inputValue('#link_text')); await va.waitForSelector('#qna input.xinput');
      await va.click('#qna .xbutton'); await va.waitForTimeout(200);
      await va.click('#qna .qna-edit-link'); await va.waitForTimeout(300);
      check('alerts: the empty-answer and edit-link alerts use the Settings text', heard.join('|') === 'alert:Say something!|alert:Copy; not the original.', heard);
      await va.close();
      await page.selectOption('#output', 'interact');
      const [dlL] = await Promise.all([page.waitForEvent('download'), page.click('#save_markup')]);
      const savedL = fs.readFileSync(await dlL.path(), 'utf8');
      await page.click('.tab[data-tab=styleblock]').catch(() => {});
      check('loadQnA settings: saved in the Settings tag (; in the text encoded)', /; qShare=false; labelSave=Save above text as answer\.; labelEmpty=Say something!; [^\n]*labelEditWarn=Copy%3B not the original\.; [^\n]*labelEarlier=You said:; labelConfirm=Use <x>answer<\/x>%3B ok\?; footer=true/.test(savedL), savedL.slice(-400));
      await page.click('#restore'); await page.waitForTimeout(300);
      check('loadQnA settings: Restore Defaults', await page.inputValue('#qShare') === 'true' && await page.inputValue('#labelEarlier') === 'Earlier you entered:' && await page.inputValue('#labelEmpty') === 'Your answer appears to be empty.' && await page.inputValue('#labelEditWarn') === 'You are about to edit a copy of this QnA. Any edits will not change this instance.');
      await page.setInputFiles('#upload', { name: 'share.txt', mimeType: 'text/plain', buffer: Buffer.from(savedL) }); await page.waitForTimeout(600);
      check('loadQnA settings: loading the file restores them', await page.inputValue('#qShare') === 'false' && await page.inputValue('#labelConfirm') === 'Use <x>answer</x>; ok?' && await page.$eval('#labelConfirm', e => e.disabled));
      await page.click('.tab[data-tab=styleblock]').catch(() => {});
      await page.click('#restore'); await page.waitForTimeout(300);

      // the flowchart: an External QnA box, JS GOTO edges (dotted) for literal targets
      await page.click('.tab[data-tab=codeblock]').catch(() => {});
      await page.fill('#markup', 'Q(a): Start\nA[javascript:loadQnA("https://example.com/qnas/sub.txt?x=1", "done", "end")]: load it\nA[javascript:goto("end")]: jump\n\tQ: never\nA[javascript:loadQnA(pickUrl())]: computed\nQ(end): The end <script>if (0) goto("a")</script>'); await page.click('#update'); await page.waitForTimeout(300);
      check('flow loadQnA: the markup is well formed', await page.$eval('#status', e => e.className) === 'ok');
      await page.selectOption('#output', 'flow'); await page.waitForTimeout(400);
      const fl2 = await page.evaluate(() => {
        const ext = [...document.querySelectorAll('#flow_canvas .qf-node.qf-external')].map(n => [...n.querySelectorAll('text')].map(t => t.textContent.trim()).filter(Boolean).join(' '));
        const js = [...document.querySelectorAll('#flow_canvas .qf-edge.qf-jsgoto')].map(e => getComputedStyle(e).strokeDasharray);
        const labels = [...document.querySelectorAll('#flow_canvas .qf-label')].map(t => t.textContent + '|' + t.getAttribute('class'));
        const gotoDash = [...document.querySelectorAll('#flow_canvas .qf-edge.qf-goto')].map(e => getComputedStyle(e).strokeDasharray);
        return { ext, js, labels, gotoDash, keys: [...document.querySelectorAll('#flow_canvas .qf-handle')].map(h => h.getAttribute('data-edge')) };
      });
      check('flow loadQnA: an External QnA box per loading answer, captioned with the file name when known', fl2.ext.length === 2 && fl2.ext[0] === 'External QnA sub.txt' && fl2.ext[1] === 'External QnA', fl2.ext);
      check('flow loadQnA: JS GOTO edges are dotted (not the GOTO dash), one from the box back to "end", one for goto("end"), one for the Q script', fl2.js.length === 3 && fl2.js.every(d => d === '1.5px, 4px') && fl2.labels.filter(l => l === 'JS GOTO|qf-label qf-jsgoto').length === 3 && fl2.keys.indexOf('r:1.1:2') >= 0 && fl2.keys.indexOf('j:1:2') >= 0 && fl2.keys.indexOf('j:2:1') >= 0, fl2);
      const xm = await page.$eval('#flow_canvas .qf-node[data-id="ext-1.1"] rect', r => { const b = r.getBoundingClientRect(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; });
      await page.mouse.move(xm.x, xm.y); await page.mouse.down(); await page.mouse.move(xm.x + 70, xm.y + 25, { steps: 6 }); await page.mouse.up();
      const xm2 = await page.$eval('#flow_canvas .qf-node[data-id="ext-1.1"] rect', r => { const b = r.getBoundingClientRect(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; });
      check('flow loadQnA: the External QnA box is draggable by its middle', Math.abs(xm2.x - xm.x - 70) < 3 && Math.abs(xm2.y - xm.y - 25) < 3, [xm, xm2]);
      await page.selectOption('#output', 'interact');
      // the parser's error in the editor
      await page.fill('#markup', 'Q: Start\nA[javascript:loadQnA("x.txt")]: load\n\tQ: under it\nQ: b\nA: k'); await page.waitForTimeout(600);
      check('loadQnA: a Q under a loading answer is reported', await page.$eval('#status', e => e.className) === 'err' && /Line 3:[\s\S]*cannot have a Q beneath it/.test(await (await pv()).$eval('#qna', e => e.innerText)), await (await pv()).$eval('#qna', e => e.innerText.slice(0, 200)));
      // the preview (a sandboxed frame) loads a QnA from this server
      await page.fill('#markup', 'Q(name): Name?\nX:\n\tQ: Load?\n\tA[javascript:loadQnA("' + base + 'test/fixtures_runtime/load_sub2.txt")]: go'); await page.click('#update'); await page.waitForTimeout(500);
      let lf = await pv(); await lf.fill('input.xinput', 'Ida'); await lf.press('input.xinput', 'Enter'); await page.waitForTimeout(700);
      lf = await pv(); await lf.click('a.qabutton'); await page.waitForTimeout(1200);
      lf = await pv();
      const lb = await lf.$$eval('.question_text, .ans_text', els => els.map(e => e.textContent.trim()));
      check('loadQnA: works in the editor\'s preview', lb.join('|') === 'Name?|Ida|Load?|go|(Sub2) One.' && await lf.$eval('a.qabutton', e => e.textContent.trim()) === 'two', lb);
      await lf.click('a.qabutton'); await page.waitForTimeout(700); lf = await pv();
      check('loadQnA: goto(2) inside the loaded QnA, and its own <x>1</x>', (await lf.$$eval('.question_text, .ans_text', els => els.map(e => e.textContent.trim()))).slice(-2).join('|') === 'two|(Sub2) Two. two');
      await page.fill('#markup', 'Q: a\nA: b\n\tQ: c'); await page.click('#update'); await page.waitForTimeout(300);
    }


    /* ---- Button Body and Borders on the Settings screen ---- */
    await page.goto(base); await (await pv()).waitForSelector('.question_text');
    await page.fill('#markup', 'Title: Buttons\nQ: Hello?\nA: Hi\n\tQ: Bye'); await page.click('#update'); await page.waitForTimeout(300);
    await page.click('.tab[data-tab=styleblock]').catch(() => {});
    check('buttons: Button Body and Borders cards sit before Button Text with the default values', await page.evaluate(() => { const f = document.getElementById('button_body'), b = document.getElementById('borders'); const legends = [...document.querySelectorAll('#styleblock fieldset legend')].map(l => l.textContent); return f.querySelector('legend').textContent === 'Button Body' && f.nextElementSibling === b && b.querySelector('legend').textContent === 'Borders' && legends.indexOf('Borders') < legends.indexOf('Button Text') && !f.querySelector('#btnDivider') && b.querySelector('#btnBorder') && b.querySelector('#btnDivider') && f.querySelector('#btnBold') && document.getElementById('btnBorder').value === '888888' && document.getElementById('btnBg').value === 'eeeeee' && document.getElementById('btnTxt').value === '000000' && document.getElementById('btnDivider').value === 'dddddd' && !document.getElementById('btnBold').checked && document.querySelector('input[type=color][data-for=btnDivider]').value === '#dddddd'; }));
    const embedPlain = await (async () => { await page.selectOption('#output', 'embed'); return page.inputValue('#embed_text'); })();
    check('buttons: defaults write nothing into the outputs', !/data-btn/.test(embedPlain), embedPlain.slice(0, 300));
    await page.selectOption('#output', 'interact');
    await setField('btnBg', '102030'); await setField('btnTxt', 'ffeedd'); await setField('btnDivider', 'aa0000'); await setField('btnBorder', '00aa55');
    await page.check('#btnBold'); await page.waitForTimeout(900);
    const btnPv = await (await pv()).evaluate(async () => { const g = s => getComputedStyle(document.querySelector(s)); const first = { bg: g('.qabutton').backgroundColor, txt: g('.qabutton').color, w: g('.qabutton').fontWeight };
      document.querySelector('.qabutton').click(); for (let i = 0; i < 40 && !document.querySelector('.sbutton'); i++) await new Promise(r => setTimeout(r, 100));
      return { bg: first.bg, txt: first.txt, w: first.w, border: g('.sbutton').borderTopColor, sbg: g('.sbutton').backgroundColor, std: g('.standard_buttons').borderTopColor, foot: g('.qna-footer').borderTopColor }; });
    check('buttons: live preview shows colours, bold, border and divider', btnPv.border === 'rgb(0, 170, 85)' && btnPv.bg === 'rgb(16, 32, 48)' && btnPv.txt === 'rgb(255, 238, 221)' && btnPv.w === '700' && btnPv.sbg === 'rgb(16, 32, 48)' && btnPv.std === 'rgb(170, 0, 0)' && btnPv.foot === 'rgb(170, 0, 0)', btnPv);
    check('buttons: colour picker follows the hex field', await page.$eval('input[type=color][data-for=btnBg]', e => e.value) === '#102030');
    await page.click('#update'); await page.waitForTimeout(400);
    await page.selectOption('#output', 'embed'); const embedBtn = await page.inputValue('#embed_text');
    await page.selectOption('#output', 'html'); const htmlBtn = await page.inputValue('#html_text');
    check('buttons: in embed code and HTML page as data- attributes', [embedBtn, htmlBtn].every(t => /data-btn-bg="102030"/.test(t) && /data-btn-txt="ffeedd"/.test(t) && /data-btn-bold="true"/.test(t) && /data-btn-border="00aa55"/.test(t) && /data-btn-divider="aa0000"/.test(t)), embedBtn.slice(0, 600));
    await page.selectOption('#output', 'link');
    for (const mode of ['z', 'plain']) {
      await page.check('input[name=link_mode][value=' + mode + ']'); await page.waitForTimeout(400);
      const url = await page.inputValue('#link_text');
      const v = await ctx.newPage(); await v.goto(url); await v.waitForSelector('.qabutton');
      const got = await v.evaluate(async () => { const g = s => getComputedStyle(document.querySelector(s)); const first = { bg: g('.qabutton').backgroundColor, w: g('.qabutton').fontWeight };
        document.querySelector('.qabutton').click(); for (let i = 0; i < 40 && !document.querySelector('.sbutton'); i++) await new Promise(r => setTimeout(r, 100));
        return { bg: first.bg, w: first.w, border: g('.sbutton').borderTopColor, std: g('.standard_buttons').borderTopColor }; });
      await v.close();
      check('buttons: ' + mode + ' link carries them to the viewer', got.bg === 'rgb(16, 32, 48)' && got.w === '700' && got.border === 'rgb(0, 170, 85)' && (mode !== 'plain' || /btn_border=00aa55/.test(url)) && got.std === 'rgb(170, 0, 0)' && (mode !== 'plain' || /btn_bg=102030/.test(url) && /btn_bold=1/.test(url) && /btn_divider=aa0000/.test(url)), got);
    }
    await page.check('input[name=link_mode][value=z]');
    const savedBtn = await page.evaluate(() => window.markupForFile());
    check('buttons: saved in the Settings tag', /\nSettings: [^\n]*bodyLink=0000ff; btnBg=102030; btnTxt=ffeedd; btnBold=true; btnBorder=00aa55; btnDivider=aa0000; chatStyle=sms; /.test(savedBtn), savedBtn);
    await page.selectOption('#output', 'interact'); await page.waitForTimeout(300);
    await page.reload(); await (await pv()).waitForSelector('.question_text');
    check('buttons: remembered across an editor reload', await page.inputValue('#btnBg') === '102030' && await page.isChecked('#btnBold') && await page.inputValue('#btnBorder') === '00aa55' && await page.inputValue('#btnDivider') === 'aa0000');
    await page.click('.tab[data-tab=styleblock]').catch(() => {});
    await page.click('#restore'); await page.waitForTimeout(300);
    check('buttons: Restore Defaults resets them', await page.inputValue('#btnBg') === 'eeeeee' && await page.inputValue('#btnTxt') === '000000' && !(await page.isChecked('#btnBold')) && await page.inputValue('#btnBorder') === '888888' && await page.inputValue('#btnDivider') === 'dddddd');
    await page.waitForTimeout(1500);   // let any pending live update (which saves the state) finish before clearing
    await page.evaluate(() => { localStorage.clear(); });

    /* ---- a link too long to work: no "open" shortcut, a warning in the Link pane ---- */
    await page.goto(base); await (await pv()).waitForSelector('.question_text');
    await page.click('.tab[data-tab=codeblock]').catch(() => {});
    const linkState = async () => page.evaluate(() => ({ open: getComputedStyle(document.getElementById('open_output')).display, warn: getComputedStyle(document.getElementById('link_warn')).display, text: document.getElementById('link_warn').textContent, len: document.getElementById('link_text').value.length, href: document.getElementById('link_a').getAttribute('href').length, first: document.getElementById('out_link').firstElementChild.id }));
    await page.fill('#markup', 'Q: Short?\nA: Yes\n\tQ: ok'); await page.click('#update'); await page.waitForTimeout(500);
    await page.selectOption('#output', 'link'); await page.waitForTimeout(300);
    const ll0 = await linkState();
    check('long link: a short link has the open shortcut and no warning', ll0.open !== 'none' && ll0.warn === 'none' && ll0.first === 'link_warn', ll0);
    // ~9,000 characters of repetitive text: too long as plain text, tiny once compressed
    await page.fill('#markup', 'Q: ' + 'Is this long? '.repeat(650) + '\nA: Yes\n\tQ: ok'); await page.click('#update'); await page.waitForTimeout(600);
    const ll1 = await linkState();
    check('long link: compressed form of a repetitive QnA is still fine', ll1.open !== 'none' && ll1.warn === 'none' && ll1.len < 8000, ll1);
    await page.check('input[name=link_mode][value=plain]'); await page.waitForTimeout(400);
    const ll2 = await linkState();
    check('long link: plain form over the limit hides open and warns (link still in the pane)', ll2.open === 'none' && ll2.warn === 'block' && /too long/.test(ll2.text) && /414/.test(ll2.text) && /compressed/.test(ll2.text) && ll2.len > 8000 && ll2.href === ll2.len, ll2);
    await page.check('input[name=link_mode][value=z]'); await page.waitForTimeout(400);
    const ll3 = await linkState();
    check('long link: switching back to compressed restores the shortcut', ll3.open !== 'none' && ll3.warn === 'none', ll3);
    // incompressible text: too long even compressed
    await page.evaluate(() => { let s = ''; const a = new Uint32Array(1); for (let i = 0; i < 6000; i++) { crypto.getRandomValues(a); s += a[0].toString(36) + ' '; } const t = document.getElementById('markup'); t.value = 'Q: ' + s + '\nA: Yes\n\tQ: ok'; });
    await page.click('#update'); await page.waitForTimeout(900);
    const ll4 = await linkState();
    check('long link: compressed form over the limit hides open and warns', ll4.open === 'none' && ll4.warn === 'block' && ll4.len > 32000 && /browsers/.test(ll4.text) && !/414/.test(ll4.text), { open: ll4.open, warn: ll4.warn, len: ll4.len });
    await page.fill('#markup', 'Q: Short?\nA: Yes\n\tQ: ok'); await page.click('#update'); await page.waitForTimeout(600);
    const ll5 = await linkState();
    check('long link: a short QnA again clears it', ll5.open !== 'none' && ll5.warn === 'none', ll5);
    await page.selectOption('#output', 'interact'); await page.waitForTimeout(1500);
    await page.evaluate(() => { localStorage.clear(); });

    /* ---- config.js sets the Settings screen's defaults ---- */
    const cfgSrc = fs.readFileSync(path.join(root, 'config.js'), 'utf8');
    const cfgMod = cfgSrc.replace("fontSize: 16,", "font_size: 18,").replace("chatStyle: 'sms',", "chatStyle: 'llm',").replace("labelBack: 'GO BACK ONE',", "labelBack: 'Previous',").replace("compBg: '5489eb',", "compBg: 'not a colour', editorUrl: 'https://evil.example/',").replace("start: '1',", "start: '1',");
    check('config: (test fixture applies)', cfgMod !== cfgSrc && /font_size: 18/.test(cfgMod) && /'llm'/.test(cfgMod));
    const cpage = await ctx.newPage();
    await cpage.route('**/config.js', r => r.fulfill({ contentType: 'application/javascript', body: cfgMod }));
    await cpage.goto(base); await cpage.waitForTimeout(1200);
    await cpage.evaluate(() => localStorage.clear()); await cpage.reload(); await cpage.waitForTimeout(1200);
    const cval = async () => ({ fs: await cpage.inputValue('#fontSize'), chat: await cpage.inputValue('#chatStyle'), back: await cpage.inputValue('#labelBack'), bg: await cpage.inputValue('#compBg'), off: await cpage.$eval('#compBg', e => e.disabled) });
    const c1 = await cval();
    check('config: a first visit starts from the defaults in config.js (snake_case too; invalid values fall back)', c1.fs === '18' && c1.chat === 'llm' && c1.back === 'Previous' && c1.bg === '5489eb' && c1.off, c1);
    await cpage.click('#update'); await cpage.waitForTimeout(500);
    await cpage.selectOption('#output', 'embed'); await cpage.uncheck('#inline_lib_embed'); await cpage.waitForTimeout(100);   // (the library's own source would match the patterns below)
    const cEmbed = await cpage.inputValue('#embed_text');
    await cpage.selectOption('#output', 'interact');
    check('config: outputs carry them, since the library has its own defaults', /data-font-size="18"/.test(cEmbed) && /data-chat-style="llm"/.test(cEmbed) && /data-label-back="Previous"/.test(cEmbed) && !/evil/.test(cEmbed) && !/data-comp-bg/.test(cEmbed), cEmbed.slice(0, 400));
    await cpage.click('.tab[data-tab=styleblock]').catch(() => {});
    await cpage.fill('#fontSize', '22'); await cpage.selectOption('#chatStyle', 'sms'); await cpage.fill('#labelBack', ''); await cpage.dispatchEvent('#labelBack', 'change');
    check('config: a blanked label returns to the configured default', await cpage.inputValue('#labelBack') === 'Previous');
    await cpage.click('#restore'); await cpage.waitForTimeout(400);
    const c2 = await cval();
    check('config: Restore Defaults returns to the configured defaults', c2.fs === '18' && c2.chat === 'llm' && c2.off, c2);
    // a QnA opened from a link is shown as it renders: unmentioned settings are the library's defaults
    await cpage.goto('about:blank'); await cpage.goto(base + '#j=' + encodeURIComponent(JSON.stringify({ markup: 'Q: linked\nA: ok\n\tQ: fine', radius: 3 }))); await cpage.waitForTimeout(1200);
    const c3 = await cval();
    check('config: a QnA opened from a link keeps the library defaults for what it does not set', c3.fs === '16' && c3.chat === 'sms' && c3.back === 'GO BACK ONE' && await cpage.inputValue('#radius') === '3', c3);
    await cpage.evaluate(() => localStorage.clear()); await cpage.close();

    /* ---- X[javascript:...] in the editor ---- */
    await page.evaluate(() => { localStorage.clear(); }); await page.goto(base); await (await pv()).waitForSelector('.question_text');
    await page.click('.tab[data-tab=codeblock]').catch(() => {});
    await page.fill('#markup', 'Q(name): Name?\nX[javascript:\n\t// note\n\tdocument.title = "for " + document.getElementById("name").value;\n]:\n\tQ: Hi <x>name</x>'); await page.click('#update'); await page.waitForTimeout(1200);
    check('x script: editor accepts a multi-line X[javascript:] and keeps it in the code', await page.$eval('#status', e => e.className === 'ok') && /^Q\(name\): Name\?\nX\[javascript:\n\t\/\/ note\n/.test(await page.inputValue('#markup')));
    const xhl = await page.evaluate(() => { const h = document.getElementById('hl'); const c = cls => Array.from(h.querySelectorAll('.' + cls)).map(e => e.textContent); return { t: c('t'), p: c('p'), b: c('b') }; });
    check('x script: highlighted like an A bracket (tag blue, code red, across lines)', JSON.stringify(xhl.t) === '["Q","X","Q"]' && xhl.p.some(t => /^javascript:$/.test(t)) && xhl.p.some(t => /document\.title/.test(t)) && xhl.b.filter(t => t === '[' || t === ']').length === 2, xhl);
    const xf = await pv(); await xf.fill('input.xinput', 'Ada'); await xf.press('input.xinput', 'Enter'); await page.waitForTimeout(700);
    check('x script: runs in the preview after the variable is saved', await xf.evaluate(() => document.title) === 'for Ada' && /Hi Ada/.test(await xf.$eval('#qna', e => e.innerText)));
    await page.fill('#markup', 'Q(name): Name?\nX[]:\n\tQ: Hi'); await page.click('#update'); await page.waitForTimeout(700);
    check('x script: empty brackets are reported with the line', await page.$eval('#status', e => e.className === 'err') && /Line 2:[\s\S]*empty/.test(await (await pv()).$eval('#qna', e => e.innerText)));
    await page.evaluate(() => { localStorage.clear(); });

    /* ---- word wrap with a scrollbar that takes up room: the coloured layer must wrap exactly as the textarea does ---- */
    {
      // headless Chromium hides scrollbars by default; this browser shows classic 15px ones, as Windows/Linux and macOS-with-a-mouse do
      const sbBrowser = await chromium.launch({ ignoreDefaultArgs: ['--hide-scrollbars'] });
      const sp = await (await sbBrowser.newContext({ viewport: { width: 1300, height: 700 } })).newPage();
      await sp.goto(base); await sp.waitForTimeout(1200);
      await sp.addStyleTag({ content: '#markup::-webkit-scrollbar{width:15px;height:15px}' });
      await sp.check('#wrap');
      const longUrl = 'https://www.example.com/' + 'averyveryverylongpathsegmentwithoutanybreaks'.repeat(6) + '?x=1';
      await sp.fill('#markup', Array.from({ length: 60 }, (_, i) => 'Q(' + (i + 1) + '): See <a href="' + longUrl + '">this link</a> please\nA: ok').join('\n')); await sp.waitForTimeout(500);
      const wr = await sp.evaluate(() => { const ta = document.getElementById('markup'), hl = document.getElementById('hl'); const box = e => { const c = getComputedStyle(e); return e.clientWidth - parseFloat(c.paddingLeft) - parseFloat(c.paddingRight); };
        // where the first line's text actually wraps in the layer, against a plain mirror of the textarea's text column
        const breaks = el => { const r = document.createRange(), out = []; let top = null, n = 0; const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT); let t; while ((t = w.nextNode())) for (let i = 0; i < t.length; i++, n++) { r.setStart(t, i); r.setEnd(t, i + 1); const rc = r.getClientRects()[0]; if (!rc || !rc.width) continue; if (top !== null && rc.top > top + 2) out.push(n); top = rc.top; } return out; };
        const m = document.createElement('div'), cs = getComputedStyle(ta); m.style.cssText = 'position:absolute;visibility:hidden;left:0;top:0;box-sizing:content-box;padding:0;border:0;'; ['font', 'tabSize', 'whiteSpace', 'overflowWrap', 'wordBreak', 'letterSpacing'].forEach(k => { m.style[k] = cs[k]; }); m.style.width = box(ta) + 'px'; m.textContent = ta.value.split('\n')[0]; document.body.appendChild(m);
        const res = { bar: ta.offsetWidth - ta.clientWidth, ta: box(ta), hl: box(hl), hlBreaks: breaks(hl.querySelector('.ln')), taBreaks: breaks(m) }; m.remove(); return res; });
      check('wrap: (test browser shows a scrollbar that takes up room)', wr.bar > 0, wr);
      check('wrap: highlight layer has the same text column as the textarea beside a scrollbar', wr.ta === wr.hl, wr);
      check('wrap: a long URL breaks at the same characters in both', wr.hlBreaks.length >= 2 && JSON.stringify(wr.hlBreaks) === JSON.stringify(wr.taBreaks), wr);
      await sp.fill('#markup', 'Q: short\nA: ok\n\tQ: done'); await sp.waitForTimeout(400);
      const wr2 = await sp.evaluate(() => { const ta = document.getElementById('markup'), hl = document.getElementById('hl'); return { bar: ta.offsetWidth - ta.clientWidth, padR: getComputedStyle(hl).paddingRight, taPadR: getComputedStyle(ta).paddingRight }; });
      check('wrap: the extra padding goes away with the scrollbar', wr2.bar === 0 && wr2.padR === wr2.taPadR, wr2);
      await sbBrowser.close();
    }

    check('no page errors', errors.length === 0, errors);
  } catch (e) { failed++; console.error(e); }
  await browser.close(); server.close();
  console.log(failed ? `\n${failed} failure(s)` : '\nAll e2e tests passed.');
  process.exit(failed ? 1 : 0);
});
