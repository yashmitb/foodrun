# FoodRun — Build Context

This file is the source of truth for building FoodRun. Read it fully before writing code. Then read:

- `docs/research.md`: who the users are and what they need (needfinding, card sort, heuristic eval)
- `docs/feedback.md`: peer feedback on the prototype and the exact change each item drives
- `data/ucsd_dining.json`: real UCSD dining halls, restaurants/stations, hours, and destinations (seed data)
- `reference/prototype.html`: the working clickable prototype. Open it in a browser. Match its look and motion.
- `reference/screens/`: screenshots of every prototype state (`demo_1_home.png` … `demo_11_home_active.png`) and the hi-fi screens (`FoodRun_Screen_*.png`)
- `reference/architecture_diagram.png`: the information architecture
- `reference/assignments/`: the class writeups (IA, visual design, interaction design)

If anything here conflicts with the prototype, **this file wins**. The prototype is older and does not include the feedback changes.

---

## 1. What FoodRun is

At UC San Diego, students order dining hall food on **Triton2Go** (HDH's mobile ordering) but still have to walk to the dining hall to pick it up. Students studying late (for example in Geisel Library) skip meals because leaving means losing their table and focus.

**FoodRun** lets a student who is already walking from a dining hall to a campus building carry other students' Triton2Go orders for a small fee.

- **Orderer**: places a Triton2Go order as usual, then joins a run in FoodRun with their order details and drop spot.
- **Runner**: posts a run ("Leaving Pines at 9:30, heading to Geisel, 3 spots"), picks up the bags, delivers them, and earns the fees.

FoodRun does **not** take food orders or payments for food. Triton2Go handles that. FoodRun only handles the pickup-and-carry and the delivery fee.

### What a "run" is (define this in the UI, see §6.1)
A run is **one runner + one dining hall (start) + one destination building (end) + a leave time + a number of open spots**. Many orderers can join one run. Every run must always be shown as **Start → End** so the model is obvious.

---

## 2. Tech stack (recommended)

Pick this unless the user says otherwise.

- **Expo (React Native) + TypeScript**, Expo Router for navigation. Target iOS first; web build must also run for demos.
- **expo-blur** for the glass look. **react-native-reanimated** for motion. **expo-camera** for QR scanning. **expo-haptics** for taps.
- **Supabase**: Postgres, Auth (email OTP), Realtime (live order status), Row Level Security.
- **Stripe** for the delivery fee (authorize on join, capture on delivery). For the class demo, stub payments behind an interface (`PaymentService`) with a fake implementation.
- Push notifications: Expo Notifications.
- State: TanStack Query for server data, Zustand for small UI state.
- Lint/format: ESLint + Prettier. Tests: Jest + React Native Testing Library for logic and key components.

Auth rule: **only `@ucsd.edu` emails** can sign up.

---

## 3. Design system

The look is **Apple / iOS-style "liquid glass"**: frosted translucent cards over a soft blurred navy + orange background, big bold titles, thin outline icons, a floating glass tab bar. Minimal. One clear action per screen. See `reference/screens/`.

### 3.1 Color tokens (complementary scheme: navy hue 211°, orange hue 30°)

| Token | Hex | RGB | HSL | Use |
|---|---|---|---|---|
| `navy` | `#12355B` | 18, 53, 91 | 211°, 67%, 21% | Primary. Titles, key text, avatars, code tiles, active tab |
| `orange` | `#F28C28` | 242, 140, 40 | 30°, 89%, 55% | Accent. **Only** for tappable primary actions and "happening now" states |
| `mist` | `#F4F7FB` | 244, 247, 251 | 214°, 47%, 97% | App background base |
| `ink` | `#1B1F24` | 27, 31, 36 | 213°, 14%, 12% | Body text |
| `white` | `#FFFFFF` | 255, 255, 255 | 0°, 0%, 100% | Glass card tint, text on navy |
| `muted` | `#6B7686` | | | Secondary text |
| `faint` | `#7C8798` | | | Labels, inactive tabs |
| `line` | `rgba(18,53,91,0.10)` | | | Dividers, empty progress |
| `success` | `#1E8E5A` | | | Checkmarks only |
| `danger` | `#C0392B` | | | Errors, destructive actions |

**Contrast rules (WCAG):**
- Ink on mist 15.4:1, white on navy 12.5:1, navy on orange 5.1:1, orange on navy 5.1:1. All pass.
- **White on orange is 2.5:1 and fails. Never put white text on orange.** Orange buttons always use **navy** text.

### 3.2 Background
Vertical gradient `#EEF3F9 → #F4F7FB (45%) → #FBF3EA`, plus 3 large blurred blobs (blur ~60px):
navy 26% opacity top-left, orange 30% right-middle, navy 16% bottom-left. Glass needs something behind it to blur, so keep these on every screen.

### 3.3 Glass surface
- Fill `rgba(255,255,255,0.55)`, blur 24 + saturate 180% (`expo-blur` intensity ~40–60, tint "light").
- 1px border `rgba(255,255,255,0.75–0.8)`, inner top highlight, soft shadow `0 8 30 rgba(18,53,91,0.08)`.
- Radii: big cards 28, run cards 24, fields 16, segmented control 12, pills/buttons 999.
- Bottom sheets: `rgba(255,255,255,0.82)` + blur 30, top radius 30, grab handle 38×5.

### 3.4 Type
- Font: **Inter** (fallback SF Pro / system). Letter-spacing slightly negative (-0.15 to -1 on large sizes).
- Large title 34 / 700 / -1 tracking / navy.
- Card headline 24 / 700. Row title 17 / 600. Body 15. Secondary 14 muted.
- Eyebrow labels 13 / 600 / UPPERCASE / +0.6 tracking / faint.
- Hero numbers (ETA) 96 / 700 / -5 tracking / tabular numerals.
- Handoff code tiles: 56×66, radius 16, navy fill, white 30/700 digits. Full-screen: 66×84, 40pt.

### 3.5 Components (match the prototype)
- **Primary button**: orange pill, navy 17/700 text, shadow `0 6 18 rgba(242,140,40,0.35)`, scale 0.97 on press. Disabled: `rgba(18,53,91,0.12)` fill, faint text. Disabled buttons say what's missing ("Add your order #").
- **Secondary button**: glass pill, navy 15/600 text, optional leading icon.
- **Segmented control**: glass track, selected segment white with small shadow.
- **Avatar**: 44 circle, navy, white initials.
- **Tab bar**: floating glass pill 14px from the sides, 18px from the bottom (+ safe area). 5 tabs: Home, Find, My Order, Money, Account. Active tab = navy icon + label on `rgba(18,53,91,0.08)` capsule. Inactive = faint.
- **Toast**: dark glass `rgba(18,30,45,0.88)`, white text, optional orange action.
- **Progress**: 4 segments (Ordered, Picked up, On the way, Arrived). Done = navy, current = orange, upcoming = line.
- Icons: thin outline (stroke ~1.8), like SF Symbols / Lucide.

### 3.6 Motion
Peers specifically liked the animations and transitions. Keep them.
- Screen change: slide in from 18px right + fade, ~280ms.
- Bottom sheet: slide up, `cubic-bezier(.2,.9,.3,1)` ~300ms.
- Buttons: press scale 0.94–0.97 + light haptic.
- Progress bar and ETA animate between states (~400–600ms).
- QR scanner: orange scan line sweeping, 1.2s loop.
- Respect Reduce Motion (cross-fade only).

### 3.7 Layout rules (PARC)
- One 20px left/right margin on every screen. Everything aligns to it.
- Related info sits in one card (proximity). Run card = who, start → end, time, spots, price, Join.
- Repeat the same parts everywhere: large title, glass cards, caps labels, floating tab bar.
- Contrast through orange (action), size (ETA is the biggest thing in the app), and weight.
- Intentional breaks: Order screen hero (ETA) and handoff code are centered.

### 3.8 Voice
Plain, short, friendly. Use people's names ("Show Marcus this code"). Buttons say exactly what happens ("Join run · $2").

---

## 4. Information architecture

Tabs come from a card sort with 2 participants (see `docs/research.md`):

- **Home**: greeting, current location, main CTA, active order, runs heading your way, earn card
- **Find** (Find a Run): open runs, runner map, scheduled runs, locker hubs (later), post a run
- **My Order**: live tracker, handoff code, add Triton2Go order, drop spot, container return reminder
- **Money**: delivery fee + split, payment methods, runner earnings + payouts, order history
- **Account**: profile (UCSD verified), ratings, notifications, report a problem, how it works / FAQ, safety

Use **"My Order"** as both the tab label and the screen title. The prototype mismatched these ("Order" vs "Your Order"). Use full dining hall names everywhere. If space is tight, scroll the filter horizontally rather than abbreviating "64 Deg".

---

## 5. Data model (Supabase)

```
profiles(id uuid pk = auth.uid, name, ucsd_email unique, avatar_url, rating_avg, rating_count,
         stripe_customer_id, stripe_account_id, created_at)

halls(id text pk, name, college, triton2go bool, hours jsonb, active bool)
restaurants(id uuid pk, hall_id fk, name, active bool, sort int)
destinations(id text pk, name, lat, lng)
drop_spots(id uuid pk, destination_id fk, label text, qr_code text unique)   -- e.g. "Geisel 2F, Table 14"

runs(id uuid pk, runner_id fk, hall_id fk, destination_id fk,
     leave_at timestamptz, spots_total int, spots_left int,
     fee_cents int, status enum('scheduled','open','picking_up','delivering','done','cancelled'),
     created_at)

orders(id uuid pk, run_id fk, orderer_id fk,
       hall_id fk, restaurant_id fk,
       t2g_last4 char(4),                 -- ONLY the last 4 digits of the Triton2Go order number
       order_name text null,               -- name on the Triton2Go order, helps the runner match bags
       drop_spot_id fk null, drop_spot_text text,
       handoff_code char(4),
       status enum('pending','confirmed','picked_up','on_the_way','arrived','delivered','cancelled','problem'),
       cancel_until timestamptz,          -- see §6.4
       fee_cents int, payment_intent_id, created_at, updated_at)

order_events(id, order_id fk, status, actor_id, created_at)   -- audit trail, drives the timeline
ratings(id, order_id fk, from_id, to_id, stars int, note)
reports(id, order_id fk, reporter_id, reason enum, note, created_at)
```

RLS: orderers see their own orders and the run they joined. Runners see orders on their own runs, but only `t2g_last4`, `order_name`, `restaurant`, `drop_spot`, and first name of orderer. Nobody sees other people's handoff codes except the orderer.

Seed `halls`, `restaurants`, `destinations` from `data/ucsd_dining.json`. Keep them editable. Station lists change.

---

## 6. Screens and flows

### 6.0 Onboarding (new)
1. Sign in with UCSD email (OTP).
2. 3 short cards, one sentence each:
   - "A **run** is a student already walking from a dining hall to your building."
   - "Join their run, and they carry your Triton2Go order to your table."
   - "Running? Grab orders on your way and earn the delivery fee."
3. Pick a usual spot (destination). Allow location permission (optional).

### 6.1 Home (`reference/screens/demo_1_home.png`, `demo_11_home_active.png`)
Top to bottom:
- Eyebrow day, large title "Good evening, {name}", avatar
- Location pill: current drop spot (tap to change)
- Hero glass card: "Hungry? Food is already headed your way." + "{n} runs to {destination} in the next 20 min" + orange **Find a Run** button
- Secondary glass pill: **Post a run and earn**
- **Active order** card (if any): avatar, item + restaurant, status line, ETA, progress bar → taps to My Order
- **Fill the bottom (feedback: too much empty space).** Add, in this order, only what applies:
  - **Runs heading your way**: horizontal scroll of 2–3 compact run cards (Start → End, leave time, price, spots)
  - **Earn tonight** card: "You're at Geisel. 4 people at Pines want food here. Post a run and earn about $8."
  - **Order again**: last 1–2 hall + restaurant combos
- Keep it airy. No more than 4 blocks visible above the tab bar.

### 6.2 Find a Run (`demo_2_find.png`, `demo_3_filter.png`)
- Large title "Find a Run", eyebrow "To {destination}"
- **Default: show only runs ending at the user's destination** (feedback). A chip "Showing runs to Geisel · Change" lets them switch destination or "Anywhere".
- Search field (must actually work: filters by hall, restaurant, runner name). The prototype had a fake search bar. Don't ship a fake one.
- Hall filter: segmented control or horizontally scrolling chips, full names: All, 64 Degrees, Pines, Canyon Vista, Ventanas, OceanView, Sixth, Foodworx. Only show halls that are open now or have runs.
- Toggle **Now / Scheduled** (feedback: plan ahead). Scheduled shows runs leaving later today or tomorrow.
- **Run card** (highlight start and end, feedback):
  - Row 1: avatar, runner name, ★ rating, price on the right
  - Row 2: **route line** with two labeled dots: `● Pines ──── ● Geisel` (start dot orange, end dot navy), with the end matching the user's destination highlighted
  - Row 3: clock + leave time, person + spots left, orange **Join** pill on the right
- Empty state: "No runs from {hall} right now." + secondary button **Request a run** (posts a demand signal runners can see).

### 6.3 Join a run — bottom sheet (`demo_4_sheet_empty.png`, `demo_5_scan.png`, `demo_6_sheet_ready.png`)
Header: avatar, "Join {runner}'s run", route `{hall} → {destination} · leaves {time}`, close X.

Numbered steps:

**Step 1: Where's your food from?** (feedback item 2)
- Dining hall: pre-filled and **locked** to the run's start hall (prevents joining a Pines run with a 64 Degrees order).
- Restaurant / station: required. Chips from `restaurants` for that hall (e.g. Pines → Char, Heat, Current, Breeze, Street Eats, Pacific Coast Hwy, Morning Fog, Slice at Pines).

**Step 2: Triton2Go order number** (feedback item 1)
- **Only the last 4 digits.** Four separate digit boxes (OTP style), numeric keypad, auto-advance, backspace goes back.
- Helper text: "Last 4 digits of your Triton2Go order number."
- Optional field: "Name on the order" (defaults to profile first name).
- Show an inline error if non-digits are pasted: "Digits only. Use the last 4 of your order number." (The prototype silently stripped them.)
- A small **Paste** text button inside the field (clipboard icon). It is a quiet text action.

**Step 3: Where should it go?**
- **Scan table QR** is a distinct, larger control: a full-width glass button with a camera icon and the label "Scan the QR on your table". It looks different from Paste on purpose (feedback: more contrast between paste and scan).
- After scan: shows "Geisel 2F, Table 14 ✓" with a **Rescan** link.
- Fallback (heuristic fix): **"No sticker? Pick a spot"** opens a list of `drop_spots` for the destination, plus free text. Remember the last 3 spots.

**Fee row**: "Delivery fee · charged after drop-off" and the price.

**Primary button**: disabled until steps 1–3 are done. Its label says what's missing ("Pick a restaurant", "Add last 4 digits", "Set your drop spot"). When ready: **Review**.

### 6.4 Confirm + cancel window (replaces the old 6-second Undo, feedback)
- Tapping **Review** shows a **confirmation step** in the same sheet: summary card (runner, route, leave time, hall + restaurant, `#••48`-style last 4, drop spot, fee) and **Confirm · $2**.
- After confirm, the order is `pending` with `cancel_until = min(now + 2 min, run.leave_at)`.
- The My Order screen shows **"Cancel free · 1:42"** with a live countdown ring. The runner sees the order as **Pending** with the same countdown and is told not to grab it yet.
- When the timer ends, the order becomes `confirmed` and the runner gets "Grab this one".
- After that, cancel is still allowed until `picked_up`, but it shows a confirm dialog and notifies the runner. After pickup, no cancel. Only Report a problem.

### 6.5 My Order — live tracker (`demo_7_order_toast.png`, `demo_8_order_progress.png`)
- Back button, title "My Order"
- Hero: eyebrow "Arriving in", ETA **big number + min**, line "{restaurant} · {hall}". When arrived: hero says **"Here"** in orange.
- 4-step progress bar with labels. Current step orange, done steps navy.
- **Timeline under the bar** (feedback: show each part of the runner process): small rows with time stamps from `order_events`, like "9:31 Marcus picked up your bag", "9:33 Marcus left Pines".
- **Live updates** (feedback: the bar should update live). Subscribe to the order row and `order_events` via Supabase Realtime. Status changes only from real runner actions (§6.7), not timers. ETA counts down every minute and shows "updated just now / 1 min ago". Optional: runner location dot on a mini map while `on_the_way`.
- Runner card: avatar, name, ★, message button. Divider. Drop spot row with pin icon.
- Handoff code card: "Show {runner} this code", 4 navy tiles, hint "Tap to make it bigger" → full-screen white view (`demo_9_bigcode.png`), max brightness, tap anywhere to close.
- **Report a problem** → action sheet (`demo_10_report.png`): Runner is late / Wrong or missing item / Can't find my runner / Other. Confirmation toast says when they'll hear back.
- After delivery: rate the runner (1–5 stars), plus the **container return reminder**. Triton2Go reusable containers have a $5 deposit and must be returned by the orderer with their own ID.

### 6.6 Post a Run (runner)
Fields: dining hall (picker), heading to (destination), leaving at (now or a scheduled time, **feedback: plan ahead**), spots (1–5), fee (suggested $2, allowed $1–$4). Show **"You'll earn about $X"** live as spots change (feedback: make runner pay clear). Post → Active Run.

### 6.7 Active Run (runner)
- List of joined orders: first name, restaurant, **last 4** in big type, name on order, drop spot. Pending ones show the cancel countdown and are grayed until confirmed.
- At the dining hall: per order, **Mark picked up** (tap or scan the Triton2Go bag label if possible). This writes `order_events` and moves that orderer's bar.
- **Start delivering** → all picked-up orders go `on_the_way`. Share location while active (optional).
- At each drop: enter the orderer's 4-digit **handoff code** → `delivered`, fee captured.
- Can't find someone: "Call/message" + "Leave at front desk" (photo proof) option.

### 6.8 Money
- Orderer: payment methods, fee history, receipts.
- Runner: **earnings** this week and all time, per-run breakdown (fees × delivered orders), payout to bank/Venmo (Stripe Connect; stub for demo). Explain: "Runners keep 100% of the delivery fee" (or set a platform cut later; make it a config value).

### 6.9 Account
Profile with UCSD verified badge, ratings, notification settings, **How it works** (fees, handoff code, refunds, containers), Safety & rules, Report a problem, sign out.

---

## 7. Notifications
- Orderer: runner confirmed, picked up, on the way, arriving (2 min), arrived, delivered, problem updates.
- Runner: someone joined (pending), cancel window ended (confirmed), someone cancelled, order reported.
- Everyone: scheduled run you joined is leaving in 10 min.

## 8. Edge cases to handle
- Run fills up while the sheet is open → disable Join, show "This run just filled up."
- Runner cancels run → all orders cancelled with no fee, orderers notified, suggest other runs.
- Order not ready at pickup → runner taps "Not ready yet", orderer sees it in the timeline.
- Dining hall closed → hide from filters, block posting runs for it. Use `hours`.
- Duplicate last-4 on one run → ask for "name on order" to tell them apart.
- No network → show cached state with "Offline" banner. Queue runner actions.

## 9. Heuristic issues from the prototype that must be fixed
(Full table in `docs/research.md`.)
1. Cancel only lasted 6 s → §6.4 cancel window.
2. No check that the order matches the run → hall locked to the run's start + restaurant required (§6.3).
3. No drop spot without a QR → "Pick a spot" fallback (§6.3).
4. ETA jumped (12 → 8 → 3) → per-minute countdown + "updated" label (§6.5).
5. "Run" not explained → onboarding + route line on every card (§6.0, §6.2).
6. Tab/title mismatch, "64 Deg" abbreviation → §4.
7. Fake search bar → make it work (§6.2).
8. Silent input stripping → inline error (§6.3).
9. No help → How it works link in the Join sheet and Account.

## 10. Build order (do these in phases, stop and show the user after each)
1. **Scaffold**: Expo + TS + Expo Router, theme tokens (§3) in `src/theme.ts`, Inter font, background + `GlassCard`, `PrimaryButton`, `SecondaryButton`, `TabBar`, `Avatar`, `Toast`, `ProgressSteps`, `CodeTiles`. Build a `/dev/components` screen showing all of them. Compare against `reference/screens/`.
2. **Static screens with mock data**: Home, Find, Join sheet (all 3 steps + review), My Order, Post a Run, Active Run. Navigation and animations working. Mock data from `data/ucsd_dining.json`.
3. **Supabase**: schema + RLS + seed, UCSD email OTP auth, real runs and orders.
4. **Realtime**: order status + events live for both roles. Cancel window timer server-side (a scheduled function or check on read).
5. **QR + drop spots**, notifications, ratings, reports.
6. **Payments** (stub first, then Stripe test mode), runner earnings.
7. Polish: Reduce Motion, accessibility labels, haptics, empty and error states, web build for the demo.

## 11. Definition of done for the demo
- Two phones (or phone + web): runner posts a run Pines → Geisel; orderer finds it (only runs to Geisel show by default), joins with hall + restaurant + last 4 + scanned table, confirms, sees the cancel countdown; runner marks picked up and on the way; orderer's bar and timeline update live; runner enters the handoff code; orderer sees "Here", then "Delivered", rates the runner, and sees the container reminder; runner sees earnings go up.
- Visual match with `reference/screens/` (glass, colors, type, motion).
