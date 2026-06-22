# MASTER_ROADMAP — Dynasty Manager → Steam & Beyond

> Umbrella plan covering everything from "where we are now" to "shipped on Steam
> and growing." Supersedes `ROADMAP.md` for high-level sequencing (that file
> stays as the detailed Steam-port phase log). Pairs with `STEAM_PORT.md`
> (strategy) and `LEARNINGS.md` (gotchas).
>
> **Created:** 2026-06-22, after a 4-track codebase audit (game-logic,
> persistence, UX/a11y, tests+monetization+features).
> **Legend:** ✅ done · 🟡 partial · ⬜ todo · 👤 user/hardware-gated
> **Severity:** 🔴 critical · 🟠 high · 🟡 medium · ⚪ low
> **Effort:** S (<½ day) · M (½–2 days) · L (>2 days)

---

## 0. Audit triage note (read before trusting the bug lists)

The audit was done by four parallel agents. Agents **over-rate severity and
report false positives** — every item below has been re-rated with engineering
judgment. Two patterns recur:

- **"Multi-tab race conditions"** are **largely N/A**: the Electron build holds a
  single-instance lock and the mobile build is a single WKWebView. There is no
  realistic two-writer scenario today. These are downgraded to ⚪ "revisit only
  if multi-window is ever added."
- **Some "critical bugs" are intentional design.** Verified examples:
  `promotionRelegation.ts:154` promotion cap is a *deliberate* anti-drift guard;
  `orchestrationSlice.ts:887` `halfTimeState: null` on load is *intentional*
  (the game does not resume mid-match saves). These are **NOT** in the backlog.

Items carry a **status**: `confirmed` (verified in code), `triage` (plausible,
needs a 10-min check before fixing), or `N/A` (investigated, not a real risk).

---

## PART I — SHIP ON STEAM (the critical path)

This is the only part that gates a launch date. Everything else is quality/depth
that can land before or after release.

### Phase A — Steam Direct & store (👤) 🔴
- ✅ **Steam partner account is paid/active** (owner confirmed 2026-06-22). Steam
  Direct is handled — the 30-day clock is no longer the blocker. Create the App
  in Steamworks to get the real AppID (used by Phase B).
- 👤 ⬜ Store page assets from the *fixed* marketing art, resized to Steam specs
  (header 460×215, capsule 616×353, library 600×900, screenshots 1920×1080).
- 👤 ⬜ Gameplay trailer captured from the desktop build (match → transfer → trophy).
- ⬜ Publish the page for **wishlists**; run a few weeks before launch.
- **Gate:** App Store marketing thread closed before building the Steam page.

### Phase B — Steamworks on-device verification (👤 + hardware) 🔴 M
The bridge code is written and unit-tested. What remains needs a real Steam
client on Windows — it cannot be done in CI/cloud. **Full step-by-step is in
`STEAM_SETUP.md`** (install, spike, the 38-achievement dashboard table with
hidden flags, Auto-Cloud path config, packaging, troubleshooting).
- 👤 ⬜ Spike: `npm install steamworks.js`, `steam_appid.txt` (your AppID or 480),
  launch, confirm (a) init, (b) one achievement unlocks, (c) overlay (Shift+Tab)
  renders **non-white**.
- 👤 ⬜ Confirm the `steamworks.js` API names in `electron/steam.cjs` match the
  installed version (calls no-op if wrong — confirm-only).
- 👤 ⬜ Dashboard: create the 38 achievements (table in `STEAM_SETUP.md` §3) +
  configure Auto-Cloud (`STEAM_SETUP.md` §4).
- ⬜ **Then enable** the deferred save-conflict resolution once a two-machine test
  confirms timestamps behave.

### Phase C — Packaging & ship 🟠 M
- ⬜ `electron-builder`: add `asarUnpack` for the `steamworks.js` native `.node`
  addon (cannot load from inside asar) — see `electron-builder.json` `_todo_steamworks`.
- ⬜ Produce a real multi-res `build/icon.ico` from `public/icon.png`; set
  `win.icon` (`_todo_icon`). In-app window icon already wired.
- ⬜ **SteamPipe upload**: `app_build_<appid>.vdf` + `depot_build_<depotid>.vdf`;
  content = electron-builder Windows `dir` output.
- ⬜ Steam Playtest / private beta on varied hardware (1280×720 → 2560×1440,
  multi-monitor, DPI scaling).
- ⬜ Final achievement + cloud + overlay verification on a **clean machine**.
- ⬜ Launch.

---

## PART II — BUG FIXES (correctness backlog) — ✅ TRIAGED & RESOLVED 2026-06-22

Every item was verified against the actual code. **Outcome: only B-1 was a real
fix; the rest evaporated under scrutiny** (intentional design, already-tested, or
agent error). This is a strong signal about the codebase's robustness. The
verification notes are kept so the findings aren't re-raised.

### B-1 ✅ FIXED — Defensive guard on `pendingFarewell`
`transferSlice.ts:170` spread `purged.pendingFarewell!`; if `pendingFarewell`
were ever unset, `purgePlayerReferences` (`rosterOps.ts:84`) would have thrown
*first*. Hardened both sites with `|| []`. (In practice it's always initialised
by loadGame/initGame, so this is theoretical-crash insurance, not an active bug.)
- `weekAdvance.ts:441` was investigated and is **not** a bug — `.map(winnerId!)
  .filter(Boolean)` already strips undefined; the `!` is just a misleading
  annotation, behaviour is correct. Left as-is.

### B-2 ❌ NOT A BUG — FA-pool age cap is intentional design
The agent assumed `FORCED_RETIREMENT_AGE = 36`; it is **40**. The `34` FA-pool
gate (`seasonEnd.ts:626`) is **deliberate and documented** (comment at line 540)
and used consistently in two places: existing FAs are evicted once they'd turn 35
(`:548`) and new expiries are gated at ≤34 (`:626`). Veterans play out their
contracts then leave the available pool by design. Whether to keep 35–39 players
as signable free agents is a **balance/design decision for the owner**, not a bug.

### B-3 ❌ ALREADY COVERED — post-season orphan invariant
`seasonAdversarial.test.ts` `clubHasNoOrphans()` checks **all clubs** (every
`playerIds` resolves to a live player, every `lineup` id is in `playerIds`) after
multi-cycle `endSeason`, which incidentally exercises AI clubs that get
promoted/relegated. Promotion/relegation (`promotionRelegation.ts`) only mutates
`divisionId` — it never touches `playerIds`, so it cannot introduce orphans. No
change needed.

### B-4 ❌ ALREADY COVERED — cup-week choreography
`competitionCalendar.test.ts:64-71` already asserts the run-in ordering
(LC Final < continental SF legs < Cup Final < continental Final) for **every**
season length 18–58, plus monotonic round weeks and in-season tie weeks. The
"load-bearing footgun" is already guarded; the LEARNINGS/cup.ts warning is stale
(collisions are now also degraded gracefully by weekAdvance catch-up recovery).

### B-6 ❌ NOT A BUG — `countFixtureEventBytes`
It returns an event *count* (misnamed "Bytes"), but it's only a **pre-flight
optimisation** to avoid a double stringify. The real guard is a separate
**byte-length** gate (`json.length > AGGRESSIVE_TRIM_THRESHOLD`, ~line 307) that
runs after stringify regardless of the count estimate. The agent's "fallback
never triggers" claim is wrong. (Cosmetic: the function could be renamed.)

### B-5 ⚪ OPTIONAL (kept) — save-durability micro-edge
`lastSavedHash` is committed on `lsOk` before the IDB promise resolves; an
IDB-fail-after-lsOk + immediate close could let an identical re-save
short-circuit. Extremely low frequency and the code already shows awareness;
left as an optional future hardening, not a launch blocker.

### B-7 ⚪ N/A — Multi-tab/concurrent-write races
Reported as several "critical" findings. **Not applicable**: Electron
single-instance lock + single mobile webview = one writer. Re-open only if a
multi-window feature is ever added.

---

## PART III — DESKTOP / UX / ACCESSIBILITY POLISH (Phase 3 P2/P3 + audit)

A premium Steam release is judged on desktop feel. Grouped by impact; most are S.

### P3-1 ✅ DONE — Scrollbars on desktop
`.desktop .scrollbar-hide` now restores a slim themed 6px scrollbar (overriding
the `display:none`), so mouse users see scroll affordance on horizontal strips
and scrollable sheets. Mobile/web keep them hidden (touch users swipe).
`index.css` only — no component changes.

### P3-2 🟠 M — Responsive density (the "phone-in-a-window" smell)
The biggest review risk per `STEAM_PORT.md`. Current `lg:` breakpoints (1024px) leave 1280–3440px viewports under-using space:
- Dashboard quick-links/board cards → 2–3 col grid on desktop.
- Tactics/Squad horizontal card rows → wrap into denser grids (`xl:`/`2xl:`).
- PlayerDetail radar chart, MatchReview MOTM card → scale up on large screens.
- Calendar → week-grid columns instead of a single scroll column.

### P3-3 🟡 MOSTLY DONE — Accessibility pass
- ✅ Visible `:focus-visible` ring on DesktopNav buttons (keyboard focus was invisible).
- ✅ Interactive `role="button"` rows: audited LeagueTable (7), BenchStrip,
  LineupPlayerTile, StadiumView, ManagerCreation (3) — **all already had
  descriptive `aria-label`s + keyboard handlers** (audit B2 over-reported). The
  one genuine gap, Dashboard's injured-player row, now has an `aria-label`
  ("View … (injured)") + focus-visible style.
- ❌ `aria-expanded` on MoreDrawer toggle — false positive; Radix `SheetTrigger`
  already provides it via `asChild`.
- ⬜ Still open: `aria-describedby` on the Radix dialogs; per-event MatchDay
  commentary labels under the existing `aria-live` region.

### P3-4 🟡 PARTIAL — Reduced-motion compliance
- ✅ New `useReducedMotionPref()` hook ORs three signals: OS `prefers-reduced-
  motion`, in-game **Reduced Motion**, and **Performance Mode**. (framer's
  MotionConfig only stops transform/layout loops, not opacity/color/filter.) Tested.
- ✅ Gated the ambient **opacity/color** loops framer misses: TalentTree
  available-perk pulse ring (opacity), TransferNegotiation "Negotiating…"
  ring (borderColor) + dots (opacity) → static under reduced motion.
- ℹ️ TournamentHeader's winner pulse is **scale-only** → already handled by
  framer; no change needed.
- ⬜ Still open (lower priority): audit the remaining `repeat: Infinity` sites for
  opacity/color/filter loops in *ambient* surfaces (WeeklyDigest, LoanNegotiation,
  IncomingOfferNegotiation). **Leave the spectacle** (pack opening, walkouts,
  goal celebrations) — those are user-initiated and momentary.

### P3-5 🟡 PARTIAL — Desktop input affordances & copy
- ✅ Keyboard-shortcut **discoverability**: DesktopNav main tabs now carry
  `aria-keyshortcuts` + a hover `title` ("Squad (press 2)"), matching the
  number-key nav. Order verified against `MAIN_TABS`/`WC_MAIN_TABS`/`UNEMPLOYED_MAIN_TABS`.
- ❌ Tap→Click copy: **intentionally skipped** — Steam Deck is touch-capable, so
  "Tap" is valid for a large share of Steam users; "Click" could be *worse*.
- ⬜ Still open: `Space`/`Enter` to advance match / "Advance Week"; speed-cycle
  keys; clearer **Paused** indicator (icon + `role="status"`).

### P3-6 🟡 M — Desktop hover/interaction (P3)
- Bench hover popover (larger preview + quick stats).
- GlassPanel shadow scaling on large screens.
- Recharts memoization on chart-heavy pages (Dashboard, ManagerProfile).
- Virtualization for very large lists (full league pyramid, transfer lists).

### P3-7 🟡 S — Empty/first-run states
Aspirational copy + art for empty TrophyCabinet, zero-prospect YouthAcademy (currently plain placeholders — cheap premium win).

### P3-8 ⚪ — Cosmetics on desktop
Cosmetic packs are unlocked via `isPro` but only *applied* inside ShopPage, now hidden on desktop. Add a small cosmetics picker (Settings) so owners can use them free, or accept they're hidden. Decision needed.

---

## PART IV — TEST-COVERAGE HARDENING

The architecture is strong but coverage is thin in a few high-complexity,
state-corrupting paths. On desktop a crash = lost unsaved progress, so this
matters more for Steam. Prioritised by blast radius.

- ⬜ 🟠 M — **`seasonEnd.ts`** (1,732 LOC, ~32 lines of tests): promotion/relegation
  cascade per tier, continental qualification allocation, aging + contract churn +
  replacement generation, Ballon d'Or placement/value boosts. **Highest-value
  target still open** — a dedicated multi-hour effort (~100+ tests), best done
  focused rather than squeezed in.
- ✅ **`coreSlice.ts`** — `coreSlice.test.ts` (13 tests): setScreen navigation +
  previousScreen, match-lock (blocks disallowed targets, allows match-review),
  unemployed-career redirect (+ retired exemption), selectPlayer/selectClub,
  messages, settings merge + save-gating.
- ❌ **`cupSlice.ts`** — no tests needed: it's **state-only** (initial values, no
  actions/logic). The real cup logic lives in `data/cup.ts`, already covered by
  `cup.test.ts`, `seasonCupProgression.test.ts`, `leagueCupBracket.test.ts`,
  `competitionCalendar.test.ts`. Audit mis-attributed the logic to the slice.
- ✅ **`playerEconomics.ts`** — `playerEconomics.test.ts` (11 tests): age-multiplier
  bands + inclusive bounds, Ballon-d'Or premium compounding + top-N gating, and
  recompute relationships (prime > veteran, higher OVR > lower, decorated >
  plain, value-only leaves wage untouched). Math.random pinned for determinism.
- ✅ 🟡 **continental qualification** — `continentalQualification.test.ts` (5):
  Champions field fills to exactly 32 with no dupes, the three fields are
  disjoint, the guaranteed cup-winner spot lands, and `generateContinentalDraw`
  always builds a valid 8×4 / 32-team structure — **even from an empty qualifier
  list** (the audit's soft-lock fear is disproven; the draw pads safely).
  **Quality fix landed:** Shield/Conference fields used to come up 31/30 (their
  per-league spot allocations sum below 32), leaving 1–2 generic "Qualifier N"
  placeholder clubs in those cups every season. `collectQualifiers` now
  backfills short fields with **real clubs** (strongest leagues first), so all
  three competitions field 32 real teams. The `generateContinentalDraw`
  placeholder pad remains as a defensive net but no longer fires in practice.
- 🟡 S — **`monetizationSlice.ts`**: bundle expansion grants all 4 included products;
  starter-kit dismissal persistence. (Invariants already clean — these are
  regression guards.)
- 🟡 S — **save migration** adversarial: v62→v71 chain under missing/extra fields,
  throw-mid-migration rollback.
- **Acceptance:** each new suite asserts state *shape* invariants (no orphan player
  IDs, league sizes stable, budgets conserved), not just "doesn't throw."

### Monetization audit result ✅
**No invariant violations found.** `isPro()` is the sole Pro source of truth and
returns true on desktop; subscription SKUs are never checked against
`entitlements`; consumables are never persisted as entitlements; the hosted
paywall is gone; no monetization code touches sim parameters. Keep it that way.

---

## PART V — FEATURE ROADMAP (depth & retention for a premium Steam release)

Post-launch (or pre-launch if time allows) depth, scoped to the existing
architecture (types → config → slice → page → test). Ordered by value/effort.

### V-1 🟢 S — Rival manager persistence
Promote transient AI managers into persistent rivals (H2H record, follow you
across leagues). New `rivalrySlice` + update in `matchActions.ts` + `/rivals`
page. High narrative payoff, tiny data footprint.

### V-2 🟢 S — Local leaderboards / "Personal Bests"
Steam-local (no server) records: best finish, most trophies in a season, longest
unbeaten run, biggest fee. Ties naturally to Steam achievements. Reuse for a
`/career-stats` page. High engagement, low cost.

### V-3 🟢 M — Manager traits
5–8 persistent traits chosen at creation that alter behavior (XP/wage/academy
modifiers). `config/managerTraits.ts` + ManagerCreation UI + hooks in
`weekAdvance`/`playerGen`. Big replayability lever. **Must NOT touch match
outcomes directly** beyond declared, balanced modifiers — keep it auditable.

### V-4 🟢 M — Season planner / targets
Week-1 player-set goals (position, cup, development, wage cap) tracked live on the
Dashboard, scored at season end with a prestige bonus. Gives each season a "why."

### V-5 🟢 M — Match diary / season highlights
Auto-recorded notable moments (hat-tricks, comebacks, derby wins, red cards) into
a reviewable `/match-diary` feed. Screenshot-friendly (Steam Deck / socials).

### V-6 🟢 S — Player comparison tool
Side-by-side (≤3) radar + table from the transfer market. `/compare` page,
Recharts radar. Low friction where players already spend time.

### V-7 🟢 S — Tutorial challenges
3 gentle scenarios in `data/challenges.ts` (reuse the challenge system) to ease
new players in. Near-zero code.

### V-8 ⬜ — Online mode
Currently `comingSoon: true`, unimplemented. Out of scope for launch; a real
project (backend, netcode). Keep flagged, don't start before shipping single-player.

---

## Suggested execution order (what to actually do next)

1. **👤 Pay Steam Direct today** (Phase A) — starts the unavoidable 30-day clock.
2. **Bug fixes B-1 → B-4** (1 day total) — cheap correctness insurance before any beta.
3. **Desktop polish P3-1, P3-2, P3-3** (the "doesn't feel like a phone port" trio) — the launch-review risk.
4. **👤 Steamworks on-device spike** (Phase B) — when you're at a Windows box.
5. **Test hardening** (seasonEnd + the 0-coverage slices) — in parallel, low-risk.
6. **Packaging & ship** (Phase C) once B is verified.
7. **Features V-1, V-2** as the first post-launch update (rivals + leaderboards = retention).

> The launch date is governed by Phase A's 30-day clock and Phase B's on-device
> verification — both yours. The engineering backlog (Parts II–IV) is ~1–2 weeks
> and can run entirely in parallel with that clock.
