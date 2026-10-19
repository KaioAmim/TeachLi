# TeachLi

Protótipo de apoio à comunicação em sala de aula, com texto para voz e
reconhecimento experimental de gestos pela webcam. O objetivo é ampliar as formas
de participação de alunos surdos.

**O modelo base reconhece 15 letras estáticas; ele não traduz Libras completa.**
O reconhecimento depende dos dados de treino e precisa de avaliação com usuários.

## O que está disponível

| Recurso | Funcionamento atual |
| --- | --- |
| Modo Aluno | Digitar e ouvir no próprio dispositivo; Enter fala e Shift+Enter insere linha |
| Reconhecimento estático | MediaPipe + TensorFlow.js, 15 letras no modelo base ou modelo pessoal |
| Sinais dinâmicos | Treino local com clipes das mãos; depende das amostras do usuário |
| VLibras | Widget opcional no Modo Aluno para traduzir o texto exibido na página |
| Modo Professor | Transcrição de fala para texto no próprio navegador |

A próxima direção é compartilhar texto acessível entre participantes presenciais e remotos,
com mensagens confirmadas, legendas e voz. A proposta e os critérios de aceite estão no
[plano de implementação](docs/GUIA_IMPLEMENTACAO.md).

## Executar localmente

> **Pendência conhecida na main:** a instalação de `client/` conclui, mas o
> início do Vite acusa `@radix-ui/react-dialog` ausente; `typecheck` e `build`
> também falham em dependências e exports legados. Os comandos abaixo documentam
> o fluxo previsto, ainda dependente da regularização do pacote do cliente.
> Esta atualização de documentação não corrige esses arquivos de aplicação.

Use Node.js 22 e npm, um navegador com WebGL e câmera para reconhecimento. A
digitação com voz não exige ligar a câmera.

```bash
git clone https://github.com/KaioAmim/TeachLi.git
cd TeachLi/client
npm ci
npm run dev
```

Abra `http://127.0.0.1:5173` (ou `http://localhost:5173` se cadastrado na Microsoft).
A porta 5173 é fixa no desenvolvimento e na prévia de build. Se já estiver ocupada,
use a instância do TeachLi em execução ou encerre-a antes de iniciar outra; o Vite
não mudará automaticamente para 5174. Não altere a porta sem cadastrar também
o novo endereço de retorno na Microsoft.
O comando copia automaticamente o runtime WASM do MediaPipe para `client/public/`.

## Configurar login Microsoft

Os botões **Aluno** e **Professor** direcionam para a Microsoft e retornam ao
modo escolhido. Antes de testar, registre um aplicativo de página única (SPA) no
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

Essa checagem no navegador corrige a seleção indevida de perfil, mas não substitui
autorização de servidor: a sessão local é editável e o fluxo atual não verifica a
assinatura do ID token. Antes de proteger dados ou ações de servidor, implementar
validação criptográfica, tenant institucional permitido e permissões por identidade
estável (`tid`/`oid`) ou funções atribuídas. O servidor de sala ainda usa login demo
separado. Execute `npm run test:auth` em `client/` para os testes dessa regra.

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
O `npm run typecheck` permanece bloqueado por dependências e arquivos legados
ausentes, mas o build direto `npx vite build` foi concluído nesta revisão. Não
use o preview como validação de uma alteração se ele estiver servindo artefatos
antigos.
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
Há modelos de issue e PR em `.github/`.
