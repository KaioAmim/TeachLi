# Branches, labels e commits

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

[!CAUTION]
⚠️ NÃO TRABALHE DIRETAMENTE NA main!

Crie uma branch de trabalho, abra um Pull Request para main e faça o merge somente após revisar as alterações e verificar os testes.

Com sua árvore de trabalho limpa, na raiz do repositório:

```bash
git switch main
git pull --ff-only origin main
git switch -c documentation/guia-instalacao
```

Adicione apenas os arquivos pretendidos, crie o commit e confira a faixa:

```bash
git add README.md docs/arquivo.md
git commit -m "docs: atualizar instruções de instalação"
git fetch origin
git push -u origin documentation/guia-instalacao
```

No GitHub, abra PR para `main`, aplique as mesmas labels, preencha o modelo de PR
e revise alterações e verificações. Resolva conflitos e repita as verificações
afetadas antes de integrar. Após o merge, atualize sua `main`; remova a branch de
trabalho apenas se ela não for mais necessária. Nunca use force push na `main`.


