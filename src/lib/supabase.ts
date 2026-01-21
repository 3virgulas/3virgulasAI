// =====================================================
// Supabase Client
// =====================================================
// Cliente configurado para autenticação e database
// =====================================================

import { createClient } from '@supabase/supabase-js';
import { env } from '../config/env';

// Criar cliente Supabase
export const supabase = createClient(
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

