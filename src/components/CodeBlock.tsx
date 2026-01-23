// =====================================================
// CodeBlock Component
// =====================================================
// Terminal-style code renderer with syntax highlighting
// Features: Copy button, language display, Matrix theme
// =====================================================

import { useState, useCallback } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { Copy, Check } from 'lucide-react';

interface CodeBlockProps {
    language?: string;
    children: string;
}

export function CodeBlock({ language = 'text', children }: CodeBlockProps) {
    const [copied, setCopied] = useState(false);

    const handleCopy = useCallback(async () => {
        try {
            await navigator.clipboard.writeText(children);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            console.error('Failed to copy:', err);
        }
    }, [children]);

    // Normalize language name for display
    const displayLanguage = language?.toUpperCase() || 'CODE';

    return (
        <div className="my-3 rounded-lg overflow-hidden border border-matrix-primary/20 bg-[#0a0a0a]">
            {/* Terminal Header */}
            <div className="flex items-center justify-between px-4 py-2 bg-[#0d0d0d] border-b border-matrix-primary/10">
                {/* Language Badge */}
                <span className="text-xs font-mono text-matrix-primary/70 uppercase tracking-wider">
                    {displayLanguage}
                </span>

                {/* Copy Button */}
                <button
                    onClick={handleCopy}
                    className="flex items-center gap-1.5 px-2 py-1 text-xs font-mono rounded transition-all duration-200 hover:bg-matrix-primary/10"
                    title="Copiar código"
                >
                    {copied ? (
                        <>
                            <Check className="w-3.5 h-3.5 text-matrix-primary" />
                            <span className="text-matrix-primary">Copiado!</span>
                        </>
                    ) : (
                        <>
                            <Copy className="w-3.5 h-3.5 text-dark-text-muted" />
                            <span className="text-dark-text-muted">Copiar</span>
                        </>
                    )}
                </button>
            </div>

            {/* Code Body */}
            <div className="overflow-x-auto">
                <SyntaxHighlighter
                    language={language || 'text'}
                    style={vscDarkPlus}
                    customStyle={{
                        margin: 0,
                        padding: '1rem',
                        background: 'transparent',
                        fontSize: '0.875rem',
                        lineHeight: '1.5',
                    }}
                    codeTagProps={{
                        style: {
                            fontFamily: "'Fira Code', 'Cascadia Code', 'JetBrains Mono', 'Courier New', monospace",
                        },
                    }}
                    showLineNumbers={children.split('\n').length > 3}
                    lineNumberStyle={{
                        minWidth: '2.5em',
                        paddingRight: '1em',
                        color: 'rgba(0, 255, 0, 0.2)',
                        userSelect: 'none',
                    }}
                >
                    {children}
                </SyntaxHighlighter>
            </div>
        </div>
    );
}

// Inline code component for single-line code
export function InlineCode({ children }: { children: React.ReactNode }) {
    return (
        <code className="px-1.5 py-0.5 mx-0.5 rounded bg-dark-surface text-matrix-primary font-mono text-sm">
            {children}
        </code>
    );
}

export default CodeBlock;
