# Changelog

This edition of QnA Markup is a client-side rewrite of the original
server-rendered implementation (the PHP interpreter in `lib/functions.php`
plus `js/interactive.js` at github.com/colarusso/QnAMarkup). Everything below
is measured against that version; the markup language itself is unchanged,
and QnAs written for the old editor run as they did before.

## 2.5.0 — form fields in questions, X:number, system font by default, a fully draggable flowchart, warnings above the outputs

Changes since 2.4.0. The library is published at `dist/2.5.0/`; earlier
versions are untouched. The only change to how a QnA renders is its default
type (below); a QnA that sets its own font, size and line height is drawn
exactly as before, and progress saved by 2.4.0 still loads.

### Language

* **Form fields written in questions are variables.** A QnA is a form as
  much as a conversation, and `X` only ever offered one text field. Now any
  `<input>`, `<select>` or `<textarea>` with a `name` placed in a question's
  HTML is a variable of that name (dates, checkboxes, radios, drop-downs,
  colours, ranges, hidden values, longer notes): `<x>name</x>`, `getvar()`,
  `DOC:`, `json_str()` and `submit2()` all see it. The question's `A` (or
  `X`) button is the form's submit.
  * Values are recorded when the bubble is drawn (a `value="…"`, a `checked`
    box) and on every change, so with *Save visitor progress* on a
    half-filled form survives closing the browser: the unanswered values are
    kept as `pending` in the saved progress and put back on return.
  * The browser's own validation runs before an answer is taken: a field that
    fails `required`, `min`/`max`, `pattern`, `type="email"`, … is pointed
    out with the browser's message and the answer refused.
  * Once answered, the values are fixed on the history entry (`fields`) and
    every control in that exchange is disabled; GO BACK ONE reopens the
    exchange with its values. Restores rebuild the same state.
  * A checkbox group or `<select multiple>` is an array: JSON in
    `json_str()`, comma-joined in `<x>`, documents, the hidden variable
    textareas and the transcript. Text is escaped like X answers.
  * The transcript adds the fields after the answer: `USER: Continue
    (dob=1990-01-02; pets=cat, dog)`. Prior-answer matching across loaded
    QnAs does not consider them.
  * `submit2()` sends every variable once: the hidden `.qna-vars` textareas
    carry them (fields of the unanswered last question are read first, and
    its live controls held out of the post so no name is doubled).
  * Parser: `q.fields` lists the names (`QnA.fieldsIn(html)` is exported);
    warnings for a control with no `name` and for a name that is also a
    question's name or id. Buttons and file inputs are ignored. The flowchart
    marks such questions with a small text-box glyph (hover for the names).
* **`X:number`** asks for a number: the field is rendered as an HTML number
  input (`step="any"`, so decimals are accepted, `inputmode="decimal"` for the
  keypad on phones); the value is stored as typed. The parser records it as
  `inputType: 'number'` on the answer, and the flowchart labels the edge
  `Number: <variable>`.
* **Other text after `X:` is a warning, not an error.** The 2016 "the space
  after an X tag must be left blank" error is gone: the text is ignored (and,
  as before, its whitespace dropped from the code) and the parser returns a
  warning in the new `result.warnings` array (`{message, near, line}`, like
  errors), which the editor shows in the yellow box above the outputs. It
  clears when the text is removed or turns out to be `number`. QnAs from the
  old gallery written `X:name` therefore run now.

### Library

* **Default Body Text is now the system font stack, 16px / 22px** (`-apple-system,
  BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, sans-serif`), the values
  the editor's Settings screen has opened with since `config.js` was
  introduced. Up to 2.4.0 the library's own defaults were still Verdana
  14px / 20px, so the editor wrote `data-font-family`, `data-font-size` and
  `data-line-height` into every embed, page, link and saved file, and a QnA
  opened from a link without them rendered in Verdana. The two sets of
  defaults now agree: an untouched Settings screen produces outputs with no
  type attributes, and a page that pins `dist/2.4.0/` or earlier keeps
  rendering as it did. Every other default is unchanged.

### Editor

* **Flowchart: every node can be dragged.** The START pill, the terminal
  dots at the end of unanswered branches and the dashed External QnA boxes
  (`loadQnA()`) now move like question boxes, and keep their places across
  live-preview re-renders until *Reset layout*. (The outlined boxes had no
  fill, so only their thin border registered a grab; the dots were not nodes
  at all.) The dots have a wider invisible target around them, which the
  SVG/PNG exports leave out.
* **Warning when "Save visitor progress in browser" is on.** The yellow
  notice above the outputs (where the `http://` media warning appears) now
  also tells the author that saved answers stay in the visitor's browser
  storage after the browser is closed, until START OVER or the site's data is
  cleared, so anyone who later uses the same browser can see them. Several
  warnings stack in the same box. This notice and the http:// media one are
  only shown with the outputs that share the interactive QnA (Interactive,
  Link, Embed Code, HTML full page), not with the Flowchart, which neither
  loads media nor saves anything; the parser's warnings show with every
  output.
* **Replacing the markup asks only when there is something to lose.** The
  "Replace the current markup…?" confirmation before a template, *New*, or a
  QnA arriving by link used to appear whenever the text area was not empty.
  It now appears only when the markup or the Settings screen differs from
  what was last loaded (a template, a file, a link, New) or saved with *Save
  to File*; a template that was loaded and never edited is swapped without a
  question. Settings count because they travel in the saved file (its
  `Settings:` line) even though they are not in the text area, so changing a
  colour and then picking a template asks. The markup comparison is made on
  the id-filled code, so Update Outputs numbering the questions does not
  count as an edit; the "clean" state is recorded once a load's own
  `Settings:` tag has been applied, and is kept with the editor state so it
  survives a reload.

## 2.4.0 — loadQnA(), Q Sharing and prior answers

Changes since 2.3.0. The library is published at `dist/2.4.0/`; earlier
versions are untouched. Nothing changes for a QnA that does not call the new
function: same parse, same output, same flowchart. Progress saved by 2.3.0
still loads.

### Language

* **`loadQnA(url, find, replace)`**, a new predefined function: bring another
  QnA into the conversation. From an answer's script the loaded QnA's first
  question takes the place of the question that would have followed the
  answer (typing dots while it is fetched). `url`: a raw markup file, an HTML
  page with a `<script type="text/qna">` (the first one), or an editor /
  viewer link (`#z=`, `#j=`, `?markup=` decoded locally; `?source=` followed).
  Relative URLs resolve against the page, or against the loading QnA's own
  URL when the call is made from a loaded one. A fetch that fails, a page
  with no QnA, or a file with errors shows a "[QnA: could not load …]" bubble
  (reason in the console) with GO BACK ONE available.
  * The loaded QnA's `Title:`, `Author:`, `Description:`, `Before:`, `After:`
    and `Settings:` are ignored; the host's styling and footer apply.
  * `find` / `replace`: the loaded question `find` is replaced by the host's
    `replace`; any arrival there (GOTO:, goto(), nesting) continues in the
    host. `find` may be an object of several pairs.
  * **Units.** Each loaded QnA is a unit with prefix `L1`, `L2`, … numbered
    per host instance in load order, however deep the loading goes; labels
    and machine-made names are prefixed (`1.1` → `L1.1.1`), author names are
    kept (shared) or prefixed when Q Sharing is off. A unit's `GOTO:` targets
    are resolved before prefixing so they stay inside it; `goto()`, `getvar()`
    and `<x>name</x>` in a unit look in that unit first. `json_str()` covers
    every unit.
  * **GO BACK ONE and saved progress.** A load is recorded on the answer's
    history entry (`jumps: [{url, text, redirect}]`) with the fetched text, so
    replay re-installs the unit from the text: nothing is fetched again, and
    a changed remote file cannot break saved labels. `pre.jumps` covers a
    load made from a script in the first question.
  * **Parser.** A `Q` nested under an answer whose script calls `loadQnA()`
    is an error ("An answer that calls loadQnA() cannot have a Q beneath it…").
    Answers carry `loads` (the URL literal, or `true`), `returns` (literal
    `replace` targets as labels) and `jumps` (literal `goto()` targets);
    questions carry `jumps` from their inline scripts.
* **Q Sharing** (`qShare`, `data-q-share`, `q_share=0` in plain links,
  default on) and **prior answers.** With it on, a question whose variable
  already holds a value set by a *different* unit is filled in instead of
  asked: an `X` takes the value; an `A` question takes the button with the
  same value, else, after a `confirm`, the single button that matches once
  both are reduced to lower-case letters, digits and emoji (`\p{L}`,
  `\p{N}`, `\p{Extended_Pictographic}`; HTML stripped first); no match, or
  two alike, asks with no dialog. The exchange is drawn (question, then
  `labelEarlier` + answer) with no pause, recorded as a history entry flagged
  `auto`, runs the answer's `[javascript:…]` (a `goto()` there replaces its
  next question), collects `DOC:` and appears in `transcript()`; the variable
  keeps its value and origin. A filled-in question reached again in the same
  run is asked (so a `GOTO:` loop in the loaded QnA cannot spin), as is a
  unit's own question. GO BACK ONE stops on an auto entry: the question is
  asked, an `X` field prefilled. Replays never re-match or re-confirm.
  `QnA.normalizeValue(s)` exposes the comparison.
* Two more of the built-in sentences become labels: `labelEmpty` ("Your
  answer appears to be empty.", the alert for a blank text field;
  `data-label-empty`, `label_empty=`) under *Text input* in the Button Text
  card, and `labelEditWarn` ("You are about to edit a copy of this QnA. Any
  edits will not change this instance.", the alert behind the footer's edit
  link; `data-label-edit-warn`, `label_edit_warn=`) under *Edit* in Footer
  Link Text. Both follow *Text input* / *Edit* in the `Settings:` tag.
* Two new labels: `labelEarlier` ("Earlier you entered:") and `labelConfirm`
  ("It looks like you may have answered this before; click OK to use
  <x>answer</x> as your answer."), with `data-label-earlier` /
  `data-label-confirm`, `label_earlier=` / `label_confirm=`, the `Settings:`
  tag (`;` in the confirm text is `%3B`) and `config.js` defaults.

### Flowchart

* An answer that calls `loadQnA()` leads to an "External QnA" box (dashed
  outline, captioned with the file name when the URL is a literal). Each
  literal `replace` target gets a dotted "JS GOTO" edge from the box.
* A literal `goto('name')` in an answer's or a question's script is a dotted
  "JS GOTO" edge (`stroke-dasharray: 1.5 4`, round caps) to the target, as
  against the dashed `GOTO` edge. Computed targets draw nothing.

### Editor

* Settings screen: a **Q Sharing** card (Yes / No) before a **Prior Answers**
  card (the two labels), which sits next to Button Text. Q Sharing = No
  greys out and disables Prior Answers. Both travel with the QnA like every
  other setting, and Restore Defaults / `config.js` `defaults` know them.

### Docs

* **Bots Building Bots** (`syntax/#bots`) and the `skills/qna-markup/` skill:
  `SKILL.md` (frontmatter + the workflow and rules an assistant needs),
  `reference.md` (full syntax, error messages, predefined functions, running
  and embedding), `examples/` (branching, letter/DOC, quiz/goto: all parsed
  by the build and by `test/compare.js`) and `scripts/check.js` (validates
  files with a copy of `dist/qna.js` that `build.js` refreshes). `build.js`
  zips the folder to `skills/qna-markup.zip` (needs `zip`); `--site` ships
  `skills/` whole. The page explains installing it in the Claude app, Claude
  Code / Cowork, the API, and by pasting for other assistants.
* Syntax page: the three "Advanced Usage" passages (A, X, DOC) are folded
  into `<details>` boxes, closed by default; `syntax/syntax.js` (external, so
  the editor origin's CSP allows it) opens the box holding the target of a
  `#links`-style link or hash change. A stray duplicate `</body></html>` at
  the end of the page was removed.
* Syntax page: `loadQnA()` section (sources, CORS, find/replace, sharing,
  matching, GO BACK ONE, flowchart, nesting), flowchart note under `goto()`,
  pointer from Loading a Remote QnA. README, DEPLOY (CORS for `examples/`
  and `templates/`).

### Tests

* runtime.js: loadQnA and prior-answer scenarios over a routed origin
  (load_host / load_sub / load_sub2 fixtures under `test/fixtures_runtime/`),
  sources, failures, nesting, restore, parser fields and the nested-Q error.
  e2e.js: Settings cards, outputs, Settings tag, file round trip, flowchart
  boxes and edges, the error in the editor, and a load from the sandboxed
  preview (served with CORS by test/serve.js).

## 2.3.0 — goto() and getvar()

Changes since 2.2.0. The library is published at `dist/2.3.0/`; earlier
versions are untouched, so pages that pin them keep working. Nothing about
existing QnAs changes: the parser is the same, and so is the flowchart.

### Language

* **`goto(target)`**, a new predefined JavaScript function: jump to the `Q`
  named (or numbered) `target`, from a script. It runs on the same machinery
  as the `GOTO:` tag (`showQuestion`), so the target's `DOC:` is collected, a
  `GOTO:` chain at the target is followed, and the transcript reads the same.
  * In an answer's script (`A[javascript:…]`, `X[javascript:…]`) the target
    *replaces* the question that would have followed the answer. That question
    has already been drawn (hidden behind the typing dots) by the time the
    script runs, so it is rolled back: its bubbles, `DOC:`, transcript lines
    and, for an answer with nothing beneath it, the "[QnA: missing question]"
    bubble. Calling `goto()` twice in one script: the last call wins.
  * In a script inside a `Q`, the jump is queued and made when the question is
    on screen, like a `GOTO:` ending it.
  * At any other time (timer, fetch callback, the host page) a question still
    behind the typing dots is shown at once and the target is added after it.
  * **GO BACK ONE and saved progress.** Each jump is recorded on the history
    entry of the answer it followed (`{label, value, skip, jumps}`; jumps made
    before the first answer are kept separately and saved as `pre`). A redraw
    replays the recorded jumps and ignores `goto()` calls (`this.replaying`),
    so nothing is re-run and a random jump is not re-rolled. GO BACK ONE pops
    the answer together with its jumps. Progress saved by 2.2.0 still loads.
  * An unknown target shows the usual "[QnA: missing question …]" bubble and
    logs to the console. Numeric targets in JavaScript are not renumbered by
    the editor; named targets are safer.
  * Not drawn in the flowchart (it is built from the tags only).
* **`getvar(name)`**: the saved value of a question's variable, or
  `undefined`. Both functions are globals and `QnA.goto` / `QnA.getvar`, and
  methods of an instance.

### Fixed

* GO BACK ONE put the text of an undone `X` answer back in its field only when
  that field belonged to the first question; the redraw used it up on the
  first question drawn. It now goes to the last.

### Editor

* Both *embed the library in the page* boxes (Embed Code and HTML full page)
  start checked. The editor remembers the boxes under new keys, so a browser
  that last used 2.2.0 gets the new default once and its own choice after.
* *Save HTML to File* and the flowchart's *Save as PNG* / *Save as SVG* are
  named like *Save to File*: the title, tidied, then the date and time
  (`My_QnA_2026-09-21T10-30.html`, `My_QnA_flowchart_….png`); without a title,
  the placeholders `QnA_page_…` and `QnA_flowchart_…` (it was a fixed
  `QnA_page.html`, and `QnA_markup_flowchart_…`).

## 2.2.0 — button colors and borders

Changes since 2.1.0. The library is published at `dist/2.2.0/`; `dist/2.1.0/`
and `dist/2.0.0/` are untouched, so pages that pin them keep working. With the
default settings a QnA looks exactly as it did in 2.1.0 (the generated CSS is
the same, character for character, apart from `#ddd`, `#eee` and `#888` being written
with six digits).

### Settings

* Two new groups on the Settings screen, before *Button Text*.
  **Button Body**:
  * *Background* (`btnBg`, `data-btn-bg`, default `eeeeee`) and *Text*
    (`btnTxt`, `data-btn-txt`, default `000000`) colour every button: the
    answer buttons (`a.qabutton`), the text-input box and its "Save above text
    as answer." button (`div.xdiv`, `a.xbutton`), and GO BACK ONE / START OVER
    (`a.sbutton`). The field you type in stays black on white.
  * *Bold text* (`btnBold`, `data-btn-bold`, default `false`), a checkbox:
    button text in bold.
  * The credits box goes with the buttons: `div.credits` has the button
    background and `div.credit_text` the button text colour (it was always
    `#eee` / black, the old button colours). Bold does not apply to it. Links
    in the credits keep the standard blue / purple while the button text is
    the default black; with any other button text colour they take that
    colour, underlined, so they can be read on a dark box.

  **Borders**:
  * *Button borders* (`btnBorder`, `data-btn-border`, default `888888`): the
    outline of those buttons and of the text-input box, and the line between
    its field and its button.
  * *Divider lines* (`btnDivider`, `data-btn-divider`, default `dddddd`): the
    top border of `div.standard_buttons` and of `.qna-footer`, the two thin
    rules that set the buttons off from what is around them.
* The hover / pressed shade is no longer a fixed `#ddd` but worked out from
  the two colours: the background moved 1/14 of the way towards the text
  colour. For the defaults that is exactly `#dddddd`; a dark button with light
  text lightens on hover instead of jumping to light grey.
* Like every other setting they travel with the QnA: the hidden `Settings:`
  tag, `data-` attributes in Embed Code and HTML full page, both forms of the
  Link output (`btn_bg=`, `btn_txt=`, `btn_bold=1`, `btn_border=`, `btn_divider=` in the plain
  form), the footer's *edit* link, options to `QnA.render()`, the editor's
  remembered state, *Restore Defaults*, and the `defaults` block of
  `config.js`. Only non-default values are written to the outputs.

### Editor

* **A link that looks too long to work says so.** The Link output carries the
  whole QnA, so a big one can outgrow what will open. When the current link is
  longer than about 8,000 characters in the *plain text* form (it travels in
  the query string, and web servers commonly refuse such a request with 414
  "URI Too Long") or 32,000 in the *compressed* form (it travels in the
  `#fragment`, so only browser and app limits apply), the **open ↗** shortcut
  in the Output header is hidden and a warning at the top of the Link pane
  explains why and points to the compressed form, Embed Code and HTML full
  page. The link stays in the pane to copy or try. The limits are `LINK_MAX`
  in `editor.js`.
* **Fixed: with word wrap on, the caret could sit a few characters to the
  right of where typing landed.** The coloured text is a layer beneath a
  transparent text area, and the two must wrap identically. When the text
  area's scrollbar takes up room (Windows and Linux; macOS with a mouse
  attached or *Show scroll bars: Always*), its text column was about 15px
  narrower than the layer's. Lines that wrap at a space mostly hid this, but a
  long URL is broken wherever the column ends, so from there on the visible
  text and the real text were about two characters apart. The layer now gives
  up the same room as the scrollbar (`syncGutter()` in `editor.js`), also when
  the scrollbar comes and goes.

## 2.1.0 — chat styles and editable button text

Changes since 2.0.0. The library is published at `dist/2.1.0/`; `dist/2.0.0/`
is untouched, so pages that pin it (with its integrity hash) keep working.
With the default settings a QnA looks and reads exactly as it did in 2.0.0.

### Settings

* **Chat style: SMS or LLM** (`chatStyle`, `data-chat-style`, default `sms`),
  a dropdown at the top of *System Text (questions)*. SMS is the look QnAs
  have always had: questions and answers in speech bubbles. LLM sets the
  questions straight on the page, the way a chat assistant's replies appear:
  * `question_text` takes its background, text and link colours from *Body
    Colors* instead of *System Text*;
  * `question_arrow` is not displayed (`display:none`);
  * `question_text` has no padding, margin or border radius, apart from 8px of
    padding on top;
  * `ans_text` gets a top margin of 8px. Answers stay bubbles.

  The System Text colours are ignored, not lost: the editor greys out and
  disables those three fields while LLM is selected, keeps their values, saves
  them to file and writes them into every output, so switching back to SMS
  (in the editor, or by changing `data-chat-style` on an embed) brings the old
  colours back. The flowchart goes on using them for its question boxes.
  The three-dot typing indicator follows the chat style.
* **The built-in button and link text can be changed.** Two new groups on the
  Settings screen, *Button Text* and *Footer Link Text*, hold the wording of
  "Save above text as answer." (`labelSave`), "GO BACK ONE" (`labelBack`),
  "START OVER" (`labelRestart`), "credits" (`labelCredits`), "edit"
  (`labelEdit`) and "code your own" (`labelCode`), for translation or a
  different voice. They are plain text (HTML is shown as typed, not
  interpreted), one line, up to 200 characters; a field left blank returns to
  the standard wording.
* Like every other setting, these travel with the QnA: in the hidden
  `Settings:` tag written by *Save to File* and read by *Load File*, as
  `data-` attributes on the script tag in the Embed Code and HTML full page
  outputs (`data-chat-style="llm" data-label-back="Previous"`), in both forms
  of the Link output (`chat_style=` and `label_back=` etc. in the plain form),
  in the footer's *edit* link, as options to `QnA.render()`, and in the
  editor's remembered state. *Restore Defaults* resets them. Only non-default
  values are written to the outputs.
* In the `Settings:` tag, pairs are separated by semicolons, so a `;` in a
  label is written `%3B` (and `%` as `%25`); the library reads them back.
* The footer's third link has a class of its own, `qna-code-link`.

### Site configuration

* **`config.js` sets the defaults of the editor's Settings screen.** A new
  `defaults: { … }` block lists every option on the screen (fonts, colours,
  framing, chat style, button and link text, footer, start, save progress),
  shipped with the library's own values so nothing changes until one is
  edited. They are what a first-time visitor starts with, what *Restore
  Defaults* returns to, and what a blanked button or link text field falls
  back to. Names may be camelCase or snake_case; only Settings-screen options
  are read, each through the library's validation, so a missing or invalid
  value falls back to the library's default.
* These are the editor's defaults, not the library's: `dist/qna.min.js` is
  unchanged by them, so a configured value that differs from the library's is
  written into every output (embed code, HTML page, link, saved file) just as
  if the author had chosen it. For the same reason a QnA opened from a link
  (including a footer's *edit* link) or from a file is shown as it renders: a
  setting it does not mention takes the library's default, not the site's.

### Language

* **`X` tags can run JavaScript: `X[javascript:…]:` or `X:[javascript:…]`.**
  The code runs after the visitor's text has been saved to the question's
  variable, whether it was submitted with Enter or the button, so it can read
  the new value; it does not run when an empty field is refused, nor when the
  conversation is redrawn (GO BACK, restored progress). The bracket may sit on
  either side of the colon with no difference in behaviour (there is no href,
  so no same-window/new-window distinction), and may span several lines
  exactly as an `A` tag's can (lines trimmed, `//` comments dropped, `\]` for
  a literal `]`). The error checker requires the full form: empty brackets,
  contents without the `javascript:` prefix, a second set of brackets, or a
  space between the colon and the bracket are each reported with their line.
  `parse()` gives the code as `script` on the X tag's entry in `answers`; the
  editor highlights the bracket, multi-line included. Documented in the Syntax
  page's `X:` section under *Running JavaScript*. Markup without brackets on
  an `X` parses exactly as before.

### Other

* The minimum width of a question bubble is now 30px (it was 70px or more),
  so a very short question gets a bubble that fits it.

## 2.0.0 — client-side edition

### Architecture

* The interpreter is a single JavaScript file (`dist/qna.min.js`, ~35 KB) that
  runs in the browser. No PHP, no server: a QnA is embedded in any page with a
  `<script src="…/qna.min.js">` tag and the markup in a
  `<script type="text/qna">` block, and the whole site is plain static files.
* The parser was ported line by line and checked against the original with a
  PHP oracle over every template, every syntax-page example, 31 gallery QnAs
  and a set of edge cases (`test/compare.js`). Ids, answers, variables, header
  tags and error conditions match apart from the deliberate fixes listed under
  *Parser* below.
* The rendered HTML keeps the same structure, ids and class names
  (`#conversation`, `#QandA`, `#Choices`, `.question_text`, `.qabutton`, …)
  and the same generated CSS, so styling written for the old output still
  applies. Options are read from `data-` attributes in camelCase or the
  original snake_case, and the same options can be passed to `QnA.render()`.
* All of the original helper functions (`transcript()`, `doc()`, `json_str()`,
  `mail2()`, `save2()`, `submit2()`) are still globals, so existing
  `A[javascript:…]` buttons keep working; they are also namespaced under
  `QnA.*`.
* Several QnAs can live on one page. Each is rendered in place with its own
  options; when their styles differ the CSS is scoped per instance.

### Parser

* **Spaces are accepted as indentation, not just tabs.** Nesting is
  structural: tags at the same level must line up, and a tab counts as four
  columns when mixed with spaces. A dedent that matches no earlier tag is an
  error. (The PHP only recognised tabs; one gallery QnA written with spaces
  now parses as its author intended.)
* **GOTO renumbering works.** Numeric GOTO targets follow their questions when
  ids are reassigned. The PHP promised this but the code path was unreachable,
  so a stale `GOTO:1.3` silently pointed at the wrong question.
* GOTO targets are checked against the ids questions *will* receive, so
  `Q: … GOTO:1` is valid before the editor has written `Q(1):` into the text.
* GOTO targets containing capital letters are validated (the PHP's case-
  sensitive pre-check let `GOTO:Not` through to fail at run time).
* `A():` gives an empty answer value, as the documentation's Santa example
  relies on (the PHP fell back to the button text).
* Header tags are parsed correctly when text such as a comment precedes them;
  `\r\n` line endings are normalised; duplicate-name errors are reported once.
* Leading and trailing whitespace in a Q tag's text is trimmed, so a
  `Q: GOTO:1.1` no longer renders an empty bubble.
* A `[javascript:…]` bracket may span several lines; each line is trimmed and
  `//` comments are dropped before the code runs. A literal `]` inside any
  bracket is written `\]`.
* Every error carries a line number (`Line 12: …`), including GOTO errors,
  which are reported on the GOTO's own line.

### Runtime

* "Go back one" replays the conversation from its history instead of editing
  the DOM with regular expressions; the variable of an undone answer is
  cleared.
* A new exchange scrolls the top of the response bubble to the top of the
  QnA's area; going back removes the last exchange with no scroll of its own.
* Questions that contain images are held back, with a three-dot typing
  indicator, until the images have loaded and decoded (up to `loadTimeout`,
  default 30 s), so bubbles appear complete rather than reflowing.
* Optional **save visitor progress** (`data-save-progress="true"`, off by
  default): answers are kept in the visitor's browser (localStorage) and the
  interview resumes where they left off; *Start over* clears them. When the
  option is off the runtime stores nothing at all. Saved answers are keyed on
  the markup, so a changed QnA never restores stale answers.
* An input field is only focused automatically when nothing editable
  elsewhere on the page has focus, so a live preview never steals the cursor
  from an editor.
* New **Body Colors** options (`bodyBg`, `bodyTxt`, `bodyLink`) for the
  background and for text and links outside the bubbles. The credits box
  always sits on grey and keeps black text with standard link colours. The
  Body Text font family, size and line height now apply to the whole body,
  credits and footer included.
* `showdoc(instructions)` opens the generated document in an in-page overlay
  with Print / Save / Copy buttons, as a lightweight alternative to the
  document editor page.
* **Scripts written in the markup run.** The documentation has always said
  `Before:` and `After:` can carry JavaScript, and in the server-rendered
  original they did, because their contents were part of the page's HTML.
  In 2.0.0 everything is inserted with `innerHTML`, where script tags are
  inert. Now every `<script>` in `Before:`, `After:` or a `Q`/`A` is run as a
  normal page script: in the global scope (so `A[javascript:…]` buttons, later
  scripts and the host page can all call what it defines), in the order
  written, with external scripts (`src`) loading in sequence before the
  scripts that follow them. Header scripts run before the first question is
  drawn; a script in a `Q` runs whenever its bubble is drawn. Non-JavaScript
  script blocks are left untouched. See *Scripts in a QnA* in the README.
* A QnA's instance is attached to its container (`element.qna`) and is
  `QnA.current` before any of its scripts run.
* Script and style blocks are left out of `transcript()`.

### Hosting and security

* Two origins, as before, but now `www.qnamarkup.org` (editor, docs, library)
  and `www.qnamarkup.net` (viewer, document page), both plain static hosts.
  The origins are set once in `config.js`; every cross-link is derived from
  them, and on `localhost` / `file:` the folder works as a single site.
* The editor's live preview runs in an iframe sandboxed without
  `allow-same-origin`, so a QnA opened in the editor (including one arriving
  by link) cannot reach the editor's storage or DOM. The editor's own script is
  external, so the editor origin can be served with a Content-Security-Policy
  that forbids inline script.
* The library is published at a version-pinned URL that is never modified,
  and embed code carries a Subresource Integrity hash for it.
* `node build.js --site` assembles the two deployable folders; `deploy.sh`
  rsyncs them. `DEPLOY.md` documents headers and redirects.

### Sharing and links

* Share links pack the QnA into the URL fragment, deflate-compressed
  (`i/#z=…`), with no practical size limit; the old 4,000-character
  `?markup=…` form is still produced on request and still accepted by the
  viewer, as is raw URL-encoded markup after the `#`.
* The viewer (`i/`) can also load a remote text file with `?source=URL`.
* The "Embed Code" output is a script-tag snippet. The former hidden-`div`
  container and the iframe/HTML-snippet outputs are gone.
* Embed Code and HTML full page can optionally inline the whole library, for
  pages that must work offline or without a CDN.

### Editor

* Syntax highlighting: tags in blue, `()`/`[]` boundaries in purple,
  arguments and parameters in red, text in black, HTML highlighted.
* Line numbers in the gutter; error messages cite the line and clicking one
  selects that line.
* live preview (debounced), and the editor state survives a reload.
* Resizable split between the editor and output panes, side by side or
  stacked, with minimum sizes so neither can be squeezed away.
* Outputs: Interactive, Link, Embed Code, HTML full page and **Flowchart** —
  an interactive chart of the interview (questions as nodes, answers as
  edges; an X tag's edge is labelled `Input: <variable>`, GOTOs are dashed,
  pure-GOTO questions collapse into their target, dead ends get a dot, DOC
  tags get a page marker), with draggable nodes, pan and zoom, and PNG or SVG
  export on a transparent background, styled from the QnA's own settings.
* The Style tab is now Settings and includes the save-progress switch, Body
  Colors, and a button that deletes all saved interview progress in this
  browser.
* "Save to File" names the file after the Title tag with a timestamp
  (`My_Title_2026-09-17T13-42.txt`).
* A warning is shown when media are referenced over `http://`, which
  browsers block on an `https://` page.
* Blank question bubbles have a sensible minimum width; colour pickers have a
  plain 1 px border; error boxes are square.
* **Flowchart lines can be rearranged.** The label in the middle of a line
  (a small grip dot on the unlabelled START line) is a handle: drag it and the
  line is re-routed through that point, attaching to whichever side of each
  box faces it. Double-click the handle to put the line back on its automatic
  route. Like box positions, moved lines survive re-renders until *Reset
  layout*, follow their boxes when those are dragged, and are included in the
  PNG and SVG exports (grip dots and tooltips are not).
* **The preview follows the interview wherever it goes, and offers a way
  BACK.** An `A[href]:` button, a link in a question or a script may change
  the location of the preview frame; the editor does not redirect any of that
  to a new window. (Only `A:[href]`, the form that asks for a new window,
  gets `target="_blank"`, as the language defines.) Whenever the frame ends up
  showing something other than the QnA, however it got there, a full-width
  **BACK** bar appears across the top of the pane. BACK reloads the preview
  and resumes the interview at the point it was left, answers included; a
  *Update Outputs* or a live-preview edit returns to the QnA as well. Because the
  frame is sandboxed and the visited page is another origin, leaving is
  detected with a ping that only `preview.html` answers after each load.
  The recommended `frame-src` in `DEPLOY.md` is now `'self' https:` so that
  such navigations are not blocked by the editor's own CSP.
* The preview frame reloads before re-rendering a QnA whose scripts have run,
  so a script that declares a top-level `let`, `const` or `class` does not fail
  with "already declared" on the next keystroke.
* Code inside script/style blocks no longer shows up in flowchart boxes.

### Saving and loading

* **Save to File keeps the Settings screen.** The saved text file ends with a
  hidden `Settings:` tag, one line listing every value from the Settings screen
  (`Settings: fontFamily=…; fontSize=18; compBg=336699; …; start=1`).
  *Load File* takes the line off again and uses it to fill in the Settings
  screen, so it never appears in the text area; a file without it leaves the
  settings as they are. A tag pasted into the text area is ignored while
  typing and taken in the same way on *Update Outputs*.
* The parser strips the tag (only when it is the last non-blank line) and
  reports its values as `parse().settings`; `code` and `markup` never contain
  it, and a QnA without the tag parses exactly as before. `QnA.render` and the
  `<script type="text/qna">` auto-init use the values as the QnA's style, with
  explicit options and `data-` attributes overriding them. Only Settings-screen
  options are accepted, through the usual validation. New helpers:
  `QnA.splitSettings(markup)` and `QnA.settingsTag(options)`.
* Documented at the bottom of the Syntax page as "The Hidden Tag".

### Document editor page

* `doc/` replaces the PHP `doc/parse/html/` page. It is static, so `submit2`
  should send the document with `GET`; it loads CKEditor 4.22.1 (the last
  open-source release of CKEditor 4, replacing the 4.3.5 that shipped with the
  original) and falls back to a plain textarea if the CDN is unreachable.
* **No more "editor inside the editor" in the preview pane.** When a QnA hands
  a document to `/doc/` from the editor's preview (the Law Journals template
  does), the page runs inside the preview's sandbox and so has an opaque
  origin. CKEditor's usual iframe-based editing area needs same-origin access
  to a blank child iframe; refused that, Safari loaded a second copy of the
  page into it (a toolbar inside the toolbar) and Chromium left it empty,
  losing the document. In that situation the page now uses CKEditor's
  `divarea` plugin (loaded from the `full-all` CDN path), which edits in a
  plain div. Outside a sandbox nothing changes.

### Templates

* Templates are plain `.txt` files listed in `templates/templates.json`; the
  build validates each one and fails on errors.

### Removed

* All server-side code and the requirement for a PHP host.
* The hidden `<div>` markup container.
* The iframe and "HTML snippet" outputs (merged into Embed Code).
