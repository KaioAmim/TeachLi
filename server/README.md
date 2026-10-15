# Servidor de sinalização — Sala de Aula

`server/index.mjs` usa WebSocket para trocar mensagens que estabelecem uma
conexão WebRTC entre professor e alunos. No fluxo implementado, ofertas/respostas
SDP e candidatos ICE passam por aqui; áudio e vídeo trafegam entre os navegadores.
O servidor recebe código de sala e nome do participante. Para criar sala, o
professor também precisa de uma sessão demo assinada pelo próprio servidor.

Este processo é independente do servidor Express/tRPC legado em `server/_core/`.
`npm start` executado nesta pasta inicia somente a sinalização.

## Rodar localmente

A partir da raiz do repositório, em um terminal:

```bash
cd server
npm ci
npm start
```

O padrão é `ws://localhost:8787`. A variável de ambiente `PORT` pode alterar a
porta do processo. Em outro terminal, também a partir da raiz:

```bash
cd client
npm ci
npm run dev
```

As telas de Sala de Aula estão preservadas no código, mas as rotas `/sala` e
`/sala/:roomId` foram retiradas da navegação atual. Para verificar o servidor
independentemente dessas telas, execute `npm test` nesta pasta.

O fluxo demo preservado usa e-mail `@unibarretos.com.br` e código demo para o
professor, e código de sala para o aluno. Ambos os lados solicitam câmera e
microfone ao entrar pela interface. Em desenvolvimento, o código demo padrão é
`teachli-professor-demo`; troque-o por variável de ambiente antes de demonstrar
para outras pessoas.
O cliente lê a URL de [config.ts](../client/src/lib/webrtc/config.ts), cujo padrão
é `ws://localhost:8787`. Para outro endereço, defina `VITE_SIGNALING_URL` em
`client/.env.local` e reinicie o Vite. `localhost` sempre identifica o dispositivo
que está executando o navegador; testar duas máquinas exige URL acessível a ambas.

## Sessão demo de professor

`POST /auth/demo/login` recebe nome, e-mail e código de demonstração. O endpoint
aceita apenas o domínio exato `@unibarretos.com.br`; endereços
`@alunos.unibarretos.com.br` não podem iniciar aulas. Ao validar o código, ele
devolve sessão assinada com validade de oito horas. O código e o segredo nunca
devem ir para `client/`, `.env.local` do frontend ou GitHub.

| Variável do servidor | Desenvolvimento | Demonstração publicada |
| --- | --- | --- |
| `DEMO_PROFESSOR_ACCESS_CODE` | padrão local temporário | obrigatório, longo e compartilhado apenas com professores demo |
| `DEMO_SESSION_SECRET` | aleatório por processo | obrigatório, aleatório e com ao menos 32 caracteres |
| `TEACHLI_CORS_ORIGIN` | `http://localhost:5173` | URL HTTPS exata do frontend |

O cliente envia a sessão pelo subprotocolo WebSocket, não por parâmetro de URL. O
servidor ignora um pedido de `role=professor` sem sessão válida e usa o nome assinado
da sessão. O limite de cinco tentativas de código por IP/minuto é apenas uma proteção
contra tentativas casuais em uma única instância; não substitui autenticação Microsoft.

## Protocolo atual

A conexão WebSocket recebe `room`, `role` e `name` na query. O código de sala é
normalizado para maiúsculas. `role=professor` só é aceito quando a sessão demo no
subprotocolo é válida; os demais entram como aluno. Sem professor, o aluno é recusado.

| Evento | Uso |
| --- | --- |
| `joined` | Confirma entrada, ID próprio e IDs dos pares iniciais |
| `peer-joined` | Avisa o professor da chegada de aluno |
| `peer-left` | Avisa o professor da saída de aluno |
| `signal` | Encaminha `data` do remetente ao ID `to` encontrado na mesma sala |
| `room-closed` | Informa aos alunos a saída do professor |
| `error` | Informa recusa de entrada |

O cliente usa `data.kind` igual a `offer`, `answer` ou `ice-candidate`. O servidor
repassa `data` sem validar sua estrutura; não o trate como conteúdo confiável.
Não existe aqui protocolo de chat, legenda, fila de voz ou gravação da aula.

## Hospedagem

O frontend é um build estático; o WebSocket precisa de serviço com processo Node
de longa duração e suporte a conexões persistentes. Esta documentação não atesta
uma publicação existente nem planos ou preços de provedores.

1. Instale dependências em `server/` com `npm ci` e inicie com `npm start`.
2. Configure HTTPS/TLS no provedor ou proxy para expor uma URL `wss://`.
3. Defina `VITE_SIGNALING_URL=wss://seu-servidor.exemplo.com` no ambiente de build
   do cliente ou em `client/.env.local`.
4. Execute `npm run build` em `client/` e publique `client/dist/` em HTTPS.
5. Configure fallback de rotas para `index.html` e teste entradas diretas em
   `/sala` e `/sala/CODIGO`, além dos assets em `/models/` e `/mediapipe/wasm`.

A URL `VITE_*` fica no frontend e não pode conter segredos. Não é necessário
configurar banco de dados para a sinalização. Para testes entre dispositivos,
use um contexto seguro com acesso à câmera/microfone e URL WebSocket acessível;
o endereço local de desenvolvimento sozinho não resolve publicação em rede.

## Limites conhecidos

- **Autenticação ainda demonstrativa:** professor precisa de sessão assinada e código
  demo, mas o sistema não confirma posse de uma conta Microsoft. Alunos entram por
  código de sala e não têm identidade institucional verificada.
- **Sem TURN:** [config.ts](../client/src/lib/webrtc/config.ts) configura somente
  STUN público. Redes com NAT/firewall restritivo podem impedir a mídia.
- **Topologia em estrela no cliente, sem SFU:** o professor envia uma cópia de sua
  mídia a cada aluno. Capacidade de turma depende de banda e equipamento e não
  foi estabelecida por esta revisão.
- **Estado em memória:** salas não persistem nem são compartilhadas entre instâncias.
  Reiniciar o servidor perde esse estado. Mídia P2P já conectada pode continuar
  temporariamente; não há recuperação automática implementada no cliente.
- **Sinalização não comprova mídia:** o status de entrada pode estar conectado
  antes de a negociação WebRTC funcionar. Erros e reconexão precisam de evolução.
- **Sem gravação implementada:** este processo não grava mídia ou histórico. Isso
  não impede gravação por participantes nem descreve logs de um provedor externo.

Veja a [documentação técnica](../docs/DOCUMENTACAO.md) e os
[próximos passos](../docs/GUIA_IMPLEMENTACAO.md).
