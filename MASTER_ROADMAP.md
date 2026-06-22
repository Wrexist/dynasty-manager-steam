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

### Phase A — Steam Direct & store (👤, START NOW) 🔴
The **30-day Steam Direct clock** is the single longest pole and is 100%
non-code. Nothing here is blocked by engineering.
- 👤 ⬜ **Pay Steam Direct** ($100) + identity/tax/bank verification. Pay ≥5 weeks
  before any target launch. **Do this today** — the clock runs in parallel with
  all code work below.
- 👤 ⬜ Store page assets from the *fixed* marketing art, resized to Steam specs
  (header 460×215, capsule 616×353, library 600×900, screenshots 1920×1080).
- 👤 ⬜ Gameplay trailer captured from the desktop build (match → transfer → trophy).
- ⬜ Publish the page for **wishlists**; run a few weeks before launch.
- **Gate:** App Store marketing thread closed before building the Steam page.

### Phase B — Steamworks on-device verification (👤 + hardware) 🔴 M
The bridge code is written and unit-tested (commit landed this session). What
remains needs a real Steam client on Windows — it cannot be done in CI/cloud.
- 👤 ⬜ **De-risk spike** on AppID **480**: `npm install steamworks.js`, drop
  `steam_appid.txt` (=480), launch, confirm (a) init, (b) one achievement
  unlocks, (c) overlay (Shift+Tab) renders **non-white**.
- 👤 ⬜ Verify the `steamworks.js` API names in `electron/steam.cjs`
  (`client.achievement.activate`, `electronEnableSteamOverlay`) match the
  installed version — calls are wrapped to no-op if wrong, so this is confirm-only.
- 👤 ⬜ Dashboard: create achievements with the API names from
  `steamAchievementApiNames()` (`FIRST_WIN`, `LEAGUE_CHAMPION`, …).
- 👤 ⬜ Dashboard: configure **Auto-Cloud** to sync `userData/steamcloud/slot*.sav`.
- ⬜ **Then enable** the deferred save-conflict resolution (see Phase D-3) once a
  two-machine test confirms timestamps behave.

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

## PART II — BUG FIXES (correctness backlog, triaged)

Ordered by real risk after triage. None of these block the Steam clock, but the
🟠 items should land before launch (a crash = lost unsaved progress on desktop).

### B-1 🟠 confirmed S — Defensive guards on non-null assertions
Cheap insurance against latent crashes from `!` assertions on possibly-undefined arrays:
- `transferSlice.ts:170` — `[...purged.pendingFarewell!, …]` → `[...(purged.pendingFarewell || []), …]`. Crashes selling a player if `pendingFarewell` is ever unset.
- `weekAdvance.ts:441` — `finalTies…map(t => t.winnerId!).filter(Boolean)` → filter *before* map (`.filter(t => t.winnerId).map(t => t.winnerId)`) so a tie without a winner can't inject `undefined` into the international bracket.
- **Acceptance:** grep the orchestration + transfer slices for `!]`/`!,`/`!)` on array spreads; replace with `|| []`.

### B-2 🟡 triage S — Free-agent pool age boundary (`seasonEnd.ts:~599/626`)
Forced retirement is `age >= 36`; FA-pool entry gate is `age <= 34`. A contract-expired **35-year-old** is released but never added to the FA pool — silently lost, shrinking market depth over a long save. Verify the exact boundaries, then align the FA gate with forced-retirement (`<= 35` or `< FORCED_RETIREMENT_AGE`).
- **Acceptance:** a released 35-year-old ≥55 OVR appears in the FA pool; add a regression test.

### B-3 🟡 triage S — Post-promotion player-ID validation (`seasonEnd.ts:~388`)
The post-promotion safety net validates the club is in the division but not that its `playerIds` still resolve to existing players. If promotion orphaned a player, the next match could run a club with a broken lineup. Add a `playerIds.filter(id => workingPlayers[id])` + `filter(Boolean)` rebuild after the cascade.
- **Acceptance:** after a full season-end across the 4-tier English pyramid, every club's `playerIds` and `lineup` resolve to live players (assert in the season-integration test).

### B-4 ⚪ confirmed S — Runtime guard for cup-week choreography (`cup.ts`)
The "load-bearing" cup-week comment (Final wk 43 dodging continental SF 41–42 / Final 44 / League Cup 40) has **no runtime assertion**. A future edit could silently hang a tournament. Add a dev-only invariant check that throws if the week ordering collides.
- **Acceptance:** a unit test that fails if `CUP_WEEKS.F` collides with the continental/League-Cup weeks.

### B-5 ⚪ triage S — Save-durability edge in `performSave` (`orchestrationSlice.ts:~352`)
`lastSavedHash` is committed when `lsOk` is true, before the IDB promise resolves. If IDB then fails silently and the app closes, an identical re-save short-circuits as "unchanged" and never reaches disk. Low real-world frequency, but cheap to harden: only commit the hash once a disk path is *confirmed* (await idbPromise in the failure branch, or don't short-circuit when the last write's IDB outcome was false).
- **Acceptance:** simulate IDB-fail-after-lsOk; the next identical save still writes.

### B-6 ⚪ triage S — `countFixtureEventBytes` undercounts (`orchestrationSlice.ts:~122`)
Pre-flight trim estimates by `events.length` (array slots), not serialized bytes. A few huge event objects could skip the aggressive-trim path and hit the IDB quota. Switch the estimate to an approximate byte count, or lower the threshold conservatively.

### B-7 ⚪ N/A — Multi-tab/concurrent-write races (persistence + slices)
Reported as several "critical" findings (hydration race, backup-rotation race, slot-switch-mid-autosave). **Not applicable**: Electron single-instance lock + single mobile webview = one writer. Documented here so a future multi-window feature re-opens them; **do not spend time now.**

---

## PART III — DESKTOP / UX / ACCESSIBILITY POLISH (Phase 3 P2/P3 + audit)

A premium Steam release is judged on desktop feel. Grouped by impact; most are S.

### P3-1 🟠 S — Scrollbars on desktop
`scrollbar-hide` is used ~11× (Tactics, Squad, Calendar, Packs, WeeklyDigest…). On desktop this hides the scroll affordance — mouse users think content is stuck. Gate `scrollbar-hide` behind `:not(.desktop)` or a desktop-aware utility; keep themed scrollbars visible.

### P3-2 🟠 M — Responsive density (the "phone-in-a-window" smell)
The biggest review risk per `STEAM_PORT.md`. Current `lg:` breakpoints (1024px) leave 1280–3440px viewports under-using space:
- Dashboard quick-links/board cards → 2–3 col grid on desktop.
- Tactics/Squad horizontal card rows → wrap into denser grids (`xl:`/`2xl:`).
- PlayerDetail radar chart, MatchReview MOTM card → scale up on large screens.
- Calendar → week-grid columns instead of a single scroll column.

### P3-3 🟠 M — Accessibility pass
- Add `aria-describedby` to the 10+ Radix dialogs (FinanceBreakdownSheet, celebration/achievement modals, …). (WCAG 1.3.1)
- `aria-label` on `role="button"` rows (LeagueTable, Dashboard) describing the action ("Open Arsenal details").
- `aria-expanded` on MoreDrawer toggle; visible `:focus-visible` ring on DesktopNav buttons (the new number-key nav has no visible focus today).
- MatchDay commentary: per-event `aria-label` ("Haaland scores 67'") under the existing `aria-live` region.

### P3-4 🟡 S — Reduced-motion compliance
Infinite opacity/filter loops ignore `prefers-reduced-motion`: TransferNegotiation pulse rings, TalentTree, pack pity pulse, WeeklyDigest. Wrap each loop in `useReducedMotion()`. (Perf-mode already strips some, but OS motion-reduction should too.)

### P3-5 🟡 S — Desktop input affordances & copy
- Keyboard shortcut **discoverability**: the new number-key tab nav (1–9) has zero on-screen hint. Add a small legend (Settings → Help, or a first-desktop-launch hint).
- `Space`/`Enter` to advance match / continue / "Advance Week"; `+`/`-` or `S` to cycle match speed.
- Tap→Click copy: "Tap to lift trophy" etc. should be context-aware on desktop.
- Clear **Paused** match indicator (icon + `role="status"`), not just a text label.

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

- 🟠 M — **`seasonEnd.ts`** (1,732 LOC, ~32 lines of tests): promotion/relegation
  cascade per tier, continental qualification allocation, aging + contract churn +
  replacement generation, Ballon d'Or placement/value boosts. Highest-value target.
- 🟠 S — **`coreSlice.ts`** and **`cupSlice.ts`** (0 tests): navigation/match-lock/
  unemployed redirects; cup tie/round/winner logic.
- 🟠 S — **`playerEconomics.ts`** (0 tests): value/wage recompute with age + rarity +
  Ballon-d'Or premiums — transfer-market integrity.
- 🟡 S — **continental qualification** util path: empty/invalid qualifier lists
  (soft-lock risk), coefficient roll-over.
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
