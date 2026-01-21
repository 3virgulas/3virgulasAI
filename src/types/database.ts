// =====================================================
// Database Types (Auto-generated with supabase gen types)
// =====================================================
// Por enquanto, tipos manuais baseados no schema
// Execute: npx supabase gen types typescript --local > src/types/database.ts
// =====================================================

export interface Database {
    public: {
        Tables: {
            chats: {
                Row: {
                    id: string;
                    user_id: string;
                    title: string;
                    created_at: string;
                    updated_at: string;
                };
                Insert: {
                    id?: string;
                    user_id: string;
                    title?: string;
                    created_at?: string;
                    updated_at?: string;
                };
                Update: {
                    id?: string;
                    user_id?: string;
                    title?: string;
                    created_at?: string;
                    updated_at?: string;
                };
            };
            messages: {
                Row: {
                    id: string;
                    chat_id: string;
                    role: 'user' | 'assistant' | 'system';
                    content: string;
                    created_at: string;
                };
                Insert: {
                    id?: string;
                    chat_id: string;
                    role: 'user' | 'assistant' | 'system';
                    content: string;
                    created_at?: string;
                };
                Update: {
                    id?: string;
                    chat_id?: string;
                    role?: 'user' | 'assistant' | 'system';
                    content?: string;
                    created_at?: string;
                };
            };
            app_settings: {
                Row: {
                    id: string;
                    selected_model: string;
                    system_instruction: string;
                    ai_avatar_url: string | null;
                    vision_model: string;
                    updated_at: string;
                };
                Insert: {
                    id?: string;
                    selected_model?: string;
                    system_instruction?: string;
                    ai_avatar_url?: string | null;
                    vision_model?: string;
                    updated_at?: string;
                };
                Update: {
                    id?: string;
                    selected_model?: string;
                    system_instruction?: string;
                    ai_avatar_url?: string | null;
                    vision_model?: string;
                    updated_at?: string;
                };
            };
        };
        Views: Record<string, never>;
        Functions: Record<string, never>;
        Enums: Record<string, never>;
    };
}

