# Skills

`qna-markup/` teaches an AI assistant to write QnA Markup. See the syntax page, *Bots Building
Bots* (`syntax/#bots`), for what it is and how to install it; `qna-markup/SKILL.md` is the entry
point an assistant reads.

`node build.js` copies `dist/qna.js` into `qna-markup/scripts/` (for the checker), parses every
file in `qna-markup/examples/` (the build fails on an error), and writes `qna-markup.zip`, the
upload-ready form. Edit the `.md` and example files, never the copied `qna.js` or the zip.
