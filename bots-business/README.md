# MYFA BIRR — Bots.Business package

This directory is the Bots.Business package for the MYFA BIRR Mini App. It follows the WebApp template structure used by the reference `bots-business/BBDropBlastBot`, while using secure user-bound Webhooks for account and reward mutations.

## Active BB WebApp
- `commands/_start.js` — `/start`; generates per-user secure API URLs and opens MYFA BIRR.
- `commands/index.js` — WebApp renderer.
- `commands/index.html.js` — active MYFA BB HTML shell.
- `commands/renderCSS.js` / `commands/script.css.js` — active CSS.
- `commands/renderJS.js` / `commands/script.final.js.js` — active JavaScript frontend.

## BB backend
- `commands/myfa-api-v2.js` — user/profile/settings, daily rewards, tasks, sponsored ads, referrals, leaderboard, Aviator/Drop/Multi-Ox/Sketch/Daily Combo, withdrawals, promos and admin actions.
- `commands/myfa-games.js` — Ludo and Chicken Road backend.
- `commands/myfa-setup.js` — initialize default MYFA BB configuration.
- `commands/bb-api-health.js` — backend health check.

## BB admin
- `commands/admin.js` — protected `/admin` entry.
- `commands/admin.html.js`, `adminCSS.js`, `admin.css.js`, `adminJS.js`, `admin.js.js` — admin WebApp.

## Original frontend source included
`source-frontend/` contains exact copies of the main original MYFA frontend blobs from `public/` for parity/reference, including the original index, CSS, main script, How, Drop, Ludo, Ongoing, Ad Studio, Ads Center and Campaign Manager files. The active BB shell is intentionally rewritten to use BB user-bound Webhooks instead of the old Vercel API surface.

## Security
Bots.Business documents that WebApps are not protected and recommends Webhooks for important mutations such as balances and game points. The package therefore creates user-bound backend URLs from `/start` with `Libs.Webhooks.getUrlFor()`. The browser never selects another user's account by submitting a user id.

Official docs:
- https://help.bots.business/bjs/web-app
- https://help.bots.business/libs/webhooks-lib
- https://help.bots.business/bjs/properties
- https://help.bots.business/bjs/lists

## Data model
User property: `MYFA_STATE`.
Bot properties: `MYFA_CONFIG`, `MYFA_TASKS`, `MYFA_CAMPAIGNS`, `MYFA_WITHDRAWALS`, `MYFA_TOP`, `MYFA_PROMOS`, `MYFA_TOTAL_USERS`, `MYFA_ADMIN_TELEGRAM_ID`.

The global JSON arrays are capped; for a large production population, move long-term leaderboard, campaign and withdrawal history to BB Lists.

## Setup
1. Import the BB commands in `commands/BB_IMPORT_ORDER.md` into your Bots.Business bot.
2. Set the Bot property `MYFA_ADMIN_TELEGRAM_ID` to the administrator Telegram ID.
3. Run `/myfa-setup` as that administrator.
4. Run `/start` and open MYFA BIRR.
5. Run `/admin` as the configured administrator.

## Original application
The original `api/` and `public/` implementation remains in the repository for rollback/reference. The BB package does not execute Node/Express code; its backend is rewritten in BJS with BB user/bot properties and user-bound Webhooks.
