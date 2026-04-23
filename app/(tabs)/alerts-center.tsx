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
  border: '#D7E1D3',
  text: '#132118',
  textSoft: '#425345',
  textMuted: '#728173',
  primary2: '#24583D',
  danger: '#D94F4F',
  warning: '#C98A1F',
  info: '#4475D9',
  success: '#2D8A57',
  redSoft: '#FFF1F1',
  yellowSoft: '#FFF8E8',
  blueSoft: '#EDF3FF',
  greenSoft: '#EDF8F0',
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

type SeverityFilter = 'all' | 'high' | 'medium' | 'low';
type SourceFilter = 'all' | 'system' | 'stock' | 'expiry' | 'pricing' | 'supplier';

function formatDateTime(value?: string | null) {
  if (!value) return '—';
  const d = new Date(value);
  return d.toLocaleDateString();
}

function severityMeta(severity?: string | null) {
  if (severity === 'high') {
    return { color: palette.danger, bg: palette.redSoft, label: 'High' };
  }
  if (severity === 'medium') {
    return { color: palette.warning, bg: palette.yellowSoft, label: 'Medium' };
  }
  return { color: palette.info, bg: palette.blueSoft, label: 'Low' };
}

function sourceMeta(source?: string | null) {
  const s = (source || 'system').toLowerCase();

  if (s.includes('stock')) {
    return { label: 'Stock', color: palette.warning, bg: palette.yellowSoft };
  }
  if (s.includes('expiry')) {
    return { label: 'Expiry', color: palette.danger, bg: palette.redSoft };
  }
  if (s.includes('pricing') || s.includes('margin')) {
    return { label: 'Pricing', color: palette.info, bg: palette.blueSoft };
  }
  if (s.includes('supplier')) {
    return { label: 'Supplier', color: palette.success, bg: palette.greenSoft };
  }

  return { label: 'System', color: palette.primary2, bg: palette.surfaceSoft };
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

function SummaryCard({
  title,
  value,
  subtitle,
  tone = 'blue',
}: {
  title: string;
  value: string;
  subtitle: string;
  tone?: 'red' | 'yellow' | 'blue' | 'green';
}) {
  const bgMap = {
    red: palette.redSoft,
    yellow: palette.yellowSoft,
    blue: palette.blueSoft,
    green: palette.greenSoft,
  } as const;

  return (
    <View style={[styles.summaryCard, { backgroundColor: bgMap[tone] }]}>
      <Text style={styles.summaryValue}>{value}</Text>
      <Text style={styles.summaryTitle}>{title}</Text>
      <Text style={styles.summarySubtitle}>{subtitle}</Text>
    </View>
  );
}

export default function AlertsCenterScreen() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [alerts, setAlerts] = useState<AlertRow[]>([]);
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>('all');
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('all');
  const [visibleCount, setVisibleCount] = useState(12);

  const loadAlerts = useCallback(async (isRefresh = false) => {
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
        .from('food_alerts')
        .select('id, title, description, severity, created_at, source_type, source_product_id')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (!error) {
        setAlerts((data as AlertRow[]) || []);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadAlerts();
  }, [loadAlerts]);

  const counts = useMemo(() => {
    return {
      all: alerts.length,
      high: alerts.filter((a) => a.severity === 'high').length,
      medium: alerts.filter((a) => a.severity === 'medium').length,
      low: alerts.filter((a) => a.severity === 'low').length,
    };
  }, [alerts]);

  const filteredAlerts = useMemo(() => {
    let result = [...alerts];

    if (severityFilter !== 'all') {
      result = result.filter((a) => a.severity === severityFilter);
    }

    if (sourceFilter !== 'all') {
      result = result.filter((a) => {
        const source = (a.source_type || 'system').toLowerCase();

        if (sourceFilter === 'system') {
          return (
            !source.includes('stock') &&
            !source.includes('expiry') &&
            !source.includes('pricing') &&
            !source.includes('margin') &&
            !source.includes('supplier')
          );
        }

        if (sourceFilter === 'pricing') {
          return source.includes('pricing') || source.includes('margin');
        }

        return source.includes(sourceFilter);
      });
    }

    return result;
  }, [alerts, severityFilter, sourceFilter]);

  const visibleAlerts = useMemo(() => {
    return filteredAlerts.slice(0, visibleCount);
  }, [filteredAlerts, visibleCount]);

  const resetVisibleCount = () => setVisibleCount(12);

  useEffect(() => {
    resetVisibleCount();
  }, [severityFilter, sourceFilter]);

  const onRefresh = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await loadAlerts(true);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={palette.primary2} />
          <Text style={styles.loadingText}>Loading alerts center...</Text>
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

              <TouchableOpacity
                style={styles.heroButton}
                onPress={() => router.push('/(tabs)/decision-center')}
              >
                <Ionicons name="flash-outline" size={20} color="#fff" />
              </TouchableOpacity>
            </View>

            <View style={styles.heroMain}>
              <View style={styles.heroIconWrap}>
                <MaterialCommunityIcons name="bell-alert-outline" size={24} color="#fff" />
              </View>

              <View style={{ flex: 1 }}>
                <Text style={styles.heroEyebrow}>Signal monitoring</Text>
                <Text style={styles.heroTitle}>Alerts Center</Text>
                <Text style={styles.heroSubtitle}>
                  A cleaner workspace for urgent issues, grouped by severity and source.
                </Text>
              </View>
            </View>
          </LinearGradient>

          <SectionHeader
            eyebrow="Overview"
            title="Severity snapshot"
            subtitle="A compact summary before you open the full feed."
          />

          <View style={styles.summaryGrid}>
            <SummaryCard
              title="High"
              value={`${counts.high}`}
              subtitle="Immediate attention"
              tone="red"
            />
            <SummaryCard
              title="Medium"
              value={`${counts.medium}`}
              subtitle="Needs review soon"
              tone="yellow"
            />
            <SummaryCard
              title="Low"
              value={`${counts.low}`}
              subtitle="Informational issues"
              tone="blue"
            />
            <SummaryCard
              title="Total"
              value={`${counts.all}`}
              subtitle="All active alerts"
              tone="green"
            />
          </View>

          <SectionHeader
            eyebrow="Filters"
            title="Refine the feed"
            subtitle="Use filters so the page does not become one endless stream."
          />

          <View style={styles.filterCard}>
            <Text style={styles.filterLabel}>Severity</Text>
            <View style={styles.filterWrap}>
              <FilterChip
                label={`All (${counts.all})`}
                active={severityFilter === 'all'}
                onPress={() => setSeverityFilter('all')}
              />
              <FilterChip
                label={`High (${counts.high})`}
                active={severityFilter === 'high'}
                onPress={() => setSeverityFilter('high')}
              />
              <FilterChip
                label={`Medium (${counts.medium})`}
                active={severityFilter === 'medium'}
                onPress={() => setSeverityFilter('medium')}
              />
              <FilterChip
                label={`Low (${counts.low})`}
                active={severityFilter === 'low'}
                onPress={() => setSeverityFilter('low')}
              />
            </View>

            <Text style={[styles.filterLabel, { marginTop: 14 }]}>Source</Text>
            <View style={styles.filterWrap}>
              <FilterChip
                label="All"
                active={sourceFilter === 'all'}
                onPress={() => setSourceFilter('all')}
              />
              <FilterChip
                label="Stock"
                active={sourceFilter === 'stock'}
                onPress={() => setSourceFilter('stock')}
              />
              <FilterChip
                label="Expiry"
                active={sourceFilter === 'expiry'}
                onPress={() => setSourceFilter('expiry')}
              />
              <FilterChip
                label="Pricing"
                active={sourceFilter === 'pricing'}
                onPress={() => setSourceFilter('pricing')}
              />
              <FilterChip
                label="Supplier"
                active={sourceFilter === 'supplier'}
                onPress={() => setSourceFilter('supplier')}
              />
              <FilterChip
                label="System"
                active={sourceFilter === 'system'}
                onPress={() => setSourceFilter('system')}
              />
            </View>
          </View>

          <SectionHeader
            eyebrow="Feed"
            title="Recent alerts"
            subtitle={`${filteredAlerts.length} alert${filteredAlerts.length === 1 ? '' : 's'} match the current filters.`}
          />

          <View style={styles.listWrap}>
            {visibleAlerts.length > 0 ? (
              visibleAlerts.map((alert) => {
                const severity = severityMeta(alert.severity);
                const source = sourceMeta(alert.source_type);

                return (
                  <View key={alert.id} style={styles.alertCard}>
                    <View style={[styles.alertIconWrap, { backgroundColor: severity.bg }]}>
                      <Ionicons name="warning-outline" size={18} color={severity.color} />
                    </View>

                    <View style={{ flex: 1 }}>
                      <View style={styles.alertTopRow}>
                        <Text style={styles.alertTitle}>{alert.title}</Text>
                      </View>

                      <Text style={styles.alertDescription}>
                        {alert.description || 'No description available.'}
                      </Text>

                      <View style={styles.pillsRow}>
                        <View style={[styles.pill, { backgroundColor: severity.bg }]}>
                          <Text style={[styles.pillText, { color: severity.color }]}>
                            {severity.label}
                          </Text>
                        </View>

                        <View style={[styles.pill, { backgroundColor: source.bg }]}>
                          <Text style={[styles.pillText, { color: source.color }]}>
                            {source.label}
                          </Text>
                        </View>

                        <View style={styles.pillNeutral}>
                          <Text style={styles.pillNeutralText}>
                            {formatDateTime(alert.created_at)}
                          </Text>
                        </View>
                      </View>

                      {alert.source_product_id ? (
                        <TouchableOpacity
                          style={styles.openProductButton}
                          onPress={() =>
                            router.push(`/product-details?id=${alert.source_product_id}`)
                          }
                        >
                          <Ionicons name="open-outline" size={14} color={palette.info} />
                          <Text style={styles.openProductText}>Open related product</Text>
                        </TouchableOpacity>
                      ) : null}
                    </View>
                  </View>
                );
              })
            ) : (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyTitle}>No alerts in this filter</Text>
                <Text style={styles.emptySubtitle}>
                  Change the filters or upload more inventory data.
                </Text>
              </View>
            )}
          </View>

          {filteredAlerts.length > visibleCount ? (
            <TouchableOpacity
              style={styles.showMoreButton}
              onPress={() => setVisibleCount((prev) => prev + 12)}
              activeOpacity={0.9}
            >
              <Ionicons name="chevron-down-outline" size={18} color={palette.primary2} />
              <Text style={styles.showMoreText}>
                Show more alerts ({filteredAlerts.length - visibleCount} left)
              </Text>
            </TouchableOpacity>
          ) : null}

          <View style={{ height: 28 }} />
        </ScrollView>

        <AppSidebar
          visible={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          active="alerts-center"
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

  filterCard: {
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
  filterWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
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
  alertCard: {
    backgroundColor: palette.surface,
    borderRadius: 22,
    padding: 14,
    borderWidth: 1,
    borderColor: palette.border,
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
  alertTopRow: {
    marginBottom: 6,
  },
  alertTitle: {
    color: palette.text,
    fontSize: 14,
    fontWeight: '900',
  },
  alertDescription: {
    color: palette.textMuted,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '500',
  },
  pillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
  },
  pill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  pillText: {
    fontSize: 11,
    fontWeight: '900',
  },
  pillNeutral: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: palette.surfaceSoft,
  },
  pillNeutralText: {
    color: palette.textSoft,
    fontSize: 11,
    fontWeight: '800',
  },
  openProductButton: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  openProductText: {
    color: palette.info,
    fontSize: 12,
    fontWeight: '800',
  },

  showMoreButton: {
    minHeight: 48,
    borderRadius: 16,
    marginTop: 14,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.border,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  showMoreText: {
    color: palette.primary2,
    fontSize: 13,
    fontWeight: '900',
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