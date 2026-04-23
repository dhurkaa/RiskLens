import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as DocumentPicker from 'expo-document-picker';
import { Ionicons, MaterialCommunityIcons, Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
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

  redSoft: '#FFF1F1',
  yellowSoft: '#FFF8E8',
  greenSoft: '#EDF8F0',
  blueSoft: '#EDF3FF',
};

const REQUIRED_COLUMNS = [
  'name',
  'stock_quantity',
  'min_stock_level',
  'cost_price',
  'expiry_date',
  'supplier_name',
];

const OPTIONAL_COLUMNS = [
  'category',
  'sku',
  'barcode',
  'selling_price',
  'status',
];

const csvTemplate = `name,category,sku,barcode,stock_quantity,min_stock_level,cost_price,selling_price,expiry_date,supplier_name,status
Milk 1L,Dairy,MLK-001,1234567890123,25,10,0.80,1.20,2026-05-03,DairyFresh,active
Bread White,Bakery,BRD-010,2234567890123,12,8,0.45,0.90,2026-04-26,BakeHouse,active
Apple Juice 1L,Drinks,AJ-100,3234567890123,7,12,0.95,1.45,2026-05-10,FruitCo,active`;

type ParsedRow = {
  name: string;
  category: string;
  sku: string;
  barcode: string;
  stock_quantity: number;
  min_stock_level: number;
  cost_price: number;
  selling_price: number;
  expiry_date: string;
  supplier_name: string;
  status: string;
};

type FoodAlertInsert = {
  user_id: string;
  title: string;
  description: string;
  severity: 'low' | 'medium' | 'high';
  created_at: string;
};

type FoodRecommendationInsert = {
  user_id: string;
  product_name: string;
  recommendation_type: 'discount' | 'restock' | 'price_up' | 'price_down';
  message: string;
  impact_value: number;
  created_at: string;
};

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    const next = line[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  result.push(current.trim());
  return result.map((cell) => cell.replace(/^"(.*)"$/, '$1').trim());
}

function safeNumber(value: string | number | null | undefined): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  const parsed = Number(String(value ?? '').trim());
  return Number.isFinite(parsed) ? parsed : 0;
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

function marginPercent(selling?: number | null, cost?: number | null) {
  const s = safeNumber(selling);
  const c = safeNumber(cost);
  if (s <= 0) return 0;
  return ((s - c) / s) * 100;
}

function normalizeRow(
  row: Record<string, string>,
  rowIndex: number,
  errors: string[]
): ParsedRow | null {
  const name = row.name?.trim() || '';
  const category = row.category?.trim() || 'Uncategorized';
  const sku = row.sku?.trim() || '';
  const barcode = row.barcode?.trim() || '';
  const supplier_name = row.supplier_name?.trim() || '';
  const status = row.status?.trim() || 'active';

  const stock_quantity = safeNumber(row.stock_quantity);
  const min_stock_level = safeNumber(row.min_stock_level);
  const cost_price = safeNumber(row.cost_price);
  const selling_price = row.selling_price?.trim()
    ? safeNumber(row.selling_price)
    : Number((cost_price * 1.35).toFixed(2));

  const expiry_date = row.expiry_date?.trim() || '';

  if (!name) {
    errors.push(`Row ${rowIndex}: missing product name`);
    return null;
  }

  if (!supplier_name) {
    errors.push(`Row ${rowIndex}: missing supplier_name`);
    return null;
  }

  if (!expiry_date || Number.isNaN(new Date(expiry_date).getTime())) {
    errors.push(`Row ${rowIndex}: invalid expiry_date`);
    return null;
  }

  if (stock_quantity < 0) {
    errors.push(`Row ${rowIndex}: stock_quantity cannot be negative`);
    return null;
  }

  if (min_stock_level < 0) {
    errors.push(`Row ${rowIndex}: min_stock_level cannot be negative`);
    return null;
  }

  if (cost_price < 0) {
    errors.push(`Row ${rowIndex}: cost_price cannot be negative`);
    return null;
  }

  if (selling_price < 0) {
    errors.push(`Row ${rowIndex}: selling_price cannot be negative`);
    return null;
  }

  return {
    name,
    category,
    sku,
    barcode,
    stock_quantity,
    min_stock_level,
    cost_price,
    selling_price,
    expiry_date,
    supplier_name,
    status,
  };
}

function buildAlertsForRow(row: ParsedRow): FoodAlertInsert[] {
  const alerts: FoodAlertInsert[] = [];
  const now = new Date().toISOString();
  const expiryDays = daysUntil(row.expiry_date);
  const margin = marginPercent(row.selling_price, row.cost_price);

  if (row.stock_quantity <= 0) {
    alerts.push({
      user_id: '',
      title: `${row.name} is out of stock`,
      description: `The product is unavailable and should be reordered immediately.`,
      severity: 'high',
      created_at: now,
    });
  } else if (row.stock_quantity <= row.min_stock_level) {
    alerts.push({
      user_id: '',
      title: `${row.name} is low in stock`,
      description: `Current stock (${row.stock_quantity}) is at or below minimum level (${row.min_stock_level}).`,
      severity: row.stock_quantity <= Math.max(1, Math.floor(row.min_stock_level / 2)) ? 'high' : 'medium',
      created_at: now,
    });
  }

  if (expiryDays !== null) {
    if (expiryDays < 0) {
      alerts.push({
        user_id: '',
        title: `${row.name} is expired`,
        description: `This product expired ${Math.abs(expiryDays)} day(s) ago.`,
        severity: 'high',
        created_at: now,
      });
    } else if (expiryDays <= 2) {
      alerts.push({
        user_id: '',
        title: `${row.name} expires very soon`,
        description: `This product expires in ${expiryDays} day(s).`,
        severity: 'high',
        created_at: now,
      });
    } else if (expiryDays <= 7) {
      alerts.push({
        user_id: '',
        title: `${row.name} is near expiry`,
        description: `This product expires in ${expiryDays} day(s).`,
        severity: 'medium',
        created_at: now,
      });
    }
  }

  if (margin < 10) {
    alerts.push({
      user_id: '',
      title: `${row.name} has weak margin`,
      description: `The product margin is only ${margin.toFixed(0)}%, which is very low.`,
      severity: 'medium',
      created_at: now,
    });
  }

  if (!row.barcode || !row.sku) {
    alerts.push({
      user_id: '',
      title: `${row.name} has incomplete product data`,
      description: `Missing ${!row.barcode ? 'barcode' : ''}${!row.barcode && !row.sku ? ' and ' : ''}${!row.sku ? 'sku' : ''}.`,
      severity: 'low',
      created_at: now,
    });
  }

  return alerts;
}

function buildRecommendationsForRow(row: ParsedRow): FoodRecommendationInsert[] {
  const recommendations: FoodRecommendationInsert[] = [];
  const now = new Date().toISOString();
  const expiryDays = daysUntil(row.expiry_date);
  const margin = marginPercent(row.selling_price, row.cost_price);

  if (expiryDays !== null && expiryDays >= 0 && expiryDays <= 5 && row.stock_quantity > 0) {
    const impact = Number((row.stock_quantity * row.cost_price).toFixed(2));
    recommendations.push({
      user_id: '',
      product_name: row.name,
      recommendation_type: 'discount',
      message: `Apply a short-term discount to reduce waste before expiry.`,
      impact_value: impact,
      created_at: now,
    });
  }

  if (row.stock_quantity <= row.min_stock_level && row.stock_quantity >= 0) {
    const estimatedRecovery = Number((Math.max(row.min_stock_level * 2, 10) * row.selling_price).toFixed(2));
    recommendations.push({
      user_id: '',
      product_name: row.name,
      recommendation_type: 'restock',
      message: `Restock this product soon to avoid lost sales.`,
      impact_value: estimatedRecovery,
      created_at: now,
    });
  }

  if (margin < 12 && row.selling_price > 0) {
    const uplift = Number((row.selling_price * 0.08 * Math.max(row.stock_quantity, 1)).toFixed(2));
    recommendations.push({
      user_id: '',
      product_name: row.name,
      recommendation_type: 'price_up',
      message: `Review pricing upward because margin is weaker than target.`,
      impact_value: uplift,
      created_at: now,
    });
  }

  if (expiryDays !== null && expiryDays <= 3 && row.stock_quantity >= 6) {
    const rescue = Number((row.stock_quantity * row.selling_price * 0.45).toFixed(2));
    recommendations.push({
      user_id: '',
      product_name: row.name,
      recommendation_type: 'price_down',
      message: `Lower price aggressively to clear stock before expiry.`,
      impact_value: rescue,
      created_at: now,
    });
  }

  return recommendations;
}

export default function UploadScreen() {
  const [fileName, setFileName] = useState('');
  const [csvText, setCsvText] = useState('');
  const [headers, setHeaders] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<Record<string, string>[]>([]);
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [isPicking, setIsPicking] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const missingColumns = useMemo(
    () => REQUIRED_COLUMNS.filter((col) => !headers.includes(col)),
    [headers]
  );

  const previewRows = useMemo(() => parsedRows.slice(0, 8), [parsedRows]);

  const stats = useMemo(() => {
    const total = parsedRows.length;
    const lowStock = parsedRows.filter((row) => row.stock_quantity <= row.min_stock_level).length;
    const nearExpiry = parsedRows.filter((row) => {
      const d = daysUntil(row.expiry_date);
      return d !== null && d >= 0 && d <= 7;
    }).length;
    const weakMargin = parsedRows.filter(
      (row) => marginPercent(row.selling_price, row.cost_price) < 15
    ).length;

    return { total, lowStock, nearExpiry, weakMargin };
  }, [parsedRows]);

  const resetAll = () => {
    setFileName('');
    setCsvText('');
    setHeaders([]);
    setRawRows([]);
    setParsedRows([]);
    setErrors([]);
  };

  const parseCsvText = (text: string) => {
    const clean = text.replace(/\r/g, '').trim();

    if (!clean) {
      setHeaders([]);
      setRawRows([]);
      setParsedRows([]);
      setErrors(['CSV file is empty']);
      return;
    }

    const lines = clean
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);

    if (lines.length < 2) {
      setHeaders([]);
      setRawRows([]);
      setParsedRows([]);
      setErrors(['CSV must contain at least one header row and one data row']);
      return;
    }

    const headerRow = parseCsvLine(lines[0]).map((h) => h.trim().toLowerCase());
    const uniqueHeaders = [...headerRow];

    setHeaders(uniqueHeaders);

    const nextRawRows: Record<string, string>[] = [];
    const nextParsedRows: ParsedRow[] = [];
    const nextErrors: string[] = [];

    for (let i = 1; i < lines.length; i += 1) {
      const values = parseCsvLine(lines[i]);
      const rowObj: Record<string, string> = {};

      uniqueHeaders.forEach((header, index) => {
        rowObj[header] = values[index] ?? '';
      });

      nextRawRows.push(rowObj);

      if (REQUIRED_COLUMNS.every((col) => headerRow.includes(col))) {
        const normalized = normalizeRow(rowObj, i + 1, nextErrors);
        if (normalized) nextParsedRows.push(normalized);
      }
    }

    setRawRows(nextRawRows);
    setParsedRows(nextParsedRows);
    setErrors(nextErrors);
  };

  const pickCsv = async () => {
    try {
      setIsPicking(true);

      const result = await DocumentPicker.getDocumentAsync({
        type: ['text/csv', 'text/comma-separated-values', 'application/vnd.ms-excel'],
        copyToCacheDirectory: true,
        multiple: false,
      });

      if (result.canceled || !result.assets?.length) return;

      const asset = result.assets[0];
      setFileName(asset.name || 'selected-file.csv');

      const response = await fetch(asset.uri);
      const text = await response.text();

      setCsvText(text);
      parseCsvText(text);
    } catch (error: any) {
      Alert.alert('CSV Error', error?.message || 'Failed to open CSV file.');
    } finally {
      setIsPicking(false);
    }
  };

  const handleUpload = async () => {
    if (!parsedRows.length) {
      Alert.alert('No data', 'Please choose a valid CSV file first.');
      return;
    }

    if (missingColumns.length > 0) {
      Alert.alert(
        'Missing columns',
        `Your CSV is missing: ${missingColumns.join(', ')}`
      );
      return;
    }

    try {
      setIsUploading(true);

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) throw userError;
      if (!user) {
        router.replace('/login');
        return;
      }

      const productRows = parsedRows.map((row) => ({
        user_id: user.id,
        name: row.name,
        category: row.category,
        sku: row.sku || null,
        barcode: row.barcode || null,
        stock_quantity: row.stock_quantity,
        min_stock_level: row.min_stock_level,
        cost_price: row.cost_price,
        selling_price: row.selling_price,
        expiry_date: row.expiry_date,
        supplier_name: row.supplier_name,
        status: row.status || 'active',
      }));

      const { error: productError } = await supabase
        .from('food_products')
        .insert(productRows);

      if (productError) throw productError;

      const alertRows: FoodAlertInsert[] = [];
      const recommendationRows: FoodRecommendationInsert[] = [];

      parsedRows.forEach((row) => {
        buildAlertsForRow(row).forEach((alert) => {
          alertRows.push({ ...alert, user_id: user.id });
        });

        buildRecommendationsForRow(row).forEach((recommendation) => {
          recommendationRows.push({ ...recommendation, user_id: user.id });
        });
      });

      if (alertRows.length > 0) {
        const { error: alertError } = await supabase.from('food_alerts').insert(alertRows);
        if (alertError) throw alertError;
      }

      if (recommendationRows.length > 0) {
        const { error: recommendationError } = await supabase
          .from('food_recommendations')
          .insert(recommendationRows);

        if (recommendationError) throw recommendationError;
      }

      Alert.alert(
        'Upload successful',
        `${parsedRows.length} products uploaded\n${alertRows.length} alerts generated\n${recommendationRows.length} recommendations generated`,
        [
          { text: 'Stay here' },
          {
            text: 'Open Dashboard',
            onPress: () => router.push('/(tabs)'),
          },
        ]
      );
    } catch (error: any) {
      Alert.alert('Upload failed', error?.message || 'Something went wrong during upload.');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
  <View style={styles.pageWrap}>
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
        <LinearGradient
          colors={['#163728', '#1C4630', '#24583D']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.hero}
        >
          <View style={styles.heroTopRow}>
  <View style={styles.heroIdentity}>
    <TouchableOpacity
      style={styles.heroMenuButton}
      onPress={() => setSidebarOpen(true)}
    >
      <Ionicons name="menu-outline" size={20} color="#fff" />
    </TouchableOpacity>

    <View style={styles.heroIcon}>
      <Ionicons name="cloud-upload-outline" size={22} color="#fff" />
    </View>

    <View style={{ flex: 1 }}>
      <Text style={styles.heroEyebrow}>Import center</Text>
      <Text style={styles.heroTitle}>Upload food products CSV</Text>
    </View>
  </View>

  <TouchableOpacity
    style={styles.heroBackButton}
    onPress={() => router.push('/(tabs)')}
  >
    <Ionicons name="arrow-back-outline" size={20} color="#fff" />
  </TouchableOpacity>
</View>

          <Text style={styles.heroSubtitle}>
            Import your inventory into Supabase and automatically generate alerts,
            pricing signals, restock suggestions, and expiry intelligence.
          </Text>

          <View style={styles.heroStatsRow}>
            <View style={styles.heroStat}>
              <Text style={styles.heroStatValue}>{stats.total}</Text>
              <Text style={styles.heroStatLabel}>Rows ready</Text>
            </View>
            <View style={styles.heroStatDivider} />
            <View style={styles.heroStat}>
              <Text style={styles.heroStatValue}>{stats.lowStock}</Text>
              <Text style={styles.heroStatLabel}>Low stock</Text>
            </View>
            <View style={styles.heroStatDivider} />
            <View style={styles.heroStat}>
              <Text style={styles.heroStatValue}>{stats.nearExpiry}</Text>
              <Text style={styles.heroStatLabel}>Near expiry</Text>
            </View>
            <View style={styles.heroStatDivider} />
            <View style={styles.heroStat}>
              <Text style={styles.heroStatValue}>{stats.weakMargin}</Text>
              <Text style={styles.heroStatLabel}>Weak margin</Text>
            </View>
          </View>
        </LinearGradient>

        <View style={styles.commandBar}>
          <TouchableOpacity
            style={styles.commandPrimary}
            onPress={pickCsv}
            activeOpacity={0.9}
            disabled={isPicking}
          >
            <LinearGradient
              colors={[palette.primary, palette.primary2]}
              style={styles.commandPrimaryGradient}
            >
              {isPicking ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Ionicons name="document-attach-outline" size={18} color="#fff" />
                  <Text style={styles.commandPrimaryText}>Choose CSV</Text>
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.commandSecondary,
              (!parsedRows.length || missingColumns.length > 0 || isUploading) && styles.commandDisabled,
            ]}
            onPress={handleUpload}
            activeOpacity={0.9}
            disabled={!parsedRows.length || missingColumns.length > 0 || isUploading}
          >
            {isUploading ? (
              <ActivityIndicator color={palette.primary2} />
            ) : (
              <>
                <Ionicons name="cloud-upload-outline" size={18} color={palette.primary2} />
                <Text style={styles.commandSecondaryText}>Upload to Supabase</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {fileName ? (
          <View style={styles.fileSummaryCard}>
            <View style={styles.fileSummaryLeft}>
              <View style={styles.fileSummaryIcon}>
                <MaterialCommunityIcons
                  name="file-delimited-outline"
                  size={22}
                  color={palette.success}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.fileSummaryName}>{fileName}</Text>
                <Text style={styles.fileSummaryMeta}>
                  {rawRows.length} raw rows • {parsedRows.length} valid rows
                </Text>
              </View>
            </View>

            <TouchableOpacity onPress={resetAll} style={styles.fileDeleteButton}>
              <Ionicons name="trash-outline" size={20} color={palette.danger} />
            </TouchableOpacity>
          </View>
        ) : null}

        <View style={styles.gridTwo}>
          <View style={styles.panel}>
            <Text style={styles.panelEyebrow}>Step 1</Text>
            <Text style={styles.panelTitle}>Required structure</Text>
            <Text style={styles.panelSubtitle}>
              These columns must exist in every CSV import.
            </Text>

            <View style={styles.chipsWrap}>
              {REQUIRED_COLUMNS.map((col) => (
                <View key={col} style={styles.chip}>
                  <Text style={styles.chipText}>{col}</Text>
                </View>
              ))}
            </View>
          </View>

          <View style={styles.panel}>
            <Text style={styles.panelEyebrow}>Step 2</Text>
            <Text style={styles.panelTitle}>Template example</Text>
            <Text style={styles.panelSubtitle}>
              Keep this exact format for best results.
            </Text>

            <View style={styles.templateBox}>
              <Text style={styles.templateText}>{csvTemplate}</Text>
            </View>
          </View>
        </View>

        {headers.length > 0 ? (
          <View style={styles.panel}>
            <Text style={styles.panelEyebrow}>Detected</Text>
            <Text style={styles.panelTitle}>Detected columns</Text>
            <Text style={styles.panelSubtitle}>
              These are the columns found in your uploaded file.
            </Text>

            <View style={styles.chipsWrap}>
              {headers.map((header) => (
                <View key={header} style={styles.detectedChip}>
                  <Text style={styles.detectedChipText}>{header}</Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        {missingColumns.length > 0 ? (
          <View style={[styles.panel, styles.errorPanel]}>
            <Text style={styles.errorTitle}>Missing required columns</Text>
            {missingColumns.map((col) => (
              <Text key={col} style={styles.errorLine}>• {col}</Text>
            ))}
          </View>
        ) : null}

        {errors.length > 0 ? (
          <View style={[styles.panel, styles.errorPanel]}>
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
          <View style={styles.panel}>
            <View style={styles.previewHeader}>
              <View>
                <Text style={styles.panelEyebrow}>Preview</Text>
                <Text style={styles.panelTitle}>Rows that will be inserted</Text>
                <Text style={styles.panelSubtitle}>
                  First valid rows that will be uploaded and analyzed.
                </Text>
              </View>
            </View>

            <View style={styles.previewList}>
              {previewRows.map((row, index) => {
                const margin = marginPercent(row.selling_price, row.cost_price);
                const expiryDays = daysUntil(row.expiry_date);

                return (
                  <View key={`${row.name}-${index}`} style={styles.previewCard}>
                    <View style={styles.previewTop}>
                      <View style={styles.previewNameWrap}>
                        <Text style={styles.previewName}>{row.name}</Text>
                        <Text style={styles.previewCategory}>{row.category || 'Uncategorized'}</Text>
                      </View>
                      <Text style={styles.previewPrice}>€{row.selling_price.toFixed(2)}</Text>
                    </View>

                    <View style={styles.previewMetaRow}>
                      <View style={styles.previewMetaPill}>
                        <Text style={styles.previewMetaLabel}>Stock</Text>
                        <Text style={styles.previewMetaValue}>{row.stock_quantity}</Text>
                      </View>

                      <View style={styles.previewMetaPill}>
                        <Text style={styles.previewMetaLabel}>Min</Text>
                        <Text style={styles.previewMetaValue}>{row.min_stock_level}</Text>
                      </View>

                      <View style={styles.previewMetaPill}>
                        <Text style={styles.previewMetaLabel}>Margin</Text>
                        <Text
                          style={[
                            styles.previewMetaValue,
                            margin < 10
                              ? { color: palette.danger }
                              : margin < 20
                              ? { color: palette.warning }
                              : { color: palette.success },
                          ]}
                        >
                          {margin.toFixed(0)}%
                        </Text>
                      </View>

                      <View style={styles.previewMetaPill}>
                        <Text style={styles.previewMetaLabel}>Expiry</Text>
                        <Text
                          style={[
                            styles.previewMetaValue,
                            expiryDays !== null && expiryDays <= 2
                              ? { color: palette.danger }
                              : expiryDays !== null && expiryDays <= 7
                              ? { color: palette.warning }
                              : null,
                          ]}
                        >
                          {expiryDays === null ? '—' : `${expiryDays}d`}
                        </Text>
                      </View>
                    </View>

                    <Text style={styles.previewSupplier}>
                      Supplier: {row.supplier_name || 'Missing'}
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>
        ) : null}

              <View style={styles.bottomSpace} />
    </ScrollView>

    <AppSidebar
      visible={sidebarOpen}
      onClose={() => setSidebarOpen(false)}
      active="upload"
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
  pageWrap: {
  flex: 1,
  backgroundColor: palette.bg,
},
heroMenuButton: {
  width: 42,
  height: 42,
  borderRadius: 14,
  backgroundColor: 'rgba(255,255,255,0.12)',
  alignItems: 'center',
  justifyContent: 'center',
},
  scrollContent: {
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 24,
  },

  hero: {
    borderRadius: 30,
    padding: 20,
    marginBottom: 16,
  },
  heroTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  heroIdentity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
    paddingRight: 12,
  },
  heroIcon: {
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
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: -0.4,
  },
  heroSubtitle: {
    marginTop: 14,
    color: 'rgba(255,255,255,0.84)',
    fontSize: 14,
    lineHeight: 21,
    fontWeight: '500',
  },
  heroBackButton: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroStatsRow: {
    marginTop: 18,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.10)',
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 10,
  },
  heroStat: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroStatValue: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: -0.7,
    marginBottom: 4,
  },
  heroStatLabel: {
    color: 'rgba(255,255,255,0.72)',
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center',
  },
  heroStatDivider: {
    width: 1,
    height: 32,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },

  commandBar: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  commandPrimary: {
    flex: 1,
    borderRadius: 18,
    overflow: 'hidden',
  },
  commandPrimaryGradient: {
    minHeight: 54,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  commandPrimaryText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '900',
  },
  commandSecondary: {
    flex: 1,
    minHeight: 54,
    borderRadius: 18,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.border,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  commandSecondaryText: {
    color: palette.primary2,
    fontSize: 15,
    fontWeight: '900',
  },
  commandDisabled: {
    opacity: 0.5,
  },

  fileSummaryCard: {
    backgroundColor: palette.surface,
    borderRadius: 22,
    padding: 14,
    borderWidth: 1,
    borderColor: palette.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  fileSummaryLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
    paddingRight: 10,
  },
  fileSummaryIcon: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: palette.greenSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fileSummaryName: {
    color: palette.text,
    fontSize: 14,
    fontWeight: '900',
    marginBottom: 3,
  },
  fileSummaryMeta: {
    color: palette.textMuted,
    fontSize: 12,
    fontWeight: '600',
  },
  fileDeleteButton: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },

  gridTwo: {
    gap: 12,
    marginBottom: 12,
  },
  panel: {
    backgroundColor: palette.surface,
    borderRadius: 24,
    padding: 16,
    borderWidth: 1,
    borderColor: palette.border,
    marginBottom: 12,
  },
  panelEyebrow: {
    color: palette.primary2,
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  panelTitle: {
    color: palette.text,
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: -0.3,
  },
  panelSubtitle: {
    color: palette.textMuted,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 5,
    fontWeight: '500',
  },

  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 14,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: palette.surfaceSoft,
  },
  chipText: {
    color: palette.textSoft,
    fontSize: 12,
    fontWeight: '700',
  },
  detectedChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: palette.greenSoft,
  },
  detectedChipText: {
    color: palette.success,
    fontSize: 12,
    fontWeight: '800',
  },

  templateBox: {
    marginTop: 14,
    borderRadius: 18,
    backgroundColor: palette.surfaceSoft,
    padding: 14,
  },
  templateText: {
    color: palette.textSoft,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '600',
  },

  errorPanel: {
    backgroundColor: palette.redSoft,
    borderColor: '#F1CACA',
  },
  errorTitle: {
    color: palette.danger,
    fontSize: 15,
    fontWeight: '900',
    marginBottom: 8,
  },
  errorLine: {
    color: palette.textSoft,
    fontSize: 13,
    lineHeight: 20,
    fontWeight: '500',
    marginBottom: 3,
  },

  previewHeader: {
    marginBottom: 14,
  },
  previewList: {
    gap: 10,
  },
  previewCard: {
    backgroundColor: palette.surfaceSoft,
    borderRadius: 20,
    padding: 14,
  },
  previewTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 10,
  },
  previewNameWrap: {
    flex: 1,
  },
  previewName: {
    color: palette.text,
    fontSize: 14,
    fontWeight: '900',
    marginBottom: 3,
  },
  previewCategory: {
    color: palette.textMuted,
    fontSize: 12,
    fontWeight: '600',
  },
  previewPrice: {
    color: palette.primary2,
    fontSize: 14,
    fontWeight: '900',
  },
  previewMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 10,
  },
  previewMetaPill: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: palette.surface,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  previewMetaLabel: {
    color: palette.textMuted,
    fontSize: 11,
    fontWeight: '700',
  },
  previewMetaValue: {
    color: palette.text,
    fontSize: 11,
    fontWeight: '900',
  },
  previewSupplier: {
    color: palette.textSoft,
    fontSize: 12,
    fontWeight: '600',
  },

  bottomSpace: {
    height: 20,
  },
});