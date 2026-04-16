import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialCommunityIcons, Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import Svg, { Circle } from 'react-native-svg';
import { supabase } from '../../lib/supabase';

const { width } = Dimensions.get('window');
const cardGap = 12;
const cardWidth = (width - 18 * 2 - cardGap - 4) / 2;

const palette = {
  bg: '#F4FAF7',
  bg2: '#ECFDF3',
  bg3: '#E6FFF1',
  card: '#FFFFFF',
  cardSoft: '#F8FFFB',
  cardMint: '#F0FFF7',
  border: '#D9F7E5',
  borderStrong: '#B7ECCC',
  text: '#0F172A',
  textSoft: '#334155',
  textMuted: '#64748B',
  primary: '#22C55E',
  primary2: '#16A34A',
  primary3: '#4ADE80',
  success: '#10B981',
  warning: '#F59E0B',
  danger: '#EF4444',
  info: '#3B82F6',
  purple: '#8B5CF6',
  cyan: '#06B6D4',
  pink: '#EC4899',
  orange: '#F97316',
  yellowSoft: '#FFF8DB',
  redSoft: '#FFF0F0',
  greenSoft: '#ECFDF3',
  blueSoft: '#EEF6FF',
  purpleSoft: '#F5F3FF',
};

type Profile = {
  id: string;
  full_name?: string | null;
  business_name?: string | null;
};

type ProductRow = {
  id: string;
  name: string;
  category?: string | null;
  sku?: string | null;
  barcode?: string | null;
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
};

type RecommendationRow = {
  id: string;
  product_name: string;
  recommendation_type: 'discount' | 'restock' | 'price_up' | 'price_down';
  message: string;
  impact_value?: number | null;
  created_at?: string | null;
};

type CategoryMetric = {
  name: string;
  product_count: number;
  total_stock: number;
  avg_margin: number;
  near_expiry_count: number;
};

function formatCurrency(value?: number | null) {
  const safe = Number(value || 0);
  return `€${safe.toFixed(2)}`;
}

function formatCompactCurrency(value?: number | null) {
  const safe = Number(value || 0);
  if (safe >= 1000) return `€${(safe / 1000).toFixed(1)}k`;
  return `€${safe.toFixed(0)}`;
}

function formatDate(value?: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  return date.toLocaleDateString();
}

function daysUntil(dateString?: string | null) {
  if (!dateString) return null;
  const today = new Date();
  const target = new Date(dateString);
  today.setHours(0, 0, 0, 0);
  target.setHours(0, 0, 0, 0);
  const diff = target.getTime() - today.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function initials(name?: string | null) {
  if (!name) return 'RL';
  const parts = name.trim().split(' ').filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

function safeNumber(value?: number | null) {
  return Number(value || 0);
}

function marginPercent(selling?: number | null, cost?: number | null) {
  const s = safeNumber(selling);
  const c = safeNumber(cost);
  if (s <= 0) return 0;
  return ((s - c) / s) * 100;
}

function severityColor(severity?: string | null) {
  if (severity === 'high') return palette.danger;
  if (severity === 'medium') return palette.warning;
  return palette.info;
}

function severityBg(severity?: string | null) {
  if (severity === 'high') return palette.redSoft;
  if (severity === 'medium') return palette.yellowSoft;
  return palette.blueSoft;
}

function recommendationColor(type: RecommendationRow['recommendation_type']) {
  if (type === 'discount') return palette.orange;
  if (type === 'restock') return palette.info;
  if (type === 'price_up') return palette.success;
  return palette.purple;
}

function recommendationIcon(type: RecommendationRow['recommendation_type']) {
  if (type === 'discount') return 'pricetag-outline';
  if (type === 'restock') return 'cube-outline';
  if (type === 'price_up') return 'trending-up-outline';
  return 'trending-down-outline';
}

function riskScoreForProduct(item: ProductRow) {
  const stock = safeNumber(item.stock_quantity);
  const minStock = safeNumber(item.min_stock_level);
  const expiry = daysUntil(item.expiry_date);
  let score = 0;

  if (expiry !== null) {
    if (expiry <= 0) score += 45;
    else if (expiry <= 2) score += 35;
    else if (expiry <= 5) score += 25;
    else if (expiry <= 7) score += 15;
  }

  if (minStock > 0 && stock <= minStock) score += 20;
  if (stock <= 5) score += 20;
  if (marginPercent(item.selling_price, item.cost_price) < 15) score += 10;

  return Math.min(100, score);
}

function progressColor(value: number) {
  if (value >= 70) return palette.danger;
  if (value >= 40) return palette.warning;
  return palette.success;
}

function buildCategoryMetrics(products: ProductRow[]): CategoryMetric[] {
  const map = new Map<string, CategoryMetric>();

  for (const product of products) {
    const category = product.category?.trim() || 'Uncategorized';
    const current = map.get(category) || {
      name: category,
      product_count: 0,
      total_stock: 0,
      avg_margin: 0,
      near_expiry_count: 0,
    };

    current.product_count += 1;
    current.total_stock += safeNumber(product.stock_quantity);
    current.avg_margin += marginPercent(product.selling_price, product.cost_price);

    const expiry = daysUntil(product.expiry_date);
    if (expiry !== null && expiry >= 0 && expiry <= 7) {
      current.near_expiry_count += 1;
    }

    map.set(category, current);
  }

  return Array.from(map.values())
    .map((item) => ({
      ...item,
      avg_margin: item.product_count ? item.avg_margin / item.product_count : 0,
    }))
    .sort((a, b) => b.product_count - a.product_count);
}

function SectionHeader({
  title,
  subtitle,
  actionLabel,
  onPress,
}: {
  title: string;
  subtitle?: string;
  actionLabel?: string;
  onPress?: () => void;
}) {
  return (
    <View style={styles.sectionHeader}>
      <View style={{ flex: 1, paddingRight: 12 }}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {!!subtitle && <Text style={styles.sectionSubtitle}>{subtitle}</Text>}
      </View>
      {actionLabel && onPress ? (
        <TouchableOpacity onPress={onPress} style={styles.sectionAction}>
          <Text style={styles.sectionActionText}>{actionLabel}</Text>
          <Ionicons name="arrow-forward" size={14} color={palette.primary2} />
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

function StatCard({
  title,
  value,
  subtitle,
  icon,
  tone = 'primary',
}: {
  title: string;
  value: string;
  subtitle: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  tone?: 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'purple' | 'cyan';
}) {
  const toneMap = {
    primary: [palette.primary, palette.primary2],
    success: [palette.success, '#059669'],
    warning: [palette.warning, '#D97706'],
    danger: [palette.danger, '#DC2626'],
    info: [palette.info, '#2563EB'],
    purple: [palette.purple, '#7C3AED'],
    cyan: [palette.cyan, '#0891B2'],
  } as const;

  return (
    <View style={styles.statCard}>
      <LinearGradient colors={toneMap[tone]} style={styles.statIconWrap}>
        <Ionicons name={icon} size={18} color="#fff" />
      </LinearGradient>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statTitle}>{title}</Text>
      <Text style={styles.statSubtitle}>{subtitle}</Text>
    </View>
  );
}

function CleanStatCard({
  title,
  value,
  subtitle,
  icon,
}: {
  title: string;
  value: string;
  subtitle: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
}) {
  return (
    <View style={styles.cleanStatCard}>
      <View style={styles.cleanStatIconWrap}>
        <Ionicons name={icon} size={18} color={palette.primary2} />
      </View>
      <Text style={styles.cleanStatValue}>{value}</Text>
      <Text style={styles.cleanStatTitle}>{title}</Text>
      <Text style={styles.cleanStatSubtitle}>{subtitle}</Text>
    </View>
  );
}

function MiniInsightCard({
  title,
  value,
  subtitle,
  icon,
  bg,
  iconColor,
}: {
  title: string;
  value: string;
  subtitle: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  bg: string;
  iconColor: string;
}) {
  return (
    <View style={[styles.miniInsightCard, { backgroundColor: bg }]}>
      <View style={styles.miniInsightTop}>
        <Text style={styles.miniInsightTitle}>{title}</Text>
        <Ionicons name={icon} size={18} color={iconColor} />
      </View>
      <Text style={styles.miniInsightValue}>{value}</Text>
      <Text style={styles.miniInsightSubtitle}>{subtitle}</Text>
    </View>
  );
}

function ProgressPill({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: 'success' | 'warning' | 'danger' | 'info';
}) {
  const bgMap = {
    success: palette.greenSoft,
    warning: palette.yellowSoft,
    danger: palette.redSoft,
    info: palette.blueSoft,
  } as const;

  const textMap = {
    success: palette.success,
    warning: palette.warning,
    danger: palette.danger,
    info: palette.info,
  } as const;

  return (
    <View style={[styles.progressPill, { backgroundColor: bgMap[tone] }]}>
      <Text style={[styles.progressPillLabel, { color: textMap[tone] }]}>{label}</Text>
      <Text style={[styles.progressPillValue, { color: textMap[tone] }]}>{value}</Text>
    </View>
  );
}

function SimpleInfoRow({
  label,
  value,
  valueColor,
}: {
  label: string;
  value: string;
  valueColor?: string;
}) {
  return (
    <View style={styles.simpleInfoRow}>
      <Text style={styles.simpleInfoLabel}>{label}</Text>
      <Text style={[styles.simpleInfoValue, valueColor ? { color: valueColor } : null]}>
        {value}
      </Text>
    </View>
  );
}

function PieChartCard({
  title,
  subtitle,
  data,
}: {
  title: string;
  subtitle?: string;
  data: { label: string; value: number; color: string }[];
}) {
  const total = data.reduce((sum, item) => sum + Math.max(0, item.value), 0);
  const size = 118;
  const strokeWidth = 16;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  let cumulative = 0;

  return (
    <View style={styles.pieCard}>
      <Text style={styles.pieCardTitle}>{title}</Text>
      {!!subtitle && <Text style={styles.pieCardSubtitle}>{subtitle}</Text>}

      <View style={styles.pieCardContent}>
        <View style={styles.pieWrap}>
          <Svg width={size} height={size}>
            <Circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              stroke="#EAEFF4"
              strokeWidth={strokeWidth}
              fill="none"
            />
            {total > 0 &&
              data.map((item, index) => {
                const value = Math.max(0, item.value);
                const segmentLength = (value / total) * circumference;
                const dashArray = `${segmentLength} ${circumference - segmentLength}`;
                const dashOffset = -cumulative;
                cumulative += segmentLength;

                return (
                  <Circle
                    key={`${item.label}-${index}`}
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    stroke={item.color}
                    strokeWidth={strokeWidth}
                    fill="none"
                    strokeDasharray={dashArray}
                    strokeDashoffset={dashOffset}
                    rotation="-90"
                    origin={`${size / 2}, ${size / 2}`}
                    strokeLinecap="butt"
                  />
                );
              })}
          </Svg>

          <View style={styles.pieCenter}>
            <Text style={styles.pieCenterValue}>{total}</Text>
            <Text style={styles.pieCenterLabel}>Total</Text>
          </View>
        </View>

        <View style={styles.pieLegend}>
          {data.map((item) => (
            <View key={item.label} style={styles.pieLegendRow}>
              <View style={[styles.pieLegendDot, { backgroundColor: item.color }]} />
              <Text style={styles.pieLegendLabel}>{item.label}</Text>
              <Text style={styles.pieLegendValue}>{item.value}</Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

function RiskProductCard({ item }: { item: ProductRow }) {
  const expiry = daysUntil(item.expiry_date);
  const stock = safeNumber(item.stock_quantity);
  const minStock = safeNumber(item.min_stock_level);
  const margin = marginPercent(item.selling_price, item.cost_price);
  const risk = riskScoreForProduct(item);

  return (
    <View style={styles.riskProductCard}>
      <View style={styles.riskProductLeft}>
        <View style={styles.foodIconWrap}>
          <MaterialCommunityIcons name="food-variant" size={20} color={palette.primary2} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.riskProductTitle}>{item.name}</Text>
          <Text style={styles.riskProductMeta}>
            {item.category || 'General'} • Supplier: {item.supplier_name || 'N/A'}
          </Text>
          <View style={styles.riskTagRow}>
            <View style={styles.softTag}>
              <Text style={styles.softTagText}>Stock {stock}</Text>
            </View>
            <View style={styles.softTag}>
              <Text style={styles.softTagText}>Min {minStock}</Text>
            </View>
            <View style={styles.softTag}>
              <Text style={styles.softTagText}>Margin {margin.toFixed(0)}%</Text>
            </View>
            <View style={styles.softTag}>
              <Text style={styles.softTagText}>
                Exp {expiry === null ? '—' : `${expiry}d`}
              </Text>
            </View>
          </View>
        </View>
      </View>

      <View style={styles.riskMeterWrap}>
        <Text style={styles.riskMeterValue}>{risk}%</Text>
        <Text style={styles.riskMeterLabel}>Risk</Text>
      </View>
    </View>
  );
}

function AlertCard({ item }: { item: AlertRow }) {
  const color = severityColor(item.severity);
  const bg = severityBg(item.severity);

  return (
    <View style={styles.alertCard}>
      <View style={[styles.alertIconWrap, { backgroundColor: bg }]}>
        <Ionicons name="warning-outline" size={18} color={color} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.alertTitle}>{item.title}</Text>
        <Text style={styles.alertDescription}>
          {item.description || 'No description provided.'}
        </Text>
        <Text style={styles.alertTime}>{formatDate(item.created_at)}</Text>
      </View>
    </View>
  );
}

function RecommendationCard({ item }: { item: RecommendationRow }) {
  const color = recommendationColor(item.recommendation_type);

  return (
    <View style={styles.recommendationCard}>
      <View style={[styles.recommendationIconWrap, { backgroundColor: `${color}15` }]}>
        <Ionicons
          name={recommendationIcon(item.recommendation_type)}
          size={18}
          color={color}
        />
      </View>

      <View style={{ flex: 1 }}>
        <Text style={styles.recommendationTitle}>{item.product_name}</Text>
        <Text style={styles.recommendationMessage}>{item.message}</Text>
      </View>

      <View style={styles.recommendationValueWrap}>
        <Text style={[styles.recommendationValue, { color }]}>
          {formatCompactCurrency(item.impact_value)}
        </Text>
        <Text style={styles.recommendationValueLabel}>impact</Text>
      </View>
    </View>
  );
}

function CategoryCard({ item, maxCount }: { item: CategoryMetric; maxCount: number }) {
  const percent = maxCount > 0 ? (item.product_count / maxCount) * 100 : 0;

  return (
    <View style={styles.categoryCard}>
      <View style={styles.categoryTop}>
        <Text style={styles.categoryName}>{item.name}</Text>
        <Text style={styles.categoryProducts}>{item.product_count} products</Text>
      </View>

      <View style={styles.categoryBarTrack}>
        <View style={[styles.categoryBarFill, { width: `${percent}%` }]} />
      </View>

      <View style={styles.categoryMetricsRow}>
        <View style={styles.categoryMetricItem}>
          <Text style={styles.categoryMetricValue}>{item.total_stock}</Text>
          <Text style={styles.categoryMetricLabel}>Stock</Text>
        </View>
        <View style={styles.categoryMetricItem}>
          <Text style={styles.categoryMetricValue}>{item.avg_margin.toFixed(0)}%</Text>
          <Text style={styles.categoryMetricLabel}>Margin</Text>
        </View>
        <View style={styles.categoryMetricItem}>
          <Text style={styles.categoryMetricValue}>{item.near_expiry_count}</Text>
          <Text style={styles.categoryMetricLabel}>Expiring</Text>
        </View>
      </View>
    </View>
  );
}

function SupplierCard({
  supplier,
  productCount,
  riskyCount,
}: {
  supplier: string;
  productCount: number;
  riskyCount: number;
}) {
  const health = riskyCount === 0 ? 'Stable' : riskyCount <= 2 ? 'Watch' : 'Risky';
  const color =
    health === 'Stable' ? palette.success : health === 'Watch' ? palette.warning : palette.danger;

  return (
    <View style={styles.supplierCard}>
      <View style={styles.supplierTop}>
        <View style={styles.supplierIconWrap}>
          <Feather name="truck" size={18} color={palette.info} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.supplierName}>{supplier}</Text>
          <Text style={styles.supplierMeta}>{productCount} linked products</Text>
        </View>
        <View style={[styles.healthBadge, { backgroundColor: `${color}15` }]}>
          <Text style={[styles.healthBadgeText, { color }]}>{health}</Text>
        </View>
      </View>
      <Text style={styles.supplierRiskText}>{riskyCount} products need attention</Text>
    </View>
  );
}

function EmptyCard({
  title,
  subtitle,
  icon,
}: {
  title: string;
  subtitle: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
}) {
  return (
    <View style={styles.emptyCard}>
      <View style={styles.emptyIconWrap}>
        <Ionicons name={icon} size={22} color={palette.primary2} />
      </View>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptySubtitle}>{subtitle}</Text>
    </View>
  );
}

export default function FoodDashboardScreen() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [profile, setProfile] = useState<Profile | null>(null);
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [alerts, setAlerts] = useState<AlertRow[]>([]);
  const [recommendations, setRecommendations] = useState<RecommendationRow[]>([]);

  const loadDashboard = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);

      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError) throw authError;

      if (!user) {
        router.replace('/login');
        return;
      }

      const [profileRes, productsRes, alertsRes, recommendationsRes] = await Promise.all([
        supabase
          .from('profiles')
          .select('id, full_name, business_name')
          .eq('id', user.id)
          .maybeSingle(),

        supabase
          .from('food_products')
          .select(
            'id, name, category, sku, barcode, stock_quantity, min_stock_level, selling_price, cost_price, expiry_date, supplier_name, status'
          )
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(120),

        supabase
          .from('food_alerts')
          .select('id, title, description, severity, created_at')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(10),

        supabase
          .from('food_recommendations')
          .select('id, product_name, recommendation_type, message, impact_value, created_at')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(12),
      ]);

      if (profileRes.error) throw profileRes.error;
      if (productsRes.error) throw productsRes.error;
      if (alertsRes.error) throw alertsRes.error;
      if (recommendationsRes.error) throw recommendationsRes.error;

      setProfile(profileRes.data || null);
      setProducts((productsRes.data as ProductRow[]) || []);
      setAlerts((alertsRes.data as AlertRow[]) || []);
      setRecommendations((recommendationsRes.data as RecommendationRow[]) || []);
    } catch (error: any) {
      Alert.alert('Dashboard error', error?.message || 'Failed to load dashboard.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const displayName =
    profile?.business_name?.trim() ||
    profile?.full_name?.trim() ||
    'Food Retail Business';

  const greeting = (() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  })();

  const stats = useMemo(() => {
    const totalProducts = products.length;

    const totalStock = products.reduce((sum, p) => sum + safeNumber(p.stock_quantity), 0);

    const inventoryValue = products.reduce(
      (sum, p) => sum + safeNumber(p.stock_quantity) * safeNumber(p.cost_price),
      0
    );

    const potentialRevenue = products.reduce(
      (sum, p) => sum + safeNumber(p.stock_quantity) * safeNumber(p.selling_price),
      0
    );

    const lowStock = products.filter((p) => {
      const stock = safeNumber(p.stock_quantity);
      const min = safeNumber(p.min_stock_level);
      return min > 0 ? stock <= min : stock <= 10;
    }).length;

    const outOfStock = products.filter((p) => safeNumber(p.stock_quantity) <= 0).length;

    const nearExpiry = products.filter((p) => {
      const days = daysUntil(p.expiry_date);
      return days !== null && days >= 0 && days <= 7;
    }).length;

    const expiresToday = products.filter((p) => {
      const days = daysUntil(p.expiry_date);
      return days !== null && days === 0;
    }).length;

    const expired = products.filter((p) => {
      const days = daysUntil(p.expiry_date);
      return days !== null && days < 0;
    }).length;

    const wasteRisk = products.filter((p) => {
      const days = daysUntil(p.expiry_date);
      const stock = safeNumber(p.stock_quantity);
      return days !== null && days <= 5 && stock >= 8;
    }).length;

    const highRiskProducts = products.filter((p) => riskScoreForProduct(p) >= 70).length;

    const margins = products
      .filter((p) => safeNumber(p.selling_price) > 0)
      .map((p) => marginPercent(p.selling_price, p.cost_price));

    const avgMargin =
      margins.length > 0
        ? margins.reduce((sum, current) => sum + current, 0) / margins.length
        : 0;

    const weakMargin = products.filter(
      (p) => marginPercent(p.selling_price, p.cost_price) < 15
    ).length;

    return {
      totalProducts,
      totalStock,
      inventoryValue,
      potentialRevenue,
      lowStock,
      outOfStock,
      nearExpiry,
      expiresToday,
      expired,
      wasteRisk,
      highRiskProducts,
      avgMargin,
      weakMargin,
      activeAlerts: alerts.length,
    };
  }, [products, alerts]);

  const categoryMetrics = useMemo(() => buildCategoryMetrics(products), [products]);

  const topRiskProducts = useMemo(() => {
    return [...products]
      .sort((a, b) => riskScoreForProduct(b) - riskScoreForProduct(a))
      .slice(0, 6);
  }, [products]);

  const discountRecommendations = useMemo(
    () => recommendations.filter((r) => r.recommendation_type === 'discount').slice(0, 4),
    [recommendations]
  );

  const restockRecommendations = useMemo(
    () => recommendations.filter((r) => r.recommendation_type === 'restock').slice(0, 4),
    [recommendations]
  );

  const priceRecommendations = useMemo(
    () =>
      recommendations
        .filter(
          (r) =>
            r.recommendation_type === 'price_up' || r.recommendation_type === 'price_down'
        )
        .slice(0, 4),
    [recommendations]
  );

  const supplierSummary = useMemo(() => {
    const map = new Map<string, { productCount: number; riskyCount: number }>();

    for (const product of products) {
      const supplier = product.supplier_name?.trim() || 'Unknown Supplier';
      const current = map.get(supplier) || { productCount: 0, riskyCount: 0 };
      current.productCount += 1;
      if (riskScoreForProduct(product) >= 70) current.riskyCount += 1;
      map.set(supplier, current);
    }

    return Array.from(map.entries())
      .map(([supplier, data]) => ({
        supplier,
        productCount: data.productCount,
        riskyCount: data.riskyCount,
      }))
      .sort((a, b) => b.productCount - a.productCount)
      .slice(0, 5);
  }, [products]);

  const complianceSummary = useMemo(() => {
    const missingBarcode = products.filter((p) => !p.barcode).length;
    const missingSku = products.filter((p) => !p.sku).length;
    const missingSupplier = products.filter((p) => !p.supplier_name).length;
    const missingExpiry = products.filter((p) => !p.expiry_date).length;

    return {
      missingBarcode,
      missingSku,
      missingSupplier,
      missingExpiry,
    };
  }, [products]);

  const todayPlan = useMemo(() => {
    const actions: string[] = [];

    if (stats.expiresToday > 0) {
      actions.push(`${stats.expiresToday} products expire today and need immediate clearance.`);
    }
    if (stats.lowStock > 0) {
      actions.push(`${stats.lowStock} products are below safe stock levels.`);
    }
    if (stats.wasteRisk > 0) {
      actions.push(`${stats.wasteRisk} products have elevated waste risk this week.`);
    }
    if (stats.weakMargin > 0) {
      actions.push(`${stats.weakMargin} products have weak margin and need review.`);
    }

    if (actions.length === 0) {
      actions.push('No urgent action items. Focus on optimization and fresh uploads.');
    }

    return actions.slice(0, 4);
  }, [stats]);

  const wasteExposureValue = useMemo(() => {
    return products.reduce((sum, p) => {
      const days = daysUntil(p.expiry_date);
      const stock = safeNumber(p.stock_quantity);
      if (days !== null && days >= 0 && days <= 5 && stock > 0) {
        return sum + stock * safeNumber(p.cost_price);
      }
      return sum;
    }, 0);
  }, [products]);

  const discountOpportunityValue = useMemo(() => {
    return discountRecommendations.reduce((sum, item) => sum + safeNumber(item.impact_value), 0);
  }, [discountRecommendations]);

  const restockOpportunityValue = useMemo(() => {
    return restockRecommendations.reduce((sum, item) => sum + safeNumber(item.impact_value), 0);
  }, [restockRecommendations]);

  const riskLevelLabel =
    stats.highRiskProducts >= 10
      ? 'High risk'
      : stats.highRiskProducts >= 4
      ? 'Moderate risk'
      : 'Healthy';

  const riskLevelColor =
    stats.highRiskProducts >= 10
      ? palette.danger
      : stats.highRiskProducts >= 4
      ? palette.warning
      : palette.success;

  const stockPieData = useMemo(() => {
    const healthy = Math.max(0, stats.totalProducts - stats.lowStock - stats.outOfStock);
    return [
      { label: 'Healthy', value: healthy, color: palette.success },
      { label: 'Low stock', value: stats.lowStock, color: palette.warning },
      { label: 'Out of stock', value: stats.outOfStock, color: palette.danger },
    ];
  }, [stats.totalProducts, stats.lowStock, stats.outOfStock]);

  const expiryPieData = useMemo(() => {
    const safe = Math.max(0, stats.totalProducts - stats.nearExpiry - stats.expired);
    return [
      { label: 'Safe', value: safe, color: palette.success },
      { label: 'Near expiry', value: stats.nearExpiry, color: palette.warning },
      { label: 'Expired', value: stats.expired, color: palette.danger },
    ];
  }, [stats.totalProducts, stats.nearExpiry, stats.expired]);

  const recommendationPieData = useMemo(() => {
    const discount = recommendations.filter((r) => r.recommendation_type === 'discount').length;
    const restock = recommendations.filter((r) => r.recommendation_type === 'restock').length;
    const priceUp = recommendations.filter((r) => r.recommendation_type === 'price_up').length;
    const priceDown = recommendations.filter((r) => r.recommendation_type === 'price_down').length;

    return [
      { label: 'Discount', value: discount, color: palette.orange },
      { label: 'Restock', value: restock, color: palette.info },
      { label: 'Price up', value: priceUp, color: palette.success },
      { label: 'Price down', value: priceDown, color: palette.purple },
    ];
  }, [recommendations]);

  const onRefresh = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await loadDashboard(true);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <LinearGradient colors={[palette.bg, palette.bg2, palette.bg3]} style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={palette.primary2} />
          <Text style={styles.loadingText}>Loading food intelligence dashboard...</Text>
        </LinearGradient>
      </SafeAreaView>
    );
  }

  const maxCategoryCount = categoryMetrics.length
    ? Math.max(...categoryMetrics.map((c) => c.product_count))
    : 1;

  return (
    <SafeAreaView style={styles.safeArea}>
      <LinearGradient colors={[palette.bg, palette.bg2, palette.bg3]} style={styles.container}>
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
            colors={['#E7FFF1', '#D9FCE7', '#F6FFF9']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.heroCard}
          >
            <View style={styles.heroTopRow}>
              <View style={styles.avatarWrap}>
                <Text style={styles.avatarText}>{initials(displayName)}</Text>
              </View>

              <View style={styles.heroTopActions}>
                <TouchableOpacity
                  style={styles.headerButton}
                  onPress={() => router.push('/(tabs)/explore')}
                >
                  <Ionicons name="sparkles-outline" size={18} color={palette.primary2} />
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.headerButton}
                  onPress={() => router.push('/(tabs)/upload')}
                >
                  <Ionicons name="cloud-upload-outline" size={18} color={palette.primary2} />
                </TouchableOpacity>
              </View>
            </View>

            <Text style={styles.greetingText}>{greeting}</Text>
            <Text style={styles.heroTitle}>{displayName}</Text>
            <Text style={styles.heroSubtitle}>
              Bright, real-time operational intelligence for food products, stock, waste, pricing,
              supplier performance, and expiry risk.
            </Text>

            <View style={styles.heroBadgeRow}>
              <View style={[styles.heroBadge, { backgroundColor: `${riskLevelColor}18` }]}>
                <Text style={[styles.heroBadgeText, { color: riskLevelColor }]}>{riskLevelLabel}</Text>
              </View>
              <View style={styles.heroBadge}>
                <Text style={styles.heroBadgeTextNeutral}>{stats.totalProducts} tracked items</Text>
              </View>
              <View style={styles.heroBadge}>
                <Text style={styles.heroBadgeTextNeutral}>{stats.activeAlerts} live alerts</Text>
              </View>
            </View>

            <View style={styles.heroActionRow}>
              <TouchableOpacity
                style={styles.primaryButton}
                activeOpacity={0.9}
                onPress={() => router.push('/(tabs)/upload')}
              >
                <LinearGradient
                  colors={[palette.primary, palette.primary2]}
                  style={styles.primaryButtonGradient}
                >
                  <Ionicons name="cloud-upload-outline" size={18} color="#fff" />
                  <Text style={styles.primaryButtonText}>Upload Products CSV</Text>
                </LinearGradient>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.secondaryButton}
                activeOpacity={0.9}
                onPress={() => router.push('/(tabs)/explore')}
              >
                <Ionicons name="grid-outline" size={16} color={palette.primary2} />
                <Text style={styles.secondaryButtonText}>Open Insights</Text>
              </TouchableOpacity>
            </View>
          </LinearGradient>

          <SectionHeader
            title="Overview"
            subtitle="Main business signals for today"
          />

          <View style={styles.cleanStatsGrid}>
            <CleanStatCard
              title="Products"
              value={`${stats.totalProducts}`}
              subtitle="Tracked food items"
              icon="basket-outline"
            />
            <CleanStatCard
              title="Low stock"
              value={`${stats.lowStock}`}
              subtitle="Need restock soon"
              icon="alert-circle-outline"
            />
            <CleanStatCard
              title="Near expiry"
              value={`${stats.nearExpiry}`}
              subtitle="Within 7 days"
              icon="time-outline"
            />
            <CleanStatCard
              title="Avg margin"
              value={`${stats.avgMargin.toFixed(0)}%`}
              subtitle="Across inventory"
              icon="cash-outline"
            />
          </View>

          <SectionHeader
            title="Visual control"
            subtitle="Quick charts for faster human reading"
          />

          <View style={styles.pieGrid}>
            <PieChartCard
              title="Stock health"
              subtitle="Healthy vs low stock"
              data={stockPieData}
            />
            <PieChartCard
              title="Expiry health"
              subtitle="Safe vs expiring"
              data={expiryPieData}
            />
            <PieChartCard
              title="Recommendation mix"
              subtitle="Action types"
              data={recommendationPieData}
            />
          </View>

          <SectionHeader
            title="Business summary"
            subtitle="Clear and simple operational view"
          />

          <View style={styles.simplePanel}>
            <SimpleInfoRow label="Inventory value" value={formatCurrency(stats.inventoryValue)} />
            <SimpleInfoRow label="Potential revenue" value={formatCurrency(stats.potentialRevenue)} />
            <SimpleInfoRow
              label="Out of stock products"
              value={`${stats.outOfStock}`}
              valueColor={palette.info}
            />
            <SimpleInfoRow
              label="High risk products"
              value={`${stats.highRiskProducts}`}
              valueColor={progressColor(stats.highRiskProducts >= 10 ? 80 : stats.highRiskProducts >= 4 ? 50 : 20)}
            />
            <SimpleInfoRow
              label="Waste risk products"
              value={`${stats.wasteRisk}`}
              valueColor={palette.warning}
            />
            <SimpleInfoRow
              label="Active alerts"
              value={`${stats.activeAlerts}`}
              valueColor={palette.danger}
            />
          </View>

          <SectionHeader
            title="Detailed KPI cards"
            subtitle="Extended dashboard metrics"
          />

          <View style={styles.statsGrid}>
            <StatCard
              title="Products"
              value={`${stats.totalProducts}`}
              subtitle="Tracked food items"
              icon="basket-outline"
              tone="success"
            />
            <StatCard
              title="Low stock"
              value={`${stats.lowStock}`}
              subtitle="Need restock soon"
              icon="alert-circle-outline"
              tone="warning"
            />
            <StatCard
              title="Near expiry"
              value={`${stats.nearExpiry}`}
              subtitle="Within 7 days"
              icon="time-outline"
              tone="danger"
            />
            <StatCard
              title="Avg margin"
              value={`${stats.avgMargin.toFixed(0)}%`}
              subtitle="Across inventory"
              icon="cash-outline"
              tone="info"
            />
            <StatCard
              title="Inventory value"
              value={formatCompactCurrency(stats.inventoryValue)}
              subtitle="At cost basis"
              icon="cube-outline"
              tone="purple"
            />
            <StatCard
              title="Potential revenue"
              value={formatCompactCurrency(stats.potentialRevenue)}
              subtitle="At selling price"
              icon="trending-up-outline"
              tone="cyan"
            />
          </View>

          <SectionHeader
            title="Control center"
            subtitle="Fast summary of your operation health"
          />

          <View style={styles.miniInsightsGrid}>
            <MiniInsightCard
              title="Expires today"
              value={`${stats.expiresToday}`}
              subtitle="Immediate action needed"
              icon="alarm-outline"
              bg={palette.redSoft}
              iconColor={palette.danger}
            />
            <MiniInsightCard
              title="Expired"
              value={`${stats.expired}`}
              subtitle="Needs removal/check"
              icon="close-circle-outline"
              bg={palette.redSoft}
              iconColor={palette.danger}
            />
            <MiniInsightCard
              title="Out of stock"
              value={`${stats.outOfStock}`}
              subtitle="Lost sales risk"
              icon="remove-circle-outline"
              bg={palette.blueSoft}
              iconColor={palette.info}
            />
            <MiniInsightCard
              title="Waste risk"
              value={`${stats.wasteRisk}`}
              subtitle="Likely unsold soon"
              icon="trash-outline"
              bg={palette.yellowSoft}
              iconColor={palette.warning}
            />
          </View>

          <SectionHeader
            title="Today plan"
            subtitle="What should the business do first"
          />

          <View style={styles.todayPlanCard}>
            {todayPlan.map((item, index) => (
              <View key={`${item}-${index}`} style={styles.planRow}>
                <View style={styles.planBullet} />
                <Text style={styles.planText}>{item}</Text>
              </View>
            ))}
          </View>

          <SectionHeader
            title="Opportunity board"
            subtitle="Money, waste and growth angles"
          />

          <View style={styles.opportunityWrap}>
            <View style={styles.opportunityCardLarge}>
              <Text style={styles.opportunityEyebrow}>Waste exposure</Text>
              <Text style={styles.opportunityValue}>{formatCurrency(wasteExposureValue)}</Text>
              <Text style={styles.opportunityText}>
                Estimated inventory cost tied to products expiring within 5 days.
              </Text>
              <View style={styles.inlineMeterTrack}>
                <View
                  style={[
                    styles.inlineMeterFill,
                    {
                      width: `${Math.min(
                        100,
                        stats.totalProducts ? (stats.wasteRisk / stats.totalProducts) * 100 : 0
                      )}%`,
                      backgroundColor: palette.warning,
                    },
                  ]}
                />
              </View>
            </View>

            <View style={styles.opportunityCardSmall}>
              <Text style={styles.opportunityEyebrow}>Discount opportunity</Text>
              <Text style={styles.opportunitySmallValue}>
                {formatCompactCurrency(discountOpportunityValue)}
              </Text>
              <Text style={styles.opportunityText}>Potential sales rescue from discount actions.</Text>
            </View>

            <View style={styles.opportunityCardSmall}>
              <Text style={styles.opportunityEyebrow}>Restock opportunity</Text>
              <Text style={styles.opportunitySmallValue}>
                {formatCompactCurrency(restockOpportunityValue)}
              </Text>
              <Text style={styles.opportunityText}>Estimated sales recovery from replenishment.</Text>
            </View>
          </View>

          <SectionHeader
            title="Stock and margin health"
            subtitle="Business balance at a glance"
          />

          <View style={styles.healthCard}>
            <View style={styles.healthRow}>
              <Text style={styles.healthLabel}>Stock pressure</Text>
              <Text style={styles.healthValue}>{stats.lowStock}</Text>
            </View>
            <View style={styles.healthTrack}>
              <View
                style={[
                  styles.healthFill,
                  {
                    width: `${Math.min(
                      100,
                      stats.totalProducts ? (stats.lowStock / stats.totalProducts) * 100 : 0
                    )}%`,
                    backgroundColor: palette.warning,
                  },
                ]}
              />
            </View>

            <View style={styles.healthRow}>
              <Text style={styles.healthLabel}>Expiry pressure</Text>
              <Text style={styles.healthValue}>{stats.nearExpiry}</Text>
            </View>
            <View style={styles.healthTrack}>
              <View
                style={[
                  styles.healthFill,
                  {
                    width: `${Math.min(
                      100,
                      stats.totalProducts ? (stats.nearExpiry / stats.totalProducts) * 100 : 0
                    )}%`,
                    backgroundColor: palette.danger,
                  },
                ]}
              />
            </View>

            <View style={styles.healthRow}>
              <Text style={styles.healthLabel}>Weak margin products</Text>
              <Text style={styles.healthValue}>{stats.weakMargin}</Text>
            </View>
            <View style={styles.healthTrack}>
              <View
                style={[
                  styles.healthFill,
                  {
                    width: `${Math.min(
                      100,
                      stats.totalProducts ? (stats.weakMargin / stats.totalProducts) * 100 : 0
                    )}%`,
                    backgroundColor: palette.info,
                  },
                ]}
              />
            </View>

            <View style={styles.healthPillsRow}>
              <ProgressPill label="Risky" value={`${stats.highRiskProducts}`} tone="danger" />
              <ProgressPill label="Out of stock" value={`${stats.outOfStock}`} tone="info" />
              <ProgressPill label="Expiring" value={`${stats.nearExpiry}`} tone="warning" />
            </View>
          </View>

          <SectionHeader
            title="Category performance"
            subtitle="Which groups drive complexity and risk"
          />

          <View style={styles.categoryList}>
            {categoryMetrics.length > 0 ? (
              categoryMetrics.slice(0, 6).map((item) => (
                <CategoryCard key={item.name} item={item} maxCount={maxCategoryCount} />
              ))
            ) : (
              <EmptyCard
                title="No category data yet"
                subtitle="Once products are uploaded, category performance will appear here."
                icon="layers-outline"
              />
            )}
          </View>

          <SectionHeader
            title="Top risky products"
            subtitle="Products needing action first"
          />

          <View style={styles.block}>
            {topRiskProducts.length > 0 ? (
              topRiskProducts.map((item) => <RiskProductCard key={item.id} item={item} />)
            ) : (
              <EmptyCard
                title="No products yet"
                subtitle="Upload your food inventory CSV to unlock risk tracking."
                icon="basket-outline"
              />
            )}
          </View>

          <SectionHeader
            title="Discount recommendations"
            subtitle="Reduce waste and move sensitive stock"
          />

          <View style={styles.block}>
            {discountRecommendations.length > 0 ? (
              discountRecommendations.map((item) => (
                <RecommendationCard key={item.id} item={item} />
              ))
            ) : (
              <EmptyCard
                title="No discount actions yet"
                subtitle="Discount suggestions will appear when expiry pressure is detected."
                icon="pricetag-outline"
              />
            )}
          </View>

          <SectionHeader
            title="Restock recommendations"
            subtitle="Prevent lost sales on fast-moving items"
          />

          <View style={styles.block}>
            {restockRecommendations.length > 0 ? (
              restockRecommendations.map((item) => (
                <RecommendationCard key={item.id} item={item} />
              ))
            ) : (
              <EmptyCard
                title="No restock actions yet"
                subtitle="Restock suggestions will appear when stock levels drop below safety."
                icon="cube-outline"
              />
            )}
          </View>

          <SectionHeader
            title="Pricing recommendations"
            subtitle="Margin and competitiveness adjustments"
          />

          <View style={styles.block}>
            {priceRecommendations.length > 0 ? (
              priceRecommendations.map((item) => (
                <RecommendationCard key={item.id} item={item} />
              ))
            ) : (
              <EmptyCard
                title="No pricing moves yet"
                subtitle="Price-up and price-down recommendations will appear here."
                icon="analytics-outline"
              />
            )}
          </View>

          <SectionHeader
            title="Supplier watch"
            subtitle="Where supplier-linked risk is concentrated"
          />

          <View style={styles.block}>
            {supplierSummary.length > 0 ? (
              supplierSummary.map((item) => (
                <SupplierCard
                  key={item.supplier}
                  supplier={item.supplier}
                  productCount={item.productCount}
                  riskyCount={item.riskyCount}
                />
              ))
            ) : (
              <EmptyCard
                title="No supplier data"
                subtitle="Suppliers will be summarized after importing product records."
                icon="business-outline"
              />
            )}
          </View>

          <SectionHeader
            title="Compliance and data hygiene"
            subtitle="Missing product information that weakens control"
          />

          <View style={styles.complianceGrid}>
            <View style={styles.complianceCard}>
              <Text style={styles.complianceValue}>{complianceSummary.missingBarcode}</Text>
              <Text style={styles.complianceTitle}>Missing barcode</Text>
            </View>
            <View style={styles.complianceCard}>
              <Text style={styles.complianceValue}>{complianceSummary.missingSku}</Text>
              <Text style={styles.complianceTitle}>Missing SKU</Text>
            </View>
            <View style={styles.complianceCard}>
              <Text style={styles.complianceValue}>{complianceSummary.missingSupplier}</Text>
              <Text style={styles.complianceTitle}>Missing supplier</Text>
            </View>
            <View style={styles.complianceCard}>
              <Text style={styles.complianceValue}>{complianceSummary.missingExpiry}</Text>
              <Text style={styles.complianceTitle}>Missing expiry</Text>
            </View>
          </View>

          <SectionHeader
            title="Latest business alerts"
            subtitle="Signals that need management attention"
          />

          <View style={styles.block}>
            {alerts.length > 0 ? (
              alerts.slice(0, 6).map((item) => <AlertCard key={item.id} item={item} />)
            ) : (
              <EmptyCard
                title="No alerts right now"
                subtitle="Alerts will appear when stock, expiry or pricing issues are detected."
                icon="notifications-outline"
              />
            )}
          </View>

          <SectionHeader
            title="Quick actions"
            subtitle="Use the dashboard as your operational cockpit"
          />

          <View style={styles.quickActionGrid}>
            <TouchableOpacity
              style={styles.quickActionCard}
              activeOpacity={0.9}
              onPress={() => router.push('/(tabs)/upload')}
            >
              <View style={[styles.quickActionIconWrap, { backgroundColor: palette.greenSoft }]}>
                <Ionicons name="cloud-upload-outline" size={20} color={palette.primary2} />
              </View>
              <Text style={styles.quickActionTitle}>Upload inventory</Text>
              <Text style={styles.quickActionSubtitle}>Import fresh food data</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.quickActionCard}
              activeOpacity={0.9}
              onPress={() => router.push('/(tabs)/explore')}
            >
              <View style={[styles.quickActionIconWrap, { backgroundColor: palette.blueSoft }]}>
                <Ionicons name="analytics-outline" size={20} color={palette.info} />
              </View>
              <Text style={styles.quickActionTitle}>Open insights</Text>
              <Text style={styles.quickActionSubtitle}>Review AI intelligence</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.quickActionCard}
              activeOpacity={0.9}
              onPress={onRefresh}
            >
              <View style={[styles.quickActionIconWrap, { backgroundColor: palette.yellowSoft }]}>
                <Ionicons name="refresh-outline" size={20} color={palette.warning} />
              </View>
              <Text style={styles.quickActionTitle}>Refresh data</Text>
              <Text style={styles.quickActionSubtitle}>Reload latest metrics</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.quickActionCard}
              activeOpacity={0.9}
              onPress={() =>
                Alert.alert(
                  'Food OS',
                  'Next step is creating the Supabase tables and seeded food product data.'
                )
              }
            >
              <View style={[styles.quickActionIconWrap, { backgroundColor: palette.purpleSoft }]}>
                <Ionicons name="construct-outline" size={20} color={palette.purple} />
              </View>
              <Text style={styles.quickActionTitle}>Setup next</Text>
              <Text style={styles.quickActionSubtitle}>Prepare Supabase schema</Text>
            </TouchableOpacity>
          </View>

          <View style={{ height: 40 }} />
        </ScrollView>
      </LinearGradient>
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
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
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
    paddingTop: 16,
    paddingBottom: 24,
  },

  heroCard: {
    borderRadius: 28,
    padding: 20,
    borderWidth: 1,
    borderColor: palette.borderStrong,
    marginBottom: 20,
    shadowColor: '#7AD9A1',
    shadowOpacity: 0.15,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 4,
  },
  heroTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  heroTopActions: {
    flexDirection: 'row',
    gap: 10,
  },
  avatarWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: palette.borderStrong,
  },
  avatarText: {
    color: palette.primary2,
    fontWeight: '900',
    fontSize: 16,
  },
  headerButton: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFFCC',
    borderWidth: 1,
    borderColor: palette.borderStrong,
  },
  greetingText: {
    marginTop: 18,
    color: palette.textSoft,
    fontSize: 14,
    fontWeight: '600',
  },
  heroTitle: {
    marginTop: 6,
    color: palette.text,
    fontSize: 30,
    lineHeight: 36,
    fontWeight: '900',
  },
  heroSubtitle: {
    marginTop: 10,
    color: palette.textMuted,
    fontSize: 14,
    lineHeight: 22,
    fontWeight: '500',
  },
  heroBadgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 16,
  },
  heroBadge: {
    backgroundColor: '#FFFFFFCC',
    borderWidth: 1,
    borderColor: palette.borderStrong,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  heroBadgeText: {
    fontWeight: '800',
    fontSize: 12,
  },
  heroBadgeTextNeutral: {
    color: palette.textSoft,
    fontWeight: '700',
    fontSize: 12,
  },
  heroActionRow: {
    gap: 12,
    marginTop: 18,
  },
  primaryButton: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  primaryButtonGradient: {
    minHeight: 54,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '800',
  },
  secondaryButton: {
    minHeight: 52,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: palette.borderStrong,
    backgroundColor: '#FFFFFFCC',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  secondaryButtonText: {
    color: palette.primary2,
    fontSize: 15,
    fontWeight: '800',
  },

  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginTop: 8,
    marginBottom: 12,
  },
  sectionTitle: {
    color: palette.text,
    fontSize: 20,
    fontWeight: '900',
    marginBottom: 4,
  },
  sectionSubtitle: {
    color: palette.textMuted,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '500',
  },
  sectionAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  sectionActionText: {
    color: palette.primary2,
    fontSize: 13,
    fontWeight: '800',
    marginRight: 4,
  },

  cleanStatsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 18,
  },
  cleanStatCard: {
    width: cardWidth,
    backgroundColor: palette.card,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: palette.border,
  },
  cleanStatIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: palette.greenSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  cleanStatValue: {
    color: palette.text,
    fontSize: 24,
    fontWeight: '900',
    marginBottom: 4,
  },
  cleanStatTitle: {
    color: palette.textSoft,
    fontSize: 13,
    fontWeight: '800',
  },
  cleanStatSubtitle: {
    color: palette.textMuted,
    fontSize: 11,
    lineHeight: 16,
    marginTop: 6,
    fontWeight: '500',
  },

  pieGrid: {
    gap: 12,
    marginBottom: 18,
  },
  pieCard: {
    backgroundColor: palette.card,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: palette.border,
    padding: 16,
  },
  pieCardTitle: {
    color: palette.text,
    fontSize: 16,
    fontWeight: '900',
  },
  pieCardSubtitle: {
    color: palette.textMuted,
    fontSize: 12,
    marginTop: 4,
    lineHeight: 17,
    fontWeight: '500',
  },
  pieCardContent: {
    marginTop: 16,
    alignItems: 'center',
  },
  pieWrap: {
    width: 118,
    height: 118,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  pieCenter: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pieCenterValue: {
    color: palette.text,
    fontSize: 20,
    fontWeight: '900',
  },
  pieCenterLabel: {
    color: palette.textMuted,
    fontSize: 11,
    fontWeight: '700',
    marginTop: 2,
  },
  pieLegend: {
    width: '100%',
    gap: 8,
  },
  pieLegendRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  pieLegendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 8,
  },
  pieLegendLabel: {
    flex: 1,
    color: palette.textSoft,
    fontSize: 13,
    fontWeight: '700',
  },
  pieLegendValue: {
    color: palette.text,
    fontSize: 13,
    fontWeight: '900',
  },

  simplePanel: {
    backgroundColor: palette.card,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: palette.border,
    paddingVertical: 4,
    marginBottom: 18,
  },
  simpleInfoRow: {
    minHeight: 48,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#EEF5F0',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  simpleInfoLabel: {
    flex: 1,
    color: palette.textSoft,
    fontSize: 14,
    fontWeight: '700',
    paddingRight: 10,
  },
  simpleInfoValue: {
    color: palette.text,
    fontSize: 14,
    fontWeight: '900',
  },

  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 18,
  },
  statCard: {
    width: cardWidth,
    backgroundColor: palette.card,
    borderRadius: 22,
    padding: 16,
    borderWidth: 1,
    borderColor: palette.border,
    shadowColor: '#BAEFD0',
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  statIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  statValue: {
    color: palette.text,
    fontSize: 24,
    fontWeight: '900',
    marginBottom: 4,
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

  miniInsightsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 18,
  },
  miniInsightCard: {
    width: cardWidth,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#FFFFFF',
  },
  miniInsightTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
    alignItems: 'center',
  },
  miniInsightTitle: {
    color: palette.textSoft,
    fontSize: 13,
    fontWeight: '700',
  },
  miniInsightValue: {
    color: palette.text,
    fontSize: 26,
    fontWeight: '900',
    marginBottom: 4,
  },
  miniInsightSubtitle: {
    color: palette.textMuted,
    fontSize: 11,
    lineHeight: 16,
    fontWeight: '500',
  },

  todayPlanCard: {
    backgroundColor: palette.card,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: palette.border,
    padding: 18,
    marginBottom: 18,
  },
  planRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  planBullet: {
    width: 9,
    height: 9,
    borderRadius: 999,
    backgroundColor: palette.primary,
    marginTop: 6,
    marginRight: 10,
  },
  planText: {
    flex: 1,
    color: palette.textSoft,
    fontSize: 14,
    lineHeight: 21,
    fontWeight: '600',
  },

  opportunityWrap: {
    gap: 12,
    marginBottom: 18,
  },
  opportunityCardLarge: {
    backgroundColor: palette.card,
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
    borderColor: palette.border,
  },
  opportunityCardSmall: {
    backgroundColor: palette.card,
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
    borderColor: palette.border,
  },
  opportunityEyebrow: {
    color: palette.primary2,
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  opportunityValue: {
    color: palette.text,
    fontSize: 30,
    fontWeight: '900',
    marginBottom: 8,
  },
  opportunitySmallValue: {
    color: palette.text,
    fontSize: 24,
    fontWeight: '900',
    marginBottom: 8,
  },
  opportunityText: {
    color: palette.textMuted,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '500',
  },
  inlineMeterTrack: {
    height: 10,
    borderRadius: 999,
    backgroundColor: '#EEF5F0',
    marginTop: 14,
    overflow: 'hidden',
  },
  inlineMeterFill: {
    height: '100%',
    borderRadius: 999,
  },

  healthCard: {
    backgroundColor: palette.card,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: palette.border,
    padding: 18,
    marginBottom: 18,
  },
  healthRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
    marginTop: 6,
  },
  healthLabel: {
    color: palette.textSoft,
    fontSize: 13,
    fontWeight: '700',
  },
  healthValue: {
    color: palette.text,
    fontSize: 13,
    fontWeight: '900',
  },
  healthTrack: {
    height: 10,
    borderRadius: 999,
    backgroundColor: '#EEF5F0',
    overflow: 'hidden',
    marginBottom: 10,
  },
  healthFill: {
    height: '100%',
    borderRadius: 999,
  },
  healthPillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 12,
  },
  progressPill: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  progressPillLabel: {
    fontSize: 12,
    fontWeight: '800',
  },
  progressPillValue: {
    fontSize: 12,
    fontWeight: '900',
  },

  categoryList: {
    gap: 12,
    marginBottom: 18,
  },
  categoryCard: {
    backgroundColor: palette.card,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: palette.border,
  },
  categoryTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
    alignItems: 'center',
  },
  categoryName: {
    color: palette.text,
    fontSize: 15,
    fontWeight: '900',
    flex: 1,
  },
  categoryProducts: {
    color: palette.textMuted,
    fontSize: 12,
    fontWeight: '700',
  },
  categoryBarTrack: {
    height: 10,
    borderRadius: 999,
    backgroundColor: '#EEF5F0',
    overflow: 'hidden',
    marginBottom: 14,
  },
  categoryBarFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: palette.primary,
  },
  categoryMetricsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  categoryMetricItem: {
    flex: 1,
    backgroundColor: palette.cardMint,
    borderRadius: 14,
    padding: 12,
    alignItems: 'center',
  },
  categoryMetricValue: {
    color: palette.text,
    fontSize: 16,
    fontWeight: '900',
    marginBottom: 4,
  },
  categoryMetricLabel: {
    color: palette.textMuted,
    fontSize: 11,
    fontWeight: '700',
  },

  block: {
    gap: 12,
    marginBottom: 18,
  },

  riskProductCard: {
    backgroundColor: palette.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: palette.border,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
  },
  riskProductLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    paddingRight: 12,
  },
  foodIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: palette.greenSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  riskProductTitle: {
    color: palette.text,
    fontSize: 14,
    fontWeight: '900',
    marginBottom: 4,
  },
  riskProductMeta: {
    color: palette.textMuted,
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 8,
    fontWeight: '500',
  },
  riskTagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  softTag: {
    backgroundColor: palette.cardMint,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  softTagText: {
    color: palette.textSoft,
    fontSize: 11,
    fontWeight: '700',
  },
  riskMeterWrap: {
    width: 64,
    height: 64,
    borderRadius: 18,
    backgroundColor: palette.cardMint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  riskMeterValue: {
    color: palette.text,
    fontSize: 18,
    fontWeight: '900',
  },
  riskMeterLabel: {
    color: palette.textMuted,
    fontSize: 11,
    fontWeight: '700',
  },

  alertCard: {
    backgroundColor: palette.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: palette.border,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  alertIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  alertTitle: {
    color: palette.text,
    fontSize: 14,
    fontWeight: '900',
    marginBottom: 4,
  },
  alertDescription: {
    color: palette.textMuted,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '500',
  },
  alertTime: {
    marginTop: 6,
    color: palette.textMuted,
    fontSize: 11,
    fontWeight: '700',
  },

  recommendationCard: {
    backgroundColor: palette.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: palette.border,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
  },
  recommendationIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  recommendationTitle: {
    color: palette.text,
    fontSize: 14,
    fontWeight: '900',
    marginBottom: 4,
  },
  recommendationMessage: {
    color: palette.textMuted,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '500',
  },
  recommendationValueWrap: {
    marginLeft: 10,
    alignItems: 'flex-end',
  },
  recommendationValue: {
    fontSize: 13,
    fontWeight: '900',
  },
  recommendationValueLabel: {
    color: palette.textMuted,
    fontSize: 10,
    fontWeight: '700',
    marginTop: 2,
  },

  supplierCard: {
    backgroundColor: palette.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: palette.border,
    padding: 14,
  },
  supplierTop: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  supplierIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: palette.blueSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  supplierName: {
    color: palette.text,
    fontSize: 14,
    fontWeight: '900',
    marginBottom: 4,
  },
  supplierMeta: {
    color: palette.textMuted,
    fontSize: 12,
    fontWeight: '600',
  },
  supplierRiskText: {
    marginTop: 10,
    color: palette.textSoft,
    fontSize: 13,
    fontWeight: '700',
  },
  healthBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  healthBadgeText: {
    fontSize: 11,
    fontWeight: '900',
  },

  complianceGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 18,
  },
  complianceCard: {
    width: cardWidth,
    backgroundColor: palette.card,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: palette.border,
    alignItems: 'center',
  },
  complianceValue: {
    color: palette.text,
    fontSize: 28,
    fontWeight: '900',
    marginBottom: 8,
  },
  complianceTitle: {
    color: palette.textMuted,
    fontSize: 12,
    fontWeight: '800',
    textAlign: 'center',
  },

  quickActionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  quickActionCard: {
    width: cardWidth,
    backgroundColor: palette.card,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: palette.border,
  },
  quickActionIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
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

  emptyCard: {
    backgroundColor: palette.card,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: palette.border,
    padding: 22,
    alignItems: 'center',
  },
  emptyIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: palette.greenSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  emptyTitle: {
    color: palette.text,
    fontSize: 16,
    fontWeight: '900',
    marginBottom: 6,
    textAlign: 'center',
  },
  emptySubtitle: {
    color: palette.textMuted,
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
    fontWeight: '500',
  },
});