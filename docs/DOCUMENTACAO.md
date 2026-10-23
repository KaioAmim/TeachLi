# Documentação técnica do TeachLi

Atualizada em 23/10/2026 para a branch `feature/entrada-salas-aula`.
O estado abaixo descreve a aplicação atual. O resultado final desejado e seus
critérios de aceite continuam no [plano de implementação](GUIA_IMPLEMENTACAO.md).
Implementação no código e teste automatizado não substituem avaliação com a turma.

## Escopo e estado atual

TeachLi é um protótipo de apoio à comunicação entre aluno e professor. O aluno
pode digitar ou formar um rascunho com reconhecimento experimental, revisar e
confirmar o envio. O professor recebe o texto e pode ouvi-lo; ao ativar a
transcrição, compartilha frases finalizadas com os alunos da mesma sala.

| Recurso | Implementado | Limite atual |
| --- | --- | --- |
| Login | Microsoft com PKCE, `state` e nonce; perfis por domínio institucional | Sem matrícula por turma ou comprovação administrativa de função docente |
| Salas | Laboratórios A/B/C, Sala 01/02; seleção após login, presença, troca e logout | Um professor por sala; estado em memória, uma instância |
| Mensagem do aluno | Digitação ou rascunho reconhecido, edição e envio explícito ao professor | Sem fila para destinatário ausente; confirmação não comprova leitura |
| Fala do professor | Transcrição local e envio de frases finais aos alunos da sala | Sem legendas parciais compartilhadas; depende do navegador |
| Voz | Leitura local e botão de ouvir no painel do professor | Sem fila automática de reprodução |
| Reconhecimento por pose | Modelo experimental A–Z ou modelo pessoal | H/J/K/X/Z sem validação do movimento completo; sem Ç |
| Reconhecimento dinâmico | Captura de clipes e treino Conv1D local | Sem modelo temporal base; representação precisa preservar deslocamento |
| VLibras | Widget externo para texto selecionado na página | Sem contrato próprio de fila ou controle automático do avatar |
| Identidade visual | Logo transparente com contorno branco, também usada no favicon; rolagem nativa | Acessibilidade precisa de avaliação com usuários |
| Histórico de aulas | Não implementado no fluxo atual | Há código legado fora das rotas |
| Videochamada | Código legado preservado | Não integra as salas atuais |

## Arquitetura e rotas

| Pacote | Papel | Entrada e saída |
| --- | --- | --- |
| `client/` | React 18, TypeScript, Vite 5, Tailwind 3, Wouter, MediaPipe e TensorFlow.js | `index.html` → `src/main.tsx` → `App.tsx`; saída `client/dist/` |
| `server/` | Node.js, `ws` e `jose`; autenticação da comunicação e encaminhamento de texto | `index.mjs` → `classrooms.mjs` e `microsoft.mjs` |
| Raiz, `server/_core`, `drizzle/`, `shared/` | Aplicação herdada Express/tRPC/Drizzle, com outro manifesto | Não necessária para iniciar o protótipo atual |

O reconhecimento e o treino acontecem no navegador. O servidor recebe o texto
confirmado e as frases finais e encaminha apenas para o perfil oposto na mesma
sala. Não transmite câmera, vídeo ou áudio nesta versão.

| Rota | Uso |
| --- | --- |
| `/` | Apresentação e escolha do perfil |
| `/entrar` | Retorno do login Microsoft |
| `/salas` | Preparação da sessão de comunicação e seleção de sala |
| `/aluno` | Câmera, rascunho, digitação, voz e mensagens da sala |
| `/aluno/treinar` | Amostras e modelos pessoais do aluno |
| `/professor` | Mensagens recebidas e transcrição compartilhada |

As telas de comunicação exigem login do perfil correspondente e sala selecionada.
Atualizar a página exige selecionar a sala novamente. `History.tsx`,
`SalaAula.tsx`, `Classroom.tsx`, `TrainGestures.tsx` e `ComponentShowcase.tsx`
não são rotas atuais. A presença desses arquivos não torna seus recursos disponíveis.

### Fronteira de compilação e legado

`client/tsconfig.json` verifica `src/main.tsx`, todos os imports transitivos
(inclusive componentes, hooks e módulos de treino), as declarações locais e
`vite.config.ts`. Essa é a entrada usada por `client/index.html`. Novos módulos
importados pela aplicação passam automaticamente a ser verificados. Uma nova
entrada independente, como um worker não importado, precisa ser cadastrada também.
O modo `strict` permanece ativo; o build continua executando TypeScript antes do Vite.

A verificação antiga de toda a árvore está preservada em
`client/tsconfig.legacy.json`, acessível por `npm run typecheck:legacy`. Ela ainda
aponta dependências e contratos incompatíveis nos arquivos herdados, como tRPC,
`@shared`, componentes de demonstração e exports antigos. Essa auditoria não é
uma etapa de publicação do cliente atual. Antes de reintegrar qualquer módulo
legado, é necessário corrigir suas dependências e tipos; importá-lo no aplicativo
faz seus erros voltarem à verificação normal. Não foram apagadas telas antigas
nem instaladas todas as dependências do outro aplicativo para contornar o problema.

O manifesto da raiz mantém React 19, Vite 7, Express/tRPC e Drizzle/MySQL.
Não misture suas instalações com `client/`. `npm run dev:classroom` é o atalho
na raiz para iniciar os dois pacotes atuais. Migrações, OAuth Manus e configuração
antiga de publicação não são pré-requisitos deste fluxo. A API legada de sessões
não foi certificada: se reutilizada, precisa de autorização por participante e sessão.

## Instalação, login e publicação

Use Node.js 22 ou posterior e npm. A validação desta revisão usa Node.js 24.21.0;
a versão 22 não foi executada nesta revisão. Na raiz:

```bash
npm ci --prefix client
npm ci --prefix server
npm run dev:classroom
```

O site usa a porta fixa 5173; o servidor, 8787. Porta ocupada gera erro, sem mudar
silenciosamente para 5174. Pode-se iniciar separadamente com `npm run dev` em
`client/` e `npm start` em `server/`. Não é necessário banco de dados.

O aplicativo Microsoft existente precisa de Client ID público e retorno SPA
cadastrado para a origem exata: `http://localhost:5173/entrar` e/ou
`http://127.0.0.1:5173/entrar`. A configuração local usa
`VITE_MICROSOFT_TENANT_ID=organizations`. **Não exige Tenant ID da faculdade,
novo aplicativo ou cadastro adicional de docentes nesta entrega.** Nunca coloque
Client Secret em variáveis `VITE_*`. Consulte o [README](../README.md) e o
[guia do servidor](../server/README.md) para configuração completa.

O login acontece diretamente com a Microsoft. Depois do retorno, o servidor
verifica a assinatura RS256, emissor do token e da chave, audiência e expiração
antes de emitir uma sessão opaca. O perfil deriva do domínio exato:
`@alunos.unibarretos.com.br` para aluno e `@unibarretos.com.br` para professor.
Editar armazenamento, URL ou autoria no cliente não autoriza comunicação no servidor.
Essa regra não equivale à validação administrativa da função de professor;
políticas institucionais adicionais ficam para uma etapa acordada com a faculdade.

A indisponibilidade do servidor não impede o login Microsoft. A tela de salas
permite tentar novamente mantendo o login. Logout encerra a sessão do TeachLi,
sem encerrar a conta Microsoft em outros serviços.

| Configuração | Uso |
| --- | --- |
| `VITE_MICROSOFT_CLIENT_ID` | ID público do aplicativo já usado no login |
| `VITE_MICROSOFT_TENANT_ID` | `organizations` no fluxo atual |
| `VITE_SIGNALING_URL` | Servidor de salas; padrão `ws://localhost:8787` |
| `MICROSOFT_CLIENT_ID` no servidor | Opcional: mesmo ID, quando hospedado separadamente do cliente |
| `TEACHLI_CORS_ORIGIN` | Origens exatas autorizadas; padrão localhost/127.0.0.1:5173 |
| `TEACHLI_ROOMS` | Catálogo opcional de salas com IDs estáveis |
| `PORT` | Porta do servidor; padrão 8787 |

Em publicação, sirva `client/dist/` por HTTPS, com fallback para `index.html`,
e um processo Node/WebSocket com WSS. Cadastre a origem publicada na Microsoft
e no servidor. `localhost` em outro dispositivo aponta para o próprio dispositivo,
não para o computador do professor: ambos precisam acessar o mesmo serviço.
O preview usa 5173 e exige encerrar o servidor de desenvolvimento dessa porta.

`predev` e `prebuild` copiam o WASM instalado do MediaPipe para `public/`.
HandLandmarker e VLibras ainda carregam recursos externos. O reconhecimento de
fala depende do navegador e pode usar serviços externos. O sistema não é
inteiramente offline. A base Vite é `/`; publicar em subpasta exige adaptação.
O Vite copia `public/` para o build, inclusive os datasets: revisar esses arquivos
faz parte da preparação de uma publicação.

## Contratos das salas e armazenamento

O protocolo e os limites completos estão em [server/README.md](../server/README.md).
Os eventos principais são `joined`, `presence`, `student.message`, `caption.final`,
`message.ack` e `message.rejected`. Autoria e destino são definidos pelo servidor.

- Aluno pode entrar antes do professor; não há envio pendente para entrega futura.
- Um professor por sala e uma conexão por sessão. Trocar sala remove a associação anterior.
- Texto limitado a 2.000 caracteres; limites de frequência e deduplicação no servidor.
- `message.ack` confirma encaminhamento à conexão, não leitura ou reprodução.
- Estado em memória, sem sincronização entre servidores ou recuperação de histórico.
- O cliente mantém até 100 mensagens recebidas; sair ou trocar sala limpa esse painel.
- Desconexão requer entrada explícita novamente. Sessões duram no máximo uma hora,
  limitadas também pela expiração Microsoft.
- Qualquer conta aceita pelo perfil pode escolher qualquer sala; não há matrícula.

O ID token e a sessão de comunicação ficam em `sessionStorage`. Modelos pessoais
ficam em IndexedDB; rótulos e amostras de treino, em localStorage. São dados por
origem/navegador, não sincronizados por conta. Limpar os dados do site pode apagar
o treino pessoal. Não registrar tokens nem dados de participantes em logs de teste.

## Reconhecimento e treinamento

A detecção encontra até duas mãos; a classificação por pose usa a primeira mão,
com 21 pontos normalizados em 63 valores. O modelo pessoal tem prioridade sobre
o modelo base em `public/models/gesture-classifier-26/`: MLP `63→256→128→64→26`,
com A–Z experimental. H/J/K/X/Z são classificados pela posição da mão, sem validar
o movimento completo. Ç não está no modelo distribuído.

O modelo original de 15 letras foi preservado em `public/models/gesture-classifier/`.
A importação manual de imagens/landmarks continua cobrindo essas 15 letras.
Os artefatos novos incluem origem, licenças e código de reprodução. O experimento
misturou os landmarks legados e a base LibraSign; recuperou o acerto das letras
antigas de 93,26% no primeiro candidato para 97,61% no recorte interno atual.
Isso é avaliação de regressão, não estimativa independente de acerto em webcam.
Métricas, versões e limitações estão em [TREINAMENTO_ALFABETO.md](TREINAMENTO_ALFABETO.md).

O classificador temporal usa sequências de 40 quadros e treino local Conv1D.
Ainda não existe um modelo temporal base distribuído. A normalização atual
centraliza cada mão em cada quadro e perde deslocamento global; também é preciso
separar gravações antes de gerar variações para validação. Esses pontos devem ser
corrigidos antes de uma campanha de coleta de movimentos.

Fotos/amostras isoladas descrevem poses; movimentos precisam de clipes ordenados.
A próxima etapa deve preservar trajetória e tempo, conferir os rótulos com pessoa
fluente em Libras, incluir Ç e exemplos negativos e avaliar por participante e
por gravação. Coletar amostras não treina automaticamente um modelo. Versionar o
novo formato e preservar os dados pessoais antigos faz parte dessa evolução.
O plano detalhado da próxima etapa deve também acompanhar a descrição do PR.

Confiança, margem entre classes e estabilidade filtram predições; não garantem
correção nem constituem uma classe negativa treinada. O reconhecimento produz
um rascunho: o aluno pode corrigir e deve confirmar o envio à sala. O aplicativo
não traduz Libras completa, expressões não manuais ou frases sinalizadas.

## Texto, voz e VLibras

Na mensagem digitada, Enter envia ao professor e Shift+Enter insere nova linha.
Os botões de ouvir executam síntese de voz no dispositivo atual. O professor
pode ouvir cada mensagem recebida manualmente; não há reprodução automática ou
fila compartilhada. Ao iniciar gravação, frases finais da transcrição são enviadas
aos alunos; parciais permanecem locais. Não há confirmação de leitura.

VLibras é um widget externo para texto selecionado. Não há API própria de vídeo,
fila automática ou sincronização garantida com as legendas. O texto original
continua sendo o canal disponível quando o widget não é usado.

## Verificações e aceite

```bash
npm run typecheck --prefix client
npm run build --prefix client
npm run test:auth --prefix client
npm test --prefix server
```

Os testes automatizados de autenticação/salas cobrem perfis, callback, assinatura
com chaves de teste, expiração, logout, isolamento, troca de sala e entradas
malformadas. Respostas Microsoft simuladas não comprovam login no Entra real.
O teste de interface com duas sessões isoladas verifica interação entre aluno e
professor no mesmo computador; não equivale a dois dispositivos físicos.

### Resultado da revisão de 23/10/2026

| Verificação | Resultado |
| --- | --- |
| Instalação limpa dos lockfiles de `client/` e `server/` em cópia temporária | Passou, com Node.js 24.21.0 e cache local do npm |
| `npm run typecheck` e `npm run build` do cliente | Passaram no projeto e na cópia limpa; permanece aviso de tamanho do JavaScript |
| Autenticação e salas | 21 testes passaram: 14 do cliente e sete do servidor |
| Checagem estrita da aplicação | Erro proposital inserido apenas em memória em `StudentMode.tsx` foi detectado; nenhum arquivo funcional foi alterado por essa prova |
| Interface sobre o build de produção | Duas sessões isoladas, aluno em 390px e professor em 1440px: login simulado, indisponibilidade/retry do servidor, texto, legenda simulada, troca de sala e logout passaram |
| Favicon | HTML aponta para a variante com contorno branco; PNG servido com sucesso no build |
| Contas Microsoft reais, microfone real e dois dispositivos físicos | Não executado; requer equipamentos e participação dos titulares das contas |

Para a conferência real, use uma conta de aluno e outra de professor em dispositivos
diferentes, acessando a mesma instalação. Verifique texto nos dois sentidos,
troca e isolamento de salas, saída, reconexão, permissão de microfone e transcrição.
Os titulares fazem o login; não é necessário compartilhar senhas. Essa validação
permanece pendente enquanto equipamentos e contas não estiverem disponíveis.
Build aprovado não comprova precisão em câmera, qualidade em Libras ou capacidade
de uma turma. O resultado exato de cada execução deve constar no PR.

As convenções de branch, commit e PR estão em [BRANCHES.md](BRANCHES.md).
Os antigos scripts de convenções e templates `.github/` não estão presentes
nesta cópia. Revise título, labels, diff e testes antes do merge.
