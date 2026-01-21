// =====================================================
// Environment Configuration
// =====================================================
// Centraliza todas as variáveis de ambiente
// =====================================================

interface EnvConfig {
    // Supabase
    SUPABASE_URL: string;
    SUPABASE_ANON_KEY: string;

    // OpenRouter
    OPENROUTER_API_KEY: string;

    // App
    APP_NAME: string;
    APP_URL: string;
    IS_DEV: boolean;
}

function getEnvVar(key: string, defaultValue?: string): string {
    const value = import.meta.env[key] || defaultValue;

    if (!value && !defaultValue) {
        console.warn(`⚠️ Variável de ambiente ${key} não definida`);
    }

    return value || '';
}

export const env: EnvConfig = {
    // Supabase
    SUPABASE_URL: getEnvVar('VITE_SUPABASE_URL'),
    SUPABASE_ANON_KEY: getEnvVar('VITE_SUPABASE_ANON_KEY'),

    // OpenRouter
    OPENROUTER_API_KEY: getEnvVar('VITE_OPENROUTER_API_KEY'),

    // App
    APP_NAME: getEnvVar('VITE_APP_NAME', '3Vírgulas'),
    APP_URL: getEnvVar('VITE_APP_URL', 'http://localhost:5173'),
    IS_DEV: import.meta.env.DEV,
};

// Validação em desenvolvimento
if (env.IS_DEV) {
    const missingVars: string[] = [];

    if (!env.SUPABASE_URL) missingVars.push('VITE_SUPABASE_URL');
    if (!env.SUPABASE_ANON_KEY) missingVars.push('VITE_SUPABASE_ANON_KEY');
    if (!env.OPENROUTER_API_KEY) missingVars.push('VITE_OPENROUTER_API_KEY');

    if (missingVars.length > 0) {
        console.warn(
            `\n⚠️ Variáveis de ambiente faltando:\n${missingVars.map(v => `   - ${v}`).join('\n')}\n` +
            `Crie um arquivo .env.local com essas variáveis.\n`
        );
    }
}

export default env;
