# Tam Thế Studio

## Design references

Applied the official [UI UX Pro Max skill](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill/blob/main/.claude/skills/ui-ux-pro-max/SKILL.md) and [Taste skill](https://github.com/Leonxlnx/taste-skill/blob/main/skills/taste-skill/SKILL.md), including its app-screen reference. Reference repositories were checked out beside this repository; no global skills or frontend dependencies were installed.

The initial Taste draw used true-black-flat, seed 767548988. The user rejected black during review. The final direction is warm ivory (#f6f2e9), wood brown (#352c23) and bronze (#785c2e). This deliberate user override takes precedence over the drawn palette and the inspector's cream-palette warning. The user subsequently requested a more distinctive visual direction and effects. The final UI adds cinnabar (#752e27), bronze line icons, decorated paper panels, tactile ritual cards, hover lift, click feedback and tab transitions. These explicit preferences override the skill’s no-shadow/flat-button prescriptions. Visible labels, 44px actions, keyboard tabs, responsive layout and reduced-motion support remain.

Four Admin tabs separate overview, automatic narration, music and the fortune catalog. The token disclosure comes before the work area and collapses after authentication. Intrinsic grid widths are constrained with minmax(0, 1fr). Live keeps the shrine as a 1080×1920 scene, with tabbed controls alongside it on desktop and below it on smaller screens. OBS excludes all studio controls.

## Behavior

- 200 scene seats: 6 VIP, 194 ordinary seats (97 per side). This is scene capacity, not a TikTok viewer limit.
- MEMBER events broadcast `temple.member`. The welcome card shows sanitized names for four seconds. A bounded 12-item queue and a 60-second per-user cooldown reduce crowd spam. `temple.previewWelcome` is authenticated and allows local preview.
- 30 original automatic narration variants across six rituals. Each type accepts up to six newline-separated templates of up to 240 characters each. Known placeholders only; immediate repeated variants are avoided. Existing saved templates are preserved.
- ZeroTTS accepts up to 1,000 characters, splits into short word-boundary chunks, joins polished PCM with pauses and caches the full result. The Node manager serializes synthesis, deduplicates identical requests and bounds its queue. Eight voices remain available.
- 100 original reflection cards in five categories. They are explicitly presented as creative reflection, not historical oracle texts or predictions. Each contains meaning, a practical reflection prompt, short/full reading. Category shuffle bags exhaust their pool before repeating.
- Six original synthesized ambient tracks, 48 seconds each: lotus, rain, stream, bamboo, night, dawn. Source generator: `scripts/generate_ambience.py` (numpy). Files are local WAV assets, not third-party recordings. Selection and auto-rotation persist in settings. The Live audio engine lowers music under speech; 0% stays silent. File selection is a local-only blob, with no upload or persistence across reload.

## Validation

- `npm run build` includes TypeScript checking.
- `node scripts/test-studio.cjs`: fortune uniqueness and shuffle cycles; narration selection, validation, placeholders; settings validation.
- `node scripts/review-server.cjs`: isolated review backend on loopback port 3012, disposable OS-temp state, fixed **test-only** token; never expose or use as the production server.
- With that review server running: `node scripts/test-studio-http.cjs` exercises authenticated RPC, persisted music selection, six WAV files, WebSocket welcome and actual multi-chunk ZeroTTS synthesis plus protected audio retrieval.
- Taste lint: no failures. Earlier flat Admin inspector: no failures at 1440, 768, 390 pixels; intentional cream-palette warning. The subsequent user-requested ornamental/effect layer is evaluated through browser review rather than described as passing the flat-theme gate.
- Browser review: 194 hall nodes + 6 VIP; welcome received and shown; music player reported duration 48 and paused=false; fortune catalog returned 100, category 20 and search one matching card. Mobile Live stayed within viewport width and remained vertically scrollable.

Screenshots and inspector artifacts live in ignored `output/` and `.taste-skill/`. Real TikTok MEMBER delivery still requires a connected, currently live account; the local test covers the same broadcast/render path via preview.

Render critique: controls and shrine now have distinct hierarchy, shared edges and restrained surfaces. Preview crop was moved to the top to retain all Buddha heads. The phone has wrapped Admin tabs and a single content column. The ornate shrine intentionally retains its imagery, effects and gold HUD; plain controls use the flat studio theme. Main remaining tradeoff: 200 people are small at phone-preview size; the full OBS source preserves the 1080×1920 logical scene.

## Presence and scene refinements

Every occupied VIP or hall seat shows the viewer avatar, or their initial if unavailable. Image URLs accept HTTP(S) only and render in a circular head badge. Incoming valid comments register/update the viewer, then broadcast `temple.chat`; text is sanitized server-side and inserted with textContent. At most four bubbles show at once, for six seconds. Existing 3.5-second comment cooldown applies. The review server verifies this using a clearly synthetic local demo avatar. Real TikTok photos depend on the CDN image being available.

The bottom HUD uses a cinnabar activity strip, three ivory ritual tiles with SVG icons and a matching contribution leaderboard. The wooden fish, temple bell and fortune shaker use original local WAV sounds with separate preview buttons and one local volume control in Live → Giọng đọc. Ritual events schedule successive wooden-fish taps (up to 12 per event to bound audio density).

The selected default ZeroTTS voice remains available for previews. A saved rotation list can include two or more available voices; spoken ritual events advance through that list in order. Event cards use the same warm-paper and cinnabar palette in the Live dock and Admin activity list. Hall and VIP figures perform brief staggered bows when a ritual arrives and nod on chat, while honoring reduced-motion settings. The three Buddha halos now illuminate around the full altar, and smoke grows in particle count and size with the number of active incense sticks.

For the Edge black-stage report, the decorative canvas no longer requests desynchronized rendering, black pixels blend through with screen compositing, and the shrine has a background fallback outside the transformed stage. The issue was not reproducible in the in-app browser; actual Edge confirmation remains with the user.
