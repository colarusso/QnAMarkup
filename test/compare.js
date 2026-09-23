// Compare QnA.parse() against the original PHP parser (test/oracle/run.php).
// Usage: node test/compare.js
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const QnA = require('../src/qna.js');

const fixDir = path.join(__dirname, 'fixtures');
const tplDir = path.join(__dirname, 'oracle', 'templates');
const corpDir = path.join(__dirname, 'corpus');
// test/corpus holds real QnAs from the public gallery, written by other people; it is not part of the
// public repository (see README), so the comparison simply runs without it when the folder is absent.
const ls = d => fs.existsSync(d) ? fs.readdirSync(d).map(f => path.join(d, f)) : [];
if (!fs.existsSync(corpDir)) console.log('(test/corpus not present — comparing templates and fixtures only)');
const files = [...ls(tplDir), ...ls(fixDir), ...ls(corpDir)].filter(f => f.endsWith('.txt'));

// Documented, intentional deviations from the PHP implementation.
const KNOWN = {
  'renumber.txt': 'JS renumbers GOTOs whose numeric targets moved (PHP never did; the code path was dead).',
  'aparens.txt': 'A(): yields an empty value as documented (PHP fell back to the button text).',
  'header_pre.txt': 'Header tags are parsed correctly when text precedes them (PHP mis-assigned them).',
  'crlf.txt': 'CRLF is normalised to LF.',
  'atags.txt': 'Indentation is structural: a tag indented deeper than the previous one is one level deeper however much whitespace is used (PHP demanded exactly one more tab).',
  'spaces.txt': 'Spaces are accepted as indentation (PHP only recognised tabs, so this parses as a single Q/A there).',
  'err_indent.txt': 'A dedent that lines up with no earlier tag is an error (PHP saw the space-indented lines as text).',
  'LASM-2016__rights_school.txt': 'This gallery QnA is indented with spaces; it now parses as intended (PHP treated its nested tags as text).',
  'err_gotoina.txt': 'GOTO targets are also validated against the ids Qs will receive (GOTO:1 with an unlabeled first Q is fine); the GOTO-in-A error is still raised.',
  'err_gotodup.txt': 'Duplicate-name error reported once per Q (PHP repeated it).',
  'santa.txt': 'A(): yields an empty value as documented (PHP fell back to the button text); text after X: is a warning since 2.5.0, not an error.',
  'law_journal.txt': 'Text after X: (the pre-2016 X:name form) is a warning since 2.5.0, not an error, so the QnA is well formed.',
  'err_xtext.txt': 'Text after X: is a warning since 2.5.0, not an error (result.warnings); the code is normalised as before.',
  'xnumber.txt': 'X:number (2.5.0) makes the field a number input; PHP reported it as text after X.',
  'santa_letter.txt': 'A(): yields an empty value as documented (PHP fell back to the button text).',
  'LASM-2016__musical_producer.txt': 'GOTO targets containing uppercase letters are validated; PHP skipped them (GOTO:Not has no target and broke at runtime).',
};

const strip = s => String(s).replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
let failures = 0;

for (const file of files) {
  const name = path.basename(file);
  const markup = fs.readFileSync(file, 'utf8');
  const php = JSON.parse(execFileSync('php', ['run.php', file], { cwd: path.join(__dirname, 'oracle') }).toString());
  const js = QnA.parse(markup);
  const diffs = [];

  const phpOk = String(php.wellformed) === '1';
  if (phpOk !== js.ok) diffs.push(`wellformed php=${phpOk} js=${js.ok}`);

  // Error kinds: compare first sentence of each error, as multisets.
  const kinds = s => strip(s).split(/(?<=\.)\s+(?=[A-Z])/).map(x => x.split('.')[0]).filter(Boolean);
  const phpErr = (php.errormsg.match(/<li class="error">(.*?)<\/li>/gs) || []).map(x => strip(x).split(/[.:]/)[0]);
  // the JS wording of the GOTO errors was refreshed; map it back to the PHP kinds for comparison
  const rewordings = [
    ['The target of this GOTO does not exist (or was removed)', 'The target of a GOTO call is missing/was removed'],
    ['The target of this GOTO appears more than once, so the call was disabled', 'The target of a GOTO showed up more than once'],
    ['Poorly-formed GOTO call: GOTO must be the last thing in a Q tag, written GOTO:target', 'Poorly-formed GOTO call'],
  ];
  const jsErr = js.errors.map(e => { let m = strip(e.message); for (const [a, b] of rewordings) if (m.startsWith(a)) m = b + m.slice(a.length); return m.split(/[.:]/)[0]; });
  if (JSON.stringify([...new Set(phpErr)].sort()) !== JSON.stringify([...new Set(jsErr)].sort()))
    diffs.push(`error kinds php=${JSON.stringify([...new Set(phpErr)])} js=${JSON.stringify([...new Set(jsErr)])}`);

  if (php.code !== js.code) diffs.push(`code differs:\n  php=${JSON.stringify(php.code)}\n  js =${JSON.stringify(js.code)}`);

  // Questions: label + text (+ doc)
  const pq = (php.questions || []).map(q => [String(q[0]), q[1], q[3] === undefined ? null : q[3]]);
  const jq = js.questions.map(q => [q.label, q.text, q.doc]);
  if (JSON.stringify(pq) !== JSON.stringify(jq)) diffs.push(`questions differ:\n  php=${JSON.stringify(pq)}\n  js =${JSON.stringify(jq)}`);

  // Answers: label, text, href, target, value
  const pa = (php.answers || []).map(a => [String(a[0]), a[1], a[2], a[3] ? '_blank' : '', a[4]]);
  const ja = js.answers.map(a => [a.label, a.text, a.href, a.target, a.isVar ? a.label : a.value]);
  if (JSON.stringify(pa) !== JSON.stringify(ja)) diffs.push(`answers differ:\n  php=${JSON.stringify(pa)}\n  js =${JSON.stringify(ja)}`);

  const pn = (php.qvarname || []).map(p => [String(p[0]), String(p[1])]);
  if (JSON.stringify(pn) !== JSON.stringify(js.names)) diffs.push(`names differ:\n  php=${JSON.stringify(pn)}\n  js =${JSON.stringify(js.names)}`);

  for (const k of ['title', 'author', 'description', 'before', 'after']) {
    let pv = php[k] == null ? '' : php[k];
    if (k === 'title' || k === 'author' || k === 'description') pv = pv.trim();
    if (pv !== js.header[k]) diffs.push(`header ${k}: php=${JSON.stringify(pv)} js=${JSON.stringify(js.header[k])}`);
  }

  if (!diffs.length) console.log(`PASS  ${name}`);
  else if (KNOWN[name]) console.log(`KNOWN ${name} — ${KNOWN[name]}\n      ` + diffs.join('\n      ').slice(0, 600));
  else { failures++; console.log(`FAIL  ${name}\n  ` + diffs.join('\n  ')); }
}
// The qna-markup skill's examples and the QnA snippets in its SKILL.md / reference.md must parse
// (they are what an assistant patterns its output on; the build checks the examples too).
{
  const skill = path.join(__dirname, '..', 'skills', 'qna-markup');
  const items = ls(path.join(skill, 'examples')).filter(f => f.endsWith('.txt')).map(f => [path.basename(f), fs.readFileSync(f, 'utf8')]);
  for (const md of ['SKILL.md', 'reference.md']) {
    const text = fs.readFileSync(path.join(skill, md), 'utf8');
    [...text.matchAll(/```\n([\s\S]*?)```/g)].map(m => m[1]).filter(b => /^(Title|Q)/m.test(b)).forEach((b, i) => items.push([md + ' snippet ' + (i + 1), b]));
  }
  for (const [name, text] of items) {
    const r = QnA.parse(text);
    if (r.ok) console.log('PASS  skill: ' + name);
    else { failures++; console.log('FAIL  skill: ' + name + '\n  ' + r.errors.map(e => (e.line ? 'line ' + e.line + ': ' : '') + e.message.replace(/<[^>]*>/g, '')).join('\n  ')); }
  }
}
console.log(failures ? `\n${failures} unexpected failure(s)` : '\nAll fixtures match (apart from documented deviations).');
process.exit(failures ? 1 : 0);
