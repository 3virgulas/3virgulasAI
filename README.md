# 3Vírgulas Chat - Uncensored AI

Chat moderno estilo ChatGPT com foco em liberdade de conteúdo, construído com React, Vite, Supabase e OpenRouter.

## 🚀 Stack Tecnológica

- **Frontend**: React 18 + TypeScript + Vite
- **Estilização**: Tailwind CSS (dark mode nativo)
- **Backend/Auth**: Supabase (PostgreSQL + RLS)
- **IA**: OpenRouter API (modelos uncensored)
- **Markdown**: react-markdown + syntax highlighting

## 📋 Pré-requisitos

1. **Node.js** 18+ instalado
2. **Conta Supabase** ([criar aqui](https://supabase.com))
3. **Chave OpenRouter** ([obter aqui](https://openrouter.ai/keys))

## 🛠️ Configuração Inicial

### 1. Instalar Dependências

```bash
npm install
```

### 2. Configurar Variáveis de Ambiente

Copie o arquivo `.env.example` para `.env.local`:

```bash
cp .env.example .env.local
```

Edite `.env.local` e preencha:

```env
VITE_SUPABASE_URL=https://SEU_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=sua_chave_anon_aqui
VITE_OPENROUTER_API_KEY=sk-or-v1-sua_chave_aqui
```

### 3. Configurar Banco de Dados Supabase

#### Opção A: Via Supabase Dashboard

1. Acesse seu projeto no [Supabase Dashboard](https://supabase.com/dashboard)
2. Vá em **SQL Editor**
3. Cole o conteúdo de `supabase/migrations/001_initial_schema.sql`
4. Execute (Run)

#### Opção B: Via Supabase CLI (recomendado)

```bash
# Instalar Supabase CLI
npm install -g supabase

# Login
supabase login

# Linkar projeto
supabase link --project-ref SEU_PROJECT_ID

# Aplicar migração
supabase db push
```

## 🎯 Executar Projeto

### Modo Desenvolvimento

```bash
npm run dev
```

Acesse: http://localhost:5173

### Build de Produção

```bash
npm run build
npm run preview
```

## 🏗️ Estrutura do Projeto

```
3virgulas/
├── src/
│   ├── components/       # Componentes React
│   │   ├── Sidebar.tsx
│   │   ├── MessageList.tsx
│   │   └── ChatInput.tsx
│   ├── hooks/            # Custom hooks
│   │   ├── useChats.ts
│   │   ├── useMessages.ts
│   │   └── useOpenRouter.ts
│   ├── lib/              # Utilitários e clientes
│   │   ├── supabase.ts
│   │   └── openrouter.ts
│   ├── pages/            # Páginas
│   │   └── ChatPage.tsx
│   ├── types/            # TypeScript types
│   │   ├── chat.ts
│   │   └── database.ts
│   ├── config/           # Configurações
│   │   └── env.ts
│   ├── index.css         # Estilos globais
│   └── main.tsx          # Entry point
├── supabase/
│   └── migrations/       # SQL migrations
│       └── 001_initial_schema.sql
├── .env.example          # Template de variáveis
├── package.json
├── vite.config.ts
├── tailwind.config.js
└── tsconfig.json
```

## 🔐 Segurança (RLS)

O projeto implementa Row Level Security (RLS) no Supabase:

- ✅ Usuários só podem ver seus próprios chats
- ✅ Usuários só podem ver mensagens de seus chats
- ✅ Políticas automáticas de INSERT/UPDATE/DELETE
- ✅ Proteção contra acesso não autorizado

## 📚 Recursos Implementados

### ✅ Fase 1 (Atual)

- [x] Schema do banco (chats + messages)
- [x] Hook OpenRouter com streaming SSE
- [x] Interface dark mode profissional
- [x] Sidebar com histórico de chats
- [x] Área de mensagens com scroll automático
- [x] Input expansível com atalhos de teclado
- [x] Renderização Markdown + syntax highlighting
- [x] Geração automática de títulos
- [x] Indicador de digitação
- [x] Botão para parar geração

### 🔜 Próximas Fases

- [ ] Sistema de autenticação (email/senha)
- [ ] Autenticação social (Google, GitHub)
- [ ] Configurações de modelo por chat
- [ ] Exportar conversas (Markdown, PDF)
- [ ] Busca no histórico
- [ ] Temas customizáveis
- [ ] Suporte a imagens (multimodal)
- [ ] Compartilhamento de conversas

## 🤖 Modelos Disponíveis

O projeto está configurado para usar modelos **uncensored** por padrão:

### Gratuitos
- `nousresearch/hermes-3-llama-3.1-405b:free` (padrão)
- `nousresearch/hermes-2-pro-llama-3-8b`
- `cognitivecomputations/dolphin-llama-3-70b`

### Pagos (Alta Qualidade)
- `anthropic/claude-3.5-sonnet`
- `openai/gpt-4-turbo`
- `meta-llama/llama-3.1-405b-instruct`

Para mudar o modelo, edite `DEFAULT_MODEL` em `src/types/chat.ts`.

## 🐛 Troubleshooting

### Erro: "VITE_SUPABASE_URL não definida"
- Certifique-se de ter criado `.env.local`
- Reinicie o servidor de dev (`npm run dev`)

### Erro: "Unauthorized" no OpenRouter
- Verifique se a chave da API está correta em `.env.local`
- Confirme que tem créditos na conta OpenRouter

### Mensagens não aparecem
- Verifique se aplicou a migração SQL no Supabase
- Confirme que o RLS está habilitado
- Faça login no Supabase Dashboard e verifique as políticas

## 📝 Licença

Projeto pessoal - 3Vírgulas © 2026

## 🤝 Contribuindo

Este é um projeto privado, mas sugestões são bem-vindas!

---

**3Vírgulas Chat** - IA sem censura, direto ao ponto. 🚀
