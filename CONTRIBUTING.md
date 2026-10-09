# Contribuir com o TeachLi

Comece pelo [README](README.md), pelo [guia de branches](docs/BRANCHES.md) e pela
[arquitetura](DOCUMENTACAO.md). A `main` é a referência atual; não mescle uma
branch antiga inteira para recuperar apenas documentos ou convenções.

## Preparar a mudança

1. Descreva o problema e o resultado esperado numa issue ou no pedido de trabalho.
2. Escolha a label principal e crie uma branch a partir de `main` atualizada.
3. Instale os pacotes de `client/` e, quando necessário, `server/` com `npm ci`.
4. Mantenha o escopo pequeno. Separe reorganizações grandes e experimentos de
   modelo quando não precisarem ser entregues junto com a mudança funcional.

Antes de trocar de branch, confira `git status`. Preserve alterações em andamento;
use uma cópia isolada ou conclua esse trabalho antes, sem apagar mudanças alheias.

## Verificações por alteração

Na raiz, para toda mudança destinada a PR:

```bash
git diff --check
node --test scripts/check-conventions.test.mjs
node scripts/check-conventions.mjs --labels documentation --base origin/main --title "docs: atualizar guia de uso"
```

Troque labels e título pelos da sua alteração. Antes do primeiro commit, omita
`--base` e use `--title`. O verificador é executado diretamente com Node; ele
não substitui o `pnpm test` da configuração herdada da raiz.

| Mudança | Verificações adicionais |
| --- | --- |
| Só documentação | Caminhos, links, exemplos e comandos alterados; comparar com código atual |
| Interface ou reconhecimento | Em `client/`: `npm run typecheck` e `npm run build`; exercitar o fluxo no navegador |
| Sinalização | `node --check server/index.mjs`; testar entrada, saída e encerramento com professor e aluno |
| Convenções | Testes do verificador e casos de CLI aceitos/rejeitados pertinentes |
| Modelo/dataset | Formato, classes e inferência; avaliação separada do treino para alegações de precisão |
| Legado da raiz | Verificações próprias do pacote; o build independente do client não cobre a API |

### Roteiro manual para mudanças funcionais

- **Texto e voz:** digitar, falar por botão e Enter, quebrar linha com Shift+Enter e limpar.
- **Câmera:** conceder/negar permissão, iniciar/parar, verificar carga do modelo e saída da tela.
- **Treino:** capturar classes, treinar, recarregar, conferir persistência e limpar;
  exercitar estático e dinâmico separadamente.
- **Sala:** criar como professor e entrar como aluno em outro navegador/dispositivo;
  verificar áudio/vídeo, saída e perda de rede. Use fones para evitar eco e não
  presuma reconexão automática.
- **Acessibilidade:** teclado, foco visível, zoom, contraste e compreensão com participantes.

Relate cenários executados, ambiente e verificações pendentes no PR. Build aprovado
não significa precisão comprovada ou validação com usuários.

## Documentação faz parte da entrega

O agente principal aciona o subagente `documentacao` conforme [AGENTS.md](AGENTS.md).
Colaboradores humanos seguem os mesmos critérios:

- Mudou uso/comando? Atualize README e guia de uso.
- Mudou arquitetura, API, configuração ou armazenamento? Atualize a documentação técnica.
- Mudou modelo/dados? Atualize MODELO/DATASETS com origem, limites e resultados.
- Entregou uma etapa? Atualize o guia de implementação, distinguindo implementação
  de validação real.
- Encontrou desacordo entre requisito e código? Explique; não altere o requisito
  apenas para encobrir um defeito.

Se não houver impacto documental, registre isso no PR com justificativa breve.

## Abrir e integrar o PR

Use o [modelo de PR](.github/pull_request_template.md), aplique as labels da branch
e dos commits e revise a comparação contra `main`. Inclua apenas o escopo; não
adicione `.env`, credenciais, dependências instaladas, builds, backups ou intermediários.

Não mova fotos, migrações, modelos ou arquivos legados só porque parecem antigos:
verifique referências, licença, caminhos de carga e uso no build antes de remover.
Mantenha os lockfiles associados ao pacote alterado.

Após revisão e validações pertinentes, integre em `main`. Resolva ou declare
impedimentos antes do merge. Estes guias não instalam CI nem proteção de branch;
um comando local não é uma garantia automática do GitHub.
