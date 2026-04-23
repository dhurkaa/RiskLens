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
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
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
      style={[styles.filterChip, active && styles.filterChipActive]}
      onPress={onPress}
      activeOpacity={0.9}
    >
      <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

export default function PricingHistoryScreen() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [runs, setRuns] = useState<PricingRunRow[]>([]);
  const [statusFilter, setStatusFilter] = useState<'all' | 'draft' | 'applied'>('all');

  const loadRuns = useCallback(async (isRefresh = false) => {
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
        .from('pricing_runs')
        .select(
          'id, goal, max_change_percent, aggressive_expiry_discounts, protect_premium_margins, increase_price_on_low_stock, safer_mode, notes, total_products, generated_suggestions, selected_suggestions, estimated_total_impact, status, created_at'
        )
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (!error) {
        setRuns((data as PricingRunRow[]) || []);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadRuns();
  }, [loadRuns]);

  const filteredRuns = useMemo(() => {
    if (statusFilter === 'all') return runs;
    return runs.filter((run) => run.status === statusFilter);
  }, [runs, statusFilter]);

  const stats = useMemo(() => {
    const totalRuns = runs.length;
    const appliedRuns = runs.filter((r) => r.status === 'applied').length;
    const draftRuns = runs.filter((r) => r.status === 'draft').length;

    const totalImpact = runs.reduce(
      (sum, r) => sum + safeNumber(r.estimated_total_impact),
      0
    );

    const totalSelections = runs.reduce(
      (sum, r) => sum + safeNumber(r.selected_suggestions),
      0
    );

    return {
      totalRuns,
      appliedRuns,
      draftRuns,
      totalImpact,
      totalSelections,
    };
  }, [runs]);

  const onRefresh = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await loadRuns(true);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={palette.primary2} />
          <Text style={styles.loadingText}>Loading pricing history...</Text>
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
              <TouchableOpacity
                style={styles.heroButton}
                onPress={() => setSidebarOpen(true)}
              >
                <Ionicons name="menu-outline" size={20} color="#fff" />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.heroButton}
                onPress={() => router.push('/(tabs)/ai-pricing-lab')}
              >
                <Ionicons name="sparkles-outline" size={20} color="#fff" />
              </TouchableOpacity>
            </View>

            <View style={styles.heroMain}>
              <View style={styles.heroIconWrap}>
                <MaterialCommunityIcons name="history" size={24} color="#fff" />
              </View>

              <View style={{ flex: 1 }}>
                <Text style={styles.heroEyebrow}>AI pricing memory</Text>
                <Text style={styles.heroTitle}>Pricing History</Text>
                <Text style={styles.heroSubtitle}>
                  Review every saved pricing run, understand what was proposed, and track what was actually applied.
                </Text>
              </View>
            </View>

            <View style={styles.heroInsightBand}>
              <View style={styles.heroInsightItem}>
                <Text style={styles.heroInsightLabel}>Runs</Text>
                <Text style={styles.heroInsightValue}>{stats.totalRuns}</Text>
              </View>

              <View style={styles.heroDivider} />

              <View style={styles.heroInsightItem}>
                <Text style={styles.heroInsightLabel}>Applied</Text>
                <Text style={styles.heroInsightValue}>{stats.appliedRuns}</Text>
              </View>

              <View style={styles.heroDivider} />

              <View style={styles.heroInsightItem}>
                <Text style={styles.heroInsightLabel}>Total impact</Text>
                <Text style={styles.heroInsightValueSmall}>
                  {formatCompactCurrency(stats.totalImpact)}
                </Text>
              </View>
            </View>
          </LinearGradient>

          <SectionHeader
            eyebrow="Overview"
            title="Pricing run summary"
            subtitle="A compact view of how often pricing optimization has been used."
          />

          <View style={styles.summaryGrid}>
            <SummaryCard
              title="Total runs"
              value={`${stats.totalRuns}`}
              subtitle="Saved pricing sessions"
              tone="green"
            />
            <SummaryCard
              title="Applied"
              value={`${stats.appliedRuns}`}
              subtitle="Runs pushed to products"
              tone="blue"
            />
            <SummaryCard
              title="Draft"
              value={`${stats.draftRuns}`}
              subtitle="Saved but not applied"
              tone="yellow"
            />
            <SummaryCard
              title="Selections"
              value={`${stats.totalSelections}`}
              subtitle="Chosen suggestions overall"
              tone="purple"
            />
          </View>

          <View style={styles.summaryWideCard}>
            <Text style={styles.summaryWideLabel}>Estimated total impact across runs</Text>
            <Text style={styles.summaryWideValue}>
              {formatCurrency(stats.totalImpact)}
            </Text>
            <Text style={styles.summaryWideSubtext}>
              Based on saved selected suggestions
            </Text>
          </View>

          <SectionHeader
            eyebrow="Filters"
            title="Refine history"
            subtitle="Focus on drafts or already-applied runs."
          />

          <View style={styles.filterWrap}>
            <FilterChip
              label="All"
              active={statusFilter === 'all'}
              onPress={() => setStatusFilter('all')}
            />
            <FilterChip
              label="Draft"
              active={statusFilter === 'draft'}
              onPress={() => setStatusFilter('draft')}
            />
            <FilterChip
              label="Applied"
              active={statusFilter === 'applied'}
              onPress={() => setStatusFilter('applied')}
            />
          </View>

          <SectionHeader
            eyebrow="Runs"
            title="Saved pricing sessions"
            subtitle={`${filteredRuns.length} run${filteredRuns.length === 1 ? '' : 's'} match the current filter.`}
          />

          <View style={styles.listWrap}>
            {filteredRuns.length > 0 ? (
              filteredRuns.map((run) => {
                const meta = statusMeta(run.status);

                return (
                  <TouchableOpacity
                    key={run.id}
                    style={styles.runCard}
                    activeOpacity={0.95}
                    onPress={() =>
  router.push({
    pathname: '/(tabs)/pricing-run-details',
    params: { id: run.id },
  })
}
                  >
                    <View style={styles.runTopRow}>
                      <View style={{ flex: 1, paddingRight: 12 }}>
                        <Text style={styles.runTitle}>{goalLabel(run.goal)}</Text>
                        <Text style={styles.runSubtitle}>
                          {formatDate(run.created_at)} • Max change {safeNumber(run.max_change_percent)}%
                        </Text>
                      </View>

                      <View style={[styles.statusPill, { backgroundColor: meta.bg }]}>
                        <Text style={[styles.statusPillText, { color: meta.color }]}>
                          {meta.label}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.metricsRow}>
                      <View style={styles.metricBox}>
                        <Text style={styles.metricValue}>{run.total_products}</Text>
                        <Text style={styles.metricLabel}>Products</Text>
                      </View>

                      <View style={styles.metricBox}>
                        <Text style={styles.metricValue}>{run.generated_suggestions}</Text>
                        <Text style={styles.metricLabel}>Generated</Text>
                      </View>

                      <View style={styles.metricBox}>
                        <Text style={styles.metricValue}>{run.selected_suggestions}</Text>
                        <Text style={styles.metricLabel}>Selected</Text>
                      </View>

                      <View style={styles.metricBox}>
                        <Text style={styles.metricValue}>
                          {formatCompactCurrency(run.estimated_total_impact)}
                        </Text>
                        <Text style={styles.metricLabel}>Impact</Text>
                      </View>
                    </View>

                    <View style={styles.preferenceRow}>
                      <View style={styles.preferencePill}>
                        <Text style={styles.preferenceText}>
                          {run.aggressive_expiry_discounts ? 'Aggressive expiry' : 'Moderate expiry'}
                        </Text>
                      </View>
                      <View style={styles.preferencePill}>
                        <Text style={styles.preferenceText}>
                          {run.safer_mode ? 'Safer mode' : 'Normal mode'}
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
                    ) : null}

                    <View style={styles.openRow}>
                      <Ionicons name="open-outline" size={14} color={palette.info} />
                      <Text style={styles.openText}>Open run details</Text>
                    </View>
                  </TouchableOpacity>
                );
              })
            ) : (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyTitle}>No pricing runs yet</Text>
                <Text style={styles.emptySubtitle}>
                  Open AI Pricing Lab and run your first price optimization session.
                </Text>

                <TouchableOpacity
                  style={styles.emptyButton}
                  onPress={() => router.push('/(tabs)/ai-pricing-lab')}
                >
                  <Ionicons name="sparkles-outline" size={18} color="#fff" />
                  <Text style={styles.emptyButtonText}>Open AI Pricing Lab</Text>
                </TouchableOpacity>
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

  filterWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 18,
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
    color: '#fff',
  },

  listWrap: {
    gap: 12,
  },
  runCard: {
    backgroundColor: palette.surface,
    borderRadius: 22,
    padding: 14,
    borderWidth: 1,
    borderColor: palette.border,
  },
  runTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 10,
  },
  runTitle: {
    color: palette.text,
    fontSize: 15,
    fontWeight: '900',
    marginBottom: 4,
  },
  runSubtitle: {
    color: palette.textMuted,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '500',
  },
  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: '900',
  },

  metricsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 10,
  },
  metricBox: {
    flex: 1,
    minWidth: '22%',
    backgroundColor: palette.surfaceSoft,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 10,
    alignItems: 'center',
  },
  metricValue: {
    color: palette.text,
    fontSize: 14,
    fontWeight: '900',
    marginBottom: 4,
  },
  metricLabel: {
    color: palette.textMuted,
    fontSize: 11,
    fontWeight: '700',
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
    marginBottom: 10,
  },

  openRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  openText: {
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
    marginBottom: 14,
  },
  emptyButton: {
    minHeight: 48,
    borderRadius: 16,
    backgroundColor: palette.primary2,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  emptyButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '900',
  },
});