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
`npm ci` em cada pasta. Para gerar resumos, configure o acesso ao LiteLLM Proxy:

```env
LITELLM_API_BASE=http://localhost:4000/v1
LITELLM_API_KEY=sk-sua-chave-virtual
LITELLM_MODEL=resumo-aula
LITELLM_TIMEOUT_SECONDS=60
```

Antes de chamar a IA, o servidor seleciona palavras-chave e até 6.000 caracteres de
trechos representativos, sem modelo ou serviço externo. A IA recebe esse recorte com
contexto para escrever o material de estudo em palavras próprias. Mantenha a chave
somente no servidor, nunca em `VITE_*` ou no código do cliente.

O TeachLi faz uma requisição ao endpoint `/chat/completions` do gateway. O alias
`LITELLM_MODEL` e a configuração do proxy determinam quais implantações podem atender
à chamada. O exemplo [`litellm-config.example.yaml`](./litellm-config.example.yaml)
configura failover em ordem entre Groq, Cloudflare Workers AI, OpenRouter, Mistral e Gemini
(chaves `GROQ_API_KEY`, `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID`, `OPENROUTER_API_KEY`,
`MINISTRAL_AI_API_KEY` e `GEMINI_API_KEY`); confira os IDs de modelo, que mudam com
frequência. Com `order`, o LiteLLM usa a implantação de menor número e só passa à seguinte
em caso de cota esgotada, erro ou cooldown. O balanceamento escolhe uma implantação por
tentativa: não divide um resumo entre modelos nem garante alternância A/B. Configure
tentativas e alternativas no LiteLLM para falhas ou cotas esgotadas; cada provedor
mantém seus próprios limites, custos e termos.

Para iniciar cliente e servidor localmente, execute na raiz:

```bash
npm run dev:classroom
```

O comando inicia os dois serviços e encerra ambos com Ctrl+C. A página usa 5173;
o servidor, 8787. Encerre instâncias anteriores para evitar conflito de portas.
Também é possível executar `npm start` em `server/` e `npm run dev` em `client/`
em terminais separados.

## Docker Compose (desenvolvimento/POC)

O Compose mantém três containers na mesma rede privada: `client` (Vite, porta 5173),
`server` (Node, porta 8787) e `litellm` (proxy, porta 4000). O Node chama
`http://litellm:4000/v1` pelo nome do serviço; a porta 4000 não é publicada no host.
As chaves dos provedores são passadas somente ao container LiteLLM.

1. Copie `.env.docker.example` para `.env.docker` na raiz e preencha os valores.
2. Confira em `server/litellm-config.example.yaml` se os IDs de modelo ainda existem nos
   provedores.
3. Execute `docker compose --env-file .env.docker up --build` e abra
   `http://localhost:5173`.

Para saber qual provedor atendeu cada resumo, veja `docker compose --env-file .env.docker logs -f server`:
cada geração registra `[resumo] provedor=... fallbacks=... tokens=... custo_estimado_usd=...`. O custo
é uma estimativa pela tabela de preços do LiteLLM; a cobrança real depende do plano de cada chave
(Groq e OpenRouter `:free` não cobram no plano gratuito; a Cloudflare tem limite rígido de 10.000 neurons/dia
no plano Workers Free e só cobra se a conta assinar o Workers Paid; a Mistral só é gratuita no plano Experiment,
e o plano Scale cobra por uso; no Gemini, ativar faturamento no projeto da chave passa a cobrar por uso). Os logs não contêm o conteúdo da aula.

Essa configuração é para desenvolvimento e prova de conceito: o cliente usa o Vite.
Para produção, ainda é necessário servir o build estático, configurar domínio e HTTPS/WSS.
Docker evita instalar Node e LiteLLM diretamente na máquina; o host continua precisando
de Docker e acesso à internet para alcançar os provedores.

## Prova de conceito do balanceamento

`poc/run_litellm_load_balance_poc.py` inicia um LiteLLM temporário e dois endpoints
OpenAI simulados em `localhost`, dispara 50 pedidos simultâneos e confirma que ambos
receberam chamadas. Não usa contas ou modelos reais, portanto não consome cotas nem gera
cobrança de provedor. Para repetir em Linux/macOS:

```bash
python3 -m venv /tmp/teachli-litellm-poc
/tmp/teachli-litellm-poc/bin/pip install 'litellm[proxy]'
PATH="/tmp/teachli-litellm-poc/bin:$PATH" python3 server/poc/run_litellm_load_balance_poc.py
```

O resultado demonstra concorrência e distribuição no gateway local. Não mede a capacidade,
latência, disponibilidade ou cotas dos provedores reais.

O servidor reutiliza automaticamente o **Client ID público que já está configurado
no cliente**. Não exige novo registro do aplicativo ou Client Secret. Para um
servidor hospedado separadamente, forneça esse mesmo ID em `MICROSOFT_CLIENT_ID`.
`server/.env` é opcional e carregado automaticamente, quando existir.

| Configuração | Uso |
| --- | --- |
| `MICROSOFT_TENANT_ID` | **Obrigatório** (ou `VITE_MICROSOFT_TENANT_ID` em `client/.env*`): GUID do tenant da instituição |
| `MICROSOFT_CLIENT_ID` | Sobrescreve o Client ID público lido de `client/.env*` |
| `LITELLM_API_BASE` | URL base do LiteLLM, por exemplo `http://localhost:4000/v1` |
| `LITELLM_API_KEY` | Chave virtual usada pelo servidor TeachLi |
| `LITELLM_MODEL` | Alias do modelo/grupo configurado no LiteLLM |
| `LITELLM_TIMEOUT_SECONDS` | Tempo máximo de geração; padrão `60` |
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
| `POST /lessons/summary` | Reduz a transcrição e gera material didático via LiteLLM (apenas aluno autenticado) |
| `POST /auth/logout` | Encerra sessão de comunicação; idempotente |
| `WS /classroom?room=ID` | Subprotocolos `teachli-session` e token opaco; sem credencial na URL |
| `joined`, `presence` | Sala confirmada e participantes conectados |
| `student.message` | Texto confirmado do aluno → professor da mesma sala |
| `lesson.end` | Professor encerra o conteúdo da sala |
| `lesson.ended` | Notifica participantes; novas mensagens e legendas são recusadas |
| `caption.final` | Frase final do professor → alunos da mesma sala e histórico temporário para alunos que entrarem depois |
| `message.ack`, `message.rejected` | Encaminhamento à conexão ou recusa; não comprova leitura |

Há um professor por sala e uma conexão por sessão. Trocar sala remove a associação
anterior. Sem professor, o aluno espera; não existe fila de mensagens para entrega
futura. O professor pode ouvir uma mensagem manualmente; não há áudio automático.
Texto tem limite de 2.000 caracteres. Há limites de 60 eventos/10 segundos por
conexão e 30 trocas de sessão/IP/minuto. Os últimos 500 IDs por conexão não são
retransmitidos. Sessões são limitadas a 10.000 entradas, com limpeza por expiração.

## Limites e verificação

- Estado em memória, uma instância: sem banco, gravação, histórico persistente ou
  sincronização entre servidores. O cliente mantém até 500 mensagens recebidas na sessão.
- As últimas 500 legendas do professor (até 40.000 caracteres) ficam em memória na sala;
  alunos que entrarem depois recebem esse histórico. As legendas são apagadas quando
  todos saem da sala ou quando o servidor reinicia.
- Ao finalizar a aula, a sala fica encerrada em memória até todos saírem. As legendas
  ficam no servidor e no navegador do aluno durante a sessão (até 500 falas ou 40.000
  caracteres) e são apagadas quando todos saem. O primeiro aluno que pedir a síntese aciona
  uma geração no LiteLLM; os demais compartilham o processamento em andamento e o resultado em
  memória. Há limite global de 100 chamadas de IA por dia no fuso do Pacífico e limite de
  cinco pedidos por aluno a cada dez minutos. Ao atingir o limite, o TeachLi interrompe novas
  gerações. O limite global fica em memória
  e reinicia se o processo do servidor reiniciar. O redutor local seleciona palavras-chave
  e até 6.000 caracteres de trechos representativos; só esse recorte é enviado ao LiteLLM.
  O modelo sintetiza os tópicos e devolve resumo didático, pontos principais, exemplos presentes
  na aula e perguntas de revisão. Falhas antes de concluir não consomem o limite diário.
- A URL, a chave virtual, o alias e os provedores disponíveis são definidos pelo operador.
  LiteLLM pode balancear e tentar alternativas, mas cada provedor aplica seus próprios
  limites, custos, termos e regras de retenção. O operador deve informar quais provedores
  podem receber os trechos da transcrição.
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
