# Launch checklist

Everything **you** need to do, in order. Tick as you go. Anything marked
**BLOCKER** means do not put the app in a student's hands until it is done.

The code side is tracked separately at the bottom.

---

## Part 1 — Get it running against a real database (about 30 min)

### 1.1 Node 22

```bash
nvm alias default 22
node -v          # must print v22.x
```

### 1.2 Create the Supabase project

1. <https://supabase.com> → **New project**
2. Region: **West US (North California)** — closest to San Diego
3. Save the database password in your password manager. You cannot see it again.

### 1.3 Run the SQL

**SQL Editor → New query**, paste the whole of **`supabase/setup.sql`**, Run.

That one file is the four below concatenated in order, so there is nothing to
get wrong:

| # | File | What it does |
|---|---|---|
| 1 | `supabase/migrations/0001_schema.sql` | tables, constraints, triggers |
| 2 | `supabase/migrations/0002_rls.sql` | first-pass access rules |
| 3 | `supabase/migrations/0003_hardening.sql` | **locks it down — do not skip** |
| 4 | `supabase/seed.sql` | halls, stations, destinations |

> `0003` undoes several things `0002` sets up. Running 2 without 3 leaves the
> database open in the ways described at the top of that file. The combined
> file keeps them in the right order.

### 1.4 Copy your keys

**Project Settings → API**. Copy the first two, never the third.

```bash
cp .env.example .env
```

```
EXPO_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJ...
```

- ✅ **Project URL** and **anon public** → `.env`
- ❌ **service_role** → nowhere. It ignores every access rule in the database.
  If it ever lands in a file, a screenshot, or a chat, rotate it.

```bash
npx expo start --clear
```

You will know it worked: sign-in now asks for a **6-digit** emailed code
instead of saying "any 4 digits work".

---

## Part 2 — Before any real student uses it

### 2.1 Email delivery — **BLOCKER**

Supabase's built-in mailer sends **3 emails per hour, total**. The fourth
student to sign up gets nothing and no explanation.

1. <https://resend.com> → free account
2. Add a domain, or use their test sender while you decide
3. Supabase → **Project Settings → Authentication → SMTP Settings** → enable,
   paste host `smtp.resend.com`, port `587`, your username and API key
4. Same page → **Rate Limits** → raise "Emails per hour" to something real

### 2.2 Turn on leaked-password and bot protection

**Authentication → Attack Protection**: enable **Captcha** (hCaptcha, free).
Without it, one script can burn your whole email quota and your Resend
credits in a minute.

### 2.3 Database backups — **BLOCKER**

**Project Settings → Database → Backups.** Free tier keeps 7 days. If you are
holding real orders and real money, upgrade to Pro ($25/mo) for
point-in-time recovery before launch, not after you need it.

### 2.4 Decide what happens when it goes wrong

Write down, before launch, in two sentences each:

- A runner takes the food and never delivers it. Who refunds, how?
- Someone reports harassment. Where does that report go, and who reads it?
- The app is down at 9pm on a Sunday. How does anyone tell you?

`reports` rows land in your database and **nobody is watching them**. At
minimum, add a Supabase webhook to your email or a Slack channel.

---

## Part 3 — Things only you can decide (legal and institutional)

I cannot do these for you and they are not optional.

### 3.1 Talk to UCSD — **BLOCKER**

- **The name and the look.** "Triton2Go" is UCSD's. UC San Diego's name and
  marks need permission. Using them to run a service that touches dining
  operations without asking is how a student project gets a letter instead of
  users.
- **HDH.** You are building a layer on top of their ordering system and their
  $5 reusable containers. Talk to Housing Dining Hospitality before launch,
  not after. They may be enthusiastic — campus dining has a known queue
  problem. They may also have rules about who may collect someone else's
  order.
- Start with **UCSD's Student Startup / Basement program**. They do exactly
  this conversation for student founders.

### 3.2 Money changes what this is

Once students pay each other through you:

- You are handling payments on behalf of others. Stripe Connect is the
  standard path and its onboarding asks real questions about your business.
- Runner earnings are income. Enough volume and that means 1099s.
- A campus "student project" and a payments business are different things to
  a university and to the IRS.

Keep it free between students until you have asked someone who knows. The
app already works without money moving.

### 3.3 Safety

Students are meeting strangers and handing over food.

- Both sides are `@ucsd.edu` verified, which is real but not identity
  verification.
- There is a handoff code, a rating, and a report button. There is no block
  list, no way to ban an account, and nobody reading reports.
- Decide what you do about allergens and tampering before someone asks.

### 3.4 Privacy

Write a privacy policy before the App Store asks for the URL. You collect
UCSD email, name, location of a drop spot, and order history. Say so, say how
long you keep it, and say how someone deletes their account — you will need a
delete path for App Store review regardless.

---

## Part 4 — Shipping it

### 4.1 Apple Developer account

$99/year, and approval can take a few days. Start it early.

### 4.2 Build

```bash
npm install -g eas-cli
eas login
eas build:configure
eas build --profile preview  --platform ios   # friends, by device UDID
eas build --profile production --platform ios # TestFlight
eas submit --platform ios
```

TestFlight takes ~100 external testers without full review, which is the
right way to run this at a few dorms first.

### 4.3 App Store review will ask for

- A privacy policy URL (3.4)
- An account deletion path **inside the app**
- A demo account that works, since sign-in is restricted to `@ucsd.edu`
- An answer on user-generated content moderation, because of reports and notes

---

## Where the secrets live

| Secret | Lives in | Committed? |
|---|---|---|
| `EXPO_PUBLIC_SUPABASE_URL` | `.env` | no (gitignored) |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | `.env` | no, and harmless if it were |
| **`service_role` key** | nowhere in this repo | **never** |
| `STRIPE_SECRET_KEY` | `supabase secrets set` | **never** |

A committed secret is not fixed by deleting the commit. It stays in the
history and in every clone. Rotate it instead.

---

## Code status

Done:

- Schema, access rules, hardening, seed
- Writes go through database functions that validate, so clients cannot set
  their own fee, their own rating, or their own order status
- The handoff code is generated server-side and never sent to a runner
- Wrong code attempts are rate-limited
- UCSD-only enforced at sign-up, not just in the UI
- Demo sign-in cannot exist in a release build
- A restored local session is checked against the real one

Not done:

- **Runs and orders still read from the mock store.** The functions above
  exist and are not called yet. This is the next piece of work and the app is
  not real until it lands.
- Realtime updates (§6.5)
- Stripe Connect payouts
- Push notifications
- Account deletion (needed for App Store)
- Anything in Part 3
