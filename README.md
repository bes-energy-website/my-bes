# my BES — my.bes-energy.com

One page for all BES internal sites. Staff sign in once with their BES Microsoft
account (Microsoft Authenticator approval, as usual), then click through to:

| Tile | Site |
|---|---|
| Site Performance | performance.bes-energy.com |
| Project Management | project-management.bes-energy.com |
| Digital Audit Platform | audit.bes-energy.com |
| HR Portal | portal.bes-energy.com |

All four sites sign in against the same BES Microsoft tenant, so after signing in
here, opening a tile completes that site's sign-in automatically: no second password
and no second Authenticator prompt.

```
bes-my-hub/
├─ src/index.js        ← Worker: Microsoft sign-in + pages
├─ src/page.js         ← page design (BES logo, navy/green, phone + dark mode)
├─ src/sites.js        ← THE TILE LIST — edit this to add/rename a site
├─ public/             ← BES logos + favicon
├─ test/run.mjs        ← sign-in test (optional, needs Node)
└─ wrangler.toml       ← Cloudflare settings
```

---

# Setup from scratch (browser only, about 30 minutes)

You need: Microsoft Entra admin, the BES GitHub organisation, and the Cloudflare
account that holds bes-energy.com. No software install is needed.

## Step 1 — Microsoft sign-in (Entra app registration)

1. Go to **entra.microsoft.com** → *Applications* → *App registrations* → **New registration**.
2. Name: `my BES Hub`
   Supported account types: **Accounts in this organizational directory only (BES only – Single tenant)**
   Redirect URI: platform **Web**, URL `https://my.bes-energy.com/api/auth/callback`
   → **Register**.
3. On the Overview page, copy the **Application (client) ID**. You'll need it in Step 2.
4. *Certificates & secrets* → **New client secret** → description `my BES`, expiry **24 months** → Add.
   Copy the **Value** column now; it is only shown once. This is `ENTRA_CLIENT_SECRET`.
5. *API permissions*: `Microsoft Graph › User.Read` is already there → click
   **Grant admin consent for BES** → Yes.
6. *Authentication* → Front-channel logout URL: `https://my.bes-energy.com/api/auth/logout` → Save.

## Step 2 — Put the client ID in the project

1. Unzip `bes-my-hub.zip`.
2. Open `bes-my-hub\wrangler.toml` in Notepad.
3. Replace `PASTE-APPLICATION-CLIENT-ID-HERE` with the client ID from Step 1.3 → Save.

## Step 3 — GitHub repository

1. **github.com** → **+** (top right) → **New repository**
   - Owner: the BES organisation (same one as `project-manager`)
   - Name: `my-bes`
   - **Private**
   - Leave "Add a README" unticked → **Create repository**.
2. On the empty repo page, click the link **"uploading an existing file"**.
3. Open the unzipped `bes-my-hub` folder, select **everything inside it**
   (`src`, `public`, `test`, `wrangler.toml`, `package.json`, `README.md`, `.gitignore`)
   and drag it onto the page. Drag the contents, not the `bes-my-hub` folder itself,
   so `wrangler.toml` sits at the top of the repo.
4. Commit message `Initial my BES site` → **Commit changes**.

## Step 4 — Cloudflare (deploys automatically from GitHub)

1. **dash.cloudflare.com** → *Workers & Pages* → **Create** → **Import a repository**.
2. Connect GitHub if asked, and allow access to `my-bes`. Select `my-bes`.
3. Settings on the next screen:
   - Project name: **`bes-my-hub`** (must match `name` in wrangler.toml)
   - Build command: *(leave empty)*
   - Deploy command: `npx wrangler deploy` (default)
   - Root directory: `/`
   → **Create and deploy**. Wait for the green "Success".
4. The Worker attaches **my.bes-energy.com** and its DNS record by itself.
   If the deploy fails with a "hostname already has a DNS record" error: go to
   *bes-energy.com › DNS*, delete the existing `my` record, then retry the deploy.

## Step 5 — Add the two secrets

*Workers & Pages* → **bes-my-hub** → *Settings* → *Variables and secrets* → **Add**:

| Type | Name | Value |
|---|---|---|
| Secret | `ENTRA_CLIENT_SECRET` | the Value copied in Step 1.4 |
| Secret | `SESSION_SECRET` | a long random string (see below) |

To make a random string on Windows: open **PowerShell** and paste
```
$b=New-Object byte[] 48;[Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($b);[Convert]::ToBase64String($b)
```
Copy the output. Use a value **different** from the other BES sites. Saving a secret
redeploys the site automatically.

## Step 6 — Check it works

- [ ] Open **https://my.bes-energy.com** → BES sign-in card with logo
- [ ] *Sign in with Microsoft* → Authenticator approval → "Good morning, <name>" and 4 tiles
- [ ] Click each tile → each site opens already signed in
- [ ] On a phone: same, tiles stack in one column
- [ ] *Sign out* → "You're signed out" page

---

## Day-to-day

- **Add / rename / remove a site**: on GitHub open `src/sites.js` → pencil icon → edit →
  *Commit changes*. Cloudflare redeploys within a minute.
- **Sessions** last 30 days from the last visit, same as Project Manager.
- **Leavers**: disable the account in Microsoft. They can't sign in again, and every
  linked site checks access on its own.
- **Renew the client secret** before it expires (24 months): repeat Step 1.4 and update
  `ENTRA_CLIENT_SECRET` in Step 5.

## Notes

- **Project Management** asks Microsoft to show "Pick an account" on every sign-in
  (`prompt: 'select_account'` in its `src/auth.js`). From the hub that means one extra
  click, with no password and no Authenticator. Delete that one parameter in the
  project-manager repo for a fully seamless click-through.
- **Sign out** here also signs out of Microsoft, so other BES sites will ask for
  sign-in again once their own sessions end.
- Only `@bes-energy.com` accounts in the BES tenant (`aed873fa-…a0b0`) are admitted.
