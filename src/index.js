// my BES · my.bes-energy.com — launcher for BES internal sites.
// Microsoft (Entra ID) sign-in — same model as portal / project-management:
// auth-code + PKCE, routes /api/auth/login · /api/auth/callback · /api/auth/logout · /api/auth/me.
// MFA (Microsoft Authenticator) is enforced by the BES tenant, not by this code.
//
// Settings (wrangler.toml [vars]):  ENTRA_TENANT_ID, ENTRA_CLIENT_ID, ENTRA_DOMAIN_HINT
// Secrets (Cloudflare dashboard):   ENTRA_CLIENT_SECRET, SESSION_SECRET

import { SITES } from "./sites.js";
import { renderPage, renderSignIn, renderSignedOut, renderError } from "./page.js";

const SESSION_COOKIE = "mybes_session";
const OAUTH_COOKIE = "mybes_oauth";
const LAST_COOKIE = "mybes_last"; // remembers the last visit time across sign-outs (this browser only)
const SESSION_DAYS = 30; // sliding: renewed on every visit, same as Project Manager

// ---------- helpers ----------
const enc = new TextEncoder();
const b64url = (buf) =>
  btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const b64urlDecode = (s) => {
  s = s.replace(/-/g, "+").replace(/_/g, "/");
  while (s.length % 4) s += "=";
  return Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
};
const rand = (n = 32) => b64url(crypto.getRandomValues(new Uint8Array(n)));
const nowSec = () => Math.floor(Date.now() / 1000);

const hmacKey = (secret) =>
  crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);

// Signed, expiring token: base64url(JSON).signature
export async function sign(obj, secret) {
  const payload = b64url(enc.encode(JSON.stringify(obj)));
  const sig = b64url(await crypto.subtle.sign("HMAC", await hmacKey(secret), enc.encode(payload)));
  return `${payload}.${sig}`;
}
export async function verify(token, secret) {
  if (!token || token.split(".").length !== 2) return null;
  const [payload, sig] = token.split(".");
  try {
    const ok = await crypto.subtle.verify("HMAC", await hmacKey(secret), b64urlDecode(sig), enc.encode(payload));
    if (!ok) return null;
    const obj = JSON.parse(new TextDecoder().decode(b64urlDecode(payload)));
    return obj.exp && obj.exp > nowSec() ? obj : null;
  } catch {
    return null;
  }
}

function getCookie(req, name) {
  for (const part of (req.headers.get("Cookie") || "").split(/;\s*/)) {
    const i = part.indexOf("=");
    if (i > 0 && part.slice(0, i) === name) return decodeURIComponent(part.slice(i + 1));
  }
  return null;
}
const setCookie = (name, value, maxAge) =>
  `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;

const SECURITY_HEADERS = {
  "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; img-src 'self' data:; base-uri 'none'; form-action 'self'; frame-ancestors 'none'",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Cache-Control": "no-store",
};
function html(body, status = 200, cookies = []) {
  const h = new Headers({ "Content-Type": "text/html; charset=utf-8", ...SECURITY_HEADERS });
  cookies.forEach((c) => h.append("Set-Cookie", c));
  return new Response(body, { status, headers: h });
}
function redirect(location, cookies = []) {
  const h = new Headers({ Location: location, "Cache-Control": "no-store" });
  cookies.forEach((c) => h.append("Set-Cookie", c));
  return new Response(null, { status: 302, headers: h });
}

function missingConfig(env) {
  const missing = ["ENTRA_TENANT_ID", "ENTRA_CLIENT_ID", "ENTRA_CLIENT_SECRET", "SESSION_SECRET"].filter((k) => !env[k]);
  return missing.length ? `Microsoft sign-in is not configured yet (missing: ${missing.join(", ")}).` : null;
}
const domain = (env) => (env.ENTRA_DOMAIN_HINT || "bes-energy.com").toLowerCase();

async function newSession(user, env) {
  const token = await sign({ ...user, exp: nowSec() + SESSION_DAYS * 86400 }, env.SESSION_SECRET);
  return setCookie(SESSION_COOKIE, token, SESSION_DAYS * 86400);
}
async function lastVisitCookie(user, env) {
  const token = await sign({ email: user.email, seen: user.seen, exp: nowSec() + 365 * 86400 }, env.SESSION_SECRET);
  return setCookie(LAST_COOKIE, token, 365 * 86400);
}
const VISIT_GAP = 30 * 60; // visits closer than 30 min count as the same visit (refreshes, tile clicks)

async function currentUser(req, env) {
  const s = await verify(getCookie(req, SESSION_COOKIE), env.SESSION_SECRET);
  if (!s) return null;
  // seen = start of the current visit, prev = start of the visit before it
  const t = nowSec();
  const newVisit = !s.seen || t - (s.last || s.seen) > VISIT_GAP;
  const user = {
    name: s.name, email: s.email, oid: s.oid,
    signin: s.signin || s.seen || t, // time of the Microsoft sign-in (older sessions: first recorded visit)
    prev: newVisit ? s.seen || null : s.prev || null,
    seen: newVisit ? t : s.seen,
    last: t,
  };
  return { ...user, renew: await newSession(user, env) };
}

// ---------- auth routes ----------
async function login(req, env) {
  const signedIn = await currentUser(req, env);
  if (signedIn) return redirect("/", [signedIn.renew]);

  const origin = new URL(req.url).origin;
  const state = rand(16);
  const verifier = rand(48);
  const flow = await sign({ state, verifier, exp: nowSec() + 600 }, env.SESSION_SECRET);
  const challenge = b64url(await crypto.subtle.digest("SHA-256", enc.encode(verifier)));

  const p = new URLSearchParams({
    client_id: env.ENTRA_CLIENT_ID,
    response_type: "code",
    redirect_uri: `${origin}/api/auth/callback`,
    response_mode: "query",
    scope: "openid profile email offline_access User.Read",
    state,
    code_challenge: challenge,
    code_challenge_method: "S256",
    domain_hint: domain(env),
  });
  return redirect(`https://login.microsoftonline.com/${env.ENTRA_TENANT_ID}/oauth2/v2.0/authorize?${p}`, [
    setCookie(OAUTH_COOKIE, flow, 600),
  ]);
}

async function callback(req, env) {
  const url = new URL(req.url);
  const clearFlow = setCookie(OAUTH_COOKIE, "", 0);

  if (url.searchParams.get("error")) {
    const d = url.searchParams.get("error_description") || "Microsoft sign-in was cancelled.";
    return html(renderError(d.split(/\r?\n/)[0].replace(/^AADSTS\d+:\s*/, "")), 401, [clearFlow]);
  }
  const flow = await verify(getCookie(req, OAUTH_COOKIE), env.SESSION_SECRET);
  if (!flow || flow.state !== url.searchParams.get("state") || !url.searchParams.get("code")) {
    // Back button / reused link: already signed in → home, else start again
    const already = await currentUser(req, env);
    return already ? redirect("/", [already.renew]) : redirect("/api/auth/login");
  }

  const tokenRes = await fetch(`https://login.microsoftonline.com/${env.ENTRA_TENANT_ID}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: env.ENTRA_CLIENT_ID,
      client_secret: env.ENTRA_CLIENT_SECRET,
      grant_type: "authorization_code",
      code: url.searchParams.get("code"),
      redirect_uri: `${url.origin}/api/auth/callback`,
      code_verifier: flow.verifier,
    }),
  });
  const tok = await tokenRes.json().catch(() => ({}));
  if (!tokenRes.ok || !tok.id_token) {
    const d = String(tok.error_description || "Token exchange with Microsoft failed.").split(/\r?\n/)[0];
    return html(renderError(d), 401, [clearFlow]);
  }

  // id_token came straight from Microsoft's token endpoint over TLS to this confidential client,
  // so its signature need not be re-checked (OIDC Core 3.1.3.7); the claims are still validated.
  const claims = JSON.parse(new TextDecoder().decode(b64urlDecode(tok.id_token.split(".")[1])));
  const email = String(claims.preferred_username || claims.email || claims.upn || "").toLowerCase();
  const problems = [];
  if (claims.tid !== env.ENTRA_TENANT_ID) problems.push("this account is not in the BES Microsoft tenant");
  if (claims.aud !== env.ENTRA_CLIENT_ID) problems.push("token audience mismatch");
  if (!claims.exp || claims.exp < nowSec()) problems.push("token expired");
  if (!email.endsWith("@" + domain(env))) problems.push(`only @${domain(env)} accounts can sign in`);
  if (problems.length) return html(renderError(`Access denied: ${problems.join("; ")}.`), 403, [clearFlow]);

  // Carry the previous visit over a fresh sign-in (same browser), so "Last visit" survives sign-out
  const old = await verify(getCookie(req, LAST_COOKIE), env.SESSION_SECRET);
  const prev = old && old.email === email ? old.seen : null;
  const t = nowSec();
  const session = await newSession({ name: claims.name || email, email, oid: claims.oid, signin: t, prev, seen: t, last: t }, env);
  return redirect("/", [session, clearFlow]);
}

function logout(req, env) {
  const origin = new URL(req.url).origin;
  const ms = `https://login.microsoftonline.com/${env.ENTRA_TENANT_ID}/oauth2/v2.0/logout?post_logout_redirect_uri=${encodeURIComponent(origin + "/signed-out")}`;
  return redirect(ms, [setCookie(SESSION_COOKIE, "", 0)]);
}

// ---------- entry ----------
const PUBLIC_ASSETS = ["/favicon.png", "/apple-touch-icon.png", "/assets/bes-mark.png", "/assets/bes-mark-light.png"];

export default {
  async fetch(req, env) {
    const { pathname } = new URL(req.url);

    if (PUBLIC_ASSETS.includes(pathname) && env.ASSETS) return env.ASSETS.fetch(req);
    if (pathname === "/favicon.ico") return redirect("/favicon.png");

    const cfg = missingConfig(env);
    if (cfg) return html(renderError(cfg), 503);

    if (pathname === "/api/auth/login") return login(req, env);
    if (pathname === "/api/auth/callback") return callback(req, env);
    if (pathname === "/api/auth/logout") return logout(req, env);
    if (pathname === "/signed-out") return html(renderSignedOut());

    const user = await currentUser(req, env);

    if (pathname === "/api/auth/me") {
      const h = new Headers({ "Content-Type": "application/json", "Cache-Control": "no-store" });
      if (!user) return new Response(JSON.stringify({ error: "Not signed in" }), { status: 401, headers: h });
      h.append("Set-Cookie", user.renew);
      return new Response(JSON.stringify({ name: user.name, email: user.email }), { headers: h });
    }

    if (pathname !== "/") return redirect("/");
    if (!user) return html(renderSignIn());
    return html(renderPage(user, SITES), 200, [user.renew, await lastVisitCookie(user, env)]);
  },
};
