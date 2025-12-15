
import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_ANON_KEY, ENABLE_CLOUD_SAVES } from '../config';

// Singleton instance
let supabaseInstance: any = null;

export const getSupabase = () => {
    if (!ENABLE_CLOUD_SAVES) return null;
    
    if (!supabaseInstance) {
        supabaseInstance = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    }
    return supabaseInstance;
};
