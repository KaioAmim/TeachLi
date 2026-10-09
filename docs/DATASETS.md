# Datasets de sinais lexicais (palavras) em Libras — pesquisa

Este documento preserva uma pesquisa anterior. Disponibilidade, licenças e
conteúdo dos links externos não foram revalidados nesta recuperação documental.
As fontes são candidatas a investigar, não autorização de uso ou integração pronta.

Contexto: o classificador estático (datilologia, ver [MODELO.md](MODELO.md)) tem um
dataset público já processado. O classificador **dinâmico** (sinais com
movimento — `client/src/lib/dynamicGestureClassifier.ts`) não tem: hoje só
aprende com clipes que o próprio usuário grava em "Treinar Gestos". Esta é
uma pesquisa do que existe publicamente para tentar mudar isso, não uma
integração pronta. Não há integração desses datasets no pipeline atual; a
revisão documental não baixou, processou ou testou essas fontes.

## O que existe

| Dataset | Formato | Licença/acesso | Observação |
|---|---|---|---|
| [MALTA-LIBRAS / ISLR_LIBRAS](https://github.com/Malta-Lab/ISLR_LIBRAS) | Vídeo → tensor (pipeline em PyTorch) | A pesquisa anterior registrou código MIT e referências a vídeos públicos/tensores no Hugging Face; confirmar termos dos dados separadamente | Candidato com toolkit de treino, conforme a pesquisa anterior. Mas o pipeline é PyTorch, não landmarks — precisaria de adaptação (extrair landmarks dos vídeos com MediaPipe, como já se faz em `scripts/dataset/`, em vez de usar os tensores de vídeo prontos). |
| [V-LIBRASIL](https://libras.cin.ufpe.br/) (também espelhado no [Kaggle](https://www.kaggle.com/datasets/davimedio01/v-librasil) e no [IEEE DataPort](https://ieee-dataport.org/documents/v-librasil-new-dataset-signs-brazilian-sign-language-libras)) | Vídeo | Licença e contagem não confirmadas na pesquisa anterior | Precisa visitar a página e ler os termos antes de qualquer uso. |
| [Libras-UFPel Corpus](https://aclanthology.org/2026.propor-1.112/) | Vídeo + texto (paralelo Libras↔Português) | Acadêmico, licença não verificada | Pensado para tradução, não classificação isolada — teria mais trabalho de adaptação. |
| LIBRAS-UFOP (pares mínimos, Kinect) | Vídeo + esqueleto Kinect | Acadêmico, acesso não verificado | Kinect é um formato de esqueleto diferente do MediaPipe Hands (mais juntas, corpo inteiro) — não é um encaixe direto no pipeline atual. |
| VLibrasBD | Texto (tradução PT↔Libras em glosa) | — | Não é vídeo/landmark, é um dataset de tradução textual. Não serve para o classificador de gestos. |

## Viabilidade

A pesquisa anterior priorizou MALTA-LIBRAS/ISLR_LIBRAS por seu toolkit e
`glossary.csv`. A licença do código não comprova licença dos vídeos, consentimento
ou direito de redistribuir modelos/dados. Antes de qualquer treino:

1. Revalidar a fonte, licença de cada conjunto de dados e disponibilidade dos
   vídeos das palavras do glossário, separadamente da licença do código.
2. Rodar a extração de landmarks (MediaPipe HandLandmarker, duas mãos) sobre esses
   vídeos — reaproveitando a lógica de `scripts/dataset/`, adaptada para
   sequências em vez de imagens únicas.
3. Reamostrar cada clipe para `SEQUENCE_LENGTH` quadros (40, definido em
   `client/src/lib/dynamicGestureClassifier.ts`; a reamostragem usa
   `client/src/lib/sequenceUtils.ts`) e treinar com `trainDynamicClassifier` — o mesmo
   Conv1D que já treina com os clipes gravados pelo usuário.
4. Medir com split agrupado por sinalizador/vídeo (não aleatório — mesmo
   cuidado que o `MODELO.md` já documenta para o alfabeto), porque sinais
   dinâmicos têm ainda mais dependência temporal entre quadros vizinhos.

Isso é um projeto à parte — não um ajuste rápido. Esta revisão não baixou nem
processou esses datasets.

## Enquanto isso: gravação própria

O fluxo que já existe (`TrainMode.tsx`, sinal dinâmico) continua sendo o
caminho mais direto para ter *algum* reconhecimento de palavras hoje: grave
alguns clipes por palavra na aba "Sinal dinâmico (movimento)", treine, e o
modelo passa a rodar no Modo Aluno. A limitação é a mesma de sempre com dados
próprios: poucos exemplos, de uma pessoa só, tendem a não generalizar bem
para outros sinalizadores — o mesmo aviso que o `MODELO.md` já faz para o
alfabeto.
