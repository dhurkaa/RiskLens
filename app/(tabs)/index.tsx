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

  danger: '#D94F4F',
  warning: '#C98A1F',
  success: '#2D8A57',
  info: '#4475D9',
  purple: '#8B5CF6',

  redSoft: '#FFF1F1',
  yellowSoft: '#FFF8E8',
  greenSoft: '#EDF8F0',
  blueSoft: '#EDF3FF',
  purpleSoft: '#F3EEFF',
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
  status?: string | null;
};

type AlertRow = {
  id: string;
  title: string;
  description?: string | null;
  severity?: 'low' | 'medium' | 'high' | null;
  created_at?: string | null;
  source_type?: string | null;
  source_product_id?: string | null;
};

type RecommendationRow = {
  id: string;
  product_name: string;
  recommendation_type: 'discount' | 'restock' | 'price_up' | 'price_down';
  message: string;
  impact_value?: number | null;
  created_at?: string | null;
  product_id?: string | null;
};

type PricingRunRow = {
  id: string;
  status: 'draft' | 'applied' | 'cancelled';
  estimated_total_impact?: number | null;
  created_at?: string | null;
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

function SectionHeader({
  eyebrow,
  title,
  subtitle,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
}) {
  return (
    <View style={styles.sectionHeader}>
      {!!eyebrow && <Text style={styles.sectionEyebrow}>{eyebrow}</Text>}
      <Text style={styles.sectionTitle}>{title}</Text>
      {!!subtitle && <Text style={styles.sectionSubtitle}>{subtitle}</Text>}
    </View>
  );
}

function MetricCard({
  title,
  value,
  subtitle,
  icon,
  tone = 'blue',
}: {
  title: string;
  value: string;
  subtitle: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  tone?: 'red' | 'yellow' | 'blue' | 'green' | 'purple';
}) {
  const bgMap = {
    red: palette.redSoft,
    yellow: palette.yellowSoft,
    blue: palette.blueSoft,
    green: palette.greenSoft,
    purple: palette.purpleSoft,
  } as const;

  const colorMap = {
    red: palette.danger,
    yellow: palette.warning,
    blue: palette.info,
    green: palette.success,
    purple: palette.purple,
  } as const;

  return (
    <View style={styles.metricCard}>
      <View style={[styles.metricIconWrap, { backgroundColor: bgMap[tone] }]}>
        <Ionicons name={icon} size={18} color={colorMap[tone]} />
      </View>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricTitle}>{title}</Text>
      <Text style={styles.metricSubtitle}>{subtitle}</Text>
    </View>
  );
}

function QuickAction({
  icon,
  title,
  subtitle,
  onPress,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  title: string;
  subtitle: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={styles.quickActionCard} onPress={onPress} activeOpacity={0.92}>
      <View style={styles.quickActionIconWrap}>
        <Ionicons name={icon} size={18} color={palette.primary2} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.quickActionTitle}>{title}</Text>
        <Text style={styles.quickActionSubtitle}>{subtitle}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={palette.textMuted} />
    </TouchableOpacity>
  );
}

export default function DashboardScreen() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [products, setProducts] = useState<ProductRow[]>([]);
  const [alerts, setAlerts] = useState<AlertRow[]>([]);
  const [recommendations, setRecommendations] = useState<RecommendationRow[]>([]);
  const [pricingRuns, setPricingRuns] = useState<PricingRunRow[]>([]);

  const loadDashboard = useCallback(async (isRefresh = false) => {
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

      const [productsRes, alertsRes, recsRes, runsRes] = await Promise.all([
        supabase
          .from('food_products')
          .select(
            'id, name, category, stock_quantity, min_stock_level, selling_price, cost_price, expiry_date, supplier_name, status'
          )
          .eq('user_id', user.id)
          .eq('status', 'active'),

        supabase
          .from('food_alerts')
          .select('id, title, description, severity, created_at, source_type, source_product_id')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(5),

        supabase
          .from('food_recommendations')
          .select('id, product_name, recommendation_type, message, impact_value, created_at, product_id')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(5),

        supabase
          .from('pricing_runs')
          .select('id, status, estimated_total_impact, created_at')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(5),
      ]);

      if (!productsRes.error) setProducts((productsRes.data as ProductRow[]) || []);
      if (!alertsRes.error) setAlerts((alertsRes.data as AlertRow[]) || []);
      if (!recsRes.error) setRecommendations((recsRes.data as RecommendationRow[]) || []);
      if (!runsRes.error) setPricingRuns((runsRes.data as PricingRunRow[]) || []);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const stats = useMemo(() => {
    const totalProducts = products.length;

    const lowStock = products.filter((p) => {
      const stock = safeNumber(p.stock_quantity);
      const min = safeNumber(p.min_stock_level);
      return min > 0 ? stock <= min : stock <= 10;
    }).length;

    const nearExpiry = products.filter((p) => {
      const d = daysUntil(p.expiry_date);
      return d !== null && d >= 0 && d <= 7;
    }).length;

    const highRisk = products.filter((p) => riskScore(p) >= 70).length;

    const inventoryValue = products.reduce(
      (sum, p) => sum + safeNumber(p.stock_quantity) * safeNumber(p.cost_price),
      0
    );

    const avgMargin =
      products.length > 0
        ? products.reduce((sum, p) => sum + marginPercent(p.selling_price, p.cost_price), 0) /
          products.length
        : 0;

    const pricingImpact = pricingRuns.reduce(
      (sum, run) => sum + safeNumber(run.estimated_total_impact),
      0
    );

    return {
      totalProducts,
      lowStock,
      nearExpiry,
      highRisk,
      inventoryValue,
      avgMargin,
      pricingImpact,
      alertCount: alerts.length,
      recommendationCount: recommendations.length,
    };
  }, [products, alerts, recommendations, pricingRuns]);

  const topRiskProducts = useMemo(() => {
    return [...products].sort((a, b) => riskScore(b) - riskScore(a)).slice(0, 5);
  }, [products]);

  const onRefresh = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await loadDashboard(true);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={palette.primary2} />
          <Text style={styles.loadingText}>Loading dashboard...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <ScrollView
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
            <View style={styles.heroTopRow}>
              <TouchableOpacity style={styles.heroButton} onPress={() => setSidebarOpen(true)}>
                <Ionicons name="menu-outline" size={20} color="#fff" />
              </TouchableOpacity>

              <View style={styles.heroActions}>
                <TouchableOpacity
                  style={styles.heroButton}
                  onPress={() => router.push('/(tabs)/alerts-center')}
                >
                  <Ionicons name="notifications-outline" size={20} color="#fff" />
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.heroButton}
                  onPress={() => router.push('/(tabs)/decision-center')}
                >
                  <Ionicons name="flash-outline" size={20} color="#fff" />
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.heroMain}>
              <View style={styles.heroIconWrap}>
                <MaterialCommunityIcons name="view-dashboard-outline" size={24} color="#fff" />
              </View>

              <View style={{ flex: 1 }}>
                <Text style={styles.heroEyebrow}>Business command view</Text>
                <Text style={styles.heroTitle}>Dashboard</Text>
                <Text style={styles.heroSubtitle}>
                  Real-time overview of inventory health, pricing intelligence, alerts, and next recommended actions.
                </Text>
              </View>
            </View>

            <View style={styles.heroInsightBand}>
              <View style={styles.heroInsightItem}>
                <Text style={styles.heroInsightLabel}>Products</Text>
                <Text style={styles.heroInsightValue}>{stats.totalProducts}</Text>
              </View>

              <View style={styles.heroDivider} />

              <View style={styles.heroInsightItem}>
                <Text style={styles.heroInsightLabel}>Inventory value</Text>
                <Text style={styles.heroInsightValueSmall}>
                  {formatCompactCurrency(stats.inventoryValue)}
                </Text>
              </View>

              <View style={styles.heroDivider} />

              <View style={styles.heroInsightItem}>
                <Text style={styles.heroInsightLabel}>Pricing impact</Text>
                <Text style={styles.heroInsightValueSmall}>
                  {formatCompactCurrency(stats.pricingImpact)}
                </Text>
              </View>
            </View>
          </LinearGradient>

          <SectionHeader
            eyebrow="Overview"
            title="Core signals"
            subtitle="The most important business indicators at a glance."
          />

          <View style={styles.metricsGrid}>
            <MetricCard
              title="Products"
              value={`${stats.totalProducts}`}
              subtitle="Tracked active items"
              icon="basket-outline"
              tone="green"
            />
            <MetricCard
              title="Low stock"
              value={`${stats.lowStock}`}
              subtitle="Need replenishment"
              icon="cube-outline"
              tone="yellow"
            />
            <MetricCard
              title="Near expiry"
              value={`${stats.nearExpiry}`}
              subtitle="Within 7 days"
              icon="time-outline"
              tone="red"
            />
            <MetricCard
              title="High risk"
              value={`${stats.highRisk}`}
              subtitle="Require urgent review"
              icon="warning-outline"
              tone="purple"
            />
            <MetricCard
              title="Avg margin"
              value={`${Math.round(stats.avgMargin)}%`}
              subtitle="Across active products"
              icon="cash-outline"
              tone="blue"
            />
            <MetricCard
              title="Pricing impact"
              value={formatCompactCurrency(stats.pricingImpact)}
              subtitle="Saved pricing runs"
              icon="sparkles-outline"
              tone="green"
            />
          </View>

          <SectionHeader
            eyebrow="Actions"
            title="Quick actions"
            subtitle="Jump directly into the parts of the system that matter most."
          />

          <View style={styles.quickActionsWrap}>
            <QuickAction
              icon="sparkles-outline"
              title="Run AI Pricing"
              subtitle="Generate smart pricing proposals"
              onPress={() => router.push('/(tabs)/ai-pricing-lab')}
            />
            <QuickAction
              icon="time-outline"
              title="Pricing History"
              subtitle="Review past optimization runs"
              onPress={() => router.push('/(tabs)/pricing-history')}
            />
            <QuickAction
              icon="analytics-outline"
              title="Decision Center"
              subtitle="See what the business should do next"
              onPress={() => router.push('/(tabs)/decision-center')}
            />
            <QuickAction
              icon="cloud-upload-outline"
              title="Upload CSV"
              subtitle="Add new inventory data"
              onPress={() => router.push('/(tabs)/upload')}
            />
          </View>

          <SectionHeader
            eyebrow="Watchlist"
            title="Top risk products"
            subtitle="Products with the highest current operational pressure."
          />

          <View style={styles.listWrap}>
            {topRiskProducts.length > 0 ? (
              topRiskProducts.map((product) => (
                <TouchableOpacity
                  key={product.id}
                  style={styles.rowCard}
                  activeOpacity={0.94}
                  onPress={() =>
                    router.push({
                      pathname: '/product-details',
                      params: { id: product.id },
                    })
                  }
                >
                  <View style={styles.rowMain}>
                    <View style={styles.rowIconWrap}>
                      <MaterialCommunityIcons name="food-outline" size={18} color={palette.primary2} />
                    </View>

                    <View style={{ flex: 1 }}>
                      <Text style={styles.rowTitle}>{product.name}</Text>
                      <Text style={styles.rowSubtitle}>
                        {product.category || 'General'} • {product.supplier_name || 'No supplier'}
                      </Text>
                    </View>
                  </View>

                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={styles.rowValue}>{riskScore(product)}%</Text>
                    <Text style={styles.rowMini}>risk</Text>
                  </View>
                </TouchableOpacity>
              ))
            ) : (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyTitle}>No products yet</Text>
                <Text style={styles.emptySubtitle}>
                  Upload inventory data to populate the dashboard.
                </Text>
              </View>
            )}
          </View>

          <SectionHeader
            eyebrow="Signals"
            title="Latest alerts"
            subtitle="Most recent issue signals coming from the system."
          />

          <View style={styles.listWrap}>
            {alerts.length > 0 ? (
              alerts.map((alert) => (
                <TouchableOpacity
                  key={alert.id}
                  style={styles.rowCard}
                  activeOpacity={0.94}
                  onPress={() => router.push('/(tabs)/alerts-center')}
                >
                  <View style={styles.rowMain}>
                    <View style={styles.rowIconWrap}>
                      <Ionicons name="warning-outline" size={18} color={palette.warning} />
                    </View>

                    <View style={{ flex: 1 }}>
                      <Text style={styles.rowTitle}>{alert.title}</Text>
                      <Text style={styles.rowSubtitle}>
                        {alert.description || 'No description available.'}
                      </Text>
                    </View>
                  </View>

                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={styles.rowValue}>{alert.severity || 'low'}</Text>
                    <Text style={styles.rowMini}>{alert.source_type || 'system'}</Text>
                  </View>
                </TouchableOpacity>
              ))
            ) : (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyTitle}>No alerts</Text>
                <Text style={styles.emptySubtitle}>
                  Alerts will appear when the system detects issues.
                </Text>
              </View>
            )}
          </View>

          <SectionHeader
            eyebrow="Intelligence"
            title="Latest recommendations"
            subtitle="Most recent action ideas generated by the system."
          />

          <View style={styles.listWrap}>
            {recommendations.length > 0 ? (
              recommendations.map((rec) => (
                <TouchableOpacity
                  key={rec.id}
                  style={styles.rowCard}
                  activeOpacity={0.94}
                  onPress={() => router.push('/(tabs)/recommendations-center')}
                >
                  <View style={styles.rowMain}>
                    <View style={styles.rowIconWrap}>
                      <Ionicons name="sparkles-outline" size={18} color={palette.info} />
                    </View>

                    <View style={{ flex: 1 }}>
                      <Text style={styles.rowTitle}>{rec.product_name}</Text>
                      <Text style={styles.rowSubtitle}>{rec.message}</Text>
                    </View>
                  </View>

                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={styles.rowValue}>
                      {formatCompactCurrency(rec.impact_value)}
                    </Text>
                    <Text style={styles.rowMini}>{rec.recommendation_type}</Text>
                  </View>
                </TouchableOpacity>
              ))
            ) : (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyTitle}>No recommendations yet</Text>
                <Text style={styles.emptySubtitle}>
                  Run analysis and AI pricing to generate smart actions.
                </Text>
              </View>
            )}
          </View>

          <View style={{ height: 28 }} />
        </ScrollView>

        <AppSidebar
          visible={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          active="dashboard"
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
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
  heroTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  heroActions: {
    flexDirection: 'row',
    gap: 8,
  },
  heroButton: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroMain: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 18,
  },
  heroIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
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
    marginBottom: 5,
  },
  heroSubtitle: {
    color: 'rgba(255,255,255,0.84)',
    fontSize: 13,
    lineHeight: 20,
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
  heroInsightValueSmall: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
  },
  heroDivider: {
    width: 1,
    height: 32,
    backgroundColor: 'rgba(255,255,255,0.12)',
    marginHorizontal: 8,
  },

  sectionHeader: {
    marginTop: 2,
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
    letterSpacing: -0.4,
  },
  sectionSubtitle: {
    color: palette.textMuted,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 5,
    fontWeight: '500',
  },

  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 18,
  },
  metricCard: {
    width: '48.2%',
    backgroundColor: palette.surface,
    borderRadius: 22,
    padding: 16,
    borderWidth: 1,
    borderColor: palette.border,
  },
  metricIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  metricValue: {
    color: palette.text,
    fontSize: 24,
    fontWeight: '900',
    marginBottom: 4,
  },
  metricTitle: {
    color: palette.textSoft,
    fontSize: 13,
    fontWeight: '800',
  },
  metricSubtitle: {
    color: palette.textMuted,
    fontSize: 11,
    lineHeight: 16,
    marginTop: 6,
    fontWeight: '500',
  },

  quickActionsWrap: {
    gap: 12,
    marginBottom: 18,
  },
  quickActionCard: {
    backgroundColor: palette.surface,
    borderRadius: 22,
    padding: 14,
    borderWidth: 1,
    borderColor: palette.border,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  quickActionIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: palette.surfaceSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickActionTitle: {
    color: palette.text,
    fontSize: 14,
    fontWeight: '900',
    marginBottom: 4,
  },
  quickActionSubtitle: {
    color: palette.textMuted,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '500',
  },

  listWrap: {
    gap: 12,
    marginBottom: 18,
  },
  rowCard: {
    backgroundColor: palette.surface,
    borderRadius: 22,
    padding: 14,
    borderWidth: 1,
    borderColor: palette.border,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  rowMain: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  rowIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: palette.surfaceSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  rowTitle: {
    color: palette.text,
    fontSize: 14,
    fontWeight: '900',
    marginBottom: 4,
  },
  rowSubtitle: {
    color: palette.textMuted,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '500',
  },
  rowValue: {
    color: palette.primary2,
    fontSize: 13,
    fontWeight: '900',
  },
  rowMini: {
    color: palette.textMuted,
    fontSize: 11,
    fontWeight: '700',
    marginTop: 4,
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