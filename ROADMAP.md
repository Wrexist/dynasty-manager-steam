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
| 4. Premium / monetization strip | ✅ (purchase surfaces stripped; packs → in-game budget on desktop) |
| 5. Steamworks (achievements/cloud/overlay) | 🟡 (code landed; on-device spike + verification pending) |
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

### Phase 4 — Premium ✅
- ✅ `isPro()` returns true on desktop — all Pro features unlocked; contextual upsells (starter kit, instant-sim prompt, Pro-gated panels) auto-hidden.
- ✅ Ads confirmed already removed (pre-existing).
- ✅ Dedicated purchase surfaces stripped on desktop: TopBar Shop button, MoreDrawer "Shop" entry, Settings "Purchases & Subscription" section, `/subscribe` route (redirects), ShopPage (bounces to dashboard), ProUpsell (renders null). Audit grep confirms every remaining `shop`/`subscribe` ref is dead on desktop (behind `isDesktop()` or `isPro()===true`).
- ✅ Consumable player packs: the live IAP fall-through on desktop is removed — paid tiers (gold/premium/rare/icon) now fall back to an **in-game budget price** (`config/packs.ts`; `activeMethodFor` skips `iap` when `isDesktop()`). Mobile unaffected (IAP wins in priority there).

### Phase 5 — Steamworks (code landed; on-device verification pending)
- ✅ `electron/steam.cjs`: lazy/optional `steamworks.js` init (no-op without it), achievement unlock, overlay enable, `shouldApplyOverlayFlags()`, and the Auto-Cloud file-mirror (`cloudSave`/`cloudLoad`, plain `fs`, no Steam API).
- ✅ `electron/main.cjs`: overlay launch flags (win32 + AppID-gated), `enableOverlay()` after window create, Steam IPC handlers (`isAvailable`/`unlockAchievement`/`cloudSave`/`cloudLoad` + sync availability).
- ✅ `electron/preload.cjs`: real Steam bridge (was a stub); sync availability cached at preload.
- ✅ Achievements: `utils/steamAchievements.ts` mirrors in-game `unlockedAchievements` unlocks → Steam (delta + startup reconcile) via a store subscription — reuses existing tracking, no new hooks. Wired in `main.tsx` (desktop-only). Tested.
- ✅ Cloud saves: `writeSaveSlot` mirrors each save to the Auto-Cloud folder; `restoreCloudSavesIfEmpty()` fills empty slots on launch (folded into `saveStorageReady`). Tested.
- ✅ App identity: BrowserWindow icon set at runtime (`dist/icon.png`).

---

## ⬜ / 🟡 Remaining work

### Phase 4 — Finish the monetization strip ✅ DONE
Acceptance met: a new player on desktop never sees a price, a "buy", or a "Pro" gate.
Player packs resolved to **in-game budget** on desktop (owner decision). Cosmetic
packs were only ever applied inside `ShopPage` — now unreachable on desktop, so
they are effectively hidden (see backlog: a desktop cosmetics picker is a
follow-up if we want owners to apply cosmetics for free).

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

### Phase 5 — Steamworks integration (code landed — REMAINING is on-device 👤)
The bridge, achievement mirroring, and Auto-Cloud mirror are implemented and
unit-tested. What's left requires a real Steam client + Windows box (cannot be
done in CI / the cloud env):
- 👤 ⬜ **De-risk spike** on AppID **480**: `npm install steamworks.js`, drop a
  `steam_appid.txt` (=480), launch, and confirm (a) init succeeds, (b) one test
  achievement unlocks, (c) the overlay (Shift+Tab) renders and is **not white**
  (the DirectComposition symptom the launch flags address). If overlay pain is
  severe, evaluate `steamworks-ffi-node` — only `electron/steam.cjs` changes.
- 👤 ⬜ Verify the `steamworks.js` API names used in `electron/steam.cjs`
  (`client.achievement.activate`, `electronEnableSteamOverlay`) against the
  installed version — every call is wrapped to degrade to a no-op if wrong.
- 👤 ⬜ Steamworks dashboard: create achievements with API names from
  `steamAchievementApiNames()` (e.g. `FIRST_WIN`, `LEAGUE_CHAMPION`, …).
- 👤 ⬜ Steamworks dashboard: configure **Auto-Cloud** to sync
  `userData/steamcloud/slot*.sav`.
- ⬜ **Save-conflict resolution** (both local AND cloud present, newest wins):
  deferred — the save layer has no embedded wall-clock timestamp, and an
  untested overwrite risks clobbering a real save. `restoreCloudSavesIfEmpty`
  only fills empty slots today. Needs a two-machine on-device test before the
  newest-wins overwrite path is enabled.
- 👤 ⬜ Real AppID once Steam Direct approved (replace the dev `steam_appid.txt`).
- **Acceptance:** achievements fire in a Steam test env; a save round-trips via
  cloud to a second machine; overlay opens in-game.

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
- 🟡 **App identity**: window/taskbar icon set at runtime (`BrowserWindow.icon` → `dist/icon.png`); productName + title bar already "Dynasty Manager". ⬜ Remaining: a real multi-res `build/icon.ico` for the packaged app/installer/depot branding (see `electron-builder.json` `_todo_icon`).
- ⬜ **Cosmetics on desktop**: cosmetic packs are unlocked via `isPro` but only *applied* inside `ShopPage`, which is now hidden on desktop — so owners can't change cosmetics. If we want them usable (free, since they own the game), add a small cosmetics picker outside the Shop (e.g. in Settings).
- ⬜ **Launch UX**: Electron `ready-to-show` splash/no-flash polish; remove the dev-only auto-opened DevTools from any prod path (already dev-gated — verify).
- ⬜ **Packaging**: finalize `electron-builder` config for the Steam depot (asar, file globs, version stamping); decide nsis/portable only if also distributing outside Steam.
- ⬜ **Save safety on desktop**: explicit force-quit test (window close mid-game → save intact); confirm IndexedDB + userData mirror parity.
- ⬜ **Build tooling note**: this machine's TLS-intercepting proxy requires `NODE_OPTIONS=--use-system-ca` for `npm install`/binary downloads — document in README or bake into an `.npmrc`/setup script so it doesn't recur.
- ⬜ **macOS / Linux** depots — deferred until Windows sells (extra builds + overlay/notarization tax).
- ⬜ **Engine sync**: periodically cherry-pick engine/data fixes from the `mobile` remote (separate repos diverge over time).

---

## Suggested next sequence
1. ~~Phase 4 cleanup~~ ✅ done.
2. ~~Phase 5 code (bridge + achievements + cloud)~~ ✅ landed + unit-tested. **Next: the on-device spike** — `npm install steamworks.js`, `steam_appid.txt=480`, launch on Windows, verify init + one achievement + overlay (the 👤 items under Phase 5 above). This is now wire-and-verify, not green-field.
3. 👤 **Pay Steam Direct now** — the 30-day clock is the true critical path and is independent of all code.
4. Phase 3 P2 keyboard/polish pass — perceived-quality boost.
5. Phase 6 store page + Phase 7 ship & QA (on a clean machine).
