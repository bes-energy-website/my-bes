// End-to-end test of the Worker with Microsoft's token endpoint mocked.
import assert from "node:assert/strict";
import worker from "../src/index.js";

const env = {
  ENTRA_TENANT_ID: "aed873fa-6311-4938-beba-99ea3658a0b0",
  ENTRA_CLIENT_ID: "test-client",
  ENTRA_CLIENT_SECRET: "x",
  SESSION_SECRET: "s".repeat(40),
  ENTRA_DOMAIN_HINT: "bes-energy.com",
};
const O = "https://my.bes-energy.com";
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
let claims;
globalThis.fetch = async (url, init) => {
  assert.match(String(url), /oauth2\/v2\.0\/token$/);
  const body = new URLSearchParams(init.body);
  assert.ok(body.get("code_verifier"), "PKCE verifier sent");
  return new Response(JSON.stringify({ id_token: `h.${b64(claims)}.s` }), { status: 200 });
};
const cookiesFrom = (r) => r.headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");

async function signIn(c) {
  claims = c;
  const r1 = await worker.fetch(new Request(O + "/"), env);
  assert.equal(r1.status, 200); const t1 = await r1.text();
  assert.ok(t1.includes("Sign in with Microsoft") && t1.includes("/assets/bes-mark.png"), "branded sign-in page");
  const r2 = await worker.fetch(new Request(O + "/api/auth/login"), env);
  const auth = new URL(r2.headers.get("Location"));
  assert.equal(auth.host, "login.microsoftonline.com");
  assert.equal(auth.searchParams.get("redirect_uri"), O + "/api/auth/callback");
  assert.equal(auth.searchParams.get("code_challenge_method"), "S256");
  const state = auth.searchParams.get("state");
  return worker.fetch(new Request(`${O}/api/auth/callback?code=abc&state=${state}`, { headers: { Cookie: cookiesFrom(r2) } }), env);
}
const now = Math.floor(Date.now() / 1000);
const good = { tid: env.ENTRA_TENANT_ID, aud: env.ENTRA_CLIENT_ID, exp: now + 3600, name: "Sean Mac Aodh", preferred_username: "smacaodh@bes-energy.com", oid: "1" };

// 1. good user
const r3 = await signIn(good);
assert.equal(r3.status, 302, "callback redirects"); assert.equal(r3.headers.get("Location"), "/");
const home = await worker.fetch(new Request(O + "/", { headers: { Cookie: cookiesFrom(r3) } }), env);
const page = await home.text();
assert.equal(home.status, 200);
for (const h of ["performance", "project-management", "audit", "portal"]) assert.ok(page.includes(`https://${h}.bes-energy.com/`), h);
assert.ok(page.includes("Sean") && page.includes("/assets/bes-mark-light.png") && page.includes("HR Portal"));
assert.match(home.headers.get("Set-Cookie"), /mybes_session=.*Max-Age=2592000/, "30-day session renewed");
console.log("✓ BES user signs in and sees 4 tiles");

// 2. wrong domain / wrong tenant / bad state / tampered cookie
assert.equal((await signIn({ ...good, preferred_username: "x@gmail.com" })).status, 403); console.log("✓ non-BES email rejected");
assert.equal((await signIn({ ...good, tid: "other" })).status, 403); console.log("✓ other tenant rejected");
const bad = await worker.fetch(new Request(`${O}/api/auth/callback?code=a&state=wrong`), env);
assert.equal(bad.status, 302); assert.equal(bad.headers.get("Location"), "/api/auth/login"); console.log("✓ missing/mismatched state restarts sign-in");
const tampered = cookiesFrom(r3).replace(/mybes_session=[^.]+/, "mybes_session=" + encodeURIComponent(b64({ name: "Evil", email: "e@bes-energy.com", exp: now + 9999 })));
assert.ok((await (await worker.fetch(new Request(O + "/", { headers: { Cookie: tampered } }), env)).text()).includes("Sign in with Microsoft")); console.log("✓ forged session cookie rejected");

// 3. logout
const lo = await worker.fetch(new Request(O + "/api/auth/logout"), env);
assert.match(lo.headers.get("Location"), /oauth2\/v2\.0\/logout/); assert.match(lo.headers.get("Set-Cookie"), /Max-Age=0/);
console.log("✓ sign-out clears session and Microsoft session");

// 4. config missing → clear message, not a crash
const r503 = await worker.fetch(new Request(O + "/"), { ...env, ENTRA_CLIENT_SECRET: "" });
assert.equal(r503.status, 503); assert.ok((await r503.text()).includes("ENTRA_CLIENT_SECRET")); console.log("✓ missing secret reported clearly");

// write previews for screenshot
import { renderPage, renderSignIn } from "../src/page.js";
import { SITES } from "../src/sites.js";
import { writeFileSync } from "node:fs";
const dir = process.argv[2] || ".";
writeFileSync(dir + "/signin.html", renderSignIn());
writeFileSync(dir + "/preview.html", renderPage({ name: "Sean Mac Aodh", email: "smacaodh@bes-energy.com" }, SITES, new Date("2026-11-12T16:10:00Z")));
