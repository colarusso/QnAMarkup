# Deploying QnA Markup
 
The site runs on two domains you already serve:
 
| Origin | What lives there | Deploy folder |
| --- | --- | --- |
| `https://www.qnamarkup.org` | the editor, syntax docs, templates, examples and the library (`dist/`) | `site/org/` |
| `https://www.qnamarkup.net` | the viewer (`i/`) and the document page (`doc/`) | `site/net/` |
 
The split is a security boundary. A QnA can contain anybody's HTML and
JavaScript, and the viewer and doc page run whatever a link hands them. Because
they live on a different registrable domain from the editor, that code can
never read or write the editor's storage, cookies or DOM, and a page on `.net`
can't pass itself off as `.org`. The editor's own live preview runs in an
iframe sandboxed without `allow-same-origin` (`preview.html`), so a QnA opened
in the editor is isolated the same way. The origins are set once, at the top
of `config.js`; everything else (share links, footer links, the library URL in
embed code, the cross-links on the static pages) is derived from them.
The same file holds the editor's header links and, under `defaults`, the starting
values of its Settings screen (fonts, colours, chat style, button text, …) for
a copy of the site that should open with a house style.
 
## Setting up a Mac
 
Node.js is the only requirement (the build, the tests and the dev server are
all Node scripts). Install the LTS release from https://nodejs.org (the macOS
`.pkg` installer) or, with Homebrew, `brew install node`, then in Terminal:
 
```
cd ~/path/to/qna-js
npm install                       # esbuild + playwright, into node_modules/
npx playwright install chromium   # once; the headless browser the tests use
npm run build                     # dist/ and templates/templates.js
npm run serve                     # http://localhost:8000/
```
 
If `npm run build` warns that esbuild could not be run, `npm install` has not
been run in this folder (or was run with `--production` / with
`NODE_ENV=production` set, which skips dev dependencies — use
`npm install --include=dev`). The build stops rather than writing an
unminified `qna.min.js`, since that file is hashed and published under
`dist/<version>/`. `node build.js --allow-unminified` overrides it for local
work only, and refuses to run with `--site`.
 
Optional: `brew install php` lets `test/compare.js` check the parser against
the original PHP; without it that one test is skipped. `rsync` and `ssh`, which
`deploy.sh` uses, ship with macOS; the servers need your SSH key. If `deploy.sh`
is not executable after unzipping, `chmod +x deploy.sh`.
 
## Release and deploy
 
```
# 1. bump the version if the library changed (it becomes the pinned URL and the SRI hash)
#    edit "version" in package.json, add a CHANGELOG entry
# 2. build, test
npm run build && npm test
# 3. set the destinations once (or export ORG_DEST / NET_DEST), then
./deploy.sh              # both sites; ./deploy.sh org or ./deploy.sh net for one
DRY=1 ./deploy.sh        # preview what would change
```
 
`deploy.sh` runs `node build.js --site`, which assembles `site/org/` and
`site/net/`, then `rsync --delete`s each to its document root.
 
The build writes the library to `dist/qna.min.js` (latest) *and* to
`dist/<version>/qna.min.js`, the copy embed code points at. The versioned
folders are part of the repository, so the same URL shape works locally, on
`localhost:8000/dist/2.2.0/qna.min.js`, and in production; the editor header
shows the version it is serving (`v2.2.0`). On the server the `dist/<version>/`
folders are also protected from rsync's `--delete`, so a version removed from
the repo later still stays online for pages that pin it. A version is never
republished: if the library changes, bump `"version"` in `package.json` first,
or the new bytes would land under the old URL and every pinned page's
`integrity` check would fail.
 
## Local testing
 
```
npm run serve            # one origin: http://localhost:8000/ (editor), /i/ (viewer)
npm run serve:split      # two origins: :8000 is the editor, :8001 the viewer
npm run serve:site       # the assembled site/org on :8000 and site/net on :8001
```
 
On `localhost`, `127.0.0.1`, `*.localhost` and `file:` the config switches to
relative URLs, so the repository folder works as one site with no changes. In
split mode `config.js` treats port 8000 as the editor origin and 8001 as the
viewer origin (the ports are in `config.js` under `local`), so share links,
embed code and footer links cross between them exactly as they do in
production. `npm test` exercises both modes and the assembled folders.
 
## Server configuration
 
Both hosts serve plain static files. Three things matter.
 
**CORS and long caching on `dist/`.** Embed code loads the library with an
`integrity` hash and `crossorigin="anonymous"`; browsers only honour SRI on a
CORS-enabled response, so without the header below the script is refused.
The versioned copies never change, so they can be cached for a year.
 
**A Content-Security-Policy on the editor origin.** All of the editor's
JavaScript is in external files (`editor.js`, `flowchart.js`, `config.js`,
`site.js`, `dist/`), so `.org` can forbid inline script entirely. The one
exception is `preview.html`: it must *not* get that policy, because the QnA
being previewed runs inline script by design (it is sandboxed instead). Do not
put a strict CSP on `.net` either; the viewer and doc page exist to run QnAs.
`frame-src` is `'self' https:` rather than a list of hosts: an interview is
allowed to send the preview frame to another page (`A[https://…]:`, a link in
a question), and the browser checks every navigation of that frame against
the editor's `frame-src`. A narrower value makes those links fail silently in
the preview. (Sites that refuse to be framed at all, with `X-Frame-Options`
or `frame-ancestors`, still show as a blank frame; the BACK bar returns from
those too.)
 
**Redirects for old links.** The original site rendered QnAs on the `.org`
domain. Redirect those paths to `.net` so links people have shared keep
working; query strings are carried along by the rules below, and browsers
preserve the `#fragment` across a redirect on their own. Adjust the paths to
match what the old site actually used.
 
### nginx
 
```nginx
# ---- www.qnamarkup.org ----
server {
    server_name www.qnamarkup.org;
    root /var/www/qnamarkup.org/html;
    # ... listen / ssl ...
 
    add_header X-Content-Type-Options nosniff always;
    add_header Referrer-Policy no-referrer always;
 
    # the library: CORS for SRI, immutable caching for versioned copies
    location ~ ^/dist/[0-9]+\.[0-9]+\.[0-9]+/ {
        add_header Access-Control-Allow-Origin * always;
        add_header Cache-Control "public, max-age=31536000, immutable" always;
        add_header X-Content-Type-Options nosniff always;
    }
    location /dist/ {
        add_header Access-Control-Allow-Origin * always;
        add_header Cache-Control "public, max-age=3600" always;
        add_header X-Content-Type-Options nosniff always;
    }
 
    # the preview frame: no CSP (it runs QnAs), only embeddable by this site
    location = /preview.html {
        add_header Content-Security-Policy "frame-ancestors 'self'" always;
        add_header X-Content-Type-Options nosniff always;
    }
 
    # everything else: no inline script anywhere
    location / {
        add_header Content-Security-Policy "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; connect-src 'self' https:; frame-src 'self' https:; frame-ancestors 'self'; base-uri 'self'; form-action 'self' https://www.qnamarkup.net" always;
        add_header X-Content-Type-Options nosniff always;
        add_header Referrer-Policy no-referrer always;
    }
 
    # old rendering / doc URLs -> the viewer origin (query string preserved)
    location ^~ /i/   { return 301 https://www.qnamarkup.net$request_uri; }
    location ^~ /doc/ { return 301 https://www.qnamarkup.net$request_uri; }
}
 
# ---- www.qnamarkup.net ----
server {
    server_name www.qnamarkup.net;
    root /var/www/qnamarkup.net/html;
    # ... listen / ssl ...
    add_header X-Content-Type-Options nosniff always;
    add_header Referrer-Policy no-referrer always;
    # no CSP here on purpose: this origin runs QnAs
}
```
 
(`add_header` directives in a `location` replace, rather than add to, those of
the enclosing block, which is why the common headers are repeated.)
 
### Apache (`.htaccess` or the vhost)
 
```apache
# ---- www.qnamarkup.org ----
Header always set X-Content-Type-Options "nosniff"
Header always set Referrer-Policy "no-referrer"
Header always set Content-Security-Policy "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; connect-src 'self' https:; frame-src 'self' https:; frame-ancestors 'self'; base-uri 'self'; form-action 'self' https://www.qnamarkup.net"
 
<Files "preview.html">
    Header always set Content-Security-Policy "frame-ancestors 'self'"
</Files>
 
<LocationMatch "^/dist/">
    Header always set Access-Control-Allow-Origin "*"
    Header always unset Content-Security-Policy
    Header always set Cache-Control "public, max-age=3600"
</LocationMatch>
<LocationMatch "^/dist/[0-9]+\.[0-9]+\.[0-9]+/">
    Header always set Cache-Control "public, max-age=31536000, immutable"
</LocationMatch>
 
RewriteEngine On
RewriteRule ^i/(.*)$   https://www.qnamarkup.net/i/$1   [R=301,L,QSA]
RewriteRule ^doc/(.*)$ https://www.qnamarkup.net/doc/$1 [R=301,L,QSA]
 
# ---- www.qnamarkup.net ----
Header always set X-Content-Type-Options "nosniff"
Header always set Referrer-Policy "no-referrer"
```
 
Both hosts should be HTTPS-only (redirect `http://` and the bare apex to
`https://www.`). QnAs are almost always embedded in https pages, and the editor
warns about `http://` media for that reason.
 
## Notes
 
* **`www.qnamarkup.net/`** (the root) just forwards to the editor; the host
  has no editor of its own and no `editor.js`.
* **Visitor progress.** `data-save-progress` stores answers in the browser's
  localStorage for the origin the QnA runs on. Every QnA shown through the
  viewer shares the `.net` origin, so one QnA there could in principle read the
  saved answers of another (they are keyed by a hash of the markup, not by
  name). Authors who care should embed the QnA on their own site, where it has
  its origin to itself. Progress is never saved unless the author turns it on.
* **jsDelivr** still works as a mirror if you want one: tag the release in git
  and `https://cdn.jsdelivr.net/gh/colarusso/QnAMarkup@v<version>/dist/qna.min.js`
  serves the identical bytes, so the same `integrity` value applies.
* **CKEditor** on the doc page is loaded from `cdn.ckeditor.com`; if you'd
  rather not depend on it, download the 4.22.1 build into `doc/ckeditor/` and
  change the `<script src>` in `doc/index.html`.