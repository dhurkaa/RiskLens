/**
 * RiskLens Copilot — OpenAI (GPT) chat layer.
 *
 * When an OpenAI key is configured, the Copilot routes questions to GPT. To keep
 * answers trustworthy, we never let the model answer "blind": we compute the
 * real store metrics on-device and pass them in as grounded context, so GPT
 * reasons and talks naturally but cannot invent product names, prices, or
 * numbers. With no key configured, the app falls back to the fully offline
 * on-device engine (see copilotEngine.ts), so the demo always works.
 */

import {
  computeStats,
  daysUntil,
  healthLabel,
  riskScore,
  type CopilotContext,
} from './copilotEngine';

export type ChatTurn = { role: 'user' | 'assistant'; content: string };

const OPENAI_ENDPOINT = 'https://api.openai.com/v1/chat/completions';
const MAX_PRODUCTS_IN_CONTEXT = 80;

export function hasOpenAIKey() {
  return !!process.env.EXPO_PUBLIC_OPENAI_API_KEY;
}

/** Short label shown in the Copilot header to indicate the active brain. */
export function aiStatusLabel() {
  if (hasOpenAIKey()) return 'GPT live';
  return 'On-device';
}

function num(value?: number | null) {
  return Number(value || 0);
}

function margin(selling?: number | null, cost?: number | null) {
  const s = num(selling);
  const c = num(cost);
  if (s <= 0) return 0;
  return Math.round(((s - c) / s) * 100);
}

/**
 * Compact, complete snapshot of the store that GPT can reason over. Products are
 * ordered by risk and capped so large catalogues stay within a sane token
 * budget; the cap is disclosed to the model so it never over-claims.
 */
export function buildDataContext(ctx: CopilotContext): string {
  const s = computeStats(ctx);

  const summary = [
    `products=${s.totalProducts}`,
    `healthScore=${s.healthScore}/100 (${healthLabel(s.healthScore)})`,
    `nearExpiry(<=7d)=${s.nearExpiry.length}`,
    `expired=${s.expired.length}`,
    `lowStock=${s.lowStock.length}`,
    `outOfStock=${s.outOfStock.length}`,
    `weakMargin(<15%)=${s.weakMargin.length}`,
    `avgMargin=${Math.round(s.avgMargin)}%`,
    `inventoryValueAtCost=€${s.inventoryValue.toFixed(0)}`,
    `retailValue=€${s.retailValue.toFixed(0)}`,
    `profitInStock=€${s.potentialProfit.toFixed(0)}`,
    `wasteExposure=€${s.wasteExposure.toFixed(0)}`,
  ].join(', ');

  const ranked = [...ctx.products].sort((a, b) => riskScore(b) - riskScore(a));
  const shown = ranked.slice(0, MAX_PRODUCTS_IN_CONTEXT);

  const productLines = shown
    .map((p) => {
      const d = daysUntil(p.expiry_date);
      const expiry = d === null ? 'n/a' : d < 0 ? `${Math.abs(d)}d ago` : `${d}d`;
      return `- ${p.name} | ${p.category || 'Uncategorized'} | stock ${num(
        p.stock_quantity
      )}/${num(p.min_stock_level)} | cost €${num(p.cost_price).toFixed(2)} | sell €${num(
        p.selling_price
      ).toFixed(2)} | margin ${margin(p.selling_price, p.cost_price)}% | expires ${expiry} | ${
        p.supplier_name || 'no supplier'
      } | risk ${riskScore(p)}%`;
    })
    .join('\n');

  const truncatedNote =
    ranked.length > shown.length
      ? `\n(Showing the ${shown.length} highest-risk of ${ranked.length} products.)`
      : '';

  const alertLines = ctx.alerts
    .slice(0, 12)
    .map((a) => `- [${a.severity || 'low'}] ${a.title}`)
    .join('\n');

  return [
    `STORE SUMMARY: ${summary}`,
    '',
    `PRODUCTS (name | category | stock/min | cost | sell | margin | expires | supplier | risk):`,
    productLines || '(none)',
    truncatedNote,
    '',
    alertLines ? `ACTIVE ALERTS:\n${alertLines}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

const SYSTEM_PROMPT = `You are RiskLens Copilot, an expert inventory and pricing analyst for the owner of a small food & drink market.

Rules:
- Answer in a warm, confident, concise voice — 2 to 5 sentences, plain language, no markdown headings or bullet symbols unless the user asks for a list.
- Be specific and practical: name actual products and give a clear recommended action.
- Currency is euros (€).
- CRITICAL: only use the data provided in the context. Never invent product names, prices, stock levels, suppliers, or figures. If the data does not contain the answer, say so plainly.
- "risk" is a 0–100 score combining expiry, stock and margin pressure. "health" is the overall store score.`;

/**
 * Ask GPT a question grounded in the live store data. Throws on network/API
 * failure so the caller can fall back to the on-device engine.
 */
export async function askOpenAI(
  question: string,
  ctx: CopilotContext,
  history: ChatTurn[] = [],
  language: 'en' | 'sq' = 'en'
): Promise<string> {
  const key = process.env.EXPO_PUBLIC_OPENAI_API_KEY;
  if (!key) throw new Error('No OpenAI key configured');

  const model = process.env.EXPO_PUBLIC_OPENAI_MODEL || 'gpt-4o-mini';
  const context = buildDataContext(ctx);

  const languageRule =
    language === 'sq'
      ? '\n\nIMPORTANT: Reply entirely in Albanian (Shqip), in natural, fluent Albanian.'
      : '';

  const messages = [
    { role: 'system', content: `${SYSTEM_PROMPT}${languageRule}\n\n=== LIVE STORE DATA ===\n${context}` },
    ...history.slice(-6),
    { role: 'user', content: question },
  ];

  const res = await fetch(OPENAI_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.3,
      max_tokens: 400,
      messages,
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`OpenAI request failed (${res.status}) ${detail}`.trim());
  }

  const json = await res.json();
  const text = json?.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error('OpenAI returned an empty response');
  return text;
}
