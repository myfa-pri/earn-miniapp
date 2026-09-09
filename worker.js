import app from "./api/index.js";
import gamesRouter from "./api/games.js";

// Cloudflare Worker adapter for the existing MYFA BIRR Express application.
// Keep all current route handlers intact while serving the existing public/
// directory through Workers Static Assets.

let expressApp;

async function getApp() {
  if (expressApp) return expressApp;

  // The existing API entry currently creates and configures an Express app.
  // It is imported here so Cloudflare can serve the same route surface.
  expressApp = app;
  try {
    expressApp.use("/api", gamesRouter);
  } catch (_) {
    // Avoid duplicate mounting during module initialization.
  }
  return expressApp;
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname.startsWith("/api/")) {
      const currentApp = await getApp();
      if (currentApp?.fetch) {
        return currentApp.fetch(request, env, ctx);
      }
    }

    return env.ASSETS.fetch(request);
  },
};
