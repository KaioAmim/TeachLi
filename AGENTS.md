# Instruções para agentes do TeachLi

## Referência atual e organização

- Use a `main` atual como base. Consulte `README.md`, `CONTRIBUTING.md`, `docs/BRANCHES.md` e a documentação técnica antes de alterar o projeto.
- Novas branches seguem a convenção específica do projeto: `feature/`, `bug/`, `documentation/`, `enhancement/`, `maintenance/` ou `ui-ux/`, com descrição em minúsculas e hífens. Esta convenção prevalece sobre um prefixo genérico da ferramenta.
- Siga a correspondência entre labels, commits e título do PR em `docs/BRANCHES.md`. Execute `node --test scripts/check-conventions.test.mjs` e valide a branch/título/commits com `node scripts/check-conventions.mjs` antes da entrega.
- O fluxo atual usa os pacotes independentes em `client/` e `server/`. Não confunda a API Express/tRPC herdada da raiz com o servidor de sinalização em `server/index.mjs`.
- Preserve alterações de outras tarefas. Para recuperar documentação de uma branch antiga, adapte o conteúdo à implementação atual em vez de mesclar código antigo sem necessidade.

## Responsável pela documentação

O usuário solicitou um subagente dedicado à documentação, chamado `documentacao`.

- Em tarefas que alterem o projeto, acione exatamente um subagente de documentação antes de concluir a entrega. Reutilize o subagente `documentacao` da conversa quando estiver disponível; caso contrário, crie um com essa responsabilidade.
- O agente principal deve informar o escopo da tarefa, as mudanças realizadas, os arquivos envolvidos, os requisitos do usuário e as verificações executadas. Separe mudanças da tarefa de alterações preexistentes ou de outros trabalhos.
- O subagente de documentação não deve criar outros subagentes. Esta instrução de delegação se aplica apenas ao agente principal.
- Se a sessão não oferecer subagentes, execute a mesma revisão diretamente e informe essa limitação.

### Trabalho do subagente `documentacao`

1. Ler a documentação pertinente, começando por `README.md`, `DOCUMENTACAO.md`, `server/README.md` e `docs/`, conforme existirem e forem relevantes.
2. Comparar as alterações com os requisitos, contratos, fluxos e limitações documentados e com a solicitação atual do usuário.
3. Distinguir documentação desatualizada de possíveis erros na implementação. Não mudar requisitos documentados apenas para acomodar um defeito; comunicar divergências ao agente principal com referências aos arquivos.
4. Atualizar a documentação afetada quando a evolução autorizada do projeto mudar funcionalidades, instalação, configuração, comandos, APIs, dados, arquitetura ou limitações. Não reescrever documentos sem necessidade.
5. Descrever apenas comportamentos comprovados no código ou nas verificações. Diferenciar recursos implementados, simulados, planejados e ainda não validados. Não incluir segredos ou credenciais.
6. Conferir links locais, caminhos, comandos e exemplos que forem alterados. Relatar o que foi conferido e o que não pôde ser validado.
7. Entregar um resumo dos documentos revisados e atualizados e das divergências restantes. Quando não houver impacto documental, declarar isso brevemente, sem criar alterações artificiais.

O subagente pode editar documentação dentro do escopo da tarefa. Correções no código ficam com o agente principal. Preserve o trabalho de outras tarefas e não faça commits ou publicações sem que façam parte da solicitação.

## Quando a revisão acontece

A revisão é uma etapa das tarefas executadas pelos agentes neste repositório. Este arquivo não instala um monitor em segundo plano nem dispara revisões de alterações externas por conta própria. O agente principal deve aguardar o resultado da revisão e tratar as divergências pertinentes antes de declarar a tarefa concluída.
