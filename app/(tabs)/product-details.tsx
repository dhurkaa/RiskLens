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
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialCommunityIcons, Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { supabase } from '../../lib/supabase';

const palette = {
  bg: '#F4FAF7',
  bg2: '#ECFDF3',
  bg3: '#E6FFF1',
  card: '#FFFFFF',
  cardSoft: '#F8FFFB',
  border: '#D9F7E5',
  borderStrong: '#B7ECCC',
  text: '#0F172A',
  textSoft: '#334155',
  textMuted: '#64748B',
  primary: '#22C55E',
  primary2: '#16A34A',
  success: '#10B981',
  warning: '#F59E0B',
  danger: '#EF4444',
  info: '#3B82F6',
  purple: '#8B5CF6',
  greenSoft: '#ECFDF3',
  blueSoft: '#EEF6FF',
  redSoft: '#FFF0F0',
  yellowSoft: '#FFF8DB',
  purpleSoft: '#F5F3FF',
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
  created_at?: string | null;
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

function safeNumber(value?: number | null) {
  return Number(value || 0);
}

function formatCurrency(value?: number | null) {
  return `€${safeNumber(value).toFixed(2)}`;
}

function formatDate(value?: string | null) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString();
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

function riskTone(score: number) {
  if (score >= 70) return { label: 'High risk', color: palette.danger, bg: palette.redSoft };
  if (score >= 40) return { label: 'Medium risk', color: palette.warning, bg: palette.yellowSoft };
  return { label: 'Low risk', color: palette.success, bg: palette.greenSoft };
}

function recommendationTone(type: RecommendationRow['recommendation_type']) {
  if (type === 'discount') return { color: palette.warning, bg: palette.yellowSoft, icon: 'pricetag-outline' as const };
  if (type === 'restock') return { color: palette.info, bg: palette.blueSoft, icon: 'cube-outline' as const };
  if (type === 'price_up') return { color: palette.success, bg: palette.greenSoft, icon: 'trending-up-outline' as const };
  return { color: palette.purple, bg: palette.purpleSoft, icon: 'trending-down-outline' as const };
}

function alertTone(severity?: string | null) {
  if (severity === 'high') return { color: palette.danger, bg: palette.redSoft };
  if (severity === 'medium') return { color: palette.warning, bg: palette.yellowSoft };
  return { color: palette.info, bg: palette.blueSoft };
}

function expiryLabel(dateString?: string | null) {
  const d = daysUntil(dateString);
  if (d === null) return 'No expiry set';
  if (d < 0) return `Expired ${Math.abs(d)} day(s) ago`;
  if (d === 0) return 'Expires today';
  return `Expires in ${d} day(s)`;
}

function HealthMetric({
  title,
  value,
  subtitle,
  tone = 'green',
}: {
  title: string;
  value: string;
  subtitle: string;
  tone?: 'green' | 'yellow' | 'red' | 'blue' | 'purple';
}) {
  const bgMap = {
    green: palette.greenSoft,
    yellow: palette.yellowSoft,
    red: palette.redSoft,
    blue: palette.blueSoft,
    purple: palette.purpleSoft,
  } as const;

  return (
    <View style={[styles.healthMetric, { backgroundColor: bgMap[tone] }]}>
      <Text style={styles.healthMetricValue}>{value}</Text>
      <Text style={styles.healthMetricTitle}>{title}</Text>
      <Text style={styles.healthMetricSubtitle}>{subtitle}</Text>
    </View>
  );
}

export default function ProductDetailsScreen() {
  const params = useLocalSearchParams<{ id?: string }>();
  const productId = typeof params.id === 'string' ? params.id : '';

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [product, setProduct] = useState<ProductRow | null>(null);
  const [alerts, setAlerts] = useState<AlertRow[]>([]);
  const [recommendations, setRecommendations] = useState<RecommendationRow[]>([]);

  const loadProductDetails = useCallback(async (isRefresh = false) => {
    try {
      if (!productId) {
        Alert.alert('Missing product ID', 'This product page was opened without an ID.');
        router.back();
        return;
      }

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

      const [productRes, alertsRes, recsRes] = await Promise.all([
        supabase
          .from('food_products')
          .select('*')
          .eq('id', productId)
          .eq('user_id', user.id)
          .maybeSingle(),

        supabase
          .from('food_alerts')
          .select('id, title, description, severity, created_at, source_type')
          .eq('user_id', user.id)
          .eq('source_product_id', productId)
          .order('created_at', { ascending: false }),

        supabase
          .from('food_recommendations')
          .select('id, product_name, recommendation_type, message, impact_value, created_at')
          .eq('user_id', user.id)
          .eq('product_id', productId)
          .order('created_at', { ascending: false }),
      ]);

      if (productRes.error) throw productRes.error;
      if (alertsRes.error) throw alertsRes.error;
      if (recsRes.error) throw recsRes.error;

      if (!productRes.data) {
        Alert.alert('Not found', 'This product no longer exists.');
        router.back();
        return;
      }

      setProduct(productRes.data as ProductRow);
      setAlerts((alertsRes.data as AlertRow[]) || []);
      setRecommendations((recsRes.data as RecommendationRow[]) || []);
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : 'Failed to load product details.';
      Alert.alert('Product details error', message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [productId]);

  useEffect(() => {
    loadProductDetails();
  }, [loadProductDetails]);

  const derived = useMemo(() => {
    if (!product) {
      return {
        stock: 0,
        minStock: 0,
        margin: 0,
        expiryDays: null as number | null,
        risk: 0,
        riskMeta: riskTone(0),
        inventoryValue: 0,
        potentialRevenue: 0,
      };
    }

    const stock = safeNumber(product.stock_quantity);
    const minStock = safeNumber(product.min_stock_level);
    const margin = marginPercent(product.selling_price, product.cost_price);
    const expiryDays = daysUntil(product.expiry_date);
    const risk = riskScore(product);
    const inventoryValue = stock * safeNumber(product.cost_price);
    const potentialRevenue = stock * safeNumber(product.selling_price);

    return {
      stock,
      minStock,
      margin,
      expiryDays,
      risk,
      riskMeta: riskTone(risk),
      inventoryValue,
      potentialRevenue,
    };
  }, [product]);

  const deleteProduct = async () => {
    if (!product) return;

    Alert.alert(
      'Delete product',
      `Are you sure you want to delete ${product.name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);

              const { error } = await supabase
                .from('food_products')
                .delete()
                .eq('id', product.id);

              if (error) throw error;

              Alert.alert('Deleted', `${product.name} has been removed.`);
              router.back();
            } catch (error: unknown) {
              const message =
                error instanceof Error ? error.message : 'Failed to delete product.';
              Alert.alert('Delete failed', message);
            }
          },
        },
      ]
    );
  };

  const onRefresh = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await loadProductDetails(true);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <LinearGradient colors={[palette.bg, palette.bg2, palette.bg3]} style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={palette.primary2} />
          <Text style={styles.loadingText}>Loading product details...</Text>
        </LinearGradient>
      </SafeAreaView>
    );
  }

  if (!product) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.emptyStateWrap}>
          <Text style={styles.emptyTitle}>Product not found</Text>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Text style={styles.backButtonText}>Go back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <LinearGradient colors={[palette.bg, palette.bg2, palette.bg3]} style={styles.container}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={palette.primary2}
            />
          }
          showsVerticalScrollIndicator={false}
        >
          <LinearGradient
            colors={['#E7FFF1', '#D9FCE7', '#F6FFF9']}
            style={styles.heroCard}
          >
            <View style={styles.heroTopRow}>
              <TouchableOpacity style={styles.headerButton} onPress={() => router.back()}>
                <Ionicons name="arrow-back-outline" size={20} color={palette.primary2} />
              </TouchableOpacity>

              <TouchableOpacity style={styles.headerButton} onPress={deleteProduct}>
                <Ionicons name="trash-outline" size={20} color={palette.danger} />
              </TouchableOpacity>
            </View>

            <View style={styles.heroProductRow}>
              <View style={styles.heroIconWrap}>
                <MaterialCommunityIcons name="food-outline" size={24} color={palette.primary2} />
              </View>

              <View style={{ flex: 1 }}>
                <Text style={styles.heroTitle}>{product.name}</Text>
                <Text style={styles.heroSubtitle}>
                  {product.category || 'General'} • {product.supplier_name || 'No supplier'}
                </Text>
              </View>
            </View>

            <View style={styles.heroBadgesRow}>
              <View style={[styles.heroBadge, { backgroundColor: derived.riskMeta.bg }]}>
                <Text style={[styles.heroBadgeText, { color: derived.riskMeta.color }]}>
                  {derived.riskMeta.label}
                </Text>
              </View>

              <View style={styles.heroBadge}>
                <Text style={styles.heroBadgeTextNeutral}>{expiryLabel(product.expiry_date)}</Text>
              </View>
            </View>
          </LinearGradient>

          <View style={styles.healthGrid}>
            <HealthMetric
              title="Stock"
              value={`${derived.stock}`}
              subtitle="Units on hand"
              tone="green"
            />
            <HealthMetric
              title="Min stock"
              value={`${derived.minStock}`}
              subtitle="Safety level"
              tone="yellow"
            />
            <HealthMetric
              title="Margin"
              value={`${derived.margin.toFixed(0)}%`}
              subtitle="Estimated gross margin"
              tone="blue"
            />
            <HealthMetric
              title="Risk"
              value={`${derived.risk}%`}
              subtitle="Overall risk score"
              tone="red"
            />
          </View>

          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Financial view</Text>

            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Selling price</Text>
              <Text style={styles.infoValue}>{formatCurrency(product.selling_price)}</Text>
            </View>

            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Cost price</Text>
              <Text style={styles.infoValue}>{formatCurrency(product.cost_price)}</Text>
            </View>

            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Inventory value</Text>
              <Text style={styles.infoValue}>{formatCurrency(derived.inventoryValue)}</Text>
            </View>

            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Potential revenue</Text>
              <Text style={styles.infoValue}>{formatCurrency(derived.potentialRevenue)}</Text>
            </View>
          </View>

          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Product information</Text>

            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Category</Text>
              <Text style={styles.infoValue}>{product.category || '—'}</Text>
            </View>

            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Supplier</Text>
              <Text style={styles.infoValue}>{product.supplier_name || '—'}</Text>
            </View>

            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>SKU</Text>
              <Text style={styles.infoValue}>{product.sku || '—'}</Text>
            </View>

            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Barcode</Text>
              <Text style={styles.infoValue}>{product.barcode || '—'}</Text>
            </View>

            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Expiry date</Text>
              <Text style={styles.infoValue}>{formatDate(product.expiry_date)}</Text>
            </View>

            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Status</Text>
              <Text style={styles.infoValue}>{product.status || 'active'}</Text>
            </View>
          </View>

          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Alerts</Text>
            {alerts.length > 0 ? (
              <View style={styles.stack}>
                {alerts.map((alert) => {
                  const tone = alertTone(alert.severity);
                  return (
                    <View key={alert.id} style={styles.alertCard}>
                      <View style={[styles.alertIconWrap, { backgroundColor: tone.bg }]}>
                        <Ionicons name="warning-outline" size={18} color={tone.color} />
                      </View>

                      <View style={{ flex: 1 }}>
                        <Text style={styles.alertTitle}>{alert.title}</Text>
                        <Text style={styles.alertDescription}>
                          {alert.description || 'No description.'}
                        </Text>
                        <Text style={styles.alertMeta}>
                          {alert.source_type || 'system'} • {formatDate(alert.created_at)}
                        </Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            ) : (
              <Text style={styles.emptyText}>No alerts for this product.</Text>
            )}
          </View>

          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Recommendations</Text>
            {recommendations.length > 0 ? (
              <View style={styles.stack}>
                {recommendations.map((rec) => {
                  const tone = recommendationTone(rec.recommendation_type);
                  return (
                    <View key={rec.id} style={styles.recommendationCard}>
                      <View style={[styles.alertIconWrap, { backgroundColor: tone.bg }]}>
                        <Ionicons name={tone.icon} size={18} color={tone.color} />
                      </View>

                      <View style={{ flex: 1 }}>
                        <Text style={styles.alertTitle}>{rec.product_name}</Text>
                        <Text style={styles.alertDescription}>{rec.message}</Text>
                        <Text style={styles.alertMeta}>
                          {rec.recommendation_type} • {formatDate(rec.created_at)}
                        </Text>
                      </View>

                      <View style={styles.impactWrap}>
                        <Text style={[styles.impactValue, { color: tone.color }]}>
                          {formatCurrency(rec.impact_value)}
                        </Text>
                        <Text style={styles.impactLabel}>impact</Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            ) : (
              <Text style={styles.emptyText}>No recommendations for this product.</Text>
            )}
          </View>

          <View style={styles.actionRow}>
            <TouchableOpacity
  style={styles.secondaryAction}
  onPress={() => router.push(`/edit-product?id=${product.id}`)}
>
  <Feather name="edit-3" size={18} color={palette.info} />
  <Text style={styles.secondaryActionText}>Edit product</Text>
</TouchableOpacity>

            <TouchableOpacity
              style={styles.primaryAction}
              onPress={() => router.push('/(tabs)/products')}
            >
              <Ionicons name="grid-outline" size={18} color="#fff" />
              <Text style={styles.primaryActionText}>Back to products</Text>
            </TouchableOpacity>
          </View>

          <View style={{ height: 28 }} />
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
    marginBottom: 18,
  },
  heroTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
  heroProductRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 18,
  },
  heroIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
    borderWidth: 1,
    borderColor: palette.borderStrong,
  },
  heroTitle: {
    color: palette.text,
    fontSize: 26,
    fontWeight: '900',
    marginBottom: 6,
  },
  heroSubtitle: {
    color: palette.textMuted,
    fontSize: 13,
    lineHeight: 20,
    fontWeight: '500',
  },
  heroBadgesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 18,
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
    fontSize: 12,
    fontWeight: '800',
  },
  heroBadgeTextNeutral: {
    color: palette.textSoft,
    fontSize: 12,
    fontWeight: '700',
  },

  healthGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 18,
  },
  healthMetric: {
    width: '48.2%',
    borderRadius: 20,
    padding: 16,
  },
  healthMetricValue: {
    color: palette.text,
    fontSize: 24,
    fontWeight: '900',
    marginBottom: 4,
  },
  healthMetricTitle: {
    color: palette.textSoft,
    fontSize: 13,
    fontWeight: '800',
  },
  healthMetricSubtitle: {
    color: palette.textMuted,
    fontSize: 11,
    lineHeight: 16,
    marginTop: 6,
  },

  sectionCard: {
    backgroundColor: palette.card,
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
    borderColor: palette.border,
    marginBottom: 16,
  },
  sectionTitle: {
    color: palette.text,
    fontSize: 18,
    fontWeight: '900',
    marginBottom: 14,
  },
  infoRow: {
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: palette.border,
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  infoLabel: {
    color: palette.textMuted,
    fontSize: 13,
    fontWeight: '700',
    flex: 1,
  },
  infoValue: {
    color: palette.text,
    fontSize: 13,
    fontWeight: '900',
    flex: 1,
    textAlign: 'right',
  },

  stack: {
    gap: 12,
  },
  alertCard: {
    backgroundColor: palette.cardSoft,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: palette.border,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  recommendationCard: {
    backgroundColor: palette.cardSoft,
    borderRadius: 18,
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
  alertMeta: {
    marginTop: 6,
    color: palette.textMuted,
    fontSize: 11,
    fontWeight: '700',
  },
  impactWrap: {
    marginLeft: 10,
    alignItems: 'flex-end',
  },
  impactValue: {
    fontSize: 13,
    fontWeight: '900',
  },
  impactLabel: {
    color: palette.textMuted,
    fontSize: 10,
    fontWeight: '700',
    marginTop: 2,
  },

  actionRow: {
    gap: 12,
  },
  secondaryAction: {
    minHeight: 52,
    borderRadius: 16,
    backgroundColor: palette.blueSoft,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    borderWidth: 1,
    borderColor: palette.border,
  },
  secondaryActionText: {
    color: palette.info,
    fontSize: 14,
    fontWeight: '800',
  },
  primaryAction: {
    minHeight: 54,
    borderRadius: 16,
    backgroundColor: palette.primary2,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  primaryActionText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '900',
  },

  emptyStateWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  emptyTitle: {
    color: palette.text,
    fontSize: 18,
    fontWeight: '900',
    marginBottom: 12,
  },
  backButton: {
    backgroundColor: palette.primary2,
    borderRadius: 14,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  backButtonText: {
    color: '#fff',
    fontWeight: '800',
  },
  emptyText: {
    color: palette.textMuted,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '500',
  },
});