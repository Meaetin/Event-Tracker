import { supabase } from "./supabaseClient";
import { Session, User } from "@supabase/supabase-js";

export async function getCurrentSession(): Promise<{
  session: Session | null;
  user: User | null;
}> {
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) throw sessionError;

  const user = session?.user ?? null;
  return { session, user };
}

export async function signOutUser(): Promise<void> {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function getUserRole(user: User, setRole: (role: string) => void): Promise<string | null> {
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('*')  // Select all fields to ensure we get the profile
    .eq('id', user.id)
    .single();

    if (error) {
      console.error('Error fetching profile:', error);
      setRole('user');
    } else if (profile) {
      setRole(profile.role || 'user');
    }

    return profile?.role || null;
}
