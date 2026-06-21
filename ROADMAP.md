# ROADMAP.md — Dynasty Manager → Steam

Living plan for the Steam (Electron) port. Source of truth for what's done and
what's left. Pairs with `STEAM_PORT.md` (the strategy/rationale doc).

- **Repo:** https://github.com/Wrexist/dynasty-manager-steam · branch `steam`
- **Rollback tag:** `pre-steam`
- **Legend:** ✅ done · 🟡 partial · ⬜ not started · 👤 user action (not codeable here)
- Last updated: 2026-06-21

---

## Status at a glance

| Phase | Status |
|---|---|
| 0. Pre-flight (branch/tag/repo) | ✅ |
| 1. Electron wrap | ✅ |
| 2. Capacitor decoupling | ✅ |
| 3. Desktop layout + AAA polish | 🟡 (pages/nav/P1 done; P2/P3 left) |
| 4. Premium / monetization strip | 🟡 (Pro unlocked; dedicated purchase UI cleanup left) |
| 5. Steamworks (achievements/cloud/overlay) | ⬜ |
| 6. Store page & Steam Direct | ⬜ 👤 |
| 7. Ship & QA | ⬜ |

---

## ✅ Done

### Phase 0 — Pre-flight
- ✅ `steam` branch created; `pre-steam` tag as rollback point.
- ✅ New repo `dynasty-manager-steam` set as `origin`; original mobile repo kept as `mobile` remote for engine cherry-picks.

### Phase 1 — Electron wrap
- ✅ `electron/main.cjs` + `electron/preload.cjs`; `electron-builder.json`; `scripts/electron-dev.mjs`; `electron 34.x` + `electron-builder` pinned.
- ✅ Production renderer served over a custom `app://` protocol (fixes absolute asset paths vs `file://`).
- ✅ Sandboxed renderer (contextIsolation on, nodeIntegration off); window-state persistence; single-instance lock; external links → OS browser.
- ✅ Generic menu bar stripped in production (kept in dev for reload/devtools).

### Phase 2 — Capacitor decoupling
- ✅ Confirmed Capacitor is inert on desktop (`isNativePlatform()` false → no RevenueCat/haptics/notifications/status-bar/splash plugin loads).
- ✅ Saves flush on window close via existing web `pagehide`/`beforeunload` handlers (verified they run in Electron).
- ✅ External URLs routed through the Electron bridge (`openExternalDesktop`).

### Phase 3 — Desktop layout + AAA polish (partial)
- ✅ Foundation: `.desktop` root class; content column + chrome widened on desktop.
- ✅ 32 pages converted to full-width multi-column desktop layouts.
- ✅ Desktop top navigation bar (`DesktopNav`) replacing the mobile bottom pill (main tabs + contextual sub-tabs + quick links + More).
- ✅ P1 AAA wave: PlayerCard `2xl`/`3xl` sizes + denser grids; tactics pitch as responsive hero; responsive chart heights; League Table side-by-side + Transfer split-pane; 10 modals made responsive + Finance sheet → desktop dialog; themed scrollbars.
- ✅ Detailed FUT player card in deal/loan/contract completion popups.

### Phase 4 — Premium (partial)
- ✅ `isPro()` returns true on desktop — all Pro features unlocked; contextual upsells (starter kit, instant-sim prompt, Pro-gated panels) auto-hidden.
- ✅ Ads confirmed already removed (pre-existing).

---

## ⬜ / 🟡 Remaining work

### Phase 4 — Finish the monetization strip
Goal: nothing in the desktop build references buying, subscribing, restoring, or "Pro".
- ⬜ Hide/remove the dedicated purchase surfaces on desktop: `SubscribeOnboarding` route + any in-game entry, `ShopPage` subscription tiers / one-time Pro / "restore purchases", Settings "purchases" entry, TitleScreen subscribe links.
- ⬜ Audit: grep the desktop path for `subscribe`, `iap`, `revenuecat`, `paywall`, `upgrade`, `restore`, `starter kit` — confirm no live purchase UI remains.
- ⬜ Decide on cosmetic packs on desktop: free/earned vs hidden (currently unlocked via `isPro`). Confirm no `purchaseConsumable` path is reachable.
- **Acceptance:** a new player on desktop never sees a price, a "buy", or a "Pro" gate.

### Phase 3 — P2/P3 desktop polish (from the audit punch-list)
- ⬜ **Keyboard navigation** (P2): arrow-key list/grid selection, number keys for nav tabs, `Space` to advance match/continue, consistent `Esc` everywhere; visible focus rings; optional skip-to-content.
- ⬜ **Hover/active affordances** (P2): TopBar back button, SubNav press feedback, remaining raw buttons.
- ⬜ **Density/spacing** (P2): Dashboard quick-links larger tiles on desktop; contract-alert chips as grid; tactics preset picker as grid.
- ⬜ **Bench hover popover** (P2): larger preview card + quick stats on hover.
- ⬜ **GlassPanel** shadow scaling on large screens (P2).
- ⬜ **Virtualization** for very large lists (League table full pyramid, transfer lists) (P3).
- ⬜ **Recharts memoization** on chart-heavy pages (Dashboard, ManagerProfile) (P3).
- ⬜ Remove remaining `scrollbar-hide` on desktop where it hides scroll affordance (P3).
- **Acceptance:** a laptop user with no touchscreen never reaches for one; navigation feels keyboard-complete.

### Phase 5 — Steamworks integration
- ⬜ **De-risk spike**: Electron + `steamworks.js` against public test AppID **480** — confirm init, one test achievement, and the overlay (Shift+Tab) render. If overlay/maintenance is painful, evaluate `steamworks-ffi-node`.
- ⬜ Initialize `steamworks.js` in the main process (real AppID once Steam Direct approved; `steam_appid.txt` for dev).
- ⬜ **Overlay launch flags**: `app.commandLine.appendSwitch('in-process-gpu')` + `disable-direct-composition`; call the library's overlay enable. Verify not rendering white.
- ⬜ Implement the real `window.electronAPI.steam.*` bridge (currently stubbed): `unlockAchievement`, `cloudSave`, `cloudLoad`, `isAvailable`.
- ⬜ **Achievements**: define list in Steamworks + map to existing in-game events (first win, first transfer, win league, win continental cup, win domestic cup, take national job, win international tournament, season milestones). Wire unlock calls at the Zustand state transitions.
- ⬜ **Cloud saves (Auto-Cloud)**: mirror each save slot to a JSON file in Electron `userData` (reuse existing format — no schema bump); configure Steam Auto-Cloud file patterns; re-import newer cloud file on launch.
- **Acceptance:** achievements fire in a Steam test env; a save round-trips via cloud to a second machine; overlay opens in-game.

### Phase 6 — Store page & Steam Direct  👤
- 👤 ⬜ Pay Steam Direct ($100, recoupable) + identity/tax/bank verification. **30-day waiting period** from payment → release, plus 1–5 day content review — pay ≥5 weeks before target launch.
- ⬜ Store page from the **fixed** marketing screenshots resized to Steam specs (header 460×215, capsule 616×353, library 600×900, screenshots 1920×1080).
- ⬜ Gameplay trailer captured from the desktop build (match → transfer → trophy).
- ⬜ Store description: clean, premium, ad-free, one-price wedge.
- ⬜ Publish page for **wishlists**; run a few weeks before launch.
- **Gate:** App Store marketing thread closed (screenshots live) before building the Steam page.

### Phase 7 — Ship & QA
- ⬜ **SteamPipe upload**: `app_build_<appid>.vdf` + `depot_build_<depotid>.vdf`; content = electron-builder Windows `dir` output; `steamcmd +run_app_build`.
- ⬜ Steam Playtest / private beta on varied hardware + resolutions (1280×720 → 2560×1440, multi-monitor, DPI scaling).
- ⬜ Fix desktop-specific bugs (window resize edges, save migration on first cloud import, overlay conflicts).
- ⬜ Achievement + cloud-save + overlay final verification on a **clean machine** (not the dev box).
- ⬜ Launch.

---

## Cross-cutting / polish backlog
- ⬜ **App identity**: window/app icon, taskbar icon, productName in title bar, installer/depot branding.
- ⬜ **Launch UX**: Electron `ready-to-show` splash/no-flash polish; remove the dev-only auto-opened DevTools from any prod path (already dev-gated — verify).
- ⬜ **Packaging**: finalize `electron-builder` config for the Steam depot (asar, file globs, version stamping); decide nsis/portable only if also distributing outside Steam.
- ⬜ **Save safety on desktop**: explicit force-quit test (window close mid-game → save intact); confirm IndexedDB + userData mirror parity.
- ⬜ **Build tooling note**: this machine's TLS-intercepting proxy requires `NODE_OPTIONS=--use-system-ca` for `npm install`/binary downloads — document in README or bake into an `.npmrc`/setup script so it doesn't recur.
- ⬜ **macOS / Linux** depots — deferred until Windows sells (extra builds + overlay/notarization tax).
- ⬜ **Engine sync**: periodically cherry-pick engine/data fixes from the `mobile` remote (separate repos diverge over time).

---

## Suggested next sequence
1. Phase 4 cleanup (hide remaining purchase UI) — small, makes the build review-clean.
2. Phase 5 Steamworks spike + achievements + cloud — the last big code chunk.
3. Phase 3 P2 keyboard/polish pass — perceived-quality boost.
4. Phase 6 (👤 Steam Direct early for the 30-day clock) + Phase 7 ship.
