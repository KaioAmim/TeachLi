# Branches, labels e commits

Convenção recuperada da branch `maintenance/limpeza-estrutura-documentacao`
(commit `b937716`) e adotada para novas contribuições. A `main` contém a versão
atual do projeto; branches antigas permanecem como histórico.

## Escolher o tipo de trabalho

| Label principal | Branch | Tipos de commit | Exemplo |
| --- | --- | --- | --- |
| `feature` | `feature/descricao` | `feat` | `feature/legendas-compartilhadas` |
| `bug` | `bug/descricao` | `fix` | `bug/repeticao-audio` |
| `documentation` | `documentation/descricao` | `docs` | `documentation/guia-instalacao` |
| `enhancement` | `enhancement/descricao` | `feat`, `perf`, `refactor` | `enhancement/estabilidade-gestos` |
| `maintenance` | `maintenance/descricao` | `chore`, `refactor`, `build`, `ci`, `test` | `maintenance/atualizar-dependencias` |
| `UI/UX` | `ui-ux/descricao` | `style`, `feat`, `fix` | `ui-ux/contraste-botoes` |

Use `feature` para funcionalidade nova, `bug` para comportamento incorreto,
`documentation` para guias, `enhancement` para melhorias existentes,
`maintenance` para infraestrutura/manutenção e `UI/UX` para interface e interação.
Preserve a grafia `UI/UX` na label; a branch usa `ui-ux/`.

A descrição deve ser curta, em minúsculas, sem acentos ou espaços, com palavras
separadas por hífen. Evite nomes como `ProjetoAlteradov1.3`, `nova-versao` ou
`teste`: eles não explicam o trabalho. Não é necessário criar `develop` ou uma
branch por versão; cada mudança parte da `main` atual e volta por pull request.

## Commits e título do PR

Formato: `tipo(escopo-opcional): descrição`. Exemplos:

```text
feat(sala): compartilhar legendas do professor
fix(audio): evitar reprodução duplicada
docs: atualizar instruções de instalação
perf(modelo): reduzir alocações durante inferência
chore: atualizar dependências de desenvolvimento
style(aluno): melhorar contraste dos controles
```

O título do PR usa o mesmo formato. A label principal corresponde ao prefixo da
branch. Labels secundárias permitem os tipos adicionais da tabela: uma branch
`maintenance/atualizar-guias` com `maintenance,documentation` aceita `chore` e
`docs`, por exemplo. O verificador aceita somente essas seis labels; informe
apenas as labels de classificação desta tabela, não rótulos auxiliares de status.

Labels classificam issues e PRs. Tags Git identificam versões em commits e não
substituem labels ou prefixos de branch. Uma política de releases será definida
separadamente; não crie tags só para classificar uma alteração.

## Fluxo completo

Com sua árvore de trabalho limpa, na raiz do repositório:

```bash
git switch main
git pull --ff-only origin main
git switch -c documentation/guia-instalacao
```

Faça a alteração, revise o diff e execute as verificações adequadas descritas
em [CONTRIBUTING.md](../CONTRIBUTING.md). Antes do primeiro commit:

```bash
node scripts/check-conventions.mjs --labels documentation --title "docs: atualizar instruções de instalação"
git diff --check
git diff
```

Adicione apenas os arquivos pretendidos, crie o commit e confira a faixa:

```bash
git add README.md docs/USO.md
git commit -m "docs: atualizar instruções de instalação"
git fetch origin
node scripts/check-conventions.mjs --labels documentation --base origin/main --title "docs: atualizar instruções de instalação"
git push -u origin documentation/guia-instalacao
```

No GitHub, abra PR para `main`, aplique as mesmas labels, preencha o modelo de PR
e revise alterações e verificações. Resolva conflitos e repita as verificações
afetadas antes de integrar. Após o merge, atualize sua `main`; remova a branch de
trabalho apenas se ela não for mais necessária. Nunca use force push na `main`.

## Como funciona a verificação

Execute na raiz; não é necessário instalar pacotes para esses dois comandos:

```bash
node --test scripts/check-conventions.test.mjs
node scripts/check-conventions.mjs --branch feature/legendas-compartilhadas --labels feature --title "feat(sala): compartilhar legendas"
```

- Sem `--branch`, usa a branch atual.
- `--title` valida um título proposto; `--base origin/main` valida os commits
  novos, excluindo commits de merge. Podem ser usados juntos.
- Sem título e sem commits novos, a verificação falha. Em `main`, use uma branch
  proposta com `--branch` e `--title` para experimentar o padrão.
- `--labels` recebe valores separados por vírgula. O script não busca nem aplica
  labels no GitHub: confira se o PR tem as labels informadas.
- A checagem valida formato e correspondência. Cabe à revisão avaliar se o tipo
  escolhido representa o conteúdo e se a implementação atende ao pedido.
- O script é local: esta recuperação não instala CI nem configura proteção de
  branch. A obrigatoriedade de revisão é uma regra de colaboração.

Nomes e commits antigos não precisam ser reescritos. Agentes também devem usar
esta convenção específica do projeto para branches novas.
