# Sistema de Interpretação Bidirecional Libras

## Visão Geral

O Sistema de Interpretação Bidirecional Libras é uma aplicação web que facilita a comunicação entre professores (falantes de português) e alunos surdos (usuários de Libras). O sistema oferece tradução em tempo real nos dois sentidos:

- **Professor → Aluno**: Fala em português é convertida em vídeos de interpretação em Libras
- **Aluno → Professor**: Gestos em Libras são convertidos em texto e áudio em português

## Tecnologias Utilizadas

### Frontend
- **React 19** com TypeScript
- **Tailwind CSS 4** para estilização
- **tRPC 11** para comunicação type-safe com o backend
- **Web Speech API** para reconhecimento de fala e síntese de voz
- **MediaPipe Hands** (planejado) para detecção de gestos

### Backend
- **Express 4** com TypeScript
- **tRPC 11** para API type-safe
- **MySQL/TiDB** para armazenamento de dados
- **Drizzle ORM** para gerenciamento do banco de dados

### APIs Externas
- **VLibras API** (gov.br) - Tradução de português para Libras
- **Web Speech API** (nativa do navegador) - Reconhecimento de fala e síntese de voz

## Estrutura do Projeto

```
interprete-libras/
├── client/                 # Frontend React
│   ├── src/
│   │   ├── pages/         # Páginas da aplicação
│   │   │   ├── Home.tsx           # Seleção de modo
│   │   │   ├── ProfessorMode.tsx  # Modo Professor
│   │   │   ├── StudentMode.tsx    # Modo Aluno
│   │   │   └── History.tsx        # Histórico
│   │   ├── components/    # Componentes reutilizáveis
│   │   ├── lib/          # Configurações (tRPC)
│   │   └── index.css     # Estilos globais
├── server/                # Backend Express + tRPC
│   ├── routers.ts        # Definição dos routers tRPC
│   ├── db.ts             # Funções de acesso ao banco
│   ├── vlibras.ts        # Integração com VLibras API
│   └── _core/            # Infraestrutura do servidor
├── drizzle/              # Schema e migrações do banco
│   └── schema.ts         # Definição das tabelas
└── shared/               # Código compartilhado
```

## Funcionalidades

### 1. Modo Professor (Fala → Libras)

**Objetivo**: Permitir que o professor fale e suas palavras sejam traduzidas para Libras em vídeo.

**Fluxo de Funcionamento**:
1. Professor clica no botão de microfone para iniciar gravação
2. Web Speech API captura e transcreve a fala em tempo real
3. Texto é enviado para a API VLibras via tRPC
4. VLibras traduz o texto para glosa e gera vídeo de interpretação
5. Vídeo é exibido na tela para os alunos

**Componentes Principais**:
- `ProfessorMode.tsx` - Interface principal
- Reconhecimento de fala com Web Speech API
- Integração com VLibras via `server/vlibras.ts`

**Procedimentos tRPC**:
- `professor.translateToLibras` - Traduz texto e solicita geração de vídeo
- `professor.getVideoStatus` - Verifica status da geração
- `professor.getVideoUrl` - Obtém URL do vídeo gerado

### 2. Modo Aluno (Libras → Fala)

**Objetivo**: Permitir que o aluno faça gestos em Libras e sejam convertidos em fala.

**Fluxo de Funcionamento**:
1. Aluno ativa a câmera
2. MediaPipe Hands (planejado) captura landmarks das mãos
3. Modelo de ML reconhece os gestos
4. Gestos são convertidos em texto português
5. Web Speech API converte texto em áudio
6. Áudio é reproduzido automaticamente

**Componentes Principais**:
- `StudentMode.tsx` - Interface principal
- Captura de vídeo via webcam
- Síntese de voz com Web Speech API

**Procedimentos tRPC**:
- `student.recognizeGesture` - Processa landmarks e reconhece gesto

**Nota**: O reconhecimento completo de gestos com MediaPipe Hands está planejado para implementação futura. Atualmente, há uma simulação para demonstração.

### 3. Histórico de Sessões

**Objetivo**: Permitir visualização de sessões anteriores e estatísticas de uso.

**Funcionalidades**:
- Lista de sessões anteriores
- Detalhes de cada sessão
- Estatísticas de uso (número de traduções, tempo de uso, etc.)

**Procedimentos tRPC**:
- `session.create` - Cria nova sessão
- `session.end` - Finaliza sessão
- `session.list` - Lista sessões do usuário
- `session.getById` - Obtém detalhes de uma sessão
- `translation.save` - Salva tradução no histórico
- `translation.listBySession` - Lista traduções de uma sessão

## Banco de Dados

### Tabelas

#### `users`
Tabela de usuários (gerenciada pelo sistema de autenticação)
- `id` - ID único do usuário
- `openId` - ID OAuth do Manus
- `name` - Nome do usuário
- `email` - Email do usuário
- `role` - Papel (user/admin)

#### `sessions`
Sessões de interpretação
- `id` - ID único da sessão
- `userId` - ID do usuário (FK → users)
- `title` - Título da sessão
- `type` - Tipo (professor/aluno)
- `startedAt` - Data/hora de início
- `endedAt` - Data/hora de término
- `createdAt` - Data de criação

#### `translations`
Histórico de traduções
- `id` - ID único da tradução
- `sessionId` - ID da sessão (FK → sessions)
- `type` - Tipo (speech_to_libras/libras_to_speech)
- `originalText` - Texto original
- `translatedText` - Texto traduzido
- `videoUrl` - URL do vídeo (para traduções Libras)
- `confidence` - Confiança da tradução (0-100)
- `createdAt` - Data de criação

#### `gestures`
Gestos de Libras treinados (para expansão futura)
- `id` - ID único do gesto
- `word` - Palavra em português
- `gloss` - Glosa em Libras
- `landmarksData` - Dados de landmarks (JSON)
- `createdAt` - Data de criação

## Instalação e Configuração

### Pré-requisitos
- Node.js 22+
- pnpm
- Banco de dados MySQL/TiDB

### Instalação

1. Clone o repositório e instale as dependências:
```bash
cd interprete-libras
pnpm install
```

2. Configure as variáveis de ambiente (já configuradas automaticamente pela plataforma Manus)

3. Execute as migrações do banco de dados:
```bash
pnpm db:push
```

4. Inicie o servidor de desenvolvimento:
```bash
pnpm dev
```

5. Acesse a aplicação em: `http://localhost:3000`

## Uso do Sistema

### Para Professores

1. Faça login no sistema
2. Selecione "Modo Professor" na página inicial
3. Clique no botão de microfone para iniciar
4. Fale normalmente - o sistema transcreverá automaticamente
5. Aguarde a geração do vídeo em Libras
6. O vídeo será exibido para os alunos

**Dicas**:
- Fale de forma clara e pausada
- Evite ambientes muito barulhentos
- Posicione o microfone adequadamente
- Aguarde a tradução ser processada antes de continuar

### Para Alunos

1. Faça login no sistema
2. Selecione "Modo Aluno" na página inicial
3. Clique em "Iniciar Câmera"
4. Posicione-se em frente à câmera
5. Faça os gestos em Libras
6. O sistema reconhecerá e converterá em fala

**Dicas**:
- Certifique-se de ter boa iluminação
- Mantenha as mãos visíveis na câmera
- Faça os gestos de forma clara e pausada

## Limitações Conhecidas

### VLibras API
- API gratuita do governo brasileiro
- Pode ter limitações de taxa de requisições
- Geração de vídeo pode levar alguns segundos
- Qualidade da tradução depende da API

### Web Speech API
- Disponível apenas em navegadores modernos (Chrome, Edge, Safari)
- Requer permissão de microfone do usuário
- Qualidade do reconhecimento varia por navegador
- Funciona melhor em ambientes silenciosos

### MediaPipe Hands (Planejado)
- Requer boa iluminação
- Funciona melhor com fundo neutro
- Limitado a 21 landmarks por mão
- Necessita treinamento de modelo de ML para reconhecimento preciso

## Desenvolvimento Futuro

### Melhorias Planejadas

1. **Reconhecimento Avançado de Libras**
   - Implementar MediaPipe Hands completo
   - Treinar modelo de ML para reconhecimento de gestos
   - Suporte a frases completas em Libras
   - Reconhecimento de expressões faciais

2. **Otimizações de Performance**
   - Cache de vídeos VLibras para palavras comuns
   - Processamento local de gestos quando possível
   - Otimização de latência na tradução

3. **Funcionalidades Adicionais**
   - Modo de treinamento de novos gestos
   - Suporte a múltiplos usuários simultâneos
   - Gravação de sessões completas
   - Exportação de transcrições

4. **Acessibilidade**
   - Suporte a diferentes dialetos de Libras
   - Ajuste de velocidade de reprodução de vídeos
   - Temas de alto contraste
   - Atalhos de teclado

## Suporte e Contribuição

Para reportar problemas ou sugerir melhorias, entre em contato através da plataforma Manus.

## Licença

Este projeto foi desenvolvido como parte da plataforma Manus.

---

**Desenvolvido com ❤️ para promover a inclusão e acessibilidade na educação**
