## 2024-05-18 - [Firebase REST Promise.all Usage]
**Learning:** The backend interacts with the Firebase Realtime Database exclusively via the REST API. `Promise.all()` is used correctly for reading (`dbGet`) but must be careful with updating user balances (`dbUpdate`) because they don't support atomic transaction operations out-of-the-box. While N+1 DB reads can be optimized using `Promise.all`, write operations like `user.points += x` in loops can create race conditions and must be sequenced to avoid double-spend or money destruction.
**Action:** Always check the memory block for concurrency limits, and make sure not to apply `Promise.all` on `dbUpdate` where user balances or claims are being modified if multiple updates could target the same key.

## 2024-05-18 - [Cloudflare Workers compatibility]
**Learning:** `Promise.all` batches could hit request limits, or Cloudflare worker memory limits. Node.js built-ins require specific compatibility flags.
**Action:** Be mindful of Cloudflare environments before adding complex batching.

## 2024-05-18 - [Performance Focus]
**Learning:** Caching with TTL is already widely used for high frequency endpoints. N+1 queries in Firebase is a prominent pattern.
**Action:** Look for endpoints that read a lot of keys inside loops.
## 2024-05-18 - [Firebase Full Table Scans]
**Learning:** `app.get('/api/public/globals'` fetches the entire `users` table via `const usersObj = await dbGet('users') || {};` just to calculate `Object.keys(usersObj).length`. This is extremely inefficient and reads all user data into memory every time the cache expires. This same pattern likely exists in other places like leaderboards.
**Action:** Need to find a way to maintain a counter for total users or optimize the queries that fetch all users.
## 2024-05-18 - [Firebase Full Table Scans optimization for /api/referrer/:id]
**Learning:** `app.get('/api/referrer/:id')` fetches all users just to resolve a list of referred user IDs. We can change this to `Promise.all` over `dbGet` for each specific user ID, which scales better than fetching a 100k+ entry users table.

**Learning:** `app.get('/api/public/globals')` calculates total users dynamically. There should be a cached total or incremental counter instead, or a specialized lightweight request.

**Learning:** `app.get('/api/leaderboard/:id')` loads the full users object, filters out banned, sorts by points, then takes top 100 and caches it. A caching mechanism is present (`leaderboardCache.byPoints`), but it doesn't seem to have a time-to-live or it is being recalculated on every single request because `leaderboardCache` is never checked before hitting `dbGet('users')`! This means every user checking their rank or viewing the leaderboard downloads the whole database and does an O(N log N) sort.

**Action:** Add caching to `/api/leaderboard/:id` to prevent recalculation. Add `Promise.all` batch fetching for `/api/referrer/:id`. For `/api/public/globals`, caching is already there but could avoid the `users` query entirely if we just track a `stats.totalUsers` or use the cached result properly. Let's fix the `leaderboard` caching since leaderboard loading is highly impactful to UX and backend load. Wait, `/api/public/globals` DOES use cache! `if (publicGlobalsCache.data && publicGlobalsCache.expiresAt > nowMs)`. Leaderboard however doesn't check the cache before fetching!

## 2024-05-18 - [Leaderboard Performance Bottleneck]
**Learning:** `app.get('/api/leaderboard/:id')` currently performs a full table scan `await dbGet('users')` for *every* request. Although there is a `leaderboardCache` variable, it is only updated and never read (except if `leaderboardFreeze` is on). This creates an O(N) database download and an O(N log N) sorting operation on the main thread for every leaderboard view, drastically affecting performance.

**Action:** Implement a TTL-based cache check (e.g. `expiresAt: Date.now() + 60000`) at the beginning of the endpoint. If the cache is valid, return it. Only fetch the `users` table and perform the sort when the cache expires. This will drastically improve backend response time and reduce Firebase bandwidth for popular endpoints.

Let's do this one!
