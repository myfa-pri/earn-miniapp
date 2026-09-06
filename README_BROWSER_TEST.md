# MYFA browser test fix

Replace the files in this patch in the existing project.

Test in Chrome:
`https://earn-miniapp.vercel.app/?test_user=673766598`

Force onboarding preview:
`https://earn-miniapp.vercel.app/?ongoing&test_user=673766598`

The `?ongoing` path is deliberately standalone: it must render the onboarding without requiring Telegram. It does not mark an account complete. The `test_user` query is retained only for browser testing and is not a production authentication mechanism.

Cache-busting query strings were added to the ongoing CSS/JS references, and the Telegram-only error card is hard-disabled whenever `?ongoing` is present.
