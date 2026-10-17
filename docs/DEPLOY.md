# Deploying Archi3D on a web domain

Archi3D is a **static site**: `npm run build` produces plain files in `dist/` and nothing
runs on the server. Any web server, CDN or static host can serve it, at the domain root
(`https://archi.example.com/`) or under a path (`https://example.com/archi3d/`) — all asset
paths are relative.

> Tested here: the build served by a plain static file server under `/archi3d/` loads and lays
> out with no failed requests. The nginx, Caddy, Docker and CI snippets below are standard
> configurations but were not run in this environment (those tools were not installed).

## 1. Build

```sh
npm ci
npm test && npm run lint          # optional but recommended
npm run build                     # → dist/
rm dist/harness.html              # optional: the test page is not needed in production
```

`dist/` then contains:

| File | Size | Notes |
|---|---|---|
| `index.html` | 3 kB | the app; never cache for long |
| `assets/index-*.js`, `assets/testHooks-*.js` | ≈ 1.3 MB | app + three.js + CodeMirror; hashed names → cache forever |
| `assets/worker-*.js` | ≈ 1.4 MB | the layout engine (ELK), loaded as a module Web Worker |
| `assets/browser-*.js` | ≈ 8 MB (6 MB gzipped) | D2 compiler, downloaded **only** when someone imports a `.d2` file |
| `assets/inter-*.woff` | 30 kB | label font |

To ship your own model as the start page, either replace `fixtures/northwind.arch` before
building, or link to `index.html?fixture=<name>` for any `.arch` file you put in `fixtures/`.
(Or publish the single-file export instead: `npm run export -- model.arch --out index.html`
gives one self-contained page — the simplest deployment of all, but without D2 import.)

## 2. Server requirements

- **HTTPS** (needed by browsers for some features, and good practice).
- Correct MIME types: `.js` → `text/javascript`, `.woff` → `font/woff`. All common servers do this.
- Compression (gzip or brotli) strongly recommended: the JS shrinks to about a third.
- Caching: `assets/*` have content hashes in their names → `Cache-Control: public, max-age=31536000, immutable`;
  `index.html` → `Cache-Control: no-cache`.
- No server-side code, database or WebSocket. No external hosts are contacted by the app.

### Content-Security-Policy (optional hardening)

The app creates Web Workers from `blob:` URLs (troika text, layout) and loads WebAssembly
for D2. A policy that allows everything the app does:

```
Content-Security-Policy: default-src 'self'; script-src 'self' 'wasm-unsafe-eval' 'unsafe-eval';
  worker-src 'self' blob:; img-src 'self' data: blob:; font-src 'self' data:;
  style-src 'self' 'unsafe-inline'; connect-src 'self' data: blob:; object-src 'none'; base-uri 'self'
```

`'unsafe-eval'` and `'wasm-unsafe-eval'` are needed **only for D2 import** (its runtime loads
code with `new Function`). Drop both if you don't need D2; everything else keeps working.
`'unsafe-inline'` for styles is needed by the editor (CodeMirror injects style tags).

## 3. Recipes

### nginx

```nginx
server {
    listen 443 ssl http2;
    server_name archi.example.com;
    ssl_certificate     /etc/letsencrypt/live/archi.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/archi.example.com/privkey.pem;

    root /var/www/archi3d;          # contents of dist/
    index index.html;

    gzip on;
    gzip_types text/javascript application/javascript text/css font/woff image/svg+xml;

    location /assets/ {
        add_header Cache-Control "public, max-age=31536000, immutable";
        try_files $uri =404;
    }
    location / {
        add_header Cache-Control "no-cache";
        try_files $uri $uri/ =404;
    }
}
server { listen 80; server_name archi.example.com; return 301 https://$host$request_uri; }
```

Deploy: `rsync -av --delete dist/ user@server:/var/www/archi3d/`. Certificates: `sudo certbot --nginx -d archi.example.com`.

Under a path instead (`https://example.com/archi3d/`): copy `dist/` to `/var/www/html/archi3d/` —
no configuration change is needed because all URLs are relative.

### Caddy (automatic HTTPS)

```caddyfile
archi.example.com {
    root * /var/www/archi3d
    encode zstd gzip
    header /assets/* Cache-Control "public, max-age=31536000, immutable"
    header /index.html Cache-Control "no-cache"
    file_server
}
```

### Docker

```dockerfile
# Dockerfile
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json .npmrc ./
RUN npm ci --cache /tmp/npm-cache
COPY . .
RUN npm run build && rm dist/harness.html

FROM nginx:1.27-alpine
COPY --from=build /app/dist /usr/share/nginx/html
```

```sh
docker build -t archi3d .
docker run -p 8080:80 archi3d        # http://localhost:8080; put a TLS proxy in front for a domain
```

(The `.npmrc` points npm's cache into the project; `--cache /tmp/npm-cache` overrides that
inside the image.)

### GitHub Pages

`.github/workflows/pages.yml`:

```yaml
name: pages
on: { push: { branches: [main] } }
permissions: { contents: read, pages: write, id-token: write }
jobs:
  deploy:
    runs-on: ubuntu-latest
    environment: { name: github-pages }
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22 }
      - run: npm ci --cache ~/.npm
      - run: npm test
      - run: npm run build
      - uses: actions/upload-pages-artifact@v3
        with: { path: dist }
      - uses: actions/deploy-pages@v4
```

The site appears at `https://<user>.github.io/<repo>/` (the relative paths make the sub-path work).
Custom domain: add it under *Settings → Pages* and a `CNAME` DNS record pointing to `<user>.github.io`.

### Netlify / Cloudflare Pages / Vercel

Build command `npm run build`, output directory `dist`, Node 22. Add the headers from
section 2 in the host's headers file if you want long-lived caching or a CSP.

## 4. Checking a deployment

1. Open the site; the northwind model should appear and "Laying out…" should disappear within a second.
2. Open the browser's developer tools → *Network*: every request should go to your own domain.
3. Try **Import…** with `fixtures/adapters/northwind.mmd` (and `.d2` if D2 is enabled by your CSP).
4. On a phone, the editor should appear as a sheet at the bottom.
