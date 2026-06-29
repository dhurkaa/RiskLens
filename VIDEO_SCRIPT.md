# RiskLens — 5-Minute Demo Video Script

A complete shot-by-shot plan for a 5:00 explainer video. You record the screen
following the **[SCREEN]** directions and read the **[VOICEOVER]** lines aloud.
The narration is written to fit the time at a calm pace (~150 words/min).

---

## How to record it (read once)

1. **Start the app:** `npm run web`, open `http://localhost:8081`, maximize the
   browser, and click **"Use demo workspace"** so you're on the dashboard before
   you hit record.
2. **Recording tool (free):**
   - Windows: press **Win + G** (Game Bar) → Record, or install **OBS Studio**.
   - Mac: **Cmd + Shift + 5** → Record Selected Portion.
3. **Record at 1080p.** Record just the browser window. Move the mouse slowly and
   deliberately — pause ~1 second on each important screen.
4. **Easiest workflow:** record the *screen first* (silent), following the
   timeline below; then record your *voiceover* separately while watching it
   back; then drop both into a free editor (**Clipchamp** on Windows, **CapCut**,
   or **iMovie**) and line them up. This way you never have to talk and click
   perfectly at the same time.
5. **Tip:** practice the click path twice before recording so it's smooth.

> Total target: **5:00**. Each scene below shows its time window and the exact
> clicks. Don't rush — if you finish a scene early, hold on the screen.

---

## SCENE 1 — Title & the problem  ·  0:00–0:25

**[SCREEN]** Start on the **Dashboard**. Hold still on the hero/health area.
*(Optional: add a title card "RiskLens" for the first 3 seconds in your editor.)*

**[VOICEOVER]**
> "This is RiskLens — a smart inventory and risk assistant for small food and
> drink markets. Shops like these lose money every day to three quiet problems:
> products that expire before they sell, items that run out of stock, and prices
> set too low. RiskLens turns their raw inventory into clear answers — and an AI
> they can simply talk to. Let me show you."

---

## SCENE 2 — Dashboard & Business Health Score  ·  0:25–1:05

**[SCREEN]** Slowly pan the top metric cards (Products, Low stock, Near expiry,
High risk, Avg margin, Pricing impact). Then **scroll down** to the animated
**Business Health Score** gauge and let it finish its sweep.

**[VOICEOVER]**
> "The moment data loads, the dashboard summarizes the whole store — products
> tracked, items low on stock, items near expiry, and how many are high risk.
> But the highlight is this: the Business Health Score. RiskLens blends expiry,
> stock, margin, and risk pressure into a single number out of one hundred. This
> store sits at seventy-eight — 'Stable' — and underneath it tells the owner
> exactly what's pulling the score down. One glance, and you know how the
> business is doing."

---

## SCENE 3 — Everything is clickable  ·  1:05–1:35

**[SCREEN]** Scroll back up. **Click the "Low stock" card.** The Products screen
opens — scroll a little so the **"Low stock" filter chip (highlighted)** and the
filtered product list are visible. Then use the browser **Back** button to return
to the dashboard.

**[VOICEOVER]**
> "And the numbers aren't just for show — they're shortcuts. Tapping 'Low stock'
> jumps straight to the products that are actually running low, already filtered
> for me. The same is true across the app: every key metric is a doorway to the
> detail behind it. That keeps the owner moving from a number to an action in one
> tap."

---

## SCENE 4 — RiskLens Copilot (the star)  ·  1:35–2:50

**[SCREEN]** Tap **"Ask RiskLens Copilot"** (quick action) or the robot icon in
the header. Wait for the welcome + gauge. Then:
- Tap the chip **"What's expiring soon?"** — let the answer + the ranked card
  appear and read on screen for a moment.
- Type **"If I could fix only one thing today, what should it be?"** and send.
- Type **"tell me about the salmon"** and send.

**[VOICEOVER]**
> "Now the part people don't expect from a project like this — the RiskLens
> Copilot. It's already scanned the live inventory. I can ask, in plain English,
> 'what's expiring soon?' — and it answers with the real numbers and a ranked
> list of exactly which products, plus buttons to act on them. Because it's
> connected to ChatGPT, but grounded on the store's real data, I can also ask
> open-ended questions it was never specifically programmed for — like 'if I
> could fix only one thing today, what should it be?' It reasons about the answer,
> but it can't invent numbers, because the facts come from the app, not the model.
> And I can deep-dive any single product just by naming it."

---

## SCENE 5 — Fully bilingual: English & Albanian  ·  2:50–3:30

**[SCREEN]** Open the menu (top-left) → **Settings** (it reads "Cilësimet" once
switched). Tap **"Shqip."** Watch the screen flip to Albanian. Go back to the
**Dashboard** to show it's translated everywhere. Then open the **Copilot** and
ask, in Albanian, **"Çfarë duhet të rifurnizoj?"** Let the Albanian answer appear.
*(Then switch back to English in Settings if you like.)*

**[VOICEOVER]**
> "RiskLens is also fully bilingual. From Settings, one tap switches the entire
> app to Albanian — instantly, and it remembers the choice. Every screen, every
> label. And it's not just the buttons — the AI assistant answers in Albanian
> too. So a local shop owner can use the whole product, and talk to the AI, in
> their own language."

---

## SCENE 6 — It's a complete system  ·  3:30–4:25

**[SCREEN]** From the menu, visit these and pause ~5 seconds on each:
1. **Decision Center** — scroll the ranked action list.
2. **AI Pricing Lab** — show the goal cards and one generated price proposal.
3. **Insights** — show category and supplier risk.
4. **Waste & Expiry** — show the expiry overview.

**[VOICEOVER]**
> "And this isn't a single screen — it's a full system. The Decision Center
> answers one question: what should I do next, right now. The AI Pricing Lab
> proposes price changes from a few business goals — and nothing is applied until
> the owner approves it. Insights breaks down risk by category and by supplier.
> Waste and Expiry puts all spoilage risk in one place. There are also alerts,
> recommendations, and CSV upload — so a real business can bring its own data in
> minutes."

---

## SCENE 7 — Tech & close  ·  4:25–5:00

**[SCREEN]** Return to the **Dashboard** (the health gauge makes a strong closing
shot). Hold still.

**[VOICEOVER]**
> "Under the hood, RiskLens is built with React Native and Expo, so the same app
> runs on the web, iPhone, and Android. It uses TypeScript, Supabase for accounts
> and data, and the OpenAI API for the Copilot. It runs completely offline for a
> demo, and connects to a real backend and ChatGPT when configured. In short:
> RiskLens takes a messy spreadsheet and turns it into a health score, a
> prioritized action list, and an AI assistant the owner can talk to — in English
> or Albanian. Thanks for watching."

---

## Quick timing cheat-sheet

| Scene | Time | Topic |
|------|------|-------|
| 1 | 0:00–0:25 | Title + the problem |
| 2 | 0:25–1:05 | Dashboard + Health Score |
| 3 | 1:05–1:35 | Clickable cards |
| 4 | 1:35–2:50 | **Copilot (the star)** |
| 5 | 2:50–3:30 | Albanian language switch |
| 6 | 3:30–4:25 | Full system tour |
| 7 | 4:25–5:00 | Tech + close |

**Pacing reminders:** speak slowly; let each AI answer sit on screen for 2–3
seconds so viewers can read it; keep mouse movements smooth; if a GPT answer is
slow, the app falls back to an instant on-device answer — just keep going.
