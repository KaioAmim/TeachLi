# Documentação técnica do TeachLi

## Escopo e estado atual

O TeachLi é um protótipo de apoio à comunicação. O aplicativo em `client/`
combina reconhecimento experimental de gestos, digitação com leitura em voz alta,
treinamento local e um modo de fala para texto para professores. O modelo base classifica
15 letras estáticas do alfabeto manual; isso não equivale a interpretar Libras
como língua nem traduzir frases sinalizadas.

Esta documentação foi reconciliada com a `main` em `5cf6d3c`. O documento reúne a
arquitetura atual, os limites do reconhecimento e um resumo das métricas históricas;
propostas e prioridades de evolução estão no [plano de implementação](GUIA_IMPLEMENTACAO.md).

| Recurso | Estado comprovado no código | Limite |
| --- | --- | --- |
| Reconhecimento estático | MediaPipe + TensorFlow.js no navegador; modelo base ou pessoal | 15 letras no modelo base, sem interpretação de Libras completa |
| Reconhecimento dinâmico | Conv1D sobre sequências das duas mãos; treino próprio | Sem modelo base de palavras distribuído |
| Digitar e Ouvir | Texto digitado falado no dispositivo atual | Sem envio a outro computador ou fila compartilhada |
| VLibras | Widget externo opcional no Modo Aluno | Tradução de texto selecionado na página; sem API própria de geração de vídeo |
| Modo Professor | Transcrição de fala para texto no próprio navegador | Depende do suporte de reconhecimento de fala do navegador |
| Comunicação compartilhada | Planejada | Não há chamada, legenda ou mensagem entre dispositivos na interface atual |
| Histórico persistente de aulas | Não conectado à interface atual | Há código legado de API e uma página de demonstração fora das rotas |

## Arquitetura

O fluxo de desenvolvimento recomendado usa dois pacotes independentes:

| Pacote | Tecnologias | Entrada e saída |
| --- | --- | --- |
| `client/` | React 18, TypeScript, Vite 5, Tailwind CSS 3, Wouter, MediaPipe, TensorFlow.js | `client/src/main.tsx` → `App.tsx`; build em `client/dist/` |
| `server/` | Node.js e `ws` | Código de sinalização preservado, sem rota acessível na interface atual |

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
| `/` | Home: acessos aos modos Aluno e Professor |
| `/entrar` | Retorno Microsoft: valida o fluxo e o domínio do perfil escolhido |
| `/aluno` | StudentMode: câmera, digitação, voz e opção VLibras |
| `/aluno/treinar` | TrainMode: amostras e modelos pessoais |
| `/professor` | ProfessorMode: transcrição de fala para texto |

`History.tsx`, a sinalização WebRTC e as telas de sala continuam no repositório,
mas não estão registrados como rotas. A presença desses arquivos não disponibiliza
esses fluxos ao usuário do aplicativo atual.

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
O treino e os modos Aluno e Professor atuais não dependem dessas tabelas.

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

O cliente usa `http://localhost:5173` por padrão. O terminal do Vite informa a
porta efetiva se a padrão estiver ocupada. Os modos atuais usam recursos do
cliente; não é necessário banco ou login para esse fluxo.

### Login Microsoft dos modos

Os acessos Aluno e Professor iniciam o fluxo OAuth 2.0 Authorization Code com
PKCE no endpoint Microsoft `organizations`, solicitando seleção da conta. O cliente
confere `state`, `nonce`, audiência e expiração e exige o domínio exato correspondente
ao perfil escolhido: `@alunos.unibarretos.com.br` para aluno e `@unibarretos.com.br`
para professor. O papel é derivado do domínio retornado e deve coincidir com a
opção escolhida; contas externas, sem e-mail e o domínio fictício de professor são
recusados. Não há exceção Microsoft para professor demo. A sessão
fica apenas em `sessionStorage`; nenhum Client Secret é usado ou deve ser colocado
em variável `VITE_*`.

O fluxo exige `VITE_MICROSOFT_CLIENT_ID`, obtido no registro do aplicativo, e uma
URL de retorno do tipo **SPA** que corresponda exatamente a
`http://127.0.0.1:5173/entrar` no desenvolvimento. Para `localhost`, cadastre a
segunda URL equivalente. Sem Client ID, o aplicativo informa a configuração
ausente e não inicia um redirecionamento inválido.

O valor padrão `VITE_MICROSOFT_TENANT_ID=organizations` permite contas de
organizações Microsoft. As rotas de aluno, treino e professor revalidam domínio,
perfil e expiração da sessão; sessões antigas incompatíveis são removidas. Uma
nova tentativa de login limpa a sessão anterior, e o callback evita consumir o
mesmo código duas vezes nos efeitos do React StrictMode.

Limite atual: o ID token é decodificado, sem verificação criptográfica da assinatura,
e `sessionStorage` pode ser editado pelo usuário. A checagem de e-mail é uma regra
de navegação do protótipo, não uma fronteira de segurança. O servidor de sala
continua com seu fluxo demo separado (professor com domínio exato e código demo;
alunos entram com código de sala). Para autorização institucional de servidor,
validar assinatura, emissor, audiência, validade, tenant permitido e identidade
estável (`tid`/`oid`), com permissões atribuídas; não autorizar apenas por e-mail.

Os testes `npm run test:auth` em `client/` simulam respostas Microsoft para verificar
perfis cruzados, domínios externos, sessões antigas e verificações do callback.
Não substituem teste real com o Entra nem validam assinatura de tokens.

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

### Métricas históricas e limites do modelo

O pipeline offline extrai landmarks com MediaPipe e treina um MLP `63→256→128→64→15`,
exportado para TensorFlow.js. O relato histórico registra 2.409 amostras detectadas
após recuperação, 4.818 após espelhamento e 20.304 amostras após augmentation.
O modelo base e os landmarks processados ficam em `client/public/models/gesture-classifier/`
e `client/public/datasets/libras-landmarks.json`.

A avaliação histórica registrou **97,47% de acurácia em blocos não vistos (n=948)**,
usando divisão agrupada por sequência em vez de divisão aleatória. Esses números não
foram reproduzidos nesta revisão e não representam desempenho garantido em webcam.
O conjunto tem 15 classes estáticas: A, B, C, D, E, I, L, M, N, O, R, S, U, V e W.
Não reconhece Libras completa, movimento lexical, expressões não manuais ou frases.
O limiar de confiança e a margem entre as duas primeiras classes reduzem algumas
predições incertas, mas não substituem uma classe negativa treinada para “nenhum sinal”.

O classificador dinâmico usa sequências de 40 quadros das duas mãos e Conv1D, mas
depende de clipes gravados pelo usuário. Não há dataset público de palavras integrado
e validado no pipeline atual. Candidatos pesquisados anteriormente incluem
[MALTA-LIBRAS/ISLR_LIBRAS](https://github.com/Malta-Lab/ISLR_LIBRAS),
[V-LIBRASIL](https://libras.cin.ufpe.br/),
[o corpus Libras-UFPel](https://aclanthology.org/2026.propor-1.112/) e
[LIBRAS-UFOP (Kinect)](https://www.ufop.br/); formato, licença e permissões dos dados
precisam ser confirmados antes de qualquer uso. VLibrasBD é textual e não serve
diretamente para treinar um classificador visual de gestos.

O pipeline de treino em `scripts/dataset/` ainda contém caminhos absolutos e
dependências de arquivos intermediários, incluindo `probe_X.npy`. Portanto, não é
reproduzível de ponta a ponta sem adaptação. Qualquer avaliação futura deve separar
sinalizadores/vídeos entre treino e teste, incluir exemplos negativos e medir o
resultado com participantes e condições de captura reais. As métricas acima são
referência histórica, não validação clínica, pedagógica ou de produção.

## Digitação, voz e VLibras

Em **Digitar e Ouvir**, o usuário revisa o texto e aciona **Falar** ou Enter;
Shift+Enter insere uma quebra de linha. O navegador usa `speechSynthesis` com
idioma `pt-BR` e tenta selecionar uma voz desse idioma. A saída toca no dispositivo
atual; não é enviada ao professor pelo servidor de sinalização.

Ao habilitar a opção VLibras, o texto da última leitura fica visível para seleção
no widget externo. `VLibrasWidget.tsx` incorpora um script e um avatar; o projeto
não solicita nem armazena vídeos traduzidos por uma API própria. Qualidade,
disponibilidade, vozes e permissões precisam ser avaliadas no navegador real.

## Evolução: comunicação por texto compartilhado

A prioridade proposta é permitir que participantes presenciais e remotos compartilhem
texto acessível. O aluno deve revisar e confirmar qualquer texto reconhecido antes
do envio; a videochamada atual é complementar e não substitui legendas ou mensagens
nos dispositivos dos participantes. O protocolo, os fluxos professor↔aluno, a fila
de voz, as legendas, a integração com VLibras e os critérios de aceite estão
consolidados no [plano de implementação](GUIA_IMPLEMENTACAO.md). Esses recursos
compartilhados ainda não devem ser considerados implementados.

## Sala de Aula: contratos e limites

`SalaAula.tsx` gera um código de seis caracteres para o professor. O aluno informa
o código e o nome segue na URL; a identidade de professor vem de uma sessão demo
assinada pelo servidor. `useClassroom` solicita câmera e microfone
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

### Verificação da autenticação demo — 15 de outubro de 2026

Nesta implementação, `node --check server/index.mjs` e `npm test` em `server/`
passaram. O teste inicia um servidor local temporário e confirma que: uma conta de
aluno é recusada como professor, código errado é recusado, `role=professor` sem
sessão é recusado, código de sala inválido é recusado e uma sessão demo válida
permite professor e aluno entrarem na mesma sala. O build direto `npx vite build`
em `client/` também gerou `client/dist/` com sucesso.

`npm run typecheck` continua falhando em arquivos e dependências legadas fora do
escopo desta mudança, conforme o bloqueio abaixo; por isso `npm run build` também
não é uma verificação disponível enquanto ele executar `tsc -b`. Não foi feita
alteração para ocultar esses erros. A auditoria de produção do servidor não apontou
vulnerabilidades. A auditoria do cliente apontou três vulnerabilidades moderadas
transitivas em `sprintf-js`, trazidas por `@tensorflow/tfjs`; o reparo automático
sugerido troca TensorFlow.js por versão incompatível e não foi aplicado.

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

As convenções de branch, labels e commits estão em
[BRANCHES.md](BRANCHES.md). Os scripts `scripts/check-conventions.mjs` e seus
testes, citados em documentação histórica, não existem nesta cópia do
repositório e não podem ser usados como verificação atual. Revise manualmente
branch, título, label e diff antes de abrir um PR. Executar um build não valida
câmera, precisão do modelo, áudio, widget externo ou comunicação entre
dispositivos.

Registros anteriores de testes de convenções não comprovam o estado atual.
Nesta implementação, a sintaxe do servidor e os testes da autenticação demo
foram executados; a falha de tipos do cliente continua independente dessas
verificações.

As convenções estão em [BRANCHES.md](BRANCHES.md) e a evolução planejada no
[guia de implementação](GUIA_IMPLEMENTACAO.md).
