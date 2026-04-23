import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Dimensions,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { supabase } from '../lib/supabase';

const { width } = Dimensions.get('window');
const SIDEBAR_WIDTH = Math.min(320, width * 0.82);

const palette = {
  surface: '#FFFFFF',
  surfaceSoft: '#EEF3EC',
  textSoft: '#425345',
  primary2: '#24583D',
};

type SidebarRoute =
  | 'decision-center'
  | 'dashboard'
  | 'products'
  | 'upload'
  | 'explore'
  | 'alerts-center'
  | 'recommendations-center'
  | 'supplier-performance'
  | 'waste-expiry'
  | 'ai-pricing-lab'
  | 'pricing-history'
  | 'tutorial';

type Props = {
  visible: boolean;
  onClose: () => void;
  active?: SidebarRoute;
};

function SidebarItem({
  icon,
  label,
  onPress,
  active = false,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  onPress: () => void;
  active?: boolean;
}) {
  return (
    <TouchableOpacity
      style={[styles.sidebarItem, active && styles.sidebarItemActive]}
      onPress={onPress}
      activeOpacity={0.9}
    >
      <Ionicons
        name={icon}
        size={18}
        color={active ? '#fff' : palette.textSoft}
      />
      <Text
        style={[styles.sidebarItemText, active && styles.sidebarItemTextActive]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

export default function AppSidebar({ visible, onClose, active }: Props) {
  const sidebarAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(sidebarAnim, {
      toValue: visible ? 1 : 0,
      duration: visible ? 220 : 200,
      useNativeDriver: true,
    }).start();
  }, [visible, sidebarAnim]);

  const sidebarTranslateX = sidebarAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-SIDEBAR_WIDTH, 0],
  });

  const overlayOpacity = sidebarAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 0.32],
  });

  const go = (path: string) => {
    onClose();
    setTimeout(() => {
      router.push(path as never);
    }, 180);
  };

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      onClose();
      router.replace('/login');
    } catch (error) {
      console.log('Logout error:', error);
    }
  };

  if (!visible) return null;

  return (
    <>
      <Animated.View
        pointerEvents="none"
        style={[
          styles.overlay,
          {
            opacity: overlayOpacity,
          },
        ]}
      />
      <Pressable style={styles.overlayPressable} onPress={onClose} />

      <Animated.View
        style={[
          styles.sidebar,
          {
            transform: [{ translateX: sidebarTranslateX }],
          },
        ]}
      >
        <LinearGradient
          colors={['#163728', '#1C4630', '#24583D']}
          style={styles.sidebarHeader}
        >
          <View style={styles.sidebarBrandIcon}>
            <MaterialCommunityIcons
              name="view-dashboard-outline"
              size={24}
              color="#fff"
            />
          </View>
          <Text style={styles.sidebarTitle}>RiskLens</Text>
          <Text style={styles.sidebarSubtitle}>Navigation</Text>
        </LinearGradient>

        <ScrollView
          style={styles.sidebarBody}
          contentContainerStyle={styles.sidebarBodyContent}
          showsVerticalScrollIndicator={false}
        >
          <SidebarItem
            icon="flash-outline"
            label="Decision Center"
            active={active === 'decision-center'}
            onPress={() => go('/(tabs)/decision-center')}
          />

          <SidebarItem
            icon="time-outline"
            label="Pricing History"
            active={active === 'pricing-history'}
            onPress={() => go('/(tabs)/pricing-history')}
          />

          <SidebarItem
            icon="sparkles-outline"
            label="AI Pricing Lab"
            active={active === 'ai-pricing-lab'}
            onPress={() => go('/(tabs)/ai-pricing-lab')}
          />

          <SidebarItem
            icon="grid-outline"
            label="Dashboard"
            active={active === 'dashboard'}
            onPress={() => go('/(tabs)')}
          />

          <SidebarItem
            icon="basket-outline"
            label="Products"
            active={active === 'products'}
            onPress={() => go('/(tabs)/products')}
          />

          <SidebarItem
            icon="cloud-upload-outline"
            label="Upload CSV"
            active={active === 'upload'}
            onPress={() => go('/(tabs)/upload')}
          />

          <SidebarItem
            icon="analytics-outline"
            label="Insights"
            active={active === 'explore'}
            onPress={() => go('/(tabs)/explore')}
          />

          <SidebarItem
            icon="notifications-outline"
            label="Alerts Center"
            active={active === 'alerts-center'}
            onPress={() => go('/(tabs)/alerts-center')}
          />

          <SidebarItem
            icon="sparkles-outline"
            label="Recommendations"
            active={active === 'recommendations-center'}
            onPress={() => go('/(tabs)/recommendations-center')}
          />

          <SidebarItem
            icon="business-outline"
            label="Supplier Performance"
            active={active === 'supplier-performance'}
            onPress={() => go('/(tabs)/supplier-performance')}
          />

          <SidebarItem
            icon="calendar-outline"
            label="Waste & Expiry"
            active={active === 'waste-expiry'}
            onPress={() => go('/(tabs)/waste-expiry')}
          />
          <SidebarItem
  icon="school-outline"
  label="Tutorial"
  active={active === 'tutorial'}
  onPress={() => go('/(tabs)/tutorial')}
/>

          <TouchableOpacity
            style={styles.logoutButton}
            onPress={handleLogout}
            activeOpacity={0.9}
          >
            <Ionicons name="log-out-outline" size={18} color="#D94F4F" />
            <Text style={styles.logoutButtonText}>Logout</Text>
          </TouchableOpacity>
        </ScrollView>
      </Animated.View>
    </>
  );
}

const styles = StyleSheet.create({
  logoutButton: {
    marginTop: 18,
    minHeight: 50,
    borderRadius: 16,
    backgroundColor: '#FFF1F1',
    borderWidth: 1,
    borderColor: '#F1CACA',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },

  logoutButtonText: {
    color: '#D94F4F',
    fontSize: 14,
    fontWeight: '900',
  },

  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000',
  },
  overlayPressable: {
    ...StyleSheet.absoluteFillObject,
  },
  sidebar: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    width: SIDEBAR_WIDTH,
    backgroundColor: palette.surface,
    borderTopRightRadius: 24,
    borderBottomRightRadius: 24,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 18,
    shadowOffset: { width: 4, height: 0 },
    elevation: 12,
  },
  sidebarHeader: {
    paddingTop: 56,
    paddingHorizontal: 18,
    paddingBottom: 18,
  },
  sidebarBrandIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  sidebarTitle: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '900',
    marginBottom: 4,
  },
  sidebarSubtitle: {
    color: 'rgba(255,255,255,0.82)',
    fontSize: 13,
    fontWeight: '500',
  },
  sidebarBody: {
    flex: 1,
  },
  sidebarBodyContent: {
    padding: 14,
    gap: 8,
  },
  sidebarItem: {
    minHeight: 48,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    backgroundColor: palette.surfaceSoft,
  },
  sidebarItemActive: {
    backgroundColor: palette.primary2,
  },
  sidebarItemText: {
    color: palette.textSoft,
    fontSize: 14,
    fontWeight: '800',
  },
  sidebarItemTextActive: {
    color: '#fff',
  },
});