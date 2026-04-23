import { router } from 'expo-router';
import { supabase } from './supabase';

export async function requireAuth() {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) throw error;

  if (!user) {
    router.replace('/login');
    return null;
  }

  return user;
}