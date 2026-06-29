# RiskLens

RiskLens is a smart inventory and risk analysis system designed for small and medium food and drink markets.

The goal of the project is to help businesses understand their stock, expiry risks, product costs, profit potential, and supplier data through a simple and clear dashboard.

## Project Overview

Food and drink markets deal with many challenges such as expiring products, low stock, pricing issues, and supplier management. RiskLens solves this by allowing users to upload product data and automatically analyze it.

Instead of manually checking products, the system highlights the most important problems so the business can react quickly.

## Main Features

- User authentication system
- One-tap offline **demo workspace** (no backend or API keys required)
- Product dashboard with an animated **Business Health Score**
- **RiskLens Copilot** — a conversational AI analyst for your store
- CSV file upload
- Required column validation
- Low stock detection
- Expiry risk detection
- Inventory value calculation
- Profit and margin calculation
- Supplier tracking
- AI Pricing Lab, Decision Center, Insights & Waste/Expiry analytics
- Clean and mobile-friendly UI

## Getting Started (Local Setup)

### Prerequisites
- **Node.js 18+** and **npm**
- No global Expo install needed — it runs through `npx`.

### Installation
```bash
# 1. Clone the repository
git clone https://github.com/dhurkaa/RiskLens.git
cd RiskLens

# 2. Install dependencies
npm install

# 3. (Optional) Configure environment variables.
#    The app runs FULLY OFFLINE without them — skip this to just try it.
cp .env.example .env
#    then open .env and fill in your Supabase and/or OpenAI values.
```

### Run it
```bash
npm run web       # Web  → http://localhost:8081
npm run android   # Android emulator / device
npm run ios       # iOS simulator (macOS only)
npm start         # Expo dev server (choose a target)
```

On the login screen, press **"Use demo workspace"** to explore the entire app
instantly with a preloaded demo store — **no backend or API keys required**.

### Production web build
```bash
npm run build:web   # static web export → dist/  (this is what Vercel deploys)
```

## RiskLens Copilot

The Copilot is a conversational assistant that answers natural-language
questions about your live inventory — "What's expiring soon?", "What should I
restock?", "Where are my weak margins?", or "Tell me about the salmon".

It runs a deterministic reasoning engine **entirely on-device**, so every number
it reports is computed directly from your real product, alert, and
recommendation data. That means it works with zero backend and zero API keys.
If an optional OpenAI API key is provided (`EXPO_PUBLIC_OPENAI_API_KEY`), the
Copilot will additionally use ChatGPT to phrase its answers more naturally — but
the underlying figures always stay grounded in the on-device analysis.

The Business Health Score blends expiry pressure, stock pressure, margin
quality, and risk into a single 0–100 gauge so an owner can read the state of
the whole store at a glance.

## CSV Format

The system requires a CSV file with the following columns:

name,stock_quantity,min_stock_level,cost_price,expiry_date,supplier_name

Example:

name,stock_quantity,min_stock_level,cost_price,expiry_date,supplier_name  
Milk 1L,18,15,0.90,2026-04-26,DairyFresh  
Bread White,9,20,0.50,2026-04-25,Bakery Local  
Water 1.5L,120,40,0.35,2027-12-31,AquaPure  

## How It Works

The user uploads a CSV file containing product data.

The system validates the file to ensure all required columns exist.

After validation, the data is processed and displayed in the dashboard.

The system analyzes each product and highlights risks such as low stock and expiry dates.

## Core Calculations

Inventory Value  
Inventory Value = Stock Quantity × Cost Price

Margin  
Margin = Selling Price − Cost Price

Margin Percentage  
Margin % = ((Selling Price − Cost Price) / Selling Price) × 100

Revenue  
Revenue = Stock Quantity × Selling Price

Total Profit  
Total Profit = (Selling Price − Cost Price) × Stock Quantity

Low Stock Logic  
If Stock Quantity < Minimum Stock Level → Low Stock Risk

Expiry Calculation  
Days Left = Expiry Date − Today

Risk Levels  
0–3 days → High Risk  
4–7 days → Medium Risk  
More than 7 days → Safe  

## Tech Stack

- React Native
- Expo
- TypeScript
- Supabase
- CSV parsing
- Dashboard-based UI

## Architecture

CSV Upload → Validation → Data Processing → Database → Dashboard → Risk Analysis

## Project Structure

```
risklens/
├── app/                       # Expo Router screens (file-based routing)
│   ├── _layout.tsx            # Root layout + providers (auth, i18n, theme)
│   ├── login.tsx / signup.tsx # Authentication screens
│   └── (tabs)/                # Main authenticated app
│       ├── index.tsx          # Dashboard + animated Business Health Score
│       ├── copilot.tsx        # RiskLens Copilot (conversational AI analyst)
│       ├── decision-center.tsx# "What should I do next?" action list
│       ├── ai-pricing-lab.tsx # Goal-based price proposals
│       ├── alerts-center.tsx  # Low-stock / expiry alerts
│       ├── recommendations-center.tsx
│       ├── supplier-performance.tsx
│       ├── waste-expiry.tsx   # Spoilage / expiry analytics
│       ├── products.tsx · product-details.tsx · edit-product.tsx
│       ├── upload.tsx         # CSV upload + column validation
│       └── settings.tsx       # Language switch (EN/AL) + preferences
├── lib/                       # Core logic
│   ├── copilotEngine.ts       # On-device deterministic reasoning engine
│   ├── aiChat.ts              # OpenAI (ChatGPT) integration, grounded on real data
│   ├── i18n.tsx               # Internationalization provider
│   ├── translations.ts        # English / Albanian strings
│   ├── supabase.ts            # Supabase client
│   ├── demoSupabase.ts        # Offline demo workspace (no backend)
│   └── requireAuth.tsx        # Route auth guard
├── src/
│   ├── api/supabase.ts        # Supabase API helpers
│   └── services/authService.ts
├── components/                # Reusable UI (health-gauge, appsidebar, skeleton, themed-*)
├── hooks/                     # Theme / color-scheme hooks
├── constants/theme.ts         # Design tokens
├── assets/
│   ├── images/                # Icons, splash, favicon
│   └── demo/sample-products.csv  # Sample data for the CSV-upload demo
├── app.json                   # Expo configuration
├── vercel.json                # SPA routing rewrite for Vercel
└── .env.example               # Environment variable template
```

## Current Progress

The product is feature-complete for a demo. We have built the main dashboard
(with an animated Business Health Score), the conversational RiskLens Copilot,
CSV upload with column validation, the AI Pricing Lab, the Decision Center,
Insights, Alerts, Recommendations, Supplier Performance, and Waste & Expiry
analytics.

The whole app runs end-to-end offline through a built-in demo workspace, so it
can be reviewed instantly without configuring Supabase — just press
"Use demo workspace" on the login screen. It also connects to a real Supabase
backend when the `EXPO_PUBLIC_SUPABASE_*` environment variables are provided.

## Challenges

- Handling different CSV formats and missing data
- Managing authentication and sessions
- Designing a simple and clean UI
- Converting raw data into useful insights
- Keeping the project realistic for real businesses

## Next Steps

- Improve dashboard with charts and analytics
- Add automatic alerts for expiry and low stock
- Implement supplier performance tracking
- Add demand and risk prediction
- Improve CSV templates and error handling
- Optimize performance and testing

## Future Vision

RiskLens aims to become a smart assistant for food and drink markets.

The goal is to help businesses reduce waste, avoid stock problems, and improve profitability by providing clear and actionable insights.

## Team Focus

This project focuses on real functionality, clear results, teamwork, and solving real-world business problems.
