---
name: qna-markup
description: Write, edit, review or convert content into QnA Markup, the plain-text language (Q:, A:, X:, DOC:, GOTO:) that www.qnamarkup.org turns into interactive question-and-answer interviews, guided forms, decision trees and document assemblers. Use whenever someone asks for "a QnA", QnA Markup, an interactive interview or decision tree they can run in a browser, or asks to encode a process, checklist, policy, FAQ or document as questions and answers.
---

# QnA Markup

QnA Markup is a plain-text language. A `.txt` file of it, pasted into the editor at
https://www.qnamarkup.org/, becomes a chat-style interview: the visitor is shown one question at a
time, answers by clicking a button or typing, and is led down a branch you wrote. It was made for
legal-aid style guided interviews, but it is a general decision-tree / guided-form language.

## What to produce

Produce **plain text**, indented with **tabs**, saved or offered as a `.txt` file (or shown in a
code block). Never a table, never Markdown bullets, never HTML around it. A minimal QnA:

```
Title: Is it a weekend?
Q: What day is it?
A: Saturday
	Q: Then it's the weekend.
A: Sunday
	Q: Then it's the weekend.
A: Something else
	Q: Then it's a weekday.
```

## Workflow

1. **Understand the process** before writing. Find the decision points (each becomes a `Q` with `A`
   buttons), the facts to collect (each an `X` text field), the outcomes (leaf questions with no
   answers), and any text to generate (`DOC:`). Ask the person, briefly, if something essential is
   unclear; otherwise make sensible assumptions and say what they were.
2. **Draft the tree.** One question per `Q`. Answer buttons phrased as answers ("Yes", "Under 18",
   "I rent"), not as questions. Every path must end somewhere sensible (a closing `Q` with no
   answers, or a `GOTO` to one). Give every question that anything jumps to a name: `Q(rent):`.
3. **Check it against the rules below** (indentation, alternation, GOTO placement, unique names).
   If `scripts/check.js` is available, run `node scripts/check.js file.txt`; it prints the
   interpreter's own error messages with line numbers, or `OK`.
4. **Hand it over** with one line on how to run it: paste into https://www.qnamarkup.org/ (or open
   `https://www.qnamarkup.org/?source=URL` when the file is on the web with CORS enabled), then use
   *Update Outputs*, *Link* or *HTML* to share it.

## The rules that matter (the interpreter enforces them)

**Tags** start a line (after indentation) and end with a colon:

| tag | meaning |
|---|---|
| `Title:` `Author:` `Description:` | header, before the first `Q`; shown under *credits* |
| `Before:` `After:` | HTML (and `<script>`) placed above / below the conversation |
| `Q:` or `Q(name):` | a question; text follows, may span lines, may contain HTML |
| `A:` or `A(value):` | a button; `value` is what the variable stores (default: the button text) |
| `A[href]:` / `A:[href]` | a button that is a link (same window / new window); `javascript:` runs code |
| `X:` | a text field instead of buttons; nothing may follow the colon; one per question |
| `DOC:` | text collected for a document when the `Q` right under it is shown |
| `GOTO:name` | the last thing in a `Q`'s text: continue at that question |

**Structure**

* Indentation is nesting: the answers to a question sit at the **same** indentation as the question;
  the question that follows an answer sits **one level deeper** (one tab more). Use tabs (or a
  consistent number of spaces); mixing widths is an error.
* Tags alternate: a `Q` is followed by its `A`/`X` tags, each `A`/`X` by at most one `Q` beneath it.
  Two `Q`s in a row at the same level, or an `A` deeper than its `Q`, are errors.
* Every QnA needs at least one `Q` and one `A` or `X`.
* The conversation starts at the first top-level `Q`. Other top-level `Q`s are reachable only by
  `GOTO` (they are where shared endings and loops live).
* An answer with nothing beneath it ends the conversation there (fine for a closing statement:
  put the statement in a `Q` with no answers instead, so the visitor reads it).

**Names and variables**

* `Q(name):` names the question and the variable it stores. Names: letters, digits, `.`, `_`, `-`;
  unique within the QnA. Leave the parentheses out and the editor numbers the question (`Q(1.2.1):`);
  those numbers are machine names and shift when the tree changes, so use words for anything you
  refer to.
* The visitor's answer is stored under the question's name: the `A(value)` (or button text), or the
  typed text of an `X`. Show it later with `<x>name</x>` anywhere in a `Q`, `A` or `DOC`.

**GOTO**

* `GOTO:target` must be the last thing in the `Q`'s text, one per `Q`, never in an `A`. The
  target is a name (or an id). A `Q` that is only `GOTO:x` is a silent jump; text before it is
  shown first.
* Loops (a `GOTO` back to an earlier question) are how you retry or repeat.

**Text**

* Question and answer text is HTML: `<b>`, links, images, `<br>` all work. Two `<br><br>` split a
  question into two bubbles. Plain text is fine and usually best.
* Keep questions short; one thing per question. Buttons are short phrases.

## Templates for common asks

* **"Encode this process / policy / checklist as a QnA."** Walk the source in order. Each condition
  ("if the tenant received notice…") becomes a `Q` with the possible cases as `A`s; each step that
  needs a fact becomes an `X`; each outcome becomes a closing `Q` (or a `GOTO` to a shared one).
  Quote the source's wording in the outcomes so the result stays faithful. Name the questions after
  the concepts (`Q(notice):`), not the numbering of the source.
* **"Help me write a QnA about X."** Ask what the visitor should end up with (an answer, a document,
  a referral), then design from the outcomes back to the first question.
* **"Turn this form / letter into a QnA that fills it in."** Collect each field with an `X`, then a
  `DOC:` tag above a final `Q` assembles the text with `<x>field</x>`, and a button shows it:
  `A[javascript:showdoc('Review, then print or save.')]: Show my letter`. See
  `examples/letter.txt`.
* **Adding logic** (compare a number, pick a random branch, compute something): a script in an
  `X[javascript:…]:` or `A[javascript:…]:` bracket can call `goto('name')` and read answers with
  `getvar('name')`. See `examples/quiz.txt`. Loading another QnA file into the conversation:
  `loadQnA('url', 'done', 'next')`. Details in `reference.md`.

## Before you hand it over

* [ ] Tabs, consistent; answers level with their question; next question one level deeper.
* [ ] Every `GOTO` names a question that exists exactly once, and is the last thing in its `Q`.
* [ ] No `GOTO` in an `A`; nothing after `X:` on its line; one `X` per question.
* [ ] Names unique, made of letters/digits/`.`/`_`/`-`; the ones referenced are words.
* [ ] Every branch ends in a readable closing question (not in a dangling answer) unless it loops.
* [ ] `<x>name</x>` only for names that will have a value by then.
* [ ] `Title:` (and `Description:`) filled in; no `Settings:` line (the editor manages that).

`reference.md` has the full syntax, the predefined JavaScript functions, the error messages and
what causes them. `examples/` has complete, checked QnAs to pattern from.
