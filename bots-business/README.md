# MYFA BIRR — Bots.Business deployment

This folder is the Bots.Business WebApp layer for `earn-miniapp`, following the same `WebApp.getUrl()` + `WebApp.render()` pattern used by `bots-business/BBDropBlastBot`.

## BB commands

Import these commands into Bots.Business:

- `commands/_start.js` — opens the Mini App.
- `commands/index.js` — renders `index.html` and injects CSS/JS URLs.
- `commands/renderCSS.js` — serves `script.css` as CSS.
- `commands/renderJS.js` — serves `script.js` as JavaScript.

## BB WebApp templates

The existing production frontend is under `public/`. For the BB WebApp template editor/import, map:

- `public/index.html` -> BB template `index.html`
- `public/index.css` -> BB template `script.css`
- `script1.js` -> BB template `script.js`

Also make the referenced static assets available to the WebApp template (images, game pages, CSS/JS assets, and other files under `public/`). Do not expose server-only files from `api/`.

## API origin

The current frontend intentionally uses same-origin API URLs (`/api/...`). That is safe only when the WebApp and API are served from the same origin. If BB is only the frontend host while the API remains elsewhere, the frontend must be configured with an explicit trusted API origin before deployment.

Do **not** put Firebase admin credentials, bot tokens, admin secrets, or withdrawal authorization in BB WebApp templates. Browser WebApps are user-accessible and cannot be treated as a trusted backend.

## Critical security rule

Balance changes, withdrawals, reward claims, game rewards, ad rewards, referral credits, campaign actions and admin operations must remain server-side and must verify Telegram WebApp `initData`/user identity. Do not move these mutations into browser JavaScript or public BB WebApp code.

## Migration status

This layer makes the project BB-WebApp-shaped without deleting the existing Express/Firebase backend. A true no-external-backend migration requires rewriting each backend endpoint to a protected Bots.Business webhook/command flow and migrating persistent state; that is a backend migration, not a static hosting change.
