# Servidor de sinalização — Sala de Aula

Servidor WebSocket mínimo que existe só para o professor e cada aluno trocarem
SDP/ICE e conseguirem abrir uma conexão WebRTC direta entre si. **Nunca vê
áudio ou vídeo** — depois que a conexão P2P sobe, a mídia não passa mais por
aqui.

## Por que existe um servidor separado

O client (`client/`) é um site estático (hoje publicado em ~12 MB no GitHub
Pages, ver `docs/MODELO.md`). GitHub Pages não roda processos — só serve
arquivos. WebRTC precisa de *algum* canal para os dois lados combinarem como
se conectar antes da conexão direta existir; esse canal é este servidor.

## Rodar localmente

```bash
cd server
npm install
npm start
# ouvindo em ws://localhost:8787
```

Por padrão o client (`client/src/lib/webrtc/config.ts`) já aponta para
`ws://localhost:8787`, então basta rodar os dois lados (`npm run dev` no
client, `npm start` aqui) para testar a Sala de Aula localmente.

## Hospedar para uso real

Qualquer serviço que rode um processo Node de longa duração funciona — por
exemplo Render, Railway ou Fly.io (todos com um nível gratuito/hobby
suficiente para uma turma). Passos gerais:

1. Publique a pasta `server/` como um serviço Node (comando de start: `npm start`,
   ou `node index.mjs`).
2. O serviço vai expor uma URL própria, tipicamente `wss://algo.onrender.com`
   (note o `wss://`, não `ws://` — HTTPS exige WebSocket seguro).
3. No `client/`, crie um arquivo `.env.local` com:
   ```
   VITE_SIGNALING_URL=wss://algo.onrender.com
   ```
4. Rode `npm run build` no client de novo e publique o resultado (`dist/`)
   como já é feito hoje.

## Limites conhecidos

- **Sem TURN.** Só STUN público (Google) está configurado
  (`client/src/lib/webrtc/config.ts`). STUN resolve o endereço público de cada
  peer, mas não ajuda quando um dos lados está atrás de um NAT simétrico ou
  firewall restritivo — comum em redes de escola/empresa. Nesses casos a
  chamada falha silenciosamente (fica em "Conectando..."). Resolver isso exige
  um servidor TURN (ex. coturn, ou um serviço gerenciado), que retransmite a
  mídia quando a conexão direta não é possível — mais infraestrutura, ainda
  não incluída aqui.
- **Estrela, não mesh, e sem SFU.** O professor mantém uma conexão direta com
  cada aluno; o upload do professor cresce com o número de alunos (cada
  stream de vídeo é uma cópia separada). Funciona bem para turmas pequenas.
  Para turmas grandes, o próximo passo seria um SFU (ex. mediasoup, LiveKit)
  em vez de WebRTC P2P puro — troca simplicidade por escala.
- **Sem persistência.** Salas e conexões vivem só na memória do processo; um
  restart do servidor derruba todas as aulas em andamento.
- **Sem autenticação.** Qualquer pessoa com o código da sala entra. Suficiente
  para uma sala de aula com código compartilhado de forma controlada, não para
  um ambiente que precise impedir acesso não autorizado.
