# MMC Build Handover — Karthik

**Date:** 2026-05-23
**Prepared by:** Dennis McMahon
**Audience:** Karthik Rao
**Estimated total time:** 60–90 minutes once you start

---

## At a glance

Two new GitHub repos have been pushed to my `github.com/dennissolver` account for you to take over:

1. **`dennissolver/mmc-shared`** — a trimmed shared-services monorepo containing the three internal packages the MMC Build app actually uses (mapbox, platform-trust-middleware, property-services-sdk), renamed from `@caistech/*` to `@mmcbuild/*`.
2. **`dennissolver/mmc-market`** — the MMC Build web application itself, with full git history. Today it still consumes the `@caistech/*` packages from my GitHub Packages registry (unchanged from current production). After this handover, it will consume `@mmcbuild/*` from MMC Build's own registry.

**Guidance**

To (a) take ownership of both repos under the MMC Build GitHub org, (b) publish the three `@mmcbuild/*` packages to MMC Build's GitHub Packages registry, and (c) swap `mmc-market` from `@caistech/*` to `@mmcbuild/*`. The Vercel deploy keeps running throughout — there is no downtime in this handover.

---

## Architecture before and after

```
BEFORE (today)                          AFTER (post-handover)
==============                          =====================

mmcbuild-one.vercel.app                 mmcbuild-one.vercel.app
        |                                       |
        v                                       v
  dennissolver/mmcbuild                   <MMC>/mmc-market
  (Dennis's repo)                         (your repo)
        |                                       |
        | imports                               | imports
        v                                       v
  @caistech/* packages                    @mmcbuild/* packages
  (Dennis's GitHub                         (your GitHub
   Packages registry)                       Packages registry)
        ^                                       ^
        |                                       |
        | published from                        | published from
        |                                       |
  caistech/cais-shared-services           <MMC>/mmc-shared
  (Dennis's source)                       (your source)
```

Supabase, DNS, and Base44 are **out of scope today** — see "Not in scope" at the end.

---

## Prerequisites — confirm before you start

Tick each box before running any of the steps below.

- [ ] You can access the MMC Build GitHub org and have admin permission to create repos and packages there
- [ ] You can access the Vercel project at `vercel.com/mmc-build/mmcbuild` (or relevant URL) with permission to change environment variables and trigger redeploys
- [ ] You have `git`, `node` (v20+), `pnpm` (v10+), and the GitHub CLI (`gh`) installed locally
- [ ] You have read this entire document once before starting

---

## Step 1 — Take ownership of the two repos (5 min)

### 1.1 — Tell me the MMC Build GitHub org slug

I need the exact case-sensitive org slug (e.g. `mmc-build`, `mmcbuildau`) to run the transfer command. Send it via Slack/WhatsApp.

### 1.2 — I run the transfer from my machine

For each repo, I run:

```bash
gh repo transfer dennissolver/mmc-shared <YOUR_ORG_SLUG>
# assuming <YOUR_ORG_SLUG> = mmc-shared:
#   gh repo transfer dennissolver/mmc-shared mmc-shared
# but please confirm the actual slug

gh repo transfer dennissolver/mmc-market <YOUR_ORG_SLUG>
# assuming <YOUR_ORG_SLUG> = mmc-market:
#   gh repo transfer dennissolver/mmc-market mmc-market
# but please confirm the actual slug
```

Each command returns a URL.

### 1.3 — You accept the transfer

Open each URL in your browser, click **Accept transfer**. The repos now live at `<YOUR_ORG_SLUG>/mmc-shared` and `<YOUR_ORG_SLUG>/mmc-market`.

### 1.4 — Invite me back as a collaborator

For each repo: **Settings → Collaborators → Add people → `dennissolver` → write access**. Without this, I can't push fixes if anything goes wrong in later steps.

### Verify step 1 worked

```bash
gh repo view <YOUR_ORG_SLUG>/mmc-shared
gh repo view <YOUR_ORG_SLUG>/mmc-market
```

Both should print metadata without errors.

---

## Step 2 — Generate a GitHub Personal Access Token (5 min)

Open this pre-filled link in your browser:

https://github.com/settings/tokens/new?scopes=repo,read:packages,write:packages&description=mmcbuild-github-packages

1. Pick an expiration (90 days or 1 year is fine).
2. Click **Generate token**.
3. **Copy the `ghp_...` value immediately** — you won't be able to see it again after navigating away.
4. Save it in your password manager. You'll use it in steps 3 and 5.

---

## Step 3 — Publish the three @mmcbuild packages (15 min)

### 3.1 — Configure npm to use your PAT for publishing

You need to add one line to a file called `.npmrc` in your **user home directory**. This is your personal config — it lives outside any repo and is used by `npm` for all your projects.

**The `.` (dot) prefix means the file is "hidden" on most systems — you may need to enable showing hidden files in your file explorer, or just create it from the command line.**

#### On Windows

Your home directory is `C:\Users\<your-windows-username>\`. For example: `C:\Users\karthik\`.

**Option A — PowerShell (easiest):**

Open PowerShell. Run:

```powershell
# Replace PASTE_YOUR_PAT_HERE with the actual ghp_... value from step 2
Add-Content -Path "$HOME\.npmrc" -Value "//npm.pkg.github.com/:_authToken=PASTE_YOUR_PAT_HERE"
```

Verify the file was written:

```powershell
Get-Content "$HOME\.npmrc"
```

You should see your line at the bottom (and any other lines that were already there).

**Option B — Notepad:**

1. Press `Win + R`, type `%USERPROFILE%`, hit Enter — this opens your home folder.
2. Look for `.npmrc`. If it's not there, you'll create it.
3. Right-click in the folder → New → Text Document. Name it `.npmrc` (Windows will warn about changing the extension — click Yes).
4. Open it in Notepad. Add this line at the end:
   ```
   //npm.pkg.github.com/:_authToken=PASTE_YOUR_PAT_HERE
   ```
5. Save and close.

If Windows refuses to let you create a file starting with a dot, you can rename `npmrc.txt` to `.npmrc` from PowerShell:

```powershell
Rename-Item "$HOME\npmrc.txt" "$HOME\.npmrc"
```

#### On macOS / Linux

Your home directory is `~` (which expands to `/Users/<username>/` on macOS or `/home/<username>/` on Linux).

```bash
# Replace PASTE_YOUR_PAT_HERE with the actual ghp_... value from step 2
echo "//npm.pkg.github.com/:_authToken=PASTE_YOUR_PAT_HERE" >> ~/.npmrc
```

Verify:

```bash
cat ~/.npmrc
```

#### Verify your PAT actually works against GitHub Packages

Before moving on, confirm the token is configured correctly:

```bash
npm whoami --registry=https://npm.pkg.github.com
```

This should print your GitHub username (e.g. `karthik`). If it prints an error about authentication, your PAT line isn't being read — double-check the file path and that the line is exactly as shown (no extra spaces, no missing slashes).

**Important — do NOT commit this file to any repo.** It contains your personal auth token. The repo-level `.npmrc` (the one inside `mmc-market`) only references `${GITHUB_PACKAGES_TOKEN}` as a variable — that's safe to commit because it doesn't contain the actual token.

### 3.2 — Clone, install, build

```bash
cd ~/Projects   # or wherever you keep code
git clone https://github.com/<YOUR_ORG_SLUG>/mmc-shared.git
cd mmc-shared
pnpm install
pnpm -r run build
```

After `build`, verify each package has a `dist/` directory:

```bash
ls packages/mapbox/dist
ls packages/platform-trust-middleware/dist
ls packages/property-services-sdk/dist
```

Each should show `index.js` and `index.d.ts`.

### 3.3 — Publish each package

```bash
cd packages/mapbox && npm publish
cd ../platform-trust-middleware && npm publish
cd ../property-services-sdk && npm publish
```

Each `npm publish` should print a `+ @mmcbuild/<name>@<version>` confirmation.

### Verify step 3 worked

Go to **GitHub → MMC Build org → Packages tab**. You should see three packages listed: `mmcbuild/mapbox`, `mmcbuild/platform-trust-middleware`, `mmcbuild/property-services-sdk`.

### If publishing fails

| Error | Cause | Fix |
|---|---|---|
| `422 Unprocessable Entity` | GitHub Packages org settings require the package to exist in the UI first | In the org → Packages → New package → create empty stubs with the three names, then retry |
| `401 Unauthorized` | PAT not loaded or wrong scope | Verify `~/.npmrc` has the line from 3.1; confirm PAT has `write:packages` scope |
| `403 Forbidden` | The `repository` field in `package.json` points at a repo you don't own | Edit each package's `package.json` and change `repository.url` to point at `<YOUR_ORG>/mmc-shared` |
| `pnpm install` fails with peer-deps errors | Older node or pnpm | Confirm node ≥ v20 and pnpm ≥ v10 |

---

## Step 4 — Switch the mmc-market app to consume @mmcbuild (15 min)

### 4.1 — Clone and prepare

```bash
cd ~/Projects
git clone https://github.com/<YOUR_ORG_SLUG>/mmc-market.git
cd mmc-market
```

### 4.2 — Update `package.json`

Find the three `@caistech/*` lines and replace them with the `@mmcbuild/*` equivalents:

```diff
- "@caistech/mapbox": "^0.1.2",
- "@caistech/platform-trust-middleware": "^0.3.1",
- "@caistech/property-services-sdk": "^0.3.0",
+ "@mmcbuild/mapbox": "^0.2.0",
+ "@mmcbuild/platform-trust-middleware": "^0.4.0",
+ "@mmcbuild/property-services-sdk": "^0.3.0",
```

Note the version bumps — confirm these match what was actually published in step 3.

### 4.3 — Update `.npmrc` in the repo root

```diff
- @caistech:registry=https://npm.pkg.github.com
+ @mmcbuild:registry=https://npm.pkg.github.com
  //npm.pkg.github.com/:_authToken=${GITHUB_PACKAGES_TOKEN}
```

### 4.4 — Update all source imports

Find-and-replace `@caistech/` → `@mmcbuild/` across the source tree. On Linux/macOS/WSL:

```bash
find src -type f \( -name '*.ts' -o -name '*.tsx' \) -exec \
  sed -i 's|@caistech/|@mmcbuild/|g' {} \;
```

On PowerShell:

```powershell
Get-ChildItem src -Recurse -Include *.ts,*.tsx | ForEach-Object {
  (Get-Content $_.FullName) -replace '@caistech/', '@mmcbuild/' | Set-Content $_.FullName
}
```

### 4.5 — Install and build locally to verify

Export your PAT into the env first so the install can reach the registry:

```bash
export GITHUB_PACKAGES_TOKEN=ghp_your_pat_here
pnpm install
pnpm build
```

Build should complete with no errors.

### 4.6 — Commit and push

```bash
git add package.json .npmrc src/
git commit -m "chore(deps): migrate @caistech/* to @mmcbuild/*"
git push origin main
```

### Verify step 4 worked

`pnpm build` exits cleanly with no module-not-found errors. The push triggers a Vercel deploy that you'll fix in step 5.

---

## Step 5 — Wire Vercel and deploy (10 min)

### 5.1 — Add the PAT to Vercel env

Go to **vercel.com/mmc-build/mmcbuild → Settings → Environment Variables**.

- Variable name: `GITHUB_PACKAGES_TOKEN`
- Value: your PAT from step 2
- Environments: tick Production, Preview, and Development

Click **Save**.

### 5.2 — Switch the connected GitHub repo

Vercel currently auto-deploys from `dennissolver/mmcbuild`. Point it at `<YOUR_ORG_SLUG>/mmc-market`.

**Settings → Git → Disconnect the current repo → Connect Git Repository → choose `<YOUR_ORG_SLUG>/mmc-market`.**

### 5.3 — Trigger a redeploy

**Deployments → most recent → ⋯ → Redeploy → "Use existing Build Cache" off → Redeploy.**

Watch the build log. The `pnpm install` step should now successfully fetch the three `@mmcbuild/*` packages.

### Verify step 5 worked

- Build completes with green tick
- The deployment URL responds: `curl -I https://mmcbuild-one.vercel.app/` returns `HTTP/2 200`
- Click through one or two pages in the browser to confirm no runtime errors

### If deploy fails

| Error | Cause | Fix |
|---|---|---|
| `403 Forbidden` during install | Vercel can't authenticate to your registry | Confirm `GITHUB_PACKAGES_TOKEN` is on the right env, redeploy |
| `404 Not Found` for `@mmcbuild/<x>` | Package not published, or wrong version range | Check the Packages tab on the MMC Build org; confirm versions match `package.json` |
| Build succeeds but runtime errors | Something inside the @mmcbuild package version is different from @caistech | Ping me with the error — likely a version mismatch in the publish step |

---

## Definition of Done

You are finished when **all** of these are true:

- [ ] `<YOUR_ORG_SLUG>/mmc-shared` and `<YOUR_ORG_SLUG>/mmc-market` exist on the MMC Build org
- [ ] I have been re-added as a collaborator on both
- [ ] Three packages visible at MMC Build org → Packages: `mapbox`, `platform-trust-middleware`, `property-services-sdk`
- [ ] `<YOUR_ORG_SLUG>/mmc-market` `main` branch has the `@caistech/*` → `@mmcbuild/*` migration commit on it
- [ ] Vercel project for `mmcbuild` is connected to `<YOUR_ORG_SLUG>/mmc-market`
- [ ] `GITHUB_PACKAGES_TOKEN` is set on Vercel env (Production, Preview, Development)
- [ ] Latest Vercel deployment is green and the live URL responds 200
- [ ] You and I have confirmed the smoke test (sign in, load dashboard) works as before

---

## Not in scope today

These are scheduled for later sessions and **deliberately not part of this handover**:

- **Supabase data migration.** The app still talks to my CAS-owned Supabase project (`skyeqimwnyuuozvhubdc`). Karen's 16 users, 14 orgs, 10 projects, 13 design checks, and 2 KB collections are preserved on that project. Migration to MMC Build's Supabase (`lztzyfeivpsbqbsfzctw`) is planned for Mon–Wed next week as a 1-hour maintenance window — pg_dump + psql restore + storage bucket copy + env-var swap on Vercel.
- **DNS cutover at VentraIP.** `mmcbuild.com.au` still resolves to Base44. The cutover to Vercel happens after Karen finishes her weekend testing on `mmcbuild-one.vercel.app` and signs off on visual parity.
- **Base44 subscription cancellation.** Happens after DNS cutover.

---

## When to ping me

Direct me to any blocker that isn't covered by the troubleshooting tables above. Most likely friction points:

- GitHub org settings around package visibility — these tend to need an admin click in the UI
- pnpm version mismatch — the repo uses pnpm v10.26.2 (locked via `packageManager` field)
- Discrepancy between published versions in step 3 and the versions referenced in step 4.2

Workflow when something goes wrong:

1. You hit an error → screenshot or paste the exact text to me
2. I fix locally in my `mmcbuild-shared` clone and push to `<YOUR_ORG>/mmc-shared`
3. You `git pull` your clone and re-run the failed step

No bottlenecks if both of you are around.

---

## Reference — repos and URLs

| Resource | URL |
|---|---|
| `mmc-shared` (will transfer) | https://github.com/dennissolver/mmc-shared |
| `mmc-market` (will transfer) | https://github.com/dennissolver/mmc-market |
| Vercel project | https://vercel.com/mmc-build/mmcbuild |
| Live deployment | https://mmcbuild-one.vercel.app/ |
| GitHub Packages docs | https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-npm-registry |
| Supabase (CAS, in use today) | https://supabase.com/dashboard/project/skyeqimwnyuuozvhubdc |
| Supabase (MMC Build, target) | https://supabase.com/dashboard/project/lztzyfeivpsbqbsfzctw |
