# Testing the MMC Build app — how automated testers authenticate

**Audience:** the `/naive-tester`, `/qa`, and `/benchmark` agents (and any future automated
walkthrough) that need to reach authenticated surfaces (dashboard, modules, settings).

> **No auth backdoor exists, and none should be built.** There is no route or flag that skips
> authentication — adding one to a REGULATED product would be a critical vulnerability. Testers
> authenticate as a **real account** with a **real session**. The two modes below are about
> *convenience of logging in*, never about bypassing auth.

---

## The persistent QA account

A dedicated, email-confirmed `owner` account exists for testing (role `owner` so it can reach
admin surfaces too):

- **Email:** `mcmdennis+qa@gmail.com`
- **Password:** in Dennis's password manager (entry "MMC Build — QA tester"). **Never committed,
  never pasted into a report or a committed file.**
- **Role:** `owner` · **Org:** "QA Test Org" · long-lived trial (all modules unlocked).

Use this account instead of creating throwaway users (which pollute the prod DB and must be
cleaned up). It is the only standing test account; treat its data as disposable.

---

## Mode A — test the auth PATH (default)

The login/signup/forgot-password/magic-link flow is **itself a surface under test** (the
AUTH PAGE PATTERN + AUTH SMOKE-TEST standards). So the default way in is to **walk the real
form**, which validates the auth UX *and* lands a session:

1. Go to `https://mmcbuild-one.vercel.app/login`.
2. **Type** the QA creds (don't DOM-inject values — React's controlled inputs ignore injected
   values; this is the #1 reason automated logins "fail" here. Real keystrokes submit fine).
3. Confirm the password visibility toggle, the forgot-password link, and the magic-link option
   are present and work (that's the auth-pattern check).
4. The sign-in server action is **slow** (a few seconds, no spinner yet — a known UX item). Wait
   for the redirect to `/dashboard` and the `sb-…-auth-token` cookie before continuing.

### Daemon-stability workaround (learned 2026-05-25)

The `/browse` daemon on Windows cold-restarts to `about:blank` between commands and crashes on
heavy renders. To keep a session alive (this is how Anneke's verify run succeeded):

- **Warm-chain** related steps into one command rather than one-action-per-call.
- **Save and reload the browser auth state** after login so a daemon restart doesn't drop the
  session.
- Avoid the heaviest renders back-to-back; let one settle before the next.

---

## Mode B — get PAST auth fast (for deep surface testing)

When the goal is to test the authed surfaces (not the login form itself) and the flaky form is
getting in the way, mint a real session and inject the cookie:

```bash
QA_TEST_PASSWORD='<from password manager>' node scripts/qa-session.mjs
```

It performs a normal password grant for the QA account (exactly what the form does) and prints
the `sb-<ref>-auth-token` cookie value(s). Set them on the app origin
(`https://mmcbuild-one.vercel.app`, path `/`) via the `/browse` skill, then navigate to
`/dashboard` — you land authenticated, skipping the form.

This is **real auth** (a real session for a real account), not a bypass. The cookie encoding
follows the current `@supabase/ssr` default (`base64-` + base64url, chunked); it's best-effort —
if a library bump changes the format and the server rejects it, fall back to **Mode A** (which is
also the path that *tests* auth).

Alternative: gstack's `/setup-browser-cookies` to import a logged-in session from a real Chrome
profile into the daemon.

---

## Which mode when

| Goal | Mode |
|---|---|
| Verify login / signup / reset / magic-link UX | **A** (type the form) |
| Walk dashboard / modules / settings / admin | **B** (inject), fall back to **A** |
| Smoke-test all four auth paths (per AUTH SMOKE-TEST) | **A** |
