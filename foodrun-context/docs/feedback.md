# Feedback → Changes

## From the project owner (must do)

| # | Feedback | Change | Where in CLAUDE.md |
|---|---|---|---|
| O1 | The Triton2Go order number only needs the **last 4 digits**. | 4 OTP-style digit boxes. Store `t2g_last4 char(4)`. Runner sees last 4 in big type. | §5, §6.3 Step 2, §6.7 |
| O2 | Orders need the **dining hall name and the restaurant/station name**. | Step 1 in the Join sheet: hall (locked to run start) + required restaurant chips. Seeded from `data/ucsd_dining.json`. Shown on runner list and My Order hero. | §5, §6.3 Step 1, §6.5 |

## From peer review (CSE 170 demo)

### Keep (praised)
- Animations, transitions between sections, colors, and the blurred glass background.
- Using **size** to show what matters (huge ETA).
- Progress bar with clear contrast between "on the way" and "here". Called the most important display.
- Consistent buttons. Main functions are eye-catching.

### Change

| # | Peer said | Change | Where |
|---|---|---|---|
| P1 | "A run" wasn't immediately intuitive. Are these group orders from one dining hall to one building? Highlight start and end, or only show runs ending at my location. | Onboarding card defines a run. Every run card has a **Start → End route line** with labeled dots. Find shows **only runs to the user's destination by default**, with a "Change" chip. | §1, §6.0, §6.2 |
| P2 | Show each part of the runner process. | **Timeline** under the progress bar from `order_events` with timestamps. | §6.5 |
| P3 | Paste and Scan look the same. Add more contrast. | Paste = quiet text action inside the digit field. Scan = large full-width glass button with camera icon. | §6.3 |
| P4 | Replace Undo with a confirmation, or add a timer so the runner knows whether to grab the order. | **Review + Confirm step**, then a visible **2-minute free-cancel countdown** shared with the runner. Runner sees "Pending" until it ends. | §6.4, §6.7 |
| P5 | The progress bar seems hard to update live. | Status comes from **real runner actions** (Mark picked up, Start delivering, enter code) through Supabase Realtime. ETA ticks each minute with "updated" label. Optional live location. | §6.5, §6.7 |
| P6 | Can I plan orders ahead or schedule a run? | **Now / Scheduled** toggle on Find. Runners can post runs for later. Orderers can join scheduled runs and get a 10-min reminder. **Request a run** in empty states. | §6.2, §6.6, §7 |
| P7 | Do students get paid for picking up orders? | Post a Run shows **"You'll earn about $X"** live. Money tab shows earnings and payouts. Home has an **Earn tonight** card. | §6.1, §6.6, §6.8 |
| P8 | Lots of empty space at the bottom of Home. | Add **Runs heading your way** carousel, **Earn tonight** card, **Order again**. Max 4 blocks, stay uncluttered. | §6.1 |
