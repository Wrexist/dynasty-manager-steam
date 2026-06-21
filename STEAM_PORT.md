# STEAM_PORT.md — Dynasty Manager → Steam

**Purpose:** Convert the existing React/TypeScript/Vite/Capacitor mobile build into a polished, premium Steam desktop game. This is a **presentation + platform-decoupling + integration** project, NOT a logic rewrite.

> **HARD RULE — read before touching code.**
> The match engine (`src/engine/`), club/fixture data (`src/data/`), player generation + calculations (`src/utils/playerGen.ts` etc.), TypeScript types (`src/types/`), and the Zustand store/slices (`src/store/`) are **working, shipped, platform-agnostic code**. Do NOT rewrite, refactor for style, or "overhaul" them. They are the asset, not the problem. Every change in this plan touches the **platform layer (Capacitor → Electron), UI/input layer, monetization strip, or a new Steam integration layer**. If a task tempts you to edit the engine or sim balance, stop and flag it.

> **Version note:** verified against the codebase 2026-06-21. Save schema is at `CURRENT_VERSION = 72` (`src/utils/saveMigration.ts`). App is React 18 + Vite 7 + Capacitor 8.

---

## Target definition

- **Platform:** Steam, **Windows first**. macOS/Linux deferred until it sells (each is an extra SteamPipe depot + Electron build + the overlay/notarization tax).
- **Wrapper:** **Electron** (decision locked — see rationale below).
- **Steam SDK binding:** **steamworks.js** (locked, with a 1-day spike to de-risk — see Phase 4).
- **Monetization:** Premium one-time purchase. Target **$6.99**. Zero ads, zero subscriptions, zero consumable IAP. The Steam purchase unlocks the whole game.
- **What "done" means:** Boots as a `.exe` with no Capacitor errors; plays correctly with mouse + keyboard at 1280×720 → 2560×1440; has Steam achievements + cloud saves + a working overlay; ships a store page built on the *fixed* marketing screenshots resized to landscape; passes Steam review.

## Wrapper decision: Electron (locked)

Tauri produces smaller binaries, but Electron wins here because: (1) `steamworks.js` is Node/Electron-native and battle-tested for achievements/cloud/overlay; (2) the project already lives in the Node toolchain — no Rust toolchain risk mid-project; (3) binary size is irrelevant on Steam. Do not re-litigate this; it's reversible if ever needed.

**Electron version is itself a decision:** pin to **Electron 34.x** for now. Electron 35 introduced a regression that breaks the Steam overlay (`electron/electron#47662`). Do not bump major versions casually — re-verify the overlay after any Electron upgrade.

---

## Reality check — current codebase state (audited 2026-06-21)

This is what actually exists, so the plan targets reality rather than the original assumptions.

| Area | State | Implication |
|---|---|---|
| **AdMob** | **Already fully removed.** Not in `package.json`; `src/utils/ads.ts:37` is `NATIVE_ADS_READY = false`; `vite.config.ts` marks `@capacitor-community/admob` `external`; all `AdRewardButton` sites gate off the flag. | The original "remove AdMob" phase is essentially done. Verify-and-delete only. |
| **RevenueCat / IAP** | Live and deep: `@revenuecat/purchases-capacitor` (+ `-ui`), `src/utils/purchases.ts` (487 LOC), `src/config/monetization.ts`, `monetizationSlice.ts`, `SubscribeOnboarding.tsx`. Pro gated via `isPro(monetization)` at ~8 call sites (MatchDay, MatchPrep, MatchReview, PressConference, HallOfManagers, ManagerProfile, AdRewardButton). | **This is a Capacitor plugin — it will not load in Electron.** Must be neutralized, and `isPro()` forced `true`. |
| **Capacitor plugins** | ~10 touchpoints: splash-screen, status-bar, app (lifecycle pause/resume → save flush), haptics, local-notifications, in-app-review, browser (external URLs), core (`isNativePlatform`), plus RevenueCat. All in `main.tsx` + `utils/*`, all dynamically imported and `isNativePlatform()`-guarded. | The guards mean they no-op on desktop (good), but the **pause/resume save-flush** must be re-implemented on Electron window events, and RevenueCat init must be removed. |
| **Routing** | `HashRouter` (`src/App.tsx:73`). | Works under `file://` in Electron with no base-path change. Keep it. |
| **Build** | `vite build` → `dist/`, no `base` set, complex `manualChunks`, custom `sw.js` generated. | `base: './'` needed for `file://`. **Service worker must be disabled in the Electron build** (SW + `file://` is trouble). |
| **Persistence** | IndexedDB authoritative + localStorage mirror via `src/store/helpers/persistence.ts` (861 LOC). Full Zustand state serialized to JSON. `CURRENT_VERSION = 72`. | IndexedDB works in Electron, but is invisible to Steam Cloud. Plan: also mirror saves to `userData` files for Steam Auto-Cloud. |
| **Keyboard** | Partial: `useFocusTrap`, `useEscapeClose`, Enter/Space on tiles, Esc on several modals. | Good foundation. Missing: global hotkeys, arrow-key list nav, space-to-advance-match, consistent Esc-closes-everything. |
| **Mobile UI** | `max-w-lg` in ~92 spots, fixed `BottomNav` with safe-area padding, `useSwipeGesture`, vertical stacks, no multi-column layouts. | The bulk of the work (Phase 3). Mostly additive desktop breakpoints, not deletion. |
| **Sentry / analytics** | Platform-agnostic, no-op without env vars, consent-gated. | No changes required; optionally add a `platform: 'steam'` tag. |

---

## Phase 0 — Pre-flight & gates (do NOT skip)

**External gate (yours, blocks Phase 6 only):**
- [ ] **App Store marketing thread closed.** The reordered 1290×2778 screenshots LIVE on the App Store, review-prompt accruing ratings. The Steam page reuses these resized to landscape. Building the Steam page on weak screenshots repeats the UK failure on a harder platform. **Gate: do not start Phase 6 store-page work until this is true.** (Does not block Phases 1–5 — engineering can proceed in parallel.)

**Repo / safety:**
- [ ] `git tag pre-steam` on a known-good mobile build — the rollback point.
- [ ] `npm run branch -- steam` — all work here; mobile `main` stays shippable. Mobile Capacitor scripts must keep working off `main`.
- [ ] Confirm `npm run build` + `npm run preview` runs clean with no console errors (baseline).
- [ ] Decide branch/dependency hygiene: Electron + steamworks.js go in `devDependencies` / optionalDependencies and must **never** enter the Capacitor build path. `npm run preflight` and `size:check` must still pass on `main`.

**Decisions to lock now (defaults chosen — override if you disagree):**
- [ ] Pro features → **all unlocked** in the Steam build (premium model). No Steam DLC for Pro.
- [ ] Cloud saves → **Steam Auto-Cloud** (file-pattern based, write saves to `userData`), not the ISteamRemoteStorage API. Simpler, reuses existing JSON format.
- [ ] Windows-only at launch; macOS/Linux depots deferred.
- [ ] Single optional cosmetic IAP → **deferred to post-launch.** Ship clean.

---

## Phase 1 — Electron wrap (≈1–2 days, the easy part — do NOT mistake for "done")

- [ ] Add `electron` (pin **34.x**) + `electron-builder` as devDependencies. Keep them out of the mobile build path.
- [ ] Create `electron/main.ts` (main process) and `electron/preload.ts`. In production load `dist/index.html` via `file://`; in dev load `http://localhost:8080`. Detect with `app.isPackaged`.
- [ ] Set `base: './'` in `vite.config.ts` **for the Electron build only** (env-flag the config, or a second config) so assets resolve under `file://`. Do not change the mobile/web base.
- [ ] **Disable the service worker in the Electron build** (gate `sw.js` registration on a non-Electron check). SW + `file://` causes blank-screen/caching bugs.
- [ ] Window config: default 1280×800, min 1024×768, resizable; persist size/position to `userData` (e.g. `electron-window-state`).
- [ ] Security baseline: `contextIsolation: true`, `nodeIntegration: false`, `sandbox` as permissive as steamworks.js allows; expose everything through `preload.ts` only. (steamworks.js loads in the **main** process; the renderer touches it only via the preload bridge — see Phase 4.)
- [ ] Add `npm run electron:dev` (vite dev + electron) and `npm run electron:build` (vite build + electron-builder) scripts. Do not disturb existing mobile scripts.
- [ ] **Checkpoint:** a running `.exe` that loads the game and reaches the title screen. This will *feel* finished. It is not — Phases 2 and 3 are the real work.

## Phase 2 — Capacitor decoupling (≈3–5 days — the hidden hard part, NEW)

The original plan skipped this. It's the highest-risk phase because RevenueCat is a Capacitor plugin that will throw on load in Electron, and the boot sequence assumes a native lifecycle. Goal: the game runs identically with **zero Capacitor code paths active** on desktop.

- [ ] **Platform abstraction.** Introduce a tiny `src/platform/` layer (`isDesktop()`, `isNative()`) so code branches on capability, not on `Capacitor.isNativePlatform()` directly. Electron sets a flag on `window` via preload (e.g. `window.__STEAM__ = true`).
- [ ] **`main.tsx` boot:** ensure every Capacitor import is skipped on desktop. They're already `isNativePlatform()`-guarded, but verify none throw at import time under Electron.
- [ ] **RevenueCat:** do not initialize. Remove the `Purchases` init from `main.tsx`; make `src/utils/purchases.ts` no-op on desktop (return empty entitlements / mocked success, mirroring the existing web-mock path). The package can stay in `dependencies` but must never be `import()`ed at runtime on desktop.
- [ ] **Lifecycle save-flush:** the Capacitor `app` `pause`/`resume` listeners (which flush saves) don't fire on desktop. Re-wire save-flush to Electron window events: `before-quit`, `blur`, and `window.onbeforeunload`. This is **save-data integrity — test it explicitly** (force-quit must not lose a save).
- [ ] **Haptics** (`utils/haptics.ts`): already lazy + guarded → no-ops on desktop. Verify, leave.
- [ ] **Notifications** (`utils/notifications.ts`): re-engagement reminders are mobile-only. Disable on desktop (Steam players don't want OS toasts nagging them). Optionally re-add later via Electron `Notification`.
- [ ] **In-app review** (`utils/appReview.ts`): no App Store on Steam. Disable; optionally replace with a "Review on Steam" link (deep-link to the store page) much later.
- [ ] **External URLs** (`utils/externalUrl.ts`): replace the Capacitor `Browser` path with Electron `shell.openExternal` via the preload bridge.
- [ ] **Status bar / splash:** no-ops on desktop; remove the calls or let the guards skip them. Use Electron's `ready-to-show` to avoid white flash instead of the native splash plugin.
- [ ] **Checkpoint:** launch the `.exe`, open DevTools, play through a season including a save+reload+quit cycle. **Zero Capacitor/RevenueCat errors or warnings in console.** Force-quit mid-game → save survives.

## Phase 3 — Desktop input & layout (≈1.5–2 weeks — THE bulk of effort)

This is where a lazy port dies in reviews. The UI was thumb-designed; on a mouse + large monitor it reads as a blown-up phone app. Budget the most time here.

- [ ] **Audit every interactive surface** in `src/components/game/` and `src/pages/` for touch assumptions: oversized tap targets, swipe/long-press gestures, bottom-thumb nav, fixed `max-w-lg` widths (~92 occurrences).
- [ ] **Responsive desktop breakpoints (Tailwind).** Phone layout stays as the small-width fallback. Add desktop layouts: multi-column where the screen allows (squad list + player detail side-by-side instead of drill-down; tactics board + bench together; dashboard widgets in a grid). The `max-w-lg` containers become `max-w-lg lg:max-w-6xl` style escalations, not deletions.
- [ ] **Navigation:** keep `BottomNav` as the narrow fallback but add a desktop nav (top bar or persistent left rail) for wide viewports. The 45 `GameScreen` ids in `config/navigation.ts` already exist — this is presentation only.
- [ ] **Hover states** on every clickable element (mobile has none; desktop users expect them). Cursor feedback: `cursor-pointer` on interactives, `cursor-not-allowed` on disabled.
- [ ] **Keyboard navigation** (major perceived-quality signal on Steam):
  - Esc closes every modal/sheet (extend the existing `useEscapeClose` everywhere).
  - Enter confirms primary action in dialogs.
  - Arrow keys move list/grid selection (squad, transfer list, lineup).
  - Hotkeys: Space = advance match / continue; a quick-save; number keys for nav tabs. Keep them few and discoverable.
- [ ] **Replace touch gestures** (`useSwipeGesture`) with click/right-click equivalents (arrows/buttons for pack browsing and any swipe-to-navigate). Keep the gesture as a fallback under touch.
- [ ] Test at **1280×720, 1920×1080, 2560×1440** + a window-resize stress pass. No oversized elements, no wasted whitespace, no clipped content, no horizontal scrollbars.
- [ ] **Checkpoint:** hand the `.exe` to someone on a laptop with no instructions. If they reach for a touchscreen or say "this feels like a phone app," Phase 3 isn't done.

## Phase 4 — Monetization strip → premium (≈1–2 days, was Phase 3)

Most of this is verification because ads are already gone. The substance is unlocking Pro.

- [ ] **Ads:** verify-and-confirm only. AdMob is already removed (`utils/ads.ts` stub, no package). Hide/remove any remaining `AdRewardButton` and pack ad-slot UI in the desktop path so nothing references "watch ad."
- [ ] **Pro unlock:** force `isPro()` (`src/utils/monetization.ts`) to return `true` on desktop. Every `isPro(monetization)` gate (MatchDay speed tiers, MatchPrep instant sim, MatchReview analytics, PressConference, HallOfManagers, ManagerProfile badge) collapses to "unlocked." Do this at the `isPro` source, not at each call site.
- [ ] **Remove purchase/subscribe UI** from the desktop path: hide the `SubscribeOnboarding` route entry, `PurchaseModal`, shop/Pro-upsell surfaces, Starter Kit, and any "restore purchases" UI. The Steam build has nothing to sell.
- [ ] **Consumable packs:** the pack-opening *feature* stays (it's gameplay), but the *paid* tiers become free/earned on desktop — no IAP. Confirm no path calls `purchaseConsumable`.
- [ ] **Checkpoint:** grep the desktop build for `subscription`, `iap`, `revenuecat`, `paywall`, `upgrade`, `watch ad`, `restore` — confirm no live monetization gating or purchase UI remains.

## Phase 5 — Steamworks integration (≈3–5 days)

- [ ] **De-risk spike (0.5–1 day, do first):** stand up a throwaway Electron + steamworks.js build using AppID **480** (Spacewar, the public test app). Confirm: init succeeds, one test achievement unlocks, the **overlay renders** (Shift+Tab). If overlay/maintenance pain is severe, evaluate `steamworks-ffi-node` (newer, zero-compilation TS alternative) before committing. Electron decision stays; only the binding may change.
- [ ] Add `steamworks.js`. Initialize in the **Electron main process** with the AppID (placeholder until Steam Direct approved; use a `steam_appid.txt` for local dev).
- [ ] **Overlay launch flags** (required for the overlay to hook Electron on Windows): `app.commandLine.appendSwitch('in-process-gpu')` and `app.commandLine.appendSwitch('disable-direct-composition')`, and call the library's `electronEnableSteamOverlay()` at the end of main. Windows 8+ only. Verify the overlay isn't rendering white (the DirectComposition symptom).
- [ ] **Typed preload bridge:** expose a minimal Steam-agnostic surface — `window.steam.unlockAchievement(id)`, `window.steam.isAvailable()`, etc. Renderer/game code stays Steam-agnostic behind this bridge so the mobile build is unaffected (the bridge is a no-op when `window.steam` is absent).
- [ ] **Achievements:** map to events already tracked in the store. Wire unlock calls at the relevant Zustand state transitions (do not invent new tracking): first win, first transfer, win the league, win a continental cup, win a domestic cup, take a national-team job, win an international tournament, reach a season milestone. Define the achievement list in Steamworks to match.
- [ ] **Cloud saves (Auto-Cloud):** on desktop, mirror each save slot to a JSON file under Electron `userData` (reuse the existing serialized format from `persistence.ts` — do **not** invent a new format or bump the schema). Configure Steam Auto-Cloud in the partner dashboard with the file-path pattern. IndexedDB stays the in-app authoritative store; the files are the cloud-synced mirror, re-imported on launch if newer.
- [ ] **Checkpoint:** achievements fire in a Steam test environment; a save written on machine A appears on machine B after a cloud round-trip; overlay opens in-game.

## Phase 6 — Store page & Steam Direct (store-page work gated on Phase 0)

- [ ] **Steam Direct (YOUR action, do EARLY — has a 30-day clock):** pay the **$100 fee** (recoupable after $1,000 adjusted gross revenue) and complete identity/tax/bank verification. There is a **30-day waiting period from payment to release** *plus* a 1–5 day content review — so pay at least ~5 weeks before any intended launch date. Do not automate or enter bank/ID/tax credentials via tooling.
- [ ] Build the store page from the **fixed** marketing screenshots, resized to Steam's landscape capsule/header/screenshot specs (header 460×215, main capsule 616×353, library 600×900, screenshots 1920×1080).
- [ ] Capture a short gameplay trailer from the **desktop** build (match → transfer → trophy). Steam conversion is even more visual-first than the App Store — not optional.
- [ ] Store description leans into the wedge: a **clean, premium, ad-free, one-price** football manager — the opposite of the free-to-play grind (position directly against the free SM-style titles the audience knows).
- [ ] Publish the page for **wishlists** and run it for a few weeks BEFORE launch to build a wishlist base (the 30-day Direct clock is convenient runway for this).

## Phase 7 — Ship & QA

- [ ] **SteamPipe upload:** create `app_build_<appid>.vdf` + `depot_build_<depotid>.vdf` under the SDK's `ContentBuilder/`, content folder = electron-builder's Windows output. Upload via `steamcmd +login <user> +run_app_build <script> +quit`. (Windows depot only at launch.)
- [ ] Steam Playtest or a private beta branch for a handful of testers on varied hardware/resolutions.
- [ ] Fix desktop-specific bugs that surface: window-resize edge cases, save migration on first cloud import, overlay conflicts, multi-monitor/DPI scaling.
- [ ] Achievement + cloud-save + overlay final verification on a **clean machine** (not the dev box — the dev box has the SDK installed and masks failures).
- [ ] Launch.

---

## Sequencing summary (don't reorder the engineering chain)

1. **Phase 0** — branch, tag, lock decisions. Pay Steam Direct early (30-day clock). App Store gate only blocks Phase 6 store-page work.
2. **Wrap** (Phase 1) — easy, fun, deceptive. Not "done."
3. **Decouple Capacitor** (Phase 2, NEW) — RevenueCat won't load otherwise; nothing downstream is stable until this is clean.
4. **Desktop input/layout** (Phase 3) — the real bulk of the work.
5. **Strip monetization → premium** (Phase 4) — mostly verify (ads already gone) + unlock Pro.
6. **Steamworks** (Phase 5) — spike first, then achievements + cloud + overlay.
7. **Store page on fixed art → wishlist runway → SteamPipe → ship** (Phases 6–7).

Phases 2–4 can interleave on the same branch; just keep commits logically separated. Phase 5's spike can run in parallel with Phase 3.

## Rough effort

| Phase | Estimate |
|---|---|
| 0 Pre-flight | 0.5 day (+ external gates on their own clock) |
| 1 Electron wrap | 1–2 days |
| 2 Capacitor decoupling | 3–5 days |
| 3 Desktop input/layout | 1.5–2 weeks |
| 4 Monetization strip | 1–2 days |
| 5 Steamworks | 3–5 days (incl. spike) |
| 6 Store page / Direct | 2–3 days work + 30-day Direct clock + Phase-0 gate |
| 7 Ship & QA | 3–5 days + beta soak |

**Engineering core (Phases 1–5): ~3.5–5 weeks.** Calendar to launch is dominated by the 30-day Steam Direct wait + wishlist runway, so start Phase 0 Direct payment immediately.

## Anti-patterns (the ways this fails)

- Treating the Electron wrap (Phase 1) as the finish line and shipping a thumb-UI in a window → "feels like a phone port" reviews → dead page.
- **Forgetting RevenueCat is a Capacitor plugin** and shipping a build that throws on boot because the IAP SDK can't load in Electron. (This is why Phase 2 exists.)
- "Overhauling" the engine because a prompt said "make it all." The engine is fine. Leave it.
- Bumping Electron past 34 and silently breaking the Steam overlay.
- Re-deriving the save format for cloud sync and bumping the schema version, breaking migration for mobile.
- Launching the store page on the old screenshots that already underperformed in the UK.
- Carrying ad/subscription/upsell UI into the desktop build.
- Paying Steam Direct late and discovering the 30-day clock pushes launch out a month.
- Starting this before the existing mobile marketing thread is closed (the recurring start-new-before-finishing-old pattern) — only the store-page phase is gated, but don't let the whole project displace finishing mobile.

## Open questions for the user (defaults assumed above — flag if wrong)

1. **Pro model:** confirm "everything unlocked in one $6.99 purchase" (assumed) vs. selling Pro as Steam DLC.
2. **Cloud saves:** confirm Steam Auto-Cloud file-mirror approach (assumed) vs. ISteamRemoteStorage API.
3. **Launch scope:** Windows-only at launch (assumed) — confirm macOS/Linux are post-launch.
4. **Timeline:** is there a target launch date? It drives when Steam Direct must be paid (≥5 weeks prior).
