# Put Archi3D on your own domain

Archi3D is a static site. `npm run build` makes plain files in `dist/`, nothing runs on the server.
So any web server, CDN or static hosting can serve it. It works on the root of a domain
(`https://archi.example.com/`) and also under a path (`https://example.com/archi3d/`), because all
paths are relative.

> I tested the build with a simple static file server under `/archi3d/`, it loaded and did the
> layout with no failed request. The nginx, Caddy, Docker and GitHub Pages configs below are the
> usual ones but I couldn't run them here (those tools were not installed).

## 1. Build

```sh
npm ci
npm test && npm run lint          # not required, but better to run
npm run build                     # makes dist/
rm dist/harness.html              # optional, this is only the test page
```

What is in `dist/`:

| File | Size | Notes |
|---|---|---|
| `index.html` | 3 kB | the app, don't cache it for long |
| `assets/index-*.js`, `assets/testHooks-*.js` | about 1.3 MB | app, three.js and CodeMirror. Names have a hash, so you can cache them forever |
| `assets/worker-*.js` | about 1.4 MB | the layout engine (ELK), runs in a web worker |
| `assets/browser-*.js` | about 8 MB (6 MB gzipped) | the D2 compiler, only downloaded when someone imports a `.d2` file |
| `assets/inter-*.woff` | 30 kB | font for the labels |

If you want your own model as the start page, replace `fixtures/northwind.arch3d` before the build,
or put your `.arch3d` file in `fixtures/` and link to `index.html?fixture=<name>`.
Another option is the single file export: `npm run export -- model.arch3d --out index.html` gives
one page with everything inside. That is the easiest way, but D2 import is not in it.

## 2. What the server needs

- HTTPS. Browsers need it for some features and it is good practice anyway.
- Correct MIME types: `.js` as `text/javascript`, `.woff` as `font/woff`. Normal servers already do this.
- Compression (gzip or brotli). Strongly recommended, the JS gets about 3 times smaller.
- Caching: files in `assets/` have a hash in the name, so use
  `Cache-Control: public, max-age=31536000, immutable`. For `index.html` use `Cache-Control: no-cache`.
- No server code, no database, no WebSocket. The app doesn't call any other host.

### Content-Security-Policy (optional)

The app starts web workers from `blob:` URLs (text labels, layout) and loads WebAssembly for D2.
This policy allows all of it:

```
Content-Security-Policy: default-src 'self'; script-src 'self' 'wasm-unsafe-eval' 'unsafe-eval';
  worker-src 'self' blob:; img-src 'self' data: blob:; font-src 'self' data:;
  style-src 'self' 'unsafe-inline'; connect-src 'self' data: blob:; object-src 'none'; base-uri 'self'
```

`'unsafe-eval'` and `'wasm-unsafe-eval'` are only needed for the D2 import (its runtime loads code
with `new Function`). If you don't need D2 you can remove both, the rest still works.
`'unsafe-inline'` for styles is needed because the editor (CodeMirror) adds style tags.

## 3. Examples

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

Copy the files: `rsync -av --delete dist/ user@server:/var/www/archi3d/`.
Certificate: `sudo certbot --nginx -d archi.example.com`.

For a path like `https://example.com/archi3d/`, just copy `dist/` to `/var/www/html/archi3d/`.
No config change is needed because the URLs are relative.

### Caddy (HTTPS is automatic)

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
docker run -p 8080:80 archi3d        # http://localhost:8080, for a domain put a TLS proxy in front
```

`.npmrc` sets npm's cache inside the project, `--cache /tmp/npm-cache` changes that inside the image.

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

The site will be on `https://<user>.github.io/<repo>/` (works because the paths are relative).
For your own domain add it in Settings > Pages and make a `CNAME` DNS record to `<user>.github.io`.

### Netlify, Cloudflare Pages, Vercel

Build command `npm run build`, output folder `dist`, Node 22. If you want long caching or a CSP, add
the headers from section 2 in the headers file of the host.

## 4. Check it after deploy

1. Open the site. The northwind model should show up and "Laying out..." should go away in about a second.
2. Open the developer tools, Network tab. All requests should go to your own domain.
3. Try Import with `fixtures/adapters/northwind.mmd` (and a `.d2` file if your CSP allows D2).
4. On a phone the editor should be at the bottom.
