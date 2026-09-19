# Editor templates

Each `*.txt` file in this folder is a template offered in the editor's
**Template** menu. `templates.json` lists them in menu order and gives each
its label.

## Editing a template

Edit the `.txt` file, then rebuild:

```
npm run templates      # regenerates templates/templates.js only
node build.js          # or the full build (library + templates)
```

The editor loads `templates.js`, not the `.txt` files, so nothing changes in
the editor until you rebuild. `templates.js` is generated; never edit it by
hand. While working on templates, `npm run watch` rebuilds automatically
whenever a file in `templates/` or `src/` changes.

## Adding a template

1. Save the markup as `templates/<key>.txt` (lower-case letters, digits and
   underscores; the key is also what `?source=<key>` in the editor URL loads).
2. Add a line to `templates.json` where you want it to appear in the menu:
   `{ "file": "<key>.txt", "name": "Menu label" }`.
   A `.txt` that is not listed is still included, after the listed ones, with
   its file name as the label.
3. Rebuild.

`new.txt` is special: it is what the **New** button inserts, so keep it.

## Checks at build time

The build parses every template with the interpreter and fails if one has
errors, so a broken template can't reach the editor. It also warns about
media referenced over `http://` (browsers block those on an `https://` page);
use `https://` links in templates.
