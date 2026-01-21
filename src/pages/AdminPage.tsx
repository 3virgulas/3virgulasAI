import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useAppSettings } from '../hooks/useAppSettings';
import { Settings, Save, Loader2, ArrowLeft, Sparkles, Bot, ImageIcon, Eye, Cpu } from 'lucide-react';

// =====================================================
// AdminPage
// =====================================================
// Painel administrativo para configurar a IA
// Inclui Vision Proxy para análise de imagens
// =====================================================

const ADMIN_EMAIL = 'contato@3virgulas.com';
const DEFAULT_AVATAR = 'https://api.dicebear.com/7.x/bottts/svg?seed=3virgulas&backgroundColor=22c55e';

export function AdminPage() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const { settings, loading, updateSettings } = useAppSettings();

    const [model, setModel] = useState('');
    const [visionModel, setVisionModel] = useState('');
    const [systemPrompt, setSystemPrompt] = useState('');
    const [avatarUrl, setAvatarUrl] = useState('');
    const [avatarError, setAvatarError] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState(false);

    const isAdmin = user?.email === ADMIN_EMAIL;

    useEffect(() => {
        if (!loading && !isAdmin) {
            navigate('/');
        }
    }, [isAdmin, loading, navigate]);

    useEffect(() => {
        if (settings) {
            setModel(settings.selected_model);
            setVisionModel(settings.vision_model || 'google/gemini-2.0-flash-exp:free');
            setSystemPrompt(settings.system_instruction);
            setAvatarUrl(settings.ai_avatar_url || '');
        }
    }, [settings]);

    const handleAvatarUrlChange = (url: string) => {
        setAvatarUrl(url);
        setAvatarError(false);
    };

    const handleSave = async () => {
        setIsSaving(true);
        setSaveSuccess(false);

        const success = await updateSettings({
            selected_model: model,
            vision_model: visionModel,
            system_instruction: systemPrompt,
            ai_avatar_url: avatarUrl || null,
        });

        setIsSaving(false);

        if (success) {
            setSaveSuccess(true);
            setTimeout(() => setSaveSuccess(false), 3000);
        } else {
            alert('Erro ao salvar configurações. Verifique suas permissões.');
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-dark-bg">
                <Loader2 className="w-8 h-8 animate-spin text-matrix-primary" />
            </div>
        );
    }

    if (!isAdmin) {
        return null;
    }

    const previewUrl = avatarError || !avatarUrl ? DEFAULT_AVATAR : avatarUrl;

    return (
        <div className="min-h-screen bg-dark-bg p-6">
            <div className="max-w-2xl mx-auto">
                {/* Header */}
                <div className="flex items-center gap-4 mb-8">
                    <button
                        onClick={() => navigate('/')}
                        className="p-2 hover:bg-dark-surface rounded-lg transition-colors"
                    >
                        <ArrowLeft className="w-5 h-5 text-dark-text-secondary" />
                    </button>
                    <div>
                        <h1 className="text-2xl font-bold text-dark-text-primary flex items-center gap-2">
                            <Settings className="w-6 h-6 text-matrix-primary" />
                            Admin
                        </h1>
                        <p className="text-dark-text-muted text-sm font-mono">
                            Configure a IA e Vision Proxy
                        </p>
                    </div>
                </div>

                {/* Settings Card */}
                <div className="bg-dark-surface border border-dark-border rounded-xl p-6 space-y-6">
                    <div className="flex items-center gap-3 pb-4 border-b border-dark-border">
                        <Sparkles className="w-5 h-5 text-matrix-primary" />
                        <h2 className="text-lg font-semibold text-dark-text-primary">
                            Modelos de IA
                        </h2>
                    </div>

                    {/* Main Model */}
                    <div className="space-y-2">
                        <label className="block text-sm font-medium text-dark-text-secondary">
                            <span className="flex items-center gap-2">
                                <Cpu className="w-4 h-4" />
                                Modelo Principal (Executor)
                            </span>
                        </label>
                        <input
                            type="text"
                            value={model}
                            onChange={(e) => setModel(e.target.value)}
                            placeholder="ex: nousresearch/hermes-3-llama-3.1-405b:free"
                            className="w-full px-4 py-3 bg-dark-hover border border-dark-border rounded-lg text-dark-text-primary placeholder-dark-text-muted focus:outline-none focus:border-matrix-primary/50 transition-colors font-mono text-sm"
                        />
                        <p className="text-xs text-dark-text-muted">
                            IA sem censura que responde ao usuário. Recebe a descrição visual quando há imagem.
                        </p>
                    </div>

                    {/* Vision Model */}
                    <div className="space-y-2">
                        <label className="block text-sm font-medium text-dark-text-secondary">
                            <span className="flex items-center gap-2">
                                <Eye className="w-4 h-4" />
                                Modelo de Visão (Olheiro)
                            </span>
                        </label>
                        <input
                            type="text"
                            value={visionModel}
                            onChange={(e) => setVisionModel(e.target.value)}
                            placeholder="ex: google/gemini-2.0-flash-exp:free"
                            className="w-full px-4 py-3 bg-dark-hover border border-dark-border rounded-lg text-dark-text-primary placeholder-dark-text-muted focus:outline-none focus:border-matrix-primary/50 transition-colors font-mono text-sm"
                        />
                        <p className="text-xs text-dark-text-muted">
                            Modelo com visão que analisa imagens objetivamente. A descrição é passada para o Executor.
                        </p>
                        <div className="p-3 bg-matrix-primary/5 border border-matrix-primary/20 rounded-lg">
                            <p className="text-xs text-matrix-primary font-mono">
                                💡 Vision Proxy: Modelo 1 descreve → Modelo 2 responde sem censura
                            </p>
                        </div>
                    </div>

                    {/* System Prompt */}
                    <div className="space-y-2">
                        <label className="block text-sm font-medium text-dark-text-secondary">
                            Personalidade (System Prompt)
                        </label>
                        <textarea
                            value={systemPrompt}
                            onChange={(e) => setSystemPrompt(e.target.value)}
                            rows={5}
                            placeholder="Descreva a personalidade..."
                            className="w-full px-4 py-3 bg-dark-hover border border-dark-border rounded-lg text-dark-text-primary placeholder-dark-text-muted focus:outline-none focus:border-matrix-primary/50 transition-colors resize-none text-sm"
                        />
                    </div>

                    {/* Avatar */}
                    <div className="space-y-3">
                        <label className="block text-sm font-medium text-dark-text-secondary">
                            <span className="flex items-center gap-2">
                                <ImageIcon className="w-4 h-4" />
                                Avatar da IA
                            </span>
                        </label>

                        <div className="flex items-start gap-4">
                            <div className="flex-shrink-0">
                                <div className="w-14 h-14 rounded-full overflow-hidden bg-dark-hover border border-dark-border">
                                    {avatarError ? (
                                        <div className="w-full h-full flex items-center justify-center bg-matrix-primary">
                                            <Bot className="w-7 h-7 text-dark-bg" />
                                        </div>
                                    ) : (
                                        <img
                                            src={previewUrl}
                                            alt="Preview"
                                            className="w-full h-full object-cover"
                                            onError={() => setAvatarError(true)}
                                        />
                                    )}
                                </div>
                            </div>

                            <div className="flex-1">
                                <input
                                    type="url"
                                    value={avatarUrl}
                                    onChange={(e) => handleAvatarUrlChange(e.target.value)}
                                    placeholder="https://exemplo.com/avatar.png"
                                    className="w-full px-4 py-2.5 bg-dark-hover border border-dark-border rounded-lg text-dark-text-primary placeholder-dark-text-muted focus:outline-none focus:border-matrix-primary/50 transition-colors text-sm"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Save Button */}
                    <button
                        onClick={handleSave}
                        disabled={isSaving}
                        className={`w-full flex items-center justify-center gap-2 py-3 px-4 rounded-lg font-medium transition-all ${saveSuccess
                                ? 'bg-matrix-primary text-dark-bg'
                                : 'border border-matrix-primary text-matrix-primary hover:bg-matrix-primary/10'
                            } disabled:opacity-50 disabled:cursor-not-allowed`}
                    >
                        {isSaving ? (
                            <Loader2 className="w-5 h-5 animate-spin" />
                        ) : saveSuccess ? (
                            <>✓ Salvo</>
                        ) : (
                            <>
                                <Save className="w-5 h-5" />
                                Salvar
                            </>
                        )}
                    </button>

                    {settings?.updated_at && (
                        <p className="text-center text-[10px] text-dark-text-muted font-mono">
                            Atualizado: {new Date(settings.updated_at).toLocaleString('pt-BR')}
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
}

export default AdminPage;
