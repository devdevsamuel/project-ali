# Love Runner — Build and Deploy to GitHub Pages

## Inspection findings
- Local dir: `/Users/macbookpro/Documents/devsamuel/project-ali` — **not a git repo** (no `.git`)
- **No `vite.config.js`** — must be created to set the `base` path
- **No `.github/`** — workflow must be created
- Authenticated GitHub account: `devdevsamuel` (gh CLI, scopes: repo, workflow)
- Existing repo: `devdevsamuel/project-ali` — public, default branch `main`, **empty** (no branches/commits), Pages not enabled
- Local dir name matches the repo name → this is the intended target
- `npm test` → 25/25 pass; `npm run build` → succeeds

## Target
- Repo: `https://github.com/devdevsamuel/project-ali`
- Pages URL: `https://devdevsamuel.github.io/project-ali/`
- Vite `base`: `/project-ali/`

## Checklist
- [ ] T1 Create `vite.config.js` with `base: '/project-ali/'`
- [ ] T2 Run `npm run build`, confirm `dist/` is deployable
- [ ] T3 Create `.github/workflows/deploy.yml` (build + upload + deploy)
- [ ] T4 `git init`, set branch `main`, add remote, commit, push
- [ ] T5 Enable GitHub Pages to serve from the Actions branch
- [ ] T6 Verify the deployment (workflow run + live URL)
- [ ] T7 Update docs

## Notes
- `dist/` and `.screenshots/` are gitignored — the workflow builds from source.
