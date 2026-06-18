import { supabase } from '../api/supabase';

type SignUpParams = {
  company: string;
  email: string;
  fullName: string;
  password: string;
};

export function getFriendlyAuthErrorMessage(
  error: any,
  mode: 'login' | 'signup' = 'login'
) {
  const message = String(error?.message || '').trim();
  const normalized = message.toLowerCase();

  if (!message) {
    return mode === 'signup'
      ? 'Something went wrong while creating your account. Please try again.'
      : 'Something went wrong while signing you in. Please try again.';
  }

  if (
    normalized.includes('invalid login credentials') ||
    normalized.includes('invalid_credentials')
  ) {
    return 'Incorrect email or password. Please try again.';
  }

  if (normalized.includes('email not confirmed')) {
    return 'Your account exists, but the email address has not been confirmed yet.';
  }

  if (
    normalized.includes('user already registered') ||
    normalized.includes('already registered') ||
    normalized.includes('already exists')
  ) {
    return 'An account with this email already exists. Try signing in instead.';
  }

  if (normalized.includes('password should be at least')) {
    return message;
  }

  if (normalized.includes('signup is disabled')) {
    return 'New account creation is currently disabled for this project.';
  }

  if (
    normalized.includes('failed to fetch') ||
    normalized.includes('network request failed') ||
    normalized.includes('load failed')
  ) {
    return 'Could not reach the authentication server. Please check the connection and try again.';
  }

  return message;
}

export async function signUp({ company, email, fullName, password }: SignUpParams) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        company,
        full_name: fullName,
      },
    },
  });

  if (error) throw error;

  if (data.session) return data;

  // Some Supabase setups create the account without eagerly returning the session.
  const {
    data: { session: storedSession },
  } = await supabase.auth.getSession();

  if (storedSession) {
    return {
      session: storedSession,
      user: storedSession.user,
    };
  }

  const signInResult = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (signInResult.error) {
    return data;
  }

  return signInResult.data;
}

export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) throw error;
  return data;
}

export async function signOut() {
  await supabase.auth.signOut();
}
