import { useState, useRef, useEffect } from 'react';
import { Square, X, Paperclip, Globe, ArrowUp, Loader2, FileText } from 'lucide-react';
import { parseFile, isSupportedFileType, type ParsedFile } from '../lib/fileParser';

interface ChatInputProps {
    onSendMessage: (content: string, imageBase64?: string, parsedFile?: ParsedFile) => void;
    onStop: () => void;
    isStreaming: boolean;
    disabled: boolean;
    // Deep Research Props
    isWebSearchEnabled?: boolean;
    onToggleWebSearch?: () => void;
}

export function ChatInput({
    onSendMessage,
    onStop,
    isStreaming,
    disabled,
    // Deep Research Props
    isWebSearchEnabled = false,
    onToggleWebSearch,
}: ChatInputProps) {
    const [content, setContent] = useState('');
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const [imageBase64, setImageBase64] = useState<string | null>(null);
    const [documentFile, setDocumentFile] = useState<ParsedFile | null>(null);
    const [isProcessingFile, setIsProcessingFile] = useState(false);
    const [isDragging, setIsDragging] = useState(false);

    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const dropZoneRef = useRef<HTMLDivElement>(null);

    // Auto-resize textarea
    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = `${Math.min(
                textareaRef.current.scrollHeight,
                200
            )}px`;
        }
    }, [content]);

    // =====================================================
    // File Processing
    // =====================================================
    const processFile = async (file: File) => {
        setIsProcessingFile(true);

        try {
            if (file.type.startsWith('image/')) {
                if (file.size > 10 * 1024 * 1024) {
                    alert('Imagem muito grande. Máximo 10MB.');
                    return;
                }

                const reader = new FileReader();
                reader.onload = (event) => {
                    const base64 = event.target?.result as string;
                    setImagePreview(base64);
                    setImageBase64(base64);
                };
                reader.readAsDataURL(file);
            } else if (isSupportedFileType(file)) {
                const parsed = await parseFile(file);
                setDocumentFile(parsed);

                if (parsed.error) {
                    alert(parsed.error);
                }
            } else {
                alert('Tipo de arquivo não suportado. Use: PDF, DOCX, TXT, MD, CSV, JSON ou imagens.');
            }
        } catch (error) {
            alert('Erro ao processar arquivo: ' + (error instanceof Error ? error.message : 'Erro desconhecido'));
        } finally {
            setIsProcessingFile(false);
            // Reset input value to allow selecting the same file again
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
        }
    };

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        await processFile(file);
    };

    const handleFileClick = () => {
        fileInputRef.current?.click();
    };

    // =====================================================
    // Drag and Drop
    // =====================================================
    const handleDragEnter = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(true);
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.currentTarget === dropZoneRef.current) {
            setIsDragging(false);
        }
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
    };

    const handleDrop = async (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);

        const file = e.dataTransfer.files?.[0];
        if (file) {
            await processFile(file);
        }
    };

    // =====================================================
    // Paste
    // =====================================================
    const handlePaste = async (e: React.ClipboardEvent) => {
        const items = e.clipboardData?.items;
        if (!items) return;

        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            if (item.kind === 'file') {
                e.preventDefault();
                const file = item.getAsFile();
                if (file) {
                    await processFile(file);
                }
                break;
            }
        }
    };

    const removeAttachment = () => {
        setImagePreview(null);
        setImageBase64(null);
        setDocumentFile(null);
    };

    const handleSubmit = (e?: React.FormEvent) => {
        e?.preventDefault();

        if (isStreaming) {
            onStop();
            return;
        }

        if ((!content.trim() && !imageBase64 && !documentFile) || disabled) return;

        onSendMessage(content, imageBase64 || undefined, documentFile || undefined);
        setContent('');
        removeAttachment();

        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto'; // Reset height
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSubmit();
        }
    };

    const canSend = content.trim() || imageBase64 || documentFile;

    return (
        <div className="fixed bottom-0 right-0 z-40 left-0 md:left-64 p-4 md:pb-6 bg-gradient-to-t from-dark-bg via-dark-bg/95 to-transparent transition-all duration-300">
            <div className="relative w-full max-w-4xl mx-auto">

                {/* Drag Overlay */}
                {isDragging && (
                    <div className="absolute -top-12 inset-x-0 h-[300px] flex items-center justify-center bg-matrix-primary/20 rounded-2xl pointer-events-none z-50 border-2 border-dashed border-matrix-primary backdrop-blur-sm animate-in fade-in zoom-in">
                        <div className="flex flex-col items-center gap-3 bg-black/90 px-8 py-6 rounded-xl border border-matrix-primary">
                            <ArrowUp className="w-10 h-10 text-matrix-primary animate-bounce" />
                            <span className="text-lg font-bold text-matrix-primary tracking-wider">
                                SOLTE O ARQUIVO
                            </span>
                        </div>
                    </div>
                )}

                {/* Main Card Container */}
                <div
                    ref={dropZoneRef}
                    onDragEnter={handleDragEnter}
                    onDragLeave={handleDragLeave}
                    onDragOver={handleDragOver}
                    onDrop={handleDrop}
                    className={`flex flex-col bg-zinc-900/80 backdrop-blur-md border border-zinc-800 hover:border-zinc-700 transition-all duration-300 rounded-2xl shadow-xl overflow-hidden
                        ${isDragging ? 'border-matrix-primary ring-1 ring-matrix-primary' : ''}
                        ${isWebSearchEnabled ? 'shadow-[0_0_20px_rgba(0,0,0,0.5)]' : ''}
                    `}
                >
                    {/* Previews Area (if attachments exist) */}
                    {(imagePreview || documentFile) && (
                        <div className="px-4 pt-4 pb-0">
                            {imagePreview && (
                                <div className="relative inline-block group">
                                    <img
                                        src={imagePreview}
                                        alt="Preview"
                                        className="h-16 w-auto rounded-lg border border-white/10 object-cover"
                                    />
                                    <button
                                        onClick={removeAttachment}
                                        className="absolute -top-2 -right-2 p-1 bg-zinc-800 border border-zinc-700 rounded-full text-zinc-400 hover:text-red-400 hover:border-red-400 transition-colors shadow-lg"
                                    >
                                        <X className="w-3 h-3" />
                                    </button>
                                </div>
                            )}
                            {documentFile && (
                                <div className="relative inline-flex items-center gap-3 p-2 bg-white/5 border border-white/10 rounded-lg max-w-[250px]">
                                    <div className="p-1.5 bg-matrix-primary/20 rounded">
                                        <FileText className="w-4 h-4 text-matrix-primary" />
                                    </div>
                                    <span className="text-xs text-zinc-300 truncate font-mono">
                                        {documentFile.fileName}
                                    </span>
                                    <button
                                        onClick={removeAttachment}
                                        className="p-1 text-zinc-500 hover:text-red-400 transition-colors"
                                    >
                                        <X className="w-3 h-3" />
                                    </button>
                                </div>
                            )}
                        </div>
                    )}

                    {/* TextArea */}
                    <textarea
                        ref={textareaRef}
                        value={content}
                        onChange={(e) => setContent(e.target.value)}
                        onKeyDown={handleKeyDown}
                        onPaste={handlePaste}
                        placeholder={
                            isWebSearchEnabled
                                ? "Deep Research Ativo: O que deseja investigar na web?"
                                : "Envie uma mensagem para o Prometheus..."
                        }
                        rows={1}
                        disabled={disabled}
                        className="w-full bg-transparent border-none focus:ring-0 text-white placeholder-zinc-500 min-h-[50px] max-h-[200px] resize-none px-4 py-3 scrollbar-hide text-[15px] sm:text-base leading-relaxed"
                    />

                    {/* Toolbar (Bottom Bar) */}
                    <div className="flex justify-between items-center px-2 pb-2 pt-0">
                        {/* Left Tools */}
                        <div className="flex items-center gap-1">
                            {/* Attachment Button */}
                            <button
                                onClick={handleFileClick}
                                disabled={isProcessingFile || disabled}
                                className="p-2 text-zinc-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors group relative"
                                title="Adicionar arquivo"
                            >
                                {isProcessingFile ? (
                                    <Loader2 className="w-5 h-5 animate-spin text-matrix-primary" />
                                ) : (
                                    <Paperclip className="w-5 h-5" />
                                )}
                            </button>

                            {/* Deep Research Button */}
                            <button
                                onClick={onToggleWebSearch}
                                disabled={disabled || isStreaming}
                                className={`p-2 rounded-lg transition-all flex items-center gap-2 
                                    ${isWebSearchEnabled
                                        ? 'text-green-500 bg-green-500/10 hover:bg-green-500/20'
                                        : 'text-zinc-400 hover:text-white hover:bg-white/5'
                                    }`}
                                title={isWebSearchEnabled ? "Desativar Deep Research" : "Ativar Deep Research (Apenas Prometheus)"}
                            >
                                <Globe className={`w-5 h-5 ${isWebSearchEnabled ? 'animate-pulse' : ''}`} />
                                {isWebSearchEnabled && (
                                    <span className="text-xs font-mono font-bold hidden md:inline text-green-500 animate-in fade-in slide-in-from-left-2">
                                        WEB ON
                                    </span>
                                )}
                            </button>
                        </div>

                        {/* Right Actions */}
                        <button
                            onClick={handleSubmit}
                            disabled={(!canSend && !isStreaming) || (disabled && !isStreaming)}
                            className={`p-2 rounded-xl transition-all duration-200 flex items-center justify-center
                                ${isStreaming
                                    ? 'bg-red-500/10 text-red-500 hover:bg-red-500/20'
                                    : (canSend)
                                        ? 'bg-white text-black hover:bg-zinc-200 shadow-[0_0_15px_rgba(255,255,255,0.1)]'
                                        : 'bg-zinc-800 text-zinc-600 cursor-not-allowed'
                                }`}
                        >
                            {isStreaming ? (
                                <Square className="w-5 h-5 fill-current scale-90" />
                            ) : (
                                <ArrowUp className={`w-5 h-5 ${canSend ? 'scale-110' : ''}`} />
                            )}
                        </button>
                    </div>
                </div>
            </div>

            {/* Hidden Input for Files (Universal) */}
            <input
                ref={fileInputRef}
                type="file"
                accept="image/*,video/*,.pdf,.docx,.txt,.md,.csv,.json"
                onChange={handleFileSelect}
                className="hidden"
            />
        </div>
    );
}

export default ChatInput;
