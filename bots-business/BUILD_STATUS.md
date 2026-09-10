# BB build status

The Bots.Business package contains:

- Main MYFA BIRR WebApp templates and renderer commands.
- User-bound MYFA backend Webhook for profile, rewards, tasks, sponsored ads, referrals, leaderboard, games, withdrawals, promos and admin actions.
- Separate user-bound game backend for Ludo and Chicken Road.
- Protected admin WebApp and setup command.
- BB import order/checklist.

The original Vercel/Express implementation remains outside `bots-business/` for rollback/reference.

Runtime note: Bots.Business runtime installation/import must be performed in the target BB bot; this repository can validate the package structure and source but cannot execute inside the BB service from GitHub.
