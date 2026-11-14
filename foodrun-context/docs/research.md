# Research Background (CSE 170, Fall 2026)

## Problem
UCSD students order on Triton2Go but must walk to the dining hall to pick up. Students studying late in Geisel skip meals or eat snacks because leaving means losing their table and focus. At lunch, short gaps between classes make pickup hard. Friends already grab food for each other informally.

## Primary user
UCSD students who use Triton2Go but can't easily go pick it up: Geisel late-night studiers, students in labs or back-to-back classes, students far from their favorite hall.

## Secondary user
Students already walking from a dining hall to a building, who could earn money carrying orders.

## Prioritized needs
1. **Time and distance (highest)**: get food without a long walk, keep their study spot, fit pickup into short class gaps.
2. **Friend-to-friend pickup**: it already happens in group chats. Support that behavior.
3. **Cost**: delivery must be cheap (a few dollars).
4. **Order timing/info**: know when food is ready and where it is.
5. **Correct order**: get the right bag.
6. **Container returns (lowest)**: Triton2Go reusable containers have a $5 deposit and must be returned in person with the orderer's own ID. FoodRun can only remind.

## Constraints from UCSD HDH
- Dining Dollars are non-transferable, so FoodRun only charges the delivery fee separately.
- HDH doesn't publish who may pick up someone else's Triton2Go order. The runner matches bags using last 4 + name on order. Confirm this with HDH Dining Engagement before launch.

## Card sort (2 participants, open sort)
Both made 4 groups. They agreed exactly on **Money** (fee, payment, earnings, order history) and **Account & Help**. Split cards (runner map, locker hubs, add order #) were placed to keep "before joining" in Find and "my order" in My Order. Result: tabs Home / Find / My Order / Money / Account.

## Heuristic evaluation of the prototype (Nielsen's 10)

| Heuristic | Issue | Sev (1–3) | Fix |
|---|---|---|---|
| Visibility of status | ETA jumped 12 → 8 → 3 | 1 | Per-minute countdown + "updated just now" |
| Match real world | "Run" is a new term | 2 | Onboarding explainer + route line |
| User control | Undo lasted 6 s, no cancel after | 3 | Confirm step + cancel window until pickup |
| Consistency | "Order" tab vs "Your Order" title; "64 Deg" vs "64 Degrees" | 1 | Use "My Order" everywhere, full names |
| Error prevention | Order # not checked against the run's hall | 3 | Lock hall to run start, require restaurant |
| Recognition vs recall | User copies order # from another app | 2 | Only last 4 needed; future: import recent orders |
| Flexibility | No drop spot without a QR sticker | 3 | "Pick a spot" list + recent spots |
| Minimalist design | Search bar looked tappable but did nothing | 2 | Make search work |
| Error recovery | Letters silently stripped from order # | 2 | Inline "digits only" message |
| Help | No explanation of fees, codes, refunds | 2 | How it works link in Join sheet + Account |
