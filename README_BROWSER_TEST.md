# MYFA browser test patch

This patch is intentionally NOT the full Mini App. It contains only the updated root frontend and the added/updated Ongoing implementation/assets required for browser testing.

## Browser tests

Force onboarding preview:
`https://YOUR-DOMAIN/?ongoing&test_user=673766598`

Test the normal Mini App shell as a browser test user:
`https://YOUR-DOMAIN/?test_user=673766598`

The `test_user` value is a browser-only testing convenience. It is not Telegram authentication and should not be treated as a production security mechanism.

## Files to replace/add

- `public/index.html` — accepts `?test_user=...` in browser and preserves it through the existing first-open flow.
- `public/ongoing.html` — Ongoing page entry.
- `public/assets/ongoing/ongoing.js` — preserves `test_user` when returning to the real Mini App shell.
- `public/assets/ongoing/ongoing.css` and `public/assets/ongoing/*` — Ongoing implementation/assets.

No backend file is required for this browser test fix because the existing user/first-open endpoints already accept the user ID used by the frontend.
