# MYFA BIRR — BB import order

Import the commands/templates in this order:

1. `_start.js`
2. `index.js`
3. `index.html.js`
4. `renderCSS.js`
5. `script.css.js`
6. `renderJS.js`
7. `script.final.js.js`
8. `myfa-api-v2.js`
9. `myfa-games.js`
10. `myfa-setup.js`
11. `bb-api-health.js`
12. `admin.js`
13. `admin.html.js`
14. `adminCSS.js`
15. `admin.css.js`
16. `adminJS.js`
17. `admin.js.js`

Then set the Bot property `MYFA_ADMIN_TELEGRAM_ID` to the administrator Telegram ID and run `/myfa-setup`.

The main WebApp gets per-user secure API URLs from `/start`. Do not replace them with a public endpoint or add a user id to the URL yourself.
