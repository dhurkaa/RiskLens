import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  Platform,
  Animated,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { supabase } from '../../lib/supabase';
import * as Animatable from 'react-native-animatable';

// ==================== EXISTING PALETTE (unchanged) ====================
const palette = {
  bg: '#0B1016',
  bg2: '#101826',
  card: '#131C27',
  card2: '#182232',
  card3: '#1C293B',
  input: '#192433',
  border: 'rgba(255,255,255,0.08)',
  text: '#F8FAFC',
  textSoft: '#CBD5E1',
  textMuted: '#94A3B8',
  primary: '#3B82F6',
  primary2: '#2563EB',
  primarySoft: '#93C5FD',
  success: '#10B981',
  warning: '#F59E0B',
  danger: '#EF4444',
  purple: '#8B5CF6',
  cyan: '#06B6D4',
};

// ==================== EXISTING TYPES ====================
type DashboardProfile = {
  id: string;
  full_name?: string | null;
  company?: string | null;
};

type UploadItem = {
  id: string;
  file_name: string;
  created_at: string;
  status?: string | null;
  file_size?: number | null;
  row_count?: number | null;
};

type AnalysisItem = {
  id: string;
  created_at: string;
  risk_score?: number | null;
  summary?: string | null;
  upload_id?: string | null;
  status?: string | null;
  confidence_score?: number | null;
  anomaly_count?: number | null;
  recommendation_count?: number | null;
};

type ReportItem = {
  id: string;
  title?: string | null;
  created_at: string;
  status?: string | null;
  report_type?: string | null;
};

type MarketRow = {
  id: string;
  category?: string | null;
  avg_market_price?: number | null;
  min_price?: number | null;
  max_price?: number | null;
  updated_at?: string | null;
};

type AlertItem = {
  id: string;
  title: string;
  description: string;
  severity: 'low' | 'medium' | 'high';
};

type DashboardStats = {
  totalUploads: number;
  totalAnalyses: number;
  completedReports: number;
  avgRiskScore: number;
  avgConfidence: number;
  activeAlerts: number;
};

// ==================== EXISTING UTILITIES ====================
const statusColorMap: Record<string, string> = {
  completed: palette.success,
  complete: palette.success,
  success: palette.success,
  processing: palette.warning,
  pending: palette.warning,
  queued: palette.warning,
  failed: palette.danger,
  error: palette.danger,
};

function formatDate(dateString?: string | null) {
  if (!dateString) return '—';
  const date = new Date(dateString);
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatDateTime(dateString?: string | null) {
  if (!dateString) return '—';
  const date = new Date(dateString);
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatCompactNumber(value?: number | null) {
  if (value === null || value === undefined || Number.isNaN(value)) return '0';
  if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
  return `${Math.round(value)}`;
}

function formatPercent(value?: number | null) {
  if (value === null || value === undefined || Number.isNaN(value)) return '0%';
  return `${Math.round(value)}%`;
}

function formatFileSize(bytes?: number | null) {
  if (!bytes || bytes <= 0) return '—';
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${bytes} B`;
}

function scoreTone(score?: number | null) {
  const safe = score ?? 0;
  if (safe >= 75) return { label: 'High', color: palette.danger };
  if (safe >= 45) return { label: 'Medium', color: palette.warning };
  return { label: 'Low', color: palette.success };
}

function confidenceTone(score?: number | null) {
  const safe = score ?? 0;
  if (safe >= 80) return { label: 'Strong', color: palette.success };
  if (safe >= 55) return { label: 'Moderate', color: palette.warning };
  return { label: 'Weak', color: palette.danger };
}

function dedupeAlerts(alerts: AlertItem[]) {
  const seen = new Set<string>();
  return alerts.filter((item) => {
    const key = `${item.title}-${item.description}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function buildAlerts(
  uploads: UploadItem[],
  analyses: AnalysisItem[],
  reports: ReportItem[]
): AlertItem[] {
  const alerts: AlertItem[] = [];

  const failedUploads = uploads.filter(
    (item) => item.status?.toLowerCase() === 'failed'
  );
  failedUploads.forEach((item) => {
    alerts.push({
      id: `upload-${item.id}`,
      title: 'Upload failed',
      description: `${item.file_name} needs attention before analysis can continue.`,
      severity: 'high',
    });
  });

  const riskyAnalyses = analyses.filter((item) => (item.risk_score ?? 0) >= 70);
  riskyAnalyses.forEach((item) => {
    alerts.push({
      id: `analysis-risk-${item.id}`,
      title: 'High risk detected',
      description: `An analysis generated a high risk score of ${Math.round(
        item.risk_score || 0
      )}%.`,
      severity: 'high',
    });
  });

  const lowConfidence = analyses.filter(
    (item) => (item.confidence_score ?? 0) > 0 && (item.confidence_score ?? 0) < 50
  );
  lowConfidence.forEach((item) => {
    alerts.push({
      id: `analysis-confidence-${item.id}`,
      title: 'Low confidence insight',
      description: `One AI analysis returned only ${Math.round(
        item.confidence_score || 0
      )}% confidence.`,
      severity: 'medium',
    });
  });

  const pendingReports = reports.filter((item) =>
    ['pending', 'processing', 'queued'].includes((item.status || '').toLowerCase())
  );
  pendingReports.slice(0, 3).forEach((item) => {
    alerts.push({
      id: `report-${item.id}`,
      title: 'Report still processing',
      description: `${item.title || 'Untitled report'} is still being prepared.`,
      severity: 'low',
    });
  });

  return dedupeAlerts(alerts).slice(0, 6);
}

function computeStats(
  uploads: UploadItem[],
  analyses: AnalysisItem[],
  reports: ReportItem[],
  alerts: AlertItem[]
): DashboardStats {
  const avgRiskScore =
    analyses.length > 0
      ? analyses.reduce((sum, item) => sum + (item.risk_score || 0), 0) / analyses.length
      : 0;

  const analysesWithConfidence = analyses.filter(
    (item) => item.confidence_score !== null && item.confidence_score !== undefined
  );

  const avgConfidence =
    analysesWithConfidence.length > 0
      ? analysesWithConfidence.reduce(
          (sum, item) => sum + (item.confidence_score || 0),
          0
        ) / analysesWithConfidence.length
      : 0;

  return {
    totalUploads: uploads.length,
    totalAnalyses: analyses.length,
    completedReports: reports.filter((r) =>
      ['completed', 'complete', 'success'].includes((r.status || '').toLowerCase())
    ).length,
    avgRiskScore,
    avgConfidence,
    activeAlerts: alerts.length,
  };
}

function initials(name?: string | null) {
  if (!name) return 'RL';
  const parts = name.trim().split(' ').filter(Boolean);
  if (parts.length === 0) return 'RL';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

// ==================== EXISTING COMPONENTS (unchanged) ====================
function SectionHeader({
  title,
  subtitle,
  onPress,
  actionLabel = 'View all',
}: {
  title: string;
  subtitle?: string;
  onPress?: () => void;
  actionLabel?: string;
}) {
  return (
    <View style={styles.sectionHeader}>
      <View style={{ flex: 1, paddingRight: 12 }}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {!!subtitle && <Text style={styles.sectionSubtitle}>{subtitle}</Text>}
      </View>
      {onPress ? (
        <TouchableOpacity onPress={onPress} style={styles.sectionAction}>
          <Text style={styles.sectionActionText}>{actionLabel}</Text>
          <Ionicons name="arrow-forward" size={14} color={palette.primarySoft} />
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

function StatCard({
  title,
  value,
  icon,
  tone = 'primary',
  footnote,
}: {
  title: string;
  value: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  tone?: 'primary' | 'success' | 'warning' | 'danger' | 'purple' | 'cyan';
  footnote?: string;
}) {
  const toneMap = {
    primary: [palette.primary, palette.primary2],
    success: [palette.success, '#0E9F6E'],
    warning: [palette.warning, '#D97706'],
    danger: [palette.danger, '#DC2626'],
    purple: [palette.purple, '#7C3AED'],
    cyan: [palette.cyan, '#0891B2'],
  } as const;

  return (
    <View style={styles.statCard}>
      <LinearGradient
        colors={toneMap[tone]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.statIconWrap}
      >
        <Ionicons name={icon} size={18} color="#FFFFFF" />
      </LinearGradient>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statTitle}>{title}</Text>
      {!!footnote && <Text style={styles.statFootnote}>{footnote}</Text>}
    </View>
  );
}

function QuickActionCard({
  title,
  subtitle,
  icon,
  onPress,
  tone = 'primary',
}: {
  title: string;
  subtitle: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  onPress: () => void;
  tone?: 'primary' | 'success' | 'warning' | 'purple';
}) {
  const bgMap = {
    primary: 'rgba(59,130,246,0.12)',
    success: 'rgba(16,185,129,0.12)',
    warning: 'rgba(245,158,11,0.12)',
    purple: 'rgba(139,92,246,0.12)',
  } as const;

  const iconMap = {
    primary: palette.primarySoft,
    success: palette.success,
    warning: palette.warning,
    purple: palette.purple,
  } as const;

  return (
    <TouchableOpacity
      style={styles.quickActionCard}
      activeOpacity={0.9}
      onPress={onPress}
    >
      <View style={[styles.quickActionIconWrap, { backgroundColor: bgMap[tone] }]}>
        <Ionicons name={icon} size={20} color={iconMap[tone]} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.quickActionTitle}>{title}</Text>
        <Text style={styles.quickActionSubtitle}>{subtitle}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={palette.textMuted} />
    </TouchableOpacity>
  );
}

function EmptyStateCard({
  icon,
  title,
  subtitle,
  actionLabel,
  onPress,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  title: string;
  subtitle: string;
  actionLabel?: string;
  onPress?: () => void;
}) {
  return (
    <View style={styles.emptyCard}>
      <View style={styles.emptyIconWrap}>
        <Ionicons name={icon} size={22} color={palette.primarySoft} />
      </View>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptySubtitle}>{subtitle}</Text>
      {actionLabel && onPress ? (
        <TouchableOpacity style={styles.emptyAction} onPress={onPress}>
          <Text style={styles.emptyActionText}>{actionLabel}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

function UploadRow({
  item,
  onPress,
}: {
  item: UploadItem;
  onPress?: () => void;
}) {
  const status = (item.status || 'pending').toLowerCase();
  const statusColor = statusColorMap[status] || palette.warning;

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.9}
      style={styles.listRowCard}
    >
      <View style={styles.listRowLeft}>
        <View style={styles.fileIconWrap}>
          <Ionicons name="document-text-outline" size={18} color={palette.primarySoft} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.listRowTitle} numberOfLines={1}>
            {item.file_name}
          </Text>
          <Text style={styles.listRowSubtext}>
            {formatDateTime(item.created_at)} • {formatFileSize(item.file_size)}
          </Text>
          <Text style={styles.listRowSubtext}>
            Rows: {formatCompactNumber(item.row_count || 0)}
          </Text>
        </View>
      </View>
      <View style={styles.statusPillWrap}>
        <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
        <Text style={[styles.statusPillText, { color: statusColor }]}>
          {status.charAt(0).toUpperCase() + status.slice(1)}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

function AnalysisRow({
  item,
  onPress,
}: {
  item: AnalysisItem;
  onPress?: () => void;
}) {
  const risk = scoreTone(item.risk_score);
  const confidence = confidenceTone(item.confidence_score);

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.9}
      style={styles.analysisCard}
    >
      <View style={styles.analysisTop}>
        <View>
          <Text style={styles.analysisDate}>{formatDateTime(item.created_at)}</Text>
          <Text style={styles.analysisSummary} numberOfLines={2}>
            {item.summary || 'AI analysis completed and insights are available.'}
          </Text>
        </View>
        <View style={styles.analysisBadges}>
          <View
            style={[
              styles.miniBadge,
              { backgroundColor: 'rgba(245,158,11,0.12)' },
            ]}
          >
            <Text style={[styles.miniBadgeText, { color: risk.color }]}>
              Risk {formatPercent(item.risk_score)}
            </Text>
          </View>
        </View>
      </View>
      <View style={styles.analysisMetaRow}>
        <View style={styles.analysisMetaBox}>
          <Text style={styles.analysisMetaLabel}>Confidence</Text>
          <Text style={[styles.analysisMetaValue, { color: confidence.color }]}>
            {formatPercent(item.confidence_score)}
          </Text>
        </View>
        <View style={styles.analysisMetaBox}>
          <Text style={styles.analysisMetaLabel}>Anomalies</Text>
          <Text style={styles.analysisMetaValue}>
            {formatCompactNumber(item.anomaly_count || 0)}
          </Text>
        </View>
        <View style={styles.analysisMetaBox}>
          <Text style={styles.analysisMetaLabel}>Recommendations</Text>
          <Text style={styles.analysisMetaValue}>
            {formatCompactNumber(item.recommendation_count || 0)}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

function AlertCard({ item }: { item: AlertItem }) {
  const toneMap = {
    low: palette.primarySoft,
    medium: palette.warning,
    high: palette.danger,
  } as const;

  const iconMap = {
    low: 'information-circle-outline',
    medium: 'warning-outline',
    high: 'alert-circle-outline',
  } as const;

  return (
    <View style={styles.alertCard}>
      <View
        style={[
          styles.alertIconWrap,
          { backgroundColor: `${toneMap[item.severity]}20` },
        ]}
      >
        <Ionicons
          name={iconMap[item.severity]}
          size={18}
          color={toneMap[item.severity]}
        />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.alertTitle}>{item.title}</Text>
        <Text style={styles.alertDescription}>{item.description}</Text>
      </View>
    </View>
  );
}

function ReportRow({
  item,
  onPress,
}: {
  item: ReportItem;
  onPress?: () => void;
}) {
  const status = (item.status || 'pending').toLowerCase();
  const statusColor = statusColorMap[status] || palette.warning;

  return (
    <TouchableOpacity
      style={styles.reportRow}
      onPress={onPress}
      activeOpacity={0.9}
    >
      <View style={styles.reportIconWrap}>
        <MaterialCommunityIcons
          name="file-chart-outline"
          size={20}
          color={palette.primarySoft}
        />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.reportTitle} numberOfLines={1}>
          {item.title || 'Untitled report'}
        </Text>
        <Text style={styles.reportMeta}>
          {(item.report_type || 'Analysis').toUpperCase()} • {formatDate(item.created_at)}
        </Text>
      </View>
      <View style={styles.statusPillWrap}>
        <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
        <Text style={[styles.statusPillText, { color: statusColor }]}>
          {status.charAt(0).toUpperCase() + status.slice(1)}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

function MarketInsightCard({
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
  tone?: 'primary' | 'success' | 'warning' | 'purple';
}) {
  const bgMap = {
    primary: 'rgba(59,130,246,0.12)',
    success: 'rgba(16,185,129,0.12)',
    warning: 'rgba(245,158,11,0.12)',
    purple: 'rgba(139,92,246,0.12)',
  } as const;

  const iconMap = {
    primary: palette.primarySoft,
    success: palette.success,
    warning: palette.warning,
    purple: palette.purple,
  } as const;

  return (
    <View style={styles.marketCard}>
      <View style={[styles.marketIconWrap, { backgroundColor: bgMap[tone] }]}>
        <Ionicons name={icon} size={18} color={iconMap[tone]} />
      </View>
      <Text style={styles.marketTitle}>{title}</Text>
      <Text style={styles.marketValue}>{value}</Text>
      <Text style={styles.marketSubtitle}>{subtitle}</Text>
    </View>
  );
}

// ==================== NEW ENHANCEMENTS ====================

// 1. Skeleton Loader
const SkeletonLoader = ({ width, height, style }: { width?: number | string; height?: number | string; style?: any }) => {
  const shimmerAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerAnim, { toValue: 1, duration: 1000, useNativeDriver: true }),
        Animated.timing(shimmerAnim, { toValue: 0, duration: 1000, useNativeDriver: true }),
      ])
    ).start();
  }, []);
  const translateX = shimmerAnim.interpolate({ inputRange: [0, 1], outputRange: [-100, 100] });
  return (
    <Animated.View style={[{ width, height, backgroundColor: palette.card2, borderRadius: 8, overflow: 'hidden' }, style]}>
      <Animated.View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(255,255,255,0.05)', transform: [{ translateX }] }} />
    </Animated.View>
  );
};

// 2. Sparkline for risk trend
const Sparkline = ({ data, color }: { data: number[]; color: string }) => {
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min;
  const normalize = (v: number) => ((v - min) / (range || 1)) * 30;
  const sliced = data.slice(-6);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: 30, gap: 2 }}>
      {sliced.map((val, idx) => (
        <View key={idx} style={{ width: 4, height: normalize(val), backgroundColor: color, borderRadius: 2, opacity: 0.6 + idx * 0.07 }} />
      ))}
    </View>
  );
};

// 3. Toast notification
const Toast = ({ message, type = 'info', onHide }: { message: string; type?: 'success' | 'error' | 'info'; onHide: () => void }) => {
  useEffect(() => {
    const timer = setTimeout(onHide, 3000);
    return () => clearTimeout(timer);
  }, []);
  const bgColor = type === 'success' ? palette.success : type === 'error' ? palette.danger : palette.primary;
  return (
    <Animatable.View animation="fadeInUp" duration={300} style={[styles.toast, { backgroundColor: bgColor }]}>
      <Text style={styles.toastText}>{message}</Text>
    </Animatable.View>
  );
};

// 4. Error Boundary (simple class component)
class DashboardErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean }> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(error: any) { console.error('Dashboard error:', error); }
  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.errorBoundaryContainer}>
          <Ionicons name="bug-outline" size={48} color={palette.danger} />
          <Text style={styles.errorBoundaryText}>Something went wrong. Pull to refresh.</Text>
        </View>
      );
    }
    return this.props.children;
  }
}

// ==================== MAIN DASHBOARD ====================
export default function DashboardScreen() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [profile, setProfile] = useState<DashboardProfile | null>(null);
  const [uploads, setUploads] = useState<UploadItem[]>([]);
  const [analyses, setAnalyses] = useState<AnalysisItem[]>([]);
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [marketRows, setMarketRows] = useState<MarketRow[]>([]);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const loadDashboard = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);

      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      if (!user) { router.replace('/login'); return; }

      const [{ data: profileData }, { data: uploadData }, { data: analysisData }, { data: reportData }, { data: marketData }] = await Promise.all([
        supabase.from('profiles').select('id, full_name, company').eq('id', user.id).maybeSingle(),
        supabase.from('uploads').select('id, file_name, created_at, status, file_size, row_count').eq('user_id', user.id).order('created_at', { ascending: false }).limit(10),
        supabase.from('analyses').select('id, created_at, risk_score, summary, upload_id, status, confidence_score, anomaly_count, recommendation_count').eq('user_id', user.id).order('created_at', { ascending: false }).limit(10),
        supabase.from('reports').select('id, title, created_at, status, report_type').eq('user_id', user.id).order('created_at', { ascending: false }).limit(10),
        supabase.from('market_prices').select('id, category, avg_market_price, min_price, max_price, updated_at').order('updated_at', { ascending: false }).limit(20),
      ]);

      setProfile(profileData || null);
      setUploads(uploadData || []);
      setAnalyses(analysisData || []);
      setReports(reportData || []);
      setMarketRows(marketData || []);
      setLastUpdated(new Date());
    } catch (error: any) {
      Alert.alert('Dashboard Error', error?.message || 'Unable to load dashboard data right now.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadDashboard();
    Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }).start();
  }, []);

  // Real‑time alerts subscription (simulated – adapt to your actual Supabase table)
  useEffect(() => {
    const subscription = supabase
      .channel('dashboard_alerts')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'alerts' }, (payload) => {
        setToast({ message: (payload.new as any)?.title || 'New alert', type: 'info' });
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        loadDashboard(true);
      })
      .subscribe();
    return () => { subscription.unsubscribe(); };
  }, []);

  // Keyboard shortcuts (web)
  useEffect(() => {
    if (Platform.OS === 'web') {
      const handleKeyPress = (e: KeyboardEvent) => {
        if (e.key === 'u' || e.key === 'U') { router.push('/(tabs)/upload'); e.preventDefault(); }
        else if (e.key === 'r' || e.key === 'R') { loadDashboard(true); e.preventDefault(); }
      };
      window.addEventListener('keydown', handleKeyPress);
      return () => window.removeEventListener('keydown', handleKeyPress);
    }
  }, []);

  const alerts = useMemo(() => buildAlerts(uploads, analyses, reports), [uploads, analyses, reports]);
  const stats = useMemo(() => computeStats(uploads, analyses, reports, alerts), [uploads, analyses, reports, alerts]);
  const latestAnalysis = analyses[0];
  const latestUpload = uploads[0];
  const latestReport = reports[0];

  const marketSummary = useMemo(() => {
    if (!marketRows.length) return { trackedCategories: 0, avgBenchmark: 0, widestRange: 0, latestUpdate: null };
    const validAvg = marketRows.map(r => r.avg_market_price || 0).filter(v => v > 0);
    const avgBenchmark = validAvg.length ? validAvg.reduce((a,b) => a+b,0) / validAvg.length : 0;
    const widestRange = marketRows.reduce((max, r) => Math.max(max, (r.max_price || 0) - (r.min_price || 0)), 0);
    return {
      trackedCategories: new Set(marketRows.map(r => r.category).filter(Boolean)).size,
      avgBenchmark,
      widestRange,
      latestUpdate: marketRows[0]?.updated_at || null,
    };
  }, [marketRows]);

  const handleRefresh = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await loadDashboard(true);
    setToast({ message: 'Dashboard refreshed', type: 'success' });
  };

  const handleLogout = async () => {
    Alert.alert('Sign out', 'Do you want to sign out from RiskLens?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: async () => { await supabase.auth.signOut(); router.replace('/login'); } },
    ]);
  };

  const userName = profile?.full_name?.trim() || profile?.company?.trim() || 'RiskLens User';
  const greeting = (() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  })();

  const riskTrend = useMemo(() => analyses.map(a => a.risk_score || 0).reverse(), [analyses]);

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <LinearGradient colors={[palette.bg, palette.bg2]} style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={palette.primary} />
          <Text style={styles.loadingText}>Loading your RiskLens dashboard...</Text>
          <SkeletonLoader width={200} height={16} style={{ marginTop: 20 }} />
          <SkeletonLoader width={250} height={12} style={{ marginTop: 8 }} />
        </LinearGradient>
      </SafeAreaView>
    );
  }

  return (
    <DashboardErrorBoundary>
      <SafeAreaView style={styles.safeArea}>
        <LinearGradient colors={[palette.bg, palette.bg2]} style={styles.container}>
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={palette.primary} />}
          >
            <Animatable.View animation="fadeInUp" duration={600} useNativeDriver>
              <LinearGradient colors={[palette.card, palette.card2]} style={styles.heroCard}>
                <View style={styles.heroTopRow}>
                  <View style={styles.avatarWrap}>
                    <Text style={styles.avatarText}>{initials(profile?.full_name || userName)}</Text>
                  </View>
                  <TouchableOpacity style={styles.iconGhostButton} onPress={handleLogout}>
                    <Ionicons name="log-out-outline" size={18} color={palette.textSoft} />
                  </TouchableOpacity>
                </View>
                <Text style={styles.greetingText}>{greeting}, <Text style={{ color: palette.text }}>{userName}</Text></Text>
                <Text style={styles.heroTitle}>Your pricing, risk, and market intelligence workspace</Text>
                <Text style={styles.heroSubtitle}>Monitor uploads, review analyses, compare benchmark prices, and act on AI-generated business insights from one place.</Text>
                {lastUpdated && <Text style={styles.lastUpdated}>Last updated: {lastUpdated.toLocaleTimeString()}</Text>}
                <View style={styles.heroActions}>
                  <TouchableOpacity style={styles.primaryHeroButton} onPress={() => router.push('/(tabs)/upload')} activeOpacity={0.9}>
                    <LinearGradient colors={[palette.primary, palette.primary2]} style={styles.primaryHeroButtonInner}>
                      <Ionicons name="cloud-upload-outline" size={18} color="#FFF" />
                      <Text style={styles.primaryHeroButtonText}>Upload CSV</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.secondaryHeroButton} onPress={() => router.push('/(tabs)/reports')} activeOpacity={0.9}>
                    <Ionicons name="document-text-outline" size={18} color={palette.textSoft} />
                    <Text style={styles.secondaryHeroButtonText}>Open reports</Text>
                  </TouchableOpacity>
                </View>
              </LinearGradient>
            </Animatable.View>

            <SectionHeader title="Quick actions" subtitle="Jump straight into the most important workflows." />
            <View style={styles.quickActionsGrid}>
              <QuickActionCard title="Upload new CSV" subtitle="Add a fresh dataset and start analysis." icon="cloud-upload-outline" tone="primary" onPress={() => router.push('/(tabs)/upload')} />
              <QuickActionCard title="View analyses" subtitle="Inspect recent AI results and signals." icon="analytics-outline" tone="purple" onPress={() => router.push('/(tabs)/analysis')} />
              <QuickActionCard title="Market intelligence" subtitle="Compare your data against market benchmarks." icon="globe-outline" tone="success" onPress={() => router.push('/(tabs)/market')} />
              <QuickActionCard title="Reports" subtitle="Open saved summaries and exported reports." icon="newspaper-outline" tone="warning" onPress={() => router.push('/(tabs)/reports')} />
            </View>

            <SectionHeader title="Workspace overview" subtitle="Your key metrics at a glance." />
            <View style={styles.statsGrid}>
              <StatCard title="Uploads" value={formatCompactNumber(stats.totalUploads)} icon="cloud-upload-outline" tone="primary" footnote="Datasets stored" />
              <StatCard title="Analyses" value={formatCompactNumber(stats.totalAnalyses)} icon="analytics-outline" tone="purple" footnote="AI runs completed" />
              <StatCard title="Reports" value={formatCompactNumber(stats.completedReports)} icon="document-text-outline" tone="success" footnote="Completed reports" />
              <StatCard title="Avg risk" value={formatPercent(stats.avgRiskScore)} icon="warning-outline" tone="warning" footnote="Across analyses" />
              <StatCard title="Confidence" value={formatPercent(stats.avgConfidence)} icon="shield-checkmark-outline" tone="cyan" footnote="AI confidence" />
              <StatCard title="Alerts" value={formatCompactNumber(stats.activeAlerts)} icon="alert-circle-outline" tone="danger" footnote="Need attention" />
            </View>

            <SectionHeader title="AI summary" subtitle="Latest generated highlights from your workspace." />
            {latestAnalysis ? (
              <View style={styles.summaryCard}>
                <View style={styles.summaryTopRow}>
                  <View style={styles.summaryChip}><Ionicons name="sparkles-outline" size={14} color={palette.primarySoft} /><Text style={styles.summaryChipText}>Latest insight</Text></View>
                  <Text style={styles.summaryDate}>{formatDateTime(latestAnalysis.created_at)}</Text>
                </View>
                <Text style={styles.summaryHeadline}>{latestAnalysis.summary || 'Your latest dataset has been analyzed and new pricing insights are ready.'}</Text>
                <View style={styles.summaryMetricsRow}>
                  <View style={styles.summaryMetric}><Text style={styles.summaryMetricLabel}>Risk score</Text><Text style={styles.summaryMetricValue}>{formatPercent(latestAnalysis.risk_score)}</Text></View>
                  <View style={styles.summaryMetric}><Text style={styles.summaryMetricLabel}>Confidence</Text><Text style={styles.summaryMetricValue}>{formatPercent(latestAnalysis.confidence_score)}</Text></View>
                  <View style={styles.summaryMetric}><Text style={styles.summaryMetricLabel}>Anomalies</Text><Text style={styles.summaryMetricValue}>{formatCompactNumber(latestAnalysis.anomaly_count || 0)}</Text></View>
                </View>
                {riskTrend.length > 1 && (
                  <View style={styles.sparklineContainer}>
                    <Text style={styles.sparklineLabel}>Risk trend (last {riskTrend.length} analyses)</Text>
                    <Sparkline data={riskTrend} color={palette.danger} />
                  </View>
                )}
                <TouchableOpacity style={styles.summaryAction} onPress={() => router.push('/(tabs)/analysis')}>
                  <Text style={styles.summaryActionText}>Open analysis center</Text>
                  <Ionicons name="arrow-forward" size={15} color={palette.primarySoft} />
                </TouchableOpacity>
              </View>
            ) : (
              <EmptyStateCard icon="analytics-outline" title="No analyses yet" subtitle="Upload your first CSV file to generate pricing, risk, and market intelligence insights." actionLabel="Upload first CSV" onPress={() => router.push('/(tabs)/upload')} />
            )}

            <SectionHeader title="Market overview" subtitle="Benchmark intelligence from your available market data." onPress={() => router.push('/(tabs)/market')} />
            <View style={styles.marketGrid}>
              <MarketInsightCard title="Tracked categories" value={formatCompactNumber(marketSummary.trackedCategories)} subtitle="Benchmark groups available" icon="layers-outline" tone="primary" />
              <MarketInsightCard title="Avg market price" value={`€${marketSummary.avgBenchmark.toFixed(2)}`} subtitle="Mean benchmark price" icon="cash-outline" tone="success" />
              <MarketInsightCard title="Widest price range" value={`€${marketSummary.widestRange.toFixed(2)}`} subtitle="Largest spread detected" icon="swap-vertical-outline" tone="warning" />
              <MarketInsightCard title="Last update" value={marketSummary.latestUpdate ? formatDate(marketSummary.latestUpdate) : '—'} subtitle="Latest benchmark refresh" icon="time-outline" tone="purple" />
            </View>

            <SectionHeader title="Alerts & attention points" subtitle="Important issues detected in your uploads, analyses, or reports." />
            {alerts.length > 0 ? (
              <View style={styles.alertsList}>{alerts.map(item => <AlertCard key={item.id} item={item} />)}</View>
            ) : (
              <EmptyStateCard icon="shield-checkmark-outline" title="No active alerts" subtitle="Your current workspace looks healthy. Keep uploading fresh data to maintain visibility." />
            )}

            <SectionHeader title="Recent uploads" subtitle="Datasets recently added to your workspace." onPress={() => router.push('/(tabs)/upload')} />
            {uploads.length > 0 ? (
              <View style={styles.listBlock}>{uploads.slice(0,5).map(item => <UploadRow key={item.id} item={item} onPress={() => router.push('/(tabs)/upload')} />)}</View>
            ) : (
              <EmptyStateCard icon="cloud-upload-outline" title="No uploads yet" subtitle="Start by uploading a CSV file so RiskLens can begin analysis." actionLabel="Go to upload" onPress={() => router.push('/(tabs)/upload')} />
            )}

            <SectionHeader title="Recent analyses" subtitle="Your latest AI-generated outputs and scoring." onPress={() => router.push('/(tabs)/analysis')} />
            {analyses.length > 0 ? (
              <View style={styles.analysisList}>{analyses.slice(0,4).map(item => <AnalysisRow key={item.id} item={item} onPress={() => router.push('/(tabs)/analysis')} />)}</View>
            ) : (
              <EmptyStateCard icon="sparkles-outline" title="No AI analyses yet" subtitle="Analyses will appear here once your uploaded data is processed." />
            )}

            <SectionHeader title="Reports history" subtitle="Recently generated business and pricing reports." onPress={() => router.push('/(tabs)/reports')} />
            {reports.length > 0 ? (
              <View style={styles.reportsList}>{reports.slice(0,5).map(item => <ReportRow key={item.id} item={item} onPress={() => router.push('/(tabs)/reports')} />)}</View>
            ) : (
              <EmptyStateCard icon="document-text-outline" title="No reports available" subtitle="Reports will appear after you run analyses and save summaries." />
            )}

            <SectionHeader title="Workspace highlights" subtitle="A final summary of the most important live state in your app." />
            <View style={styles.highlightsWrap}>
              <View style={styles.highlightCardLarge}>
                <Text style={styles.highlightEyebrow}>Latest upload</Text>
                <Text style={styles.highlightTitle}>{latestUpload?.file_name || 'No upload available yet'}</Text>
                <Text style={styles.highlightText}>{latestUpload ? `Uploaded on ${formatDateTime(latestUpload.created_at)} with status ${latestUpload.status || 'pending'}.` : 'Upload a CSV file to unlock personalized analysis and reporting.'}</Text>
              </View>
              <View style={styles.highlightCardSmall}>
                <Text style={styles.highlightEyebrow}>Latest report</Text>
                <Text style={styles.highlightTitleSmall}>{latestReport?.title || 'No report generated'}</Text>
                <Text style={styles.highlightText}>{latestReport ? `${formatDate(latestReport.created_at)} • ${latestReport.status || 'pending'}` : 'Run an analysis to start generating reports.'}</Text>
              </View>
              <View style={styles.highlightCardSmall}>
                <Text style={styles.highlightEyebrow}>Avg AI confidence</Text>
                <Text style={styles.highlightValueBig}>{formatPercent(stats.avgConfidence)}</Text>
                <Text style={styles.highlightText}>Based on recent analyses generated in your workspace.</Text>
              </View>
            </View>
            <View style={styles.footerSpace} />
          </ScrollView>

          <Animatable.View animation="fadeInUp" delay={500} style={styles.fabContainer}>
            <TouchableOpacity style={styles.fab} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); router.push('/(tabs)/upload'); }} activeOpacity={0.9}>
              <LinearGradient colors={[palette.primary, palette.primary2]} style={styles.fabGradient}>
                <Ionicons name="add" size={28} color="#FFF" />
              </LinearGradient>
            </TouchableOpacity>
          </Animatable.View>

          {toast && <Toast message={toast.message} type={toast.type} onHide={() => setToast(null)} />}
        </LinearGradient>
      </SafeAreaView>
    </DashboardErrorBoundary>
  );
}

// ==================== STYLES ====================
const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: palette.bg },
  container: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24 },
  loadingText: { color: palette.textSoft, marginTop: 14, fontSize: 14, textAlign: 'center' },
  scrollContent: { paddingHorizontal: 18, paddingTop: 18, paddingBottom: 24 },
  heroCard: { borderRadius: 26, borderWidth: 1, borderColor: palette.border, padding: 20, marginBottom: 20, overflow: 'hidden' },
  heroTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 },
  avatarWrap: { width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(59,130,246,0.18)', alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: palette.text, fontSize: 15, fontWeight: '800' },
  iconGhostButton: { width: 40, height: 40, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.04)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: palette.border },
  greetingText: { color: palette.textSoft, fontSize: 14, marginBottom: 8 },
  heroTitle: { color: palette.text, fontSize: 27, lineHeight: 34, fontWeight: '900', letterSpacing: -0.7, marginBottom: 10 },
  heroSubtitle: { color: palette.textMuted, fontSize: 14, lineHeight: 21, marginBottom: 20 },
  lastUpdated: { color: palette.textMuted, fontSize: 11, marginBottom: 16 },
  heroActions: { gap: 12 },
  primaryHeroButton: { borderRadius: 16, overflow: 'hidden' },
  primaryHeroButtonInner: { minHeight: 54, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  primaryHeroButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800', marginLeft: 8 },
  secondaryHeroButton: { minHeight: 52, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: palette.border, alignItems: 'center', justifyContent: 'center', flexDirection: 'row' },
  secondaryHeroButtonText: { color: palette.textSoft, fontSize: 15, fontWeight: '700', marginLeft: 8 },
  sectionHeader: { marginBottom: 12, marginTop: 6, flexDirection: 'row', alignItems: 'flex-end' },
  sectionTitle: { color: palette.text, fontSize: 19, fontWeight: '800', marginBottom: 4 },
  sectionSubtitle: { color: palette.textMuted, fontSize: 13, lineHeight: 18 },
  sectionAction: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  sectionActionText: { color: palette.primarySoft, fontSize: 13, fontWeight: '700', marginRight: 4 },
  quickActionsGrid: { gap: 12, marginBottom: 18 },
  quickActionCard: { backgroundColor: palette.card, borderRadius: 18, borderWidth: 1, borderColor: palette.border, padding: 16, flexDirection: 'row', alignItems: 'center' },
  quickActionIconWrap: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  quickActionTitle: { color: palette.text, fontSize: 15, fontWeight: '800', marginBottom: 3 },
  quickActionSubtitle: { color: palette.textMuted, fontSize: 12, lineHeight: 17 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 18 },
  statCard: { width: '48.2%', backgroundColor: palette.card, borderRadius: 18, borderWidth: 1, borderColor: palette.border, padding: 15 },
  statIconWrap: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  statValue: { color: palette.text, fontSize: 24, fontWeight: '900', marginBottom: 4 },
  statTitle: { color: palette.textSoft, fontSize: 13, fontWeight: '700' },
  statFootnote: { color: palette.textMuted, fontSize: 11, marginTop: 6 },
  summaryCard: { backgroundColor: palette.card, borderRadius: 20, borderWidth: 1, borderColor: palette.border, padding: 18, marginBottom: 18 },
  summaryTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  summaryChip: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(59,130,246,0.12)', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
  summaryChipText: { color: palette.primarySoft, fontSize: 12, fontWeight: '700', marginLeft: 6 },
  summaryDate: { color: palette.textMuted, fontSize: 12 },
  summaryHeadline: { color: palette.text, fontSize: 16, lineHeight: 24, fontWeight: '700', marginBottom: 16 },
  summaryMetricsRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  summaryMetric: { flex: 1, backgroundColor: palette.card2, borderRadius: 14, padding: 12, borderWidth: 1, borderColor: palette.border },
  summaryMetricLabel: { color: palette.textMuted, fontSize: 11, marginBottom: 4 },
  summaryMetricValue: { color: palette.text, fontSize: 15, fontWeight: '800' },
  summaryAction: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start' },
  summaryActionText: { color: palette.primarySoft, fontSize: 13, fontWeight: '800', marginRight: 6 },
  sparklineContainer: { marginTop: 8, marginBottom: 12 },
  sparklineLabel: { color: palette.textMuted, fontSize: 11, marginBottom: 6 },
  marketGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 18 },
  marketCard: { width: '48.2%', backgroundColor: palette.card, borderRadius: 18, borderWidth: 1, borderColor: palette.border, padding: 15 },
  marketIconWrap: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  marketTitle: { color: palette.textSoft, fontSize: 13, fontWeight: '700', marginBottom: 8 },
  marketValue: { color: palette.text, fontSize: 21, fontWeight: '900', marginBottom: 4 },
  marketSubtitle: { color: palette.textMuted, fontSize: 11, lineHeight: 16 },
  alertsList: { gap: 12, marginBottom: 18 },
  alertCard: { backgroundColor: palette.card, borderRadius: 18, borderWidth: 1, borderColor: palette.border, padding: 15, flexDirection: 'row', alignItems: 'flex-start' },
  alertIconWrap: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  alertTitle: { color: palette.text, fontSize: 14, fontWeight: '800', marginBottom: 4 },
  alertDescription: { color: palette.textMuted, fontSize: 12, lineHeight: 18 },
  listBlock: { gap: 12, marginBottom: 18 },
  listRowCard: { backgroundColor: palette.card, borderRadius: 18, borderWidth: 1, borderColor: palette.border, padding: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  listRowLeft: { flexDirection: 'row', alignItems: 'center', flex: 1, paddingRight: 10 },
  fileIconWrap: { width: 40, height: 40, borderRadius: 14, backgroundColor: 'rgba(59,130,246,0.12)', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  listRowTitle: { color: palette.text, fontSize: 14, fontWeight: '800', marginBottom: 4 },
  listRowSubtext: { color: palette.textMuted, fontSize: 12, lineHeight: 16 },
  statusPillWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.04)', paddingHorizontal: 10, paddingVertical: 7, borderRadius: 999 },
  statusDot: { width: 8, height: 8, borderRadius: 999, marginRight: 6 },
  statusPillText: { fontSize: 12, fontWeight: '800' },
  analysisList: { gap: 12, marginBottom: 18 },
  analysisCard: { backgroundColor: palette.card, borderRadius: 18, borderWidth: 1, borderColor: palette.border, padding: 16 },
  analysisTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 },
  analysisDate: { color: palette.textMuted, fontSize: 12, marginBottom: 6 },
  analysisSummary: { color: palette.text, fontSize: 14, lineHeight: 21, fontWeight: '700', maxWidth: 240 },
  analysisBadges: { alignItems: 'flex-end', marginLeft: 8 },
  miniBadge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 7 },
  miniBadgeText: { fontSize: 12, fontWeight: '800' },
  analysisMetaRow: { flexDirection: 'row', gap: 10 },
  analysisMetaBox: { flex: 1, backgroundColor: palette.card2, borderRadius: 14, borderWidth: 1, borderColor: palette.border, padding: 12 },
  analysisMetaLabel: { color: palette.textMuted, fontSize: 11, marginBottom: 4 },
  analysisMetaValue: { color: palette.text, fontSize: 15, fontWeight: '800' },
  reportsList: { gap: 12, marginBottom: 18 },
  reportRow: { backgroundColor: palette.card, borderRadius: 18, borderWidth: 1, borderColor: palette.border, padding: 14, flexDirection: 'row', alignItems: 'center' },
  reportIconWrap: { width: 42, height: 42, borderRadius: 14, backgroundColor: 'rgba(59,130,246,0.12)', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  reportTitle: { color: palette.text, fontSize: 14, fontWeight: '800', marginBottom: 4 },
  reportMeta: { color: palette.textMuted, fontSize: 12 },
  highlightsWrap: { gap: 12 },
  highlightCardLarge: { backgroundColor: palette.card, borderRadius: 20, borderWidth: 1, borderColor: palette.border, padding: 18 },
  highlightCardSmall: { backgroundColor: palette.card, borderRadius: 20, borderWidth: 1, borderColor: palette.border, padding: 18 },
  highlightEyebrow: { color: palette.primarySoft, fontSize: 12, fontWeight: '800', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  highlightTitle: { color: palette.text, fontSize: 18, fontWeight: '800', lineHeight: 24, marginBottom: 8 },
  highlightTitleSmall: { color: palette.text, fontSize: 16, fontWeight: '800', lineHeight: 22, marginBottom: 8 },
  highlightValueBig: { color: palette.text, fontSize: 28, fontWeight: '900', marginBottom: 8 },
  highlightText: { color: palette.textMuted, fontSize: 13, lineHeight: 19 },
  emptyCard: { backgroundColor: palette.card, borderRadius: 20, borderWidth: 1, borderColor: palette.border, padding: 22, alignItems: 'center', marginBottom: 18 },
  emptyIconWrap: { width: 48, height: 48, borderRadius: 16, backgroundColor: 'rgba(59,130,246,0.12)', alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  emptyTitle: { color: palette.text, fontSize: 16, fontWeight: '800', marginBottom: 6, textAlign: 'center' },
  emptySubtitle: { color: palette.textMuted, fontSize: 13, lineHeight: 19, textAlign: 'center', marginBottom: 14 },
  emptyAction: { backgroundColor: 'rgba(59,130,246,0.14)', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12 },
  emptyActionText: { color: palette.primarySoft, fontSize: 13, fontWeight: '800' },
  footerSpace: { height: Platform.OS === 'ios' ? 40 : 24 },
  fabContainer: { position: 'absolute', bottom: 24, right: 20, zIndex: 999 },
  fab: { width: 56, height: 56, borderRadius: 28, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 8 },
  fabGradient: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  toast: { position: 'absolute', bottom: 100, left: 20, right: 20, borderRadius: 12, padding: 12, alignItems: 'center', zIndex: 1000, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4, elevation: 4 },
  toastText: { color: '#FFF', fontWeight: '600', fontSize: 14 },
  errorBoundaryContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: palette.bg, padding: 24 },
  errorBoundaryText: { color: palette.textMuted, marginTop: 12, textAlign: 'center' },
});