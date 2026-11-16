# Sign in with Google

The code is wired. This is the console work, which is about 15 minutes.

Two things to register, in this order: a Google OAuth client, then Supabase's
provider. Google has to know Supabase's address, and Supabase has to know
Google's client id and secret.

---

## 1. Google Cloud OAuth client

<https://console.cloud.google.com> → create or pick a project (`foodrun`).

Google reorganised this in 2025. What used to be one "OAuth consent screen"
page is now **Google Auth Platform**, split across four items in the left
sidebar. Older guides, including the first version of this one, send you to
pages that no longer exist:

| Old name | Where it lives now |
|---|---|
| OAuth consent screen → User type, Test users | **Audience** |
| OAuth consent screen → App name, support email | **Branding** |
| OAuth consent screen → Scopes | **Data Access** |
| Credentials → OAuth client ID | **Clients** |

### Clients → Create OAuth client

- Application type: **Web application**. Not iOS — the redirect lands on
  Supabase's servers, and the phone only sees the result.
- Name: `FoodRun Supabase`
- **Authorised redirect URIs**, exactly this and nothing else:

  ```
  https://iqpdazrkcwdrylpvbhgb.supabase.co/auth/v1/callback
  ```

  A trailing slash, http instead of https, or a mistyped project ref all
  produce `redirect_uri_mismatch` and no other clue. Paste it; do not type
  it.

  The Web application form has **two** URL fields and they take different
  shapes. The callback belongs in the second one:

  | Field | Value |
  |---|---|
  | Authorised JavaScript origins | `https://iqpdazrkcwdrylpvbhgb.supabase.co` — host only |
  | Authorised redirect URIs | `https://iqpdazrkcwdrylpvbhgb.supabase.co/auth/v1/callback` |

  Putting the callback in the origins box gives *Invalid Origin: URIs must
  not contain a path or end with "/"*. Origins only matter when browser
  JavaScript calls Google directly; this flow redirects server-side through
  Supabase, so that field can be left empty.

- Create, and copy the **Client ID** and **Client secret**.

### Audience

- **External**. Internal is only for a Workspace you own, and you do not own
  ucsd.edu.
- **Test users → Add users**: your own `@ucsd.edu`.

  While the app is unpublished, only listed test users can sign in at all.
  Miss this and the browser says `Access blocked: app not verified`. The cap
  is 100 users, which is enough for a first run at a couple of dorms.

### Data Access

`email`, `profile` and `openid` should already be there. Add nothing else.
Every extra scope is something Google's verification review will ask you to
justify, and none of them are needed to learn who someone is.

## 2. Supabase provider

**Authentication → Sign In / Providers → Google**

- Enable
- Client ID and Client Secret from above
- Save

### URL Configuration — the part that bites

**Authentication → URL Configuration.**

Supabase will only redirect to an address on this list. When the address is
not on it, Supabase does not error: it silently falls back to **Site URL**,
which is `http://localhost:3000` out of the box. The browser then shows
"Safari can't open the page because it couldn't connect to the server" after
a sign-in that actually succeeded.

**Site URL**

```
foodrun://auth-callback
```

So that even the fallback lands somewhere real.

**Redirect URLs** — add all three:

```
foodrun://auth-callback
exp://**
exp://*/--/auth-callback
```

`foodrun://auth-callback` is what a real build uses. The two `exp://` entries
are for Expo Go, which cannot own a custom scheme and instead hands out
`exp://<your-lan-ip>:8081/--/auth-callback` — an address that changes with
the network you are on, which is why it has to be a wildcard rather than a
literal. In Supabase's matcher `*` stops at a separator and `**` does not, so
a bare `exp://*` does not match a URL with a host, a port and a path. That is
the mistake to avoid.

Drop the `exp://` entries before you ship.

The sign-in screen prints the exact redirect it is asking for, underneath the
Google button, in development builds. If sign-in lands on localhost, compare
that string against this list — they have to agree.

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
| `redirect_uri_mismatch` | The redirect URI does not match Supabase's callback exactly. |
| `Invalid Origin: URIs must not contain a path` | The callback went in the origins box. It belongs in **Authorised redirect URIs**. |
| `Access blocked: app not verified` | Your address is not under **Audience → Test users**. |
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
