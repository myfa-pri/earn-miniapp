# MYFA BIRR — Bots.Business package

This directory is the self-contained Bots.Business package for the MYFA BIRR Mini App. It follows the WebApp template structure used by the reference `bots-business/BBDropBlastBot`, while using secure user-bound Webhooks for account and reward mutations.

## Import these BB commands

### Main Mini App
- `commands/_start.js` — `/start`; generates the per-user secure WebApp API URLs and opens the Mini App.
- `commands/index.js` — WebApp renderer; receives the secure URLs from `/start` through WebApp options.
- `commands/index.html.js` — main MYFA BIRR HTML template.
- `commands/renderCSS.js` — CSS renderer.
- `commands/script.css.js` — main CSS template.
- `commands/renderJS.js` — JavaScript renderer.
- `commands/script.final.js.js` — main MYFA BIRR frontend.

### Backend
- `commands/myfa-api-v2.js` — users, profiles, settings, daily rewards, tasks, sponsored ads, referrals, leaderboard, five core games, withdrawals, promos and admin actions.
- `commands/myfa-games.js` — Ludo and Chicken Road backend.
- `commands/bb-api-health.js` — backend health check.
- `commands/myfa-setup.js` — first-time MYFA BB configuration.

### Admin
- `commands/admin.js` — protected `/admin` panel entry.
- `commands/admin.html.js` — admin template.
- `commands/adminCSS.js` / `commands/admin.css.js` — admin CSS renderer/template.
- `commands/adminJS.js` / `commands/admin.js.js` — admin JavaScript renderer/template.

## Security

Bots.Business documents that WebApps are not protected and recommends Webhooks for important mutations such as balances and game points. The BB package therefore creates the user-bound backend URLs from `/start` with `Libs.Webhooks.getUrlFor()`. The browser does not submit a user id to choose another account.

Official documentation:
- https://help.bots.business/bjs/web-app
- https://help.bots.business/libs/webhooks-lib
- https://help.bots.business/bjs/properties
- https://help.bots.business/bjs/lists

## BB data model

User property: `MYFA_STATE`.
Bot properties: `MYFA_CONFIG`, `MYFA_TASKS`, `MYFA_CAMPAIGNS`, `MYFA_WITHDRAWALS`, `MYFA_TOP`, `MYFA_PROMOS`, `MYFA_TOTAL_USERS`, `MYFA_ADMIN_TELEGRAM_ID`.

The migration caps large global arrays. Bots.Business recommends Lists rather than large JSON arrays; move leaderboard, withdrawal and campaign history to BB Lists as usage grows.

## First-time setup

1. Import the files under `commands/` into your Bots.Business bot.
2. Set the Bot property `MYFA_ADMIN_TELEGRAM_ID` to the administrator Telegram ID.
3. Run `/myfa-setup` as that administrator.
4. Run `/start`.
5. Open the MYFA BIRR WebApp.
6. Use `/admin` for the protected admin panel.

## Vercel / Express

The original `api/` and `public/` application remains in the repository as the rollback/reference implementation. The BB package does not execute Node/Express code. Its BB backend is rewritten in BJS with user/bot properties and user-bound Webhooks.
