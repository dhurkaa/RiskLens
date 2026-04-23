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
  cyan: '#06B6D4',

  redSoft: '#FFF1F1',
  yellowSoft: '#FFF8E8',
  greenSoft: '#EDF8F0',
  blueSoft: '#EDF3FF',
  purpleSoft: '#F3EEFF',
  cyanSoft: '#E9FCFF',
};

type RecommendationType = 'discount' | 'restock' | 'price_up' | 'price_down';

type RecommendationRow = {
  id: string;
  product_name: string;
  recommendation_type: RecommendationType;
  message: string;
  impact_value?: number | null;
  created_at?: string | null;
  product_id?: string | null;
};

type FilterType = 'all' | RecommendationType;
type BucketType = 'all' | 'urgent' | 'high_value' | 'quick_win';

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

function recommendationMeta(type: RecommendationType) {
  if (type === 'discount') {
    return {
      label: 'Discount',
      color: palette.warning,
      bg: palette.yellowSoft,
      icon: 'pricetag-outline' as const,
    };
  }
  if (type === 'restock') {
    return {
      label: 'Restock',
      color: palette.info,
      bg: palette.blueSoft,
      icon: 'cube-outline' as const,
    };
  }
  if (type === 'price_up') {
    return {
      label: 'Price Up',
      color: palette.success,
      bg: palette.greenSoft,
      icon: 'trending-up-outline' as const,
    };
  }
  return {
    label: 'Price Down',
    color: palette.purple,
    bg: palette.purpleSoft,
    icon: 'trending-down-outline' as const,
  };
}

function calculateConfidence(rec: RecommendationRow): number {
  const impact = safeNumber(rec.impact_value);
  let base = 50;

  if (rec.recommendation_type === 'discount') base += 18;
  if (rec.recommendation_type === 'restock') base += 20;
  if (rec.recommendation_type === 'price_up') base += 12;
  if (rec.recommendation_type === 'price_down') base += 10;

  if (impact >= 1000) base += 20;
  else if (impact >= 300) base += 12;
  else if (impact >= 100) base += 8;
  else if (impact > 0) base += 4;

  if (rec.message?.length > 40) base += 5;

  return Math.min(99, base);
}

function calculatePriorityScore(rec: RecommendationRow): number {
  const impact = safeNumber(rec.impact_value);
  const confidence = calculateConfidence(rec);

  let typeWeight = 1;
  if (rec.recommendation_type === 'restock') typeWeight = 1.15;
  if (rec.recommendation_type === 'discount') typeWeight = 1.1;
  if (rec.recommendation_type === 'price_up') typeWeight = 1.0;
  if (rec.recommendation_type === 'price_down') typeWeight = 0.95;

  const impactScore =
    impact >= 1000 ? 100 :
    impact >= 500 ? 80 :
    impact >= 250 ? 60 :
    impact >= 100 ? 45 :
    impact >= 50 ? 30 : 15;

  return Math.round((impactScore * 0.65 + confidence * 0.35) * typeWeight);
}

function recommendationBucket(rec: RecommendationRow): BucketType {
  const impact = safeNumber(rec.impact_value);
  const priority = calculatePriorityScore(rec);

  if (priority >= 90) return 'urgent';
  if (impact >= 300) return 'high_value';
  return 'quick_win';
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

export default function RecommendationsCenterScreen() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [recommendations, setRecommendations] = useState<RecommendationRow[]>([]);
  const [typeFilter, setTypeFilter] = useState<FilterType>('all');
  const [bucketFilter, setBucketFilter] = useState<BucketType>('all');
  const [visibleCount, setVisibleCount] = useState(10);

  const loadRecommendations = useCallback(async (isRefresh = false) => {
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
        .from('food_recommendations')
        .select('id, product_name, recommendation_type, message, impact_value, created_at, product_id')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (!error) {
        setRecommendations((data as RecommendationRow[]) || []);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadRecommendations();
  }, [loadRecommendations]);

  const counts = useMemo(() => {
    return {
      all: recommendations.length,
      discount: recommendations.filter((r) => r.recommendation_type === 'discount').length,
      restock: recommendations.filter((r) => r.recommendation_type === 'restock').length,
      price_up: recommendations.filter((r) => r.recommendation_type === 'price_up').length,
      price_down: recommendations.filter((r) => r.recommendation_type === 'price_down').length,
    };
  }, [recommendations]);

  const bucketCounts = useMemo(() => {
    return {
      urgent: recommendations.filter((r) => recommendationBucket(r) === 'urgent').length,
      high_value: recommendations.filter((r) => recommendationBucket(r) === 'high_value').length,
      quick_win: recommendations.filter((r) => recommendationBucket(r) === 'quick_win').length,
    };
  }, [recommendations]);

  const overview = useMemo(() => {
    const totalImpact = recommendations.reduce((sum, r) => sum + safeNumber(r.impact_value), 0);
    const avgConfidence =
      recommendations.length > 0
        ? recommendations.reduce((sum, r) => sum + calculateConfidence(r), 0) / recommendations.length
        : 0;

    const topImpact = [...recommendations]
      .sort((a, b) => safeNumber(b.impact_value) - safeNumber(a.impact_value))[0];

    return {
      totalImpact,
      avgConfidence,
      topImpact: topImpact ? safeNumber(topImpact.impact_value) : 0,
      topImpactProduct: topImpact?.product_name || '—',
    };
  }, [recommendations]);

  const filteredRecommendations = useMemo(() => {
    let result = [...recommendations];

    if (typeFilter !== 'all') {
      result = result.filter((r) => r.recommendation_type === typeFilter);
    }

    if (bucketFilter !== 'all') {
      result = result.filter((r) => recommendationBucket(r) === bucketFilter);
    }

    result.sort((a, b) => calculatePriorityScore(b) - calculatePriorityScore(a));
    return result;
  }, [recommendations, typeFilter, bucketFilter]);

  const visibleRecommendations = useMemo(() => {
    return filteredRecommendations.slice(0, visibleCount);
  }, [filteredRecommendations, visibleCount]);

  useEffect(() => {
    setVisibleCount(10);
  }, [typeFilter, bucketFilter]);

  const groupedHighlights = useMemo(() => {
    return {
      discount: recommendations
        .filter((r) => r.recommendation_type === 'discount')
        .reduce((sum, r) => sum + safeNumber(r.impact_value), 0),
      restock: recommendations
        .filter((r) => r.recommendation_type === 'restock')
        .reduce((sum, r) => sum + safeNumber(r.impact_value), 0),
      price_up: recommendations
        .filter((r) => r.recommendation_type === 'price_up')
        .reduce((sum, r) => sum + safeNumber(r.impact_value), 0),
      price_down: recommendations
        .filter((r) => r.recommendation_type === 'price_down')
        .reduce((sum, r) => sum + safeNumber(r.impact_value), 0),
    };
  }, [recommendations]);

  const onRefresh = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await loadRecommendations(true);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={palette.primary2} />
          <Text style={styles.loadingText}>Loading recommendations center...</Text>
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
                <MaterialCommunityIcons name="lightbulb-on-outline" size={24} color="#fff" />
              </View>

              <View style={{ flex: 1 }}>
                <Text style={styles.heroEyebrow}>Decision engine</Text>
                <Text style={styles.heroTitle}>Recommendations Center</Text>
                <Text style={styles.heroSubtitle}>
                  Prioritized actions with confidence, impact scoring, and decision buckets — not just a list of suggestions.
                </Text>
              </View>
            </View>

            <View style={styles.heroInsightBand}>
              <View style={styles.heroInsightItem}>
                <Text style={styles.heroInsightLabel}>Total impact</Text>
                <Text style={styles.heroInsightValue}>
                  {formatCompactCurrency(overview.totalImpact)}
                </Text>
              </View>

              <View style={styles.heroDivider} />

              <View style={styles.heroInsightItem}>
                <Text style={styles.heroInsightLabel}>Avg confidence</Text>
                <Text style={styles.heroInsightValue}>
                  {Math.round(overview.avgConfidence)}%
                </Text>
              </View>

              <View style={styles.heroDivider} />

              <View style={styles.heroInsightItem}>
                <Text style={styles.heroInsightLabel}>Top opportunity</Text>
                <Text style={styles.heroInsightValue}>
                  {formatCompactCurrency(overview.topImpact)}
                </Text>
              </View>
            </View>
          </LinearGradient>

          <SectionHeader
            eyebrow="Overview"
            title="Recommendation summary"
            subtitle="What the recommendation engine is producing right now."
          />

          <View style={styles.summaryGrid}>
            <SummaryCard
              title="All recommendations"
              value={`${counts.all}`}
              subtitle="Total actions generated"
              tone="green"
            />
            <SummaryCard
              title="Urgent"
              value={`${bucketCounts.urgent}`}
              subtitle="Highest-priority actions"
              tone="red"
            />
            <SummaryCard
              title="High value"
              value={`${bucketCounts.high_value}`}
              subtitle="Best estimated payoff"
              tone="purple"
            />
            <SummaryCard
              title="Quick wins"
              value={`${bucketCounts.quick_win}`}
              subtitle="Fast improvements"
              tone="blue"
            />
          </View>

          <SectionHeader
            eyebrow="Mix"
            title="Recommendation distribution"
            subtitle="How the system is balancing discounting, restocking and pricing."
          />

          <View style={styles.mixGrid}>
            <SummaryCard
              title="Discount"
              value={formatCompactCurrency(groupedHighlights.discount)}
              subtitle={`${counts.discount} actions`}
              tone="yellow"
            />
            <SummaryCard
              title="Restock"
              value={formatCompactCurrency(groupedHighlights.restock)}
              subtitle={`${counts.restock} actions`}
              tone="blue"
            />
            <SummaryCard
              title="Price Up"
              value={formatCompactCurrency(groupedHighlights.price_up)}
              subtitle={`${counts.price_up} actions`}
              tone="green"
            />
            <SummaryCard
              title="Price Down"
              value={formatCompactCurrency(groupedHighlights.price_down)}
              subtitle={`${counts.price_down} actions`}
              tone="purple"
            />
          </View>

          <SectionHeader
            eyebrow="Filters"
            title="Refine the queue"
            subtitle="Switch by recommendation type and decision bucket."
          />

          <View style={styles.filterCard}>
            <Text style={styles.filterLabel}>Type</Text>
            <View style={styles.filterWrap}>
              <FilterChip
                label={`All (${counts.all})`}
                active={typeFilter === 'all'}
                onPress={() => setTypeFilter('all')}
              />
              <FilterChip
                label={`Discount (${counts.discount})`}
                active={typeFilter === 'discount'}
                onPress={() => setTypeFilter('discount')}
              />
              <FilterChip
                label={`Restock (${counts.restock})`}
                active={typeFilter === 'restock'}
                onPress={() => setTypeFilter('restock')}
              />
              <FilterChip
                label={`Price Up (${counts.price_up})`}
                active={typeFilter === 'price_up'}
                onPress={() => setTypeFilter('price_up')}
              />
              <FilterChip
                label={`Price Down (${counts.price_down})`}
                active={typeFilter === 'price_down'}
                onPress={() => setTypeFilter('price_down')}
              />
            </View>

            <Text style={[styles.filterLabel, { marginTop: 14 }]}>Decision bucket</Text>
            <View style={styles.filterWrap}>
              <FilterChip
                label="All"
                active={bucketFilter === 'all'}
                onPress={() => setBucketFilter('all')}
              />
              <FilterChip
                label={`Urgent (${bucketCounts.urgent})`}
                active={bucketFilter === 'urgent'}
                onPress={() => setBucketFilter('urgent')}
              />
              <FilterChip
                label={`High Value (${bucketCounts.high_value})`}
                active={bucketFilter === 'high_value'}
                onPress={() => setBucketFilter('high_value')}
              />
              <FilterChip
                label={`Quick Win (${bucketCounts.quick_win})`}
                active={bucketFilter === 'quick_win'}
                onPress={() => setBucketFilter('quick_win')}
              />
            </View>
          </View>

          <SectionHeader
            eyebrow="Queue"
            title="Ranked recommendation feed"
            subtitle={`${filteredRecommendations.length} recommendation${filteredRecommendations.length === 1 ? '' : 's'} match the current filters.`}
          />

          <View style={styles.listWrap}>
            {visibleRecommendations.length > 0 ? (
              visibleRecommendations.map((rec, index) => {
                const meta = recommendationMeta(rec.recommendation_type);
                const confidence = calculateConfidence(rec);
                const priority = calculatePriorityScore(rec);
                const bucket = recommendationBucket(rec);

                return (
                  <View key={rec.id} style={styles.recommendationCard}>
                    <View style={styles.cardLeftCol}>
                      <View style={[styles.rankBadge, { backgroundColor: meta.bg }]}>
                        <Text style={[styles.rankBadgeText, { color: meta.color }]}>
                          {index + 1}
                        </Text>
                      </View>
                    </View>

                    <View style={{ flex: 1 }}>
                      <View style={styles.cardTopRow}>
                        <Text style={styles.cardTitle}>{rec.product_name}</Text>
                        <Text style={styles.impactValue}>
                          {formatCompactCurrency(rec.impact_value)}
                        </Text>
                      </View>

                      <Text style={styles.cardMessage}>{rec.message}</Text>

                      <View style={styles.pillsRow}>
                        <View style={[styles.pill, { backgroundColor: meta.bg }]}>
                          <Ionicons name={meta.icon} size={12} color={meta.color} />
                          <Text style={[styles.pillText, { color: meta.color }]}>{meta.label}</Text>
                        </View>

                        <View style={styles.pillNeutral}>
                          <Text style={styles.pillNeutralText}>Priority {priority}</Text>
                        </View>

                        <View style={styles.pillNeutral}>
                          <Text style={styles.pillNeutralText}>Confidence {confidence}%</Text>
                        </View>

                        <View style={styles.pillNeutral}>
                          <Text style={styles.pillNeutralText}>
                            {bucket === 'urgent'
                              ? 'Urgent'
                              : bucket === 'high_value'
                              ? 'High Value'
                              : 'Quick Win'}
                          </Text>
                        </View>
                      </View>

                      <View style={styles.cardBottomRow}>
                        <Text style={styles.cardMetaText}>{formatDate(rec.created_at)}</Text>

                        {rec.product_id ? (
                          <TouchableOpacity
                            style={styles.openProductButton}
                            onPress={() => router.push(`/product-details?id=${rec.product_id}`)}
                          >
                            <Ionicons name="open-outline" size={14} color={palette.info} />
                            <Text style={styles.openProductText}>Open product</Text>
                          </TouchableOpacity>
                        ) : null}
                      </View>
                    </View>
                  </View>
                );
              })
            ) : (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyTitle}>No recommendations in this filter</Text>
                <Text style={styles.emptySubtitle}>
                  Change the filters or upload more product data.
                </Text>
              </View>
            )}
          </View>

          {filteredRecommendations.length > visibleCount ? (
            <TouchableOpacity
              style={styles.showMoreButton}
              onPress={() => setVisibleCount((prev) => prev + 10)}
              activeOpacity={0.9}
            >
              <Ionicons name="chevron-down-outline" size={18} color={palette.primary2} />
              <Text style={styles.showMoreText}>
                Show more recommendations ({filteredRecommendations.length - visibleCount} left)
              </Text>
            </TouchableOpacity>
          ) : null}

          <SectionHeader
            eyebrow="Interpretation"
            title="Decision reading"
            subtitle="A quick explanation of what this recommendation set means."
          />

          <View style={styles.narrativeCard}>
            <Text style={styles.narrativeText}>
              {counts.restock > 0
                ? `Restock actions are active across ${counts.restock} products, which suggests sales risk from insufficient stock. `
                : 'Restock pressure is currently limited. '}
              {counts.discount > 0
                ? `Discount recommendations appear on ${counts.discount} items, indicating expiry or slow-moving inventory pressure. `
                : 'Discount pressure is currently low. '}
              {counts.price_up > 0
                ? `${counts.price_up} products may be underpriced and offer margin improvement opportunities. `
                : 'Pricing-up opportunities are limited at the moment. '}
              The current recommendation engine estimates a total recoverable opportunity of {formatCurrency(overview.totalImpact)}, with average confidence at {Math.round(overview.avgConfidence)}%.
            </Text>
          </View>

          <View style={{ height: 28 }} />
        </ScrollView>

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
  mixGrid: {
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
  recommendationCard: {
    backgroundColor: palette.surface,
    borderRadius: 22,
    padding: 14,
    borderWidth: 1,
    borderColor: palette.border,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  cardLeftCol: {
    marginRight: 12,
  },
  rankBadge: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankBadgeText: {
    fontSize: 14,
    fontWeight: '900',
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 6,
    alignItems: 'center',
  },
  cardTitle: {
    color: palette.text,
    fontSize: 14,
    fontWeight: '900',
    flex: 1,
  },
  impactValue: {
    color: palette.primary2,
    fontSize: 13,
    fontWeight: '900',
  },
  cardMessage: {
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
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
  cardBottomRow: {
    marginTop: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    alignItems: 'center',
  },
  cardMetaText: {
    color: palette.textMuted,
    fontSize: 11,
    fontWeight: '700',
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

  narrativeCard: {
    backgroundColor: palette.surface,
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: palette.border,
  },
  narrativeText: {
    color: palette.textSoft,
    fontSize: 14,
    lineHeight: 22,
    fontWeight: '600',
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