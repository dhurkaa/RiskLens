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
  RefreshControl,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { supabase } from '../../lib/supabase';

const palette = {
  bg: '#0B1016',
  bg2: '#101826',
  card: '#131C27',
  card2: '#182232',
  card3: '#1C293B',
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

const STORAGE_BUCKET = 'csv-uploads';
const MAX_FILE_SIZE_BYTES = 15 * 1024 * 1024;
const MAX_PREVIEW_ROWS = 8;
const MAX_PREVIEW_COLUMNS = 8;

type PickedFile = {
  name: string;
  uri: string;
  mimeType?: string | null;
  size?: number | null;
};

type ParsedCsv = {
  headers: string[];
  rows: string[][];
  totalRows: number;
  inferredColumns: string[];
};

type ValidationItem = {
  label: string;
  status: 'success' | 'warning' | 'danger';
  message: string;
};

function formatFileSize(bytes?: number | null) {
  if (!bytes || bytes <= 0) return '—';
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${bytes} B`;
}

function formatDateTime(date = new Date()) {
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function inferUsefulColumns(headers: string[]) {
  const patterns = [
    { key: 'product_name', keywords: ['product', 'item', 'name', 'sku'] },
    { key: 'category', keywords: ['category', 'group', 'segment'] },
    { key: 'price', keywords: ['price', 'amount', 'cost', 'value'] },
    { key: 'quantity', keywords: ['qty', 'quantity', 'units', 'volume'] },
    { key: 'date', keywords: ['date', 'created', 'time', 'period'] },
    { key: 'region', keywords: ['region', 'country', 'market', 'location'] },
  ];

  const normalized = headers.map((h) => h.trim().toLowerCase());

  return patterns
    .filter((p) => normalized.some((h) => p.keywords.some((k) => h.includes(k))))
    .map((p) => p.key);
}

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let insideQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const next = line[i + 1];

    if (char === '"') {
      if (insideQuotes && next === '"') {
        current += '"';
        i++;
      } else {
        insideQuotes = !insideQuotes;
      }
    } else if (char === ',' && !insideQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  result.push(current.trim());
  return result.map((item) => item.replace(/^"|"$/g, '').trim());
}

function parseCsvText(rawText: string): ParsedCsv {
  const cleaned = rawText
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  if (cleaned.length === 0) {
    throw new Error('The selected CSV file is empty.');
  }

  const headers = parseCsvLine(cleaned[0]);

  if (headers.length < 2) {
    throw new Error('CSV must contain at least 2 columns.');
  }

  const rows = cleaned.slice(1).map((line) => parseCsvLine(line));

  return {
    headers,
    rows: rows.slice(0, MAX_PREVIEW_ROWS),
    totalRows: rows.length,
    inferredColumns: inferUsefulColumns(headers),
  };
}

async function readFileAsText(uri: string): Promise<string> {
  const response = await fetch(uri);
  if (!response.ok) {
    throw new Error('Unable to read the selected file.');
  }
  return response.text();
}

async function readFileAsArrayBuffer(uri: string): Promise<ArrayBuffer> {
  const response = await fetch(uri);
  if (!response.ok) {
    throw new Error('Unable to read the selected file for upload.');
  }
  return response.arrayBuffer();
}

function buildValidation(file: PickedFile | null, parsed: ParsedCsv | null): ValidationItem[] {
  const items: ValidationItem[] = [];

  if (!file) {
    items.push({
      label: 'File selected',
      status: 'warning',
      message: 'No file selected yet.',
    });
    return items;
  }

  items.push({
    label: 'File type',
    status: file.name.toLowerCase().endsWith('.csv') ? 'success' : 'danger',
    message: file.name.toLowerCase().endsWith('.csv')
      ? 'Valid CSV file detected.'
      : 'The selected file does not appear to be a CSV.',
  });

  items.push({
    label: 'File size',
    status:
      (file.size || 0) > MAX_FILE_SIZE_BYTES
        ? 'danger'
        : (file.size || 0) > 8 * 1024 * 1024
        ? 'warning'
        : 'success',
    message:
      (file.size || 0) > MAX_FILE_SIZE_BYTES
        ? 'File is too large. Please keep it under 15 MB.'
        : `File size looks acceptable: ${formatFileSize(file.size)}.`,
  });

  if (parsed) {
    const duplicateHeaders =
      new Set(parsed.headers.map((h) => h.toLowerCase())).size !== parsed.headers.length;

    items.push({
      label: 'Columns detected',
      status: parsed.headers.length >= 3 ? 'success' : 'warning',
      message: `${parsed.headers.length} columns detected in this dataset.`,
    });

    items.push({
      label: 'Rows detected',
      status: parsed.totalRows > 0 ? 'success' : 'danger',
      message: `${parsed.totalRows} data rows available for analysis.`,
    });

    items.push({
      label: 'Header quality',
      status: duplicateHeaders ? 'warning' : 'success',
      message: duplicateHeaders
        ? 'Some column names appear to be duplicated.'
        : 'Column headers look unique.',
    });

    items.push({
      label: 'Business relevance',
      status: parsed.inferredColumns.length >= 2 ? 'success' : 'warning',
      message:
        parsed.inferredColumns.length >= 2
          ? `Recognized likely business columns: ${parsed.inferredColumns.join(', ')}.`
          : 'Only a few useful business columns were recognized automatically.',
    });
  }

  return items;
}

function statusColor(status: ValidationItem['status']) {
  if (status === 'success') return palette.success;
  if (status === 'warning') return palette.warning;
  return palette.danger;
}

function csvTemplateHeaders() {
  return ['product_name', 'category', 'price', 'quantity', 'sales_date', 'region'];
}

function PreviewTable({
  headers,
  rows,
}: {
  headers: string[];
  rows: string[][];
}) {
  const visibleHeaders = headers.slice(0, MAX_PREVIEW_COLUMNS);

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      <View style={styles.tableWrap}>
        <View style={styles.tableHeaderRow}>
          {visibleHeaders.map((header, index) => (
            <View key={`${header}-${index}`} style={styles.tableHeaderCell}>
              <Text style={styles.tableHeaderText} numberOfLines={1}>
                {header}
              </Text>
            </View>
          ))}
        </View>

        {rows.length > 0 ? (
          rows.map((row, rowIndex) => (
            <View
              key={`row-${rowIndex}`}
              style={[
                styles.tableDataRow,
                rowIndex % 2 === 0 ? styles.tableRowAlt : null,
              ]}
            >
              {visibleHeaders.map((_, cellIndex) => (
                <View key={`cell-${rowIndex}-${cellIndex}`} style={styles.tableDataCell}>
                  <Text style={styles.tableDataText} numberOfLines={2}>
                    {row[cellIndex] || '—'}
                  </Text>
                </View>
              ))}
            </View>
          ))
        ) : (
          <View style={styles.tableEmptyRow}>
            <Text style={styles.tableEmptyText}>No rows to preview.</Text>
          </View>
        )}
      </View>
    </ScrollView>
  );
}

export default function UploadCsvScreen() {
  const [selectedFile, setSelectedFile] = useState<PickedFile | null>(null);
  const [parsedCsv, setParsedCsv] = useState<ParsedCsv | null>(null);

  const [picking, setPicking] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const [lastUploadMessage, setLastUploadMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  const validations = useMemo(
    () => buildValidation(selectedFile, parsedCsv),
    [selectedFile, parsedCsv]
  );

  const canUpload = useMemo(() => {
    if (!selectedFile || !parsedCsv) return false;
    if (!selectedFile.name.toLowerCase().endsWith('.csv')) return false;
    if ((selectedFile.size || 0) > MAX_FILE_SIZE_BYTES) return false;
    if (parsedCsv.totalRows <= 0) return false;
    return true;
  }, [selectedFile, parsedCsv]);

  const resetState = () => {
    setSelectedFile(null);
    setParsedCsv(null);
    setLastUploadMessage(null);
  };

  const handlePickFile = async () => {
    try {
      setPicking(true);
      setLastUploadMessage(null);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

      const result = await DocumentPicker.getDocumentAsync({
        type: ['text/csv', 'text/comma-separated-values', 'application/vnd.ms-excel', '*/*'],
        copyToCacheDirectory: true,
        multiple: false,
      });

      if (result.canceled) return;

      const asset = result.assets?.[0];
      if (!asset) {
        throw new Error('No file was selected.');
      }

      const picked: PickedFile = {
        name: asset.name,
        uri: asset.uri,
        mimeType: asset.mimeType,
        size: asset.size,
      };

      setSelectedFile(picked);
      setParsedCsv(null);

      setAnalyzing(true);
      const text = await readFileAsText(asset.uri);
      const parsed = parseCsvText(text);
      setParsedCsv(parsed);

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setParsedCsv(null);
      setSelectedFile(null);

      Alert.alert(
        'CSV Error',
        error?.message || 'Unable to open and analyze this CSV file.'
      );
    } finally {
      setPicking(false);
      setAnalyzing(false);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile || !parsedCsv) {
      Alert.alert('Missing file', 'Please select and validate a CSV file first.');
      return;
    }

    if (!canUpload) {
      Alert.alert(
        'Upload blocked',
        'This file is not ready for upload. Please check the validation results first.'
      );
      return;
    }

    try {
      setUploading(true);
      setLastUploadMessage(null);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError) throw sessionError;

      const user = session?.user;

      if (!user) {
        Alert.alert('Login required', 'Please sign in first, then try uploading again.');
        router.replace('/login');
        return;
      }

      const fileExt = selectedFile.name.split('.').pop()?.toLowerCase() || 'csv';
      const safeName = selectedFile.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const storagePath = `${user.id}/${Date.now()}_${safeName}`;

      const arrayBuffer = await readFileAsArrayBuffer(selectedFile.uri);

      const { error: storageError } = await supabase.storage
        .from(STORAGE_BUCKET)
        .upload(storagePath, arrayBuffer, {
          contentType: selectedFile.mimeType || 'text/csv',
          upsert: false,
        });

      if (storageError) throw storageError;

      const { data: publicUrlData } = supabase.storage
        .from(STORAGE_BUCKET)
        .getPublicUrl(storagePath);

      const { error: insertError } = await supabase.from('uploads').insert({
        user_id: user.id,
        file_name: selectedFile.name,
        file_path: storagePath,
        file_url: publicUrlData?.publicUrl || null,
        file_type: fileExt,
        file_size: selectedFile.size || null,
        row_count: parsedCsv.totalRows,
        column_count: parsedCsv.headers.length,
        status: 'uploaded',
        uploaded_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        metadata: {
          headers: parsedCsv.headers,
          inferred_columns: parsedCsv.inferredColumns,
          preview_generated_at: new Date().toISOString(),
        },
      });

      if (insertError) throw insertError;

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      setLastUploadMessage({
        type: 'success',
        text: `CSV uploaded successfully on ${formatDateTime()}. Your dataset is now ready for analysis.`,
      });

      Alert.alert(
        'Upload successful',
        'Your CSV file has been uploaded successfully. You can now proceed to analysis.',
        [
          {
            text: 'Open dashboard',
            onPress: () => router.push('/(tabs)'),
          },
          {
            text: 'Stay here',
            style: 'cancel',
          },
        ]
      );
    } catch (error: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setLastUploadMessage({
        type: 'error',
        text:
          error?.message ||
          'Something went wrong while uploading your CSV file.',
      });
    } finally {
      setUploading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await new Promise((resolve) => setTimeout(resolve, 700));
    setRefreshing(false);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <LinearGradient
        colors={[palette.bg, palette.bg2]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.container}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        >
          <View style={styles.heroCard}>
            <LinearGradient
              colors={['rgba(59,130,246,0.18)', 'rgba(37,99,235,0.06)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.heroOverlay}
            />

            <View style={styles.heroTopRow}>
              <TouchableOpacity
                style={styles.iconGhostButton}
                onPress={() => router.back()}
              >
                <Ionicons name="arrow-back" size={18} color={palette.textSoft} />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.iconGhostButton}
                onPress={resetState}
              >
                <Ionicons name="refresh-outline" size={18} color={palette.textSoft} />
              </TouchableOpacity>
            </View>

            <View style={styles.heroBadge}>
              <Ionicons name="cloud-upload-outline" size={14} color={palette.primarySoft} />
              <Text style={styles.heroBadgeText}>CSV upload center</Text>
            </View>

            <Text style={styles.heroTitle}>Upload a dataset for analysis</Text>
            <Text style={styles.heroSubtitle}>
              Add a CSV file containing pricing, product, sales, or market data.
              RiskLens will validate the structure and prepare it for AI-powered
              analysis and reporting.
            </Text>

            <View style={styles.heroInfoRow}>
              <View style={styles.heroInfoItem}>
                <Text style={styles.heroInfoLabel}>Supported type</Text>
                <Text style={styles.heroInfoValue}>CSV</Text>
              </View>
              <View style={styles.heroInfoItem}>
                <Text style={styles.heroInfoLabel}>Max size</Text>
                <Text style={styles.heroInfoValue}>15 MB</Text>
              </View>
              <View style={styles.heroInfoItem}>
                <Text style={styles.heroInfoLabel}>Preview rows</Text>
                <Text style={styles.heroInfoValue}>8</Text>
              </View>
            </View>
          </View>

          <View style={styles.actionsBlock}>
            <TouchableOpacity
              style={styles.pickButton}
              onPress={handlePickFile}
              disabled={picking || analyzing || uploading}
              activeOpacity={0.9}
            >
              <LinearGradient
                colors={[palette.primary, palette.primary2]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.pickButtonInner}
              >
                {picking || analyzing ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <>
                    <Ionicons name="document-attach-outline" size={18} color="#FFFFFF" />
                    <Text style={styles.pickButtonText}>Choose CSV file</Text>
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.uploadButton,
                !canUpload || uploading ? styles.uploadButtonDisabled : null,
              ]}
              onPress={handleUpload}
              disabled={!canUpload || uploading}
              activeOpacity={0.9}
            >
              {uploading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <>
                  <Ionicons name="cloud-upload-outline" size={18} color="#FFFFFF" />
                  <Text style={styles.uploadButtonText}>Upload dataset</Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          {lastUploadMessage ? (
            <View
              style={[
                styles.messageCard,
                lastUploadMessage.type === 'success'
                  ? styles.messageSuccess
                  : styles.messageError,
              ]}
            >
              <Ionicons
                name={
                  lastUploadMessage.type === 'success'
                    ? 'checkmark-circle-outline'
                    : 'alert-circle-outline'
                }
                size={18}
                color={
                  lastUploadMessage.type === 'success'
                    ? palette.success
                    : palette.danger
                }
                style={{ marginRight: 8, marginTop: 2 }}
              />
              <Text
                style={[
                  styles.messageText,
                  {
                    color:
                      lastUploadMessage.type === 'success'
                        ? '#BBF7D0'
                        : '#FECACA',
                  },
                ]}
              >
                {lastUploadMessage.text}
              </Text>
            </View>
          ) : null}

          <View style={styles.card}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Selected file</Text>
              <Text style={styles.sectionSubtitle}>
                The current dataset prepared for upload
              </Text>
            </View>

            {selectedFile ? (
              <View style={styles.fileSummaryCard}>
                <View style={styles.fileIconWrap}>
                  <MaterialCommunityIcons
                    name="file-delimited-outline"
                    size={24}
                    color={palette.primarySoft}
                  />
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={styles.fileName} numberOfLines={1}>
                    {selectedFile.name}
                  </Text>
                  <Text style={styles.fileMeta}>
                    {formatFileSize(selectedFile.size)} •{' '}
                    {selectedFile.mimeType || 'text/csv'}
                  </Text>
                </View>
              </View>
            ) : (
              <View style={styles.emptyCard}>
                <Ionicons name="document-outline" size={22} color={palette.primarySoft} />
                <Text style={styles.emptyTitle}>No file selected</Text>
                <Text style={styles.emptySubtitle}>
                  Pick a CSV file to preview its structure and prepare it for upload.
                </Text>
              </View>
            )}
          </View>

          <View style={styles.card}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Validation checks</Text>
              <Text style={styles.sectionSubtitle}>
                Quick quality checks before upload
              </Text>
            </View>

            <View style={styles.validationList}>
              {validations.map((item, index) => (
                <View key={`${item.label}-${index}`} style={styles.validationRow}>
                  <View
                    style={[
                      styles.validationIconWrap,
                      { backgroundColor: `${statusColor(item.status)}20` },
                    ]}
                  >
                    <Ionicons
                      name={
                        item.status === 'success'
                          ? 'checkmark-circle-outline'
                          : item.status === 'warning'
                          ? 'warning-outline'
                          : 'alert-circle-outline'
                      }
                      size={18}
                      color={statusColor(item.status)}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.validationLabel}>{item.label}</Text>
                    <Text style={styles.validationMessage}>{item.message}</Text>
                  </View>
                </View>
              ))}
            </View>
          </View>

          <View style={styles.card}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Dataset preview</Text>
              <Text style={styles.sectionSubtitle}>
                First {MAX_PREVIEW_ROWS} rows from your file
              </Text>
            </View>

            {parsedCsv ? (
              <>
                <View style={styles.previewStatsRow}>
                  <View style={styles.previewStatBox}>
                    <Text style={styles.previewStatLabel}>Columns</Text>
                    <Text style={styles.previewStatValue}>{parsedCsv.headers.length}</Text>
                  </View>

                  <View style={styles.previewStatBox}>
                    <Text style={styles.previewStatLabel}>Rows</Text>
                    <Text style={styles.previewStatValue}>{parsedCsv.totalRows}</Text>
                  </View>

                  <View style={styles.previewStatBox}>
                    <Text style={styles.previewStatLabel}>Recognized</Text>
                    <Text style={styles.previewStatValue}>
                      {parsedCsv.inferredColumns.length}
                    </Text>
                  </View>
                </View>

                <PreviewTable headers={parsedCsv.headers} rows={parsedCsv.rows} />

                <View style={styles.inferredBlock}>
                  <Text style={styles.inferredTitle}>Recognized business columns</Text>
                  {parsedCsv.inferredColumns.length > 0 ? (
                    <View style={styles.tagWrap}>
                      {parsedCsv.inferredColumns.map((item) => (
                        <View key={item} style={styles.tag}>
                          <Text style={styles.tagText}>{item}</Text>
                        </View>
                      ))}
                    </View>
                  ) : (
                    <Text style={styles.inferredEmpty}>
                      No common business columns were strongly recognized from the header names.
                    </Text>
                  )}
                </View>
              </>
            ) : (
              <View style={styles.emptyCard}>
                <Ionicons name="grid-outline" size={22} color={palette.primarySoft} />
                <Text style={styles.emptyTitle}>No preview yet</Text>
                <Text style={styles.emptySubtitle}>
                  Once you select a CSV, RiskLens will parse the headers and show a preview here.
                </Text>
              </View>
            )}
          </View>

          <View style={styles.card}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Recommended CSV structure</Text>
              <Text style={styles.sectionSubtitle}>
                Example columns that work well for RiskLens
              </Text>
            </View>

            <View style={styles.templateCard}>
              {csvTemplateHeaders().map((item) => (
                <View key={item} style={styles.templateRow}>
                  <Ionicons name="ellipse" size={8} color={palette.primarySoft} />
                  <Text style={styles.templateText}>{item}</Text>
                </View>
              ))}
            </View>

            <Text style={styles.helperText}>
              You do not need all of these columns, but pricing, category, quantity,
              and date fields help produce better analysis and market insight results.
            </Text>
          </View>

          <View style={styles.bottomActions}>
            <TouchableOpacity
              style={styles.secondaryAction}
              onPress={() => router.push('/(tabs)')}
            >
              <Ionicons name="grid-outline" size={18} color={palette.textSoft} />
              <Text style={styles.secondaryActionText}>Back to dashboard</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.primaryAction,
                !canUpload || uploading ? styles.primaryActionDisabled : null,
              ]}
              onPress={handleUpload}
              disabled={!canUpload || uploading}
            >
              {uploading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <>
                  <Ionicons name="rocket-outline" size={18} color="#FFFFFF" />
                  <Text style={styles.primaryActionText}>Upload and continue</Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          <View style={styles.footerSpace} />
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
    paddingTop: 18,
    paddingBottom: 24,
  },
  heroCard: {
    backgroundColor: palette.card,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: palette.border,
    padding: 20,
    marginBottom: 18,
    overflow: 'hidden',
  },
  heroOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  heroTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  iconGhostButton: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: palette.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(59,130,246,0.12)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginBottom: 12,
  },
  heroBadgeText: {
    color: palette.primarySoft,
    fontSize: 12,
    fontWeight: '700',
    marginLeft: 6,
  },
  heroTitle: {
    color: palette.text,
    fontSize: 28,
    lineHeight: 35,
    fontWeight: '900',
    letterSpacing: -0.7,
    marginBottom: 10,
  },
  heroSubtitle: {
    color: palette.textMuted,
    fontSize: 14,
    lineHeight: 21,
    marginBottom: 18,
  },
  heroInfoRow: {
    flexDirection: 'row',
    gap: 10,
  },
  heroInfoItem: {
    flex: 1,
    backgroundColor: palette.card2,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: palette.border,
    padding: 12,
  },
  heroInfoLabel: {
    color: palette.textMuted,
    fontSize: 11,
    marginBottom: 4,
  },
  heroInfoValue: {
    color: palette.text,
    fontSize: 15,
    fontWeight: '800',
  },
  actionsBlock: {
    gap: 12,
    marginBottom: 16,
  },
  pickButton: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  pickButtonInner: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
    marginLeft: 8,
  },
  uploadButton: {
    minHeight: 54,
    borderRadius: 16,
    backgroundColor: palette.success,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  uploadButtonDisabled: {
    opacity: 0.55,
  },
  uploadButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
    marginLeft: 8,
  },
  card: {
    backgroundColor: palette.card,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: palette.border,
    padding: 18,
    marginBottom: 16,
  },
  sectionHeader: {
    marginBottom: 14,
  },
  sectionTitle: {
    color: palette.text,
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 4,
  },
  sectionSubtitle: {
    color: palette.textMuted,
    fontSize: 13,
    lineHeight: 18,
  },
  fileSummaryCard: {
    backgroundColor: palette.card2,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: palette.border,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
  },
  fileIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: 'rgba(59,130,246,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  fileName: {
    color: palette.text,
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 4,
  },
  fileMeta: {
    color: palette.textMuted,
    fontSize: 12,
  },
  validationList: {
    gap: 12,
  },
  validationRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: palette.card2,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: palette.border,
    padding: 13,
  },
  validationIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  validationLabel: {
    color: palette.text,
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 4,
  },
  validationMessage: {
    color: palette.textMuted,
    fontSize: 12,
    lineHeight: 18,
  },
  previewStatsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 14,
  },
  previewStatBox: {
    flex: 1,
    backgroundColor: palette.card2,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: palette.border,
    padding: 12,
  },
  previewStatLabel: {
    color: palette.textMuted,
    fontSize: 11,
    marginBottom: 4,
  },
  previewStatValue: {
    color: palette.text,
    fontSize: 16,
    fontWeight: '800',
  },
  tableWrap: {
    minWidth: 720,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: palette.card2,
  },
  tableHeaderRow: {
    flexDirection: 'row',
    backgroundColor: palette.card3,
  },
  tableHeaderCell: {
    width: 140,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRightWidth: 1,
    borderRightColor: palette.border,
  },
  tableHeaderText: {
    color: palette.text,
    fontSize: 12,
    fontWeight: '800',
  },
  tableDataRow: {
    flexDirection: 'row',
  },
  tableRowAlt: {
    backgroundColor: 'rgba(255,255,255,0.02)',
  },
  tableDataCell: {
    width: 140,
    minHeight: 52,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: palette.border,
    borderRightWidth: 1,
    borderRightColor: palette.border,
    justifyContent: 'center',
  },
  tableDataText: {
    color: palette.textSoft,
    fontSize: 12,
    lineHeight: 17,
  },
  tableEmptyRow: {
    padding: 16,
  },
  tableEmptyText: {
    color: palette.textMuted,
    fontSize: 13,
  },
  inferredBlock: {
    marginTop: 14,
  },
  inferredTitle: {
    color: palette.text,
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 10,
  },
  inferredEmpty: {
    color: palette.textMuted,
    fontSize: 13,
    lineHeight: 18,
  },
  tagWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tag: {
    backgroundColor: 'rgba(59,130,246,0.12)',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  tagText: {
    color: palette.primarySoft,
    fontSize: 12,
    fontWeight: '700',
  },
  templateCard: {
    backgroundColor: palette.card2,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: palette.border,
    padding: 14,
    marginBottom: 12,
  },
  templateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  templateText: {
    color: palette.textSoft,
    fontSize: 14,
    marginLeft: 10,
  },
  helperText: {
    color: palette.textMuted,
    fontSize: 13,
    lineHeight: 19,
  },
  emptyCard: {
    backgroundColor: palette.card2,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: palette.border,
    padding: 22,
    alignItems: 'center',
  },
  emptyTitle: {
    color: palette.text,
    fontSize: 15,
    fontWeight: '800',
    marginTop: 10,
    marginBottom: 6,
    textAlign: 'center',
  },
  emptySubtitle: {
    color: palette.textMuted,
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
  },
  messageCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 16,
    borderWidth: 1,
  },
  messageSuccess: {
    backgroundColor: 'rgba(6,78,59,0.22)',
    borderColor: 'rgba(16,185,129,0.35)',
  },
  messageError: {
    backgroundColor: 'rgba(127,29,29,0.22)',
    borderColor: 'rgba(239,68,68,0.35)',
  },
  messageText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
  },
  bottomActions: {
    gap: 12,
    marginTop: 4,
  },
  secondaryAction: {
    minHeight: 52,
    borderRadius: 16,
    backgroundColor: palette.card,
    borderWidth: 1,
    borderColor: palette.border,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  secondaryActionText: {
    color: palette.textSoft,
    fontSize: 15,
    fontWeight: '700',
    marginLeft: 8,
  },
  primaryAction: {
    minHeight: 56,
    borderRadius: 16,
    backgroundColor: palette.primary,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  primaryActionDisabled: {
    opacity: 0.55,
  },
  primaryActionText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
    marginLeft: 8,
  },
  footerSpace: {
    height: Platform.OS === 'ios' ? 36 : 24,
  },
});