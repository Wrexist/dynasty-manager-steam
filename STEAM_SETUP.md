# STEAM_SETUP — On-device Steamworks runbook

> Copy-paste guide to take the Steam port from "code is in place" to "verified on
> a real Steam client." All the integration code already exists and is
> unit-tested — this is **wire-and-verify**, not green-field. Do the steps on a
> **Windows** machine with the Steam client installed and running.
>
> Code references: `electron/steam.cjs` (init, achievements, overlay, cloud),
> `electron/main.cjs` (IPC + overlay flags), `src/utils/steamAchievements.ts`
> (achievement mirror), `src/store/helpers/persistence.ts` (cloud mirror),
> `electron-builder.json` (packaging TODOs).

---

## 0. Prerequisites

- ✅ Paid Steam partner account (done).
- An **App** created in Steamworks → you'll get a numeric **AppID**. You can do
  the whole spike against your real AppID (recommended — achievements and cloud
  need it anyway). AppID **480** (Spacewar) is only useful for a throwaway
  init/overlay smoke test before your app is configured.
- Node 20+ and the repo cloned on the Windows box.

> **Native-module note:** `steamworks.js` is a prebuilt native addon. On a
> machine behind a TLS-intercepting proxy, prefix installs with
> `NODE_OPTIONS=--use-system-ca` (this repo's documented quirk) so the binary
> download/verify doesn't fail.

---

## 1. Install the native binding + point it at your AppID

```bash
# from the repo root
npm install steamworks.js          # optional dep; the app no-ops without it

# Tell the local build which app to attach to. steam.cjs reads STEAM_APPID env
# first, then steam_appid.txt in the cwd. Use ONE of:
echo 480 > steam_appid.txt         # smoke test (Spacewar), OR
echo <YOUR_APPID> > steam_appid.txt
# (steam_appid.txt is git-ignored-worthy — don't commit your real AppID file)
```

The Steam client must be **running and logged in**, and your account must own
(or be allowed to test) that AppID.

---

## 2. Run the spike

```bash
npm run build          # produce dist/
npm run electron-dev   # or your packaged-run script
```

**Verify these three things (the spike's whole purpose):**

1. **Init** — the main-process console logs `[steam] Initialised for AppID <n>.`
   (If you see `steamworks.js not installed` or `init failed (is the Steam
   client running?)`, fix that first — every Steam feature stays off until init
   succeeds.)
2. **Achievement** — trigger any in-game achievement (e.g. win a match for
   `FIRST_WIN`). It should unlock in Steam. `src/utils/steamAchievements.ts`
   mirrors `unlockedAchievements` → Steam; it also reconciles the full set on
   launch, so loading a save with achievements should fire them too.
3. **Overlay** — press **Shift+Tab**. The Steam overlay must render **over** the
   game and **not be white/black**. A white overlay = the DirectComposition
   symptom; the launch flags in `main.cjs`
   (`in-process-gpu` + `disable-direct-composition`, win32 + AppID-gated) are
   there to prevent it. If it's still white, see Troubleshooting.

> ⚠️ The `steamworks.js` API method names in `electron/steam.cjs`
> (`client.achievement.activate`, `steamworks.electronEnableSteamOverlay`) are
> from the documented greenheartgames API but were **not verifiable in CI** —
> every call is wrapped to no-op on error. If achievements don't fire but init
> succeeded, check these names against the installed version and adjust
> `electron/steam.cjs` only.

---

## 3. Steamworks dashboard — Achievements

Create **38** achievements with these exact **API Names** (the app derives them
as `id.toUpperCase().replace(/-/g,'_')`; `steamAchievementApiNames()` returns the
live list). Display name + description are below; set the **Hidden** column where
marked (these are spoiler/"hidden" achievements in-game).

| API Name | Display name | Description | Hidden |
|---|---|---|---|
| FIRST_WIN | First Victory | Win your first match | |
| WINS_10 | 10 Wins | Win 10 matches | |
| WINS_50 | Half Century | Win 50 matches | |
| LEAGUE_CHAMPION | League Champion | Win the league title | |
| TOP_3 | Podium Finish | Finish in the top 3 | |
| BACK_TO_BACK | Back to Back | Win the league two seasons in a row | ✓ |
| UNBEATEN_5 | Unbeaten Streak | Go 5 matches without a loss | |
| UNBEATEN_10 | Fortress | Go 10 matches without a loss | |
| UNBEATEN_20 | Invincible Run | Go 20 matches without a loss | ✓ |
| GOAL_MACHINE_10 | Sharpshooter | Have a player score 10+ goals in a season | |
| GOAL_MACHINE_20 | Goal Machine | Have a player score 20+ goals in a season | |
| GOAL_MACHINE_30 | Golden Boot | Have a player score 30+ goals in a season | ✓ |
| BIG_SPENDER | Big Spender | Spend £50M+ on transfers | |
| TRANSFER_MOGUL | Transfer Mogul | Spend £200M+ on transfers | |
| SHREWD_SELLER | Shrewd Seller | Earn £30M+ from player sales | |
| YOUTH_GRADUATE | Academy Product | Give a youth player 10+ appearances | |
| YOUTH_STAR | Youth Star | Have a youth academy player rated 75+ | |
| CLEAN_SHEET_5 | Clean Sheet King | Keep 5 clean sheets in a season | |
| CLEAN_SHEET_15 | Impenetrable | Keep 15 clean sheets in a season | |
| DYNASTY_3 | Dynasty Builder | Manage for 3+ seasons | |
| DYNASTY_10 | Legend | Manage for 10+ seasons | ✓ |
| SURVIVE_SACKING | Great Escape | Finish above relegation after a poor season | |
| PROMOTION | Going Up! | Get promoted to a higher division | |
| CUP_WINNER | Cup Winner | Win the Dynasty Cup | |
| LEAGUE_CUP_WINNER | Cup Collector | Win the League Cup | |
| CHAMPIONS_CUP_WINNER | European Champion | Win the Champions Cup | |
| SHIELD_CUP_WINNER | Shield Bearer | Win the Shield Cup | |
| CONFERENCE_CUP_WINNER | Conference Champion | Win the Conference Cup | |
| CONTINENTAL_DEBUT | Continental Debut | Play in a continental competition | |
| CONTINENTAL_TREBLE | The Treble | Win League + Domestic Cup + Champions Cup in one season | ✓ |
| FULL_HOUSE | Full House | Hire staff for all 7 roles | |
| NATIONAL_TEAM_APPOINTED | International Duty | Get appointed as national team manager | |
| INTL_TOURNAMENT_WIN | World Beater | Win an international tournament as manager | ✓ |
| DOUBLE | The Double | Win the league and cup in the same season | ✓ |
| PACK_FIRST_OPEN | Pack Hunter | Open your first player pack | |
| PACK_RARE_PULL | Rare Find | Pull a player rated 84 or higher from a pack | |
| PACK_LEGENDARY_PULL | Legendary Pull | Pull a player rated 90 or higher from a pack | |
| PACK_COLLECTOR | Pack Collector | Open 25 player packs | |

> Each needs an icon (locked + unlocked). Reuse the in-game tier art or generate
> simple gold/silver/bronze badges. Publish the achievement config in Steamworks
> for it to take effect, then re-run the spike.
>
> Keep this table in sync with `src/utils/achievements.ts` — if you add an
> in-game achievement, run `steamAchievementApiNames()` and add the new row.

---

## 4. Steamworks dashboard — Cloud saves (Auto-Cloud)

The app uses **Auto-Cloud file mirroring** (not the ISteamRemoteStorage API).
`writeSaveSlot` mirrors each slot to a plain file and `restoreCloudSavesIfEmpty`
re-imports empty slots on launch.

- **Files written:** `<userData>/steamcloud/slot1.sav`, `slot2.sav`, `slot3.sav`
- **Windows `<userData>`:** `%APPDATA%\Dynasty Manager` (Electron uses the
  `productName`), i.e. `%APPDATA%\Dynasty Manager\steamcloud\`

In Steamworks → **Cloud** → Auto-Cloud, add a path group:

| Field | Value |
|---|---|
| Root | `WinAppDataRoaming` |
| Subdirectory | `Dynasty Manager/steamcloud` |
| Pattern | `slot*.sav` |
| Platforms | Windows (add macOS/Linux when those depots exist) |

Set a reasonable per-user cloud quota (saves are small JSON). Enable Cloud for
the app.

> **Conflict resolution caveat:** the app currently only restores **empty**
> slots from cloud (the safe cross-machine case). "Both local + cloud present,
> newest wins" is intentionally not implemented (the save has no embedded
> timestamp; an untested overwrite could clobber a real save). Verify a clean
> round-trip (machine A saves → machine B fresh install pulls it) before relying
> on cloud. Enabling newest-wins is a follow-up that needs the two-machine test.

---

## 5. Packaging for the depot

In `electron-builder.json` (see the `_todo_*` keys already there):

1. **Unpack the native addon** — a `.node` can't load from inside an asar:
   ```json
   "asarUnpack": ["**/node_modules/steamworks.js/**"]
   ```
2. **App icon** — generate a multi-res `build/icon.ico` from `public/icon.png`
   (256/128/64/48/32/16) and set `"win": { "icon": "build/icon.ico" }`. The
   in-app window icon is already wired at runtime.
3. Build the Windows `dir` target (already configured) — `release/win-unpacked/`
   is what you upload.

```bash
npm run build
npx electron-builder --win dir     # or your packaging script
```

Drop a `steam_appid.txt` containing your real AppID next to the packaged exe for
testing the packaged build (Steam injects it at launch in production, but it's
handy for local depot testing).

---

## 6. SteamPipe upload (Phase 7)

- Create depot(s) in Steamworks; note the DepotID.
- Author `app_build_<appid>.vdf` + `depot_build_<depotid>.vdf` pointing
  `ContentRoot` at `release/win-unpacked/`.
- `steamcmd +login <user> +run_app_build ..\scripts\app_build_<appid>.vdf +quit`
- Set the build live on a branch (default or a `beta` branch for Playtest first).

---

## 7. Final verification on a CLEAN machine

Not the dev box — a machine that never had the repo:

- [ ] Install via Steam; game launches, no white flash, correct window/taskbar icon.
- [ ] Achievement unlocks and shows the Steam toast.
- [ ] Overlay (Shift+Tab) renders correctly in-game.
- [ ] Cloud: save on machine A → fresh machine B pulls the save on first launch.
- [ ] Resolutions 1280×720 → 2560×1440, multi-monitor, DPI scaling all sane.

---

## Troubleshooting

| Symptom | Likely cause / fix |
|---|---|
| `steam.cjs`: "No AppID configured" | `steam_appid.txt` not in cwd / `STEAM_APPID` unset. |
| "steamworks.js not installed" | `npm install steamworks.js` (with `NODE_OPTIONS=--use-system-ca` behind the proxy). |
| "init failed (is the Steam client running?)" | Start Steam, log in, ensure the account can access the AppID. |
| Achievements don't fire but init succeeded | Verify the achievement API names in the dashboard match the table exactly; check `client.achievement.activate` against the installed `steamworks.js` version. |
| Overlay renders **white** | Confirm the win32 launch flags applied (they gate on `steam_appid.txt` present). If still white, try toggling `disable-direct-composition`; if intractable, evaluate `steamworks-ffi-node` — only `electron/steam.cjs` changes. |
| Overlay doesn't open at all | `electronEnableSteamOverlay()` must run after the window exists (it's called in `createWindow`); ensure Electron stays at v34.x (later majors have broken the overlay before). |
| Cloud files not syncing | Auto-Cloud Root/Subdirectory/Pattern must match `%APPDATA%\Dynasty Manager\steamcloud\slot*.sav`; Cloud enabled for the app + per-user quota > 0. |
