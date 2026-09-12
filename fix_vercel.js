// Vercel routes `/api/(.*)` to `/api/index.js`
// So Vercel builds api/index.js, api/test.js etc as serverless functions.
// If any of them has a syntax error, the Vercel build will fail.
// So let's check ALL of them!
