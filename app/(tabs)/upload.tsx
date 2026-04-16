import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import Papa from 'papaparse';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
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

type CsvProductRow = {
  name: string;
  category?: string;
  sku?: string;
  barcode?: string;
  stock_quantity?: string | number;
  min_stock_level?: string | number;
  selling_price?: string | number;
  cost_price?: string | number;
  expiry_date?: string;
  supplier_name?: string;
};

type ParsedRow = {
  name: string;
  category: string | null;
  sku: string | null;
  barcode: string | null;
  stock_quantity: number;
  min_stock_level: number;
  selling_price: number;
  cost_price: number;
  expiry_date: string | null;
  supplier_name: string | null;
};

const REQUIRED_COLUMNS = [
  'name',
  'category',
  'stock_quantity',
  'min_stock_level',
  'selling_price',
  'cost_price',
  'expiry_date',
  'supplier_name',
];

function normalizeHeader(header: string) {
  return header.trim().toLowerCase();
}

function safeString(value: unknown) {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

function safeNumber(value: unknown) {
  const n = Number(String(value ?? '').replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
}

function normalizeDate(value: unknown): string | null {
  const raw = safeString(value);
  if (!raw) return null;

  const isoMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) return raw;

  const slashMatch = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slashMatch) {
    const [, d, m, y] = slashMatch;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }

  const dotMatch = raw.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (dotMatch) {
    const [, d, m, y] = dotMatch;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }

  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) {
    const y = parsed.getFullYear();
    const m = String(parsed.getMonth() + 1).padStart(2, '0');
    const d = String(parsed.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  return null;
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

function marginPercent(selling: number, cost: number) {
  if (selling <= 0) return 0;
  return ((selling - cost) / selling) * 100;
}

function buildAlertsForRow(
  row: ParsedRow,
  productId: string,
  userId: string
) {
  const alerts: {
    user_id: string;
    title: string;
    description: string;
    severity: 'low' | 'medium' | 'high';
    source_type: 'system' | 'expiry' | 'stock' | 'pricing' | 'compliance' | 'supplier';
    source_product_id: string;
  }[] = [];

  const expiryDays = daysUntil(row.expiry_date);
  const margin = marginPercent(row.selling_price, row.cost_price);

  if (row.stock_quantity <= row.min_stock_level) {
    alerts.push({
      user_id: userId,
      title: `${row.name} below safe stock`,
      description: `${row.name} has ${row.stock_quantity} units and is at or below minimum stock level (${row.min_stock_level}).`,
      severity: row.stock_quantity <= 0 ? 'high' : 'medium',
      source_type: 'stock',
      source_product_id: productId,
    });
  }

  if (expiryDays !== null && expiryDays < 0) {
    alerts.push({
      user_id: userId,
      title: `${row.name} already expired`,
      description: `${row.name} is marked with an expiry date that has already passed.`,
      severity: 'high',
      source_type: 'expiry',
      source_product_id: productId,
    });
  } else if (expiryDays !== null && expiryDays <= 2) {
    alerts.push({
      user_id: userId,
      title: `${row.name} expires very soon`,
      description: `${row.name} expires in ${expiryDays} day(s) and needs immediate review.`,
      severity: 'high',
      source_type: 'expiry',
      source_product_id: productId,
    });
  } else if (expiryDays !== null && expiryDays <= 7) {
    alerts.push({
      user_id: userId,
      title: `${row.name} nearing expiry`,
      description: `${row.name} expires in ${expiryDays} day(s).`,
      severity: 'medium',
      source_type: 'expiry',
      source_product_id: productId,
    });
  }

  if (!row.barcode || !row.sku || !row.supplier_name || !row.expiry_date) {
    alerts.push({
      user_id: userId,
      title: `${row.name} missing product details`,
      description: `One or more important fields are missing: barcode, sku, supplier, or expiry date.`,
      severity: 'low',
      source_type: 'compliance',
      source_product_id: productId,
    });
  }

  if (margin < 10) {
    alerts.push({
      user_id: userId,
      title: `${row.name} weak margin`,
      description: `${row.name} has a low estimated margin of ${margin.toFixed(0)}%.`,
      severity: 'medium',
      source_type: 'pricing',
      source_product_id: productId,
    });
  }

  return alerts;
}

function buildRecommendationsForRow(
  row: ParsedRow,
  productId: string,
  userId: string
) {
  const recommendations: {
    user_id: string;
    product_name: string;
    product_id: string;
    recommendation_type: 'discount' | 'restock' | 'price_up' | 'price_down';
    message: string;
    impact_value: number;
  }[] = [];

  const expiryDays = daysUntil(row.expiry_date);
  const margin = marginPercent(row.selling_price, row.cost_price);
  const stockValueAtSellPrice = row.stock_quantity * row.selling_price;

  if (expiryDays !== null && expiryDays <= 5 && row.stock_quantity >= 8) {
    recommendations.push({
      user_id: userId,
      product_name: row.name,
      product_id: productId,
      recommendation_type: 'discount',
      message: `Apply a time-limited discount to reduce expiry waste on ${row.name}.`,
      impact_value: Math.max(0, Number((stockValueAtSellPrice * 0.25).toFixed(2))),
    });
  }

  if (row.stock_quantity <= row.min_stock_level) {
    recommendations.push({
      user_id: userId,
      product_name: row.name,
      product_id: productId,
      recommendation_type: 'restock',
      message: `Restock ${row.name} soon to avoid shelf gaps and lost sales.`,
      impact_value: Math.max(0, Number((row.selling_price * Math.max(5, row.min_stock_level)).toFixed(2))),
    });
  }

  if (margin < 10 && expiryDays !== null && expiryDays > 10) {
    recommendations.push({
      user_id: userId,
      product_name: row.name,
      product_id: productId,
      recommendation_type: 'price_up',
      message: `Consider a small price increase for ${row.name} because margin is currently weak.`,
      impact_value: Math.max(0, Number((row.stock_quantity * 0.10).toFixed(2))),
    });
  }

  if (margin > 35 && expiryDays !== null && expiryDays <= 10) {
    recommendations.push({
      user_id: userId,
      product_name: row.name,
      product_id: productId,
      recommendation_type: 'price_down',
      message: `A slight markdown on ${row.name} may improve turnover before expiry.`,
      impact_value: Math.max(0, Number((stockValueAtSellPrice * 0.12).toFixed(2))),
    });
  }

  return recommendations;
}

function HeroStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: 'green' | 'blue' | 'yellow' | 'red';
}) {
  const bgMap = {
    green: palette.greenSoft,
    blue: palette.blueSoft,
    yellow: palette.yellowSoft,
    red: palette.redSoft,
  } as const;

  const textMap = {
    green: palette.primary2,
    blue: palette.info,
    yellow: palette.warning,
    red: palette.danger,
  } as const;

  return (
    <View style={[styles.heroStat, { backgroundColor: bgMap[tone] }]}>
      <Text style={[styles.heroStatValue, { color: textMap[tone] }]}>{value}</Text>
      <Text style={styles.heroStatLabel}>{label}</Text>
    </View>
  );
}

export default function UploadFoodCsvScreen() {
  const [fileName, setFileName] = useState<string>('');
  const [rawRows, setRawRows] = useState<CsvProductRow[]>([]);
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [missingColumns, setMissingColumns] = useState<string[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [isPicking, setIsPicking] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const previewRows = useMemo(() => parsedRows.slice(0, 8), [parsedRows]);

  const stats = useMemo(() => {
    const total = parsedRows.length;
    const lowStock = parsedRows.filter(
      (r) => r.stock_quantity <= r.min_stock_level
    ).length;
    const nearExpiry = parsedRows.filter((r) => {
      const d = daysUntil(r.expiry_date);
      return d !== null && d >= 0 && d <= 7;
    }).length;
    const weakMargin = parsedRows.filter(
      (r) => marginPercent(r.selling_price, r.cost_price) < 15
    ).length;

    return { total, lowStock, nearExpiry, weakMargin };
  }, [parsedRows]);

  const pickCsv = async () => {
    try {
      setIsPicking(true);
      setErrors([]);
      setMissingColumns([]);

      const result = await DocumentPicker.getDocumentAsync({
        type: ['text/csv', 'text/comma-separated-values', 'application/vnd.ms-excel'],
        copyToCacheDirectory: true,
        multiple: false,
      });

      if (result.canceled) {
        setIsPicking(false);
        return;
      }

      const asset = result.assets?.[0];
      if (!asset) {
        setIsPicking(false);
        return;
      }

      setFileName(asset.name || 'products.csv');

      let textContent = '';

      if (asset.uri.startsWith('file://')) {
        const response = await fetch(asset.uri);
        textContent = await response.text();
      } else if (Platform.OS === 'web' && asset.file) {
        textContent = await asset.file.text();
      } else {
        const response = await fetch(asset.uri);
        textContent = await response.text();
      }

      Papa.parse<CsvProductRow>(textContent, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          const incomingHeaders = (results.meta.fields || []).map(normalizeHeader);
          setHeaders(incomingHeaders);

          const missing = REQUIRED_COLUMNS.filter(
            (col) => !incomingHeaders.includes(col)
          );
          setMissingColumns(missing);

          const parseErrors: string[] = [];
          const cleanedRows: ParsedRow[] = [];

          if (missing.length > 0) {
            setErrors([
              `Missing required columns: ${missing.join(', ')}`,
            ]);
            setRawRows([]);
            setParsedRows([]);
            return;
          }

          const originalRows = results.data || [];
          setRawRows(originalRows);

          originalRows.forEach((row, index) => {
            const normalizedRow: ParsedRow = {
              name: safeString(row.name),
              category: safeString(row.category) || null,
              sku: safeString(row.sku) || null,
              barcode: safeString(row.barcode) || null,
              stock_quantity: safeNumber(row.stock_quantity),
              min_stock_level: safeNumber(row.min_stock_level),
              selling_price: safeNumber(row.selling_price),
              cost_price: safeNumber(row.cost_price),
              expiry_date: normalizeDate(row.expiry_date),
              supplier_name: safeString(row.supplier_name) || null,
            };

            if (!normalizedRow.name) {
              parseErrors.push(`Row ${index + 2}: name is required.`);
              return;
            }

            if (normalizedRow.selling_price < 0 || normalizedRow.cost_price < 0) {
              parseErrors.push(`Row ${index + 2}: prices cannot be negative.`);
              return;
            }

            if (normalizedRow.stock_quantity < 0 || normalizedRow.min_stock_level < 0) {
              parseErrors.push(`Row ${index + 2}: stock values cannot be negative.`);
              return;
            }

            cleanedRows.push(normalizedRow);
          });

          setErrors(parseErrors);
          setParsedRows(cleanedRows);
        },
        error: (error: Error) => {
  setErrors([error.message || 'Failed to parse CSV file.']);
  setRawRows([]);
  setParsedRows([]);
},
      });
    } catch (error: any) {
      setErrors([error?.message || 'Failed to open CSV file.']);
    } finally {
      setIsPicking(false);
    }
  };

  const resetAll = () => {
    setFileName('');
    setRawRows([]);
    setParsedRows([]);
    setHeaders([]);
    setMissingColumns([]);
    setErrors([]);
  };

  const uploadToSupabase = async () => {
    try {
      if (parsedRows.length === 0) {
        Alert.alert('No valid rows', 'Please select a valid CSV file first.');
        return;
      }

      if (errors.length > 0) {
        Alert.alert('Fix CSV issues', 'Please resolve the row errors before uploading.');
        return;
      }

      setIsUploading(true);
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError) throw authError;
      if (!user) {
        Alert.alert('Authentication required', 'Please log in again.');
        return;
      }

      const productPayload = parsedRows.map((row) => ({
        user_id: user.id,
        name: row.name,
        category: row.category,
        sku: row.sku,
        barcode: row.barcode,
        stock_quantity: row.stock_quantity,
        min_stock_level: row.min_stock_level,
        selling_price: row.selling_price,
        cost_price: row.cost_price,
        expiry_date: row.expiry_date,
        supplier_name: row.supplier_name,
        status: 'active',
      }));

      const { data: insertedProducts, error: productError } = await supabase
        .from('food_products')
        .insert(productPayload)
        .select('id, name, category, sku, barcode, stock_quantity, min_stock_level, selling_price, cost_price, expiry_date, supplier_name');

      if (productError) throw productError;

      const allAlerts: any[] = [];
      const allRecommendations: any[] = [];

      (insertedProducts || []).forEach((product) => {
        const row: ParsedRow = {
          name: product.name,
          category: product.category,
          sku: product.sku,
          barcode: product.barcode,
          stock_quantity: product.stock_quantity,
          min_stock_level: product.min_stock_level,
          selling_price: Number(product.selling_price || 0),
          cost_price: Number(product.cost_price || 0),
          expiry_date: product.expiry_date,
          supplier_name: product.supplier_name,
        };

        allAlerts.push(...buildAlertsForRow(row, product.id, user.id));
        allRecommendations.push(...buildRecommendationsForRow(row, product.id, user.id));
      });

      if (allAlerts.length > 0) {
        const { error: alertsError } = await supabase
          .from('food_alerts')
          .insert(allAlerts);
        if (alertsError) throw alertsError;
      }

      if (allRecommendations.length > 0) {
        const { error: recommendationsError } = await supabase
          .from('food_recommendations')
          .insert(allRecommendations);
        if (recommendationsError) throw recommendationsError;
      }

      const { error: logError } = await supabase
        .from('food_import_logs')
        .insert({
          user_id: user.id,
          file_name: fileName || 'products.csv',
          row_count: parsedRows.length,
          status: 'completed',
          notes: `Imported ${parsedRows.length} rows, generated ${allAlerts.length} alerts and ${allRecommendations.length} recommendations.`,
        });

      if (logError) throw logError;

      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      Alert.alert(
        'Upload completed',
        `Inserted ${parsedRows.length} products, ${allAlerts.length} alerts, and ${allRecommendations.length} recommendations.`,
        [
          {
            text: 'Open Dashboard',
            onPress: () => router.push('/(tabs)'),
          },
          {
            text: 'Stay here',
            style: 'cancel',
          },
        ]
      );

      resetAll();
    } catch (error: any) {
      Alert.alert('Upload failed', error?.message || 'Something went wrong while uploading.');
    } finally {
      setIsUploading(false);
    }
  };

  const csvTemplate = `name,category,sku,barcode,stock_quantity,min_stock_level,selling_price,cost_price,expiry_date,supplier_name
Fresh Milk 1L,Dairy,DAIRY-001,100000000001,18,10,1.59,1.05,2026-04-22,Kos Dairy
Greek Yogurt 500g,Dairy,DAIRY-002,100000000002,11,8,2.49,1.60,2026-04-21,Kos Dairy
White Bread 500g,Bakery,BAKE-001,100000000004,4,10,0.79,0.45,2026-04-19,Urban Bakery`;

  return (
    <SafeAreaView style={styles.safeArea}>
      <LinearGradient colors={[palette.bg, palette.bg2, palette.bg3]} style={styles.container}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <LinearGradient
            colors={['#E7FFF1', '#D9FCE7', '#F6FFF9']}
            style={styles.heroCard}
          >
            <View style={styles.heroTopRow}>
              <View style={styles.heroIcon}>
                <Ionicons name="cloud-upload-outline" size={22} color={palette.primary2} />
              </View>

              <TouchableOpacity
                style={styles.headerButton}
                onPress={() => router.push('/(tabs)')}
              >
                <Ionicons name="arrow-back-outline" size={20} color={palette.primary2} />
              </TouchableOpacity>
            </View>

            <Text style={styles.heroTitle}>Upload food products CSV</Text>
            <Text style={styles.heroSubtitle}>
              Import your product inventory into Supabase and automatically generate alerts and business recommendations.
            </Text>

            <View style={styles.heroStatsRow}>
              <HeroStat label="Rows ready" value={`${stats.total}`} tone="green" />
              <HeroStat label="Low stock" value={`${stats.lowStock}`} tone="yellow" />
              <HeroStat label="Near expiry" value={`${stats.nearExpiry}`} tone="red" />
              <HeroStat label="Weak margin" value={`${stats.weakMargin}`} tone="blue" />
            </View>
          </LinearGradient>

          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Step 1 — Choose a CSV file</Text>
            <Text style={styles.sectionSubtitle}>
              Required columns: {REQUIRED_COLUMNS.join(', ')}
            </Text>

            <TouchableOpacity
              style={styles.primaryButton}
              onPress={pickCsv}
              activeOpacity={0.9}
              disabled={isPicking}
            >
              <LinearGradient
                colors={[palette.primary, palette.primary2]}
                style={styles.primaryButtonGradient}
              >
                {isPicking ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Ionicons name="document-attach-outline" size={18} color="#fff" />
                    <Text style={styles.primaryButtonText}>Choose CSV</Text>
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>

            {fileName ? (
              <View style={styles.fileCard}>
                <View style={styles.fileCardLeft}>
                  <View style={styles.fileIconWrap}>
                    <MaterialCommunityIcons name="file-delimited-outline" size={22} color={palette.success} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.fileName}>{fileName}</Text>
                    <Text style={styles.fileMeta}>
                      {rawRows.length} raw rows • {parsedRows.length} valid rows
                    </Text>
                  </View>
                </View>

                <TouchableOpacity onPress={resetAll}>
                  <Ionicons name="trash-outline" size={20} color={palette.danger} />
                </TouchableOpacity>
              </View>
            ) : null}
          </View>

          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>CSV template example</Text>
            <Text style={styles.sectionSubtitle}>
              Copy this exact structure for your imports.
            </Text>

            <View style={styles.templateBox}>
              <Text style={styles.templateText}>{csvTemplate}</Text>
            </View>
          </View>

          {headers.length > 0 ? (
            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>Detected columns</Text>
              <View style={styles.chipsWrap}>
                {headers.map((header) => (
                  <View key={header} style={styles.chip}>
                    <Text style={styles.chipText}>{header}</Text>
                  </View>
                ))}
              </View>
            </View>
          ) : null}

          {missingColumns.length > 0 ? (
            <View style={[styles.sectionCard, styles.errorCard]}>
              <Text style={styles.errorTitle}>Missing required columns</Text>
              {missingColumns.map((col) => (
                <Text key={col} style={styles.errorLine}>• {col}</Text>
              ))}
            </View>
          ) : null}

          {errors.length > 0 ? (
            <View style={[styles.sectionCard, styles.errorCard]}>
              <Text style={styles.errorTitle}>CSV row issues</Text>
              {errors.slice(0, 12).map((err, index) => (
                <Text key={`${err}-${index}`} style={styles.errorLine}>• {err}</Text>
              ))}
              {errors.length > 12 ? (
                <Text style={styles.errorLine}>• And {errors.length - 12} more...</Text>
              ) : null}
            </View>
          ) : null}

          {previewRows.length > 0 ? (
            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>Preview</Text>
              <Text style={styles.sectionSubtitle}>
                First valid rows that will be inserted into Supabase.
              </Text>

              <View style={styles.previewList}>
                {previewRows.map((row, index) => {
                  const margin = marginPercent(row.selling_price, row.cost_price);
                  const expiryDays = daysUntil(row.expiry_date);

                  return (
                    <View key={`${row.name}-${index}`} style={styles.previewCard}>
                      <View style={styles.previewTop}>
                        <View style={styles.previewIconWrap}>
                          <MaterialCommunityIcons name="food-outline" size={18} color={palette.primary2} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.previewName}>{row.name}</Text>
                          <Text style={styles.previewMeta}>
                            {row.category || 'General'} • Supplier: {row.supplier_name || 'N/A'}
                          </Text>
                        </View>
                      </View>

                      <View style={styles.previewStats}>
                        <View style={styles.previewStat}>
                          <Text style={styles.previewStatValue}>{row.stock_quantity}</Text>
                          <Text style={styles.previewStatLabel}>Stock</Text>
                        </View>
                        <View style={styles.previewStat}>
                          <Text style={styles.previewStatValue}>{row.min_stock_level}</Text>
                          <Text style={styles.previewStatLabel}>Min</Text>
                        </View>
                        <View style={styles.previewStat}>
                          <Text style={styles.previewStatValue}>€{row.selling_price.toFixed(2)}</Text>
                          <Text style={styles.previewStatLabel}>Sell</Text>
                        </View>
                        <View style={styles.previewStat}>
                          <Text style={styles.previewStatValue}>{margin.toFixed(0)}%</Text>
                          <Text style={styles.previewStatLabel}>Margin</Text>
                        </View>
                        <View style={styles.previewStat}>
                          <Text style={styles.previewStatValue}>
                            {expiryDays === null ? '—' : `${expiryDays}d`}
                          </Text>
                          <Text style={styles.previewStatLabel}>Expiry</Text>
                        </View>
                      </View>
                    </View>
                  );
                })}
              </View>
            </View>
          ) : null}

          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Step 2 — Upload into Supabase</Text>
            <Text style={styles.sectionSubtitle}>
              This will insert products and automatically create alerts and recommendations.
            </Text>

            <TouchableOpacity
              style={[
                styles.uploadButton,
                (parsedRows.length === 0 || errors.length > 0 || isUploading) && styles.uploadButtonDisabled,
              ]}
              onPress={uploadToSupabase}
              activeOpacity={0.9}
              disabled={parsedRows.length === 0 || errors.length > 0 || isUploading}
            >
              {isUploading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Ionicons name="cloud-done-outline" size={18} color="#fff" />
                  <Text style={styles.uploadButtonText}>Upload to Supabase</Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          <View style={{ height: 30 }} />
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
    marginBottom: 20,
  },
  heroTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  heroIcon: {
    width: 50,
    height: 50,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: palette.borderStrong,
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
  heroTitle: {
    marginTop: 18,
    color: palette.text,
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '900',
  },
  heroSubtitle: {
    marginTop: 10,
    color: palette.textMuted,
    fontSize: 14,
    lineHeight: 22,
    fontWeight: '500',
  },
  heroStatsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 18,
  },
  heroStat: {
    borderRadius: 18,
    padding: 14,
    minWidth: '47%',
  },
  heroStatValue: {
    fontSize: 22,
    fontWeight: '900',
    marginBottom: 4,
  },
  heroStatLabel: {
    color: palette.textSoft,
    fontSize: 12,
    fontWeight: '700',
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
    marginBottom: 6,
  },
  sectionSubtitle: {
    color: palette.textMuted,
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 16,
    fontWeight: '500',
  },

  primaryButton: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  primaryButtonGradient: {
    minHeight: 54,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '800',
  },

  fileCard: {
    marginTop: 16,
    borderRadius: 18,
    padding: 14,
    backgroundColor: palette.cardSoft,
    borderWidth: 1,
    borderColor: palette.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  fileCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    paddingRight: 12,
  },
  fileIconWrap: {
    width: 46,
    height: 46,
    borderRadius: 16,
    backgroundColor: palette.greenSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  fileName: {
    color: palette.text,
    fontSize: 14,
    fontWeight: '900',
    marginBottom: 4,
  },
  fileMeta: {
    color: palette.textMuted,
    fontSize: 12,
    fontWeight: '600',
  },

  templateBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: palette.border,
  },
  templateText: {
    color: palette.textSoft,
    fontSize: 12,
    lineHeight: 18,
    fontFamily: Platform.select({
      ios: 'Menlo',
      android: 'monospace',
      web: 'monospace',
      default: 'monospace',
    }),
  },

  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    backgroundColor: palette.greenSoft,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  chipText: {
    color: palette.primary2,
    fontSize: 12,
    fontWeight: '800',
  },

  errorCard: {
    borderColor: '#FFD3D3',
    backgroundColor: palette.redSoft,
  },
  errorTitle: {
    color: palette.danger,
    fontSize: 16,
    fontWeight: '900',
    marginBottom: 10,
  },
  errorLine: {
    color: '#991B1B',
    fontSize: 13,
    lineHeight: 20,
    marginBottom: 4,
    fontWeight: '600',
  },

  previewList: {
    gap: 12,
  },
  previewCard: {
    borderRadius: 18,
    padding: 14,
    backgroundColor: palette.cardSoft,
    borderWidth: 1,
    borderColor: palette.border,
  },
  previewTop: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  previewIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: palette.greenSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  previewName: {
    color: palette.text,
    fontSize: 14,
    fontWeight: '900',
    marginBottom: 4,
  },
  previewMeta: {
    color: palette.textMuted,
    fontSize: 12,
    fontWeight: '600',
  },
  previewStats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  previewStat: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minWidth: 70,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: palette.border,
  },
  previewStatValue: {
    color: palette.text,
    fontSize: 13,
    fontWeight: '900',
    marginBottom: 4,
  },
  previewStatLabel: {
    color: palette.textMuted,
    fontSize: 11,
    fontWeight: '700',
  },

  uploadButton: {
    minHeight: 56,
    borderRadius: 16,
    backgroundColor: palette.primary2,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  uploadButtonDisabled: {
    opacity: 0.5,
  },
  uploadButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '900',
  },
});