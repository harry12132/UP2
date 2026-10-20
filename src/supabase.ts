import { createClient } from '@supabase/supabase-js';
import { auth } from './firebase';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://hbtfxtompvddvdmejnzl.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhidGZ4dG9tcHZkZHZkbWVqbnpsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI0NDIyMTgsImV4cCI6MjEwODAxODIxOH0.Iy5S_QF-SBtCl3wDKoMPHr7dPSgPf1RqpA5VJh0i91Q';

if (!supabaseAnonKey) console.warn('UP2 Supabase is missing VITE_SUPABASE_ANON_KEY.');

// Supabase Storage validates the Firebase ID token through Supabase's Firebase
// third-party-auth integration. Do not replace this with a Supabase service-role key.
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  accessToken: async () => {
    const user = auth.currentUser;
    return user ? user.getIdToken() : null;
  },
});
