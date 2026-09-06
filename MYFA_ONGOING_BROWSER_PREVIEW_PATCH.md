MYFA ONGOING — BROWSER PREVIEW PATCH

This ZIP contains ONLY the edited files needed to fix the ongoing browser preview. It is NOT a full project ZIP.

Changed files:
- public/index.html
- public/ongoing.html
- public/assets/ongoing/ongoing.js
- public/assets/ongoing/ongoing.css

Browser test:
https://YOUR-DOMAIN/?ongoing

The root ?ongoing route now redirects to /ongoing.html?ongoing=preview.
Preview mode does not require Telegram and does not call the first-open API. It is UI-only.

Production behavior remains Telegram-authenticated when the normal app is opened without ?ongoing.
