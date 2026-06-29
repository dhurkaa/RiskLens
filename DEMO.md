# RiskLens — Demo Day Script

A step-by-step plan for presenting RiskLens. Read **[DO]** as the action and
**[SAY]** as roughly what to say. Total time: ~5–7 minutes.

---

## 0. Before you present (5 min setup)

1. Open a terminal in the project folder and run:
   ```
   npm run web
   ```
   Wait until it says it's serving on **http://localhost:8081**.
2. Open that URL in your browser. **Maximize the window** and zoom so it looks
   like a phone-ish app (Ctrl + once or twice is fine).
3. On the login screen, click **"Use demo workspace"** — this is the most
   reliable entry and lands you on the dashboard with 12 products preloaded.
   (The `?demo=1` URL also auto-logs in, but can take a second longer.)
4. Confirm the Copilot says **"GPT live"** in its header (means your OpenAI key
   is working). If it says "On-device", that's fine too — it still answers, just
   without ChatGPT.
5. Have a second browser tab open at `localhost:8081` as a backup — if needed,
   just click **"Use demo workspace"** again.

> **Golden rule:** if anything ever looks stuck, refresh the page — the demo
> workspace reloads instantly. Nothing here needs the internet except the GPT
> answers.

---

## 1. The hook (30 sec)

**[SAY]** "Small food and drink markets lose money every day to three silent
problems: products that expire before they sell, items that quietly run out of
stock, and prices that are set too low. Owners don't have time to read
spreadsheets. **RiskLens** turns their raw inventory into clear answers — and it
even has an AI assistant they can just *talk to*."

---

## 2. The dashboard & the Business Health Score (60 sec)

**[DO]** Stay on the dashboard. Point at the top metric cards, then scroll to
the **Business Health Score** gauge.

**[SAY]** "The moment data is loaded, RiskLens scores the whole store out of 100.
This blends expiry, stock, margin, and risk into one number an owner can read at
a glance. Right now this store is at 78 — 'Stable' — and it tells us exactly
what's dragging it down: items near expiry, low stock, and so on."

**[DO]** Tap the **"Low stock"** card.

**[SAY]** "And every number is clickable — tapping 'Low stock' takes me straight
to the products that are actually low, already filtered." *(The Products screen
opens with the Low-stock filter active.)*

**[DO]** Go back to the dashboard (browser back, or the menu → Dashboard).

---

## 3. The star feature — RiskLens Copilot (the wow, ~2 min)

**[DO]** Tap **"Ask RiskLens Copilot"** (quick action) or the robot icon in the
header.

**[SAY]** "This is the part people don't expect from a student project — a
conversational AI analyst that already scanned the live inventory."

**[DO]** Tap the suggestion chip **"What's expiring soon?"** (or type it).

**[SAY]** "It answers in plain language, with the real numbers — six products
within seven days, about €126 of waste at risk — and it shows a ranked card of
exactly which items, plus buttons to act."

**[DO]** Type a free-form question it was never explicitly programmed for, e.g.
**"If I could only fix one thing today, what should it be?"**

**[SAY]** "Because it's connected to ChatGPT *grounded on the real data*, it
reasons about open-ended questions — but it can't invent numbers, because the
facts come from the app, not the model."

**[DO]** Type **"tell me about the salmon"**.

**[SAY]** "It can deep-dive any single product too."

---

## 4. The Albanian language switch (the second wow, ~60 sec)

**[DO]** Open the menu (top-left) → **Settings** (Cilësimet). Tap **"Shqip"**.

**[SAY]** "The entire app is fully bilingual. One tap and *everything* switches
to Albanian — instantly, and it remembers the choice."

**[DO]** Go back to the dashboard, then back into the Copilot. Ask a question in
Albanian, e.g. **"Çfarë duhet të rifurnizoj?"**

**[SAY]** "And the AI answers in Albanian too — so a local shop owner can use it
in their own language."

**[DO]** *(Optional)* Switch back to English in Settings so the rest of the demo
is easy to narrate.

---

## 5. Show the depth (≈60 sec, pick one or two)

**[DO]** Open the menu and visit a couple of these to prove it's a full product:
- **Decision Center** — "the single page that answers 'what should I do next?'"
- **AI Pricing Lab** — "answer a few business questions and it proposes price
  changes; nothing is applied until the owner approves."
- **Insights** — "category and supplier risk analytics."
- **Waste & Expiry** — "everything about spoilage in one place."

**[SAY]** "It's not one screen — it's a complete system: upload, dashboard,
decision center, AI pricing, insights, supplier and waste analytics, alerts, and
recommendations."

---

## 6. (Optional) Live CSV upload

**[DO]** Menu → **Upload CSV** → "Choose CSV" → pick `assets/demo/sample-products.csv`
→ "Upload to Supabase".

**[SAY]** "Real businesses start by uploading their inventory as a CSV. RiskLens
validates the columns, then automatically generates alerts and recommendations
from it." *(If a date in the file is in the past it just shows as expired — that
still demonstrates the risk detection.)*

> Skip this if you're short on time — the preloaded demo already tells the whole
> story and is lower-risk on stage.

---

## 7. Close (20 sec)

**[SAY]** "RiskLens takes a messy spreadsheet and turns it into a health score, a
prioritized action list, and an AI assistant the owner can talk to — in English
or Albanian. It runs fully offline for a demo, and connects to a real backend
and ChatGPT when configured. Thank you — happy to take questions."

---

## Likely questions & answers

- **"Is the AI real or fake?"** — Real. There's an on-device reasoning engine
  that computes every number from the live data, and an optional ChatGPT
  integration that writes the conversational answers *grounded on that data* so
  it can't hallucinate figures.
- **"What's the tech stack?"** — React Native + Expo (runs on web, iOS, Android),
  TypeScript, Supabase for auth/data, and the OpenAI API for the Copilot.
- **"How is the health score calculated?"** — It starts at 100 and is penalized
  by expiry pressure, out-of-stock and low-stock items, weak margins, and average
  margin — scaled by catalogue size so one bad item doesn't tank a big store.
- **"Does it need the internet?"** — No for the core app (offline demo workspace).
  Only the ChatGPT answers use the network; without a key it falls back to the
  on-device engine.
- **"Is it just mock data?"** — The demo uses a realistic preloaded store, but the
  same screens run on a live Supabase backend and real CSV uploads.

---

## Backup plan (if something breaks)

- **App looks stuck / blank:** refresh the browser tab. The demo reloads instantly.
- **GPT answer is slow or errors:** it automatically falls back to an instant
  on-device answer — just keep going, the cards still appear.
- **Whole thing won't start:** open `localhost:8081`, click "Use demo
  workspace", or re-run `npm run web`.
- **Worst case:** screenshots. Take a few before demo day (dashboard, Copilot
  answer, Albanian Settings) and keep them in a slide as a fallback.
