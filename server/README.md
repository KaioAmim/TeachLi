# Servidor de sinalização — Sala de Aula

`server/index.mjs` usa WebSocket para trocar mensagens que estabelecem uma
conexão WebRTC entre professor e alunos. No fluxo implementado, ofertas/respostas
SDP e candidatos ICE passam por aqui; áudio e vídeo trafegam entre os navegadores.
O servidor também recebe código de sala, nome e papel informado pelo participante.

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

Acesse `http://localhost:5173`, abra Sala de Aula, inicie como professor e use o
código para entrar como aluno. Ambos os lados solicitam câmera e microfone.
O cliente lê a URL de [config.ts](../client/src/lib/webrtc/config.ts), cujo padrão
é `ws://localhost:8787`. Para outro endereço, defina `VITE_SIGNALING_URL` em
`client/.env.local` e reinicie o Vite. `localhost` sempre identifica o dispositivo
que está executando o navegador; testar duas máquinas exige URL acessível a ambas.

## Protocolo atual

A conexão WebSocket recebe `room`, `role` e `name` na query. O código de sala é
normalizado para maiúsculas. `role=professor` tenta ocupar a vaga única de
professor; os demais valores entram como aluno. Sem professor, o aluno é recusado.

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

- **Sem autenticação:** nome e papel são informados pelo cliente. Conhecer o código
  permite tentar participar; não há prova de identidade ou vínculo institucional.
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

Veja [documentação técnica](../DOCUMENTACAO.md), [uso](../docs/USO.md) e
[próximos passos](../docs/GUIA_IMPLEMENTACAO.md).
