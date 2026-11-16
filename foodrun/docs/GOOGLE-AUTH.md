# Sign in with Google

The code is wired. This is the console work, which is about 15 minutes.

Two things to register, in this order: a Google OAuth client, then Supabase's
provider. Google has to know Supabase's address, and Supabase has to know
Google's client id and secret.

---

## 1. Google Cloud OAuth client

<https://console.cloud.google.com>

1. **New Project** → name it `FoodRun` → Create, then select it.
2. **APIs & Services → OAuth consent screen**
   - User type: **External**. (Internal is only for a Workspace you own.
     You do not own ucsd.edu.)
   - App name `FoodRun`, your email for support and developer contact.
   - Scopes: the defaults are enough. You want `email` and `profile`, which
     are on already. Do not add more — every extra scope is another thing
     Google review will ask about later.
   - Test users: add your own `@ucsd.edu`. While the app is unpublished only
     listed test users can sign in, which is exactly what you want for now.
3. **APIs & Services → Credentials → Create Credentials → OAuth client ID**
   - Type: **Web application** (yes, web — the redirect goes to Supabase's
     servers, not to the phone)
   - Name: `FoodRun Supabase`
   - **Authorised redirect URIs**, exactly:

     ```
     https://iqpdazrkcwdrylpvbhgb.supabase.co/auth/v1/callback
     ```

   - Create. Copy the **Client ID** and **Client secret**.

A trailing slash or a typo here produces `redirect_uri_mismatch` and nothing
else. It is the most common failure.

---

## 2. Supabase provider

**Authentication → Sign In / Providers → Google**

- Enable
- Client ID and Client Secret from above
- Save

While you are on that page, under **URL Configuration** add these redirect
URLs so the app can be returned to:

```
foodrun://auth-callback
exp://*
```

`exp://*` is for Expo Go, which hands out a different address each session.
Remove it before you ship.

---

## 3. Try it

```bash
cd foodrun && nvm use 22 && npx expo start --clear
```

The sign-in screen now leads with **Continue with UCSD Google**, with the
email code underneath as a fallback. Tap it: a browser sheet opens, Google
asks which account, and you land back in the app signed in.

---

## What goes wrong

| What you see | What it is |
|---|---|
| `redirect_uri_mismatch` | Step 1.3. The URI must match Supabase's callback exactly. |
| `Access blocked: app not verified` | Add your address under Test users, or publish the consent screen. |
| Lands back but still signed out | Supabase redirect URLs missing `exp://*`. |
| "Use your UCSD Google account" | Working. You picked a personal Gmail. |
| Button absent | `.env` not loaded. Restart with `--clear`. |

---

## Why it is built this way

**A browser sheet, not the native account picker.** The native picker needs a
development build; the browser works in Expo Go, so you can test with real
students this week. Switching later changes `signInWithGoogle` and nothing
else.

**PKCE, not implicit.** The redirect comes back through `foodrun://`, a
custom scheme any app on the device can also claim. With the implicit flow
that redirect carries a usable token. With PKCE it carries a code that is
worthless without a verifier this app kept in memory.

**`hd=ucsd.edu` is a hint, not a control.** It asks Google to show only UCSD
accounts. It is a query parameter, so anyone can edit it. The address that
actually comes back is checked, and the trigger on `auth.users` refuses a
non-UCSD row regardless — the parameter is a convenience, the trigger is the
rule.

**Email sign-in stays.** If a student's `@ucsd.edu` turns out to be
Microsoft-backed rather than Google, Google sign-in simply will not find
them, and the code path is their way in. Keeping both costs nothing.

---

## Does this remove the email setup?

Mostly. Google needs no SMTP, no domain, no DNS, and has no hourly cap, so
if everyone uses it you can leave `docs/EMAIL-AUTH.md` alone.

The code path is still there as a fallback, still capped at three an hour on
the built-in mailer. Fix that before launch, or remove the fallback and
commit to Google.
