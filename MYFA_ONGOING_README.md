# MYFA Ongoing — Layered Animated Implementation

## Browser visual test
Open `/?ongoing` to preview the three onboarding pages in a normal browser without changing any Telegram account.

## Account-backed test
For an existing test/owner Telegram user, `/?ongoing&test_user=YOUR_TELEGRAM_USER_ID` exercises the existing first-open completion endpoint. Do not use this as an admin bypass.

## Production behavior
The normal `index.html` first-open flow already routes users who have not completed `firstOpenCompleted` to `/ongoing.html`. Returning users continue directly through the existing MYFA app. After the onboarding completion endpoint succeeds, `/` is loaded again so the existing Official Channel gate (`requireGate`) or Mini App destination remains authoritative.

## Layering
`public/ongoing.html` is a real DOM/CSS/SVG implementation. The supplied `public/assets/ongoing/page1.png`, `page2.png`, `page3.png`, and `reference-composite.png` are retained only as visual/reference files and are not referenced by the production onboarding UI. Scenic crops, flower crops and ribbon crops derived from the reference are separate assets; text and buttons are HTML; icons are independent inline SVG elements; stars/particles and glows are CSS/DOM layers.

## Canva source
The three converted editable Canva source projects previously created from the owner reference are: Page 1 `DAHUdYzQizc`, Page 2 `DAHUdZpe4jU`, Page 3 `DAHUdYXJcnQ`. Raw native Canva asset-file export was not exposed by the available connector, so the web package uses reference-derived local layers rather than claiming a native Canva binary export.
