# privacy-page

Tiny Caddy-based static service that serves the Privacy Policy on Railway.
You can host the Terms of Service or any other legal page from here too — just drop
more HTML files next to `index.html` and they'll be served at the matching path.

## Deploy to Railway

1. Edit `index.html` and replace every yellow `[PLACEHOLDER]` with your real values.
2. Push to GitHub: `git add . && git commit -m "Add privacy page" && git push`.
3. Railway → your project → **+ New → GitHub Repo** → pick `marketing-system` →
   **Settings → Source → Root Directory** = `services/privacy-page`.
4. **Settings → Networking → Generate Domain.** You get
   `https://privacy-page-production-xxxx.up.railway.app`.
5. (Recommended) **Settings → Networking → + Custom Domain** = `privacy.adbuild.ae`.
   Cloudflare DNS will be auto-set if you use Cloudflare for `adbuild.ae`.
6. Submit `https://privacy.adbuild.ae` as the Privacy Policy URL in the Meta App Review.

The container costs basically nothing (Caddy alpine is ~50 MB RAM idle).
