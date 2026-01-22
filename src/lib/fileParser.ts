import * as pdfjsLib from 'pdfjs-dist';
import * as mammoth from 'mammoth';

// Configurar worker do PDF.js
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

export interface ParsedFile {
    fileName: string;
    fileSize: number;
    fileType: string;
    textContent: string;
    pageCount?: number;
    error?: string;
}

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_CHARACTERS = 100000; // ~25k tokens (limite seguro)
const MAX_PDF_PAGES = 50;

/**
 * Extrai texto de arquivo PDF
 */
async function parsePDF(file: File): Promise<ParsedFile> {
    try {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

        const pageCount = pdf.numPages;

        // Verificar limite de páginas
        if (pageCount > MAX_PDF_PAGES) {
            return {
                fileName: file.name,
                fileSize: file.size,
                fileType: 'pdf',
                textContent: '',
                pageCount,
                error: `PDF muito grande! Limite: ${MAX_PDF_PAGES} páginas. Este PDF tem ${pageCount} páginas.`
            };
        }

        let fullText = '';

        // Extrair texto de cada página
        for (let pageNum = 1; pageNum <= pageCount; pageNum++) {
            const page = await pdf.getPage(pageNum);
            const textContent = await page.getTextContent();
            const pageText = textContent.items
                .map((item: any) => item.str)
                .join(' ');

            fullText += `\n--- Página ${pageNum} ---\n${pageText}\n`;
        }

        // Verificar limite de caracteres
        if (fullText.length > MAX_CHARACTERS) {
            return {
                fileName: file.name,
                fileSize: file.size,
                fileType: 'pdf',
                textContent: fullText.substring(0, MAX_CHARACTERS),
                pageCount,
                error: `Texto truncado! O PDF é muito grande (${fullText.length} caracteres). Mostrando primeiros ${MAX_CHARACTERS} caracteres.`
            };
        }

        return {
            fileName: file.name,
            fileSize: file.size,
            fileType: 'pdf',
            textContent: fullText,
            pageCount
        };
    } catch (error) {
        return {
            fileName: file.name,
            fileSize: file.size,
            fileType: 'pdf',
            textContent: '',
            error: `Erro ao processar PDF: ${error instanceof Error ? error.message : 'Erro desconhecido'}`
        };
    }
}

/**
 * Extrai texto de arquivo DOCX
 */
async function parseDOCX(file: File): Promise<ParsedFile> {
    try {
        const arrayBuffer = await file.arrayBuffer();
        const result = await mammoth.extractRawText({ arrayBuffer });

        const textContent = result.value;

        if (textContent.length > MAX_CHARACTERS) {
            return {
                fileName: file.name,
                fileSize: file.size,
                fileType: 'docx',
                textContent: textContent.substring(0, MAX_CHARACTERS),
                error: `Texto truncado! O documento é muito grande. Mostrando primeiros ${MAX_CHARACTERS} caracteres.`
            };
        }

        return {
            fileName: file.name,
            fileSize: file.size,
            fileType: 'docx',
            textContent
        };
    } catch (error) {
        return {
            fileName: file.name,
            fileSize: file.size,
            fileType: 'docx',
            textContent: '',
            error: `Erro ao processar DOCX: ${error instanceof Error ? error.message : 'Erro desconhecido'}`
        };
    }
}

/**
 * Extrai texto de arquivos de texto simples
 */
async function parseTextFile(file: File): Promise<ParsedFile> {
    try {
        const text = await file.text();

        if (text.length > MAX_CHARACTERS) {
            return {
                fileName: file.name,
                fileSize: file.size,
                fileType: file.type || 'text',
                textContent: text.substring(0, MAX_CHARACTERS),
                error: `Texto truncado! O arquivo é muito grande. Mostrando primeiros ${MAX_CHARACTERS} caracteres.`
            };
        }

        return {
            fileName: file.name,
            fileSize: file.size,
            fileType: file.type || 'text',
            textContent: text
        };
    } catch (error) {
        return {
            fileName: file.name,
            fileSize: file.size,
            fileType: file.type || 'text',
            textContent: '',
            error: `Erro ao ler arquivo: ${error instanceof Error ? error.message : 'Erro desconhecido'}`
        };
    }
}

/**
 * Parser principal que detecta o tipo de arquivo e chama o parser apropriado
 */
export async function parseFile(file: File): Promise<ParsedFile> {
    // Validar tamanho
    if (file.size > MAX_FILE_SIZE) {
        return {
            fileName: file.name,
            fileSize: file.size,
            fileType: file.type,
            textContent: '',
            error: `Arquivo muito grande! Tamanho máximo: 10MB. Tamanho do arquivo: ${(file.size / 1024 / 1024).toFixed(2)}MB.`
        };
    }

    const extension = file.name.split('.').pop()?.toLowerCase();

    switch (extension) {
        case 'pdf':
            return parsePDF(file);

        case 'docx':
            return parseDOCX(file);

        case 'txt':
        case 'md':
        case 'csv':
        case 'json':
        case 'xml':
        case 'html':
        case 'js':
        case 'ts':
        case 'jsx':
        case 'tsx':
        case 'py':
        case 'java':
        case 'c':
        case 'cpp':
        case 'go':
        case 'rs':
            return parseTextFile(file);

        default:
            return {
                fileName: file.name,
                fileSize: file.size,
                fileType: file.type,
                textContent: '',
                error: `Tipo de arquivo não suportado: .${extension}`
            };
    }
}

/**
 * Formata o conteúdo extraído para enviar à IA
 */
export function formatFileContentForAI(parsedFile: ParsedFile, userMessage: string): string {
    const prefix = `[CONTEXTO DO ARQUIVO '${parsedFile.fileName}']`;
    const separator = '\n\n---\n\n';

    let context = `${prefix}\n\n${parsedFile.textContent}${separator}`;

    if (parsedFile.error) {
        context += `⚠️ AVISO: ${parsedFile.error}\n\n`;
    }

    if (parsedFile.pageCount) {
        context += `📄 Total de páginas: ${parsedFile.pageCount}\n\n`;
    }

    context += `Pergunta do usuário: ${userMessage}`;

    return context;
}

/**
 * Verifica se o arquivo é suportado
 */
export function isSupportedFileType(file: File): boolean {
    const extension = file.name.split('.').pop()?.toLowerCase();
    const supportedExtensions = [
        'pdf', 'docx', 'txt', 'md', 'csv', 'json',
        'xml', 'html', 'js', 'ts', 'jsx', 'tsx',
        'py', 'java', 'c', 'cpp', 'go', 'rs'
    ];
    return extension ? supportedExtensions.includes(extension) : false;
}

/**
 * Formata o tamanho do arquivo para exibição
 */
export function formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}
