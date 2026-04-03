import { supabase } from '../api/supabase'

export async function signUp(email: string, password: string, businessName: string) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
  })

  if (error) throw error

  // krijo profile
  if (data.user) {
    await supabase.from('profiles').insert({
      id: data.user.id,
      email,
      business_name: businessName,
    })
  }

  return data
}

export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error) throw error
  return data
}

export async function signOut() {
  await supabase.auth.signOut()
}