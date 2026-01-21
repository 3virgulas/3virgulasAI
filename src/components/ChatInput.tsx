import { useState, useRef, useEffect } from 'react';
import { SendHorizontal, Square, ImagePlus, X } from 'lucide-react';

interface ChatInputProps {
    onSendMessage: (content: string, imageBase64?: string) => void;
    onStop: () => void;
    isStreaming: boolean;
    disabled: boolean;
}

export function ChatInput({
    onSendMessage,
    onStop,
    isStreaming,
    disabled,
}: ChatInputProps) {
    const [content, setContent] = useState('');
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const [imageBase64, setImageBase64] = useState<string | null>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = `${Math.min(
                textareaRef.current.scrollHeight,
                200
            )}px`;
        }
    }, [content]);

    const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Validar tipo
        if (!file.type.startsWith('image/')) {
            alert('Por favor, selecione apenas imagens.');
            return;
        }

        // Validar tamanho (max 10MB)
        if (file.size > 10 * 1024 * 1024) {
            alert('Imagem muito grande. Máximo 10MB.');
            return;
        }

        // Converter para base64
        const reader = new FileReader();
        reader.onload = (event) => {
            const base64 = event.target?.result as string;
            setImagePreview(base64);
            setImageBase64(base64);
        };
        reader.readAsDataURL(file);

        // Limpar input para permitir selecionar mesma imagem
        e.target.value = '';
    };

    const removeImage = () => {
        setImagePreview(null);
        setImageBase64(null);
    };

    const handleSubmit = (e?: React.FormEvent) => {
        e?.preventDefault();

        if (isStreaming) {
            onStop();
            return;
        }

        if ((!content.trim() && !imageBase64) || disabled) return;

        onSendMessage(content, imageBase64 || undefined);
        setContent('');
        removeImage();

        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSubmit();
        }
    };

    const canSend = content.trim() || imageBase64;

    return (
        <div className="p-4 bg-dark-bg border-t border-dark-border">
            <div className="max-w-4xl mx-auto">
                {/* Image Preview */}
                {imagePreview && (
                    <div className="mb-3 flex items-start gap-2">
                        <div className="relative group">
                            <img
                                src={imagePreview}
                                alt="Preview"
                                className="h-20 w-auto rounded-lg border border-dark-border object-cover"
                            />
                            <button
                                onClick={removeImage}
                                className="absolute -top-2 -right-2 p-1 bg-dark-surface border border-dark-border rounded-full text-dark-text-muted hover:text-red-400 hover:border-red-400 transition-colors"
                            >
                                <X className="w-3 h-3" />
                            </button>
                        </div>
                        <span className="text-xs text-matrix-primary font-mono mt-1">
                            📷 Imagem anexada
                        </span>
                    </div>
                )}

                {/* Input Area */}
                <div className="relative flex items-end bg-dark-surface border border-dark-border rounded-lg focus-within:border-matrix-primary/50 transition-all">
                    {/* Image Upload Button */}
                    <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={disabled}
                        className="flex-shrink-0 p-3 text-dark-text-muted hover:text-matrix-primary transition-colors disabled:opacity-50"
                        title="Anexar imagem"
                    >
                        <ImagePlus className="w-5 h-5" />
                    </button>
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleImageSelect}
                        className="hidden"
                    />

                    {/* Text Input */}
                    <textarea
                        ref={textareaRef}
                        value={content}
                        onChange={(e) => setContent(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder={imageBase64 ? "Pergunte sobre a imagem..." : "Digite sua mensagem..."}
                        disabled={disabled}
                        rows={1}
                        className="w-full bg-transparent border-0 focus:ring-0 focus:outline-none resize-none py-4 pl-0 pr-14 max-h-[200px] text-dark-text-primary placeholder-dark-text-muted disabled:opacity-50"
                        style={{ minHeight: '56px' }}
                    />

                    {/* Send Button */}
                    <div className="absolute right-2 bottom-2">
                        <button
                            onClick={handleSubmit}
                            disabled={(!canSend && !isStreaming) || (disabled && !isStreaming)}
                            className={`p-2.5 rounded-lg transition-all ${isStreaming
                                    ? 'bg-red-500/20 text-red-400 border border-red-500/50 hover:bg-red-500/30'
                                    : canSend
                                        ? 'bg-matrix-primary/20 text-matrix-primary border border-matrix-primary/50 hover:bg-matrix-primary/30'
                                        : 'bg-dark-hover text-dark-text-muted cursor-not-allowed'
                                }`}
                        >
                            {isStreaming ? (
                                <Square className="w-5 h-5 fill-current" />
                            ) : (
                                <SendHorizontal className="w-5 h-5" />
                            )}
                        </button>
                    </div>
                </div>

                {/* Hints */}
                <div className="mt-2 flex justify-center items-center gap-4 text-xs text-dark-text-muted select-none font-mono">
                    <span className="flex items-center gap-1">
                        <kbd className="px-1.5 py-0.5 bg-dark-hover border border-dark-border rounded text-[10px]">Enter</kbd>
                        <span className="text-dark-text-muted/70">enviar</span>
                    </span>
                    <span className="text-dark-border">|</span>
                    <span className="flex items-center gap-1">
                        <kbd className="px-1.5 py-0.5 bg-dark-hover border border-dark-border rounded text-[10px]">📷</kbd>
                        <span className="text-dark-text-muted/70">anexar</span>
                    </span>
                </div>
            </div>
        </div>
    );
}

export default ChatInput;
