// HTML for my.bes-energy.com. Pure functions returning strings.

const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

const ICONS = {
  chart: '<path d="M4 19V5"/><path d="M4 19h16"/><path d="M7 15l4-5 3 3 5-6"/>',
  tasks: '<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M8 9l1.5 1.5L12 8"/><path d="M14 9h3"/><path d="M8 15l1.5 1.5L12 14"/><path d="M14 15h3"/>',
  clipboard: '<rect x="6" y="5" width="12" height="16" rx="2"/><path d="M9 5V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v1"/><path d="M9 11h6M9 15h4"/>',
  people: '<circle cx="9" cy="8" r="3"/><path d="M3.5 19a5.5 5.5 0 0 1 11 0"/><circle cx="17" cy="9" r="2.3"/><path d="M15.5 14.2A4.5 4.5 0 0 1 21 18.5"/>',
  grid: '<rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/>',
};

const MS_LOGO = '<svg width="18" height="18" viewBox="0 0 21 21" aria-hidden="true"><rect x="1" y="1" width="9" height="9" fill="#F25022"/><rect x="11" y="1" width="9" height="9" fill="#7FBA00"/><rect x="1" y="11" width="9" height="9" fill="#00A4EF"/><rect x="11" y="11" width="9" height="9" fill="#FFB900"/></svg>';

function head(title) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="theme-color" content="#16283F">
<meta name="robots" content="noindex, nofollow">
<title>${esc(title)}</title>
<link rel="icon" type="image/png" href="/favicon.png">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<style>
  :root{
    --navy:#16283F; --navy-2:#1F3755; --green:#2FA36B; --green-dk:#24865A; --green-soft:#E6F4EC;
    --bg:#F4F6F9; --card:#FFFFFF; --ink:#16283F; --muted:#56667A; --line:#E1E6ED;
  }
  @media (prefers-color-scheme: dark){
    :root{ --bg:#0E1A2A; --card:#15253A; --ink:#E8EEF5; --muted:#9AAABD; --line:#22364F; --green-soft:#16382B; }
  }
  *{box-sizing:border-box}
  html,body{margin:0}
  body{background:var(--bg);color:var(--ink);font:15px/1.5 "Segoe UI",system-ui,-apple-system,Roboto,Helvetica,Arial,sans-serif;min-height:100vh;display:flex;flex-direction:column}
  footer{color:var(--muted);font-size:12px;text-align:center;padding:18px 20px 26px}
</style>`;
}

function greeting(date = new Date()) {
  const h = Number(new Intl.DateTimeFormat("en-CA", { hour: "numeric", hourCycle: "h23", timeZone: "America/Vancouver" }).format(date));
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

// ---------- launcher (signed in) ----------
export function renderPage(user, sites, now = new Date()) {
  const first = (user.name || "").split(/\s+/)[0] || "there";
  const initials = (user.name || user.email || "?")
    .split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join("");

  const tiles = sites.map((s) => {
    const host = new URL(s.url).host;
    return `
      <a class="tile" href="${esc(s.url)}" target="_blank" rel="noopener">
        <span class="ico"><svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[s.icon] || ICONS.grid}</svg></span>
        <span class="body">
          <span class="name">${esc(s.name)}</span>
          <span class="desc">${esc(s.description)}</span>
          <span class="host">${esc(host)}</span>
        </span>
        <svg class="arrow" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 17L17 7M9 7h8v8"/></svg>
      </a>`;
  }).join("");

  return `${head("my BES")}
<style>
  header{background:var(--navy);color:#fff}
  .bar{max-width:1040px;margin:0 auto;padding:12px 20px;display:flex;align-items:center;gap:14px}
  .brand{display:flex;align-items:center;gap:12px;color:#fff;text-decoration:none}
  .brand img{height:38px;width:auto;display:block}
  .brand .div{width:1px;height:26px;background:#3A5273}
  .brand span{font-weight:600;font-size:16px;letter-spacing:.3px;color:#DCE4EE}
  .spacer{flex:1}
  .who{display:flex;align-items:center;gap:10px;font-size:13px;color:#C9D4E2}
  .avatar{width:32px;height:32px;border-radius:50%;background:var(--green);color:#fff;display:grid;place-items:center;font-weight:600;font-size:13px}
  .who a{color:#C9D4E2;text-decoration:none;border:1px solid #33496A;border-radius:6px;padding:4px 10px}
  .who a:hover{color:#fff;border-color:#5A7396}
  .hero{background:linear-gradient(180deg,var(--navy) 0,var(--navy-2) 100%);color:#fff;padding:28px 0 72px}
  .hero .in{max-width:1040px;margin:0 auto;padding:0 20px}
  .hero h1{margin:0 0 4px;font-size:26px;font-weight:600}
  .hero p{margin:0;color:#B9C6D6}
  main{flex:1;max-width:1040px;width:100%;margin:-48px auto 0;padding:0 20px 40px}
  .grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}
  @media (max-width:720px){.grid{grid-template-columns:1fr}.hero h1{font-size:22px}.who .email,.brand .div,.brand span{display:none}}
  .tile{position:relative;display:flex;gap:16px;align-items:flex-start;background:var(--card);border:1px solid var(--line);border-radius:12px;padding:20px 44px 20px 20px;text-decoration:none;color:inherit;box-shadow:0 1px 2px rgba(22,40,63,.06);transition:border-color .15s,box-shadow .15s,transform .15s}
  .tile:hover,.tile:focus-visible{border-color:var(--green);box-shadow:0 6px 18px rgba(22,40,63,.12);transform:translateY(-1px);outline:none}
  .ico{flex:none;width:46px;height:46px;border-radius:10px;background:var(--green-soft);display:grid;place-items:center}
  .ico svg,.arrow{width:24px;height:24px;fill:none;stroke:var(--green);stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}
  .body{display:flex;flex-direction:column;gap:2px;min-width:0}
  .name{font-weight:600;font-size:17px}
  .desc{color:var(--muted);font-size:14px}
  .host{color:var(--muted);font-size:12px;margin-top:6px;font-family:ui-monospace,Consolas,monospace;overflow-wrap:anywhere}
  .arrow{position:absolute;top:18px;right:16px;width:18px;height:18px;stroke:var(--muted)}
  .tile:hover .arrow{stroke:var(--green)}
</style>
</head>
<body>
<header>
  <div class="bar">
    <a class="brand" href="/"><img src="/assets/bes-mark-light.png" alt="BES – Building Energy Solutions"><i class="div"></i><span>my BES</span></a>
    <div class="spacer"></div>
    <div class="who">
      <span class="email">${esc(user.email)}</span>
      <span class="avatar" title="${esc(user.name)}">${esc(initials)}</span>
      <a href="/api/auth/logout">Sign out</a>
    </div>
  </div>
</header>
<section class="hero"><div class="in">
  <h1>${greeting(now)}, ${esc(first)}</h1>
  <p>BES internal tools — pick a site to open it. You're already signed in with your BES Microsoft account.</p>
</div></section>
<main><div class="grid">${tiles}</div></main>
<footer>BES – Building Energy Solutions Ltd. · Internal use only</footer>
</body>
</html>`;
}

// ---------- sign-in / message card (signed out) ----------
function card({ title, message, button, href, ms = false }) {
  return `${head(title)}
<style>
  body{background:linear-gradient(160deg,var(--navy) 0,var(--navy-2) 100%);align-items:center;justify-content:center;padding:20px}
  .card{width:100%;max-width:420px;background:#fff;color:#16283F;border-radius:14px;padding:34px 30px 28px;box-shadow:0 20px 50px rgba(0,0,0,.25);text-align:center}
  .card img{width:170px;max-width:80%;height:auto;display:block;margin:0 auto 22px}
  h1{margin:0 0 6px;font-size:21px;font-weight:600}
  p{margin:0 0 22px;color:#56667A}
  .btn{display:flex;align-items:center;justify-content:center;gap:10px;width:100%;background:var(--green-dk);color:#fff;text-decoration:none;font-weight:600;padding:12px 16px;border-radius:8px}
  .btn:hover,.btn:focus-visible{background:#1E7550;outline:none}
  .btn.ms{background:#fff;color:#16283F;border:1px solid #C5CED9}
  .btn.ms:hover,.btn.ms:focus-visible{background:#F4F6F9;border-color:#8FA0B5}
  small{display:block;margin-top:18px;color:#56667A;font-size:12px}
  footer{color:#B9C6D6}
</style>
</head>
<body>
<main class="card">
  <img src="/assets/bes-mark.png" alt="BES – Building Energy Solutions Ltd.">
  <h1>${esc(title)}</h1>
  <p>${esc(message)}</p>
  <a class="btn${ms ? " ms" : ""}" href="${esc(href)}">${ms ? MS_LOGO : ""}${esc(button)}</a>
  <small>For BES staff only · @bes-energy.com accounts</small>
</main>
</body>
</html>`;
}

export const renderSignIn = () =>
  card({ title: "Sign in to my BES", message: "One sign-in for every BES internal site.", button: "Sign in with Microsoft", href: "/api/auth/login", ms: true });

export const renderSignedOut = () =>
  card({ title: "You're signed out", message: "You have been signed out of my BES and Microsoft.", button: "Sign in with Microsoft", href: "/api/auth/login", ms: true });

export const renderError = (message) =>
  card({ title: "Couldn't sign you in", message, button: "Try again", href: "/api/auth/login" });
