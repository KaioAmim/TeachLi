# Documentação técnica do TeachLi

## Estado do sistema

O TeachLi é um protótipo de apoio à comunicação em sala de aula. A integração
bidirecional entre dispositivos ainda precisa ser implementada. O modo Professor
transcreve áudio no próprio navegador e incorpora o widget VLibras. O modo Aluno
captura mãos e executa um classificador local de 15 letras estáticas, ou um modelo
pessoal salvo no navegador. A síntese de voz ocorre no dispositivo atual.

A página Histórico usa dados de demonstração. A API já contém operações de sessão
 e tradução, mas isso não significa que as páginas estejam persistindo as aulas.
O login é Manus OAuth e os papéis do banco são user/admin, não aluno/professor.

## Arquitetura e arquivos mantidos

```text
TeachLi/
├── client/
│   ├── index.html
│   ├── public/
│   │   ├── datasets/libras-landmarks.json
│   │   └── models/             # MediaPipe e classificador TF.js
│   └── src/
│       ├── _core/hooks/        # autenticação utilizada pela interface
│       ├── components/        # somente componentes alcançados pelo app
│       ├── contexts/
│       ├── hooks/             # câmera, classificador e controles utilizados
│       ├── lib/               # features, treino, importação e tRPC
│       └── pages/             # Home, Professor, Aluno, Treino e Histórico
├── server/
│   ├── _core/                 # servidor, OAuth, contexto, cookies e API base
│   ├── db.ts
│   └── routers.ts
├── shared/
├── drizzle/                   # schema, SQL e metadados das migrações
├── datasets-raw/libras-alphabet/ # pesquisa; não é publicado pelo Vite
├── scripts/
│   ├── dataset/               # pipeline Python offline
│   ├── check-conventions.mjs
│   └── check-conventions.test.mjs
├── docs/
│   ├── MODELO.md
│   ├── LIMPEZA.md
│   └── GUIA_IMPLEMENTACAO.md
├── .env.example
├── package.json
└── pnpm-lock.yaml
```

O Vite usa client/ como raiz. O build gera dist/public e o esbuild gera
 dist/index.js. Arquivos em datasets-raw não são copiados pelo Vite. node_modules,
 dist, .env e training-output são locais e não devem entrar em commits.

Os dados do modelo e a licença do dataset foram preservados. As migrações existentes
não devem ser apagadas por parecerem antigas: elas descrevem o histórico do banco.
A declaração server/_core/types/cookie.d.ts é carregada pelo TypeScript e não exige
um import explícito no aplicativo.

## API e persistência existentes

| Área | Operações | Limite atual |
| --- | --- | --- |
| auth | me, logout e callback OAuth | Depende do provedor Manus configurado |
| system | health, notifyOwner | Notificação administrativa herdada, ainda exposta |
| session | create, end, list, getById | Sessões por usuário; não são salas compartilhadas |
| translation | save, listBySession | Requer integração das páginas e autorização por sessão |

O schema contém users, sessions, translations e gestures. A última tabela é
herdada e está preservada no schema/migrações; o treino atual usa o navegador.
Antes de usar dados reais, verificar associação à sala/sessão em todas as consultas
 e alterações. Exigir login sozinho não impede acesso a um ID de outra pessoa.

## Reconhecimento e treino

O MediaPipe extrai landmarks da mão. handFeatures.ts normaliza 21 pontos para
63 valores. O classificador tenta primeiro o modelo pessoal em IndexedDB e,
na ausência dele, carrega client/public/models/gesture-classifier.

O importador lê landmarks já extraídos, evitando processar as fotos no navegador.
As 15 classes do modelo base são A, B, C, D, E, I, L, M, N, O, R, S, U, V e W.
A lista de nomes da tela de treino serve para rotular novas amostras: não prova
que o modelo reconheça todas aquelas palavras. Consulte [MODELO.md](docs/MODELO.md).

## Labels, branches e commits

A consulta ao GitHub encontrou as labels abaixo. Não foram encontradas tags Git
 de versão. Labels classificam issues/PRs; tags Git apontam para commits de uma
 versão. Um prefixo feature/ é uma convenção de branch, não uma tag Git.

Esta revisão estabelece a seguinte correspondência a partir das labels existentes:

| Label no GitHub | Prefixo de branch | Tipos de commit permitidos | Uso |
| --- | --- | --- | --- |
| feature | feature/ | feat | Funcionalidade nova |
| bug | bug/ | fix | Correção de comportamento incorreto |
| documentation | documentation/ | docs | Documentação |
| enhancement | enhancement/ | feat, perf, refactor | Melhoria de funcionalidade existente |
| maintenance | maintenance/ | chore, refactor, build, ci, test | Manutenção interna |
| UI/UX | ui-ux/ | style, feat, fix | Interface, interação e acessibilidade |

Formato da branch: prefixo/descricao-curta-em-minusculas. Formato do commit:
 tipo(escopo-opcional): descrição. Exemplos: feature/salas-compartilhadas com
 feat(salas): permitir entrada por código; bug/repeticao-audio com
 fix(audio): evitar reprodução duplicada.

A label principal deve corresponder ao prefixo da branch. PRs podem ter labels
secundárias, e seus commits podem usar os tipos associados a qualquer uma delas.
O título do PR segue o mesmo formato do commit. Para uma melhoria puramente interna,
use maintenance/refactor; não classifique como feature apenas por alterar código.
O verificador checa nomes e correspondência, não deduz se o comportamento implementado
realmente merece determinada classificação: isso faz parte da revisão do diff.

### Histórico encontrado

- main: branch de integração, inicialmente em 09a976f nesta revisão.
- Projeto_Treinadov1: branch legada, sem prefixo padronizado.
- feat/ProjetoAlteradov1.1: branch legada integrada pelo PR #9.
- e7d3d42: adicionou a cópia libras-modelo-treinado; não registrou exclusões.
- PRs #1, #8 e #9: estavam fechados e sem labels na consulta.

Os nomes antigos não são reescritos nem os commits reclassificados retroativamente.
A convenção aplica-se ao trabalho novo. A revisão atual usa
 maintenance/limpeza-estrutura-documentacao e as labels maintenance, documentation
 e bug, pois inclui manutenção, documentação e correção da integração do modelo.

### Fluxo de trabalho

1. Atualizar main e criar uma branch com o prefixo da label principal.
2. Implementar uma mudança com escopo definido e revisar arquivos novos/removidos.
3. Executar os comandos abaixo com as labels propostas para o PR.
4. Criar commits no formato documentado e repetir a checagem usando origin/main.
5. Enviar a branch, abrir PR para main e aplicar as mesmas labels no GitHub.
6. Conferir as labels efetivas, revisar o diff e os resultados dos testes antes
   do merge. Se a branch ou as labels mudarem, executar a checagem novamente.
7. Atualizar a documentação quando o comportamento ou o procedimento mudar.

Não criar uma tag de versão somente para indicar o tipo de alteração. Uma eventual
política de versões/releases deverá ser definida separadamente pela equipe.

## Verificações

Use pnpm 10.4.1, conforme packageManager; outras versões podem interpretar o
lockfile de maneira diferente.

```bash
pnpm install --frozen-lockfile
pnpm check
pnpm test
pnpm build
pnpm check:conventions --labels maintenance,documentation,bug --base origin/main
```

Antes de existir um commit, valide o título pretendido:

```bash
pnpm check:conventions --labels maintenance,documentation,bug --title "chore: limpar estrutura e documentar o projeto"
```

O comando lê a branch atual. --base valida todos os commits novos não merge entre
 a base e HEAD. --title valida também o título informado. --branch permite testar
um nome proposto, sem trocar a branch. Uma faixa sem commits e sem título é rejeitada.
As labels são informadas explicitamente: o script não consulta nem altera o GitHub.
Este verificador local não é um bloqueio automático de merge no GitHub.

pnpm test executa cinco testes do verificador de convenções com Node.js, sem Vitest.
Não existe, ainda, uma suíte funcional do aplicativo. TypeScript verifica imports,
variáveis e parâmetros locais sem uso; isso não encontra todo arquivo órfão.

A limpeza passou por TypeScript, build, inferência TF.js, integridade dos artefatos
 e verificações HTTP. O build mantém um aviso de bundle grande. Câmera, áudio,
OAuth real, widget externo e treino Python completo precisam de testes específicos.
Detalhes em [LIMPEZA.md](docs/LIMPEZA.md).

## Configuração e deploy

As variáveis estão em .env.example. Não versionar .env. Para persistência, configurar
DATABASE_URL e aplicar as migrações com pnpm db:push em um banco apropriado.
O comando gera e aplica migrações: revisar alterações de schema antes de executar
contra um banco compartilhado.

O servidor completo exige Node.js. A configuração vercel.json foi preservada,
mas ainda precisa ser validada/adaptada; não foi testado um deploy Vercel nesta
revisão. O OAuth institucional também não foi implementado nesta limpeza.

O plano de evolução está no [guia de implementação](docs/GUIA_IMPLEMENTACAO.md).
