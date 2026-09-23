#!/usr/bin/env node
// Checks QnA Markup files with the interpreter's own parser and prints its error messages with
// line numbers, or "OK" with the question count.  Usage: node check.js file.txt [more.txt ...]
// Needs qna.js next to this script (a copy of dist/qna.js from github.com/colarusso/QnAMarkup;
// the published skill ships one). Exit status 1 when any file has errors.
const fs = require('fs'), path = require('path');
let QnA;
try { QnA = require(path.join(__dirname, 'qna.js')); }
catch (e) { console.error('qna.js is missing next to check.js: copy dist/qna.js from the QnAMarkup repository there.'); process.exit(2); }
const files = process.argv.slice(2);
if (!files.length) { console.error('usage: node check.js file.txt [...]'); process.exit(2); }
let bad = 0;
for (const f of files) {
  const r = QnA.parse(fs.readFileSync(f, 'utf8'));
  if (r.ok) { console.log(f + ': OK (' + r.questions.length + ' questions, ' + r.answers.length + ' answers)'); continue; }
  bad++;
  console.log(f + ': ' + r.errors.length + ' error(s)');
  for (const e of r.errors) console.log('  ' + (e.line ? 'line ' + e.line + ': ' : '') + e.message.replace(/<[^>]*>/g, '') + (e.near ? '\n      near: ' + e.near : ''));
}
process.exit(bad ? 1 : 0);
