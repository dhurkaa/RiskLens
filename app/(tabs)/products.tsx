import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
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
  accent: '#6FD08C',

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

type FilterType =
  | 'all'
  | 'low_stock'
  | 'near_expiry'
  | 'weak_margin'
  | 'high_risk';

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

function formatExpiryLabel(dateString?: string | null) {
  const days = daysUntil(dateString);
  if (days === null) return 'No expiry';
  if (days < 0) return `Expired ${Math.abs(days)}d ago`;
  if (days === 0) return 'Expires today';
  return `${days} days left`;
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
  if (score >= 70) return { color: palette.danger, bg: palette.redSoft, label: 'High risk' };
  if (score >= 40) return { color: palette.warning, bg: palette.yellowSoft, label: 'Medium risk' };
  return { color: palette.success, bg: palette.greenSoft, label: 'Low risk' };
}

function statusPill(item: ProductRow) {
  const stock = safeNumber(item.stock_quantity);
  const minStock = safeNumber(item.min_stock_level);
  const expiry = daysUntil(item.expiry_date);
  const margin = marginPercent(item.selling_price, item.cost_price);

  if (expiry !== null && expiry < 0) {
    return { label: 'Expired', color: palette.danger, bg: palette.redSoft };
  }
  if (expiry !== null && expiry <= 2) {
    return { label: 'Urgent expiry', color: palette.danger, bg: palette.redSoft };
  }
  if (stock <= 0) {
    return { label: 'Out of stock', color: palette.info, bg: palette.blueSoft };
  }
  if (minStock > 0 && stock <= minStock) {
    return { label: 'Low stock', color: palette.warning, bg: palette.yellowSoft };
  }
  if (margin < 10) {
    return { label: 'Weak margin', color: palette.purple, bg: palette.purpleSoft };
  }

  return { label: 'Healthy', color: palette.success, bg: palette.greenSoft };
}

function FilterChip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[styles.filterChip, active ? styles.filterChipActive : undefined]}
      onPress={onPress}
      activeOpacity={0.9}
    >
      <Text
        style={[styles.filterChipText, active ? styles.filterChipTextActive : undefined]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

function SummaryCard({
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
  tone?: 'green' | 'yellow' | 'red' | 'blue' | 'purple';
}) {
  const bgMap = {
    green: palette.greenSoft,
    yellow: palette.yellowSoft,
    red: palette.redSoft,
    blue: palette.blueSoft,
    purple: palette.purpleSoft,
  } as const;

  const colorMap = {
    green: palette.primary2,
    yellow: palette.warning,
    red: palette.danger,
    blue: palette.info,
    purple: palette.purple,
  } as const;

  return (
    <View style={styles.summaryCard}>
      <View style={[styles.summaryIconWrap, { backgroundColor: bgMap[tone] }]}>
        <Ionicons name={icon} size={18} color={colorMap[tone]} />
      </View>
      <Text style={styles.summaryValue}>{value}</Text>
      <Text style={styles.summaryTitle}>{title}</Text>
      <Text style={styles.summarySubtitle}>{subtitle}</Text>
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

function ProductCard({
  item,
  onDelete,
}: {
  item: ProductRow;
  onDelete: (id: string, name: string) => void;
}) {
  const stock = safeNumber(item.stock_quantity);
  const minStock = safeNumber(item.min_stock_level);
  const margin = marginPercent(item.selling_price, item.cost_price);
  const expiryLabel = formatExpiryLabel(item.expiry_date);
  const risk = riskScore(item);
  const riskMeta = riskTone(risk);
  const status = statusPill(item);

  return (
    <View style={styles.productCard}>
      <View style={styles.productTopRow}>
        <View style={styles.productMainLeft}>
          <View style={styles.productIconWrap}>
            <MaterialCommunityIcons
              name="food-outline"
              size={20}
              color={palette.primary2}
            />
          </View>

          <View style={{ flex: 1 }}>
            <Text style={styles.productName}>{item.name}</Text>
            <Text style={styles.productMeta}>
              {item.category || 'General'} • {item.supplier_name || 'No supplier'}
            </Text>
          </View>
        </View>

        <View style={styles.productActions}>
          <TouchableOpacity
            style={styles.iconButton}
            onPress={() =>
              router.push({
                pathname: '/product-details',
                params: { id: item.id },
              })
            }
          >
            <Feather name="eye" size={18} color={palette.info} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.iconButton}
            onPress={() => onDelete(item.id, item.name)}
          >
            <Ionicons name="trash-outline" size={18} color={palette.danger} />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.badgesRow}>
        <View style={[styles.badge, { backgroundColor: status.bg }]}>
          <Text style={[styles.badgeText, { color: status.color }]}>
            {status.label}
          </Text>
        </View>

        <View style={[styles.badge, { backgroundColor: riskMeta.bg }]}>
          <Text style={[styles.badgeText, { color: riskMeta.color }]}>
            {riskMeta.label}
          </Text>
        </View>
      </View>

      <View style={styles.metricsRow}>
        <View style={styles.metricBox}>
          <Text style={styles.metricValue}>{stock}</Text>
          <Text style={styles.metricLabel}>Stock</Text>
        </View>

        <View style={styles.metricBox}>
          <Text style={styles.metricValue}>{minStock}</Text>
          <Text style={styles.metricLabel}>Min stock</Text>
        </View>

        <View style={styles.metricBox}>
          <Text style={styles.metricValue}>{margin.toFixed(0)}%</Text>
          <Text style={styles.metricLabel}>Margin</Text>
        </View>

        <View style={styles.metricBox}>
          <Text style={styles.metricValue}>{risk}%</Text>
          <Text style={styles.metricLabel}>Risk</Text>
        </View>
      </View>

      <View style={styles.bottomInfoRow}>
        <View style={styles.bottomInfoItem}>
          <Ionicons name="time-outline" size={14} color={palette.warning} />
          <Text style={styles.bottomInfoText}>{expiryLabel}</Text>
        </View>

        <View style={styles.bottomInfoItem}>
          <Ionicons name="pricetag-outline" size={14} color={palette.primary2} />
          <Text style={styles.bottomInfoText}>
            {formatCurrency(item.selling_price)} sell / {formatCurrency(item.cost_price)} cost
          </Text>
        </View>
      </View>

      <View style={styles.codesRow}>
        <Text style={styles.codeText}>SKU: {item.sku || '—'}</Text>
        <Text style={styles.codeText}>Barcode: {item.barcode || '—'}</Text>
      </View>
    </View>
  );
}

export default function ProductsScreen() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [search, setSearch] = useState('');
  const [selectedFilter, setSelectedFilter] = useState<FilterType>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');

  const loadProducts = useCallback(async (isRefresh = false) => {
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

      const { data, error } = await supabase
        .from('food_products')
        .select(
          'id, name, category, sku, barcode, stock_quantity, min_stock_level, selling_price, cost_price, expiry_date, supplier_name, status, created_at'
        )
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setProducts((data as ProductRow[]) || []);
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : 'Failed to load products.';
      Alert.alert('Products error', message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  const categories = useMemo(() => {
    const list = Array.from(
      new Set(products.map((p) => p.category?.trim()).filter(Boolean))
    ) as string[];
    return ['All', ...list.sort()];
  }, [products]);

  const filteredProducts = useMemo(() => {
    let result = [...products];

    const query = search.trim().toLowerCase();
    if (query) {
      result = result.filter((item) => {
        return (
          item.name?.toLowerCase().includes(query) ||
          item.category?.toLowerCase().includes(query) ||
          item.supplier_name?.toLowerCase().includes(query) ||
          item.sku?.toLowerCase().includes(query) ||
          item.barcode?.toLowerCase().includes(query)
        );
      });
    }

    if (selectedCategory !== 'All') {
      result = result.filter((item) => item.category === selectedCategory);
    }

    if (selectedFilter === 'low_stock') {
      result = result.filter((item) => {
        const stock = safeNumber(item.stock_quantity);
        const minStock = safeNumber(item.min_stock_level);
        return minStock > 0 ? stock <= minStock : stock <= 10;
      });
    }

    if (selectedFilter === 'near_expiry') {
      result = result.filter((item) => {
        const d = daysUntil(item.expiry_date);
        return d !== null && d >= 0 && d <= 7;
      });
    }

    if (selectedFilter === 'weak_margin') {
      result = result.filter(
        (item) => marginPercent(item.selling_price, item.cost_price) < 15
      );
    }

    if (selectedFilter === 'high_risk') {
      result = result.filter((item) => riskScore(item) >= 70);
    }

    result.sort((a, b) => riskScore(b) - riskScore(a));
    return result;
  }, [products, search, selectedCategory, selectedFilter]);

  const summary = useMemo(() => {
    const total = products.length;
    const lowStock = products.filter((item) => {
      const stock = safeNumber(item.stock_quantity);
      const min = safeNumber(item.min_stock_level);
      return min > 0 ? stock <= min : stock <= 10;
    }).length;

    const nearExpiry = products.filter((item) => {
      const d = daysUntil(item.expiry_date);
      return d !== null && d >= 0 && d <= 7;
    }).length;

    const highRisk = products.filter((item) => riskScore(item) >= 70).length;

    const weakMargin = products.filter(
      (item) => marginPercent(item.selling_price, item.cost_price) < 15
    ).length;

    const totalInventoryValue = products.reduce(
      (sum, item) =>
        sum + safeNumber(item.stock_quantity) * safeNumber(item.cost_price),
      0
    );

    return {
      total,
      lowStock,
      nearExpiry,
      highRisk,
      weakMargin,
      totalInventoryValue,
    };
  }, [products]);

  const handleDelete = async (id: string, name: string) => {
    Alert.alert(
      'Delete product',
      `Are you sure you want to delete ${name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await Haptics.notificationAsync(
                Haptics.NotificationFeedbackType.Warning
              );

              const { error } = await supabase
                .from('food_products')
                .delete()
                .eq('id', id);

              if (error) throw error;

              setProducts((prev) => prev.filter((item) => item.id !== id));
            } catch (error: unknown) {
              const message =
                error instanceof Error
                  ? error.message
                  : 'Failed to delete product.';
              Alert.alert('Delete failed', message);
            }
          },
        },
      ]
    );
  };

  const onRefresh = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await loadProducts(true);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={palette.primary2} />
          <Text style={styles.loadingText}>Loading products...</Text>
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
            <View style={styles.heroTopRow}>
              <View style={styles.heroLeft}>
                <TouchableOpacity
                  style={styles.heroMenuButton}
                  onPress={() => setSidebarOpen(true)}
                >
                  <Ionicons name="menu-outline" size={20} color="#fff" />
                </TouchableOpacity>

                <View style={styles.heroIconWrap}>
                  <MaterialCommunityIcons
                    name="cart-outline"
                    size={22}
                    color="#fff"
                  />
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={styles.heroEyebrow}>Inventory</Text>
                  <Text style={styles.heroTitle}>Products</Text>
                </View>
              </View>

              <TouchableOpacity
                style={styles.heroAction}
                onPress={() => router.push('/(tabs)/upload')}
              >
                <Ionicons name="add-outline" size={20} color="#fff" />
              </TouchableOpacity>
            </View>

            <Text style={styles.heroSubtitle}>
              Search, filter and monitor inventory through stock, expiry, margin and product risk.
            </Text>

            <View style={styles.heroInsightBand}>
              <View style={styles.heroInsightItem}>
                <Text style={styles.heroInsightLabel}>Inventory value</Text>
                <Text style={styles.heroInsightValue}>
                  {formatCompactCurrency(summary.totalInventoryValue)}
                </Text>
              </View>

              <View style={styles.heroDivider} />

              <View style={styles.heroInsightItem}>
                <Text style={styles.heroInsightLabel}>Weak margin</Text>
                <Text style={styles.heroInsightValue}>{summary.weakMargin}</Text>
              </View>

              <View style={styles.heroDivider} />

              <View style={styles.heroInsightItem}>
                <Text style={styles.heroInsightLabel}>High risk</Text>
                <Text style={styles.heroInsightValue}>{summary.highRisk}</Text>
              </View>
            </View>
          </LinearGradient>

          <SectionHeader
            eyebrow="Overview"
            title="Inventory health"
            subtitle="A quick reading of stock pressure, expiry exposure and product risk."
          />

          <View style={styles.summaryGrid}>
            <SummaryCard
              title="Products"
              value={`${summary.total}`}
              subtitle="Tracked inventory items"
              icon="basket-outline"
              tone="green"
            />
            <SummaryCard
              title="Low stock"
              value={`${summary.lowStock}`}
              subtitle="Need replenishment"
              icon="alert-circle-outline"
              tone="yellow"
            />
            <SummaryCard
              title="Near expiry"
              value={`${summary.nearExpiry}`}
              subtitle="Within 7 days"
              icon="time-outline"
              tone="red"
            />
            <SummaryCard
              title="High risk"
              value={`${summary.highRisk}`}
              subtitle="Products needing action"
              icon="warning-outline"
              tone="purple"
            />
          </View>

          <View style={styles.valueCard}>
            <Text style={styles.valueCardLabel}>Inventory value at cost</Text>
            <Text style={styles.valueCardNumber}>
              {formatCurrency(summary.totalInventoryValue)}
            </Text>
            <Text style={styles.valueCardSubtext}>
              Weak margin products: {summary.weakMargin}
            </Text>
          </View>

          <SectionHeader
            eyebrow="Search"
            title="Find products fast"
            subtitle="Search by product name, category, supplier, SKU or barcode."
          />

          <View style={styles.searchCard}>
            <View style={styles.searchInputWrap}>
              <Ionicons name="search-outline" size={18} color={palette.textMuted} />
              <TextInput
                value={search}
                onChangeText={setSearch}
                placeholder="Search by product, category, SKU, barcode, supplier..."
                placeholderTextColor={palette.textMuted}
                style={styles.searchInput}
              />
              {search ? (
                <TouchableOpacity onPress={() => setSearch('')}>
                  <Ionicons name="close-circle" size={18} color={palette.textMuted} />
                </TouchableOpacity>
              ) : null}
            </View>
          </View>

          <SectionHeader
            eyebrow="Filters"
            title="Refine results"
            subtitle="Use operational filters and category views to narrow the list."
          />

          <View style={styles.filterSectionCard}>
            <Text style={styles.filterLabel}>Operational filters</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.filtersRow}>
                <FilterChip
                  label="All"
                  active={selectedFilter === 'all'}
                  onPress={() => setSelectedFilter('all')}
                />
                <FilterChip
                  label="Low stock"
                  active={selectedFilter === 'low_stock'}
                  onPress={() => setSelectedFilter('low_stock')}
                />
                <FilterChip
                  label="Near expiry"
                  active={selectedFilter === 'near_expiry'}
                  onPress={() => setSelectedFilter('near_expiry')}
                />
                <FilterChip
                  label="Weak margin"
                  active={selectedFilter === 'weak_margin'}
                  onPress={() => setSelectedFilter('weak_margin')}
                />
                <FilterChip
                  label="High risk"
                  active={selectedFilter === 'high_risk'}
                  onPress={() => setSelectedFilter('high_risk')}
                />
              </View>
            </ScrollView>

            <Text style={[styles.filterLabel, { marginTop: 14 }]}>Categories</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.filtersRow}>
                {categories.map((category) => (
                  <FilterChip
                    key={category}
                    label={category}
                    active={selectedCategory === category}
                    onPress={() => setSelectedCategory(category)}
                  />
                ))}
              </View>
            </ScrollView>
          </View>

          <View style={styles.resultsHeader}>
            <View>
              <Text style={styles.resultsTitle}>Results</Text>
              <Text style={styles.resultsSubtitle}>
                {filteredProducts.length} product{filteredProducts.length === 1 ? '' : 's'} matched
              </Text>
            </View>

            <TouchableOpacity
              style={styles.addButton}
              onPress={() => router.push('/(tabs)/upload')}
            >
              <Ionicons name="add-outline" size={18} color="#fff" />
              <Text style={styles.addButtonText}>Add more</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.productsList}>
            {filteredProducts.length > 0 ? (
              filteredProducts.map((item) => (
                <ProductCard key={item.id} item={item} onDelete={handleDelete} />
              ))
            ) : (
              <View style={styles.emptyCard}>
                <View style={styles.emptyIconWrap}>
                  <Ionicons name="file-tray-outline" size={22} color={palette.primary2} />
                </View>
                <Text style={styles.emptyTitle}>No matching products</Text>
                <Text style={styles.emptySubtitle}>
                  Try changing filters or upload a new CSV file.
                </Text>
              </View>
            )}
          </View>

          <View style={{ height: 28 }} />
        </ScrollView>

        <AppSidebar
          visible={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          active="products"
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
  pageWrap: {
    flex: 1,
    backgroundColor: palette.bg,
  },
  container: {
    flex: 1,
    backgroundColor: palette.bg,
  },
  scrollContent: {
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 24,
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
  heroLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
    paddingRight: 12,
  },
  heroMenuButton: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroIconWrap: {
    width: 50,
    height: 50,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.16)',
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
  heroAction: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
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
    marginBottom: 12,
    marginTop: 2,
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

  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 16,
  },
  summaryCard: {
    width: '48.2%',
    backgroundColor: palette.surface,
    borderRadius: 22,
    padding: 16,
    borderWidth: 1,
    borderColor: palette.border,
  },
  summaryIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  summaryValue: {
    color: palette.text,
    fontSize: 24,
    fontWeight: '900',
    marginBottom: 4,
    letterSpacing: -0.5,
  },
  summaryTitle: {
    color: palette.textSoft,
    fontSize: 13,
    fontWeight: '800',
  },
  summarySubtitle: {
    color: palette.textMuted,
    fontSize: 11,
    marginTop: 6,
    lineHeight: 16,
    fontWeight: '500',
  },

  valueCard: {
    backgroundColor: palette.surface,
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: palette.border,
    marginBottom: 18,
  },
  valueCardLabel: {
    color: palette.textMuted,
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 8,
  },
  valueCardNumber: {
    color: palette.text,
    fontSize: 30,
    fontWeight: '900',
    marginBottom: 6,
    letterSpacing: -0.8,
  },
  valueCardSubtext: {
    color: palette.textSoft,
    fontSize: 13,
    fontWeight: '700',
  },

  searchCard: {
    backgroundColor: palette.surface,
    borderRadius: 24,
    padding: 14,
    borderWidth: 1,
    borderColor: palette.border,
    marginBottom: 18,
  },
  searchInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: palette.surfaceSoft,
    borderRadius: 16,
    paddingHorizontal: 14,
    minHeight: 52,
    borderWidth: 1,
    borderColor: palette.border,
  },
  searchInput: {
    flex: 1,
    color: palette.text,
    fontSize: 14,
    marginLeft: 10,
    marginRight: 10,
  },

  filterSectionCard: {
    backgroundColor: palette.surface,
    borderRadius: 24,
    padding: 16,
    borderWidth: 1,
    borderColor: palette.border,
    marginBottom: 18,
  },
  filterLabel: {
    color: palette.text,
    fontSize: 15,
    fontWeight: '900',
    marginBottom: 10,
  },
  filtersRow: {
    flexDirection: 'row',
    gap: 10,
    paddingRight: 8,
  },
  filterChip: {
    backgroundColor: palette.surfaceSoft,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  filterChipActive: {
    backgroundColor: palette.primary2,
    borderColor: palette.primary2,
  },
  filterChipText: {
    color: palette.textSoft,
    fontSize: 12,
    fontWeight: '800',
  },
  filterChipTextActive: {
    color: '#FFFFFF',
  },

  resultsHeader: {
    marginTop: 4,
    marginBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  resultsTitle: {
    color: palette.text,
    fontSize: 18,
    fontWeight: '900',
  },
  resultsSubtitle: {
    color: palette.textMuted,
    fontSize: 13,
    fontWeight: '700',
    marginTop: 2,
  },
  addButton: {
    minHeight: 42,
    borderRadius: 14,
    backgroundColor: palette.primary2,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  addButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '800',
  },

  productsList: {
    gap: 12,
  },
  productCard: {
    backgroundColor: palette.surface,
    borderRadius: 24,
    padding: 16,
    borderWidth: 1,
    borderColor: palette.border,
  },
  productTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  productMainLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    paddingRight: 12,
  },
  productIconWrap: {
    width: 46,
    height: 46,
    borderRadius: 16,
    backgroundColor: palette.greenSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  productName: {
    color: palette.text,
    fontSize: 15,
    fontWeight: '900',
    marginBottom: 4,
  },
  productMeta: {
    color: palette.textMuted,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '600',
  },
  productActions: {
    flexDirection: 'row',
    gap: 8,
  },
  iconButton: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: palette.surfaceSoft,
    borderWidth: 1,
    borderColor: palette.border,
    alignItems: 'center',
    justifyContent: 'center',
  },

  badgesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  badge: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '800',
  },

  metricsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 12,
  },
  metricBox: {
    flex: 1,
    minWidth: '22%',
    backgroundColor: palette.surfaceSoft,
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: palette.border,
    alignItems: 'center',
  },
  metricValue: {
    color: palette.text,
    fontSize: 15,
    fontWeight: '900',
    marginBottom: 4,
  },
  metricLabel: {
    color: palette.textMuted,
    fontSize: 11,
    fontWeight: '700',
  },

  bottomInfoRow: {
    gap: 8,
    marginBottom: 10,
  },
  bottomInfoItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  bottomInfoText: {
    marginLeft: 8,
    color: palette.textSoft,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '600',
  },

  codesRow: {
    borderTopWidth: 1,
    borderTopColor: palette.border,
    paddingTop: 10,
    gap: 4,
  },
  codeText: {
    color: palette.textMuted,
    fontSize: 11,
    fontWeight: '700',
  },

  emptyCard: {
    backgroundColor: palette.surface,
    borderRadius: 24,
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
  },
  emptySubtitle: {
    color: palette.textMuted,
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
    fontWeight: '500',
  },
});