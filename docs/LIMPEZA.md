# Recuperação da documentação e histórico de limpeza

## Origem recuperada

A branch `maintenance/limpeza-estrutura-documentacao`, consultada em `b937716`,
continha convenções de branches/commits, um roteiro de evolução e um relatório
de limpeza relativo a uma versão anterior do projeto. A recuperação atual parte
da `main` em `5cf6d3c` e reaproveita essa organização documental com descrições
atualizadas do cliente independente e da Sala de Aula.

Os documentos antigos não devem ser copiados como um laudo da versão atual:
naquela etapa o frontend e o servidor completo tinham outra composição, e ainda
não refletiam todos os recursos hoje presentes na `main`.

## O que esta recuperação altera

- Documentação técnica, instruções de uso e contribuição, convenções e roteiro.
- Verificador e materiais de apoio ao fluxo de branches, commits e PRs.
- Registro da responsabilidade de revisão documental pelos agentes.

Não são importadas as alterações funcionais da antiga branch de manutenção.
Esta recuperação não executa remoção de dependências, migração de dados,
reescrita do histórico Git ou limpeza do aplicativo.

## O que o relatório antigo afirmava

O texto histórico descrevia incorporação de uma cópia de modelo, remoção de
arquivos/dependências sem uso, retirada de fotos do diretório público, caminhos
Python portáveis e verificações de build, HTTP e inferência. Essas afirmações
pertencem àquela branch e àquela revisão. Seus testes não comprovam o estado
da `main` atual e não devem ser apresentados como resultados desta recuperação.

## Evidências na base atual

| Área | Estado observado na `main` `5cf6d3c` | Consequência |
| --- | --- | --- |
| Frontend | Pacote independente em `client/`, React 18/Vite 5 | Documentar os comandos desse pacote |
| Sala de Aula | `server/index.mjs` + cliente WebRTC | Salas e chamada já existem; texto remoto e legendas continuam futuros |
| Pacote raiz | Express/tRPC, Drizzle e dependências herdadas preservados | Não afirmar que a auditoria antiga removeu esses componentes |
| Fotos de treino | `client/public/datasets/libras-alphabet/` presente | Assets públicos ainda entram no build; não afirmar deploy de 12 MB |
| `datasets-raw/` | Não está na árvore rastreada dessa base | Migração para essa pasta não foi aplicada nesta revisão |
| Arquivo de distribuição | `interprete-libras-completo.tar.gz` presente | Não afirmar sua remoção |
| Scripts Python | Caminhos absolutos do ambiente original | Reprodução requer adaptação; nenhum script foi corrigido aqui |
| Modelo | Artefatos em `client/public/models/gesture-classifier/` | Métricas históricas permanecem identificadas como históricas |

A configuração Vite do cliente copia `client/public/`. Qualquer futura retirada
de fotos dessa pasta precisa preservar origem, licença e usos pelo pipeline,
verificar consumidores e medir o resultado do build.

## Próximas decisões de manutenção

Antes de propor nova limpeza, seguir as entradas de execução e as configurações
de ambos os pacotes. Distinguir componentes alcançados pela interface, código de
servidor legado e arquivos de pesquisa; não remover migrações ou dados somente
por serem antigos. Mudanças funcionais devem ter escopo e validação próprios.

O [guia de implementação](GUIA_IMPLEMENTACAO.md) separa trabalho implementado,
parcial e futuro. [BRANCHES.md](BRANCHES.md) registra as convenções recuperadas;
[DOCUMENTACAO.md](../DOCUMENTACAO.md) descreve os caminhos de execução atuais.

## Limite desta revisão documental

As descrições foram comparadas com manifests, rotas, hooks, classificadores,
servidor e scripts da base atual. Links locais e diferenças de documentação
são conferidos antes da entrega. Métricas de reconhecimento, câmera/microfone,
widget externo, treino Python, autenticação real e publicação não são validados
pela revisão textual. Resultados de verificações adicionais devem acompanhar o
PR correspondente, sem reutilizar resultados históricos como se fossem novos.

## Verificações desta recuperação e bloqueio encontrado

As verificações adicionais desta entrega foram executadas com Node.js 18.19.1 e
npm 9.2.0, disponíveis no ambiente. Os guias recomendam Node.js 22, ainda não
testado nesta revisão.

| Verificação | Resultado desta entrega |
| --- | --- |
| `npm ci` em `client/` e `server/` | Concluído |
| Cinco testes do verificador de convenções | Passaram |
| CLI de convenções com branch/título propostos | Passou |
| `node --check server/index.mjs` | Passou; verifica sintaxe, não comunicação |
| `npm run typecheck` em `client/` | Falhou em dependências, aliases e exports incompatíveis |
| `npm run build` em `client/` | Copiou WASM; falhou depois no TypeScript |
| `npm run dev` em `client/` | Vite iniciou, mas houve dependência ativa `@radix-ui/react-dialog` não resolvida |

O código funcional e os manifests não foram alterados para produzir esses
resultados. O `tsconfig` independente inclui arquivos legados de `src`, enquanto
seu pacote não declara todas as dependências e aliases usados por eles. Há também
falha em componente alcançado pela interface atual, portanto não basta ignorar
fontes legadas para declarar o fluxo operacional.

A manutenção proposta em `maintenance/regularizar-build-client` deve reconciliar
essas fronteiras e validar desenvolvimento, tipos e build no ambiente recomendado.
Essa correção não foi incorporada à tarefa documental. As falhas foram registradas
nos guias, e a instalação/deploy não é apresentada como concluída com sucesso.
