# Datasets de sinais lexicais (palavras) em Libras — pesquisa

Contexto: o classificador estático (datilologia, ver `MODELO.md`) tem um
dataset público já processado. O classificador **dinâmico** (sinais com
movimento — `client/src/lib/dynamicGestureClassifier.ts`) não tem: hoje só
aprende com clipes que o próprio usuário grava em "Treinar Gestos". Esta é
uma pesquisa do que existe publicamente para tentar mudar isso, não uma
integração pronta — nenhum destes datasets foi baixado, processado ou
testado ainda.

## O que existe

| Dataset | Formato | Licença/acesso | Observação |
|---|---|---|---|
| [MALTA-LIBRAS / ISLR_LIBRAS](https://github.com/Malta-Lab/ISLR_LIBRAS) | Vídeo → tensor (pipeline em PyTorch) | Código MIT; vídeos via scraping de fontes públicas (INES, UFSC SignBank, Spread the Sign); tensores prontos no Hugging Face | O mais promissor: já é um toolkit de treino, não só dados soltos. Mas o pipeline é PyTorch, não landmarks — precisaria de adaptação (extrair landmarks dos vídeos com MediaPipe, como já se faz em `scripts/dataset/`, em vez de usar os tensores de vídeo prontos). |
| [V-LIBRASIL](https://libras.cin.ufpe.br/) (também espelhado no [Kaggle](https://www.kaggle.com/datasets/davimedio01/v-librasil) e no [IEEE DataPort](https://ieee-dataport.org/documents/v-librasil-new-dataset-signs-brazilian-sign-language-libras)) | Vídeo | Não confirmado em detalhe (a página do Kaggle não expôs licença/contagem no que consegui ler) | Precisa visitar a página e ler os termos antes de qualquer uso. |
| [Libras-UFPel Corpus](https://aclanthology.org/2026.propor-1.112/) | Vídeo + texto (paralelo Libras↔Português) | Acadêmico, licença não verificada | Pensado para tradução, não classificação isolada — teria mais trabalho de adaptação. |
| LIBRAS-UFOP (pares mínimos, Kinect) | Vídeo + esqueleto Kinect | Acadêmico, acesso não verificado | Kinect é um formato de esqueleto diferente do MediaPipe Hands (mais juntas, corpo inteiro) — não é um encaixe direto no pipeline atual. |
| VLibrasBD | Texto (tradução PT↔Libras em glosa) | — | Não é vídeo/landmark, é um dataset de tradução textual. Não serve para o classificador de gestos. |

## Viabilidade

O MALTA-LIBRAS/ISLR_LIBRAS é o candidato mais realista: tem licença clara
(MIT), já é um projeto de benchmarking ativo, e o `glossary.csv` do repo dá
uma lista de quais palavras estão cobertas. O trabalho que falta, antes de
qualquer treino:

1. Confirmar quais palavras do glossário têm vídeo (não tensor pronto)
   disponível e acessível a partir daqui.
2. Rodar a extração de landmarks (MediaPipe Hands, dois braços) sobre esses
   vídeos — reaproveitando a lógica de `scripts/dataset/`, adaptada para
   sequências em vez de imagens únicas.
3. Reamostrar cada clipe para `SEQUENCE_LENGTH` quadros (já existe em
   `sequenceUtils.ts`) e treinar com `trainDynamicClassifier` — o mesmo
   Conv1D que já treina com os clipes gravados pelo usuário.
4. Medir com split agrupado por sinalizador/vídeo (não aleatório — mesmo
   cuidado que o `MODELO.md` já documenta para o alfabeto), porque sinais
   dinâmicos têm ainda mais dependência temporal entre quadros vizinhos.

Isso é um projeto à parte — não um ajuste rápido. Não tentei baixar ou
processar nenhum destes datasets nesta sessão.

## Enquanto isso: gravação própria

O fluxo que já existe (`TrainMode.tsx`, sinal dinâmico) continua sendo o
caminho mais direto para ter *algum* reconhecimento de palavras hoje: grave
alguns clipes por palavra na aba "Sinal dinâmico (movimento)", treine, e o
modelo passa a rodar no Modo Aluno. A limitação é a mesma de sempre com dados
próprios: poucos exemplos, de uma pessoa só, tendem a não generalizar bem
para outros sinalizadores — o mesmo aviso que o `MODELO.md` já faz para o
alfabeto.
