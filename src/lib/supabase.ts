// =====================================================
// Supabase Client
// =====================================================
// Cliente configurado para autenticação e database
// =====================================================

import { createClient } from '@supabase/supabase-js';
import { env } from '../config/env';
import type { Database } from '../types/database';

// Criar cliente Supabase
export const supabase = createClient<Database>(
    env.SUPABASE_URL,
    env.SUPABASE_ANON_KEY,
    {
        auth: {
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: true,
        },
    }
);

export default supabase;
