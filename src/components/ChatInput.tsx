import { useState, useRef, useEffect } from 'react';
import { SendHorizontal, Square, X, FileText, Loader2, Plus, Image, FolderOpen } from 'lucide-react';
import { parseFile, formatFileSize, isSupportedFileType, type ParsedFile } from '../lib/fileParser';

interface ChatInputProps {
    onSendMessage: (content: string, imageBase64?: string, parsedFile?: ParsedFile) => void;
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
    const [documentFile, setDocumentFile] = useState<ParsedFile | null>(null);
    const [isProcessingFile, setIsProcessingFile] = useState(false);
    const [isDragging, setIsDragging] = useState(false);
    const [isUploadMenuOpen, setIsUploadMenuOpen] = useState(false);

    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const mediaInputRef = useRef<HTMLInputElement>(null);
    const documentInputRef = useRef<HTMLInputElement>(null);
    const dropZoneRef = useRef<HTMLDivElement>(null);
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = `${Math.min(
                textareaRef.current.scrollHeight,
                200
            )}px`;
        }
    }, [content]);

    // Close menu when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setIsUploadMenuOpen(false);
            }
        };

        if (isUploadMenuOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isUploadMenuOpen]);

    // =====================================================
    // File Processing (Unified for Images and Documents)
    // =====================================================
    const processFile = async (file: File) => {
        setIsProcessingFile(true);

        try {
            // Detectar se é imagem ou documento
            if (file.type.startsWith('image/')) {
                // Processar como imagem (comportamento original)
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
                // Processar como documento
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
        }
    };

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        await processFile(file);

        // Limpar input para permitir selecionar mesma imagem
        e.target.value = '';
    };

    // =====================================================
    // Drag and Drop Handlers
    // =====================================================
    const handleDragEnter = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(true);
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();

        // Só remove o highlight se realmente saiu da área
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
    // Paste Handler (Ctrl+V)
    // =====================================================
    const handlePaste = async (e: React.ClipboardEvent) => {
        const items = e.clipboardData?.items;
        if (!items) return;

        // Procurar por arquivo nos itens colados
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
            textareaRef.current.style.height = 'auto';
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
        <div
            ref={dropZoneRef}
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            className={`p-4 bg-dark-bg border-t transition-all ${isDragging
                ? 'border-matrix-primary border-t-2 bg-matrix-primary/5'
                : 'border-dark-border'
                }`}
        >
            <div className="max-w-4xl mx-auto relative">
                {/* Drag Overlay - Full Area */}
                {isDragging && (
                    <div className="absolute inset-0 flex items-center justify-center bg-matrix-primary/20 rounded-xl pointer-events-none z-50 border-2 border-dashed border-matrix-primary">
                        <div className="flex flex-col items-center gap-3 bg-dark-surface/90 px-8 py-6 rounded-lg">
                            <Plus className="w-12 h-12 text-matrix-primary" />
                            <span className="text-lg font-medium text-matrix-primary">
                                Solte a imagem aqui
                            </span>
                            <span className="text-xs text-dark-text-muted">
                                Arraste e solte para anexar
                            </span>
                        </div>
                    </div>
                )}

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
                                onClick={removeAttachment}
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

                {/* Document Preview */}
                {documentFile && (
                    <div className="mb-3 p-3 bg-dark-surface border border-dark-border rounded-lg flex items-start gap-3">
                        <div className="flex-shrink-0 p-2 bg-matrix-primary/10 rounded-lg">
                            <FileText className="w-5 h-5 text-matrix-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-dark-text-primary truncate">
                                        {documentFile.fileName}
                                    </p>
                                    <p className="text-xs text-dark-text-muted mt-0.5">
                                        {formatFileSize(documentFile.fileSize)}
                                        {documentFile.pageCount && ` • ${documentFile.pageCount} páginas`}
                                    </p>
                                    {documentFile.error && (
                                        <p className="text-xs text-yellow-400 mt-1">
                                            ⚠️ {documentFile.error}
                                        </p>
                                    )}
                                </div>
                                <button
                                    onClick={removeAttachment}
                                    className="flex-shrink-0 p-1 text-dark-text-muted hover:text-red-400 transition-colors"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                            <p className="text-xs text-matrix-primary font-mono mt-2">
                                📄 Documento processado ({documentFile.textContent.length} caracteres)
                            </p>
                        </div>
                    </div>
                )}

                {/* Input Area */}
                <div
                    className={`relative flex items-center bg-dark-surface border rounded-lg transition-all ${isDragging
                        ? 'border-matrix-primary'
                        : 'border-dark-border focus-within:border-matrix-primary/50'
                        }`}
                >
                    {/* Upload Menu Trigger (+) */}
                    <div ref={menuRef} className="relative flex-shrink-0">
                        <button
                            type="button"
                            onClick={() => setIsUploadMenuOpen(!isUploadMenuOpen)}
                            disabled={disabled || isProcessingFile}
                            className={`p-3 transition-all disabled:opacity-50 ${isUploadMenuOpen
                                ? 'text-matrix-primary'
                                : 'text-dark-text-muted hover:text-matrix-primary'
                                }`}
                            title="Anexar arquivo"
                        >
                            {isProcessingFile ? (
                                <Loader2 className="w-5 h-5 animate-spin" />
                            ) : (
                                <Plus className={`w-5 h-5 transition-transform duration-200 ${isUploadMenuOpen ? 'rotate-45' : ''
                                    }`} />
                            )}
                        </button>

                        {/* Upload Menu Popover */}
                        {isUploadMenuOpen && (
                            <div className="absolute bottom-full left-0 mb-2 w-48 bg-dark-bg border border-matrix-primary rounded-lg shadow-[0_0_15px_#00FF4130] overflow-hidden z-50">
                                {/* Media Option */}
                                <button
                                    type="button"
                                    onClick={() => {
                                        mediaInputRef.current?.click();
                                        setIsUploadMenuOpen(false);
                                    }}
                                    className="w-full flex items-center gap-3 px-4 py-3 text-dark-text-primary hover:bg-matrix-primary/10 hover:text-matrix-primary transition-colors"
                                >
                                    <Image className="w-4 h-4" />
                                    <span className="text-sm">Mídia (Foto/Vídeo)</span>
                                </button>

                                {/* Separator */}
                                <div className="border-t border-dark-border" />

                                {/* Document Option */}
                                <button
                                    type="button"
                                    onClick={() => {
                                        documentInputRef.current?.click();
                                        setIsUploadMenuOpen(false);
                                    }}
                                    className="w-full flex items-center gap-3 px-4 py-3 text-dark-text-primary hover:bg-matrix-primary/10 hover:text-matrix-primary transition-colors"
                                >
                                    <FolderOpen className="w-4 h-4" />
                                    <span className="text-sm">Documento/Arquivo</span>
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Hidden File Inputs */}
                    <input
                        ref={mediaInputRef}
                        type="file"
                        accept="image/*,video/*"
                        onChange={handleFileSelect}
                        className="hidden"
                    />
                    <input
                        ref={documentInputRef}
                        type="file"
                        accept=".pdf,.docx,.txt,.md,.csv,.json"
                        onChange={handleFileSelect}
                        className="hidden"
                    />

                    {/* Text Input with Paste Support */}
                    <textarea
                        ref={textareaRef}
                        value={content}
                        onChange={(e) => setContent(e.target.value)}
                        onKeyDown={handleKeyDown}
                        onPaste={handlePaste}
                        placeholder={
                            imageBase64 || documentFile
                                ? "Pergunte sobre o arquivo..."
                                : "Digite, cole ou arraste um arquivo..."
                        }
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
            </div>
        </div>
    );
}

export default ChatInput;
