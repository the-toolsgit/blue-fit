# Blue Fit

A neon, offline-first training log and planner (PWA). Plan your week, log every set one-handed, and watch the little blue line man show how each exercise is done.

![Blue Fit icon](docs/logo.png)

- Live: https://the-toolsgit.github.io/blue-fit/
- Spec: [docs/APP_SPEC.md](docs/APP_SPEC.md)
- Project rules: [CLAUDE.md](CLAUDE.md)

## Develop
```bash
npm install
npm run dev     # http://localhost:5173/blue-fit/ (also on your local network)
npm test
npm run build
```

## Deploy
Every push to `main` runs tests, builds and publishes to GitHub Pages (`.github/workflows/deploy.yml`).
One-time setup: repo **Settings → Pages → Build and deployment → Source: GitHub Actions**.

All workout data stays in the browser on your device (IndexedDB). Use Settings → Export to back it up.
