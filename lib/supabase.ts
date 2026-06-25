import 'react-native-url-polyfill/auto';
import { Platform } from 'react-native';
import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import {
  clearDemoSession,
  createDemoQuery,
  DEMO_ACCOUNT,
  getDemoSession,
  hasDemoSession,
  isDemoCredentialPair,
  startDemoSession,
  subscribeToDemoAuth,
} from './demoSupabase';

export { DEMO_ACCOUNT };

// RiskLens is designed to run as a fully self-contained demo even when no
// Supabase backend is configured. If the public env vars are missing we fall
// back to safe placeholder values so `createClient` never throws at module
// load time (which would white-screen the whole app). All real data flows
// through the offline demo store in that case.
const supabaseUrl =
  process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://demo.risklens.local';
const supabaseAnonKey =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'risklens-public-demo-anon-key';

export const hasRemoteBackend =
  !!process.env.EXPO_PUBLIC_SUPABASE_URL &&
  !!process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

const fallbackWebStorage = new Map<string, string>();

function withTimeout<T>(promise: PromiseLike<T>, fallback: T, timeoutMs = 5000) {
  return Promise.race([
    promise,
    new Promise<T>((resolve) => {
      setTimeout(() => resolve(fallback), timeoutMs);
    }),
  ]);
}

// Storage for web
const webStorage = {
  getItem: (key: string) => {
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        return Promise.resolve(window.localStorage.getItem(key));
      } catch {
        return Promise.resolve(fallbackWebStorage.get(key) || null);
      }
    }

    return Promise.resolve(fallbackWebStorage.get(key) || null);
  },
  setItem: (key: string, value: string) => {
    fallbackWebStorage.set(key, value);

    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        window.localStorage.setItem(key, value);
      } catch {
        // Keep the in-memory fallback when browser storage is restricted.
      }
    }

    return Promise.resolve();
  },
  removeItem: (key: string) => {
    fallbackWebStorage.delete(key);

    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        window.localStorage.removeItem(key);
      } catch {
        // Keep removal best-effort for restricted browser storage.
      }
    }

    return Promise.resolve();
  },
};

// Storage for native
const nativeStorage = {
  getItem: (key: string) => SecureStore.getItemAsync(key),
  setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value),
  removeItem: (key: string) => SecureStore.deleteItemAsync(key),
};

const storage = Platform.OS === 'web' ? webStorage : nativeStorage;

const remoteSupabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

export const supabase: any = {
  ...remoteSupabase,
  auth: {
    ...remoteSupabase.auth,
    async getSession() {
      const session = await getDemoSession();
      if (session) {
        return { data: { session }, error: null };
      }

      return withTimeout(remoteSupabase.auth.getSession(), {
        data: { session: null },
        error: null,
      });
    },

    async getUser() {
      const session = await getDemoSession();
      if (session) {
        return { data: { user: session.user }, error: null };
      }

      return withTimeout<any>(remoteSupabase.auth.getUser(), {
        data: { user: null },
        error: null,
      });
    },

    async signInWithPassword({
      email,
      password,
    }: {
      email: string;
      password: string;
    }) {
      if (isDemoCredentialPair(email, password)) {
        const session = await startDemoSession();
        return { data: { user: session.user, session }, error: null };
      }

      return remoteSupabase.auth.signInWithPassword({ email, password });
    },

    async signUp(params: Parameters<typeof remoteSupabase.auth.signUp>[0]) {
      return remoteSupabase.auth.signUp(params);
    },

    async signOut() {
      if (hasDemoSession()) {
        await clearDemoSession();
        return { error: null };
      }

      return remoteSupabase.auth.signOut();
    },

    onAuthStateChange(
      callback: Parameters<typeof remoteSupabase.auth.onAuthStateChange>[0]
    ) {
      const remoteSubscription = remoteSupabase.auth.onAuthStateChange((event, session) => {
        void getDemoSession().then((demoSession) => {
          callback(event, demoSession || session);
        });
      });
      const unsubscribeDemo = subscribeToDemoAuth((event, session) => {
        callback(event as any, session);
      });

      return {
        data: {
          subscription: {
            unsubscribe() {
              unsubscribeDemo();
              remoteSubscription.data.subscription.unsubscribe();
            },
          },
        },
      };
    },
  },

  from(table: string) {
    if (hasDemoSession()) {
      return createDemoQuery(table);
    }

    return remoteSupabase.from(table);
  },
};
