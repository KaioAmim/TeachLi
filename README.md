# TeachLi

Protótipo de apoio à comunicação em sala de aula, com texto para voz e
reconhecimento experimental de gestos pela webcam. O objetivo é ampliar as formas
de participação de alunos surdos.

**O modelo experimental inclui as 26 letras de A a Z; ele não traduz Libras completa.**
H, J, K, X e Z são classificados pela pose, sem validar o movimento completo.
Ç ainda não está incluído. Modelos pessoais mantêm prioridade sobre o modelo base.
Veja os resultados e limites do treino com as duas bases em
[Treinamento do alfabeto](docs/TREINAMENTO_ALFABETO.md).
O reconhecimento depende dos dados de treino e precisa de avaliação com usuários.

## O que está disponível

| Recurso | Funcionamento atual |
| --- | --- |
| Modo Aluno | Enviar texto confirmado ao professor da mesma sala; voz local opcional |
| Salas | Laboratórios A/B/C e salas 01/02; seleção após login, presença e troca de sala |
| Reconhecimento por pose | MediaPipe + TensorFlow.js, A–Z experimental ou modelo pessoal |
| Sinais dinâmicos | Treino local experimental; captura precisa preservar trajetória antes da próxima coleta |
| VLibras | Widget opcional no Modo Aluno para traduzir o texto exibido na página |
| Modo Professor | Receber mensagens dos alunos e compartilhar frases finais da transcrição na sala |

A comunicação por texto usa o servidor independente e reaproveita o login Microsoft
já existente. Consulte o [guia de salas e autenticação](server/README.md).
Não é necessário fornecer Tenant ID da faculdade ou cadastrar docentes no Entra.

## Executar localmente

Use Node.js 22 ou posterior e npm, um navegador com WebGL e câmera para reconhecimento. A
digitação com voz não exige ligar a câmera.

```bash
git clone https://github.com/KaioAmim/TeachLi.git
cd TeachLi
npm ci --prefix client
npm ci --prefix server
npm run dev:classroom
```

Abra `http://127.0.0.1:5173` (ou `http://localhost:5173` se cadastrado na Microsoft).
A porta 5173 é fixa no desenvolvimento e na prévia de build. Se já estiver ocupada,
use a instância do TeachLi em execução ou encerre-a antes de iniciar outra; o Vite
não mudará automaticamente para 5174. Não altere a porta sem cadastrar também
o novo endereço de retorno na Microsoft.
O comando copia automaticamente o runtime WASM do MediaPipe para `client/public/`.

## Iniciar site e servidor juntos

Após instalar as dependências em `client/` e `server/`, execute na raiz:

```bash
npm run dev:classroom
```

Esse comando inicia os dois serviços e os encerra juntos com Ctrl+C. Encerre
instâncias anteriores antes de usá-lo, pois a porta do site continua fixa em
5173. `npm run dev` dentro de `client/` inicia somente a página. O servidor
reutiliza o Client ID público já configurado no cliente; `server/.env` é opcional.
O login Microsoft funciona independentemente do servidor de salas. Se este estiver
indisponível, a seleção de sala permite tentar novamente sem refazer o login.

## Configurar login Microsoft

Os botões **Aluno** e **Professor** direcionam para a Microsoft e retornam à
seleção de sala. Antes de testar, registre um aplicativo de página única (SPA) no
Microsoft Entra e defina `VITE_MICROSOFT_CLIENT_ID` em `client/.env.local`:

```bash
VITE_MICROSOFT_CLIENT_ID=application-client-id-da-microsoft
VITE_MICROSOFT_TENANT_ID=organizations
```

O arquivo `client/.env.local` com o Client ID público do TeachLi e `organizations`
foi incluído neste repositório para facilitar o teste local. Ele não contém senha
nem Client Secret; não acrescente credenciais privadas a esse arquivo versionado.

No registro do aplicativo, cadastre como URLs de redirecionamento do tipo **SPA**
`http://127.0.0.1:5173/entrar` e, se for usar esse endereço, também
`http://localhost:5173/entrar`. O valor `organizations` usa contas organizacionais
Microsoft. Não use Client Secret no frontend.

Se aparecer `AADSTS50011` com `http://127.0.0.1:5174/entrar`, abra o TeachLi em
`http://127.0.0.1:5173` e inicie o login novamente. Não basta trocar a porta
na URL de retorno: a sessão temporária deve ser criada na mesma origem antes
de ir à Microsoft. Em outro ambiente, cadastre a URL exata de `/entrar` como
SPA no Microsoft Entra; desenvolvimento e produção têm endereços distintos.

No retorno, o cliente exige o domínio exato `@alunos.unibarretos.com.br` para
Aluno e `@unibarretos.com.br` para Professor. Uma conta não pode entrar no perfil
do outro domínio; contas externas, sem e-mail e o domínio fictício
`@prof.unibarretos.com.br` são recusados. Sessões salvas são reavaliadas ao abrir
as rotas, incluindo o treino de aluno. Não há exceção Microsoft para professor demo.

O login preserva o fluxo anterior, direto com a Microsoft, sem exigir Tenant ID
institucional ou cadastro adicional de docentes. Depois do retorno, o servidor
valida a assinatura e a validade do token ao preparar a comunicação por sala,
mantendo os mesmos domínios de perfil já usados pelo protótipo.
O servidor reaproveita o Client ID público do cliente automaticamente. Execute
`npm run test:auth` em `client/` e `npm test` em `server/` para verificar os dois lados.

Depois de autenticar, escolha Laboratório A/B/C, Sala 01 ou Sala 02. A sala aparece
nas telas de comunicação, junto da presença e dos botões de troca/logout.
Mensagens do aluno exigem confirmação; Enter envia e Shift+Enter insere linha.
Frases finalizadas do professor são compartilhadas enquanto a transcrição estiver
ativa. Não há histórico persistente ou envio para participantes de outra sala.

> O `package.json` da raiz pertence ao caminho herdado Express/tRPC/Drizzle,
> com versões diferentes de React e Vite. Os comandos acima usam os pacotes de
> `client/` e `server/`. Não misture instalações nem execute migrações para
> iniciar a aplicação atual. Consulte [arquitetura e legado](docs/DOCUMENTACAO.md).

## Verificar e gerar o site

Na pasta `client/`:

```bash
npm run typecheck
npm run build
npm run preview
```

O build independente gera `client/dist/`; o preview serve esse build localmente.
O comando completo verifica os tipos antes de compilar. O TypeScript acompanha
a entrada `src/main.tsx` e todos os seus imports, as declarações locais e a
configuração Vite, mantendo o modo estrito. Telas e APIs herdadas têm uma
auditoria separada, `npm run typecheck:legacy`, que ainda aponta pendências e
não integra o build do aplicativo atual. Reintroduzir um módulo legado por import
volta a incluí-lo na checagem normal. Veja a [fronteira de compilação](docs/DOCUMENTACAO.md#fronteira-de-compilação-e-legado).
Não use o preview como validação se estiver servindo artefatos antigos.
Para publicar, hospede o frontend com fallback das rotas para `index.html` e
confira os caminhos dos modelos; o Vite atual usa a base `/`.

Na raiz, confira a branch, o título de commit proposto e o diff manualmente
conforme [as convenções](docs/BRANCHES.md). Os scripts de verificação de
convenções citados em versões anteriores da documentação não estão presentes
nesta cópia do projeto.

Compilar e verificar tipos não valida câmera, áudio, tradução, conexão entre
redes ou precisão dos modelos. As verificações manuais por recurso devem ser definidas no plano de implementação.

## Documentação

| Documento | Conteúdo |
| --- | --- |
| [Documentação técnica](docs/DOCUMENTACAO.md) | Arquitetura, rotas, armazenamento, modelo de gestos e limites |
| [Branches, labels e commits](docs/BRANCHES.md) | Os seis tipos, exemplos e revisão manual |
| [Plano de implementação](docs/GUIA_IMPLEMENTACAO.md) | Estado atual, prioridades, aula híbrida/EAD e critérios de aceite |

## Organização do trabalho

Novas branches usam `feature/`, `bug/`, `documentation/`, `enhancement/`,
`maintenance/` ou `ui-ux/`, conforme o [padrão completo](docs/BRANCHES.md).
Cada alteração volta à `main` por PR com escopo, testes e documentação revisados.
Os templates `.github/` citados em versões antigas não estão presentes nesta cópia.

## Direção do projeto e validação

O objetivo continua sendo uma aula presencial, remota ou híbrida acessível, com
mensagens revisadas, legendas legíveis, voz controlada e apoio em Libras. A etapa
atual entrega salas e texto compartilhado; legendas parciais, fila de voz,
movimentos completos, Ç e histórico continuam no [plano de evolução](docs/GUIA_IMPLEMENTACAO.md).

A verificação com contas reais de aluno e professor em dispositivos diferentes
ainda exige os equipamentos e os logins dos titulares. Testes com identidades
simuladas e sessões separadas no mesmo computador não substituem essa avaliação.
Não é necessário compartilhar senhas nem obter Tenant ID institucional para isso.
