import { httpServerHandler } from "cloudflare:node";
import app from "./api/index-cloudflare.js";

// Initialize the existing Express API inside Cloudflare's Node compatibility layer.
app.listen(3000);
const apiHandler = httpServerHandler({ port: 3000 });

async function serveStatic(request, env) {
  const response = await env.ASSETS.fetch(request);
  const contentType = response.headers.get("content-type") || "";

  // Prevent the legacy Monetag 41731 SDK from auto-firing on app startup.
  // The reward runtime loads Monetag only when the user explicitly watches an ad.
  if (contentType.includes("text/html")) {
    const html = await response.text();
    const cleaned = html
      .replace(/<script\s+src=["'](?:https?:)?\/\/libtl\.com\/sdk\.js["'][^>]*data-zone=["']41731["'][^>]*><\/script>\s*/gi, "")
      .replace(/<script\s+src=["'](?:https?:)?\/\/libtl\.com\/sdk\.js["'][^>]*data-sdk=["']show_41731["'][^>]*><\/script>\s*/gi, "");

    const headers = new Headers(response.headers);
    headers.set("Cache-Control", "no-store, no-cache, must-revalidate");
    return new Response(cleaned, { status: response.status, statusText: response.statusText, headers });
  }

  return response;
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname.startsWith("/api/")) {
      return apiHandler.fetch(request, env, ctx);
    }

    return serveStatic(request, env);
  },
};
