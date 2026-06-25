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
import { Ionicons, MaterialCommunityIcons, Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { supabase } from '../../lib/supabase';
import AppSidebar from '../../components/appsidebar';
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
  accent: '#42D392',

  danger: '#FF6B7A',
  warning: '#F7B955',
  success: '#42D392',
  info: '#5AA9FF',
  purple: '#A78BFA',
  cyan: '#4BE1EC',

  redSoft: '#FFF1F3',
  yellowSoft: '#FFF7E5',
  greenSoft: '#EAFBF3',
  blueSoft: '#EAF4FF',
  purpleSoft: '#F3EEFF',
  cyanSoft: '#E7FBFD',
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

type SupplierRollup = {
  supplier: string;
  productCount: number;
  highRiskCount: number;
  nearExpiryCount: number;
  lowStockCount: number;
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

function marginPercent(selling?: number | null, cost?: number | null) {
  const s = safeNumber(selling);
  const c = safeNumber(cost);
  if (s <= 0) return 0;
  return ((s - c) / s) * 100;
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

function TopMetric({
  title,
  value,
  subtitle,
  icon,
  tone = 'green',
  onPress,
}: {
  title: string;
  value: string;
  subtitle: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  tone?: 'green' | 'yellow' | 'red' | 'blue' | 'purple' | 'cyan';
  onPress?: () => void;
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
    <TouchableOpacity style={styles.topMetricCard} activeOpacity={0.88} onPress={onPress} disabled={!onPress}>
      <View style={styles.topMetricTopRow}>
        <View style={[styles.topMetricIconWrap, { backgroundColor: bgMap[tone] }]}>
          <Ionicons name={icon} size={18} color={colorMap[tone]} />
        </View>
        {onPress ? <Ionicons name="chevron-forward" size={16} color={palette.textMuted} /> : null}
      </View>
      <Text style={styles.topMetricValue}>{value}</Text>
      <Text style={styles.topMetricTitle}>{title}</Text>
      <Text style={styles.topMetricSubtitle}>{subtitle}</Text>
    </TouchableOpacity>
  );
}

function ActionCard({
  rank,
  title,
  body,
  impact,
  confidence,
  tone,
  icon,
}: {
  rank: number;
  title: string;
  body: string;
  impact: string;
  confidence: string;
  tone: 'red' | 'yellow' | 'green' | 'blue' | 'purple';
  icon: React.ComponentProps<typeof Ionicons>['name'];
}) {
  const toneColor = {
    red: palette.danger,
    yellow: palette.warning,
    green: palette.success,
    blue: palette.info,
    purple: palette.purple,
  }[tone];

  const toneBg = {
    red: palette.redSoft,
    yellow: palette.yellowSoft,
    green: palette.greenSoft,
    blue: palette.blueSoft,
    purple: palette.purpleSoft,
  }[tone];

  return (
    <View style={styles.actionCard}>
      <View style={styles.actionRankCol}>
        <View style={[styles.actionRank, { backgroundColor: toneBg }]}>
          <Text style={[styles.actionRankText, { color: toneColor }]}>{rank}</Text>
        </View>
        <View style={[styles.actionLine, { backgroundColor: toneColor }]} />
      </View>

      <View style={{ flex: 1 }}>
        <View style={styles.actionTitleRow}>
          <Ionicons name={icon} size={16} color={toneColor} />
          <Text style={styles.actionTitle}>{title}</Text>
        </View>
        <Text style={styles.actionBody}>{body}</Text>

        <View style={styles.actionMetaRow}>
          <View style={styles.metaBadge}>
            <Text style={styles.metaBadgeLabel}>Impact</Text>
            <Text style={[styles.metaBadgeValue, { color: toneColor }]}>{impact}</Text>
          </View>
          <View style={styles.metaBadge}>
            <Text style={styles.metaBadgeLabel}>Confidence</Text>
            <Text style={styles.metaBadgeValue}>{confidence}</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

function SmallInfoCard({
  title,
  value,
  subtitle,
}: {
  title: string;
  value: string;
  subtitle: string;
}) {
  return (
    <View style={styles.smallInfoCard}>
      <Text style={styles.smallInfoValue}>{value}</Text>
      <Text style={styles.smallInfoTitle}>{title}</Text>
      <Text style={styles.smallInfoSubtitle}>{subtitle}</Text>
    </View>
  );
}

export default function DecisionCenterScreen() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [products, setProducts] = useState<ProductRow[]>([]);
  const [alerts, setAlerts] = useState<AlertRow[]>([]);
  const [recommendations, setRecommendations] = useState<RecommendationRow[]>([]);

  const [sidebarOpen, setSidebarOpen] = useState(false);

  const loadData = useCallback(async (isRefresh = false) => {
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
    loadData();
  }, [loadData]);

  const overview = useMemo(() => {
    const totalProducts = products.length;

    const highRiskProducts = products.filter((p) => riskScore(p) >= 70).length;
    const lowStockProducts = products.filter((p) => {
      const stock = safeNumber(p.stock_quantity);
      const minStock = safeNumber(p.min_stock_level);
      return minStock > 0 ? stock <= minStock : stock <= 10;
    }).length;

    const nearExpiryProducts = products.filter((p) => {
      const d = daysUntil(p.expiry_date);
      return d !== null && d >= 0 && d <= 7;
    }).length;

    const weakMarginProducts = products.filter(
      (p) => marginPercent(p.selling_price, p.cost_price) < 15
    ).length;

    const wasteExposure = products.reduce((sum, p) => {
      const d = daysUntil(p.expiry_date);
      const stock = safeNumber(p.stock_quantity);
      if (d !== null && d >= 0 && d <= 5) {
        return sum + stock * safeNumber(p.cost_price);
      }
      return sum;
    }, 0);

    const totalRecommendationImpact = recommendations.reduce(
      (sum, r) => sum + safeNumber(r.impact_value),
      0
    );

    return {
      totalProducts,
      highRiskProducts,
      lowStockProducts,
      nearExpiryProducts,
      weakMarginProducts,
      wasteExposure,
      totalRecommendationImpact,
      totalAlerts: alerts.length,
    };
  }, [products, alerts, recommendations]);

  const priorityStack = useMemo(() => {
    const discountCount = recommendations.filter((r) => r.recommendation_type === 'discount').length;
    const restockCount = recommendations.filter((r) => r.recommendation_type === 'restock').length;
    const priceUpCount = recommendations.filter((r) => r.recommendation_type === 'price_up').length;

    const actions = [
      {
        title: 'Clear expiring products',
        body:
          overview.nearExpiryProducts > 0
            ? `${overview.nearExpiryProducts} products are approaching expiry. Prioritize markdowns and front-shelf placement.`
            : 'Expiry pressure is currently under control.',
        impact: formatCompactCurrency(overview.wasteExposure),
        confidence: overview.nearExpiryProducts > 0 ? 'High' : 'Low',
        tone: (overview.nearExpiryProducts > 0 ? 'red' : 'green') as
          | 'red'
          | 'green',
        icon: 'time-outline' as const,
        score: overview.nearExpiryProducts,
      },
      {
        title: 'Restock sales-sensitive products',
        body:
          overview.lowStockProducts > 0
            ? `${overview.lowStockProducts} products are below safe stock levels and may cause missed sales.`
            : 'Low-stock pressure is limited right now.',
        impact: `${restockCount} recs`,
        confidence: overview.lowStockProducts > 0 ? 'High' : 'Low',
        tone: (overview.lowStockProducts > 0 ? 'yellow' : 'green') as
          | 'yellow'
          | 'green',
        icon: 'cube-outline' as const,
        score: overview.lowStockProducts,
      },
      {
        title: 'Correct weak-margin pricing',
        body:
          overview.weakMarginProducts > 0
            ? `${overview.weakMarginProducts} products have weak margin and should be reviewed for pricing or supplier negotiation.`
            : 'Margin health looks stable.',
        impact: `${priceUpCount} recs`,
        confidence: overview.weakMarginProducts > 0 ? 'Medium' : 'Low',
        tone: (overview.weakMarginProducts > 0 ? 'blue' : 'green') as
          | 'blue'
          | 'green',
        icon: 'cash-outline' as const,
        score: overview.weakMarginProducts,
      },
      {
        title: 'Resolve critical risk items',
        body:
          overview.highRiskProducts > 0
            ? `${overview.highRiskProducts} products are currently marked high risk and should be reviewed first.`
            : 'No critical risk cluster is currently detected.',
        impact: `${discountCount + restockCount} actions`,
        confidence: overview.highRiskProducts > 0 ? 'High' : 'Low',
        tone: (overview.highRiskProducts > 0 ? 'purple' : 'green') as
          | 'purple'
          | 'green',
        icon: 'warning-outline' as const,
        score: overview.highRiskProducts,
      },
    ];

    return actions.sort((a, b) => b.score - a.score);
  }, [overview, recommendations]);

  const supplierRollup = useMemo(() => {
    const map = new Map<string, SupplierRollup>();

    for (const p of products) {
      const supplier = p.supplier_name?.trim() || 'Unknown Supplier';
      const current = map.get(supplier) || {
        supplier,
        productCount: 0,
        highRiskCount: 0,
        nearExpiryCount: 0,
        lowStockCount: 0,
      };

      const stock = safeNumber(p.stock_quantity);
      const minStock = safeNumber(p.min_stock_level);
      const d = daysUntil(p.expiry_date);
      const risk = riskScore(p);

      current.productCount += 1;
      if (risk >= 70) current.highRiskCount += 1;
      if (d !== null && d >= 0 && d <= 7) current.nearExpiryCount += 1;
      if (minStock > 0 ? stock <= minStock : stock <= 10) current.lowStockCount += 1;

      map.set(supplier, current);
    }

    return Array.from(map.values()).sort((a, b) => b.highRiskCount - a.highRiskCount);
  }, [products]);

  const topRecommendations = useMemo(() => {
    return [...recommendations]
      .sort((a, b) => safeNumber(b.impact_value) - safeNumber(a.impact_value))
      .slice(0, 5);
  }, [recommendations]);

  const latestAlerts = useMemo(() => alerts.slice(0, 5), [alerts]);

  const onRefresh = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await loadData(true);
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

              <TouchableOpacity
                style={styles.heroButton}
                onPress={() => router.push('/(tabs)')}
              >
                <Ionicons name="grid-outline" size={20} color="#fff" />
              </TouchableOpacity>
            </View>

            <View style={styles.heroMain}>
              <View style={styles.heroIconWrap}>
                <MaterialCommunityIcons name="lightning-bolt-outline" size={26} color="#fff" />
              </View>

              <View style={{ flex: 1 }}>
                <Text style={styles.heroEyebrow}>Action-first workspace</Text>
                <Text style={styles.heroTitle}>Decision Center</Text>
                <Text style={styles.heroSubtitle}>
                  One page for what matters now: risk, waste, replenishment, pricing and the next best actions.
                </Text>
              </View>
            </View>

            <View style={styles.heroInsightBand}>
              <View style={styles.heroInsightItem}>
                <Text style={styles.heroInsightLabel}>Waste exposure</Text>
                <Text style={styles.heroInsightValue}>
                  {formatCompactCurrency(overview.wasteExposure)}
                </Text>
              </View>

              <View style={styles.heroDivider} />

              <View style={styles.heroInsightItem}>
                <Text style={styles.heroInsightLabel}>Recoverable impact</Text>
                <Text style={styles.heroInsightValue}>
                  {formatCompactCurrency(overview.totalRecommendationImpact)}
                </Text>
              </View>

              <View style={styles.heroDivider} />

              <View style={styles.heroInsightItem}>
                <Text style={styles.heroInsightLabel}>Urgent products</Text>
                <Text style={styles.heroInsightValue}>{overview.highRiskProducts}</Text>
              </View>
            </View>
          </LinearGradient>

          <SectionHeader
            eyebrow="Priority"
            title="What to do next"
            subtitle="This page is designed to answer the next business move, not just show numbers."
          />

          <View style={styles.actionStack}>
            {priorityStack.map((item, index) => (
              <ActionCard
                key={item.title}
                rank={index + 1}
                title={item.title}
                body={item.body}
                impact={item.impact}
                confidence={item.confidence}
                tone={item.tone}
                icon={item.icon}
              />
            ))}
          </View>

          <SectionHeader
            eyebrow="Signals"
            title="Decision summary"
            subtitle="High-level indicators for pressure, opportunity and inventory quality."
          />

          <View style={styles.metricsGrid}>
            <TopMetric
              title="Products"
              value={`${overview.totalProducts}`}
              subtitle="Tracked inventory items"
              icon="basket-outline"
              tone="green"
              onPress={() => go('/(tabs)/products')}
            />
            <TopMetric
              title="Low stock"
              value={`${overview.lowStockProducts}`}
              subtitle="Require replenishment"
              icon="cube-outline"
              tone="yellow"
              onPress={() => go('/(tabs)/products?filter=low_stock')}
            />
            <TopMetric
              title="Near expiry"
              value={`${overview.nearExpiryProducts}`}
              subtitle="Within 7 days"
              icon="time-outline"
              tone="red"
              onPress={() => go('/(tabs)/waste-expiry')}
            />
            <TopMetric
              title="Weak margin"
              value={`${overview.weakMarginProducts}`}
              subtitle="Below target margin"
              icon="cash-outline"
              tone="blue"
              onPress={() => go('/(tabs)/products?filter=weak_margin')}
            />
            <TopMetric
              title="Alerts"
              value={`${overview.totalAlerts}`}
              subtitle="Operational signals"
              icon="notifications-outline"
              tone="purple"
              onPress={() => go('/(tabs)/alerts-center')}
            />
            <TopMetric
              title="Recommendation impact"
              value={formatCompactCurrency(overview.totalRecommendationImpact)}
              subtitle="Estimated value"
              icon="sparkles-outline"
              tone="cyan"
              onPress={() => go('/(tabs)/recommendations-center')}
            />
          </View>

          <SectionHeader
            eyebrow="Focus"
            title="Where pressure is coming from"
            subtitle="The strongest hotspots right now across suppliers, alerts and recommendations."
          />

          <View style={styles.infoGrid}>
            <SmallInfoCard
              title="Top supplier under pressure"
              value={supplierRollup[0]?.supplier || '—'}
              subtitle={
                supplierRollup[0]
                  ? `${supplierRollup[0].highRiskCount} high risk items`
                  : 'No supplier pressure yet'
              }
            />
            <SmallInfoCard
              title="Latest alert level"
              value={
                latestAlerts[0]?.severity
                  ? latestAlerts[0].severity.toUpperCase()
                  : 'NONE'
              }
              subtitle={latestAlerts[0]?.title || 'No active alerts'}
            />
            <SmallInfoCard
              title="Best opportunity"
              value={
                topRecommendations[0]
                  ? formatCompactCurrency(topRecommendations[0].impact_value)
                  : '€0'
              }
              subtitle={topRecommendations[0]?.product_name || 'No recommendation yet'}
            />
          </View>

          <SectionHeader
            eyebrow="Suppliers"
            title="Supplier watch"
            subtitle="Which suppliers are connected to the most risk right now."
          />

          <View style={styles.cardBlock}>
            {supplierRollup.length > 0 ? (
              supplierRollup.slice(0, 6).map((supplier) => (
                <View key={supplier.supplier} style={styles.rowCard}>
                  <View style={styles.rowMain}>
                    <View style={styles.rowIconWrap}>
                      <Feather name="truck" size={18} color={palette.info} />
                    </View>

                    <View style={{ flex: 1 }}>
                      <Text style={styles.rowTitle}>{supplier.supplier}</Text>
                      <Text style={styles.rowSubtitle}>
                        {supplier.productCount} products • {supplier.lowStockCount} low stock • {supplier.nearExpiryCount} expiring
                      </Text>
                    </View>
                  </View>

                  <Text style={styles.rowValue}>{supplier.highRiskCount} risk</Text>
                </View>
              ))
            ) : (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyTitle}>No supplier pressure yet</Text>
                <Text style={styles.emptySubtitle}>
                  Supplier intelligence will appear as your product data grows.
                </Text>
              </View>
            )}
          </View>

          <SectionHeader
            eyebrow="Recommendations"
            title="Top opportunities"
            subtitle="Highest-impact actions generated by the system."
          />

          <View style={styles.cardBlock}>
            {topRecommendations.length > 0 ? (
              topRecommendations.map((rec) => (
                <View key={rec.id} style={styles.rowCard}>
                  <View style={styles.rowMain}>
                    <View style={styles.rowIconWrap}>
                      <Ionicons name="sparkles-outline" size={18} color={palette.primary2} />
                    </View>

                    <View style={{ flex: 1 }}>
                      <Text style={styles.rowTitle}>{rec.product_name}</Text>
                      <Text style={styles.rowSubtitle}>{rec.message}</Text>
                    </View>
                  </View>

                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={styles.rowValue}>{formatCompactCurrency(rec.impact_value)}</Text>
                    <Text style={styles.rowMini}>{rec.recommendation_type}</Text>
                  </View>
                </View>
              ))
            ) : (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyTitle}>No recommendation opportunities yet</Text>
                <Text style={styles.emptySubtitle}>
                  Upload product inventory to unlock recommended actions.
                </Text>
              </View>
            )}
          </View>

          <SectionHeader
            eyebrow="Alerts"
            title="Latest issues"
            subtitle="The most recent warning signals across the business."
          />

          <View style={styles.cardBlock}>
            {latestAlerts.length > 0 ? (
              latestAlerts.map((alert) => (
                <View key={alert.id} style={styles.rowCard}>
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
                </View>
              ))
            ) : (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyTitle}>No recent alerts</Text>
                <Text style={styles.emptySubtitle}>
                  Alerts will appear here when issues are detected.
                </Text>
              </View>
            )}
          </View>

          <View style={{ height: 28 }} />
        </ScrollView>

        <AppSidebar
          visible={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          active="decision-center"
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
    paddingHorizontal: 24,
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
    width: 54,
    height: 54,
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
    fontSize: 28,
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

  actionStack: {
    gap: 12,
    marginBottom: 20,
  },
  actionCard: {
    flexDirection: 'row',
    backgroundColor: palette.surface,
    borderRadius: 24,
    padding: 16,
    borderWidth: 1,
    borderColor: palette.border,
  },
  actionRankCol: {
    alignItems: 'center',
    marginRight: 12,
  },
  actionRank: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionRankText: {
    fontSize: 15,
    fontWeight: '900',
  },
  actionLine: {
    width: 2,
    flex: 1,
    marginTop: 8,
    borderRadius: 2,
    opacity: 0.25,
  },
  actionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  actionTitle: {
    color: palette.text,
    fontSize: 16,
    fontWeight: '900',
    flex: 1,
  },
  actionBody: {
    color: palette.textSoft,
    fontSize: 13,
    lineHeight: 20,
    fontWeight: '500',
  },
  actionMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  metaBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: palette.surfaceSoft,
  },
  metaBadgeLabel: {
    color: palette.textMuted,
    fontSize: 11,
    fontWeight: '700',
  },
  metaBadgeValue: {
    color: palette.text,
    fontSize: 11,
    fontWeight: '900',
  },

  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 18,
  },
  topMetricCard: {
    width: '48.2%',
    backgroundColor: palette.surface,
    borderRadius: 22,
    padding: 16,
    borderWidth: 1,
    borderColor: palette.border,
  },
  topMetricTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  topMetricIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topMetricValue: {
    color: palette.text,
    fontSize: 24,
    fontWeight: '900',
    marginBottom: 4,
  },
  topMetricTitle: {
    color: palette.textSoft,
    fontSize: 13,
    fontWeight: '800',
  },
  topMetricSubtitle: {
    color: palette.textMuted,
    fontSize: 11,
    lineHeight: 16,
    marginTop: 6,
    fontWeight: '500',
  },

  infoGrid: {
    gap: 12,
    marginBottom: 18,
  },
  smallInfoCard: {
    backgroundColor: palette.surface,
    borderRadius: 22,
    padding: 16,
    borderWidth: 1,
    borderColor: palette.border,
  },
  smallInfoValue: {
    color: palette.text,
    fontSize: 22,
    fontWeight: '900',
    marginBottom: 6,
  },
  smallInfoTitle: {
    color: palette.textSoft,
    fontSize: 13,
    fontWeight: '800',
  },
  smallInfoSubtitle: {
    color: palette.textMuted,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 6,
    fontWeight: '500',
  },

  cardBlock: {
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
