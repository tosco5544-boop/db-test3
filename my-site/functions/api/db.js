/**
 * /api/db — 地図の色のデータベース（Cloudflare Workers → D1）。worker.js から呼ばれます
 *
 *  GET  /api/db         … 地図の色（だれでも見られる。LPが使う）
 *  GET  /api/db?who=1   … ログイン中の編集者（編集ページが使う）
 *  POST /api/db         … 県の色を切り替える { "prefecture_id": 35, "status": "visited" }
 *
 * 必要な設定（wrangler.jsonc）
 *  - d1_databases：D1 データベースを変数名「DB」で追加
 *  - vars：ACCESS_TEAM_DOMAIN（例 https://myteam.cloudflareaccess.com）
 *              ACCESS_AUD（Access アプリケーションの AUD タグ）
 *
 * 色を変えられるのは、Cloudflare Access で編集ページ（/admin）にログインした人のうち、
 * editors テーブルに登録されたメールアドレスの人だけです。
 */

export async function onRequestGet({ request, env }) {
  return handle(async () => {
    if (new URL(request.url).searchParams.has("who")) {
      const editor = await requireEditor(request, env);
      return json({ name: editor.name, email: editor.email });
    }
    return json(await getMap(env), 200, { "Cache-Control": "no-store" });
  });
}

export async function onRequestPost({ request, env }) {
  return handle(async () => {
    const editor = await requireEditor(request, env);
    return json(await setState(request, env, editor));
  });
}

/* ---------- 共通 ---------- */
class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

async function handle(fn) {
  try { return await fn(); }
  catch (e) {
    if (e instanceof HttpError) return json({ error: e.message }, e.status);
    console.error(e);
    return json({ error: "サーバーでエラーが起きました" }, 500);
  }
}

function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...headers },
  });
}

/* ---------- 地図データ ---------- */
async function getMap(env) {
  if (!env.DB) throw new HttpError(500, "D1 のバインディング（変数名 DB）が設定されていません");
  const [statuses, states] = await env.DB.batch([
    env.DB.prepare("SELECT code, label, color, sort_order, counts_as_visited FROM statuses ORDER BY sort_order"),
    env.DB.prepare(
      "SELECT ps.prefecture_id AS id, s.code AS status, ps.updated_at FROM prefecture_states ps JOIN statuses s ON s.id = ps.status_id"
    ),
  ]);
  const map = {};
  let updated = null;
  for (const r of states.results) {
    map[r.id] = r.status;
    if (!updated || r.updated_at > updated) updated = r.updated_at;
  }
  return {
    updated, // UTC（例：2026-11-09 05:12:00）
    statuses: statuses.results.map((s) => ({ ...s, counts_as_visited: !!s.counts_as_visited })),
    states: map,
  };
}

async function setState(request, env, editor) {
  let body;
  try { body = await request.json(); } catch { throw new HttpError(400, "送られてきた内容を読み取れませんでした"); }
  const pid = Number(body.prefecture_id);
  if (!Number.isInteger(pid) || pid < 1 || pid > 47) throw new HttpError(400, "都道府県コードは1〜47で指定してください");
  const status = await env.DB.prepare("SELECT id FROM statuses WHERE code = ?").bind(String(body.status || "")).first();
  if (!status) throw new HttpError(400, "その色の種類は登録されていません");

  const current = await env.DB.prepare("SELECT status_id FROM prefecture_states WHERE prefecture_id = ?").bind(pid).first();
  if (current && current.status_id === status.id) return getMap(env);

  // 履歴の記録と変更をまとめて実行（どちらかが失敗したら両方取り消し）
  await env.DB.batch([
    env.DB.prepare(
      "INSERT INTO state_history (prefecture_id, from_status_id, to_status_id, changed_by) VALUES (?1, ?2, ?3, ?4)"
    ).bind(pid, current ? current.status_id : null, status.id, editor.id),
    env.DB.prepare(
      "INSERT INTO prefecture_states (prefecture_id, status_id, updated_at, updated_by) VALUES (?1, ?2, datetime('now'), ?3) " +
      "ON CONFLICT (prefecture_id) DO UPDATE SET status_id = excluded.status_id, updated_at = excluded.updated_at, updated_by = excluded.updated_by"
    ).bind(pid, status.id, editor.id),
  ]);
  return getMap(env);
}

/* ---------- 編集できる人の確認（Cloudflare Access） ---------- */
async function requireEditor(request, env) {
  const email = await verifyAccess(request, env);
  if (!email) throw new HttpError(401, "ログインしていません。/admin を開いて Cloudflare Access でログインしてください");
  const editor = await env.DB.prepare("SELECT id, name, email FROM editors WHERE lower(email) = lower(?) AND is_active = 1")
    .bind(email).first();
  if (!editor) throw new HttpError(403, `${email} には編集の権限がありません。editors テーブルに登録してください`);
  return editor;
}

// Access のトークン（ヘッダー、または /admin でログインしたときの CF_Authorization クッキー）を検証して
// ログインした人のメールアドレスを返す。/api/db 自体は LP のために公開のままにしておけます。
async function verifyAccess(request, env) {
  const cookie = request.headers.get("Cookie") || "";
  const m = cookie.match(/(?:^|;\s*)CF_Authorization=([^;]+)/);
  const token = request.headers.get("Cf-Access-Jwt-Assertion") || (m && m[1]);
  const team = (env.ACCESS_TEAM_DOMAIN || "").replace(/\/+$/, "");
  const aud = env.ACCESS_AUD || "";
  if (!token || !team || !aud) return null;

  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [h, p, s] = parts;
  let header, payload;
  try { header = JSON.parse(b64urlText(h)); payload = JSON.parse(b64urlText(p)); } catch { return null; }

  const certs = await fetch(`${team}/cdn-cgi/access/certs`, { cf: { cacheTtl: 3600 } }).then((r) => r.json());
  const jwk = (certs.keys || []).find((k) => k.kid === header.kid);
  if (!jwk) return null;
  const key = await crypto.subtle.importKey("jwk", jwk, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]);
  const ok = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", key, b64urlBytes(s), new TextEncoder().encode(`${h}.${p}`));
  if (!ok) return null;

  const now = Math.floor(Date.now() / 1000);
  const auds = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
  if (!auds.includes(aud) || payload.exp < now || payload.iss !== team) return null;
  return payload.email || null;
}

function b64urlBytes(str) {
  const b = atob(str.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(str.length / 4) * 4, "="));
  return Uint8Array.from(b, (c) => c.charCodeAt(0));
}
function b64urlText(str) { return new TextDecoder().decode(b64urlBytes(str)); }
