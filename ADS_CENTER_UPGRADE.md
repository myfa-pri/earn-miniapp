# MYFA Ads Center Upgrade

This upgrade keeps the existing MYFA project structure and adds a working Ads Center around the existing Firebase economy.

## Main changes

- Bottom Mini App Ads navigation now opens `/setting.html?userId=...`.
- `public/setting.html` is now a functional Ads Center instead of a visual/demo-only control page.
- `public/ads-center-enhancements.js` adds validation, draft saving, network health, periodic synchronization, keyboard/mobile safety, and budget previews.
- `api/ads.js` provides a dedicated serverless Ads service.
- `vercel.json` routes `/api/ads` to the new service before the existing Express catch-all.

## Reward flow

1. The client requests a signed ad session.
2. The server checks the user and daily/hourly limits.
3. A provider or funded MYFA campaign is shown.
4. Completion is sent back with the signed session token.
5. The server rejects expired/reused/too-fast sessions.
6. The server updates Firebase balances and the ad reward history.
7. The UI refreshes the authoritative user balance from the server.

## Ten user-facing Ads features

1. Server reward sessions
2. Completion timing
3. Daily frequency caps
4. Hourly rate limits
5. One-time claim tokens
6. Live earnings dashboard
7. Reward history
8. Funded MYFA sponsored inventory
9. Advertiser analytics
10. Campaign controls

## External ad providers

Monetag, Adsgram, and Adsterra remain dependent on the provider configuration/account being active. The page does not manufacture an ad or manufacture a reward when a provider is unavailable.

The Adsgram block ID can be configured through `config.adsgramBlockId`; the current project default remains compatible with the existing integration when that value is not present.
