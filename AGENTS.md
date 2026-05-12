# Repository Guidelines

## Project Structure & Module Organization

This repository contains a small contact form app with a local Node.js backend.

- `index.html` contains the form markup and client-side validation behavior.
- `styles.css` contains all visual styling for the form, modal, and result page.
- `server.js` serves static files and handles `POST /submit` form submissions.
- `package.json` defines the local run command.
- `data/` is created at runtime for submissions and uploads and is ignored by git.

There is no separate test directory yet. Keep new source files at the repository root unless the app grows enough to justify `public/`, `src/`, or `tests/`.

## Build, Test, and Development Commands

- `npm start` starts the local server at `http://127.0.0.1:3000`.
- `node server.js` runs the same server directly.
- `node --check server.js` checks backend JavaScript syntax without starting the server.
- `tidy -qe index.html` can be used for basic HTML validation. It may warn about `aria-modal`; that attribute is intentional.

There is no build step and no dependency installation is required for the current app.

## Coding Style & Naming Conventions

Use two-space indentation in HTML, CSS, JSON, and JavaScript. Prefer plain CommonJS in backend code, matching `server.js`. Keep CSS class names descriptive and kebab-case, for example `contact-card`, `alert-modal`, and `back-link`.

Keep frontend behavior simple and colocated in `index.html` unless scripts become large enough to split out. Avoid adding npm packages unless they remove clear complexity.

## Testing Guidelines

No automated test framework is configured yet. For now, test manually:

1. Run `npm start`.
2. Open `http://127.0.0.1:3000`.
3. Submit the form with valid fields and an optional attachment.
4. Confirm records appear in `data/submissions.jsonl`.
5. Confirm uploaded files appear in `data/uploads/`.

Also test invalid input to confirm the validation modal appears and the backend rejects incomplete submissions.

## Commit & Pull Request Guidelines

Existing history uses short imperative or descriptive commit messages, including Latvian and English examples such as `pievienoju login funkciju` and `Fix alert modal hidden-state display rule`. Keep commits focused and describe the user-visible change.

Pull requests should include a brief summary, testing steps performed, and screenshots for visual changes. Mention any new runtime files, environment variables, or data storage behavior.

## Security & Configuration Tips

The backend stores submissions locally. Do not commit `data/` contents, uploaded files, secrets, or personal form data. The default server binds to `127.0.0.1`; keep it local unless you intentionally configure deployment.
