import { Stack } from 'expo-router';
import { LanguageProvider } from '../lib/i18n';

export default function RootLayout() {
  return (
    <LanguageProvider>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="login" />
        <Stack.Screen name="(tabs)" />
      </Stack>
    </LanguageProvider>
  );
}