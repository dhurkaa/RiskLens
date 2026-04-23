import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { supabase } from '../../lib/supabase';
import AppSidebar from '../../components/appsidebar';

type PricingRunRow = {
  id: string;
  status: 'draft' | 'applied' | 'cancelled';
  created_at?: string | null;
};

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

type OptimizationGoal = 'profit' | 'waste' | 'turnover' | 'balanced';

type PricingSuggestion = {
  product_id: string;
  product_name: string;
  current_price: number;
  suggested_price: number;
  change_percent: number;
  reason: string;
  confidence: number;
  expected_effect: string;
  action_type: 'discount' | 'price_up' | 'hold';
  score: number;
  selected: boolean;
};

type AnswersState = {
  goal: OptimizationGoal;
  maxChangePercent: string;
  aggressiveExpiryDiscounts: boolean;
  protectPremiumMargins: boolean;
  increasePriceOnLowStock: boolean;
  saferMode: boolean;
  notes: string;
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

function goalLabel(goal: OptimizationGoal) {
  if (goal === 'profit') return 'Maximize Profit';
  if (goal === 'waste') return 'Reduce Waste';
  if (goal === 'turnover') return 'Increase Turnover';
  return 'Balanced Strategy';
}

function buildSuggestion(product: ProductRow, answers: AnswersState): PricingSuggestion | null {
  const currentPrice = safeNumber(product.selling_price);
  const costPrice = safeNumber(product.cost_price);
  const stock = safeNumber(product.stock_quantity);
  const minStock = safeNumber(product.min_stock_level);
  const expiryDays = daysUntil(product.expiry_date);
  const margin = marginPercent(currentPrice, costPrice);
  const maxChange = Math.max(1, Math.min(50, safeNumber(Number(answers.maxChangePercent || 10))));
  const saferFactor = answers.saferMode ? 0.7 : 1;

  if (currentPrice <= 0) return null;

  let suggestedPrice = currentPrice;
  let confidence = 55;
  let score = 0;
  let actionType: 'discount' | 'price_up' | 'hold' = 'hold';
  let reason = 'No major pricing change is needed right now.';
  let expectedEffect = 'Maintain current performance without unnecessary pricing volatility.';

  const lowStock = minStock > 0 ? stock <= minStock : stock <= 10;
  const severeLowStock = minStock > 0 ? stock <= Math.max(1, Math.floor(minStock * 0.6)) : stock <= 4;
  const nearExpiry = expiryDays !== null && expiryDays >= 0 && expiryDays <= 7;
  const urgentExpiry = expiryDays !== null && expiryDays >= 0 && expiryDays <= 2;
  const expiredRisk = expiryDays !== null && expiryDays < 0;
  const weakMargin = margin < 15;
  const strongMargin = margin >= 28;

  if (expiredRisk) {
    suggestedPrice = currentPrice * (1 - Math.min(maxChange / 100, 0.25) * saferFactor);
    confidence = 96;
    score = 98;
    actionType = 'discount';
    reason = 'This product is already expired or beyond safe timing and needs immediate markdown action.';
    expectedEffect = 'Reduce total loss and clear dead stock faster.';
  } else if (urgentExpiry && stock > 0) {
    const baseDiscount = answers.aggressiveExpiryDiscounts ? 0.18 : 0.1;

    const goalBoost =
      answers.goal === 'waste'
        ? 0.06
        : answers.goal === 'turnover'
        ? 0.04
        : answers.goal === 'profit'
        ? -0.02
        : 0;

    const finalDiscount = Math.max(
      0.03,
      Math.min(maxChange / 100, (baseDiscount + goalBoost) * saferFactor)
    );

    suggestedPrice = currentPrice * (1 - finalDiscount);
    confidence = 92;
    score = 92;
    actionType = 'discount';
    reason = 'This product is close to expiry and still has inventory on hand, so a controlled markdown is recommended.';
    expectedEffect = 'Improve sell-through and reduce waste exposure.';
  } else if (nearExpiry && stock >= Math.max(6, minStock)) {
    const finalDiscount = Math.max(
      0.02,
      Math.min(maxChange / 100, (answers.goal === 'waste' ? 0.08 : 0.05) * saferFactor)
    );

    suggestedPrice = currentPrice * (1 - finalDiscount);
    confidence = 82;
    score = 78;
    actionType = 'discount';
    reason = 'Inventory is still relatively high while expiry is approaching, so a smaller markdown is appropriate.';
    expectedEffect = 'Reduce future waste risk without over-discounting.';
  } else if (answers.increasePriceOnLowStock && severeLowStock && !nearExpiry) {
    const markup = Math.max(
      0.02,
      Math.min(maxChange / 100, (answers.goal === 'profit' ? 0.08 : 0.05) * saferFactor)
    );

    suggestedPrice = currentPrice * (1 + markup);
    confidence = answers.goal === 'profit' ? 86 : 76;
    score = 80;
    actionType = 'price_up';
    reason = 'Stock is critically low and price can be adjusted upward slightly to protect margin and slow depletion.';
    expectedEffect = 'Protect profit while inventory remains constrained.';
  } else if (answers.increasePriceOnLowStock && lowStock && weakMargin && !nearExpiry) {
    const markup = Math.max(
      0.015,
      Math.min(maxChange / 100, (answers.goal === 'profit' ? 0.06 : 0.035) * saferFactor)
    );

    suggestedPrice = currentPrice * (1 + markup);
    confidence = 74;
    score = 68;
    actionType = 'price_up';
    reason = 'Stock is under pressure and margin is weak, so a modest increase may improve economics safely.';
    expectedEffect = 'Lift margin on constrained stock without a major demand shock.';
  } else if (answers.goal === 'profit' && weakMargin && !nearExpiry && answers.protectPremiumMargins) {
    const markup = Math.max(0.015, Math.min(maxChange / 100, 0.04 * saferFactor));

    suggestedPrice = currentPrice * (1 + markup);
    confidence = 70;
    score = 60;
    actionType = 'price_up';
    reason = 'Margin is below target and there is no expiry pressure, so a small upward correction is justified.';
    expectedEffect = 'Improve contribution margin while keeping pricing stable.';
  } else if (answers.goal === 'turnover' && stock > Math.max(minStock * 2, 14) && strongMargin && !nearExpiry) {
    const finalDiscount = Math.max(
      0.015,
      Math.min(maxChange / 100, 0.04 * saferFactor)
    );

    suggestedPrice = currentPrice * (1 - finalDiscount);
    confidence = 66;
    score = 55;
    actionType = 'discount';
    reason = 'Stock is abundant and margin is strong enough to support a minor turnover-focused discount.';
    expectedEffect = 'Increase unit movement while keeping margin acceptable.';
  } else {
    suggestedPrice = currentPrice;
    confidence = 62;
    score = 35;
    actionType = 'hold';
    reason = 'Current pricing appears acceptable based on stock, expiry and margin conditions.';
    expectedEffect = 'Maintain current pricing and monitor future changes.';
  }

  if (answers.protectPremiumMargins && margin > 30 && actionType === 'discount') {
    suggestedPrice = Math.max(costPrice * 1.08, suggestedPrice);
    reason += ' Premium margin protection was applied.';
    confidence += 2;
  }

  suggestedPrice = Number(Math.max(costPrice * 1.02, suggestedPrice).toFixed(2));
  const changePercent = Number((((suggestedPrice - currentPrice) / currentPrice) * 100).toFixed(1));

  if (Math.abs(changePercent) < 0.5 && actionType !== 'hold') {
    actionType = 'hold';
    reason = 'Calculated change is too small to justify updating this product now.';
    expectedEffect = 'Keep the current price and avoid unnecessary micro-adjustments.';
    score = 25;
  }

  return {
    product_id: product.id,
    product_name: product.name,
    current_price: Number(currentPrice.toFixed(2)),
    suggested_price: suggestedPrice,
    change_percent: changePercent,
    reason,
    confidence: Math.min(99, confidence),
    expected_effect: expectedEffect,
    action_type: actionType,
    score,
    selected: actionType !== 'hold',
  };
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

function GoalCard({
  title,
  subtitle,
  active,
  onPress,
}: {
  title: string;
  subtitle: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[styles.goalCard, active && styles.goalCardActive]}
      onPress={onPress}
      activeOpacity={0.9}
    >
      <Text style={[styles.goalCardTitle, active && styles.goalCardTitleActive]}>{title}</Text>
      <Text style={[styles.goalCardSubtitle, active && styles.goalCardSubtitleActive]}>
        {subtitle}
      </Text>
    </TouchableOpacity>
  );
}

function SummaryCard({
  title,
  value,
  subtitle,
  tone = 'blue',
}: {
  title: string;
  value: string;
  subtitle: string;
  tone?: 'red' | 'yellow' | 'blue' | 'green' | 'purple';
}) {
  const bgMap = {
    red: palette.redSoft,
    yellow: palette.yellowSoft,
    blue: palette.blueSoft,
    green: palette.greenSoft,
    purple: palette.purpleSoft,
  } as const;

  return (
    <View style={[styles.summaryCard, { backgroundColor: bgMap[tone] }]}>
      <Text style={styles.summaryValue}>{value}</Text>
      <Text style={styles.summaryTitle}>{title}</Text>
      <Text style={styles.summarySubtitle}>{subtitle}</Text>
    </View>
  );
}

function ToggleRow({
  title,
  subtitle,
  value,
  onValueChange,
}: {
  title: string;
  subtitle: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
}) {
  return (
    <View style={styles.toggleRow}>
      <View style={{ flex: 1, paddingRight: 12 }}>
        <Text style={styles.toggleTitle}>{title}</Text>
        <Text style={styles.toggleSubtitle}>{subtitle}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ true: palette.primary2 }}
      />
    </View>
  );
}

export default function AIPricingLabScreen() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const [running, setRunning] = useState(false);
  const [applying, setApplying] = useState(false);
  const [currentRunId, setCurrentRunId] = useState<string | null>(null);

  const [products, setProducts] = useState<ProductRow[]>([]);
  const [suggestions, setSuggestions] = useState<PricingSuggestion[]>([]);

  const [answers, setAnswers] = useState<AnswersState>({
    goal: 'balanced',
    maxChangePercent: '10',
    aggressiveExpiryDiscounts: true,
    protectPremiumMargins: true,
    increasePriceOnLowStock: true,
    saferMode: true,
    notes: '',
  });

  const loadProducts = useCallback(async (isRefresh = false) => {
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

      const { data, error } = await supabase
        .from('food_products')
        .select(
          'id, name, category, stock_quantity, min_stock_level, selling_price, cost_price, expiry_date, supplier_name, status'
        )
        .eq('user_id', user.id)
        .eq('status', 'active');

      if (!error) {
        setProducts((data as ProductRow[]) || []);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  const generatedSuggestions = useMemo(() => {
    return products
      .map((p) => buildSuggestion(p, answers))
      .filter((item): item is PricingSuggestion => item !== null)
      .sort((a, b) => b.score - a.score);
  }, [products, answers]);

  const previewStats = useMemo(() => {
    const selected = suggestions.filter((s) => s.selected);
    const totalImpact = selected.reduce(
      (sum, s) => sum + Math.abs(s.suggested_price - s.current_price),
      0
    );
    const avgConfidence =
      selected.length > 0
        ? selected.reduce((sum, s) => sum + s.confidence, 0) / selected.length
        : 0;

    const priceUp = selected.filter((s) => s.action_type === 'price_up').length;
    const discount = selected.filter((s) => s.action_type === 'discount').length;
    const hold = suggestions.filter((s) => s.action_type === 'hold').length;

    return {
      selectedCount: selected.length,
      totalImpact,
      avgConfidence,
      priceUp,
      discount,
      hold,
    };
  }, [suggestions]);

  const savePricingRun = async (items: PricingSuggestion[]) => {
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      throw new Error('User not authenticated.');
    }

    const selectedItems = items.filter((s) => s.selected);
    const estimatedTotalImpact = selectedItems.reduce(
      (sum, s) => sum + Math.abs(s.suggested_price - s.current_price),
      0
    );

    const runPayload = {
      user_id: user.id,
      goal: answers.goal,
      max_change_percent: Number(answers.maxChangePercent || 10),
      aggressive_expiry_discounts: answers.aggressiveExpiryDiscounts,
      protect_premium_margins: answers.protectPremiumMargins,
      increase_price_on_low_stock: answers.increasePriceOnLowStock,
      safer_mode: answers.saferMode,
      notes: answers.notes?.trim() || null,
      total_products: products.length,
      generated_suggestions: items.length,
      selected_suggestions: selectedItems.length,
      estimated_total_impact: Number(estimatedTotalImpact.toFixed(2)),
      status: 'draft',
    };

    const { data: runData, error: runError } = await supabase
      .from('pricing_runs')
      .insert(runPayload)
      .select('id, status, created_at')
      .single();

    if (runError) throw runError;

    const run = runData as PricingRunRow;

    const itemPayload = items.map((item) => ({
      run_id: run.id,
      user_id: user.id,
      product_id: item.product_id,
      product_name: item.product_name,
      current_price: item.current_price,
      suggested_price: item.suggested_price,
      change_percent: item.change_percent,
      reason: item.reason,
      confidence: item.confidence,
      expected_effect: item.expected_effect,
      action_type: item.action_type,
      score: item.score,
      was_selected: item.selected,
      was_applied: false,
    }));

    const { error: itemsError } = await supabase
      .from('pricing_run_items')
      .insert(itemPayload);

    if (itemsError) throw itemsError;

    setCurrentRunId(run.id);
    return run.id;
  };

  const syncRunSelectionState = async (items: PricingSuggestion[]) => {
    if (!currentRunId) return;

    const { error: deleteError } = await supabase
      .from('pricing_run_items')
      .delete()
      .eq('run_id', currentRunId);

    if (deleteError) throw deleteError;

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) throw new Error('User not authenticated.');

    const itemPayload = items.map((item) => ({
      run_id: currentRunId,
      user_id: user.id,
      product_id: item.product_id,
      product_name: item.product_name,
      current_price: item.current_price,
      suggested_price: item.suggested_price,
      change_percent: item.change_percent,
      reason: item.reason,
      confidence: item.confidence,
      expected_effect: item.expected_effect,
      action_type: item.action_type,
      score: item.score,
      was_selected: item.selected,
      was_applied: false,
    }));

    const { error: itemsError } = await supabase
      .from('pricing_run_items')
      .insert(itemPayload);

    if (itemsError) throw itemsError;

    const selectedCount = items.filter((s) => s.selected).length;
    const totalImpact = items
      .filter((s) => s.selected)
      .reduce((sum, s) => sum + Math.abs(s.suggested_price - s.current_price), 0);

    const { error: runUpdateError } = await supabase
      .from('pricing_runs')
      .update({
        selected_suggestions: selectedCount,
        estimated_total_impact: Number(totalImpact.toFixed(2)),
      })
      .eq('id', currentRunId);

    if (runUpdateError) throw runUpdateError;
  };

  const runPricingAI = async () => {
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setRunning(true);

      const nextSuggestions = generatedSuggestions;
      setSuggestions(nextSuggestions);

      if (nextSuggestions.length > 0) {
        await savePricingRun(nextSuggestions);
      } else {
        setCurrentRunId(null);
      }
    } catch (error: any) {
      Alert.alert(
        'Pricing Run Error',
        error?.message || 'Failed to save pricing run.'
      );
    } finally {
      setRunning(false);
    }
  };

  const toggleSuggestion = (id: string) => {
    setSuggestions((prev) =>
      prev.map((s) => (s.product_id === id ? { ...s, selected: !s.selected } : s))
    );
  };

  const saveSelectionChanges = async () => {
    try {
      if (!suggestions.length || !currentRunId) return;
      await syncRunSelectionState(suggestions);
      Alert.alert('Saved', 'Selection state updated for this pricing run.');
    } catch (error: any) {
      Alert.alert(
        'Sync Error',
        error?.message || 'Failed to sync selected recommendations.'
      );
    }
  };

  const applySelectedChanges = async () => {
    const selected = suggestions.filter((s) => s.selected && s.action_type !== 'hold');

    if (!selected.length) {
      Alert.alert('Nothing selected', 'Select at least one recommendation to apply.');
      return;
    }

    try {
      setApplying(true);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      for (const item of selected) {
        const { error } = await supabase
          .from('food_products')
          .update({ selling_price: item.suggested_price })
          .eq('id', item.product_id);

        if (error) throw error;
      }

      if (currentRunId) {
        const selectedIds = selected.map((s) => s.product_id);

        const { error: itemsUpdateError } = await supabase
          .from('pricing_run_items')
          .update({ was_applied: true })
          .eq('run_id', currentRunId)
          .in('product_id', selectedIds);

        if (itemsUpdateError) throw itemsUpdateError;

        const { error: runUpdateError } = await supabase
          .from('pricing_runs')
          .update({ status: 'applied' })
          .eq('id', currentRunId);

        if (runUpdateError) throw runUpdateError;
      }

      Alert.alert(
        'Pricing applied',
        `${selected.length} product price${selected.length === 1 ? '' : 's'} updated successfully.`
      );

      await loadProducts(true);
      setSuggestions([]);
      setCurrentRunId(null);
    } catch (error: any) {
      Alert.alert('Apply failed', error?.message || 'Failed to apply price changes.');
    } finally {
      setApplying(false);
    }
  };

  const applyAllChanges = async () => {
    try {
      const next = suggestions.map((s) => ({
        ...s,
        selected: s.action_type !== 'hold',
      }));

      setSuggestions(next);
      await syncRunSelectionState(next);

      setTimeout(() => {
        applySelectedChanges();
      }, 80);
    } catch (error: any) {
      Alert.alert(
        'Apply All Error',
        error?.message || 'Failed to prepare apply-all changes.'
      );
    }
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
          <Text style={styles.loadingText}>Loading AI Pricing Lab...</Text>
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

              <View style={styles.heroRightButtons}>
                <TouchableOpacity
                  style={styles.heroButton}
                  onPress={() => setInfoOpen(true)}
                >
                  <Ionicons name="information-circle-outline" size={20} color="#fff" />
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
                <MaterialCommunityIcons name="robot-excited-outline" size={24} color="#fff" />
              </View>

              <View style={{ flex: 1 }}>
                <Text style={styles.heroEyebrow}>AI-assisted pricing</Text>
                <Text style={styles.heroTitle}>AI Pricing Lab</Text>
                <Text style={styles.heroSubtitle}>
                  Answer a few business questions, generate price proposals, review them, then apply only the changes you trust.
                </Text>
              </View>
            </View>

            <View style={styles.heroInsightBand}>
              <View style={styles.heroInsightItem}>
                <Text style={styles.heroInsightLabel}>Active products</Text>
                <Text style={styles.heroInsightValue}>{products.length}</Text>
              </View>

              <View style={styles.heroDivider} />

              <View style={styles.heroInsightItem}>
                <Text style={styles.heroInsightLabel}>Goal</Text>
                <Text style={styles.heroInsightValueSmall}>
                  {goalLabel(answers.goal)}
                </Text>
              </View>

              <View style={styles.heroDivider} />

              <View style={styles.heroInsightItem}>
                <Text style={styles.heroInsightLabel}>Max change</Text>
                <Text style={styles.heroInsightValue}>{answers.maxChangePercent}%</Text>
              </View>
            </View>
          </LinearGradient>

          <SectionHeader
            eyebrow="Step 1"
            title="Choose the pricing objective"
            subtitle="Tell the AI what kind of outcome you want first."
          />

          <View style={styles.goalGrid}>
            <GoalCard
              title="Maximize Profit"
              subtitle="Protect margin and improve price quality."
              active={answers.goal === 'profit'}
              onPress={() => setAnswers((p) => ({ ...p, goal: 'profit' }))}
            />
            <GoalCard
              title="Reduce Waste"
              subtitle="Prioritize markdowns for expiry-sensitive stock."
              active={answers.goal === 'waste'}
              onPress={() => setAnswers((p) => ({ ...p, goal: 'waste' }))}
            />
            <GoalCard
              title="Increase Turnover"
              subtitle="Move more products through better sell-through."
              active={answers.goal === 'turnover'}
              onPress={() => setAnswers((p) => ({ ...p, goal: 'turnover' }))}
            />
            <GoalCard
              title="Balanced Strategy"
              subtitle="Blend profit, waste control and stability."
              active={answers.goal === 'balanced'}
              onPress={() => setAnswers((p) => ({ ...p, goal: 'balanced' }))}
            />
          </View>

          <SectionHeader
            eyebrow="Step 2"
            title="Answer a few smart questions"
            subtitle="These answers shape how aggressive or conservative the pricing should be."
          />

          <View style={styles.formCard}>
            <View style={styles.fieldWrap}>
              <Text style={styles.fieldLabel}>Maximum allowed price change (%)</Text>
              <TextInput
                value={answers.maxChangePercent}
                onChangeText={(value) => setAnswers((p) => ({ ...p, maxChangePercent: value }))}
                keyboardType="numeric"
                placeholder="10"
                placeholderTextColor={palette.textMuted}
                style={styles.input}
              />
            </View>

            <ToggleRow
              title="Use aggressive expiry discounts"
              subtitle="Push stronger markdowns when products are close to expiry."
              value={answers.aggressiveExpiryDiscounts}
              onValueChange={(value) =>
                setAnswers((p) => ({ ...p, aggressiveExpiryDiscounts: value }))
              }
            />

            <ToggleRow
              title="Protect premium margins"
              subtitle="Avoid deep discounts on items with strong premium margin."
              value={answers.protectPremiumMargins}
              onValueChange={(value) =>
                setAnswers((p) => ({ ...p, protectPremiumMargins: value }))
              }
            />

            <ToggleRow
              title="Increase price on low stock"
              subtitle="Allow modest upward changes when stock is constrained."
              value={answers.increasePriceOnLowStock}
              onValueChange={(value) =>
                setAnswers((p) => ({ ...p, increasePriceOnLowStock: value }))
              }
            />

            <ToggleRow
              title="Safer mode"
              subtitle="Reduce the intensity of price changes and favor smaller moves."
              value={answers.saferMode}
              onValueChange={(value) =>
                setAnswers((p) => ({ ...p, saferMode: value }))
              }
            />

            <View style={styles.fieldWrap}>
              <Text style={styles.fieldLabel}>Extra notes for the AI</Text>
              <TextInput
                value={answers.notes}
                onChangeText={(value) => setAnswers((p) => ({ ...p, notes: value }))}
                placeholder="Example: Do not discount premium dairy items too much."
                placeholderTextColor={palette.textMuted}
                multiline
                style={[styles.input, styles.notesInput]}
              />
            </View>
          </View>

          <View style={styles.actionsRow}>
            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={() => {
                setSuggestions([]);
                setCurrentRunId(null);
              }}
              activeOpacity={0.9}
            >
              <Ionicons name="refresh-outline" size={18} color={palette.info} />
              <Text style={styles.secondaryButtonText}>Reset preview</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.primaryButton}
              onPress={runPricingAI}
              activeOpacity={0.9}
              disabled={running}
            >
              {running ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Ionicons name="sparkles-outline" size={18} color="#fff" />
                  <Text style={styles.primaryButtonText}>Run AI Pricing</Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          {suggestions.length > 0 ? (
            <>
              <SectionHeader
                eyebrow="Step 3"
                title="Review the proposed changes"
                subtitle="Nothing is auto-applied. Review, select, then confirm."
              />

              <View style={styles.summaryGrid}>
                <SummaryCard
                  title="Selected changes"
                  value={`${previewStats.selectedCount}`}
                  subtitle="Products ready to update"
                  tone="green"
                />
                <SummaryCard
                  title="Avg confidence"
                  value={`${Math.round(previewStats.avgConfidence)}%`}
                  subtitle="Estimated reliability"
                  tone="blue"
                />
                <SummaryCard
                  title="Discounts"
                  value={`${previewStats.discount}`}
                  subtitle="Markdown actions"
                  tone="yellow"
                />
                <SummaryCard
                  title="Price increases"
                  value={`${previewStats.priceUp}`}
                  subtitle="Margin protection moves"
                  tone="purple"
                />
              </View>

              <View style={styles.summaryWideCard}>
                <Text style={styles.summaryWideLabel}>Approximate pricing movement</Text>
                <Text style={styles.summaryWideValue}>
                  {formatCurrency(previewStats.totalImpact)}
                </Text>
                <Text style={styles.summaryWideSubtext}>
                  Hold decisions: {previewStats.hold}
                </Text>
              </View>

              <View style={styles.listWrap}>
                {suggestions.map((s) => {
                  const tone =
                    s.action_type === 'discount'
                      ? { color: palette.warning, bg: palette.yellowSoft, label: 'Discount' }
                      : s.action_type === 'price_up'
                      ? { color: palette.success, bg: palette.greenSoft, label: 'Price Up' }
                      : { color: palette.info, bg: palette.blueSoft, label: 'Hold' };

                  return (
                    <TouchableOpacity
                      key={s.product_id}
                      style={[
                        styles.suggestionCard,
                        s.selected && styles.suggestionCardSelected,
                      ]}
                      onPress={() => toggleSuggestion(s.product_id)}
                      activeOpacity={0.95}
                    >
                      <View style={styles.suggestionTopRow}>
                        <View style={{ flex: 1, paddingRight: 12 }}>
                          <Text style={styles.suggestionTitle}>{s.product_name}</Text>
                          <Text style={styles.suggestionReason}>{s.reason}</Text>
                        </View>

                        <View
                          style={[
                            styles.typePill,
                            { backgroundColor: tone.bg },
                          ]}
                        >
                          <Text style={[styles.typePillText, { color: tone.color }]}>
                            {tone.label}
                          </Text>
                        </View>
                      </View>

                      <View style={styles.priceRow}>
                        <View style={styles.priceBox}>
                          <Text style={styles.priceBoxValue}>{formatCurrency(s.current_price)}</Text>
                          <Text style={styles.priceBoxLabel}>Current</Text>
                        </View>

                        <View style={styles.arrowWrap}>
                          <Ionicons name="arrow-forward" size={18} color={palette.textMuted} />
                        </View>

                        <View style={styles.priceBox}>
                          <Text style={styles.priceBoxValue}>{formatCurrency(s.suggested_price)}</Text>
                          <Text style={styles.priceBoxLabel}>AI Price</Text>
                        </View>

                        <View style={styles.deltaBox}>
                          <Text
                            style={[
                              styles.deltaValue,
                              {
                                color:
                                  s.change_percent < 0
                                    ? palette.warning
                                    : s.change_percent > 0
                                    ? palette.success
                                    : palette.info,
                              },
                            ]}
                          >
                            {s.change_percent > 0 ? '+' : ''}
                            {s.change_percent}%
                          </Text>
                          <Text style={styles.deltaLabel}>Change</Text>
                        </View>
                      </View>

                      <View style={styles.suggestionMetaRow}>
                        <View style={styles.metaPill}>
                          <Text style={styles.metaPillText}>Confidence {s.confidence}%</Text>
                        </View>
                        <View style={styles.metaPill}>
                          <Text style={styles.metaPillText}>Score {s.score}</Text>
                        </View>
                      </View>

                      <Text style={styles.expectedEffect}>{s.expected_effect}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <View style={styles.actionsRow}>
                <TouchableOpacity
                  style={styles.secondaryButton}
                  onPress={saveSelectionChanges}
                  activeOpacity={0.9}
                >
                  <Ionicons name="cloud-done-outline" size={18} color={palette.info} />
                  <Text style={styles.secondaryButtonText}>Save selection state</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.secondaryButton}
                  onPress={applyAllChanges}
                  activeOpacity={0.9}
                  disabled={applying}
                >
                  <Ionicons name="checkmark-done-outline" size={18} color={palette.info} />
                  <Text style={styles.secondaryButtonText}>Apply all</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.primaryButton}
                  onPress={applySelectedChanges}
                  activeOpacity={0.9}
                  disabled={applying}
                >
                  {applying ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <>
                      <Ionicons name="save-outline" size={18} color="#fff" />
                      <Text style={styles.primaryButtonText}>Apply selected</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </>
          ) : null}

          <View style={{ height: 28 }} />
        </ScrollView>

        <Modal
          visible={infoOpen}
          transparent
          animationType="fade"
          onRequestClose={() => setInfoOpen(false)}
        >
          <View style={styles.modalBackdrop}>
            <View style={styles.modalCard}>
              <View style={styles.modalTopRow}>
                <Text style={styles.modalTitle}>How AI Pricing Lab works</Text>
                <TouchableOpacity onPress={() => setInfoOpen(false)}>
                  <Ionicons name="close-outline" size={22} color={palette.text} />
                </TouchableOpacity>
              </View>

              <ScrollView showsVerticalScrollIndicator={false}>
                <Text style={styles.modalText}>
                  This page does not blindly change prices. It first uses your business preferences,
                  then evaluates each active product using stock quantity, minimum stock level,
                  selling price, cost price, expiry date and margin quality.
                </Text>

                <Text style={styles.modalText}>
                  The system currently bases its logic on three main forces:
                  expiry pressure, stock pressure and margin pressure.
                  Products close to expiry tend to receive markdown proposals.
                  Products with low stock and weak margin may receive price increase proposals.
                  Stable products are usually kept unchanged.
                </Text>

                <Text style={styles.modalText}>
                  Your answers change how the engine behaves:
                  the selected goal shifts the optimization objective,
                  maximum change limits volatility,
                  safer mode reduces aggressiveness,
                  premium protection avoids over-discounting strong-margin items,
                  and low-stock pricing allows margin defense on constrained products.
                </Text>

                <Text style={styles.modalText}>
                  Confidence is estimated from recommendation type, impact size and context richness.
                  Score is a ranking layer used to prioritize what should be reviewed first.
                  Nothing is written to the database until you confirm and apply the selected changes.
                </Text>

                <Text style={styles.modalText}>
                  This page is already built to work now with local intelligence logic.
                  The next step is replacing the suggestion engine with a Groq-backed API
                  so the reasoning and explanations become even stronger and more customized.
                </Text>
              </ScrollView>
            </View>
          </View>
        </Modal>

        <AppSidebar
          visible={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          active="recommendations-center"
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
  heroRightButtons: {
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

  goalGrid: {
    gap: 12,
    marginBottom: 18,
  },
  goalCard: {
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 22,
    padding: 16,
  },
  goalCardActive: {
    backgroundColor: palette.primary2,
    borderColor: palette.primary2,
  },
  goalCardTitle: {
    color: palette.text,
    fontSize: 15,
    fontWeight: '900',
    marginBottom: 5,
  },
  goalCardTitleActive: {
    color: '#fff',
  },
  goalCardSubtitle: {
    color: palette.textMuted,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '500',
  },
  goalCardSubtitleActive: {
    color: 'rgba(255,255,255,0.86)',
  },

  formCard: {
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
  notesInput: {
    minHeight: 90,
    paddingTop: 14,
    textAlignVertical: 'top',
  },

  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: palette.border,
  },
  toggleTitle: {
    color: palette.text,
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 4,
  },
  toggleSubtitle: {
    color: palette.textMuted,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '500',
  },

  actionsRow: {
    gap: 12,
    marginBottom: 18,
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

  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 18,
  },
  summaryCard: {
    width: '48.2%',
    borderRadius: 22,
    padding: 16,
  },
  summaryValue: {
    color: palette.text,
    fontSize: 24,
    fontWeight: '900',
    marginBottom: 4,
  },
  summaryTitle: {
    color: palette.textSoft,
    fontSize: 13,
    fontWeight: '800',
  },
  summarySubtitle: {
    color: palette.textMuted,
    fontSize: 11,
    lineHeight: 16,
    marginTop: 6,
    fontWeight: '500',
  },
  summaryWideCard: {
    backgroundColor: palette.surface,
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: palette.border,
    marginBottom: 18,
  },
  summaryWideLabel: {
    color: palette.textMuted,
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 8,
  },
  summaryWideValue: {
    color: palette.text,
    fontSize: 30,
    fontWeight: '900',
    marginBottom: 6,
  },
  summaryWideSubtext: {
    color: palette.textSoft,
    fontSize: 13,
    fontWeight: '700',
  },

  listWrap: {
    gap: 12,
    marginBottom: 18,
  },
  suggestionCard: {
    backgroundColor: palette.surface,
    borderRadius: 22,
    padding: 14,
    borderWidth: 1,
    borderColor: palette.border,
  },
  suggestionCardSelected: {
    borderColor: palette.primary2,
    borderWidth: 2,
  },
  suggestionTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 10,
  },
  suggestionTitle: {
    color: palette.text,
    fontSize: 15,
    fontWeight: '900',
    marginBottom: 4,
  },
  suggestionReason: {
    color: palette.textMuted,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '500',
  },
  typePill: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
  },
  typePillText: {
    fontSize: 11,
    fontWeight: '900',
  },

  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  priceBox: {
    flex: 1,
    backgroundColor: palette.surfaceSoft,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 10,
    alignItems: 'center',
  },
  priceBoxValue: {
    color: palette.text,
    fontSize: 15,
    fontWeight: '900',
    marginBottom: 4,
  },
  priceBoxLabel: {
    color: palette.textMuted,
    fontSize: 11,
    fontWeight: '700',
  },
  arrowWrap: {
    width: 24,
    alignItems: 'center',
  },
  deltaBox: {
    minWidth: 72,
    alignItems: 'center',
  },
  deltaValue: {
    fontSize: 15,
    fontWeight: '900',
    marginBottom: 4,
  },
  deltaLabel: {
    color: palette.textMuted,
    fontSize: 11,
    fontWeight: '700',
  },

  suggestionMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 10,
  },
  metaPill: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: palette.surfaceSoft,
  },
  metaPillText: {
    color: palette.textSoft,
    fontSize: 11,
    fontWeight: '800',
  },
  expectedEffect: {
    color: palette.textSoft,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '600',
  },

  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  modalCard: {
    width: '100%',
    maxHeight: '80%',
    backgroundColor: palette.surface,
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: palette.border,
  },
  modalTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  modalTitle: {
    color: palette.text,
    fontSize: 18,
    fontWeight: '900',
    flex: 1,
    paddingRight: 10,
  },
  modalText: {
    color: palette.textSoft,
    fontSize: 13,
    lineHeight: 21,
    fontWeight: '500',
    marginBottom: 12,
  },
});