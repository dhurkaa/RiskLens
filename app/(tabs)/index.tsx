import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { supabase } from '../../lib/supabase';
import AppSidebar from '../../components/appsidebar';
import HealthGauge from '../../components/health-gauge';
import { computeStats, healthLabel } from '../../lib/copilotEngine';
import { Text } from '../../components/app-text';
import ScreenSkeleton from '../../components/skeleton';

const palette = {
  bg: '#F4F7FB',
  surface: '#FFFFFF',
  surfaceSoft: '#EEF3FA',
  surfaceSoft2: '#E5ECF6',
  border: '#D9E2F1',
  borderStrong: '#CAD6E8',

  text: '#162033',
  textSoft: '#42516B',
  textMuted: '#738199',

  primary: '#5AA9FF',
  primary2: '#7C5CFF',
  primary3: '#4BE1EC',

  danger: '#FF6B7A',
  warning: '#F7B955',
  success: '#42D392',
  info: '#5AA9FF',
  purple: '#A78BFA',

  redSoft: '#FFF1F3',
  yellowSoft: '#FFF7E5',
  greenSoft: '#EAFBF3',
  blueSoft: '#EAF4FF',
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
  onPress,
}: {
  title: string;
  value: string;
  subtitle: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  tone?: 'red' | 'yellow' | 'blue' | 'green' | 'purple';
  onPress?: () => void;
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
    <TouchableOpacity style={styles.metricCard} activeOpacity={0.88} onPress={onPress} disabled={!onPress}>
      <View style={styles.metricTopRow}>
        <View style={[styles.metricIconWrap, { backgroundColor: bgMap[tone] }]}>
          <Ionicons name={icon} size={18} color={colorMap[tone]} />
        </View>
        {onPress ? <Ionicons name="chevron-forward" size={16} color={palette.textMuted} /> : null}
      </View>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricTitle}>{title}</Text>
      <Text style={styles.metricSubtitle}>{subtitle}</Text>
    </TouchableOpacity>
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

  const health = useMemo(
    () => computeStats({ products: products as any, alerts: alerts as any, recommendations: recommendations as any }),
    [products, alerts, recommendations]
  );

  const topRiskProducts = useMemo(() => {
    return [...products].sort((a, b) => riskScore(b) - riskScore(a)).slice(0, 5);
  }, [products]);

  const onRefresh = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await loadDashboard(true);
  };

  const go = (path: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push(path as never);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <ScreenSkeleton />
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
            colors={['#5AA9FF', '#6D7CFF', '#4BE1EC']}
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
                  onPress={() => router.push('/(tabs)/copilot')}
                >
                  <MaterialCommunityIcons name="robot-happy-outline" size={20} color="#fff" />
                </TouchableOpacity>

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
              onPress={() => go('/(tabs)/products')}
            />
            <MetricCard
              title="Low stock"
              value={`${stats.lowStock}`}
              subtitle="Need replenishment"
              icon="cube-outline"
              tone="yellow"
              onPress={() => go('/(tabs)/products?filter=low_stock')}
            />
            <MetricCard
              title="Near expiry"
              value={`${stats.nearExpiry}`}
              subtitle="Within 7 days"
              icon="time-outline"
              tone="red"
              onPress={() => go('/(tabs)/waste-expiry')}
            />
            <MetricCard
              title="High risk"
              value={`${stats.highRisk}`}
              subtitle="Require urgent review"
              icon="warning-outline"
              tone="purple"
              onPress={() => go('/(tabs)/products?filter=high_risk')}
            />
            <MetricCard
              title="Avg margin"
              value={`${Math.round(stats.avgMargin)}%`}
              subtitle="Across active products"
              icon="cash-outline"
              tone="blue"
              onPress={() => go('/(tabs)/products?filter=weak_margin')}
            />
            <MetricCard
              title="Pricing impact"
              value={formatCompactCurrency(stats.pricingImpact)}
              subtitle="Saved pricing runs"
              icon="sparkles-outline"
              tone="green"
              onPress={() => go('/(tabs)/pricing-history')}
            />
          </View>

          <SectionHeader
            eyebrow="Health"
            title="Business health score"
            subtitle="One number that blends expiry, stock, margin and risk pressure across your store."
          />

          <View style={styles.healthCard}>
            <HealthGauge
              score={health.healthScore}
              size={150}
              label="/100"
              caption={healthLabel(health.healthScore)}
            />

            <View style={styles.healthRight}>
              <View style={styles.healthStatRow}>
                <View style={[styles.healthStatDot, { backgroundColor: palette.danger }]} />
                <Text style={styles.healthStatText}>
                  {health.nearExpiry.length} near expiry • {health.expired.length} expired
                </Text>
              </View>
              <View style={styles.healthStatRow}>
                <View style={[styles.healthStatDot, { backgroundColor: palette.warning }]} />
                <Text style={styles.healthStatText}>
                  {health.lowStock.length} low stock • {health.outOfStock.length} out
                </Text>
              </View>
              <View style={styles.healthStatRow}>
                <View style={[styles.healthStatDot, { backgroundColor: palette.info }]} />
                <Text style={styles.healthStatText}>
                  {health.weakMargin.length} weak margin • {Math.round(health.avgMargin)}% avg
                </Text>
              </View>

              <TouchableOpacity
                style={styles.healthCopilotButton}
                activeOpacity={0.9}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  router.push('/(tabs)/copilot');
                }}
              >
                <MaterialCommunityIcons name="robot-happy-outline" size={16} color="#fff" />
                <Text style={styles.healthCopilotText}>Ask Copilot why</Text>
              </TouchableOpacity>
            </View>
          </View>

          <SectionHeader
            eyebrow="Actions"
            title="Quick actions"
            subtitle="Jump directly into the parts of the system that matter most."
          />

          <View style={styles.quickActionsWrap}>
            <QuickAction
              icon="chatbubbles-outline"
              title="Ask RiskLens Copilot"
              subtitle="Get instant answers about your store"
              onPress={() => router.push('/(tabs)/copilot')}
            />
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
    letterSpacing: 0,
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
    backgroundColor: 'rgba(255,255,255,0.88)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: palette.border,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
  },
  heroInsightItem: {
    flex: 1,
    alignItems: 'center',
  },
  heroInsightLabel: {
    color: palette.textMuted,
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 4,
    textAlign: 'center',
  },
  heroInsightValue: {
    color: palette.text,
    fontSize: 18,
    fontWeight: '900',
  },
  heroInsightValueSmall: {
    color: palette.text,
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
  },
  heroDivider: {
    width: 1,
    height: 32,
    backgroundColor: palette.borderStrong,
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
    letterSpacing: 0,
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
  metricTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  metricIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
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

  healthCard: {
    backgroundColor: palette.surface,
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: palette.border,
    marginBottom: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  healthRight: {
    flex: 1,
    paddingLeft: 8,
    gap: 10,
  },
  healthStatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  healthStatDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  healthStatText: {
    color: palette.textSoft,
    fontSize: 12,
    fontWeight: '700',
    flex: 1,
  },
  healthCopilotButton: {
    marginTop: 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: palette.primary2,
    borderRadius: 14,
    paddingVertical: 12,
  },
  healthCopilotText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '900',
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
