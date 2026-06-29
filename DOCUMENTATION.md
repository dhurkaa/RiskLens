# RiskLens — Technical Documentation

> Smart inventory and risk-analysis assistant for small and medium food & drink
> markets. This document describes the technologies used, how to install and run
> the project, its structure, its main features, and the division of work within
> the team.

---

## 1. Overview

RiskLens turns a shop's raw inventory (a CSV or a connected database) into three
clear outputs:

1. a **Business Health Score** (0–100) summarizing the whole store at a glance;
2. a **prioritized action list** (Decision Center) answering *"what should I do next?"*;
3. a **conversational AI analyst** (RiskLens Copilot) the owner can talk to in
   plain English or Albanian.

The app is cross-platform (web, iOS, Android) from a single codebase and runs
**fully offline** for demos through a built-in demo workspace.

---

## 2. Technologies Used

| Area | Technology | Purpose |
|------|------------|---------|
| Framework | **React Native + Expo** (Expo Router) | One codebase for web, iOS, Android; file-based routing |
| Language | **TypeScript** | Type safety across the whole app |
| Backend / Auth | **Supabase** | Authentication, data storage, session management |
| AI (conversational) | **OpenAI API (ChatGPT, `gpt-4o-mini` default)** | Natural-language phrasing for the Copilot |
| AI (reasoning) | **On-device deterministic engine** (`lib/copilotEngine.ts`) | Computes every figure from real data; works with zero keys |
| Data parsing | **PapaParse** | CSV upload + validation |
| Internationalization | Custom i18n provider (`lib/i18n.tsx`) | Full English / Albanian translation |
| UI / animation | react-native-reanimated, react-native-svg, expo-linear-gradient | Animated health gauge, charts, gradients |
| Storage | AsyncStorage (web) / expo-secure-store (native) | Sessions and preferences |
| Hosting | **Vercel** (static web export) | Live deployment of the web build |

---

## 3. Installation & Local Execution

### Prerequisites
- **Node.js 18+** and **npm**
- No global Expo install required (runs via `npx`).

### Steps
```bash
# 1. Clone
git clone https://github.com/dhurkaa/RiskLens.git
cd RiskLens

# 2. Install dependencies
npm install

# 3. (Optional) Environment variables — the app runs fully offline without them
cp .env.example .env
#    fill in EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY for a real
#    backend, and EXPO_PUBLIC_OPENAI_API_KEY to enable live ChatGPT answers.

# 4. Run
npm run web       # → http://localhost:8081
npm run android   # Android
npm run ios       # iOS (macOS only)
```

> **Fastest way to evaluate:** run `npm run web`, open the URL, and click
> **"Use demo workspace"** on the login screen. This loads a realistic store of
> 12 products with **no backend and no API keys needed**.

### Production web build
```bash
npm run build:web   # static export → dist/  (deployed to Vercel)
```

---

## 4. Project Structure

```
risklens/
├── app/                       # Expo Router screens (file-based routing)
│   ├── _layout.tsx            # Root layout + providers (auth, i18n, theme)
│   ├── login.tsx / signup.tsx # Authentication
│   └── (tabs)/                # Main authenticated app
│       ├── index.tsx          # Dashboard + Business Health Score
│       ├── copilot.tsx        # RiskLens Copilot (AI analyst)
│       ├── decision-center.tsx# Prioritized action list
│       ├── ai-pricing-lab.tsx # Goal-based price proposals
│       ├── alerts-center.tsx  # Low-stock / expiry alerts
│       ├── recommendations-center.tsx
│       ├── supplier-performance.tsx
│       ├── waste-expiry.tsx   # Spoilage / expiry analytics
│       ├── products.tsx · product-details.tsx · edit-product.tsx
│       ├── upload.tsx         # CSV upload + validation
│       └── settings.tsx       # Language switch (EN/AL)
├── lib/                       # Core logic
│   ├── copilotEngine.ts       # On-device deterministic reasoning engine
│   ├── aiChat.ts              # OpenAI integration, grounded on real data
│   ├── i18n.tsx / translations.ts   # EN/AL internationalization
│   ├── supabase.ts            # Supabase client
│   ├── demoSupabase.ts        # Offline demo workspace
│   └── requireAuth.tsx        # Auth guard
├── src/
│   ├── api/supabase.ts
│   └── services/authService.ts
├── components/                # Reusable UI (health-gauge, appsidebar, skeleton…)
├── hooks/                     # Theme / color-scheme hooks
├── constants/theme.ts         # Design tokens
├── assets/                    # Images + demo/sample-products.csv
├── app.json                   # Expo configuration
├── vercel.json                # SPA routing rewrite for Vercel
└── .env.example               # Environment variable template
```

---

## 5. Main Features

- **Authentication** — sign up / log in via Supabase, plus a one-tap offline demo.
- **Dashboard** — key metrics (products, low stock, near expiry, high risk,
  average margin) and an animated **Business Health Score**.
- **Clickable metrics** — every metric is a shortcut into the filtered detail.
- **RiskLens Copilot** — conversational AI grounded on live inventory; answers
  questions like *"What's expiring soon?"* with real numbers and action buttons.
- **Decision Center** — a single ranked list of the most important next actions.
- **AI Pricing Lab** — proposes price changes from business goals; nothing is
  applied until the owner approves.
- **Insights / Supplier Performance / Waste & Expiry** — risk analytics by
  product, category, and supplier.
- **CSV upload** — import inventory with required-column validation (PapaParse).
- **Full English / Albanian localization** — the entire UI *and* the AI answers
  switch language with one tap, and the choice is remembered.

### How the Business Health Score works
The score starts at 100 and is penalized by expiry pressure, out-of-stock and
low-stock items, weak margins, and average margin — scaled by catalogue size so a
single bad item cannot collapse a large store's score.

### How the Copilot stays accurate
All figures are computed on-device by `lib/copilotEngine.ts` from the real
product, alert, and recommendation data. The optional OpenAI layer
(`lib/aiChat.ts`) only **phrases** the answer in natural language — the numbers
are passed to it as grounded context, so it cannot invent figures.

---

## 6. CSV Format

Required columns:
```
name,stock_quantity,min_stock_level,cost_price,expiry_date,supplier_name
```
A ready-to-use sample lives at `assets/demo/sample-products.csv`.

---

## 7. Deployment

The web build is exported with `npm run build:web` (Expo static export to
`dist/`) and hosted on **Vercel**. Because the app is a single-page application,
`vercel.json` contains a rewrite that routes every path back to `index.html`, so
deep links such as `/decision-center` work on a direct page load.

**Live app:** https://risk-lens-rvrs.vercel.app/

---

## 8. Division of Responsibilities

> Fill in the real names and contributions of each group member.

| Member | Main responsibilities |
|--------|-----------------------|
| _[Name 1]_ | _[e.g. Dashboard, Business Health Score, UI/UX]_ |
| _[Name 2]_ | _[e.g. RiskLens Copilot, OpenAI integration, reasoning engine]_ |
| _[Name 3]_ | _[e.g. Supabase auth/data, CSV upload, deployment]_ |
| _[Name 4]_ | _[e.g. Internationalization, Pricing Lab, documentation]_ |

---

## 9. Testing the Project

1. Open the live app (link above) **or** run `npm run web` locally.
2. Click **"Use demo workspace"** on the login screen.
3. Explore the Dashboard → open the **Copilot** and ask *"What's expiring soon?"*
4. Switch the language to Albanian from **Settings**.
5. (Optional) Upload `assets/demo/sample-products.csv` from the **Upload** screen.
