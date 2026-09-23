# QnA Markup — language reference (for the interpreter at www.qnamarkup.org, library 2.4.0)

Read `SKILL.md` first; this file has the details.

## 1. File shape

* Plain text, UTF-8, `.txt`. Line endings do not matter. Indent with tabs (a tab counts as the next
  multiple of 4 columns; 2- or 4-space indentation also works if the whole file uses it).
* Optional header (before the first `Q`): `Title:`, `Author:`, `Description:`, `Before:`, `After:`
  (case-insensitive). `Before:` / `After:` hold HTML placed above / below the conversation, and may
  contain `<script>` tags (run once, before the first question).
* Anything before the first tag that is not a header tag is ignored (a `<!-- comment -->` is a
  common way to leave notes at the top).
* Then the body: `Q`, `A`, `X`, `DOC` tags, one per line, each with the text that follows it up to
  the next tag (so a question's text may run over several lines, as long as no line starts with
  something that looks like a tag).
* The editor's *Save to File* adds one last line, `Settings: fontSize=18; compBg=336699; …`, holding
  the style screen. It is not part of the conversation; do not write it by hand, and keep it as the
  last line if you edit a saved file.

## 2. Tags

### `Q:` / `Q(name):` — a question

* Text follows the colon (HTML allowed). `<br><br>` splits it into two speech bubbles.
* `name`: letters, digits, `.`, `_`, `-`; unique in the file. Without a name the editor assigns a
  numeric id when *Update Outputs* is clicked (`1`, `1.1`, `1.1.2`, …: first top-level question,
  then answer number, question under it, …). Numeric ids move when the tree changes; word names
  don't, so name anything a `GOTO`, a `<x>…</x>` or a script refers to.
* A `Q` at indentation level 0 is a top-level question. The first one is where the conversation
  starts (unless the page sets `start`). Later top-level questions are reached only by `GOTO`.
* The answer to a question is stored in a variable of the question's name.
* A question with no `A`/`X` beneath it is an end point: it is shown, with only *GO BACK ONE* /
  *START OVER* under it.

### `A:` / `A(value):` — a button

* Sits at the same indentation as its `Q`. Several `A`s in a row are the question's buttons, in order.
* Button text follows the colon (HTML allowed; keep it short).
* The value stored in the question's variable: `value` when written `A(value):`, else the button
  text. `A():` stores an empty value.
* What comes after the click: the `Q` (or `DOC` + `Q`) nested one level deeper right under the
  `A`. With nothing beneath it the conversation ends after the click, so prefer a closing `Q`.
* `A[href]: text` makes the button a link in the same window; `A:[href] text` opens a new window.
  `href` may be `javascript:…` to run code instead (see §5). A bracket may span lines; write a
  literal `]` inside it as `\]`. `//` comments on their own line are removed.
* `GOTO` is not allowed in an `A`.

### `X:` — a text field

* Used instead of (or beside) `A` tags: the visitor types an answer, which is stored, as typed, in
  the question's variable. One `X` per question. Nothing may follow `X:` on its line (an old
  syntax put a name there; that is now an error).
* `X[javascript:…]:` or `X:[javascript:…]` (no space before the bracket) runs code after the typed
  text has been saved, so `getvar('name')` in it sees the new value. The bracket must start with
  `javascript:`.
* The `Q` that follows the typed answer is nested one level deeper under the `X`, as with an `A`.
* The field refuses an empty answer ("Your answer appears to be empty.").

### `DOC:` — document text

* Placed at the same indentation as, and directly before, the `Q` it belongs to. When that `Q` is
  shown, the `DOC` text is appended to the conversation's document. `<x>name</x>` is substituted.
* The document is read back with `doc()` and shown / printed / saved with `showdoc(instructions)`,
  or sent elsewhere with `submit2(...)`, `save2(...)`, `mail2(...)`.
* `DOC(1.1):` with an id is what the editor writes; a bare `DOC:` is fine.
* The content is just text: HTML, Markdown, LaTeX, whatever the receiving end expects.

### `GOTO:target`

* Written at the very end of a `Q`'s text (`Q: Too low. GOTO:number`). One per question. The target
  is a question's name or id. When the question is shown, its text (if any) appears and the
  conversation continues at the target immediately.
* A `Q` that contains only `GOTO:x` is a silent jump: use it to send an answer somewhere without
  showing anything (`A: Yes` / `	Q: GOTO:next`).
* Targets must exist exactly once. The editor renumbers numeric targets when it renumbers
  questions; word names never need that.

### Variables: `<x>name</x>`

* In any `Q`, `A` or `DOC` text, `<x>name</x>` is replaced by the stored value of variable `name`
  (nothing if unanswered). Values are shown as HTML for `A` values; typed `X` text has `<` and `>`
  escaped.
* `json_str()` returns every variable as JSON; `transcript()` the conversation so far.

## 3. Structure rules (what the interpreter checks)

| error message | cause |
|---|---|
| Misaligned Q. | a `Q` not exactly one level deeper than the `A`/`X` above it (or not at level 0 first) |
| Mismatched Q and Q. | two `Q`s in a row at the same level with no answer between |
| Misaligned A. / Misaligned X. | an answer indented deeper than its question |
| Indentation does not line up with any earlier tag | a dedent to a width no earlier tag used (mixed tabs/spaces) |
| Variable names must be unique | two `Q(name)` with the same name |
| Variable names must contain only letters, numbers, periods, underscores, or dashes | bad name |
| The target of this GOTO does not exist | `GOTO:x` with no `Q(x)`; shows as `GOTO:????` |
| The target of this GOTO appears more than once | ambiguous; shows as `GOTO:???` |
| Poorly-formed GOTO call | `GOTO:` not at the end of the `Q` text, or written `GOTO: x y` |
| GOTO calls not allowed in A tags | |
| Limit one variable per answer set. | two `X` under one `Q` |
| Starting in September 2016, the space after an X (variable) tag must be left blank. | text after `X:` |
| An answer that calls loadQnA() cannot have a Q beneath it | see §5, `loadQnA` |
| You must have at least one Q: tag. / …one A: tag. | (an `X` counts as an answer) |

## 4. A complete small example

```
Title: Coffee or tea
Description: Picks a drink and remembers it.

Q(drink): Coffee or tea?
A: coffee
	Q: GOTO:extras
A: tea
	Q: GOTO:extras
Q(extras): Milk and sugar?
A(milk): Milk only.
	Q: GOTO:done
A(sugar): Sugar only.
	Q: GOTO:done
A(both): Both.
	Q: GOTO:done
A(none): Neither, thanks.
	Q: GOTO:done
Q(done): Got it. You like <x>drink</x> with <x>extras</x>.
A: Start over
	Q: GOTO:drink
```

## 5. Scripts and the predefined functions

Code runs from `A[javascript:…]:` / `A:[javascript:…]`, `X[javascript:…]:`, and `<script>` tags in
`Before:`, `After:` or a `Q`'s text (a `Q` script runs each time that question is drawn, including
redraws after *GO BACK ONE*; answer scripts run only on the click). All code is ordinary page
JavaScript, so functions defined in `Before:` can be called from answers. Available everywhere:

| function | does |
|---|---|
| `transcript(format)` | the conversation as text (`'1'` keeps HTML) |
| `doc()` | the collected `DOC:` text with variables filled in |
| `showdoc(instructions)` | opens `doc()` in an editable overlay with Print / Save as HTML / Copy |
| `json_str()` | `{"name": "value", …}` for every question's variable |
| `getvar(name)` | one variable's value, or `undefined` |
| `goto(target)` | jump to a question, exactly like `GOTO:` — from an answer's script it replaces the question that would have followed the answer; targets by name (preferred) or id |
| `loadQnA(url, find, replace)` | bring another QnA file (raw markup, a page containing one, or an editor link) into the conversation in place of the answer's next question; `find`/`replace` send the loaded QnA's question `find` on to this QnA's question `replace` (`find` may be an object of several pairs). An answer that calls it may not have a `Q` nested under it. With *Q Sharing* on, a question whose author-named variable was already answered in another loaded QnA is filled in ("Earlier you entered: …") instead of asked. |
| `mail2(to, subject, body)` | opens a mailto: draft |
| `save2(filename, content)` | downloads `content` as a file |
| `submit2(action, method, docAs, instructions, transcriptAs, jsonAs, target)` | POST/GET the document, transcript and JSON to a URL (`GET` to `https://www.qnamarkup.net/doc/` opens the WYSIWYG editor) |
| `answerQ(id)`, `startAT(id)`, `goback()` | take an answer / restart at / go back, from code |

Patterns:

```
Q(number): Guess a number.
X[javascript:if (getvar('number') == 42) { goto('right') } else { goto('wrong') }]:
Q(right): Yes!
Q(wrong): No. GOTO:number
```

```
A[javascript:showdoc('Review your letter, then print or save it.')]: Show my letter
A[javascript:save2('answers.txt', transcript())]: Save a transcript
A[javascript:mail2('help@example.org', 'Intake', transcript())]: Email this to us
```

Multi-line brackets, for readability:

```
A[javascript:
	// send them on according to what they typed
	var age = parseInt(getvar('age'), 10);
	if (age < 18) { goto('minor') } else { goto('adult') }
]: Continue
```

Scripts are optional. Most QnAs need none; branching alone (`A` + nested `Q`, `GOTO`) covers most
processes, and a QnA without scripts is easier for the author to maintain.

## 6. Running, sharing, embedding

* Paste into https://www.qnamarkup.org/ (the editor): live preview, *Update Outputs* fills in ids
  and reports errors with line numbers, the *Flowchart* output draws the tree.
* A file on the web (served with CORS, e.g. GitHub Pages / raw.githubusercontent.com) runs with
  `https://www.qnamarkup.net/i/?source=URL` and opens in the editor with
  `https://www.qnamarkup.org/?source=URL`.
* The editor's *Link* output packs the whole QnA into a URL; *Embed Code* / *HTML full page* give a
  `<script type="text/qna">…</script>` snippet with the library, whose `data-` attributes carry the
  style settings (`data-font-size="16"`, `data-comp-bg="336699"`, `data-footer="false"`, …). Inside
  such a page, write a closing `</script>` in the markup as `<\/script>`.
