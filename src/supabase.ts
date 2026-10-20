import { createClient } from '@supabase/supabase-js';
import { auth } from './firebase';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://hbtfxtompvddvdmejnzl.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseAnonKey) {
  console.warn('UP2 Supabase is missing VITE_SUPABASE_ANON_KEY. Add it to your local .env.local and deployment environment variables.');
}

// Supabase Storage validates the Firebase ID token through Supabase's Firebase
// third-party-auth integration. Do not replace this with a Supabase service-role key.
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  accessToken: async () => {
    const user = auth.currentUser;
    return user ? user.getIdToken() : null;
  },
});
