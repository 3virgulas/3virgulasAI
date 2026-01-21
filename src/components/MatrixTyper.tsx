// =====================================================
// MatrixTyper Component
// =====================================================
// Efeito de digitação estilo hacker/terminal
// Caracteres "decodificam" antes de se fixar
// =====================================================

import { useState, useEffect, useRef, useMemo } from 'react';

const HACKER_CHARS = '01';
const DECODE_SPEED = 30; // ms entre cada "frame" de decodificação
const CHARS_TO_DECODE = 4; // últimos N caracteres em estado de decodificação

interface MatrixTyperProps {
    text: string;
    isStreaming: boolean;
    className?: string;
}

export function MatrixTyper({ text, isStreaming, className = '' }: MatrixTyperProps) {
    const [displayText, setDisplayText] = useState('');
    const [decodingChars, setDecodingChars] = useState<string[]>([]);
    const previousLengthRef = useRef(0);
    const frameRef = useRef<number>();

    // Gerar caracteres aleatórios para o efeito de decodificação
    const getRandomChar = () => HACKER_CHARS[Math.floor(Math.random() * HACKER_CHARS.length)];

    useEffect(() => {
        if (!isStreaming) {
            // Se não está em streaming, mostra o texto completo
            setDisplayText(text);
            setDecodingChars([]);
            return;
        }

        // Atualizar o texto visível
        const updateDisplay = () => {
            const currentLength = text.length;
            const newCharsCount = currentLength - previousLengthRef.current;

            if (newCharsCount > 0) {
                // Novos caracteres chegaram - adicionar ao texto estável
                const stableText = text.slice(0, Math.max(0, currentLength - CHARS_TO_DECODE));
                setDisplayText(stableText);

                // Últimos caracteres ficam "decodificando"
                const decodingPart = text.slice(-CHARS_TO_DECODE);
                const randomized = decodingPart.split('').map((char) => {
                    // 50% chance de mostrar caractere aleatório, 50% o real
                    if (char === ' ' || char === '\n') return char;
                    return Math.random() > 0.5 ? getRandomChar() : char;
                });
                setDecodingChars(randomized);

                previousLengthRef.current = currentLength;
            }

            if (isStreaming) {
                frameRef.current = requestAnimationFrame(updateDisplay);
            }
        };

        // Iniciar o loop de animação
        const intervalId = setInterval(() => {
            if (text.length > 0) {
                const decodingPart = text.slice(-CHARS_TO_DECODE);
                const randomized = decodingPart.split('').map((char) => {
                    if (char === ' ' || char === '\n') return char;
                    return Math.random() > 0.6 ? getRandomChar() : char;
                });
                setDecodingChars(randomized);
            }
        }, DECODE_SPEED);

        // Atualização inicial
        updateDisplay();

        return () => {
            clearInterval(intervalId);
            if (frameRef.current) {
                cancelAnimationFrame(frameRef.current);
            }
        };
    }, [text, isStreaming]);

    // Renderizar texto com efeito
    const renderedContent = useMemo(() => {
        if (!isStreaming) {
            return text;
        }

        const stableText = displayText;
        const decodingText = decodingChars.join('');

        return stableText + decodingText;
    }, [displayText, decodingChars, isStreaming, text]);

    return (
        <span className={`font-mono ${className}`}>
            <span>{renderedContent}</span>
            {isStreaming && (
                <span className="inline-block w-2 h-5 bg-dark-text-primary ml-0.5 animate-pulse align-middle" />
            )}
        </span>
    );
}

// =====================================================
// Versão simplificada para texto que já terminou
// =====================================================

interface HackerTextProps {
    children: string;
    isNew?: boolean;
}

export function HackerText({ children, isNew = false }: HackerTextProps) {
    const [revealed, setRevealed] = useState(!isNew);
    const [displayText, setDisplayText] = useState(isNew ? '' : children);

    useEffect(() => {
        if (!isNew || revealed) {
            setDisplayText(children);
            return;
        }

        // Efeito de reveal rápido para mensagens novas
        let currentIndex = 0;
        const intervalId = setInterval(() => {
            currentIndex += 3; // Revelar 3 caracteres por vez
            if (currentIndex >= children.length) {
                setDisplayText(children);
                setRevealed(true);
                clearInterval(intervalId);
            } else {
                const revealedPart = children.slice(0, currentIndex);
                const hiddenPart = children.slice(currentIndex, currentIndex + 4)
                    .split('')
                    .map((c) => (c === ' ' || c === '\n' ? c : HACKER_CHARS[Math.floor(Math.random() * HACKER_CHARS.length)]))
                    .join('');
                setDisplayText(revealedPart + hiddenPart);
            }
        }, 15);

        return () => clearInterval(intervalId);
    }, [children, isNew, revealed]);

    return (
        <span className="font-mono">
            {displayText}
        </span>
    );
}

export default MatrixTyper;
