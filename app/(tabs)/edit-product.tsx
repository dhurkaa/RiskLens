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
import { useLocalSearchParams, router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { supabase } from '../../lib/supabase';

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
};

type FormState = {
  name: string;
  category: string;
  sku: string;
  barcode: string;
  stock_quantity: string;
  min_stock_level: string;
  selling_price: string;
  cost_price: string;
  expiry_date: string;
  supplier_name: string;
  status: string;
};

function safeNumber(value?: number | null) {
  return Number(value || 0);
}

function marginPercent(selling?: number | null, cost?: number | null) {
  const s = safeNumber(selling);
  const c = safeNumber(cost);
  if (s <= 0) return 0;
  return ((s - c) / s) * 100;
}

function isValidIsoDate(value: string) {
  if (!value) return true;
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function buildInitialForm(product: ProductRow): FormState {
  return {
    name: product.name || '',
    category: product.category || '',
    sku: product.sku || '',
    barcode: product.barcode || '',
    stock_quantity: String(product.stock_quantity ?? 0),
    min_stock_level: String(product.min_stock_level ?? 0),
    selling_price: String(product.selling_price ?? 0),
    cost_price: String(product.cost_price ?? 0),
    expiry_date: product.expiry_date || '',
    supplier_name: product.supplier_name || '',
    status: product.status || 'active',
  };
}

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType = 'default',
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  keyboardType?: 'default' | 'numeric';
}) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={palette.textMuted}
        keyboardType={keyboardType}
        style={styles.input}
      />
    </View>
  );
}

function StatusChip({
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
      style={[styles.statusChip, active && styles.statusChipActive]}
      onPress={onPress}
      activeOpacity={0.9}
    >
      <Text style={[styles.statusChipText, active && styles.statusChipTextActive]}>
        {label}
      </Text>
    </TouchableOpacity>
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

function MetricCard({
  title,
  value,
  subtitle,
  tone = 'green',
}: {
  title: string;
  value: string;
  subtitle: string;
  tone?: 'green' | 'yellow' | 'red' | 'blue';
}) {
  const bgMap = {
    green: palette.greenSoft,
    yellow: palette.yellowSoft,
    red: palette.redSoft,
    blue: palette.blueSoft,
  } as const;

  return (
    <View style={[styles.metricCard, { backgroundColor: bgMap[tone] }]}>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricTitle}>{title}</Text>
      <Text style={styles.metricSubtitle}>{subtitle}</Text>
    </View>
  );
}

export default function EditProductScreen() {
  const params = useLocalSearchParams<{ id?: string }>();
  const productId = typeof params.id === 'string' ? params.id : '';

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [product, setProduct] = useState<ProductRow | null>(null);
  const [form, setForm] = useState<FormState | null>(null);
  const [saving, setSaving] = useState(false);

  const loadProduct = useCallback(
    async (isRefresh = false) => {
      try {
        if (!productId) {
          Alert.alert('Missing product ID', 'No product ID was provided.');
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

        const { data, error } = await supabase
          .from('food_products')
          .select('*')
          .eq('id', productId)
          .eq('user_id', user.id)
          .maybeSingle();

        if (error) throw error;

        if (!data) {
          Alert.alert('Not found', 'This product does not exist anymore.');
          router.back();
          return;
        }

        const productData = data as ProductRow;
        setProduct(productData);
        setForm(buildInitialForm(productData));
      } catch (error: unknown) {
        const message =
          error instanceof Error ? error.message : 'Failed to load product.';
        Alert.alert('Edit product error', message);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [productId]
  );

  useEffect(() => {
    loadProduct();
  }, [loadProduct]);

  const derived = useMemo(() => {
    if (!form) {
      return {
        stock: 0,
        minStock: 0,
        selling: 0,
        cost: 0,
        margin: 0,
      };
    }

    const stock = Number(form.stock_quantity || 0);
    const minStock = Number(form.min_stock_level || 0);
    const selling = Number(form.selling_price || 0);
    const cost = Number(form.cost_price || 0);
    const margin = marginPercent(selling, cost);

    return {
      stock,
      minStock,
      selling,
      cost,
      margin,
    };
  }, [form]);

  const setField = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));
  };

  const validateForm = () => {
    if (!form) return 'Form is not ready.';
    if (!form.name.trim()) return 'Product name is required.';
    if (Number(form.stock_quantity) < 0) return 'Stock quantity cannot be negative.';
    if (Number(form.min_stock_level) < 0) return 'Minimum stock cannot be negative.';
    if (Number(form.selling_price) < 0) return 'Selling price cannot be negative.';
    if (Number(form.cost_price) < 0) return 'Cost price cannot be negative.';
    if (!isValidIsoDate(form.expiry_date)) {
      return 'Expiry date must be in YYYY-MM-DD format.';
    }
    if (!['active', 'inactive', 'archived'].includes(form.status)) {
      return 'Invalid status selected.';
    }
    return null;
  };

  const saveProduct = async () => {
    try {
      if (!form || !product) return;

      const validationError = validateForm();
      if (validationError) {
        Alert.alert('Validation error', validationError);
        return;
      }

      setSaving(true);
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      const payload = {
        name: form.name.trim(),
        category: form.category.trim() || null,
        sku: form.sku.trim() || null,
        barcode: form.barcode.trim() || null,
        stock_quantity: Number(form.stock_quantity || 0),
        min_stock_level: Number(form.min_stock_level || 0),
        selling_price: Number(form.selling_price || 0),
        cost_price: Number(form.cost_price || 0),
        expiry_date: form.expiry_date.trim() || null,
        supplier_name: form.supplier_name.trim() || null,
        status: form.status,
      };

      const { error } = await supabase
        .from('food_products')
        .update(payload)
        .eq('id', product.id);

      if (error) throw error;

      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      Alert.alert('Saved', `${payload.name} was updated successfully.`, [
        {
          text: 'Open details',
          onPress: () => {
            if (!product) return;
            router.replace(`/product-details?id=${product.id}`);
          },
        },
        {
          text: 'Stay here',
          style: 'cancel',
        },
      ]);
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : 'Failed to save product.';
      Alert.alert('Save failed', message);
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    if (!product) return;
    setForm(buildInitialForm(product));
  };

  const onRefresh = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await loadProduct(true);
  };

  if (loading || !form) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={palette.primary2} />
          <Text style={styles.loadingText}>Loading edit form...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
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
            <TouchableOpacity style={styles.heroButton} onPress={() => router.back()}>
              <Ionicons name="arrow-back-outline" size={20} color="#fff" />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.heroButton}
              onPress={() => {
                if (!product) return;
                router.replace(`/product-details?id=${product.id}`);
              }}
            >
              <Ionicons name="eye-outline" size={20} color="#fff" />
            </TouchableOpacity>
          </View>

          <View style={styles.heroRow}>
            <View style={styles.heroIconWrap}>
              <MaterialCommunityIcons name="square-edit-outline" size={24} color="#fff" />
            </View>

            <View style={{ flex: 1 }}>
              <Text style={styles.heroEyebrow}>Product editor</Text>
              <Text style={styles.heroTitle}>Edit Product</Text>
              <Text style={styles.heroSubtitle}>
                Update stock, pricing, supplier, category, expiry and product status.
              </Text>
            </View>
          </View>
        </LinearGradient>

        <SectionHeader
          eyebrow="Live preview"
          title="Current edit state"
          subtitle="These values update as you change the form."
        />

        <View style={styles.previewGrid}>
          <MetricCard
            title="Stock"
            value={`${derived.stock}`}
            subtitle="Units available"
            tone="green"
          />
          <MetricCard
            title="Min stock"
            value={`${derived.minStock}`}
            subtitle="Safety level"
            tone="yellow"
          />
          <MetricCard
            title="Margin"
            value={`${derived.margin.toFixed(0)}%`}
            subtitle="Estimated gross margin"
            tone="blue"
          />
          <MetricCard
            title="Selling"
            value={`€${derived.selling.toFixed(2)}`}
            subtitle="Current sale price"
            tone="red"
          />
        </View>

        <SectionHeader
          eyebrow="Basics"
          title="Basic information"
          subtitle="Core product identity and supplier reference."
        />

        <View style={styles.sectionCard}>
          <Field
            label="Product name"
            value={form.name}
            onChangeText={(value) => setField('name', value)}
            placeholder="Fresh Milk 1L"
          />

          <Field
            label="Category"
            value={form.category}
            onChangeText={(value) => setField('category', value)}
            placeholder="Dairy"
          />

          <Field
            label="Supplier"
            value={form.supplier_name}
            onChangeText={(value) => setField('supplier_name', value)}
            placeholder="Kos Dairy"
          />

          <Field
            label="SKU"
            value={form.sku}
            onChangeText={(value) => setField('sku', value)}
            placeholder="DAIRY-001"
          />

          <Field
            label="Barcode"
            value={form.barcode}
            onChangeText={(value) => setField('barcode', value)}
            placeholder="100000000001"
          />
        </View>

        <SectionHeader
          eyebrow="Inventory"
          title="Inventory and pricing"
          subtitle="Operational quantities, pricing and expiry timing."
        />

        <View style={styles.sectionCard}>
          <Field
            label="Stock quantity"
            value={form.stock_quantity}
            onChangeText={(value) => setField('stock_quantity', value)}
            placeholder="18"
            keyboardType="numeric"
          />

          <Field
            label="Minimum stock level"
            value={form.min_stock_level}
            onChangeText={(value) => setField('min_stock_level', value)}
            placeholder="10"
            keyboardType="numeric"
          />

          <Field
            label="Selling price"
            value={form.selling_price}
            onChangeText={(value) => setField('selling_price', value)}
            placeholder="1.59"
            keyboardType="numeric"
          />

          <Field
            label="Cost price"
            value={form.cost_price}
            onChangeText={(value) => setField('cost_price', value)}
            placeholder="1.05"
            keyboardType="numeric"
          />

          <Field
            label="Expiry date"
            value={form.expiry_date}
            onChangeText={(value) => setField('expiry_date', value)}
            placeholder="2026-04-22"
          />
        </View>

        <SectionHeader
          eyebrow="Status"
          title="Lifecycle state"
          subtitle="Choose how this product should behave in your system."
        />

        <View style={styles.sectionCard}>
          <View style={styles.statusRow}>
            <StatusChip
              label="active"
              active={form.status === 'active'}
              onPress={() => setField('status', 'active')}
            />
            <StatusChip
              label="inactive"
              active={form.status === 'inactive'}
              onPress={() => setField('status', 'inactive')}
            />
            <StatusChip
              label="archived"
              active={form.status === 'archived'}
              onPress={() => setField('status', 'archived')}
            />
          </View>
        </View>

        <View style={styles.actionsWrap}>
          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={resetForm}
            activeOpacity={0.9}
          >
            <Ionicons name="refresh-outline" size={18} color={palette.info} />
            <Text style={styles.secondaryButtonText}>Reset changes</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.primaryButton}
            onPress={saveProduct}
            activeOpacity={0.9}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="save-outline" size={18} color="#fff" />
                <Text style={styles.primaryButtonText}>Save product</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        <View style={{ height: 28 }} />
      </ScrollView>
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
  heroRow: {
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
    marginBottom: 6,
    letterSpacing: -0.5,
  },
  heroSubtitle: {
    color: 'rgba(255,255,255,0.84)',
    fontSize: 13,
    lineHeight: 20,
    fontWeight: '500',
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

  previewGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 18,
  },
  metricCard: {
    width: '48.2%',
    borderRadius: 22,
    padding: 16,
  },
  metricValue: {
    color: palette.text,
    fontSize: 24,
    fontWeight: '900',
    marginBottom: 6,
    letterSpacing: -0.5,
  },
  metricTitle: {
    color: palette.textSoft,
    fontSize: 13,
    fontWeight: '800',
  },
  metricSubtitle: {
    color: palette.textMuted,
    fontSize: 11,
    marginTop: 6,
    lineHeight: 16,
    fontWeight: '500',
  },

  sectionCard: {
    backgroundColor: palette.surface,
    borderRadius: 24,
    padding: 16,
    borderWidth: 1,
    borderColor: palette.border,
    marginBottom: 18,
  },

  fieldWrap: {
    marginBottom: 14,
  },
  fieldLabel: {
    color: palette.textSoft,
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 8,
  },
  input: {
    minHeight: 50,
    borderRadius: 16,
    backgroundColor: palette.surfaceSoft,
    borderWidth: 1,
    borderColor: palette.border,
    paddingHorizontal: 14,
    color: palette.text,
    fontSize: 14,
  },

  statusRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  statusChip: {
    backgroundColor: palette.surfaceSoft,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  statusChipActive: {
    backgroundColor: palette.primary2,
    borderColor: palette.primary2,
  },
  statusChipText: {
    color: palette.textSoft,
    fontSize: 12,
    fontWeight: '800',
  },
  statusChipTextActive: {
    color: '#fff',
  },

  actionsWrap: {
    gap: 12,
  },
  secondaryButton: {
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
  secondaryButtonText: {
    color: palette.info,
    fontSize: 14,
    fontWeight: '800',
  },
  primaryButton: {
    minHeight: 54,
    borderRadius: 16,
    backgroundColor: palette.primary2,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '900',
  },
});