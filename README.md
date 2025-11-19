# Sistema de Interpretação Bidirecional Libras

Sistema web de interpretação em tempo real entre português falado e Língua Brasileira de Sinais (Libras).

## 🎯 Objetivo

Facilitar a comunicação bidirecional entre professores (falantes de português) e alunos surdos (usuários de Libras) através de tecnologias de reconhecimento de fala, tradução automática e visão computacional.

## ✨ Funcionalidades

### 🎤 Modo Professor (Fala → Libras)
- Reconhecimento de fala em tempo real (Web Speech API)
- Tradução automática para Libras (VLibras API)
- Geração de vídeos de interpretação em Libras
- Transcrição completa das aulas

### 📹 Modo Aluno (Libras → Fala)
- Captura de gestos via webcam
- Reconhecimento de gestos em Libras (planejado com MediaPipe Hands)
- Conversão para texto em português
- Síntese de voz automática (Web Speech API)

### 📊 Histórico e Estatísticas
- Registro de todas as sessões de interpretação
- Histórico de traduções
- Estatísticas de uso

## 🚀 Início Rápido

### Pré-requisitos
- Node.js 22 ou superior
- pnpm
- Navegador moderno (Chrome, Edge ou Safari recomendados)

### Instalação

```bash
# Instalar dependências
pnpm install

# Executar migrações do banco de dados
pnpm db:push

# Iniciar servidor de desenvolvimento
pnpm dev
```

A aplicação estará disponível em `http://localhost:3000`

## 📖 Como Usar

### Para Professores

1. Acesse o sistema e faça login
2. Selecione **"Modo Professor"**
3. Clique no botão de microfone 🎤 para iniciar
4. Fale normalmente - suas palavras serão transcritas automaticamente
5. Aguarde a geração do vídeo em Libras
6. O vídeo de interpretação será exibido na tela

**💡 Dicas para melhor resultado:**
- Fale de forma clara e pausada
- Use um microfone de qualidade
- Evite ambientes barulhentos
- Aguarde a tradução ser processada antes de continuar

### Para Alunos

1. Acesse o sistema e faça login
2. Selecione **"Modo Aluno"**
3. Clique em "Iniciar Câmera" 📹
4. Posicione-se em frente à câmera
5. Faça os gestos em Libras
6. O sistema converterá automaticamente em fala

**💡 Dicas para melhor resultado:**
- Certifique-se de ter boa iluminação
- Use um fundo neutro se possível
- Mantenha as mãos visíveis na câmera
- Faça os gestos de forma clara

## 🏗️ Arquitetura

### Frontend
- **React 19** + TypeScript
- **Tailwind CSS 4** para estilização
- **tRPC** para comunicação type-safe
- **Web Speech API** para fala e áudio

### Backend
- **Express 4** + TypeScript
- **tRPC 11** para API
- **Drizzle ORM** + MySQL/TiDB
- **VLibras API** para tradução

### Estrutura de Pastas

```
interprete-libras/
├── client/              # Frontend React
│   └── src/
│       ├── pages/       # Páginas da aplicação
│       ├── components/  # Componentes reutilizáveis
│       └── lib/         # Configurações
├── server/              # Backend Express + tRPC
│   ├── routers.ts       # Routers tRPC
│   ├── db.ts            # Acesso ao banco
│   └── vlibras.ts       # Integração VLibras
├── drizzle/             # Schema do banco
└── shared/              # Código compartilhado
```

## 🔧 Tecnologias Utilizadas

- **React 19** - Framework frontend
- **TypeScript** - Tipagem estática
- **Tailwind CSS 4** - Estilização
- **tRPC 11** - API type-safe
- **Express 4** - Servidor backend
- **Drizzle ORM** - ORM para banco de dados
- **MySQL/TiDB** - Banco de dados
- **Web Speech API** - Reconhecimento de fala e síntese
- **VLibras API** - Tradução para Libras
- **MediaPipe Hands** (planejado) - Detecção de gestos

## 📊 Banco de Dados

### Tabelas Principais

- **users** - Usuários do sistema
- **sessions** - Sessões de interpretação
- **translations** - Histórico de traduções
- **gestures** - Gestos de Libras (para expansão futura)

## 🔐 Autenticação

O sistema utiliza autenticação OAuth via plataforma Manus. As credenciais são gerenciadas automaticamente.

## 🌐 APIs Externas

### VLibras API
- **Provedor**: Governo Federal do Brasil
- **Uso**: Tradução de português para Libras
- **Custo**: Gratuito
- **Documentação**: https://www.gov.br/conecta/catalogo/apis/vlibras

### Web Speech API
- **Provedor**: Navegadores (Chrome, Edge, Safari)
- **Uso**: Reconhecimento de fala e síntese de voz
- **Custo**: Gratuito (nativo do navegador)
- **Documentação**: https://developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API

## ⚠️ Limitações Conhecidas

### VLibras API
- Pode ter limitações de taxa de requisições
- Geração de vídeo pode levar alguns segundos
- Qualidade depende da API governamental

### Web Speech API
- Requer navegador moderno (Chrome, Edge, Safari)
- Necessita permissão de microfone
- Qualidade varia por navegador
- Funciona melhor em ambientes silenciosos

### Reconhecimento de Gestos
- Implementação completa com MediaPipe Hands está planejada
- Versão atual usa simulação para demonstração
- Requer treinamento de modelo de ML para produção

## 🚧 Desenvolvimento Futuro

- [ ] Implementação completa do MediaPipe Hands
- [ ] Treinamento de modelo de ML para reconhecimento de Libras
- [ ] Suporte a frases completas em Libras
- [ ] Cache de vídeos VLibras para palavras comuns
- [ ] Modo de treinamento de novos gestos
- [ ] Suporte a múltiplos usuários simultâneos
- [ ] Gravação e exportação de sessões
- [ ] Suporte a diferentes dialetos de Libras

## 📝 Documentação Completa

Para documentação detalhada, consulte o arquivo [DOCUMENTACAO.md](./DOCUMENTACAO.md)

## 🤝 Contribuição

Este projeto foi desenvolvido na plataforma Manus. Para sugestões e melhorias, entre em contato através da plataforma.

## 📄 Licença

Desenvolvido como parte da plataforma Manus.

---

**Desenvolvido com ❤️ para promover a inclusão e acessibilidade na educação**
