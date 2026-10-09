# Documentação técnica do TeachLi

## Escopo e estado atual

O TeachLi é um protótipo de apoio à comunicação. O aplicativo em `client/`
combina reconhecimento experimental de gestos, digitação com leitura em voz alta,
treinamento local e videochamada entre professor e alunos. O modelo base classifica
15 letras estáticas do alfabeto manual; isso não equivale a interpretar Libras
como língua nem traduzir frases sinalizadas.

Esta documentação foi reconciliada com a `main` em `5cf6d3c`. A recuperação dos
guias da branch `maintenance/limpeza-estrutura-documentacao` preserva suas
convenções e propostas, sem importar sua implementação antiga ou declarar sua
limpeza aplicada. Veja o [registro de recuperação](docs/LIMPEZA.md).

| Recurso | Estado comprovado no código | Limite |
| --- | --- | --- |
| Reconhecimento estático | MediaPipe + TensorFlow.js no navegador; modelo base ou pessoal | 15 letras no modelo base, sem interpretação de Libras completa |
| Reconhecimento dinâmico | Conv1D sobre sequências das duas mãos; treino próprio | Sem modelo base de palavras distribuído |
| Digitar e Ouvir | Texto digitado falado no dispositivo atual | Sem envio a outro computador ou fila compartilhada |
| VLibras | Widget externo opcional no Modo Aluno | Tradução de texto selecionado na página; sem API própria de geração de vídeo |
| Sala de Aula | Código de entrada e chamada WebRTC professor–aluno | Sem autenticação, persistência, TURN ou reconexão automática |
| Legendas compartilhadas e áudio central da turma | Planejados | Não integram a videochamada atual |
| Histórico persistente de aulas | Não conectado à interface atual | Há código legado de API e uma página de demonstração fora das rotas |

## Arquitetura

O fluxo de desenvolvimento recomendado usa dois pacotes independentes:

| Pacote | Tecnologias | Entrada e saída |
| --- | --- | --- |
| `client/` | React 18, TypeScript, Vite 5, Tailwind CSS 3, Wouter, MediaPipe, TensorFlow.js | `client/src/main.tsx` → `App.tsx`; build em `client/dist/` |
| `server/` | Node.js e `ws` | `server/index.mjs`; processo de sinalização WebSocket |

O reconhecimento e o treino executam no navegador. O servidor WebSocket troca
mensagens para estabelecer conexões WebRTC; a mídia trafega entre os participantes.
O frontend cria uma conexão entre o professor e cada aluno, sem conexões entre
alunos. A banda de saída do professor cresce com o número de participantes.

```text
TeachLi/
├── client/
│   ├── package.json              # comandos do frontend independente
│   ├── public/                   # assets copiados para o build
│   │   ├── datasets/             # imagens e landmarks presentes na main
│   │   └── models/gesture-classifier/
│   ├── scripts/copy-mediapipe-wasm.mjs
│   └── src/
│       ├── App.tsx               # rotas efetivas
│       ├── pages/                # telas atuais e arquivos legados
│       ├── hooks/                # detecção, classificadores e chamada
│       └── lib/                  # treino, features e sinalização
├── server/
│   ├── index.mjs                 # sinalização usada pela Sala de Aula
│   ├── package.json
│   ├── _core/                    # infraestrutura Express/Manus legada
│   ├── routers.ts                # API tRPC legada
│   └── db.ts
├── drizzle/                      # schema e migrações legados
├── scripts/dataset/              # pipeline Python offline, ainda não portátil
├── docs/
└── package.json                  # configuração separada, herdada da aplicação completa
```

### Rotas efetivas

As rotas são declaradas em `client/src/App.tsx`:

| Rota | Tela |
| --- | --- |
| `/` | Home: acessos ao aluno, treino e sala |
| `/aluno` | StudentMode: câmera, digitação, voz e opção VLibras |
| `/aluno/treinar` | TrainMode: amostras e modelos pessoais |
| `/sala` | SalaAula: criar ou entrar por código |
| `/sala/:roomId` | Classroom: videochamada |

`ProfessorMode.tsx` e `History.tsx` continuam no repositório, mas não estão
registradas como rotas. A presença desses arquivos não disponibiliza seus fluxos
ao usuário do aplicativo atual.

### Configuração da raiz e código legado

A raiz mantém outro `package.json`: React 19, Tailwind CSS 4, Express/tRPC,
Drizzle/MySQL e comandos pnpm. Seu Vite também aponta para `client/`, mas gera
`dist/public/`, e o build do servidor gera `dist/index.js`. Essa configuração não
é o pacote independente descrito acima; comandos de um não devem ser aplicados
como se pertencessem ao outro.

A API legada contém `auth.me/logout`, `system.health/notifyOwner`, operações
`session.create/end/list/getById` e `translation.save/listBySession`. O schema
preserva `users`, `sessions`, `translations` e `gestures`. Não há
`professor.translateToLibras`, `student.recognizeGesture` ou `server/vlibras.ts`.
O treino e a sala WebRTC atuais não dependem dessas tabelas.

OAuth Manus, migrações e `vercel.json` permanecem como infraestrutura herdada;
não são pré-requisitos do fluxo independente. A revisão documental não removeu
nem certificou essa aplicação completa. Se a API voltar a servir dados reais,
será necessário revisar autorização por sessão: exigir login não verifica
sozinho que o usuário é dono do ID consultado ou alterado.

## Instalação e comandos

Use Node.js 22 ou superior como referência de desenvolvimento e npm. A partir
da raiz do repositório, em terminais separados:

**Falha conhecida:** os comandos abaixo descrevem os pontos de entrada do projeto,
mas a instalação atual não produz uma aplicação independente validada. Além da
falha de tipos/build, o teste de desenvolvimento encontrou dependência ativa não
resolvida (`@radix-ui/react-dialog`). Consulte o bloqueio na seção de verificação.

```bash
cd client
npm ci
npm run dev
```

```bash
cd server
npm ci
npm start
```

O cliente usa `http://localhost:5173` por padrão; o servidor escuta
`ws://localhost:8787`. O terminal do Vite informa a porta efetiva se a padrão
estiver ocupada. O servidor só é necessário para a Sala de Aula; o Modo Aluno
e o treino usam o cliente e seus recursos externos. Não é necessário banco ou
login para esse fluxo.

Os comandos `predev` e `prebuild` copiam os arquivos WASM da versão instalada do
MediaPipe para `client/public/mediapipe/wasm/`. O modelo HandLandmarker ainda é
baixado de `storage.googleapis.com`; o widget VLibras carrega recursos de
`vlibras.gov.br`. Portanto, processamento local não significa uso totalmente
offline nem ausência de serviços externos.

### Configuração e publicação

| Configuração | Local | Uso |
| --- | --- | --- |
| `VITE_SIGNALING_URL` | `client/.env.local` ou ambiente de build | URL pública do servidor de sinalização; padrão local `ws://localhost:8787` |
| `PORT` | Ambiente do processo `server/index.mjs` | Porta do WebSocket; padrão `8787` |

Variáveis `VITE_*` são incorporadas ao frontend e não devem conter segredos.
Após mudar a URL para uma publicação, gere o build novamente. Sirva `client/dist/`
por HTTPS com fallback das rotas para `index.html`, e hospede a sinalização em um
serviço que mantenha um processo Node/WebSocket. Use `wss://` com o site em HTTPS.

O código usa caminhos absolutos como `/models/` e `/mediapipe/wasm`, e o Vite do
cliente não configura uma base de subdiretório. Hospedagem em subpasta exige
adaptação e verificação desses caminhos. Nenhum destino de publicação é
certificado apenas pela existência de configuração antiga no repositório.
Detalhes em [server/README.md](server/README.md).

## Reconhecimento, treino e armazenamento

O `useHandLandmarker` detecta até duas mãos, tenta GPU e usa CPU se a inicialização
falhar. O reconhecimento estático usa a primeira mão detectada: 21 landmarks
normalizados em 63 valores. `gestureClassifier.ts` tenta carregar um modelo
pessoal salvo em IndexedDB; na ausência de um modelo utilizável, tenta o modelo
base em `client/public/models/gesture-classifier/`.

As classes base são **A, B, C, D, E, I, L, M, N, O, R, S, U, V, W**. O caminho
dinâmico representa as duas mãos, reamostra os clipes para 40 quadros e usa Conv1D.
Depende de amostras e modelo treinados pelo próprio usuário.

O Modo Aluno filtra predições com confiança maior que 0,75 e margem entre as duas
primeiras classes maior que 0,15. Há contagem de estabilidade para registrar o
histórico de gestos; esses filtros não são uma classe treinada de “nenhum sinal”.
O botão **Adicionar ao Texto** acrescenta e fala o sinal selecionado. O botão
**Falar**, na seção Texto Reconhecido, lê o texto acumulado. A detecção sozinha não dispara fala.

Modelos pessoais ficam em IndexedDB; rótulos e amostras de treino ficam em
localStorage. Esses dados pertencem à origem e ao navegador utilizados: não são
contas sincronizadas nem histórico compartilhado. Texto digitado/reconhecido e
histórico de gestos da tela ficam no estado da página. Limpar os dados do site
pode apagar modelos e amostras pessoais.

Métricas e limites do modelo: [MODELO.md](docs/MODELO.md). Pesquisa sobre novos
datasets: [DATASETS.md](docs/DATASETS.md). Os scripts Python mantêm caminhos
absolutos do ambiente original e não constituem hoje uma reprodução automática
portátil; a revisão documental não executa nem corrige esse pipeline.

## Digitação, voz e VLibras

Em **Digitar e Ouvir**, o usuário revisa o texto e aciona **Falar** ou Enter;
Shift+Enter insere uma quebra de linha. O navegador usa `speechSynthesis` com
idioma `pt-BR` e tenta selecionar uma voz desse idioma. A saída toca no dispositivo
atual; não é enviada ao professor pelo servidor de sinalização.

Ao habilitar a opção VLibras, o texto da última leitura fica visível para seleção
no widget externo. `VLibrasWidget.tsx` incorpora um script e um avatar; o projeto
não solicita nem armazena vídeos traduzidos por uma API própria. Qualidade,
disponibilidade, vozes e permissões precisam ser avaliadas no navegador real.

## Visão de evolução: comunicação por texto compartilhado

O usuário definiu “modelo híbrido” no contexto de **aula EAD**. A evolução deve
considerar participação remota e seu uso junto à sala presencial, com acesso
ao mesmo texto e oportunidades de comunicação para alunos surdos. A proposta
pedagógica e seus limites estão em [MODELO_HIBRIDO.md](docs/MODELO_HIBRIDO.md);
o termo não designa uma nova arquitetura de classificadores ou uma migração
automática para serviços de nuvem.

O resumo `TeachLi.txt` fornecido pelo usuário orienta esta proposta. Seu diagnóstico
descrevia uma etapa anterior: a pasta de WebRTC hoje contém implementação, a
videochamada já existe e `ProfessorMode.tsx` está fora das rotas. A lacuna atual
é compartilhar o texto e integrá-lo às interfaces de professor e aluno.

A prioridade proposta é usar texto como conteúdo principal da comunicação
assistiva. Gestos continuam processados no navegador do aluno; o texto reconhecido
deve ser revisado e confirmado antes do envio. A videochamada existente é um
recurso separado: enquanto estiver ativa, transmite áudio e vídeo entre os pares.
Um modo de participação apenas por texto, sem exigir câmera/microfone, ainda
precisa ser implementado; não é uma propriedade da sala atual.

| Direção | Fluxo proposto | Trabalho pendente |
| --- | --- | --- |
| Professor → aluno | Fala → texto parcial/final → legenda compartilhada → opção Libras | Integrar captura à sala, protocolo de transcrição e interface de legendas |
| Aluno → professor | Gesto ou digitação → correção e confirmação → mensagem → painel e voz | Editor de confirmação, envio, painel com autoria e controle de reprodução |

### Canal e mensagens — proposta

O primeiro incremento propõe WebSocket de aplicação para texto e mantém WebRTC
para mídia, conforme [MODELO_HIBRIDO.md](docs/MODELO_HIBRIDO.md). DataChannel é uma
alternativa a reavaliar se necessário; a escolha proposta ainda precisa ser
validada na implementação. O WebSocket atual transporta sinalização e não
fornece esse protocolo de mensagens.
Definir identificador, sala, remetente, ordem e estado de cada mensagem. Parciais
de uma mesma transcrição devem substituir a versão anterior; a versão final
deve fixar o trecho sem gerar cópias. Reconexão exige confirmação de entrega e
tratamento de duplicatas. Acesso à sala e autoria não devem depender somente do
nome ou papel enviado pelo navegador.

O painel do professor deverá mostrar mensagens confirmadas, autoria e estado de
entrega/reprodução. O destinatário poderá ler o texto sem ouvir áudio, escolher
quais mensagens falar e controlar a fila. A saída digitada já pode ser corrigida
no campo local; a saída do reconhecimento ainda não dispõe desse editor nem de
confirmação para envio remoto.

Em aulas EAD ou com participantes presenciais e remotos, o texto deve alcançar os
destinatários autorizados em seus próprios dispositivos. Falar uma mensagem na
caixa de som da sala física não confirma que o aluno remoto a recebeu. A política
de destinatários, leitura local e eventuais legendas das mensagens dos alunos
precisa ser definida e testada para esse cenário.

### Preferências de voz — proposta

O código atual seleciona automaticamente uma voz `pt-BR`, quando disponível, e
usa velocidade e tom fixos. Planeja-se listar as vozes disponibilizadas pelo
navegador, priorizar `pt-BR`, permitir velocidade/tom e oferecer um botão de teste.
A implementação deverá tratar carregamento assíncrono da lista e ausência da voz
salva em outro dispositivo. Preferências locais por navegador e sincronização por
usuário são escopos distintos; esta última depende de identidade e persistência.

Serviços externos de reconhecimento de fala ou TTS podem ser avaliados como
alternativa, mas não estão contratados ou integrados nesta proposta documental.
Processamento iniciado no navegador não garante processamento inteiramente local:
reconhecimento de fala, vozes e recursos externos dependem do ambiente utilizado.

### Legendas e apresentação em Libras — proposta

Legendas devem permanecer visíveis, com tamanho/contraste ajustáveis e histórico
rolável. Texto parcial serve à leitura imediata; texto final é candidato à
apresentação em Libras. O resumo propõe enfileirar frases e permitir pular para a
mais recente quando a apresentação atrasar. Isso exige antes verificar se a
integração utilizada oferece controles de iniciar, concluir ou cancelar uma
tradução. O wrapper atual do VLibras não fornece essa fila nem esses eventos.
Não se presume uma API de controle do avatar ou de geração de vídeos.

Enquanto essa integração não for validada, a proposta deve preservar o texto e
a seleção manual no widget. Falha do avatar não pode bloquear as legendas ou o
envio de mensagem confirmada. A transcrição contínua também precisa ser testada
em aulas longas, pausas, erros e reinícios; o relato sobre um defeito antigo não
substitui reprodução no código que for integrado.

Os passos e critérios de aceite estão no
[guia de implementação](docs/GUIA_IMPLEMENTACAO.md). Esta seção registra intenção
de produto; nenhum desses fluxos compartilhados foi entregue pela revisão de
documentação.

## Sala de Aula: contratos e limites

`SalaAula.tsx` gera um código de seis caracteres para o professor. O aluno informa
o código; nome e papel seguem na URL. `useClassroom` solicita câmera e microfone
antes de abrir a sinalização. O servidor aceita no máximo um professor por sala
e recusa aluno quando não há professor conectado.

A entrada WebSocket usa `room`, `role` e `name`. Os eventos são `joined`,
`peer-joined`, `peer-left`, `signal`, `room-closed` e `error`. Mensagens `signal`
transportam ofertas/respostas SDP e candidatos ICE no cliente. Não existe
protocolo implementado de chat, legendas, fila de áudio ou confirmação de leitura.

O papel é informado pelo próprio cliente, sem comprovação de vínculo. As salas
ficam em memória e não têm persistência ou sincronização entre processos. Quando
o professor desconecta, o servidor avisa os alunos com `room-closed`. Reiniciar
a sinalização perde o estado das salas; conexões P2P já estabelecidas podem
continuar temporariamente, e o cliente não implementa recuperação automática.

Só há STUN configurado; redes restritivas podem exigir TURN, ainda não incluído.
Conseguir entrar no WebSocket não comprova que a mídia WebRTC conectou. O fluxo
pede acesso aos dois dispositivos de captura e depende das políticas de mídia do
navegador. Escala, reconexão e uso em redes reais precisam de teste específico.

## Verificação e contribuição

Para o cliente:

```bash
cd client
npm run typecheck
npm run build
```

### Bloqueio de verificação encontrado na base atual

Na revisão desta documentação, `npm ci` em `client/` e em `server/` foi concluído,
mas `npm run typecheck` falhou com o código funcional da `main` inalterado.
`client/tsconfig.json` inclui toda a pasta `src`, inclusive arquivos legados fora
das rotas. Entre os problemas estão imports de pacotes ausentes no manifesto do
cliente independente, como `@trpc/client` e `@radix-ui/*`, o alias legado
`@shared` sem configuração nesse pacote e exports incompatíveis como
`buttonVariants` e `LIBRAS_GESTURES`.

`npm run build` também falhou no TypeScript, depois de copiar os arquivos WASM.
O teste de `npm run dev` iniciou o Vite, mas reportou `@radix-ui/react-dialog`
não resolvido em `client/src/components/ui/dialog.tsx`, usado pelo caminho ativo
da interface. Portanto, o problema não se limita a fontes legadas alcançadas
apenas pela checagem de tipos; o início do Vite não comprova quickstart funcional.

Instalar o lockfile do cliente não resolve essas divergências entre configuração
e fontes. Não se deve apresentar a geração de `client/dist/` como validada.
A correção está proposta em `maintenance/regularizar-build-client`, antes de
publicação ou ampliação funcional. Esta entrega documental não altera código,
dependências ou escopo do TypeScript para ocultar o problema.

O trabalho de manutenção deve separar o que pertence ao cliente independente e
ao legado, ajustar imports/exports e dependências de maneira explícita e então
reexecutar instalação, tipos e build. A existência de código de uma funcionalidade
na árvore não equivale a ter seu pacote de produção aprovado.

As verificações desta entrega usaram Node.js 18.19.1 e npm 9.2.0, disponíveis no
ambiente. Node.js 22 é a referência recomendada no guia, mas não foi testado nesta
revisão. Imports/exports ausentes foram constatados também por inspeção do código
e manifesto; não há comprovação de que trocar apenas a versão do Node resolva o
problema. Repetir a validação no ambiente recomendado faz parte da manutenção.

### Convenções e outras verificações

Na raiz, para as convenções recuperadas:

```bash
node scripts/check-conventions.mjs --labels documentation --title "docs: atualizar documentação do projeto"
node scripts/check-conventions.mjs --labels documentation --base origin/main
```

O primeiro comando permite validar uma mudança antes do commit. O segundo exige
commits novos na faixa; o verificador não consulta nem aplica labels no GitHub.
Esses comandos não substituem testes funcionais e não alteram o `pnpm test`
legado da raiz. Executar um build não valida câmera, precisão do modelo, áudio,
widget externo ou comunicação entre dispositivos.

Nesta revisão, os cinco testes do verificador de convenções, uma validação de
branch/título pela CLI e `node --check server/index.mjs` passaram. Esses resultados
cobrem convenções e sintaxe do servidor; não corrigem nem substituem a falha de
tipos do cliente, tampouco validam o funcionamento da videochamada.

O procedimento de contribuição está em [CONTRIBUTING.md](CONTRIBUTING.md), as
convenções em [BRANCHES.md](docs/BRANCHES.md), as instruções de uso em
[USO.md](docs/USO.md) e a evolução planejada no
[guia de implementação](docs/GUIA_IMPLEMENTACAO.md). Antes de concluir mudanças,
o agente principal aciona a revisão documental descrita em [AGENTS.md](AGENTS.md).
