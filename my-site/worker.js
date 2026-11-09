/**
 * Workers の入口。
 *  /api/db           → functions/api/db.js（データベース）
 *  それ以外のURL     → index.html・admin.html などの画面ファイル
 */
import { onRequestGet, onRequestPost } from "./functions/api/db.js";

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname === "/api/db") {
      if (request.method === "GET") return onRequestGet({ request, env, ctx });
      if (request.method === "POST") return onRequestPost({ request, env, ctx });
      return new Response(JSON.stringify({ error: "この方法では使えません" }), {
        status: 405,
        headers: { "Content-Type": "application/json; charset=utf-8", Allow: "GET, POST" },
      });
    }
    return env.ASSETS.fetch(request);
  },
};
