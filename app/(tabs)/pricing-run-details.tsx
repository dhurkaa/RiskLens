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
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
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

type PricingRunRow = {
  id: string;
  goal: 'profit' | 'waste' | 'turnover' | 'balanced';
  max_change_percent: number;
  aggressive_expiry_discounts: boolean;
  protect_premium_margins: boolean;
  increase_price_on_low_stock: boolean;
  safer_mode: boolean;
  notes?: string | null;
  total_products: number;
  generated_suggestions: number;
  selected_suggestions: number;
  estimated_total_impact: number;
  status: 'draft' | 'applied' | 'cancelled';
  created_at?: string | null;
};

type PricingRunItemRow = {
  id: string;
  product_id?: string | null;
  product_name: string;
  current_price: number;
  suggested_price: number;
  change_percent: number;
  reason: string;
  confidence: number;
  expected_effect: string;
  action_type: 'discount' | 'price_up' | 'hold';
  score: number;
  was_selected: boolean;
  was_applied: boolean;
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

function formatDate(value?: string | null) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString();
}

function goalLabel(goal: PricingRunRow['goal']) {
  if (goal === 'profit') return 'Maximize Profit';
  if (goal === 'waste') return 'Reduce Waste';
  if (goal === 'turnover') return 'Increase Turnover';
  return 'Balanced Strategy';
}

function statusMeta(status: PricingRunRow['status']) {
  if (status === 'applied') {
    return { label: 'Applied', color: palette.success, bg: palette.greenSoft };
  }
  if (status === 'cancelled') {
    return { label: 'Cancelled', color: palette.danger, bg: palette.redSoft };
  }
  return { label: 'Draft', color: palette.warning, bg: palette.yellowSoft };
}

function actionMeta(type: PricingRunItemRow['action_type']) {
  if (type === 'discount') {
    return { label: 'Discount', color: palette.warning, bg: palette.yellowSoft };
  }
  if (type === 'price_up') {
    return { label: 'Price Up', color: palette.success, bg: palette.greenSoft };
  }
  return { label: 'Hold', color: palette.info, bg: palette.blueSoft };
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

export default function PricingRunDetailsScreen() {
  const params = useLocalSearchParams<{ id?: string }>();
  const runId = typeof params.id === 'string' ? params.id : '';

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [run, setRun] = useState<PricingRunRow | null>(null);
  const [items, setItems] = useState<PricingRunItemRow[]>([]);

  const loadRunDetails = useCallback(async (isRefresh = false) => {
    try {
      if (!runId) {
        Alert.alert('Missing run ID', 'No pricing run ID was provided.');
        router.back();
        return;
      }

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

      const [runRes, itemsRes] = await Promise.all([
        supabase
          .from('pricing_runs')
          .select(
            'id, goal, max_change_percent, aggressive_expiry_discounts, protect_premium_margins, increase_price_on_low_stock, safer_mode, notes, total_products, generated_suggestions, selected_suggestions, estimated_total_impact, status, created_at'
          )
          .eq('user_id', user.id)
          .eq('id', runId)
          .maybeSingle(),

        supabase
          .from('pricing_run_items')
          .select(
            'id, product_id, product_name, current_price, suggested_price, change_percent, reason, confidence, expected_effect, action_type, score, was_selected, was_applied, created_at'
          )
          .eq('user_id', user.id)
          .eq('run_id', runId)
          .order('score', { ascending: false }),
      ]);

      if (runRes.error) throw runRes.error;
      if (itemsRes.error) throw itemsRes.error;

      if (!runRes.data) {
        Alert.alert('Not found', 'This pricing run does not exist anymore.');
        router.back();
        return;
      }

      setRun(runRes.data as PricingRunRow);
      setItems((itemsRes.data as PricingRunItemRow[]) || []);
    } catch (error: any) {
      Alert.alert('Run Details Error', error?.message || 'Failed to load run details.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [runId]);

  useEffect(() => {
    loadRunDetails();
  }, [loadRunDetails]);

  const stats = useMemo(() => {
    const selected = items.filter((i) => i.was_selected);
    const applied = items.filter((i) => i.was_applied);
    const discounts = items.filter((i) => i.action_type === 'discount').length;
    const priceUps = items.filter((i) => i.action_type === 'price_up').length;
    const holds = items.filter((i) => i.action_type === 'hold').length;

    const avgConfidence =
      items.length > 0
        ? items.reduce((sum, i) => sum + safeNumber(i.confidence), 0) / items.length
        : 0;

    const totalPriceMovement = selected.reduce(
      (sum, i) => sum + Math.abs(safeNumber(i.suggested_price) - safeNumber(i.current_price)),
      0
    );

    return {
      selectedCount: selected.length,
      appliedCount: applied.length,
      discounts,
      priceUps,
      holds,
      avgConfidence,
      totalPriceMovement,
    };
  }, [items]);

  const onRefresh = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await loadRunDetails(true);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={palette.primary2} />
          <Text style={styles.loadingText}>Loading pricing run details...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!run) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingWrap}>
          <Text style={styles.loadingText}>Pricing run not found.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const runStatus = statusMeta(run.status);

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

              <View style={styles.heroTopActions}>
                <TouchableOpacity
                  style={styles.heroButton}
                  onPress={() => router.back()}
                >
                  <Ionicons name="arrow-back-outline" size={20} color="#fff" />
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.heroButton}
                  onPress={() => router.push('/(tabs)/pricing-history')}
                >
                  <Ionicons name="time-outline" size={20} color="#fff" />
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.heroMain}>
              <View style={styles.heroIconWrap}>
                <MaterialCommunityIcons name="file-document-outline" size={24} color="#fff" />
              </View>

              <View style={{ flex: 1 }}>
                <Text style={styles.heroEyebrow}>Saved pricing run</Text>
                <Text style={styles.heroTitle}>{goalLabel(run.goal)}</Text>
                <Text style={styles.heroSubtitle}>
                  Created on {formatDate(run.created_at)} • Max change {safeNumber(run.max_change_percent)}%
                </Text>
              </View>
            </View>

            <View style={styles.heroInsightBand}>
              <View style={styles.heroInsightItem}>
                <Text style={styles.heroInsightLabel}>Status</Text>
                <View style={[styles.heroStatusPill, { backgroundColor: runStatus.bg }]}>
                  <Text style={[styles.heroStatusText, { color: runStatus.color }]}>
                    {runStatus.label}
                  </Text>
                </View>
              </View>

              <View style={styles.heroDivider} />

              <View style={styles.heroInsightItem}>
                <Text style={styles.heroInsightLabel}>Impact</Text>
                <Text style={styles.heroInsightValue}>
                  {formatCompactCurrency(run.estimated_total_impact)}
                </Text>
              </View>

              <View style={styles.heroDivider} />

              <View style={styles.heroInsightItem}>
                <Text style={styles.heroInsightLabel}>Selections</Text>
                <Text style={styles.heroInsightValue}>{run.selected_suggestions}</Text>
              </View>
            </View>
          </LinearGradient>

          <SectionHeader
            eyebrow="Overview"
            title="Run summary"
            subtitle="A compact explanation of what this optimization session produced."
          />

          <View style={styles.summaryGrid}>
            <SummaryCard
              title="Products"
              value={`${run.total_products}`}
              subtitle="Analyzed products"
              tone="green"
            />
            <SummaryCard
              title="Generated"
              value={`${run.generated_suggestions}`}
              subtitle="Suggested actions"
              tone="blue"
            />
            <SummaryCard
              title="Selected"
              value={`${stats.selectedCount}`}
              subtitle="Chosen by the user"
              tone="purple"
            />
            <SummaryCard
              title="Applied"
              value={`${stats.appliedCount}`}
              subtitle="Pushed to prices"
              tone="yellow"
            />
          </View>

          <View style={styles.summaryWideCard}>
            <Text style={styles.summaryWideLabel}>Estimated total impact</Text>
            <Text style={styles.summaryWideValue}>
              {formatCurrency(run.estimated_total_impact)}
            </Text>
            <Text style={styles.summaryWideSubtext}>
              Average confidence {Math.round(stats.avgConfidence)}%
            </Text>
          </View>

          <SectionHeader
            eyebrow="Configuration"
            title="Strategy settings used"
            subtitle="The logic choices that shaped this pricing run."
          />

          <View style={styles.configCard}>
            <View style={styles.preferenceRow}>
              <View style={styles.preferencePill}>
                <Text style={styles.preferenceText}>{goalLabel(run.goal)}</Text>
              </View>
              <View style={styles.preferencePill}>
                <Text style={styles.preferenceText}>Max {safeNumber(run.max_change_percent)}%</Text>
              </View>
              <View style={styles.preferencePill}>
                <Text style={styles.preferenceText}>
                  {run.safer_mode ? 'Safer mode' : 'Normal mode'}
                </Text>
              </View>
              <View style={styles.preferencePill}>
                <Text style={styles.preferenceText}>
                  {run.aggressive_expiry_discounts ? 'Aggressive expiry' : 'Moderate expiry'}
                </Text>
              </View>
              <View style={styles.preferencePill}>
                <Text style={styles.preferenceText}>
                  {run.protect_premium_margins ? 'Premium protection' : 'No premium protection'}
                </Text>
              </View>
              <View style={styles.preferencePill}>
                <Text style={styles.preferenceText}>
                  {run.increase_price_on_low_stock ? 'Low-stock pricing' : 'No low-stock pricing'}
                </Text>
              </View>
            </View>

            {run.notes ? (
              <Text style={styles.notesText}>Notes: {run.notes}</Text>
            ) : (
              <Text style={styles.notesEmpty}>No extra notes were saved for this run.</Text>
            )}
          </View>

          <SectionHeader
            eyebrow="Breakdown"
            title="Recommendation mix"
            subtitle="How this run distributed pricing actions."
          />

          <View style={styles.summaryGrid}>
            <SummaryCard
              title="Discount"
              value={`${stats.discounts}`}
              subtitle="Markdown decisions"
              tone="yellow"
            />
            <SummaryCard
              title="Price Up"
              value={`${stats.priceUps}`}
              subtitle="Margin protection moves"
              tone="green"
            />
            <SummaryCard
              title="Hold"
              value={`${stats.holds}`}
              subtitle="No change decisions"
              tone="blue"
            />
            <SummaryCard
              title="Movement"
              value={formatCompactCurrency(stats.totalPriceMovement)}
              subtitle="Selected price movement"
              tone="purple"
            />
          </View>

          <SectionHeader
            eyebrow="Details"
            title="Run items"
            subtitle={`${items.length} item${items.length === 1 ? '' : 's'} saved in this optimization session.`}
          />

          <View style={styles.listWrap}>
            {items.length > 0 ? (
              items.map((item) => {
                const meta = actionMeta(item.action_type);

                return (
                  <View key={item.id} style={styles.itemCard}>
                    <View style={styles.itemTopRow}>
                      <View style={{ flex: 1, paddingRight: 12 }}>
                        <Text style={styles.itemTitle}>{item.product_name}</Text>
                        <Text style={styles.itemReason}>{item.reason}</Text>
                      </View>

                      <View style={[styles.actionPill, { backgroundColor: meta.bg }]}>
                        <Text style={[styles.actionPillText, { color: meta.color }]}>
                          {meta.label}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.priceRow}>
                      <View style={styles.priceBox}>
                        <Text style={styles.priceBoxValue}>{formatCurrency(item.current_price)}</Text>
                        <Text style={styles.priceBoxLabel}>Current</Text>
                      </View>

                      <View style={styles.arrowWrap}>
                        <Ionicons name="arrow-forward" size={18} color={palette.textMuted} />
                      </View>

                      <View style={styles.priceBox}>
                        <Text style={styles.priceBoxValue}>{formatCurrency(item.suggested_price)}</Text>
                        <Text style={styles.priceBoxLabel}>Suggested</Text>
                      </View>

                      <View style={styles.deltaBox}>
                        <Text
                          style={[
                            styles.deltaValue,
                            {
                              color:
                                item.change_percent < 0
                                  ? palette.warning
                                  : item.change_percent > 0
                                  ? palette.success
                                  : palette.info,
                            },
                          ]}
                        >
                          {item.change_percent > 0 ? '+' : ''}
                          {item.change_percent}%
                        </Text>
                        <Text style={styles.deltaLabel}>Change</Text>
                      </View>
                    </View>

                    <View style={styles.metaRow}>
                      <View style={styles.metaPill}>
                        <Text style={styles.metaPillText}>Confidence {item.confidence}%</Text>
                      </View>
                      <View style={styles.metaPill}>
                        <Text style={styles.metaPillText}>Score {item.score}</Text>
                      </View>
                      <View
                        style={[
                          styles.metaPill,
                          { backgroundColor: item.was_selected ? palette.greenSoft : palette.surfaceSoft },
                        ]}
                      >
                        <Text
                          style={[
                            styles.metaPillText,
                            { color: item.was_selected ? palette.success : palette.textSoft },
                          ]}
                        >
                          {item.was_selected ? 'Selected' : 'Not selected'}
                        </Text>
                      </View>
                      <View
                        style={[
                          styles.metaPill,
                          { backgroundColor: item.was_applied ? palette.greenSoft : palette.surfaceSoft },
                        ]}
                      >
                        <Text
                          style={[
                            styles.metaPillText,
                            { color: item.was_applied ? palette.success : palette.textSoft },
                          ]}
                        >
                          {item.was_applied ? 'Applied' : 'Not applied'}
                        </Text>
                      </View>
                    </View>

                    <Text style={styles.expectedEffect}>{item.expected_effect}</Text>

                    {item.product_id ? (
                      <TouchableOpacity
                        style={styles.openProductButton}
                        onPress={() =>
                          router.push({
                            pathname: '/product-details',
                            params: { id: item.product_id },
                          })
                        }
                      >
                        <Ionicons name="open-outline" size={14} color={palette.info} />
                        <Text style={styles.openProductText}>Open product</Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>
                );
              })
            ) : (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyTitle}>No run items found</Text>
                <Text style={styles.emptySubtitle}>
                  This pricing run does not contain saved suggestion items.
                </Text>
              </View>
            )}
          </View>

          <View style={{ height: 28 }} />
        </ScrollView>

        <AppSidebar
          visible={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          active="pricing-history"
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
  heroTopActions: {
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
  heroDivider: {
    width: 1,
    height: 32,
    backgroundColor: 'rgba(255,255,255,0.12)',
    marginHorizontal: 8,
  },
  heroStatusPill: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  heroStatusText: {
    fontSize: 11,
    fontWeight: '900',
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

  configCard: {
    backgroundColor: palette.surface,
    borderRadius: 24,
    padding: 16,
    borderWidth: 1,
    borderColor: palette.border,
    marginBottom: 18,
  },
  preferenceRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 10,
  },
  preferencePill: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: palette.surfaceSoft,
  },
  preferenceText: {
    color: palette.textSoft,
    fontSize: 11,
    fontWeight: '800',
  },
  notesText: {
    color: palette.textSoft,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '600',
  },
  notesEmpty: {
    color: palette.textMuted,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '500',
  },

  listWrap: {
    gap: 12,
  },
  itemCard: {
    backgroundColor: palette.surface,
    borderRadius: 22,
    padding: 14,
    borderWidth: 1,
    borderColor: palette.border,
  },
  itemTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 10,
  },
  itemTitle: {
    color: palette.text,
    fontSize: 15,
    fontWeight: '900',
    marginBottom: 4,
  },
  itemReason: {
    color: palette.textMuted,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '500',
  },
  actionPill: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
  },
  actionPillText: {
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

  metaRow: {
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
    marginBottom: 10,
  },
  openProductButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  openProductText: {
    color: palette.info,
    fontSize: 12,
    fontWeight: '800',
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