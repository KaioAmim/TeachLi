# TeachLi

Projeto de extensão universitária para apoiar a comunicação entre alunos surdos
 e professores. O objetivo é conectar participantes de uma mesma sala, oferecer
legendas da fala do professor e reproduzir em áudio as mensagens dos alunos.

## O que existe hoje

- Interface React com modos Professor, Aluno, Treinar Gestos e Histórico.
- Transcrição da fala no navegador e widget VLibras no modo Professor.
- Captura de mãos com MediaPipe e classificação local com TensorFlow.js.
- Modelo base de **15 letras estáticas**, com preferência pelo modelo pessoal
  quando houver treinamento salvo no navegador.
- Treinamento local por webcam ou importação dos landmarks já extraídos.
- Síntese de voz no dispositivo que está usando a aplicação.
- API Express/tRPC, autenticação OAuth Manus e schema MySQL com Drizzle.

**Ainda não existe o fluxo completo de salas compartilhadas.** O projeto não
verifica vínculo institucional de professor e não transmite automaticamente as
mensagens entre dispositivos. O classificador de letras não traduz frases em
Libras. O histórico visual e a API precisam ser integrados ao fluxo de salas.

## Executar

Requisitos: Node.js 22 ou superior, pnpm **10.4.1** e navegador com câmera e
microfone para experimentar os recursos de captura.

```bash
pnpm install --frozen-lockfile
```

Copie `.env.example` para `.env` e preencha os valores necessários. O OAuth atual
precisa de credenciais Manus; a autenticação institucional é uma etapa futura.
Os modos podem depender do login conforme o fluxo da interface.

Para usar persistência, configure uma instância MySQL e aplique as migrações:

```bash
pnpm db:push
pnpm dev
```

O endereço padrão é `http://localhost:3000`; o servidor tenta outra porta se ela
estiver ocupada. Para verificar e gerar o build:

```bash
pnpm check
pnpm build
pnpm start
```

pnpm test verifica a convenção de branches e commits com testes do Node.js. Ainda não há suíte funcional do aplicativo. Compilar não valida câmera, microfone, tradução, precisão do modelo ou autenticação com o provedor real.

## Estrutura

- `client/src/`: páginas, componentes e reconhecimento no navegador.
- `client/public/models/`: modelo MediaPipe e classificador treinado.
- `client/public/datasets/libras-landmarks.json`: features para treinamento local.
- `server/` e `shared/`: API, autenticação e código compartilhado.
- `drizzle/`: schema e histórico de migrações; preservar os arquivos de migração.
- `datasets-raw/libras-alphabet/`: imagens, licença e atribuição do dataset,
  preservadas para pesquisa e fora do build público.
- `scripts/dataset/`: extração, recuperação, treinamento e exportação do modelo.
- `docs/MODELO.md`: procedimento de treino e métricas relatadas no trabalho anterior.
- `docs/LIMPEZA.md`: diagnóstico da integração e proposta de próximas etapas.

Os scripts Python usam `training-output/` para intermediários, ignorados pelo Git.
Veja [o procedimento e os limites do modelo](docs/MODELO.md).

## Publicação

O build completo gera `dist/index.js` e `dist/public/` e precisa de um ambiente
Node.js para a API. `vercel.json` é uma configuração herdada que ainda precisa
ser validada/adaptada para esse servidor; não é uma garantia de deploy funcional.
As fotos brutas e os scripts de treinamento não são necessários no servidor.

## Próximas etapas

1. Salas e sincronização entre os dispositivos do professor e dos alunos.
2. Texto do aluno com confirmação e fila de áudio no dispositivo da sala.
3. Legendas do professor compartilhadas com controles de microfone.
4. Login institucional e autorização de professor verificados no backend.
5. Avaliação com alunos surdos e profissionais de Libras da faculdade.
6. Melhorias experimentais do modelo com dados de novos usuários e rejeição de
   gestos desconhecidos.

A licença e a atribuição do dataset estão em `datasets-raw/libras-alphabet/`.

## Documentação e contribuição

- [Documentação técnica, branches e commits](DOCUMENTACAO.md).
- [Guia passo a passo de implementação](docs/GUIA_IMPLEMENTACAO.md).
- [Auditoria da limpeza](docs/LIMPEZA.md).

As labels existentes no GitHub são bug, documentation, enhancement, feature,
maintenance e UI/UX. Use respectivamente branches bug/, documentation/,
enhancement/, feature/, maintenance/ e ui-ux/. Labels classificam PRs; não são
tags Git de versão. A correspondência com tipos de commit está na documentação.

Antes de enviar uma branch, rode também:

```bash
pnpm test
pnpm check:conventions --labels maintenance,documentation,bug --base origin/main
```

Troque as labels pelas do seu PR. Antes do primeiro commit, use --title com o
título pretendido no lugar de --base. As branches antigas são preservadas;
a convenção documentada vale para alterações novas.
