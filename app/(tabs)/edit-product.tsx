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

export default function EditProductScreen() {
  const params = useLocalSearchParams<{ id?: string }>();
  const productId = typeof params.id === 'string' ? params.id : '';

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [product, setProduct] = useState<ProductRow | null>(null);
  const [form, setForm] = useState<FormState | null>(null);
  const [saving, setSaving] = useState(false);

  const loadProduct = useCallback(async (isRefresh = false) => {
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
  }, [productId]);

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
        <LinearGradient colors={[palette.bg, palette.bg2, palette.bg3]} style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={palette.primary2} />
          <Text style={styles.loadingText}>Loading edit form...</Text>
        </LinearGradient>
      </SafeAreaView>
    );
  }

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
            style={styles.heroCard}
          >
            <View style={styles.heroTopRow}>
              <TouchableOpacity style={styles.headerButton} onPress={() => router.back()}>
                <Ionicons name="arrow-back-outline" size={20} color={palette.primary2} />
              </TouchableOpacity>

              <TouchableOpacity
  style={styles.headerButton}
  onPress={() => {
    if (!product) return;
    router.replace(`/product-details?id=${product.id}`);
  }}
>
  <Ionicons name="eye-outline" size={20} color={palette.info} />
</TouchableOpacity>
            </View>

            <View style={styles.heroRow}>
              <View style={styles.heroIconWrap}>
                <MaterialCommunityIcons name="square-edit-outline" size={24} color={palette.primary2} />
              </View>

              <View style={{ flex: 1 }}>
                <Text style={styles.heroTitle}>Edit Product</Text>
                <Text style={styles.heroSubtitle}>
                  Update stock, prices, supplier, category, expiry, and product status.
                </Text>
              </View>
            </View>
          </LinearGradient>

          <View style={styles.previewGrid}>
            <View style={styles.previewCard}>
              <Text style={styles.previewValue}>{derived.stock}</Text>
              <Text style={styles.previewLabel}>Stock</Text>
            </View>
            <View style={styles.previewCard}>
              <Text style={styles.previewValue}>{derived.minStock}</Text>
              <Text style={styles.previewLabel}>Min stock</Text>
            </View>
            <View style={styles.previewCard}>
              <Text style={styles.previewValue}>{derived.margin.toFixed(0)}%</Text>
              <Text style={styles.previewLabel}>Margin</Text>
            </View>
            <View style={styles.previewCard}>
              <Text style={styles.previewValue}>€{derived.selling.toFixed(2)}</Text>
              <Text style={styles.previewLabel}>Selling</Text>
            </View>
          </View>

          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Basic information</Text>

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

          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Inventory and pricing</Text>

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

          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Status</Text>

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
  heroRow: {
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

  previewGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 16,
  },
  previewCard: {
    width: '48.2%',
    backgroundColor: palette.card,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: palette.border,
    alignItems: 'center',
  },
  previewValue: {
    color: palette.text,
    fontSize: 24,
    fontWeight: '900',
    marginBottom: 6,
  },
  previewLabel: {
    color: palette.textMuted,
    fontSize: 12,
    fontWeight: '800',
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
    backgroundColor: palette.cardSoft,
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
    backgroundColor: palette.cardSoft,
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