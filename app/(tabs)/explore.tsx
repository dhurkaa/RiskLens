import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  type DimensionValue,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialCommunityIcons, Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { supabase } from '../../lib/supabase';
import AppSidebar from '../../components/appsidebar';

const palette = {
  bg: '#F5F7F3',
  surface: '#FFFFFF',
  surfaceSoft: '#EEF3EC',
  surfaceSoft2: '#E6EEE5',
  border: '#D7E1D3',
  borderStrong: '#C7D4C3',

  text: '#132118',
  textSoft: '#425345',
  textMuted: '#728173',

  primary: '#183C2A',
  primary2: '#24583D',
  primary3: '#2F7A51',
  accent: '#6FD08C',

  danger: '#D94F4F',
  warning: '#C98A1F',
  success: '#2D8A57',
  info: '#4475D9',
  purple: '#8B5CF6',
  cyan: '#06B6D4',

  redSoft: '#FFF1F1',
  yellowSoft: '#FFF8E8',
  greenSoft: '#EDF8F0',
  blueSoft: '#EDF3FF',
  purpleSoft: '#F3EEFF',
  cyanSoft: '#E9FCFF',
};

type ProductRow = {
  id: string;
  name: string;
  category?: string | null;
  stock_quantity?: number | null;
  min_stock_level?: number | null;
  selling_price?: number | null;
  cost_price?: number | null;
  expiry_date?: string | null;
  supplier_name?: string | null;
};

type AlertRow = {
  id: string;
  title: string;
  description?: string | null;
  severity?: 'low' | 'medium' | 'high' | null;
  created_at?: string | null;
  source_type?: string | null;
};

type RecommendationRow = {
  id: string;
  product_name: string;
  recommendation_type: 'discount' | 'restock' | 'price_up' | 'price_down';
  message: string;
  impact_value?: number | null;
  created_at?: string | null;
};

type CategoryInsight = {
  category: string;
  productCount: number;
  nearExpiry: number;
  lowStock: number;
  weakMargin: number;
  avgMargin: number;
  riskScore: number;
};

type SupplierInsight = {
  supplier: string;
  productCount: number;
  highRiskCount: number;
  lowStockCount: number;
  nearExpiryCount: number;
};

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

function daysUntil(dateString?: string | null) {
  if (!dateString) return null;
  const today = new Date();
  const target = new Date(dateString);
  if (Number.isNaN(target.getTime())) return null;
  today.setHours(0, 0, 0, 0);
  target.setHours(0, 0, 0, 0);
  const diff = target.getTime() - today.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function riskScore(item: ProductRow) {
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

function Bar({
  value,
  max,
  color,
}: {
  value: number;
  max: number;
  color: string;
}) {
  const widthPercent: DimensionValue =
    max > 0 ? `${(value / max) * 100}%` : '0%';

  return (
    <View style={styles.barTrack}>
      <View style={[styles.barFill, { width: widthPercent, backgroundColor: color }]} />
    </View>
  );
}

function InsightStat({
  title,
  value,
  subtitle,
  icon,
  tone = 'green',
}: {
  title: string;
  value: string;
  subtitle: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  tone?: 'green' | 'yellow' | 'red' | 'blue' | 'purple' | 'cyan';
}) {
  const bgMap = {
    green: palette.greenSoft,
    yellow: palette.yellowSoft,
    red: palette.redSoft,
    blue: palette.blueSoft,
    purple: palette.purpleSoft,
    cyan: palette.cyanSoft,
  } as const;

  const colorMap = {
    green: palette.primary2,
    yellow: palette.warning,
    red: palette.danger,
    blue: palette.info,
    purple: palette.purple,
    cyan: palette.cyan,
  } as const;

  return (
    <View style={styles.statCard}>
      <View style={[styles.statIconWrap, { backgroundColor: bgMap[tone] }]}>
        <Ionicons name={icon} size={18} color={colorMap[tone]} />
      </View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statTitle}>{title}</Text>
      <Text style={styles.statSubtitle}>{subtitle}</Text>
    </View>
  );
}

function SectionHeader({
  eyebrow,
  title,
  subtitle,
}: {
  eyebrow?: string;
  title: string;
  subtitle: string;
}) {
  return (
    <View style={styles.sectionHeader}>
      {!!eyebrow && <Text style={styles.sectionEyebrow}>{eyebrow}</Text>}
      <Text style={styles.sectionTitle}>{title}</Text>
      <Text style={styles.sectionSubtitle}>{subtitle}</Text>
    </View>
  );
}

export default function InsightsScreen() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
const [sidebarOpen, setSidebarOpen] = useState(false);
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [alerts, setAlerts] = useState<AlertRow[]>([]);
  const [recommendations, setRecommendations] = useState<RecommendationRow[]>([]);

  const loadInsights = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);

      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user) {
        router.replace('/login');
        return;
      }

      const [productsRes, alertsRes, recsRes] = await Promise.all([
        supabase
          .from('food_products')
          .select(
            'id, name, category, stock_quantity, min_stock_level, selling_price, cost_price, expiry_date, supplier_name'
          )
          .eq('user_id', user.id),

        supabase
          .from('food_alerts')
          .select('id, title, description, severity, created_at, source_type')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false }),

        supabase
          .from('food_recommendations')
          .select(
            'id, product_name, recommendation_type, message, impact_value, created_at'
          )
          .eq('user_id', user.id)
          .order('created_at', { ascending: false }),
      ]);

      if (!productsRes.error) setProducts((productsRes.data as ProductRow[]) || []);
      if (!alertsRes.error) setAlerts((alertsRes.data as AlertRow[]) || []);
      if (!recsRes.error) setRecommendations((recsRes.data as RecommendationRow[]) || []);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadInsights();
  }, [loadInsights]);

  const overview = useMemo(() => {
    const totalProducts = products.length;
    const totalAlerts = alerts.length;
    const totalRecommendations = recommendations.length;

    const highRiskProducts = products.filter((p) => riskScore(p) >= 70).length;
    const nearExpiryProducts = products.filter((p) => {
      const d = daysUntil(p.expiry_date);
      return d !== null && d >= 0 && d <= 7;
    }).length;

    const weakMarginProducts = products.filter(
      (p) => marginPercent(p.selling_price, p.cost_price) < 15
    ).length;

    const estimatedWasteExposure = products.reduce((sum, p) => {
      const d = daysUntil(p.expiry_date);
      const stock = safeNumber(p.stock_quantity);
      if (d !== null && d >= 0 && d <= 5) {
        return sum + stock * safeNumber(p.cost_price);
      }
      return sum;
    }, 0);

    const recommendationImpact = recommendations.reduce(
      (sum, r) => sum + safeNumber(r.impact_value),
      0
    );

    return {
      totalProducts,
      totalAlerts,
      totalRecommendations,
      highRiskProducts,
      nearExpiryProducts,
      weakMarginProducts,
      estimatedWasteExposure,
      recommendationImpact,
    };
  }, [products, alerts, recommendations]);

  const categoryInsights = useMemo(() => {
    const map = new Map<string, CategoryInsight>();

    for (const p of products) {
      const category = p.category?.trim() || 'Uncategorized';
      const current = map.get(category) || {
        category,
        productCount: 0,
        nearExpiry: 0,
        lowStock: 0,
        weakMargin: 0,
        avgMargin: 0,
        riskScore: 0,
      };

      current.productCount += 1;
      const d = daysUntil(p.expiry_date);
      const stock = safeNumber(p.stock_quantity);
      const minStock = safeNumber(p.min_stock_level);
      const margin = marginPercent(p.selling_price, p.cost_price);
      const risk = riskScore(p);

      if (d !== null && d >= 0 && d <= 7) current.nearExpiry += 1;
      if (minStock > 0 ? stock <= minStock : stock <= 10) current.lowStock += 1;
      if (margin < 15) current.weakMargin += 1;

      current.avgMargin += margin;
      current.riskScore += risk;

      map.set(category, current);
    }

    return Array.from(map.values())
      .map((item) => ({
        ...item,
        avgMargin: item.productCount ? item.avgMargin / item.productCount : 0,
        riskScore: item.productCount ? item.riskScore / item.productCount : 0,
      }))
      .sort((a, b) => b.riskScore - a.riskScore);
  }, [products]);

  const supplierInsights = useMemo(() => {
    const map = new Map<string, SupplierInsight>();

    for (const p of products) {
      const supplier = p.supplier_name?.trim() || 'Unknown Supplier';
      const current = map.get(supplier) || {
        supplier,
        productCount: 0,
        highRiskCount: 0,
        lowStockCount: 0,
        nearExpiryCount: 0,
      };

      const r = riskScore(p);
      const d = daysUntil(p.expiry_date);
      const stock = safeNumber(p.stock_quantity);
      const minStock = safeNumber(p.min_stock_level);

      current.productCount += 1;
      if (r >= 70) current.highRiskCount += 1;
      if (minStock > 0 ? stock <= minStock : stock <= 10) current.lowStockCount += 1;
      if (d !== null && d >= 0 && d <= 7) current.nearExpiryCount += 1;

      map.set(supplier, current);
    }

    return Array.from(map.values()).sort((a, b) => b.highRiskCount - a.highRiskCount);
  }, [products]);

  const recommendationGroups = useMemo(() => {
    return {
      discount: recommendations.filter((r) => r.recommendation_type === 'discount'),
      restock: recommendations.filter((r) => r.recommendation_type === 'restock'),
      priceUp: recommendations.filter((r) => r.recommendation_type === 'price_up'),
      priceDown: recommendations.filter((r) => r.recommendation_type === 'price_down'),
    };
  }, [recommendations]);

  const alertSeveritySummary = useMemo(() => {
    return {
      high: alerts.filter((a) => a.severity === 'high').length,
      medium: alerts.filter((a) => a.severity === 'medium').length,
      low: alerts.filter((a) => a.severity === 'low').length,
    };
  }, [alerts]);

  const maxCategoryRisk = Math.max(...categoryInsights.map((c) => c.riskScore), 1);
  const maxSupplierRisk = Math.max(...supplierInsights.map((s) => s.highRiskCount), 1);

  const onRefresh = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await loadInsights(true);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={palette.primary2} />
          <Text style={styles.loadingText}>Loading insights...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
  <View style={styles.pageWrap}>
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
      refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={palette.primary2}
          />
        }
      >
        <LinearGradient
  colors={['#163728', '#1C4630', '#24583D']}
  start={{ x: 0, y: 0 }}
  end={{ x: 1, y: 1 }}
  style={styles.hero}
>
  <View style={styles.heroTop}>
    <View style={styles.heroTopLeft}>
      <TouchableOpacity
        style={styles.heroMenuButton}
        onPress={() => setSidebarOpen(true)}
      >
        <Ionicons name="menu-outline" size={20} color="#fff" />
      </TouchableOpacity>

      <View style={styles.heroIconWrap}>
        <MaterialCommunityIcons name="chart-line" size={24} color="#fff" />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.heroEyebrow}>Business intelligence</Text>
        <Text style={styles.heroTitle}>Insights</Text>
      </View>
    </View>

    <TouchableOpacity
      style={styles.heroButton}
      onPress={() => router.push('/(tabs)/products')}
    >
      <Feather name="box" size={18} color="#fff" />
    </TouchableOpacity>
  </View>

  <Text style={styles.heroSubtitle}>
    Advanced food business analysis for expiry pressure, stock imbalance,
    supplier risk, weak margins and recommendation impact.
  </Text>

  <View style={styles.heroInsightBand}>
    <View style={styles.heroInsightItem}>
      <Text style={styles.heroInsightLabel}>Waste exposure</Text>
      <Text style={styles.heroInsightValue}>
        {formatCompactCurrency(overview.estimatedWasteExposure)}
      </Text>
    </View>

    <View style={styles.heroDivider} />

    <View style={styles.heroInsightItem}>
      <Text style={styles.heroInsightLabel}>Recommendation impact</Text>
      <Text style={styles.heroInsightValue}>
        {formatCompactCurrency(overview.recommendationImpact)}
      </Text>
    </View>

    <View style={styles.heroDivider} />

    <View style={styles.heroInsightItem}>
      <Text style={styles.heroInsightLabel}>Alerts</Text>
      <Text style={styles.heroInsightValue}>{overview.totalAlerts}</Text>
    </View>
  </View>
</LinearGradient>

        <SectionHeader
          eyebrow="Overview"
          title="Operational picture"
          subtitle="A single-screen summary of the most important intelligence signals."
        />

        <View style={styles.statsGrid}>
          <InsightStat
            title="Products"
            value={`${overview.totalProducts}`}
            subtitle="Tracked inventory items"
            icon="basket-outline"
            tone="green"
          />
          <InsightStat
            title="High risk"
            value={`${overview.highRiskProducts}`}
            subtitle="Require immediate action"
            icon="warning-outline"
            tone="red"
          />
          <InsightStat
            title="Near expiry"
            value={`${overview.nearExpiryProducts}`}
            subtitle="Within 7 days"
            icon="time-outline"
            tone="yellow"
          />
          <InsightStat
            title="Weak margin"
            value={`${overview.weakMarginProducts}`}
            subtitle="Below healthy threshold"
            icon="cash-outline"
            tone="blue"
          />
          <InsightStat
            title="Waste exposure"
            value={formatCompactCurrency(overview.estimatedWasteExposure)}
            subtitle="At cost basis"
            icon="trash-outline"
            tone="purple"
          />
          <InsightStat
            title="Recommendation impact"
            value={formatCompactCurrency(overview.recommendationImpact)}
            subtitle="Estimated opportunity"
            icon="sparkles-outline"
            tone="cyan"
          />
        </View>

        <SectionHeader
          eyebrow="Categories"
          title="Category pressure"
          subtitle="Which product groups are carrying the most operational risk."
        />

        <View style={styles.cardBlock}>
          {categoryInsights.length > 0 ? (
            categoryInsights.slice(0, 8).map((category) => (
              <View key={category.category} style={styles.insightRowCard}>
                <View style={styles.insightRowTop}>
                  <Text style={styles.insightRowTitle}>{category.category}</Text>
                  <Text style={styles.insightRowValue}>
                    Risk {category.riskScore.toFixed(0)}%
                  </Text>
                </View>

                <Bar
                  value={category.riskScore}
                  max={maxCategoryRisk}
                  color={palette.warning}
                />

                <View style={styles.metricRow}>
                  <Text style={styles.metricText}>{category.productCount} products</Text>
                  <Text style={styles.metricText}>{category.nearExpiry} expiring</Text>
                  <Text style={styles.metricText}>{category.lowStock} low stock</Text>
                  <Text style={styles.metricText}>{category.avgMargin.toFixed(0)}% margin</Text>
                </View>
              </View>
            ))
          ) : (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>No category insights yet</Text>
              <Text style={styles.emptySubtitle}>
                Upload product data to unlock category analytics.
              </Text>
            </View>
          )}
        </View>

        <SectionHeader
          eyebrow="Suppliers"
          title="Supplier risk"
          subtitle="Suppliers most associated with inventory pressure and high-risk products."
        />

        <View style={styles.cardBlock}>
          {supplierInsights.length > 0 ? (
            supplierInsights.slice(0, 8).map((supplier) => (
              <View key={supplier.supplier} style={styles.insightRowCard}>
                <View style={styles.insightRowTop}>
                  <Text style={styles.insightRowTitle}>{supplier.supplier}</Text>
                  <Text style={styles.insightRowValue}>
                    {supplier.highRiskCount} high risk
                  </Text>
                </View>

                <Bar
                  value={supplier.highRiskCount}
                  max={maxSupplierRisk}
                  color={palette.danger}
                />

                <View style={styles.metricRow}>
                  <Text style={styles.metricText}>{supplier.productCount} products</Text>
                  <Text style={styles.metricText}>{supplier.lowStockCount} low stock</Text>
                  <Text style={styles.metricText}>{supplier.nearExpiryCount} expiring</Text>
                </View>
              </View>
            ))
          ) : (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>No supplier insights yet</Text>
              <Text style={styles.emptySubtitle}>
                Supplier intelligence will appear after uploads.
              </Text>
            </View>
          )}
        </View>

        <SectionHeader
          eyebrow="Alerts"
          title="Alert severity breakdown"
          subtitle="How serious the current issue landscape is."
        />

        <View style={styles.breakdownCard}>
          <View style={styles.breakdownItem}>
            <View style={[styles.breakdownIcon, { backgroundColor: palette.redSoft }]}>
              <Ionicons name="alert-circle-outline" size={18} color={palette.danger} />
            </View>
            <Text style={styles.breakdownValue}>{alertSeveritySummary.high}</Text>
            <Text style={styles.breakdownLabel}>High</Text>
          </View>

          <View style={styles.breakdownItem}>
            <View style={[styles.breakdownIcon, { backgroundColor: palette.yellowSoft }]}>
              <Ionicons name="warning-outline" size={18} color={palette.warning} />
            </View>
            <Text style={styles.breakdownValue}>{alertSeveritySummary.medium}</Text>
            <Text style={styles.breakdownLabel}>Medium</Text>
          </View>

          <View style={styles.breakdownItem}>
            <View style={[styles.breakdownIcon, { backgroundColor: palette.blueSoft }]}>
              <Ionicons name="information-circle-outline" size={18} color={palette.info} />
            </View>
            <Text style={styles.breakdownValue}>{alertSeveritySummary.low}</Text>
            <Text style={styles.breakdownLabel}>Low</Text>
          </View>
        </View>

        <SectionHeader
          eyebrow="Recommendations"
          title="Recommendation mix"
          subtitle="What actions the system is suggesting across the business."
        />

        <View style={styles.recommendationGrid}>
          <View style={styles.recCard}>
            <Text style={styles.recValue}>{recommendationGroups.discount.length}</Text>
            <Text style={styles.recTitle}>Discount</Text>
          </View>
          <View style={styles.recCard}>
            <Text style={styles.recValue}>{recommendationGroups.restock.length}</Text>
            <Text style={styles.recTitle}>Restock</Text>
          </View>
          <View style={styles.recCard}>
            <Text style={styles.recValue}>{recommendationGroups.priceUp.length}</Text>
            <Text style={styles.recTitle}>Price Up</Text>
          </View>
          <View style={styles.recCard}>
            <Text style={styles.recValue}>{recommendationGroups.priceDown.length}</Text>
            <Text style={styles.recTitle}>Price Down</Text>
          </View>
        </View>

        <SectionHeader
          eyebrow="Opportunities"
          title="Top recommendation opportunities"
          subtitle="Highest estimated impact items across generated recommendations."
        />

        <View style={styles.cardBlock}>
          {recommendations.length > 0 ? (
            [...recommendations]
              .sort((a, b) => safeNumber(b.impact_value) - safeNumber(a.impact_value))
              .slice(0, 8)
              .map((rec) => (
                <View key={rec.id} style={styles.opportunityCard}>
                  <View style={styles.opportunityLeft}>
                    <View style={styles.opportunityIconWrap}>
                      <Ionicons name="sparkles-outline" size={18} color={palette.primary2} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.opportunityTitle}>{rec.product_name}</Text>
                      <Text style={styles.opportunityMessage}>{rec.message}</Text>
                    </View>
                  </View>

                  <View style={styles.opportunityRight}>
                    <Text style={styles.opportunityValue}>
                      {formatCompactCurrency(rec.impact_value)}
                    </Text>
                    <Text style={styles.opportunityType}>{rec.recommendation_type}</Text>
                  </View>
                </View>
              ))
          ) : (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>No recommendation opportunities yet</Text>
              <Text style={styles.emptySubtitle}>
                Upload products to generate recommendation analytics.
              </Text>
            </View>
          )}
        </View>

        <SectionHeader
          eyebrow="Interpretation"
          title="Business reading"
          subtitle="A quick narrative summary of what these insights mean."
        />

        <View style={styles.summaryNarrativeCard}>
          <Text style={styles.summaryNarrativeText}>
            {overview.highRiskProducts > 0
              ? `You currently have ${overview.highRiskProducts} high-risk products. `
              : 'You currently have no high-risk products. '}
            {overview.nearExpiryProducts > 0
              ? `${overview.nearExpiryProducts} items are approaching expiry, which increases waste pressure. `
              : 'Expiry pressure is currently low. '}
            {overview.weakMarginProducts > 0
              ? `${overview.weakMarginProducts} items have weak margin and may need pricing review. `
              : 'Margin health looks stable across products. '}
            Estimated waste exposure is {formatCurrency(overview.estimatedWasteExposure)}, while recommendation impact is currently estimated at {formatCurrency(overview.recommendationImpact)}.
          </Text>
        </View>

              <View style={{ height: 30 }} />
    </ScrollView>

    <AppSidebar
      visible={sidebarOpen}
      onClose={() => setSidebarOpen(false)}
      active="explore"
    />
  </View>
</SafeAreaView>
  );
}

const styles = StyleSheet.create({
  pageWrap: {
  flex: 1,
  backgroundColor: palette.bg,
},
heroMenuButton: {
  width: 42,
  height: 42,
  borderRadius: 14,
  backgroundColor: 'rgba(255,255,255,0.12)',
  alignItems: 'center',
  justifyContent: 'center',
},
  safeArea: {
    flex: 1,
    backgroundColor: palette.bg,
  },
  container: {
    flex: 1,
    backgroundColor: palette.bg,
  },
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.bg,
  },
  loadingText: {
    marginTop: 14,
    color: palette.textSoft,
    fontSize: 14,
    fontWeight: '600',
  },

  scrollContent: {
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 24,
  },

  hero: {
    borderRadius: 30,
    padding: 20,
    marginBottom: 20,
  },
  heroTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  heroTopLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
    paddingRight: 12,
  },
  heroIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroButton: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroEyebrow: {
    color: 'rgba(255,255,255,0.72)',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 3,
  },
  heroTitle: {
    color: '#fff',
    fontSize: 26,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  heroSubtitle: {
    marginTop: 14,
    color: 'rgba(255,255,255,0.84)',
    fontSize: 14,
    lineHeight: 21,
    fontWeight: '500',
  },
  heroInsightBand: {
    marginTop: 18,
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderRadius: 20,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
  },
  heroInsightItem: {
    flex: 1,
    alignItems: 'center',
  },
  heroInsightLabel: {
    color: 'rgba(255,255,255,0.68)',
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 4,
    textAlign: 'center',
  },
  heroInsightValue: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '900',
  },
  heroDivider: {
    width: 1,
    height: 32,
    backgroundColor: 'rgba(255,255,255,0.12)',
    marginHorizontal: 8,
  },

  sectionHeader: {
    marginTop: 4,
    marginBottom: 12,
  },
  sectionEyebrow: {
    color: palette.primary2,
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  sectionTitle: {
    color: palette.text,
    fontSize: 22,
    fontWeight: '900',
    marginBottom: 4,
    letterSpacing: -0.4,
  },
  sectionSubtitle: {
    color: palette.textMuted,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '500',
  },

  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 18,
  },
  statCard: {
    width: '48.2%',
    backgroundColor: palette.surface,
    borderRadius: 22,
    padding: 16,
    borderWidth: 1,
    borderColor: palette.border,
  },
  statIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  statValue: {
    color: palette.text,
    fontSize: 24,
    fontWeight: '900',
    marginBottom: 4,
    letterSpacing: -0.5,
  },
  statTitle: {
    color: palette.textSoft,
    fontSize: 13,
    fontWeight: '800',
  },
  statSubtitle: {
    color: palette.textMuted,
    fontSize: 11,
    lineHeight: 16,
    marginTop: 6,
    fontWeight: '500',
  },

  cardBlock: {
    gap: 12,
    marginBottom: 18,
  },
  insightRowCard: {
    backgroundColor: palette.surface,
    borderRadius: 22,
    padding: 16,
    borderWidth: 1,
    borderColor: palette.border,
  },
  insightRowTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
    gap: 12,
  },
  insightRowTitle: {
    color: palette.text,
    fontSize: 15,
    fontWeight: '900',
    flex: 1,
  },
  insightRowValue: {
    color: palette.textSoft,
    fontSize: 13,
    fontWeight: '800',
  },
  barTrack: {
    height: 10,
    borderRadius: 999,
    backgroundColor: palette.surfaceSoft2,
    overflow: 'hidden',
    marginBottom: 12,
  },
  barFill: {
    height: '100%',
    borderRadius: 999,
  },
  metricRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  metricText: {
    color: palette.textMuted,
    fontSize: 12,
    fontWeight: '700',
  },

  breakdownCard: {
    backgroundColor: palette.surface,
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: palette.border,
    marginBottom: 18,
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  breakdownItem: {
    flex: 1,
    alignItems: 'center',
  },
  breakdownIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  breakdownValue: {
    color: palette.text,
    fontSize: 24,
    fontWeight: '900',
    marginBottom: 4,
  },
  breakdownLabel: {
    color: palette.textMuted,
    fontSize: 12,
    fontWeight: '800',
  },

  recommendationGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 18,
  },
  recCard: {
    width: '48.2%',
    backgroundColor: palette.surface,
    borderRadius: 22,
    padding: 16,
    borderWidth: 1,
    borderColor: palette.border,
    alignItems: 'center',
  },
  recValue: {
    color: palette.text,
    fontSize: 26,
    fontWeight: '900',
    marginBottom: 6,
    letterSpacing: -0.6,
  },
  recTitle: {
    color: palette.textMuted,
    fontSize: 12,
    fontWeight: '800',
  },

  opportunityCard: {
    backgroundColor: palette.surface,
    borderRadius: 22,
    padding: 14,
    borderWidth: 1,
    borderColor: palette.border,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  opportunityLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    paddingRight: 12,
  },
  opportunityIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: palette.greenSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  opportunityTitle: {
    color: palette.text,
    fontSize: 14,
    fontWeight: '900',
    marginBottom: 4,
  },
  opportunityMessage: {
    color: palette.textMuted,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '500',
  },
  opportunityRight: {
    alignItems: 'flex-end',
  },
  opportunityValue: {
    color: palette.primary2,
    fontSize: 14,
    fontWeight: '900',
    marginBottom: 4,
  },
  opportunityType: {
    color: palette.textMuted,
    fontSize: 11,
    fontWeight: '700',
  },

  summaryNarrativeCard: {
    backgroundColor: palette.surface,
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: palette.border,
  },
  summaryNarrativeText: {
    color: palette.textSoft,
    fontSize: 14,
    lineHeight: 22,
    fontWeight: '600',
  },

  emptyCard: {
    backgroundColor: palette.surface,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: palette.border,
    padding: 22,
    alignItems: 'center',
  },
  emptyTitle: {
    color: palette.text,
    fontSize: 16,
    fontWeight: '900',
    marginBottom: 6,
  },
  emptySubtitle: {
    color: palette.textMuted,
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 19,
    fontWeight: '500',
  },
});