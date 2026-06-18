export const DEMO_ACCOUNT = {
  email: 'demo@risklens.app',
  password: 'RiskLensDemo!2026',
  company: 'RiskLens Demo Market',
};

const DEMO_USER_ID = 'demo-risklens-user';
const DEMO_SESSION_KEY = 'risklens.demo.session.v1';
const DEMO_DATA_KEY = 'risklens.demo.data.v3';

type DemoStore = Record<string, any[]>;
type AuthListener = (event: string, session: any | null) => void;

const listeners = new Set<AuthListener>();
const memoryStorage = new Map<string, string>();

function hasBrowserStorage() {
  return typeof window !== 'undefined' && !!window.localStorage;
}

function shouldResetDemoSession(key: string) {
  return (
    key === DEMO_SESSION_KEY &&
    typeof window !== 'undefined' &&
    window.location.search.includes('resetDemo=1')
  );
}

function shouldStartDemoSession() {
  return (
    typeof window !== 'undefined' &&
    window.location.search.includes('demo=1')
  );
}

function todayPlus(days: number) {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function hoursAgo(hours: number) {
  return new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
}

function demoUser() {
  return {
    id: DEMO_USER_ID,
    aud: 'authenticated',
    role: 'authenticated',
    email: DEMO_ACCOUNT.email,
    created_at: '2026-06-18T00:00:00.000Z',
    app_metadata: {},
    user_metadata: {
      company: DEMO_ACCOUNT.company,
      full_name: 'RiskLens Demo User',
    },
  };
}

function demoSession() {
  return {
    access_token: 'risklens-demo-access-token',
    refresh_token: 'risklens-demo-refresh-token',
    token_type: 'bearer',
    expires_in: 60 * 60 * 24,
    expires_at: Math.floor(Date.now() / 1000) + 60 * 60 * 24,
    user: demoUser(),
  };
}

function notify(event: string, session: any | null) {
  listeners.forEach((listener) => listener(event, session));
}

function readJson<T>(key: string): T | null {
  if (shouldResetDemoSession(key)) {
    memoryStorage.delete(key);

    if (hasBrowserStorage()) {
      try {
        window.localStorage.removeItem(key);
      } catch {
        // Ignore storage restrictions.
      }
    }

    return null;
  }

  let raw = memoryStorage.get(key) || null;

  if (hasBrowserStorage()) {
    try {
      raw = window.localStorage.getItem(key) || raw;
    } catch {
      raw = memoryStorage.get(key) || null;
    }
  }

  if (!raw) return null;

  try {
    return JSON.parse(raw) as T;
  } catch {
    window.localStorage.removeItem(key);
    return null;
  }
}

function writeJson(key: string, value: unknown) {
  const serialized = JSON.stringify(value);
  memoryStorage.set(key, serialized);

  if (!hasBrowserStorage()) return;

  try {
    window.localStorage.setItem(key, serialized);
  } catch {
    // The in-app browser can restrict storage in some contexts; memory keeps the demo usable.
  }
}

function removeKey(key: string) {
  memoryStorage.delete(key);

  if (!hasBrowserStorage()) return;

  try {
    window.localStorage.removeItem(key);
  } catch {
    // Ignore storage restrictions.
  }
}

export function isDemoCredentialPair(email: string, password: string) {
  return (
    email.trim().toLowerCase() === DEMO_ACCOUNT.email &&
    password === DEMO_ACCOUNT.password
  );
}

export function hasDemoSession() {
  return !!readJson(DEMO_SESSION_KEY);
}

function productRows(user_id: string) {
  return [
    {
      id: 'demo-product-greek-yogurt',
      user_id,
      name: 'Greek Yogurt 500g',
      category: 'Dairy',
      sku: 'DAI-GY-500',
      barcode: '100000000001',
      stock_quantity: 48,
      min_stock_level: 20,
      cost_price: 1.1,
      selling_price: 2.2,
      expiry_date: todayPlus(4),
      supplier_name: 'DairyFresh',
      status: 'active',
      created_at: hoursAgo(96),
    },
    {
      id: 'demo-product-chicken-wrap',
      user_id,
      name: 'Chicken Caesar Wrap',
      category: 'Ready Meals',
      sku: 'MEA-CW-001',
      barcode: '100000000002',
      stock_quantity: 9,
      min_stock_level: 15,
      cost_price: 2.4,
      selling_price: 4.5,
      expiry_date: todayPlus(2),
      supplier_name: 'FreshBite',
      status: 'active',
      created_at: hoursAgo(90),
    },
    {
      id: 'demo-product-sourdough',
      user_id,
      name: 'Artisan Sourdough Bread',
      category: 'Bakery',
      sku: 'BAK-AS-750',
      barcode: '100000000003',
      stock_quantity: 18,
      min_stock_level: 10,
      cost_price: 0.7,
      selling_price: 1.35,
      expiry_date: todayPlus(1),
      supplier_name: 'BakeHouse',
      status: 'active',
      created_at: hoursAgo(84),
    },
    {
      id: 'demo-product-orange-juice',
      user_id,
      name: 'Orange Juice 1L',
      category: 'Drinks',
      sku: 'DRI-OJ-1L',
      barcode: '100000000004',
      stock_quantity: 6,
      min_stock_level: 12,
      cost_price: 1,
      selling_price: 1.45,
      expiry_date: todayPlus(12),
      supplier_name: 'FruitCo',
      status: 'active',
      created_at: hoursAgo(78),
    },
    {
      id: 'demo-product-premium-cheese',
      user_id,
      name: 'Premium Aged Cheese',
      category: 'Dairy',
      sku: 'DAI-PC-250',
      barcode: '100000000005',
      stock_quantity: 3,
      min_stock_level: 8,
      cost_price: 4.3,
      selling_price: 7.8,
      expiry_date: todayPlus(35),
      supplier_name: 'DairyFresh',
      status: 'active',
      created_at: hoursAgo(72),
    },
    {
      id: 'demo-product-salad-bowl',
      user_id,
      name: 'Mediterranean Salad Bowl',
      category: 'Ready Meals',
      sku: 'MEA-SB-001',
      barcode: '100000000006',
      stock_quantity: 0,
      min_stock_level: 10,
      cost_price: 2.2,
      selling_price: 4,
      expiry_date: todayPlus(3),
      supplier_name: 'FreshBite',
      status: 'active',
      created_at: hoursAgo(66),
    },
    {
      id: 'demo-product-canned-beans',
      user_id,
      name: 'Canned Beans 400g',
      category: 'Pantry',
      sku: 'PAN-CB-400',
      barcode: '100000000007',
      stock_quantity: 120,
      min_stock_level: 30,
      cost_price: 0.65,
      selling_price: 1.1,
      expiry_date: todayPlus(220),
      supplier_name: 'PantryPro',
      status: 'active',
      created_at: hoursAgo(60),
    },
    {
      id: 'demo-product-chocolate-bar',
      user_id,
      name: 'Chocolate Bar 45g',
      category: 'Snacks',
      sku: 'SNA-CB-045',
      barcode: '100000000008',
      stock_quantity: 42,
      min_stock_level: 30,
      cost_price: 0.45,
      selling_price: 0.75,
      expiry_date: todayPlus(90),
      supplier_name: 'SweetLine',
      status: 'active',
      created_at: hoursAgo(54),
    },
    {
      id: 'demo-product-salmon',
      user_id,
      name: 'Fresh Salmon Fillet',
      category: 'Seafood',
      sku: 'SEA-SF-300',
      barcode: '100000000009',
      stock_quantity: 7,
      min_stock_level: 9,
      cost_price: 5.5,
      selling_price: 8.9,
      expiry_date: todayPlus(1),
      supplier_name: 'OceanPrime',
      status: 'active',
      created_at: hoursAgo(48),
    },
    {
      id: 'demo-product-sparkling-water',
      user_id,
      name: 'Sparkling Water 500ml',
      category: 'Drinks',
      sku: 'DRI-SW-500',
      barcode: '100000000010',
      stock_quantity: 80,
      min_stock_level: 25,
      cost_price: 0.25,
      selling_price: 0.7,
      expiry_date: todayPlus(180),
      supplier_name: 'AquaPure',
      status: 'active',
      created_at: hoursAgo(42),
    },
    {
      id: 'demo-product-eggs',
      user_id,
      name: 'Organic Eggs 12 Pack',
      category: 'Dairy',
      sku: 'DAI-EG-012',
      barcode: '100000000011',
      stock_quantity: 14,
      min_stock_level: 18,
      cost_price: 2.1,
      selling_price: 3.25,
      expiry_date: todayPlus(9),
      supplier_name: 'FarmNest',
      status: 'active',
      created_at: hoursAgo(36),
    },
    {
      id: 'demo-product-hummus',
      user_id,
      name: 'Classic Hummus Cup',
      category: 'Chilled',
      sku: 'CHI-HU-200',
      barcode: '100000000012',
      stock_quantity: 30,
      min_stock_level: 12,
      cost_price: 0.85,
      selling_price: 1.6,
      expiry_date: todayPlus(6),
      supplier_name: 'FreshBite',
      status: 'active',
      created_at: hoursAgo(30),
    },
  ];
}

function createDemoStore(): DemoStore {
  const user_id = DEMO_USER_ID;
  const products = productRows(user_id);
  const idFor = (name: string) => products.find((product) => product.name === name)?.id;

  const alerts = [
    {
      id: 'demo-alert-salad-stock',
      user_id,
      title: 'Mediterranean Salad Bowl is out of stock',
      description: 'Zero stock on a ready-meal item with active demand. Reorder or hide from shelves today.',
      severity: 'high',
      source_type: 'stock',
      source_product_id: idFor('Mediterranean Salad Bowl'),
      created_at: hoursAgo(2),
    },
    {
      id: 'demo-alert-salmon-expiry',
      user_id,
      title: 'Fresh Salmon Fillet expires tomorrow',
      description: 'High-value seafood has one day left. Discount or bundle immediately to reduce waste.',
      severity: 'high',
      source_type: 'expiry',
      source_product_id: idFor('Fresh Salmon Fillet'),
      created_at: hoursAgo(3),
    },
    {
      id: 'demo-alert-bread-expiry',
      user_id,
      title: 'Artisan Sourdough Bread needs clearance',
      description: 'Bakery stock expires tomorrow and should be moved with a controlled markdown.',
      severity: 'high',
      source_type: 'expiry',
      source_product_id: idFor('Artisan Sourdough Bread'),
      created_at: hoursAgo(5),
    },
    {
      id: 'demo-alert-juice-stock',
      user_id,
      title: 'Orange Juice 1L is below minimum stock',
      description: 'Current stock is 6 while the minimum level is 12. Replenishment is recommended.',
      severity: 'medium',
      source_type: 'stock',
      source_product_id: idFor('Orange Juice 1L'),
      created_at: hoursAgo(8),
    },
    {
      id: 'demo-alert-chocolate-margin',
      user_id,
      title: 'Chocolate Bar 45g has weak margin',
      description: 'Margin is below the preferred snack target. A small price review can protect profit.',
      severity: 'medium',
      source_type: 'pricing',
      source_product_id: idFor('Chocolate Bar 45g'),
      created_at: hoursAgo(10),
    },
    {
      id: 'demo-alert-freshbite-supplier',
      user_id,
      title: 'FreshBite supplier pressure is rising',
      description: 'FreshBite appears on multiple stock and expiry pressure items this week.',
      severity: 'medium',
      source_type: 'supplier',
      source_product_id: null,
      created_at: hoursAgo(12),
    },
    {
      id: 'demo-alert-yogurt-expiry',
      user_id,
      title: 'Greek Yogurt 500g is near expiry',
      description: 'There is still meaningful stock with 4 days to expiry. Consider a light promotion.',
      severity: 'medium',
      source_type: 'expiry',
      source_product_id: idFor('Greek Yogurt 500g'),
      created_at: hoursAgo(15),
    },
    {
      id: 'demo-alert-eggs-stock',
      user_id,
      title: 'Organic Eggs 12 Pack is below minimum level',
      description: 'Stock is slightly below the reorder point. Add to the next supplier order.',
      severity: 'low',
      source_type: 'stock',
      source_product_id: idFor('Organic Eggs 12 Pack'),
      created_at: hoursAgo(18),
    },
    {
      id: 'demo-alert-cheese-stock',
      user_id,
      title: 'Premium Aged Cheese has constrained stock',
      description: 'Only 3 units remain on a premium-margin item. Avoid unnecessary discounts.',
      severity: 'low',
      source_type: 'pricing',
      source_product_id: idFor('Premium Aged Cheese'),
      created_at: hoursAgo(21),
    },
    {
      id: 'demo-alert-hummus-expiry',
      user_id,
      title: 'Classic Hummus Cup enters expiry window',
      description: 'Stock is healthy but expiry is approaching within the week.',
      severity: 'low',
      source_type: 'expiry',
      source_product_id: idFor('Classic Hummus Cup'),
      created_at: hoursAgo(24),
    },
  ];

  const recommendations = [
    {
      id: 'demo-rec-salmon-discount',
      user_id,
      product_id: idFor('Fresh Salmon Fillet'),
      product_name: 'Fresh Salmon Fillet',
      recommendation_type: 'discount',
      message: 'Apply a 12-15% markdown today and feature it in the chilled section to prevent seafood waste.',
      impact_value: 280.35,
      created_at: hoursAgo(1),
    },
    {
      id: 'demo-rec-salad-restock',
      user_id,
      product_id: idFor('Mediterranean Salad Bowl'),
      product_name: 'Mediterranean Salad Bowl',
      recommendation_type: 'restock',
      message: 'Restock immediately or mark unavailable because demand-facing inventory is at zero.',
      impact_value: 640,
      created_at: hoursAgo(2),
    },
    {
      id: 'demo-rec-bread-price-down',
      user_id,
      product_id: idFor('Artisan Sourdough Bread'),
      product_name: 'Artisan Sourdough Bread',
      recommendation_type: 'price_down',
      message: 'Run an end-of-day bakery markdown to clear units before expiry.',
      impact_value: 88.2,
      created_at: hoursAgo(4),
    },
    {
      id: 'demo-rec-juice-restock',
      user_id,
      product_id: idFor('Orange Juice 1L'),
      product_name: 'Orange Juice 1L',
      recommendation_type: 'restock',
      message: 'Increase order quantity because stock is below minimum and margin is already tight.',
      impact_value: 348,
      created_at: hoursAgo(6),
    },
    {
      id: 'demo-rec-chocolate-price-up',
      user_id,
      product_id: idFor('Chocolate Bar 45g'),
      product_name: 'Chocolate Bar 45g',
      recommendation_type: 'price_up',
      message: 'Test a small price increase to recover weak snack margin without a large demand shock.',
      impact_value: 126,
      created_at: hoursAgo(7),
    },
    {
      id: 'demo-rec-yogurt-discount',
      user_id,
      product_id: idFor('Greek Yogurt 500g'),
      product_name: 'Greek Yogurt 500g',
      recommendation_type: 'discount',
      message: 'Use a light promotion to move dairy stock before expiry pressure becomes urgent.',
      impact_value: 211.2,
      created_at: hoursAgo(9),
    },
    {
      id: 'demo-rec-cheese-price-up',
      user_id,
      product_id: idFor('Premium Aged Cheese'),
      product_name: 'Premium Aged Cheese',
      recommendation_type: 'price_up',
      message: 'Protect premium margin while stock is constrained; avoid discounting this item.',
      impact_value: 93.6,
      created_at: hoursAgo(11),
    },
    {
      id: 'demo-rec-eggs-restock',
      user_id,
      product_id: idFor('Organic Eggs 12 Pack'),
      product_name: 'Organic Eggs 12 Pack',
      recommendation_type: 'restock',
      message: 'Add eggs to the next supplier order before weekend demand hits.',
      impact_value: 260,
      created_at: hoursAgo(13),
    },
    {
      id: 'demo-rec-hummus-discount',
      user_id,
      product_id: idFor('Classic Hummus Cup'),
      product_name: 'Classic Hummus Cup',
      recommendation_type: 'discount',
      message: 'Bundle with bakery products to improve chilled sell-through before expiry.',
      impact_value: 144,
      created_at: hoursAgo(16),
    },
  ];

  const pricing_runs = [
    {
      id: 'demo-run-draft',
      user_id,
      goal: 'balanced',
      max_change_percent: 10,
      aggressive_expiry_discounts: true,
      protect_premium_margins: true,
      increase_price_on_low_stock: true,
      safer_mode: true,
      notes: 'Demo draft: review seafood, bakery, and weak-margin snack pricing before applying.',
      total_products: products.length,
      generated_suggestions: 4,
      selected_suggestions: 3,
      estimated_total_impact: 1.47,
      status: 'draft',
      created_at: hoursAgo(20),
    },
    {
      id: 'demo-run-applied',
      user_id,
      goal: 'waste',
      max_change_percent: 12,
      aggressive_expiry_discounts: true,
      protect_premium_margins: true,
      increase_price_on_low_stock: false,
      safer_mode: true,
      notes: 'Applied demo run: moved dairy and pantry prices into safer ranges.',
      total_products: products.length,
      generated_suggestions: 3,
      selected_suggestions: 2,
      estimated_total_impact: 0.3,
      status: 'applied',
      created_at: hoursAgo(44),
    },
  ];

  const pricing_run_items = [
    {
      id: 'demo-run-item-salmon',
      run_id: 'demo-run-draft',
      user_id,
      product_id: idFor('Fresh Salmon Fillet'),
      product_name: 'Fresh Salmon Fillet',
      current_price: 8.9,
      suggested_price: 7.6,
      change_percent: -14.6,
      reason: 'Urgent expiry pressure on a high-value seafood item.',
      confidence: 94,
      expected_effect: 'Clear stock faster and reduce waste exposure.',
      action_type: 'discount',
      score: 96,
      was_selected: true,
      was_applied: false,
      created_at: hoursAgo(20),
    },
    {
      id: 'demo-run-item-bread',
      run_id: 'demo-run-draft',
      user_id,
      product_id: idFor('Artisan Sourdough Bread'),
      product_name: 'Artisan Sourdough Bread',
      current_price: 1.35,
      suggested_price: 1.15,
      change_percent: -14.8,
      reason: 'Bakery product expires tomorrow with enough stock to warrant markdown.',
      confidence: 89,
      expected_effect: 'Improve same-day sell-through.',
      action_type: 'discount',
      score: 86,
      was_selected: true,
      was_applied: false,
      created_at: hoursAgo(20),
    },
    {
      id: 'demo-run-item-chocolate',
      run_id: 'demo-run-draft',
      user_id,
      product_id: idFor('Chocolate Bar 45g'),
      product_name: 'Chocolate Bar 45g',
      current_price: 0.75,
      suggested_price: 0.82,
      change_percent: 9.3,
      reason: 'Weak margin with no expiry pressure supports a small price increase.',
      confidence: 73,
      expected_effect: 'Improve contribution margin on snack inventory.',
      action_type: 'price_up',
      score: 67,
      was_selected: true,
      was_applied: false,
      created_at: hoursAgo(20),
    },
    {
      id: 'demo-run-item-water',
      run_id: 'demo-run-draft',
      user_id,
      product_id: idFor('Sparkling Water 500ml'),
      product_name: 'Sparkling Water 500ml',
      current_price: 0.7,
      suggested_price: 0.7,
      change_percent: 0,
      reason: 'Healthy stock, strong margin, and distant expiry make current price acceptable.',
      confidence: 62,
      expected_effect: 'Avoid unnecessary volatility.',
      action_type: 'hold',
      score: 35,
      was_selected: false,
      was_applied: false,
      created_at: hoursAgo(20),
    },
    {
      id: 'demo-run-item-yogurt',
      run_id: 'demo-run-applied',
      user_id,
      product_id: idFor('Greek Yogurt 500g'),
      product_name: 'Greek Yogurt 500g',
      current_price: 2.4,
      suggested_price: 2.2,
      change_percent: -8.3,
      reason: 'Near-expiry dairy stock was discounted to protect sell-through.',
      confidence: 88,
      expected_effect: 'Reduced waste risk while preserving margin.',
      action_type: 'discount',
      score: 82,
      was_selected: true,
      was_applied: true,
      created_at: hoursAgo(44),
    },
    {
      id: 'demo-run-item-beans',
      run_id: 'demo-run-applied',
      user_id,
      product_id: idFor('Canned Beans 400g'),
      product_name: 'Canned Beans 400g',
      current_price: 1,
      suggested_price: 1.1,
      change_percent: 10,
      reason: 'Stable pantry item had room for a small price correction.',
      confidence: 70,
      expected_effect: 'Improved margin with low operational risk.',
      action_type: 'price_up',
      score: 58,
      was_selected: true,
      was_applied: true,
      created_at: hoursAgo(44),
    },
    {
      id: 'demo-run-item-water-applied',
      run_id: 'demo-run-applied',
      user_id,
      product_id: idFor('Sparkling Water 500ml'),
      product_name: 'Sparkling Water 500ml',
      current_price: 0.7,
      suggested_price: 0.7,
      change_percent: 0,
      reason: 'No immediate pressure detected.',
      confidence: 64,
      expected_effect: 'Keep price stable.',
      action_type: 'hold',
      score: 34,
      was_selected: false,
      was_applied: false,
      created_at: hoursAgo(44),
    },
  ];

  return {
    food_products: products,
    food_alerts: alerts,
    food_recommendations: recommendations,
    pricing_runs,
    pricing_run_items,
  };
}

function ensureDemoData(reset = false) {
  const existing = readJson<DemoStore>(DEMO_DATA_KEY);
  if (existing && !reset) return existing;

  const store = createDemoStore();
  writeJson(DEMO_DATA_KEY, store);
  return store;
}

function readStore() {
  return ensureDemoData(false);
}

function writeStore(store: DemoStore) {
  writeJson(DEMO_DATA_KEY, store);
}

function nextId(table: string) {
  return `demo-${table}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function projectRow(row: any, columns: string | null) {
  if (!columns || columns.trim() === '*') return { ...row };

  const result: Record<string, any> = {};
  columns
    .split(',')
    .map((column) => column.trim())
    .filter(Boolean)
    .forEach((column) => {
      const cleanColumn = column.split(':').pop()?.trim() || column;
      result[cleanColumn] = row[cleanColumn];
    });

  return result;
}

class DemoQueryBuilder implements PromiseLike<{ data: any; error: null }> {
  private operation: 'select' | 'insert' | 'update' | 'delete' = 'select';
  private selectedColumns: string | null = null;
  private rowsToInsert: any[] = [];
  private updatePayload: Record<string, any> = {};
  private filters: Array<{ column: string; value: any }> = [];
  private inFilters: Array<{ column: string; values: any[] }> = [];
  private orderBy: { column: string; ascending: boolean } | null = null;
  private maxRows: number | null = null;
  private singleMode: 'single' | 'maybeSingle' | null = null;

  constructor(private table: string) {}

  select(columns = '*') {
    this.selectedColumns = columns;
    return this;
  }

  insert(payload: any | any[]) {
    this.operation = 'insert';
    this.rowsToInsert = Array.isArray(payload) ? payload : [payload];
    return this;
  }

  update(payload: Record<string, any>) {
    this.operation = 'update';
    this.updatePayload = payload;
    return this;
  }

  delete() {
    this.operation = 'delete';
    return this;
  }

  eq(column: string, value: any) {
    this.filters.push({ column, value });
    return this;
  }

  in(column: string, values: any[]) {
    this.inFilters.push({ column, values });
    return this;
  }

  order(column: string, options?: { ascending?: boolean }) {
    this.orderBy = { column, ascending: options?.ascending ?? true };
    return this;
  }

  limit(count: number) {
    this.maxRows = count;
    return this;
  }

  single() {
    this.singleMode = 'single';
    return this;
  }

  maybeSingle() {
    this.singleMode = 'maybeSingle';
    return this;
  }

  then<TResult1 = { data: any; error: null }, TResult2 = never>(
    onfulfilled?: ((value: { data: any; error: null }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null
  ) {
    return this.execute().then(onfulfilled, onrejected);
  }

  private matches(row: any) {
    const eqMatches = this.filters.every((filter) => row[filter.column] === filter.value);
    const inMatches = this.inFilters.every((filter) => filter.values.includes(row[filter.column]));
    return eqMatches && inMatches;
  }

  private sortRows(rows: any[]) {
    if (!this.orderBy) return rows;

    const { column, ascending } = this.orderBy;
    return [...rows].sort((a, b) => {
      const left = a[column] ?? '';
      const right = b[column] ?? '';

      if (left === right) return 0;
      if (left > right) return ascending ? 1 : -1;
      return ascending ? -1 : 1;
    });
  }

  private formatRows(rows: any[]) {
    let nextRows = this.sortRows(rows);
    if (this.maxRows !== null) nextRows = nextRows.slice(0, this.maxRows);

    const projected = nextRows.map((row) => projectRow(row, this.selectedColumns));

    if (this.singleMode === 'single') {
      return projected[0] ?? null;
    }

    if (this.singleMode === 'maybeSingle') {
      return projected[0] ?? null;
    }

    return projected;
  }

  private async execute() {
    const store = readStore();
    const rows = store[this.table] || [];

    if (this.operation === 'insert') {
      const inserted = this.rowsToInsert.map((row) => ({
        id: row.id || nextId(this.table),
        created_at: row.created_at || new Date().toISOString(),
        ...row,
      }));

      store[this.table] = [...rows, ...inserted];
      writeStore(store);

      const data = this.selectedColumns ? this.formatRows(inserted) : null;
      return { data, error: null };
    }

    if (this.operation === 'update') {
      store[this.table] = rows.map((row) =>
        this.matches(row) ? { ...row, ...this.updatePayload } : row
      );
      writeStore(store);
      return { data: null, error: null };
    }

    if (this.operation === 'delete') {
      store[this.table] = rows.filter((row) => !this.matches(row));
      writeStore(store);
      return { data: null, error: null };
    }

    return {
      data: this.formatRows(rows.filter((row) => this.matches(row))),
      error: null,
    };
  }
}

export async function startDemoSession() {
  const session = demoSession();
  writeJson(DEMO_SESSION_KEY, session);
  ensureDemoData(true);
  notify('SIGNED_IN', session);
  return session;
}

export async function clearDemoSession() {
  removeKey(DEMO_SESSION_KEY);
  notify('SIGNED_OUT', null);
}

export function createDemoQuery(table: string) {
  ensureDemoData(false);
  return new DemoQueryBuilder(table);
}

export async function getDemoSession(): Promise<any | null> {
  if (shouldStartDemoSession()) {
    const existingSession = readJson<any>(DEMO_SESSION_KEY);
    if (existingSession) return existingSession;

    return startDemoSession();
  }

  return readJson<any>(DEMO_SESSION_KEY);
}

export function subscribeToDemoAuth(listener: AuthListener) {
  listeners.add(listener);

  const session = readJson(DEMO_SESSION_KEY);
  if (session) {
    setTimeout(() => listener('SIGNED_IN', session), 0);
  }

  return () => {
    listeners.delete(listener);
  };
}
