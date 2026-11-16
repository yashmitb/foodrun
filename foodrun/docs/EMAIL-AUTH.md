# Email and auth setup

Do these in order. Step 2 is the one that silently breaks sign-in if you skip
it, so do not skip it.

Your project today: email provider on, sign-ups open, confirm-email on,
built-in mailer (3 messages/hour).

---

## 1. A sending domain

Supabase's built-in mailer sends **3 emails per hour for the entire project**.
The fourth student to sign up gets nothing and no explanation. It is also
explicitly not for production. You need your own SMTP before anyone outside
your laptop uses the app.

**Resend** is the quickest. Free tier, 3,000/month, 100/day.

1. <https://resend.com> → sign up
2. **Domains → Add Domain**

   This is the part people get stuck on. Resend's shared sender
   (`onboarding@resend.dev`) can only email **your own account address** — it
   cannot email a stranger's `@ucsd.edu`. To email actual students you need a
   domain you own.

   - Buy one if you have not got one. ~$10/yr at Cloudflare or Namecheap.
     `foodrun.app`, `foodrunucsd.com`, anything.
   - Add the DNS records Resend shows you (DKIM, SPF, and a return-path
     CNAME). At Cloudflare these are three records, pasted in. Propagation is
     usually minutes.
   - Wait for **Verified**.

   UCSD's mail filters are not gentle with brand-new domains. The DKIM and
   SPF records Resend gives you are what keep your codes out of spam, so get
   all of them in, not just the first.

3. **API Keys → Create API Key**, permission "Sending access". Copy it; it is
   shown once.

### Point Supabase at it

**Project Settings → Authentication → SMTP Settings → Enable Custom SMTP**

| Field | Value |
|---|---|
| Sender email | `login@yourdomain.com` |
| Sender name | `FoodRun` |
| Host | `smtp.resend.com` |
| Port | `587` |
| Username | `resend` |
| Password | your Resend API key |

Save. Then **Rate Limits → Emails per hour**: raise it. 100 is plenty to
start and well inside Resend's daily cap.

---

## 2. Make the email contain a code, not a link

**This is the step that breaks everything if you miss it.**

The app asks for a 6-digit code. Supabase's default email for this flow is a
**magic link** template with no code in it. A student would get an email with
a button, tap it, and land nowhere useful, while the app sits waiting for six
digits they were never sent.

**Authentication → Emails → Magic Link**, and make sure the body contains
`{{ .Token }}`. Something like:

```html
<h2>Your FoodRun code</h2>
<p>Enter this in the app:</p>
<p style="font-size:32px;font-weight:700;letter-spacing:4px">{{ .Token }}</p>
<p>It expires in an hour. If you did not ask for this, ignore it.</p>
```

Subject: `Your FoodRun code`.

`{{ .Token }}` is the 6-digit code. `{{ .ConfirmationURL }}` is the link. You
want the first. Leaving both is fine — some people prefer tapping — but the
code has to be there.

---

## 3. Stop bots burning your quota

**Authentication → Attack Protection → Enable Captcha** (hCaptcha, free).

Without it, one script hitting your sign-in endpoint in a loop spends your
whole Resend allowance and your sending reputation in about a minute. Create
an hCaptcha site, paste the secret in.

Note: turning this on means the app has to send a captcha token with
sign-in. That is a client change — tell me when you enable it and I will wire
it.

---

## 4. Settings worth checking while you are there

**Authentication → Sign In / Providers → Email**

- **Confirm email**: on. Keep it. The code already proves they own the
  address, and leaving it on means an unconfirmed address cannot linger.
- **Secure email change**: on. Keep it.
- **OTP expiry**: default 3600s is fine. Shorter is more secure and more
  annoying; an hour is a reasonable place to sit.

**Authentication → URL Configuration**

- Site URL: `foodrun://`
- Redirect URLs: add `foodrun://*` and `exp://*`

Only matters if you keep the magic link working alongside the code. Harmless
either way.

---

## 5. Check it

```bash
cd foodrun && nvm use 22 && npx expo start --clear
```

Sign in with your own `@ucsd.edu`. You should get an email within a few
seconds containing six digits, and the app should accept them.

What the failures look like:

| What you see | What it is |
|---|---|
| Email has a button, no digits | Step 2. The template has no `{{ .Token }}`. |
| Nothing arrives, no error | Rate limit. Built-in mailer, 3/hour. Step 1. |
| Arrives in spam | DNS. One of Resend's records is missing or wrong. |
| "Email address not authorized" | Resend is still on the shared sender. Add your domain. |
| App says "Use your @ucsd.edu email" | Working as intended. |
| App asks for 4 digits | `.env` is not loaded. Restart with `--clear`. |

---

## Why UCSD-only is enforced three times

Worth knowing so you do not remove one thinking it is redundant:

1. `isUcsdEmail()` in the app, so the student finds out before waiting on an
   email.
2. A trigger on `auth.users`, so a non-UCSD address is refused **before**
   Supabase sends anything. This is what stops your Resend quota being spent
   on strangers.
3. A check constraint on `profiles.ucsd_email`, which is the one that
   actually counts, because the first two are code and the third is the
   database refusing to hold the row.

---

## Still open after this

- Nobody reads the `reports` table. Add a Supabase webhook to your email.
- No account deletion path, which App Store review requires.
- No way to ban an account.
