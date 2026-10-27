# Love Runner — Build and Deploy to GitHub Pages

## Live site

**https://devdevsamuel.github.io/project-ali/**

Repository: <https://github.com/devdevsamuel/project-ali> (public, branch `main`)

## How the deployment works

`.github/workflows/deploy.yml` runs on every push to `main` and on demand from
the Actions tab:

1. **Build** — checks out the repo, sets up Node 22, installs with `npm ci`,
   runs the tests, builds the site, then configures Pages and uploads `dist/`
   as the Pages artifact.
2. **Deploy** — publishes the artifact to GitHub Pages and reports the live
   URL on the run summary.

The workflow needs these permissions, already declared in the file:

| Permission      | Why it is needed                          |
| --------------- | ----------------------------------------- |
| `contents: read`| Check out the repository                   |
| `pages: write`  | Create the Pages deployment               |
| `id-token: write` | Authenticate the deployment via OIDC    |

## Vite base path

`vite.config.js` sets `base: '/project-ali/'` so the built assets resolve
correctly under the repository sub-path. The development server is unaffected
— it serves from the root.

## Enabling Pages

Pages is configured with **Settings → Pages → Source: GitHub Actions**. It
was enabled through the API for this repository:

```sh
gh api --method POST repos/devdevsamuel/project-ali/pages -f build_type=workflow
```

The `deploy-pages` action fails if Pages has never been enabled, so this step
is required for the first deployment.

## Useful commands

```sh
npm run dev      # local dev server
npm test         # unit tests (25 tests)
npm run build    # production build into dist/
npm run preview  # serve the built dist/ locally
gh run list      # list the deployment runs
gh run watch     # follow the current run
```

## Notes

- `dist/`, `node_modules/` and `.screenshots/` are gitignored — the workflow
  always builds from source, so no generated files are committed.
- The test script uses an unquoted glob (`node --test tests/*.test.js`). The
  shell expands it on both macOS and the Linux CI runner; a quoted glob is
  not resolved by `node --test` on the runner.
