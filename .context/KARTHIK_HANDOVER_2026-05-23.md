# Karthik handover — repos pushed, what to do next

Two GitHub repos have been pushed to Dennis's personal account today
(will be transferred to MMC Build org once you confirm the org slug):

- **`dennissolver/mmc-shared`** — shared services monorepo. Three packages
  trimmed from cais-shared-services and renamed to `@mmcbuild/*`:
  - `@mmcbuild/mapbox`
  - `@mmcbuild/platform-trust-middleware`
  - `@mmcbuild/property-services-sdk`
- **`dennissolver/mmc-market`** — the mmcbuild app, currently consuming
  `@caistech/*` packages (unchanged from current production).

The app still talks to Dennis's CAS-owned Supabase. Karen's existing
test data is preserved. DNS stays on Base44 until Karen approves the
Vercel-hosted version.

## What you do next (rough order)

### 1. Transfer the two repos to the MMC Build GitHub org

When you confirm the org slug, Dennis runs `gh repo transfer` for each.
You accept via GitHub UI, then invite Dennis back as a collaborator so
he can keep pushing.

### 2. Generate a Personal Access Token (classic)

Direct link with the right scopes pre-selected:
https://github.com/settings/tokens/new?scopes=repo,read:packages,write:packages

Save the `ghp_...` value securely. Used in steps 3 and 5.

### 3. Publish the three `@mmcbuild/*` packages to GitHub Packages

From your local clone of `mmc-shared`:

```bash
# One-time: tell npm where your PAT lives
# Use the LOCAL .npmrc in your home dir, NOT the repo one
cat >> ~/.npmrc <<'EOF'
//npm.pkg.github.com/:_authToken=PASTE_YOUR_PAT_HERE
EOF

# Build all three packages
cd ~/path/to/mmc-shared
pnpm install
pnpm -r run build

# Publish each
cd packages/mapbox && npm publish
cd ../platform-trust-middleware && npm publish
cd ../property-services-sdk && npm publish
```

If GitHub returns 422 "package already exists in another scope", you
need to flip visibility or create the package in the GitHub UI first
(Settings → Packages on the MMC Build org). Then retry.

### 4. Update mmcbuild-prod (now `mmc-market`) to consume `@mmcbuild/*`

Once the packages are published, in `mmc-market`:

```json
// package.json — swap these three lines:
"@mmcbuild/mapbox": "^0.2.0",
"@mmcbuild/platform-trust-middleware": "^0.4.0",
"@mmcbuild/property-services-sdk": "^0.3.0",
```

(Drop the `@caistech/*` entries.)

```ini
# .npmrc — swap the scope line:
@mmcbuild:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${GITHUB_PACKAGES_TOKEN}
```

```bash
# Update all source imports
find src -type f \( -name '*.ts' -o -name '*.tsx' \) -exec \
  sed -i 's|@caistech/|@mmcbuild/|g' {} \;

pnpm install
pnpm build  # verify it compiles cleanly
```

Commit + push.

### 5. Set `GITHUB_PACKAGES_TOKEN` on Vercel

On the Vercel project for `mmc-market` (in the MMC Build team):

- Settings → Environment Variables
- Add `GITHUB_PACKAGES_TOKEN` = the PAT from step 2
- Apply to Production, Preview, Development
- Trigger a redeploy

Vercel's build will now `pnpm install` and fetch `@mmcbuild/*` from
your registry under your PAT.

## What's NOT in scope today

- **Supabase data migration** (CAS-owned → MMC Build-owned).
  Planned next-week maintenance. Preserves Karen's 16 users + 14 orgs
  + 10 projects + 13 design checks + 2 KB collections.
- **DNS cutover at VentraIP** (mmcbuild.com.au → Vercel).
  After Karen's weekend testing on the Vercel URL.
- **Base44 subscription cancellation** — after DNS cutover.

## Anything goes wrong, ping Dennis

Dennis has admin on both Supabase projects and can iterate on the
`mmc-shared` repo locally. Workflow:

- You hit a publish error → DM Dennis with the error text
- Dennis fixes locally in `mmcbuild-shared`, pushes
- You `git pull` your clone, retry `npm publish`

No bottlenecks if both of you are around.
