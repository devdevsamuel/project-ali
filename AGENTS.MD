# AGENTS.md — Love Runner

## Project Principles
- Keep the project simple, maintainable, and easy to understand.
- Prefer straightforward solutions over unnecessary abstractions or dependencies.
- Follow existing project conventions.
- Keep changes focused on the task.

## Task Planning
- Divide every request into clear, actionable tasks before implementation.
- Use Plan mode for complex requests when available.
- Maintain a checklist using `- [ ]` for pending tasks and `- [x]` for completed tasks.
- Work through tasks incrementally and update the checklist as each task is completed.
- Mark tasks complete only after implementing and verifying them.
- In Build mode, follow the plan and keep the checklist updated.
- For small requests, use a short checklist.
- If no planning tool is available, maintain the checklist in your response or an appropriate project task list.

## Code Quality
- Use descriptive names and small, cohesive modules.
- Avoid duplicated logic.
- Inspect relevant files before making changes.
- Preserve existing functionality and avoid unrelated rewrites.
- Run relevant project checks after modifications.
- Never claim tests were performed unless they actually were.

## Dependencies and Configuration
- Prefer existing dependencies and native browser APIs.
- Never commit secrets or private information.
- Do not add tracking or unexpected external requests without approval.

## Documentation
- Keep documentation concise and accurate.
- Update documentation when necessary.
- Avoid duplicating requirements or plans.

## Deployment
- The site is published to <https://devdevsamuel.github.io/project-ali/> from the `main` branch.
- `.github/workflows/deploy.yml` tests, builds and publishes `dist/`; pushing to `main` deploys it.
- `vite.config.js` sets `base: '/project-ali/'` — keep it in sync with the repository name.
- See `DEPLOY.md` for the workflow, permissions and troubleshooting.

## Priority
1. Follow the user's latest explicit instructions.
2. Respect the existing architecture.
3. Prefer the simplest reliable implementation.
4. Ask for clarification when necessary.