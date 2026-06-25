import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
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
import HealthGauge from '../../components/health-gauge';
import {
  answerQuestion,
  computeStats,
  healthLabel,
  type CardTone,
  type CopilotAnswer,
  type CopilotCard,
  type CopilotContext,
} from '../../lib/copilotEngine';
import { aiStatusLabel, askOpenAI, hasOpenAIKey, type ChatTurn } from '../../lib/aiChat';
import { Text } from '../../components/app-text';
import { useLanguage, useT } from '../../lib/i18n';

const palette = {
  bg: '#F4F7FB',
  surface: '#FFFFFF',
  surfaceSoft: '#EEF3FA',
  surfaceSoft2: '#E5ECF6',
  border: '#D9E2F1',
  borderStrong: '#CAD6E8',

  text: '#162033',
  textSoft: '#42516B',
  textMuted: '#738199',

  primary: '#5AA9FF',
  primary2: '#7C5CFF',
  primary3: '#4BE1EC',

  danger: '#FF6B7A',
  warning: '#F7B955',
  success: '#42D392',
  info: '#5AA9FF',
  purple: '#A78BFA',
  cyan: '#4BE1EC',

  redSoft: '#FFF1F3',
  yellowSoft: '#FFF7E5',
  greenSoft: '#EAFBF3',
  blueSoft: '#EAF4FF',
  purpleSoft: '#F3EEFF',
  cyanSoft: '#E7FBFD',
};

const toneColor: Record<CardTone, string> = {
  red: palette.danger,
  yellow: palette.warning,
  green: palette.success,
  blue: palette.info,
  purple: palette.purple,
  cyan: palette.cyan,
};

const toneSoft: Record<CardTone, string> = {
  red: palette.redSoft,
  yellow: palette.yellowSoft,
  green: palette.greenSoft,
  blue: palette.blueSoft,
  purple: palette.purpleSoft,
  cyan: palette.cyanSoft,
};

type ChatMessage =
  | { id: string; role: 'user'; text: string }
  | { id: string; role: 'assistant'; answer: CopilotAnswer };

const STARTERS = [
  "How healthy is my business?",
  "What's expiring soon?",
  'What should I restock?',
  'Where are my weak margins?',
  'Which supplier is riskiest?',
  'What should I do next?',
];

let messageCounter = 0;
function nextId() {
  messageCounter += 1;
  return `msg-${Date.now()}-${messageCounter}`;
}

/* --------------------------- typing indicator --------------------------- */

function TypingDots() {
  const dots = [useRef(new Animated.Value(0)).current, useRef(new Animated.Value(0)).current, useRef(new Animated.Value(0)).current];

  useEffect(() => {
    const animations = dots.map((dot, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 160),
          Animated.timing(dot, { toValue: 1, duration: 360, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(dot, { toValue: 0, duration: 360, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        ])
      )
    );
    animations.forEach((a) => a.start());
    return () => animations.forEach((a) => a.stop());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View style={styles.typingRow}>
      <View style={styles.assistantAvatar}>
        <MaterialCommunityIcons name="robot-happy-outline" size={16} color="#fff" />
      </View>
      <View style={styles.typingBubble}>
        {dots.map((dot, i) => (
          <Animated.View
            key={i}
            style={[
              styles.typingDot,
              {
                opacity: dot.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] }),
                transform: [{ translateY: dot.interpolate({ inputRange: [0, 1], outputRange: [0, -4] }) }],
              },
            ]}
          />
        ))}
      </View>
    </View>
  );
}

/* ------------------------------ card views ------------------------------ */

function CardView({ card }: { card: CopilotCard }) {
  if (card.kind === 'metrics') {
    return (
      <View style={styles.metricsWrap}>
        {card.metrics.map((m, i) => {
          const tone = m.tone || 'blue';
          return (
            <View key={i} style={[styles.metricChip, { backgroundColor: toneSoft[tone] }]}>
              <Text style={[styles.metricChipValue, { color: toneColor[tone] }]}>{m.value}</Text>
              <Text style={styles.metricChipLabel}>{m.label}</Text>
            </View>
          );
        })}
      </View>
    );
  }

  if (card.kind === 'list') {
    return (
      <View style={styles.listCard}>
        {card.title ? <Text style={styles.listTitle}>{card.title}</Text> : null}
        {card.items.map((item, i) => {
          const tone = item.tone || 'blue';
          return (
            <View key={i} style={[styles.listRow, i === card.items.length - 1 && { marginBottom: 0 }]}>
              <View style={[styles.listDot, { backgroundColor: toneColor[tone] }]} />
              <View style={{ flex: 1 }}>
                <Text style={styles.listLabel} numberOfLines={1}>
                  {item.label}
                </Text>
                {item.sub ? (
                  <Text style={styles.listSub} numberOfLines={2}>
                    {item.sub}
                  </Text>
                ) : null}
              </View>
              {item.value ? (
                <Text style={[styles.listValue, { color: toneColor[tone] }]}>{item.value}</Text>
              ) : null}
            </View>
          );
        })}
      </View>
    );
  }

  if (card.kind === 'gauge') {
    return (
      <View style={styles.gaugeCard}>
        <HealthGauge score={card.score} size={150} label="/100" caption={card.caption} />
      </View>
    );
  }

  // callout
  return (
    <View style={[styles.calloutCard, { backgroundColor: toneSoft[card.tone], borderColor: `${toneColor[card.tone]}33` }]}>
      <Ionicons name={(card.icon as any) || 'information-circle-outline'} size={20} color={toneColor[card.tone]} />
      <View style={{ flex: 1 }}>
        {card.title ? <Text style={[styles.calloutTitle, { color: toneColor[card.tone] }]}>{card.title}</Text> : null}
        <Text style={styles.calloutText}>{card.text}</Text>
      </View>
    </View>
  );
}

/* --------------------------- assistant bubble --------------------------- */

function AssistantMessage({
  answer,
  onSuggestion,
}: {
  answer: CopilotAnswer;
  onSuggestion: (q: string) => void;
}) {
  const enter = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(enter, { toValue: 1, duration: 320, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [enter]);

  return (
    <Animated.View
      style={[
        styles.assistantRow,
        { opacity: enter, transform: [{ translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }] },
      ]}
    >
      <View style={styles.assistantAvatar}>
        <MaterialCommunityIcons name="robot-happy-outline" size={16} color="#fff" />
      </View>

      <View style={styles.assistantBubble}>
        <Text style={styles.assistantText}>{answer.text}</Text>

        {answer.cards?.map((card, i) => (
          <View key={i} style={{ marginTop: 12 }}>
            <CardView card={card} />
          </View>
        ))}

        {answer.actions?.length ? (
          <View style={styles.actionsWrap}>
            {answer.actions.map((action, i) => (
              <TouchableOpacity
                key={i}
                style={styles.actionButton}
                activeOpacity={0.85}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  router.push(action.path as never);
                }}
              >
                <Ionicons name={(action.icon as any) || 'arrow-forward'} size={15} color={palette.primary2} />
                <Text style={styles.actionButtonText}>{action.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        ) : null}

        {answer.suggestions?.length ? (
          <View style={styles.suggestionsWrap}>
            {answer.suggestions.map((s, i) => (
              <TouchableOpacity key={i} style={styles.suggestionChip} activeOpacity={0.85} onPress={() => onSuggestion(s)}>
                <Text style={styles.suggestionChipText}>{s}</Text>
              </TouchableOpacity>
            ))}
          </View>
        ) : null}
      </View>
    </Animated.View>
  );
}

function UserMessage({ text }: { text: string }) {
  return (
    <View style={styles.userRow}>
      <LinearGradient colors={[palette.primary, palette.primary2]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.userBubble}>
        <Text style={styles.userText}>{text}</Text>
      </LinearGradient>
    </View>
  );
}

/* ------------------------------- screen --------------------------------- */

export default function CopilotScreen() {
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [ctx, setCtx] = useState<CopilotContext>({ products: [], alerts: [], recommendations: [] });
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [thinking, setThinking] = useState(false);
  const [input, setInput] = useState('');

  const scrollRef = useRef<ScrollView>(null);
  const { language } = useLanguage();
  const t = useT();

  const stats = useMemo(() => computeStats(ctx), [ctx]);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user) {
        router.replace('/login');
        return;
      }

      const [productsRes, alertsRes, recsRes] = await Promise.all([
        supabase
          .from('food_products')
          .select('id, name, category, stock_quantity, min_stock_level, selling_price, cost_price, expiry_date, supplier_name, status')
          .eq('user_id', user.id)
          .eq('status', 'active'),
        supabase
          .from('food_alerts')
          .select('id, title, description, severity, source_type')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false }),
        supabase
          .from('food_recommendations')
          .select('id, product_name, recommendation_type, message, impact_value')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false }),
      ]);

      const nextCtx: CopilotContext = {
        products: (productsRes.data as any) || [],
        alerts: (alertsRes.data as any) || [],
        recommendations: (recsRes.data as any) || [],
      };
      setCtx(nextCtx);

      const s = computeStats(nextCtx);
      const welcome: ChatMessage = {
        id: nextId(),
        role: 'assistant',
        answer:
          nextCtx.products.length > 0
            ? {
                text: t(
                  "Hi! I'm your RiskLens Copilot. I just scanned all {count} of your products in real time. Your business health is {score}/100 — {label}. Ask me anything about your inventory, or tap a question to start.",
                  { count: s.totalProducts, score: s.healthScore, label: t(healthLabel(s.healthScore)) }
                ),
                cards: [{ kind: 'gauge', title: 'Business health', score: s.healthScore, caption: healthLabel(s.healthScore) }],
                suggestions: STARTERS.slice(0, 4),
              }
            : {
                text: t(
                  "Hi! I'm your RiskLens Copilot. I don't see any products yet — upload a CSV and I'll instantly analyze expiry risk, restock needs, margins, and the next best actions for your store."
                ),
                actions: [{ label: 'Upload CSV', path: '/(tabs)/upload', icon: 'cloud-upload-outline' }],
              },
      };
      setMessages([welcome]);
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const scrollToEnd = useCallback(() => {
    requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));
  }, []);

  const send = useCallback(
    async (raw: string) => {
      const question = raw.trim();
      if (!question || thinking) return;

      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

      // Build conversation history (for GPT) from prior turns before we add this one.
      const history: ChatTurn[] = messages
        .map((m): ChatTurn | null =>
          m.role === 'user'
            ? { role: 'user', content: m.text }
            : m.answer.text
            ? { role: 'assistant', content: m.answer.text }
            : null
        )
        .filter((t): t is ChatTurn => t !== null);

      setInput('');
      setMessages((prev) => [...prev, { id: nextId(), role: 'user', text: question }]);
      setThinking(true);
      scrollToEnd();

      // The on-device engine always runs: it provides the accurate data cards,
      // quick actions and follow-up suggestions, plus the offline fallback text.
      const base = answerQuestion(question, ctx);

      let finalAnswer = base;
      if (hasOpenAIKey()) {
        // GPT writes the answer, grounded on the live store data. Cards/actions
        // stay from the engine because they're always accurate. On any failure
        // we silently keep the on-device answer so the chat never dead-ends.
        try {
          const text = await askOpenAI(question, ctx, history, language);
          finalAnswer = { ...base, text };
        } catch {
          finalAnswer = base;
        }
      } else {
        // Small natural delay so the typing indicator reads as "thinking".
        await new Promise((r) => setTimeout(r, 520));
      }

      setThinking(false);
      setMessages((prev) => [...prev, { id: nextId(), role: 'assistant', answer: finalAnswer }]);
      scrollToEnd();
    },
    [ctx, thinking, scrollToEnd, messages, language]
  );

  if (loading) {
    return (
      <SafeArea>
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={palette.primary2} />
          <Text style={styles.loadingText}>Waking up your Copilot...</Text>
        </View>
      </SafeArea>
    );
  }

  return (
    <SafeArea>
      <View style={styles.container}>
        <LinearGradient colors={['#5AA9FF', '#6D7CFF', '#4BE1EC']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
          <View style={styles.heroTopRow}>
            <TouchableOpacity style={styles.heroButton} onPress={() => setSidebarOpen(true)}>
              <Ionicons name="menu-outline" size={20} color="#fff" />
            </TouchableOpacity>

            <View style={styles.heroCenter}>
              <View style={styles.heroAvatar}>
                <MaterialCommunityIcons name="robot-happy-outline" size={20} color="#fff" />
              </View>
              <View>
                <Text style={styles.heroTitle}>RiskLens Copilot</Text>
                <View style={styles.heroStatusRow}>
                  <View style={styles.liveDot} />
                  <Text style={styles.heroStatus}>
                    {aiStatusLabel()} • {stats.totalProducts} products • {stats.healthScore}/100
                  </Text>
                </View>
              </View>
            </View>

            <TouchableOpacity style={styles.heroButton} onPress={() => router.push('/(tabs)')}>
              <Ionicons name="grid-outline" size={20} color="#fff" />
            </TouchableOpacity>
          </View>
        </LinearGradient>

        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={8}>
          <ScrollView
            ref={scrollRef}
            style={styles.chatScroll}
            contentContainerStyle={styles.chatContent}
            showsVerticalScrollIndicator={false}
            onContentSizeChange={scrollToEnd}
            keyboardShouldPersistTaps="handled"
          >
            {messages.map((m) =>
              m.role === 'user' ? (
                <UserMessage key={m.id} text={m.text} />
              ) : (
                <AssistantMessage key={m.id} answer={m.answer} onSuggestion={send} />
              )
            )}

            {thinking ? <TypingDots /> : null}
            <View style={{ height: 6 }} />
          </ScrollView>

          <View style={styles.inputBar}>
            <TextInput
              value={input}
              onChangeText={setInput}
              placeholder={t('Ask about your inventory...')}
              placeholderTextColor={palette.textMuted}
              style={styles.input}
              returnKeyType="send"
              onSubmitEditing={() => send(input)}
              editable={!thinking}
            />
            <TouchableOpacity activeOpacity={0.85} onPress={() => send(input)} disabled={!input.trim() || thinking}>
              <LinearGradient
                colors={!input.trim() || thinking ? ['#CBD5E1', '#CBD5E1'] : [palette.primary, palette.primary2]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.sendButton}
              >
                <Ionicons name="arrow-up" size={20} color="#fff" />
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>

        <AppSidebar visible={sidebarOpen} onClose={() => setSidebarOpen(false)} active="copilot" />
      </View>
    </SafeArea>
  );
}

function SafeArea({ children }: { children: React.ReactNode }) {
  return <View style={styles.safeArea}>{children}</View>;
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: palette.bg },
  container: { flex: 1, backgroundColor: palette.bg },

  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.bg },
  loadingText: { marginTop: 14, color: palette.textSoft, fontSize: 14, fontWeight: '600' },

  hero: {
    paddingTop: 52,
    paddingBottom: 16,
    paddingHorizontal: 16,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  heroTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  heroButton: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroCenter: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1, paddingHorizontal: 10 },
  heroAvatar: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTitle: { color: '#fff', fontSize: 17, fontWeight: '900' },
  heroStatusRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#C6FFE9' },
  heroStatus: { color: 'rgba(255,255,255,0.9)', fontSize: 11, fontWeight: '700' },

  chatScroll: { flex: 1 },
  chatContent: { paddingHorizontal: 16, paddingTop: 18, paddingBottom: 8 },

  userRow: { alignItems: 'flex-end', marginBottom: 16 },
  userBubble: {
    maxWidth: '86%',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 22,
    borderBottomRightRadius: 6,
  },
  userText: { color: '#fff', fontSize: 14, lineHeight: 20, fontWeight: '600' },

  assistantRow: { flexDirection: 'row', gap: 10, marginBottom: 16, alignItems: 'flex-start' },
  assistantAvatar: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: palette.primary2,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  assistantBubble: {
    flex: 1,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 22,
    borderTopLeftRadius: 6,
    padding: 14,
  },
  assistantText: { color: palette.text, fontSize: 14, lineHeight: 21, fontWeight: '500' },

  metricsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  metricChip: {
    minWidth: '30%',
    flexGrow: 1,
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  metricChipValue: { fontSize: 18, fontWeight: '900', marginBottom: 2 },
  metricChipLabel: { color: palette.textSoft, fontSize: 11, fontWeight: '700' },

  listCard: {
    backgroundColor: palette.surfaceSoft,
    borderRadius: 18,
    padding: 14,
  },
  listTitle: { color: palette.textMuted, fontSize: 11, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 12 },
  listRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  listDot: { width: 8, height: 8, borderRadius: 4 },
  listLabel: { color: palette.text, fontSize: 13, fontWeight: '800' },
  listSub: { color: palette.textMuted, fontSize: 11, lineHeight: 16, fontWeight: '500', marginTop: 2 },
  listValue: { fontSize: 13, fontWeight: '900', marginLeft: 6 },

  gaugeCard: { alignItems: 'center', paddingVertical: 8 },

  calloutCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
  },
  calloutTitle: { fontSize: 13, fontWeight: '900', marginBottom: 2 },
  calloutText: { color: palette.textSoft, fontSize: 13, lineHeight: 19, fontWeight: '600' },

  actionsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 12,
    backgroundColor: palette.blueSoft,
    borderWidth: 1,
    borderColor: palette.border,
  },
  actionButtonText: { color: palette.primary2, fontSize: 12, fontWeight: '800' },

  suggestionsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 },
  suggestionChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: palette.surfaceSoft,
    borderWidth: 1,
    borderColor: palette.border,
  },
  suggestionChipText: { color: palette.textSoft, fontSize: 12, fontWeight: '700' },

  typingRow: { flexDirection: 'row', gap: 10, marginBottom: 16, alignItems: 'center' },
  typingBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 18,
    borderTopLeftRadius: 6,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  typingDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: palette.primary2 },

  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: Platform.OS === 'ios' ? 24 : 14,
    backgroundColor: palette.surface,
    borderTopWidth: 1,
    borderTopColor: palette.border,
  },
  input: {
    flex: 1,
    minHeight: 48,
    maxHeight: 110,
    borderRadius: 16,
    backgroundColor: palette.surfaceSoft,
    borderWidth: 1,
    borderColor: palette.border,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: palette.text,
    fontSize: 14,
  },
  sendButton: { width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
});
