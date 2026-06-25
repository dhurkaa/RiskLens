/**
 * RiskLens Copilot — offline reasoning engine.
 *
 * This module turns natural-language questions into grounded, data-driven
 * answers about the user's live inventory. It runs entirely on-device, so the
 * Copilot works with zero backend and zero API keys. When a Groq key is
 * configured it can optionally enrich the narrative, but every answer here is
 * computed deterministically from the real product / alert / recommendation
 * data so the numbers are always trustworthy.
 */

export type CopilotProduct = {
  id: string;
  name: string;
  category?: string | null;
  stock_quantity?: number | null;
  min_stock_level?: number | null;
  selling_price?: number | null;
  cost_price?: number | null;
  expiry_date?: string | null;
  supplier_name?: string | null;
  status?: string | null;
};

export type CopilotAlert = {
  id: string;
  title: string;
  description?: string | null;
  severity?: 'low' | 'medium' | 'high' | null;
  source_type?: string | null;
};

export type CopilotRecommendation = {
  id: string;
  product_name: string;
  recommendation_type: 'discount' | 'restock' | 'price_up' | 'price_down';
  message: string;
  impact_value?: number | null;
};

export type CopilotContext = {
  products: CopilotProduct[];
  alerts: CopilotAlert[];
  recommendations: CopilotRecommendation[];
};

export type CardTone = 'red' | 'yellow' | 'green' | 'blue' | 'purple' | 'cyan';

export type CopilotListItem = {
  label: string;
  value?: string;
  sub?: string;
  tone?: CardTone;
};

export type CopilotCard =
  | {
      kind: 'metrics';
      metrics: { label: string; value: string; tone?: CardTone }[];
    }
  | {
      kind: 'list';
      title?: string;
      items: CopilotListItem[];
    }
  | {
      kind: 'gauge';
      title: string;
      score: number; // 0-100
      caption?: string;
    }
  | {
      kind: 'callout';
      tone: CardTone;
      icon?: string;
      title?: string;
      text: string;
    };

export type CopilotAction = {
  label: string;
  path: string;
  icon?: string;
};

export type CopilotAnswer = {
  text: string;
  cards?: CopilotCard[];
  suggestions?: string[];
  actions?: CopilotAction[];
};

/* ----------------------------- math helpers ----------------------------- */

function safeNumber(value?: number | null) {
  return Number(value || 0);
}

function formatCurrency(value?: number | null) {
  return `€${safeNumber(value).toFixed(2)}`;
}

function formatCompactCurrency(value?: number | null) {
  const n = safeNumber(value);
  if (n >= 1000000) return `€${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `€${(n / 1000).toFixed(1)}k`;
  return `€${n.toFixed(0)}`;
}

function marginPercent(selling?: number | null, cost?: number | null) {
  const s = safeNumber(selling);
  const c = safeNumber(cost);
  if (s <= 0) return 0;
  return ((s - c) / s) * 100;
}

export function daysUntil(dateString?: string | null) {
  if (!dateString) return null;
  const today = new Date();
  const target = new Date(dateString);
  if (Number.isNaN(target.getTime())) return null;
  today.setHours(0, 0, 0, 0);
  target.setHours(0, 0, 0, 0);
  const diff = target.getTime() - today.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

export function riskScore(item: CopilotProduct) {
  const stock = safeNumber(item.stock_quantity);
  const minStock = safeNumber(item.min_stock_level);
  const expiry = daysUntil(item.expiry_date);
  const margin = marginPercent(item.selling_price, item.cost_price);

  let score = 0;
  if (expiry !== null) {
    if (expiry < 0) score += 50;
    else if (expiry <= 2) score += 35;
    else if (expiry <= 5) score += 25;
    else if (expiry <= 7) score += 15;
  }
  if (minStock > 0 && stock <= minStock) score += 20;
  if (stock <= 0) score += 25;
  if (margin < 10) score += 15;
  else if (margin < 15) score += 8;

  return Math.min(100, score);
}

function isLowStock(p: CopilotProduct) {
  const stock = safeNumber(p.stock_quantity);
  const min = safeNumber(p.min_stock_level);
  return min > 0 ? stock <= min : stock <= 10;
}

function isNearExpiry(p: CopilotProduct, within = 7) {
  const d = daysUntil(p.expiry_date);
  return d !== null && d >= 0 && d <= within;
}

/* ----------------------------- analytics -------------------------------- */

export type CopilotStats = ReturnType<typeof computeStats>;

export function computeStats(ctx: CopilotContext) {
  const { products, alerts, recommendations } = ctx;
  const totalProducts = products.length;

  const lowStock = products.filter(isLowStock);
  const outOfStock = products.filter((p) => safeNumber(p.stock_quantity) <= 0);
  const nearExpiry = products.filter((p) => isNearExpiry(p, 7));
  const expired = products.filter((p) => {
    const d = daysUntil(p.expiry_date);
    return d !== null && d < 0;
  });
  const highRisk = products.filter((p) => riskScore(p) >= 70);
  const weakMargin = products.filter(
    (p) => marginPercent(p.selling_price, p.cost_price) < 15
  );

  const inventoryValue = products.reduce(
    (sum, p) => sum + safeNumber(p.stock_quantity) * safeNumber(p.cost_price),
    0
  );
  const retailValue = products.reduce(
    (sum, p) => sum + safeNumber(p.stock_quantity) * safeNumber(p.selling_price),
    0
  );
  const potentialProfit = retailValue - inventoryValue;

  const wasteExposure = products.reduce((sum, p) => {
    const d = daysUntil(p.expiry_date);
    if (d !== null && d >= 0 && d <= 5) {
      return sum + safeNumber(p.stock_quantity) * safeNumber(p.cost_price);
    }
    return sum;
  }, 0);

  const avgMargin =
    products.length > 0
      ? products.reduce(
          (sum, p) => sum + marginPercent(p.selling_price, p.cost_price),
          0
        ) / products.length
      : 0;

  const recommendationImpact = recommendations.reduce(
    (sum, r) => sum + safeNumber(r.impact_value),
    0
  );

  const highAlerts = alerts.filter((a) => a.severity === 'high').length;

  // Business health: starts at 100 and is penalised by pressure signals,
  // scaled by how big the catalogue is (so one bad item doesn't tank a store).
  const denom = Math.max(totalProducts, 1);
  let health = 100;
  health -= (expired.length / denom) * 60;
  health -= (outOfStock.length / denom) * 25;
  health -= (nearExpiry.length / denom) * 22;
  health -= (lowStock.length / denom) * 18;
  health -= (weakMargin.length / denom) * 15;
  if (avgMargin < 18) health -= (18 - avgMargin) * 1.2;
  const healthScore = Math.max(4, Math.min(100, Math.round(health)));

  return {
    totalProducts,
    lowStock,
    outOfStock,
    nearExpiry,
    expired,
    highRisk,
    weakMargin,
    inventoryValue,
    retailValue,
    potentialProfit,
    wasteExposure,
    avgMargin,
    recommendationImpact,
    highAlerts,
    healthScore,
  };
}

export function healthLabel(score: number) {
  if (score >= 80) return 'Healthy';
  if (score >= 60) return 'Stable';
  if (score >= 40) return 'Under pressure';
  if (score >= 20) return 'At risk';
  return 'Critical';
}

/* ------------------------ supplier / category rollups ------------------- */

function supplierRollup(products: CopilotProduct[]) {
  const map = new Map<
    string,
    {
      supplier: string;
      count: number;
      highRisk: number;
      lowStock: number;
      nearExpiry: number;
      value: number;
    }
  >();
  for (const p of products) {
    const supplier = p.supplier_name?.trim() || 'Unknown Supplier';
    const cur =
      map.get(supplier) || {
        supplier,
        count: 0,
        highRisk: 0,
        lowStock: 0,
        nearExpiry: 0,
        value: 0,
      };
    cur.count += 1;
    if (riskScore(p) >= 70) cur.highRisk += 1;
    if (isLowStock(p)) cur.lowStock += 1;
    if (isNearExpiry(p)) cur.nearExpiry += 1;
    cur.value += safeNumber(p.stock_quantity) * safeNumber(p.cost_price);
    map.set(supplier, cur);
  }
  return Array.from(map.values());
}

function categoryRollup(products: CopilotProduct[]) {
  const map = new Map<
    string,
    { category: string; count: number; risk: number; margin: number; value: number }
  >();
  for (const p of products) {
    const category = p.category?.trim() || 'Uncategorized';
    const cur =
      map.get(category) || { category, count: 0, risk: 0, margin: 0, value: 0 };
    cur.count += 1;
    cur.risk += riskScore(p);
    cur.margin += marginPercent(p.selling_price, p.cost_price);
    cur.value += safeNumber(p.stock_quantity) * safeNumber(p.cost_price);
    map.set(category, cur);
  }
  return Array.from(map.values()).map((c) => ({
    ...c,
    risk: c.count ? c.risk / c.count : 0,
    margin: c.count ? c.margin / c.count : 0,
  }));
}

/* --------------------------- product matching --------------------------- */

function findProduct(products: CopilotProduct[], query: string) {
  const q = query.toLowerCase();
  // Direct contains match on the longest name that appears in the question.
  let best: CopilotProduct | null = null;
  let bestLen = 0;
  for (const p of products) {
    const name = p.name.toLowerCase();
    if (q.includes(name) && name.length > bestLen) {
      best = p;
      bestLen = name.length;
    }
  }
  if (best) return best;

  // Token overlap fallback.
  const qTokens = new Set(q.split(/[^a-z0-9]+/).filter((t) => t.length > 2));
  let bestScore = 0;
  for (const p of products) {
    const tokens = p.name.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
    const overlap = tokens.filter((t) => qTokens.has(t)).length;
    if (overlap > bestScore) {
      bestScore = overlap;
      best = p;
    }
  }
  return bestScore >= 1 ? best : null;
}

/* ----------------------------- formatting ------------------------------- */

const DEFAULT_SUGGESTIONS = [
  "What's expiring soon?",
  'What should I restock?',
  'Which products have weak margins?',
  'How healthy is my business?',
];

function productLine(p: CopilotProduct): CopilotListItem {
  const d = daysUntil(p.expiry_date);
  const stock = safeNumber(p.stock_quantity);
  const risk = riskScore(p);
  const tone: CardTone = risk >= 70 ? 'red' : risk >= 40 ? 'yellow' : 'green';
  const expiryText = d === null ? 'no date' : d < 0 ? `${Math.abs(d)}d expired` : `${d}d left`;
  return {
    label: p.name,
    value: `${risk}% risk`,
    sub: `${stock} in stock • ${expiryText} • ${p.supplier_name || 'no supplier'}`,
    tone,
  };
}

/* ------------------------------- intents -------------------------------- */

type Intent =
  | 'greeting'
  | 'help'
  | 'health'
  | 'summary'
  | 'expiry'
  | 'restock'
  | 'margin'
  | 'risk'
  | 'supplier'
  | 'value'
  | 'topValue'
  | 'recommendations'
  | 'alerts'
  | 'category'
  | 'product'
  | 'thanks'
  | 'unknown';

function detectIntent(q: string, ctx: CopilotContext): Intent {
  const t = q.toLowerCase().trim();

  if (/^(hi|hey|hello|yo|good (morning|afternoon|evening))\b/.test(t)) return 'greeting';
  if (/(thank|thanks|cheers|appreciate)/.test(t)) return 'thanks';
  if (/(what can you|who are you|how do you work|help|what do you do|capabilities)/.test(t))
    return 'help';

  if (/(health|how('?s| is) (my|the) (business|store|shop)|overall|doing|score)/.test(t))
    return 'health';
  if (/(summary|overview|snapshot|brief|how are things|status|recap)/.test(t)) return 'summary';

  if (/(expir|expiry|going off|going bad|waste|spoil|fresh|shelf life|use by)/.test(t))
    return 'expiry';
  if (/(restock|reorder|low stock|out of stock|run out|replenish|order more|need more)/.test(t))
    return 'restock';
  if (/(margin|profit|markup|pricing|price up|cheap|underpriced|weak margin|increase price)/.test(t))
    return 'margin';
  if (/(supplier|vendor|distributor)/.test(t)) return 'supplier';
  if (/(inventory value|stock worth|how much.*(stock|inventory)|total value|capital)/.test(t))
    return 'value';
  if (/(most valuable|top value|biggest|most stock|highest value)/.test(t)) return 'topValue';
  if (/(recommend|suggest|what should i do|next (step|action|move)|advice|action)/.test(t))
    return 'recommendations';
  if (/(alert|problem|issue|warning|wrong|worry|attention)/.test(t)) return 'alerts';
  if (/(risk|risky|dangerous|critical|urgent|priorit)/.test(t)) return 'risk';
  if (/(categor|department|section|product group)/.test(t)) return 'category';

  // Product lookup last (only if a product name is detected).
  if (findProduct(ctx.products, t)) return 'product';

  return 'unknown';
}

/* --------------------------- answer builders ---------------------------- */

function emptyAnswer(): CopilotAnswer {
  return {
    text:
      "I don't see any products yet, so there's nothing to analyze. Upload a CSV of your inventory and I'll instantly surface expiry risks, restock needs, margin gaps, and the next best actions for your store.",
    actions: [{ label: 'Upload CSV', path: '/(tabs)/upload', icon: 'cloud-upload-outline' }],
    suggestions: ['What can you do?'],
  };
}

export function answerQuestion(rawQuestion: string, ctx: CopilotContext): CopilotAnswer {
  const question = rawQuestion.trim();
  const stats = computeStats(ctx);

  if (ctx.products.length === 0 && !/what can you|help|who are you/i.test(question)) {
    return emptyAnswer();
  }

  const intent = detectIntent(question, ctx);

  switch (intent) {
    case 'greeting':
      return {
        text: `Hi! I'm your RiskLens Copilot. I've already scanned your ${stats.totalProducts} products. Right now your business health is ${stats.healthScore}/100 (${healthLabel(
          stats.healthScore
        )}). Ask me anything — for example, what's expiring, what to restock, or where your margins are leaking.`,
        cards: [
          {
            kind: 'gauge',
            title: 'Business health',
            score: stats.healthScore,
            caption: healthLabel(stats.healthScore),
          },
        ],
        suggestions: DEFAULT_SUGGESTIONS,
      };

    case 'thanks':
      return {
        text: "Anytime. I'm watching your inventory in real time — ask me whenever you want the next move.",
        suggestions: DEFAULT_SUGGESTIONS,
      };

    case 'help':
      return {
        text: "I'm an on-device analyst for your store. I read your live products, alerts, and recommendations and answer in plain language — no spreadsheets required. Try any of these:",
        cards: [
          {
            kind: 'list',
            title: 'Things you can ask',
            items: [
              { label: 'What’s expiring soon?', sub: 'Expiry & waste exposure', tone: 'red' },
              { label: 'What should I restock?', sub: 'Low & out-of-stock items', tone: 'yellow' },
              { label: 'Where are my weak margins?', sub: 'Pricing opportunities', tone: 'blue' },
              { label: 'Which supplier is riskiest?', sub: 'Supplier pressure', tone: 'purple' },
              { label: 'How healthy is my business?', sub: 'Single health score', tone: 'green' },
              { label: 'Tell me about <product>', sub: 'Deep-dive any item', tone: 'cyan' },
            ],
          },
        ],
        suggestions: DEFAULT_SUGGESTIONS,
      };

    case 'health':
      return buildHealth(stats);
    case 'summary':
      return buildSummary(stats, ctx);
    case 'expiry':
      return buildExpiry(stats, ctx);
    case 'restock':
      return buildRestock(stats);
    case 'margin':
      return buildMargin(stats, ctx);
    case 'risk':
      return buildRisk(stats);
    case 'supplier':
      return buildSupplier(ctx);
    case 'value':
      return buildValue(stats);
    case 'topValue':
      return buildTopValue(ctx);
    case 'recommendations':
      return buildRecommendations(stats, ctx);
    case 'alerts':
      return buildAlerts(ctx);
    case 'category':
      return buildCategory(ctx);
    case 'product':
      return buildProduct(question, ctx);
    default:
      return buildSummary(stats, ctx, true);
  }
}

function buildHealth(stats: CopilotStats): CopilotAnswer {
  const drivers: string[] = [];
  if (stats.expired.length) drivers.push(`${stats.expired.length} expired`);
  if (stats.outOfStock.length) drivers.push(`${stats.outOfStock.length} out of stock`);
  if (stats.nearExpiry.length) drivers.push(`${stats.nearExpiry.length} near expiry`);
  if (stats.lowStock.length) drivers.push(`${stats.lowStock.length} low stock`);
  if (stats.weakMargin.length) drivers.push(`${stats.weakMargin.length} weak margin`);

  const verdict =
    stats.healthScore >= 80
      ? 'Your store is in good shape — keep an eye on the few pressure points below.'
      : stats.healthScore >= 60
      ? 'Things are stable, but a handful of items are dragging the score down.'
      : stats.healthScore >= 40
      ? 'Your store is under real pressure. Clearing the items below would lift the score quickly.'
      : 'This needs attention today — several items are actively losing you money.';

  return {
    text: `Your business health score is ${stats.healthScore}/100 — ${healthLabel(
      stats.healthScore
    )}. ${verdict}${drivers.length ? ` Main drivers: ${drivers.join(', ')}.` : ''}`,
    cards: [
      { kind: 'gauge', title: 'Business health', score: stats.healthScore, caption: healthLabel(stats.healthScore) },
      {
        kind: 'metrics',
        metrics: [
          { label: 'Avg margin', value: `${Math.round(stats.avgMargin)}%`, tone: stats.avgMargin < 18 ? 'yellow' : 'green' },
          { label: 'Waste exposure', value: formatCompactCurrency(stats.wasteExposure), tone: stats.wasteExposure > 0 ? 'red' : 'green' },
          { label: 'High risk', value: `${stats.highRisk.length}`, tone: stats.highRisk.length ? 'red' : 'green' },
        ],
      },
    ],
    actions: [{ label: 'Open Decision Center', path: '/(tabs)/decision-center', icon: 'flash-outline' }],
    suggestions: ['What’s dragging my score down?', "What's expiring soon?", 'What should I restock?'],
  };
}

function buildSummary(stats: CopilotStats, ctx: CopilotContext, fallback = false): CopilotAnswer {
  const intro = fallback
    ? "I'm not 100% sure what you meant, so here's the headline view of your store. You can also tap a suggestion below."
    : `Here's the snapshot of your store across ${stats.totalProducts} products.`;

  return {
    text: `${intro} Inventory is worth ${formatCompactCurrency(
      stats.inventoryValue
    )} at cost with ${formatCompactCurrency(
      stats.potentialProfit
    )} of profit locked inside it. Health is ${stats.healthScore}/100 (${healthLabel(stats.healthScore)}).`,
    cards: [
      {
        kind: 'metrics',
        metrics: [
          { label: 'Products', value: `${stats.totalProducts}`, tone: 'blue' },
          { label: 'Near expiry', value: `${stats.nearExpiry.length}`, tone: stats.nearExpiry.length ? 'red' : 'green' },
          { label: 'Low stock', value: `${stats.lowStock.length}`, tone: stats.lowStock.length ? 'yellow' : 'green' },
          { label: 'Weak margin', value: `${stats.weakMargin.length}`, tone: stats.weakMargin.length ? 'purple' : 'green' },
          { label: 'Inventory value', value: formatCompactCurrency(stats.inventoryValue), tone: 'cyan' },
          { label: 'Health', value: `${stats.healthScore}`, tone: stats.healthScore >= 60 ? 'green' : 'yellow' },
        ],
      },
    ],
    actions: [{ label: 'Open dashboard', path: '/(tabs)', icon: 'grid-outline' }],
    suggestions: DEFAULT_SUGGESTIONS,
  };
}

function buildExpiry(stats: CopilotStats, ctx: CopilotContext): CopilotAnswer {
  const urgent = [...ctx.products]
    .filter((p) => {
      const d = daysUntil(p.expiry_date);
      return d !== null && d <= 7;
    })
    .sort((a, b) => (daysUntil(a.expiry_date) ?? 99) - (daysUntil(b.expiry_date) ?? 99));

  if (urgent.length === 0) {
    return {
      text: 'Good news — nothing is within the 7-day expiry window right now, so waste pressure is low. I’ll flag items the moment they cross into the danger zone.',
      cards: [{ kind: 'callout', tone: 'green', icon: 'checkmark-circle-outline', text: 'No products expiring within 7 days.' }],
      suggestions: ['What should I restock?', 'Where are my weak margins?', 'How healthy is my business?'],
    };
  }

  const items = urgent.slice(0, 6).map(productLine);
  return {
    text: `${urgent.length} product${urgent.length === 1 ? '' : 's'} ${
      urgent.length === 1 ? 'is' : 'are'
    } within 7 days of expiry, carrying about ${formatCompactCurrency(
      stats.wasteExposure
    )} of waste exposure at cost. I'd discount or bundle the items below today, starting from the top.`,
    cards: [
      { kind: 'list', title: 'Expiring first', items },
      {
        kind: 'metrics',
        metrics: [
          { label: 'Within 7 days', value: `${stats.nearExpiry.length}`, tone: 'yellow' },
          { label: 'Already expired', value: `${stats.expired.length}`, tone: stats.expired.length ? 'red' : 'green' },
          { label: 'Waste at risk', value: formatCompactCurrency(stats.wasteExposure), tone: 'red' },
        ],
      },
    ],
    actions: [
      { label: 'Open Waste & Expiry', path: '/(tabs)/waste-expiry', icon: 'time-outline' },
      { label: 'Run AI Pricing', path: '/(tabs)/ai-pricing-lab', icon: 'sparkles-outline' },
    ],
    suggestions: ['Run AI pricing to clear these', 'What should I restock?'],
  };
}

function buildRestock(stats: CopilotStats): CopilotAnswer {
  const need = [...stats.lowStock].sort(
    (a, b) => safeNumber(a.stock_quantity) - safeNumber(b.stock_quantity)
  );

  if (need.length === 0) {
    return {
      text: 'Stock levels look healthy — nothing is below its minimum threshold right now. No restock is needed today.',
      cards: [{ kind: 'callout', tone: 'green', icon: 'checkmark-circle-outline', text: 'All products are above their minimum stock level.' }],
      suggestions: ["What's expiring soon?", 'Where are my weak margins?'],
    };
  }

  const items = need.slice(0, 6).map((p) => {
    const stock = safeNumber(p.stock_quantity);
    const min = safeNumber(p.min_stock_level);
    const out = stock <= 0;
    return {
      label: p.name,
      value: out ? 'OUT' : `${stock}/${min}`,
      sub: `${p.supplier_name || 'no supplier'} • min ${min}`,
      tone: (out ? 'red' : 'yellow') as CardTone,
    };
  });

  return {
    text: `${need.length} product${need.length === 1 ? '' : 's'} ${
      need.length === 1 ? 'is' : 'are'
    } at or below the reorder point${
      stats.outOfStock.length ? `, and ${stats.outOfStock.length} ${stats.outOfStock.length === 1 ? 'is' : 'are'} completely out of stock` : ''
    }. Prioritise the out-of-stock items first — those are active lost sales.`,
    cards: [{ kind: 'list', title: 'Reorder priority', items }],
    actions: [{ label: 'View products', path: '/(tabs)/products', icon: 'basket-outline' }],
    suggestions: ['Which supplier is riskiest?', "What's expiring soon?"],
  };
}

function buildMargin(stats: CopilotStats, ctx: CopilotContext): CopilotAnswer {
  const weak = [...ctx.products]
    .filter((p) => safeNumber(p.selling_price) > 0)
    .map((p) => ({ p, margin: marginPercent(p.selling_price, p.cost_price) }))
    .sort((a, b) => a.margin - b.margin)
    .slice(0, 6);

  const items = weak.map(({ p, margin }) => ({
    label: p.name,
    value: `${Math.round(margin)}%`,
    sub: `${formatCurrency(p.cost_price)} → ${formatCurrency(p.selling_price)}`,
    tone: (margin < 10 ? 'red' : margin < 18 ? 'yellow' : 'green') as CardTone,
  }));

  return {
    text: `Your average margin across the catalogue is ${Math.round(
      stats.avgMargin
    )}%. ${stats.weakMargin.length} product${stats.weakMargin.length === 1 ? '' : 's'} sit below the 15% healthy line. The thinnest margins are below — these are the best candidates for a small price review or supplier renegotiation.`,
    cards: [
      { kind: 'list', title: 'Thinnest margins', items },
      {
        kind: 'metrics',
        metrics: [
          { label: 'Avg margin', value: `${Math.round(stats.avgMargin)}%`, tone: stats.avgMargin < 18 ? 'yellow' : 'green' },
          { label: 'Below 15%', value: `${stats.weakMargin.length}`, tone: stats.weakMargin.length ? 'red' : 'green' },
          { label: 'Profit in stock', value: formatCompactCurrency(stats.potentialProfit), tone: 'cyan' },
        ],
      },
    ],
    actions: [{ label: 'Open AI Pricing Lab', path: '/(tabs)/ai-pricing-lab', icon: 'sparkles-outline' }],
    suggestions: ['Run AI pricing', 'How healthy is my business?'],
  };
}

function buildRisk(stats: CopilotStats): CopilotAnswer {
  const ranked = [...stats.highRisk.length ? stats.highRisk : []];
  const top = (ranked.length ? ranked : [])
    .sort((a, b) => riskScore(b) - riskScore(a))
    .slice(0, 6)
    .map(productLine);

  if (top.length === 0) {
    // No high-risk; still show the riskiest few for context.
    return {
      text: 'No products are in the high-risk band (70%+) right now. That means there’s no urgent fire to fight — focus on margin and restock instead.',
      cards: [{ kind: 'callout', tone: 'green', icon: 'shield-checkmark-outline', text: 'No high-risk products detected.' }],
      suggestions: ['What should I restock?', 'Where are my weak margins?'],
    };
  }

  return {
    text: `${stats.highRisk.length} product${stats.highRisk.length === 1 ? '' : 's'} ${
      stats.highRisk.length === 1 ? 'is' : 'are'
    } high risk (70%+), combining expiry, stock, and margin pressure. Work the list below from the top — clearing these has the biggest stabilising effect on your store.`,
    cards: [{ kind: 'list', title: 'Highest risk first', items: top }],
    actions: [{ label: 'Open Decision Center', path: '/(tabs)/decision-center', icon: 'flash-outline' }],
    suggestions: ["What's expiring soon?", 'What should I restock?'],
  };
}

function buildSupplier(ctx: CopilotContext): CopilotAnswer {
  const rollup = supplierRollup(ctx.products).sort(
    (a, b) => b.highRisk - a.highRisk || b.nearExpiry + b.lowStock - (a.nearExpiry + a.lowStock)
  );

  if (rollup.length === 0) return emptyAnswer();

  const items = rollup.slice(0, 6).map((s) => ({
    label: s.supplier,
    value: `${s.highRisk} risk`,
    sub: `${s.count} products • ${s.lowStock} low • ${s.nearExpiry} expiring • ${formatCompactCurrency(s.value)}`,
    tone: (s.highRisk >= 2 ? 'red' : s.highRisk === 1 ? 'yellow' : 'green') as CardTone,
  }));

  const worst = rollup[0];
  return {
    text: `${worst.supplier} is carrying the most pressure right now — ${worst.highRisk} high-risk item${
      worst.highRisk === 1 ? '' : 's'
    }, ${worst.lowStock} low on stock and ${worst.nearExpiry} near expiry across ${worst.count} product${
      worst.count === 1 ? '' : 's'
    }. Here's how every supplier compares.`,
    cards: [{ kind: 'list', title: 'Supplier pressure', items }],
    actions: [{ label: 'Supplier Performance', path: '/(tabs)/supplier-performance', icon: 'business-outline' }],
    suggestions: ['What should I restock?', "What's expiring soon?"],
  };
}

function buildValue(stats: CopilotStats): CopilotAnswer {
  return {
    text: `You're holding ${formatCurrency(
      stats.inventoryValue
    )} of inventory at cost across ${stats.totalProducts} products. At current shelf prices that stock would sell for ${formatCurrency(
      stats.retailValue
    )}, meaning roughly ${formatCurrency(
      stats.potentialProfit
    )} of profit is locked in the shelves at ${Math.round(stats.avgMargin)}% average margin. About ${formatCompactCurrency(
      stats.wasteExposure
    )} of that cost is exposed to near-term expiry.`,
    cards: [
      {
        kind: 'metrics',
        metrics: [
          { label: 'At cost', value: formatCompactCurrency(stats.inventoryValue), tone: 'blue' },
          { label: 'At retail', value: formatCompactCurrency(stats.retailValue), tone: 'cyan' },
          { label: 'Profit in stock', value: formatCompactCurrency(stats.potentialProfit), tone: 'green' },
          { label: 'Waste exposure', value: formatCompactCurrency(stats.wasteExposure), tone: stats.wasteExposure ? 'red' : 'green' },
        ],
      },
    ],
    suggestions: ['What are my most valuable products?', "What's expiring soon?"],
  };
}

function buildTopValue(ctx: CopilotContext): CopilotAnswer {
  const ranked = [...ctx.products]
    .map((p) => ({ p, value: safeNumber(p.stock_quantity) * safeNumber(p.cost_price) }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 6);

  const items = ranked.map(({ p, value }) => ({
    label: p.name,
    value: formatCompactCurrency(value),
    sub: `${safeNumber(p.stock_quantity)} units • ${formatCurrency(p.cost_price)} cost`,
    tone: 'cyan' as CardTone,
  }));

  return {
    text: 'These products are tying up the most capital at cost. Keep them moving — overstocking here is where cash gets trapped, and waste hits hardest if any are perishable.',
    cards: [{ kind: 'list', title: 'Most capital tied up', items }],
    suggestions: ['How much is my inventory worth?', "What's expiring soon?"],
  };
}

function buildRecommendations(stats: CopilotStats, ctx: CopilotContext): CopilotAnswer {
  const top = [...ctx.recommendations]
    .sort((a, b) => safeNumber(b.impact_value) - safeNumber(a.impact_value))
    .slice(0, 5);

  if (top.length === 0) {
    // Synthesize advice from the data even with no stored recommendations.
    const moves: CopilotListItem[] = [];
    if (stats.expired.length)
      moves.push({ label: `Pull ${stats.expired.length} expired item(s)`, sub: 'Remove from shelves now', tone: 'red' });
    if (stats.nearExpiry.length)
      moves.push({ label: `Discount ${stats.nearExpiry.length} near-expiry item(s)`, sub: `${formatCompactCurrency(stats.wasteExposure)} at risk`, tone: 'yellow' });
    if (stats.outOfStock.length)
      moves.push({ label: `Reorder ${stats.outOfStock.length} out-of-stock item(s)`, sub: 'Active lost sales', tone: 'red' });
    if (stats.weakMargin.length)
      moves.push({ label: `Review ${stats.weakMargin.length} weak-margin price(s)`, sub: 'Below 15% margin', tone: 'blue' });
    if (moves.length === 0)
      moves.push({ label: 'Hold steady', sub: 'No urgent actions detected', tone: 'green' });

    return {
      text: 'Based on your live data, here are the highest-leverage moves right now, ordered by urgency:',
      cards: [{ kind: 'list', title: 'Next best actions', items: moves }],
      actions: [{ label: 'Decision Center', path: '/(tabs)/decision-center', icon: 'flash-outline' }],
      suggestions: ['Run AI pricing', "What's expiring soon?"],
    };
  }

  const items = top.map((r) => ({
    label: r.product_name,
    value: formatCompactCurrency(r.impact_value),
    sub: r.message,
    tone: (r.recommendation_type === 'restock'
      ? 'yellow'
      : r.recommendation_type === 'price_up'
      ? 'green'
      : 'blue') as CardTone,
  }));

  return {
    text: `Your highest-impact opportunities add up to about ${formatCompactCurrency(
      stats.recommendationImpact
    )}. Here are the top ${top.length} ranked by estimated value.`,
    cards: [{ kind: 'list', title: 'Top opportunities', items }],
    actions: [{ label: 'Recommendations', path: '/(tabs)/recommendations-center', icon: 'sparkles-outline' }],
    suggestions: ['Run AI pricing', 'How healthy is my business?'],
  };
}

function buildAlerts(ctx: CopilotContext): CopilotAnswer {
  if (ctx.alerts.length === 0) {
    return {
      text: 'There are no active alerts right now — nothing in your inventory has tripped a warning. I’ll surface issues here the moment they appear.',
      cards: [{ kind: 'callout', tone: 'green', icon: 'checkmark-circle-outline', text: 'No active alerts.' }],
      suggestions: ['How healthy is my business?', 'What should I restock?'],
    };
  }

  const order = { high: 0, medium: 1, low: 2 } as const;
  const sorted = [...ctx.alerts].sort(
    (a, b) => (order[a.severity || 'low'] ?? 3) - (order[b.severity || 'low'] ?? 3)
  );
  const items = sorted.slice(0, 6).map((a) => ({
    label: a.title,
    value: (a.severity || 'low').toUpperCase(),
    sub: a.description || a.source_type || 'system',
    tone: (a.severity === 'high' ? 'red' : a.severity === 'medium' ? 'yellow' : 'blue') as CardTone,
  }));

  const high = ctx.alerts.filter((a) => a.severity === 'high').length;
  return {
    text: `You have ${ctx.alerts.length} active alert${ctx.alerts.length === 1 ? '' : 's'}${
      high ? `, including ${high} high-severity` : ''
    }. Sorted by urgency:`,
    cards: [{ kind: 'list', title: 'Active alerts', items }],
    actions: [{ label: 'Alerts Center', path: '/(tabs)/alerts-center', icon: 'notifications-outline' }],
    suggestions: ['What should I do next?', "What's expiring soon?"],
  };
}

function buildCategory(ctx: CopilotContext): CopilotAnswer {
  const rollup = categoryRollup(ctx.products).sort((a, b) => b.risk - a.risk);
  if (rollup.length === 0) return emptyAnswer();

  const items = rollup.slice(0, 6).map((c) => ({
    label: c.category,
    value: `${Math.round(c.risk)}% risk`,
    sub: `${c.count} products • ${Math.round(c.margin)}% margin • ${formatCompactCurrency(c.value)}`,
    tone: (c.risk >= 50 ? 'red' : c.risk >= 25 ? 'yellow' : 'green') as CardTone,
  }));

  return {
    text: `${rollup[0].category} is your highest-pressure category at ${Math.round(
      rollup[0].risk
    )}% average risk. Here's how every category compares on risk, margin, and capital tied up.`,
    cards: [{ kind: 'list', title: 'Category pressure', items }],
    actions: [{ label: 'Open Insights', path: '/(tabs)/explore', icon: 'analytics-outline' }],
    suggestions: ['Which supplier is riskiest?', 'Where are my weak margins?'],
  };
}

function buildProduct(question: string, ctx: CopilotContext): CopilotAnswer {
  const p = findProduct(ctx.products, question.toLowerCase());
  if (!p) return buildSummary(computeStats(ctx), ctx, true);

  const stock = safeNumber(p.stock_quantity);
  const min = safeNumber(p.min_stock_level);
  const margin = marginPercent(p.selling_price, p.cost_price);
  const d = daysUntil(p.expiry_date);
  const risk = riskScore(p);
  const value = stock * safeNumber(p.cost_price);

  const flags: string[] = [];
  if (d !== null && d < 0) flags.push('already expired');
  else if (d !== null && d <= 2) flags.push('within 2 days of expiry');
  else if (d !== null && d <= 7) flags.push('close to expiry');
  if (stock <= 0) flags.push('out of stock');
  else if (isLowStock(p)) flags.push('below its reorder point');
  if (margin < 15) flags.push('on a thin margin');

  const verdict = flags.length
    ? `Watch this one — it's ${flags.join(', ')}.`
    : 'This item looks healthy on every signal.';

  return {
    text: `${p.name} (${p.category || 'Uncategorized'}, supplied by ${
      p.supplier_name || 'an unknown supplier'
    }) has a risk score of ${risk}%. ${verdict}`,
    cards: [
      {
        kind: 'metrics',
        metrics: [
          { label: 'Stock', value: `${stock}/${min}`, tone: isLowStock(p) ? 'yellow' : 'green' },
          { label: 'Expiry', value: d === null ? '—' : d < 0 ? `${Math.abs(d)}d ago` : `${d}d`, tone: d !== null && d <= 7 ? 'red' : 'green' },
          { label: 'Margin', value: `${Math.round(margin)}%`, tone: margin < 15 ? 'red' : 'green' },
          { label: 'Price', value: formatCurrency(p.selling_price), tone: 'blue' },
          { label: 'Stock value', value: formatCompactCurrency(value), tone: 'cyan' },
          { label: 'Risk', value: `${risk}%`, tone: risk >= 70 ? 'red' : risk >= 40 ? 'yellow' : 'green' },
        ],
      },
    ],
    suggestions: ["What's expiring soon?", 'What should I restock?', 'How healthy is my business?'],
  };
}

/* ---------------------- optional Groq enrichment ------------------------ */

export function hasGroqKey() {
  return !!process.env.EXPO_PUBLIC_GROQ_API_KEY;
}

/**
 * Optional: ask Groq to rewrite the grounded answer in a warmer, more
 * conversational tone. Falls back silently to the local text on any failure,
 * so the Copilot is never blocked on the network. The numbers always come from
 * the local engine — Groq only ever touches the prose.
 */
export async function enrichWithGroq(
  question: string,
  baseAnswer: CopilotAnswer,
  ctx: CopilotContext
): Promise<string> {
  const key = process.env.EXPO_PUBLIC_GROQ_API_KEY;
  if (!key) return baseAnswer.text;

  const stats = computeStats(ctx);
  const facts = [
    `products=${stats.totalProducts}`,
    `health=${stats.healthScore}`,
    `nearExpiry=${stats.nearExpiry.length}`,
    `lowStock=${stats.lowStock.length}`,
    `weakMargin=${stats.weakMargin.length}`,
    `avgMargin=${Math.round(stats.avgMargin)}%`,
    `wasteExposure=${stats.wasteExposure.toFixed(0)}`,
  ].join(', ');

  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        temperature: 0.4,
        max_tokens: 220,
        messages: [
          {
            role: 'system',
            content:
              'You are the RiskLens Copilot for a small food retailer. Rewrite the provided analysis in a warm, concise, confident voice (max 4 sentences). Never invent numbers — only use the facts and the draft provided.',
          },
          {
            role: 'user',
            content: `Question: ${question}\nFacts: ${facts}\nDraft answer: ${baseAnswer.text}`,
          },
        ],
      }),
    });
    if (!res.ok) return baseAnswer.text;
    const json = await res.json();
    const text = json?.choices?.[0]?.message?.content?.trim();
    return text || baseAnswer.text;
  } catch {
    return baseAnswer.text;
  }
}
