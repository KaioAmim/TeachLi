# Servidor de salas TeachLi

O login Microsoft existente continua direto entre navegador e Microsoft, restrito
ao tenant da instituição. **O Tenant ID é
obrigatório e restringe o acesso; não é necessário cadastrar professores no Entra para
usar esta etapa do protótipo.**

Depois do login, o servidor conecta aluno e professor à sala escolhida. Há
Laboratório A, B e C, Sala 01 e Sala 02. A sala aparece na comunicação, com presença,
troca e saída da conta. Alunos podem aguardar a chegada do professor.

## Executar

Use Node.js 22 ou posterior. Instale as dependências de `client/` e `server/` com
`npm ci` em cada pasta. Na raiz, execute:

```bash
npm run dev:classroom
```

O comando inicia os dois serviços e encerra ambos com Ctrl+C. A página usa 5173;
o servidor, 8787. Encerre instâncias anteriores para evitar conflito de portas.
Também é possível executar `npm start` em `server/` e `npm run dev` em `client/`
em terminais separados.

O servidor reutiliza automaticamente o **Client ID público que já está configurado
no cliente**. Não exige novo registro do aplicativo ou Client Secret. Para um
servidor hospedado separadamente, forneça esse mesmo ID em `MICROSOFT_CLIENT_ID`.
`server/.env` é opcional e carregado automaticamente, quando existir.

| Configuração | Uso |
| --- | --- |
| `MICROSOFT_TENANT_ID` | **Obrigatório** (ou `VITE_MICROSOFT_TENANT_ID` em `client/.env*`): GUID do tenant da instituição |
| `MICROSOFT_CLIENT_ID` | Sobrescreve o Client ID público lido de `client/.env*` |
| `OPENAI_API_KEY` | Chave privada usada pelo servidor para gerar o resumo de aula; necessária para essa função |
| `OPENAI_SUMMARY_MODEL` | Modelo da Responses API; padrão `gpt-6-luna` |
| `TEACHLI_CORS_ORIGIN` | Origens exatas permitidas; padrão localhost e 127.0.0.1 na porta 5173 |
| `TEACHLI_TRUST_PROXY` | `1` apenas atrás de proxy que sobrescreve `X-Forwarded-For` (limites por IP real) |
| `TEACHLI_ROOMS` | Catálogo JSON `[{"id":"sala-01","name":"Sala 01"}]` |
| `PORT` | Porta do servidor, padrão 8787 |
| `VITE_SIGNALING_URL` no cliente | Endereço do servidor, padrão `ws://localhost:8787` |

## Fluxo e isolamento

1. Os botões de acesso iniciam o fluxo Microsoft anterior, com `state`, nonce e PKCE.
   O servidor de salas não participa dessa etapa e sua indisponibilidade não impede
   o redirecionamento nem a conclusão do login Microsoft.
2. Depois do retorno, `/salas` troca o ID token Microsoft por uma sessão de comunicação.
   Apenas essa etapa depende do servidor. Falhas de conexão permitem tentar novamente
   sem perder o login.
3. O servidor verifica assinatura RS256, chaves oficiais Microsoft, emissor do token
   e da chave, audiência e validade. A origem organizacional vem do próprio token,
   verificado criptograficamente. Com `MICROSOFT_TENANT_ID` (ou
   `VITE_MICROSOFT_TENANT_ID` no cliente), obrigatório, tokens de outro tenant
   são recusados e o servidor não inicia sem ele.
4. Mantém-se a regra de perfil do protótipo: `@alunos.unibarretos.com.br` para aluno
   e `@unibarretos.com.br` para professor. Não se exige app role ou lista de docentes.
   Essa regra por domínio não equivale à comprovação administrativa de vínculo ou
   função docente. Uma política institucional mais restrita é uma evolução futura,
   fora do escopo atual; não bloqueia a implementação das salas.
5. O servidor decide autoria, papel e sala das mensagens. Alterar URL ou payload não
   muda o perfil verificado nem permite encaminhar mensagens a outra sala.
6. Logout invalida a sessão de comunicação e remove o login local. Sessões perdidas
   após reinício do servidor também podem ser encerradas. Esse logout é do TeachLi,
   não revoga a conta Microsoft em outros aplicativos.

O ID token fica no `sessionStorage` durante o login, com validade Microsoft; a
sessão opaca de comunicação dura no máximo uma hora e nunca ultrapassa esse prazo.
Não registre tokens em logs. A aplicação depende de HTTPS/WSS ao ser publicada.

A validação segue a [orientação Microsoft para emissores e chaves de múltiplas organizações](https://learn.microsoft.com/en-us/entra/identity-platform/access-tokens).

## Protocolo de comunicação

| Endpoint/evento | Uso |
| --- | --- |
| `POST /auth/microsoft/session` | Verifica ID token já obtido no login e emite sessão de comunicação |
| `GET /classrooms` | Lista as cinco salas, com Bearer da sessão TeachLi |
| `POST /lessons/summary` | Gera uma síntese com IA das legendas da aula finalizada (apenas aluno autenticado) |
| `POST /auth/logout` | Encerra sessão de comunicação; idempotente |
| `WS /classroom?room=ID` | Subprotocolos `teachli-session` e token opaco; sem credencial na URL |
| `joined`, `presence` | Sala confirmada e participantes conectados |
| `student.message` | Texto confirmado do aluno → professor da mesma sala |
| `caption.final` | Frase final do professor → alunos da mesma sala |
| `lesson.end` | Professor encerra o conteúdo da sala |
| `lesson.ended` | Notifica participantes; novas mensagens e legendas são recusadas |
| `message.ack`, `message.rejected` | Encaminhamento à conexão ou recusa; não comprova leitura |

Há um professor por sala e uma conexão por sessão. Trocar sala remove a associação
anterior. Sem professor, o aluno espera; não existe fila de mensagens para entrega
futura. O professor pode ouvir uma mensagem manualmente; não há áudio automático.
Texto tem limite de 2.000 caracteres. Há limites de 60 eventos/10 segundos por
conexão e 30 trocas de sessão/IP/minuto. Os últimos 500 IDs por conexão não são
retransmitidos. Sessões são limitadas a 10.000 entradas, com limpeza por expiração.

## Limites e verificação

- Estado em memória, uma instância: sem banco, gravação, histórico persistente ou
  sincronização entre servidores. O cliente mostra até 100 mensagens recebidas.
- Ao finalizar a aula, a sala fica encerrada em memória até todos saírem. As legendas
  ficam no navegador do aluno durante a sessão (até 500 falas ou 40.000 caracteres) e
  são apagadas ao sair ou trocar de sala. Quando o aluno pede o resumo, o servidor envia
  essas legendas à OpenAI Responses API; o serviço devolve assunto central, síntese,
  ideias principais e exemplos. O conteúdo não é salvo pelo TeachLi; `store: false` é
  enviado à API. A política de retenção do provedor depende da conta/API e deve ser
  revisada pela instituição antes de uso com dados de estudantes. Há limite de cinco
  gerações por aluno a cada dez minutos.
- Reconexão explícita; atualizar a página exige escolher a sala novamente.
- Qualquer conta aceita pelo perfil pode escolher qualquer sala cadastrada;
  não há matrícula por turma ou disciplina.
- Contagem de presença é de conexões; sessões em dispositivos diferentes podem
  representar a mesma pessoa.
- Texto não exige câmera/microfone. A transcrição depende do navegador/permissão.
- A chamada de vídeo e áudio é ponto a ponto. O servidor só retransmite a sinalização:
  `{ type: "signal", to, data }` com `data.kind` em `hello`, `offer`, `answer`, `candidate` ou
  `bye`, no máximo 12.000 caracteres, entre aluno e professor da mesma sala (aluno↔aluno é
  recusado). Cada conexão recebe um `selfId` e só vê os IDs do perfil oposto em `presence.peers`.
  Sem TURN configurado, redes restritivas podem impedir a chamada.

Execute `npm test` em `server/` e `npm run test:auth` em `client/`. Os testes cobrem
cabeçalhos de segurança, auditoria sem dados pessoais, limite de tentativas,
login independente do servidor, perfis por domínio, validação criptográfica sem
com Tenant ID obrigatório, isolamento, troca de sala, logout, expiração e
requisições malformadas. A conferência com contas Microsoft reais e dispositivos da
turma continua sendo validação manual.

## Segurança e privacidade

Cabeçalhos de segurança, limites de abuso e o registro de auditoria (sem token, e-mail ou nome) estão descritos em [Segurança e LGPD](../docs/DOCUMENTACAO.md#7-segurança-e-lgpd).
