# Modelo de reconhecimento de gestos — treino, métricas e limites

## Estado da documentação

As métricas, contagens e comparação Keras/TF.js abaixo foram registradas em um
trabalho anterior. Não foram reproduzidas nesta recuperação documental e não
constituem uma avaliação atual de webcam, público ou hardware. Os artefatos e
os limites de execução foram conferidos contra a `main` em `5cf6d3c`.

## Artefatos e relato histórico

A extração de landmarks do dataset saiu do navegador e virou uma etapa offline
(`scripts/dataset/`). O resultado são dois artefatos servidos com a aplicação:

| Artefato | Caminho | Tamanho |
|---|---|---|
| Modelo base treinado | `client/public/models/gesture-classifier/` | 237 KB |
| Landmarks já extraídos | `client/public/datasets/libras-landmarks.json` | 1,1 MB (350 KB gzip) |

O relato anterior mencionava mover imagens para `datasets-raw/` e reduzir o
deploy de 49 MB para 12 MB. Isso não descreve a árvore atual: as imagens continuam
em `client/public/datasets/libras-alphabet/`, e `datasets-raw/` não está na árvore
rastreada da base conferida. O Vite copia os arquivos públicos para o build.
Os tamanhos da tabela são referências históricas, não uma nova medição de deploy.
Veja o [registro de recuperação](LIMPEZA.md).

O modelo base carrega automaticamente quando o usuário ainda não treinou o seu,
permitindo reconhecimento sem treino próprio, desde que os assets, o detector e
a câmera carreguem. Isso não garante funcionamento em todo navegador ou condição
de captura.

## Pipeline

```
2.608 imagens
  → MediaPipe HandLandmarker (limiar 0.5)          → 2.150 detecções
  → 2ª passada nas falhas: limiar 0.15, espelho,
    CLAHE, upscale                                 → +259 recuperadas
  → 2.409 amostras (63 floats cada)
  → espelhamento (invariância à mão usada)         → 4.818
  → augmentation: rotação 3D ±9°, escala ±7%,
    ruído σ=0.02                                   → 20.304 amostras de treino
  → MLP 63→256→128→64→15, dropout, class weights
  → export para TF.js LayersModel
```

A normalização é idêntica à do app (`landmarksToFeatures`): pulso na origem,
escala pela distância pulso→base do dedo médio. O modelo exportado foi carregado
de volta com o mesmo `tf.loadLayersModel` que o navegador usa e conferido contra
o Keras: **rótulo idêntico em 12/12 sondas, diferença máxima de probabilidade de
1,7 × 10⁻⁶**.

## A recuperação das mãos fechadas importou muito

O relato histórico registrou perdas na detecção de mãos fechadas com o limiar
inicial. A segunda passada recuperou amostras das classes abaixo:

| Letra | 1ª passada | Após recuperação |
|---|---|---|
| N | 32 / 156 | **111** |
| M | 79 / 197 | **169** |
| O | 88 / 150 | **113** |
| S | 104 / 151 | **114** |

N tinha apenas 32 detecções na primeira passada; a recuperação ampliou sua
representação no conjunto de treino.

## Métricas

**Split agrupado, não aleatório.** Os arquivos são quadros sequenciais de vídeo:
o relato anterior registrou quadros consecutivos ~2× mais parecidos entre si
que pares aleatórios. Um split aleatório colocaria quadros quase idênticos em treino e
teste. Cada classe foi dividida em 10 blocos contíguos; blocos inteiros foram
para validação (1) e teste (2).

**Acurácia em blocos nunca vistos: 97,47%** (n = 948).

| Classe | n | Acerto | Confusões |
|---|---|---|---|
| A | 76 | 100,0% | — |
| B | 76 | 100,0% | — |
| C | 76 | 88,2% | A:4, O:2, L:2 |
| D | 78 | 100,0% | — |
| E | 78 | 100,0% | — |
| I | 80 | 97,5% | E:2 |
| L | 60 | 100,0% | — |
| M | 68 | 100,0% | — |
| N | 44 | 90,9% | O:2, M:2 |
| O | 44 | 95,5% | M:2 |
| R | 60 | 100,0% | — |
| S | 44 | 100,0% | — |
| U | 56 | 100,0% | — |
| V | 52 | 96,2% | U:2 |
| W | 56 | 91,1% | M:2, U:1, N:1 |

A tabela histórica aponta confusões entre classes como C/O e M/N/W. Ela pode
orientar a coleta de novos exemplos, mas não estabelece a causa dos erros nem
substitui uma avaliação com sinalizadores reais.

Para comparação, o relato anterior registrou 97,93% com split aleatório, contra
97,47% no split agrupado. Ambos são resultados históricos do mesmo trabalho.

## Limites — leia antes de confiar no número

**1. São 15 letras estáticas, não Libras.** O sistema faz datilologia
(soletração manual) de A, B, C, D, E, I, L, M, N, O, R, S, U, V, W. Libras é uma
língua com gramática própria, em que o sinal se define por cinco parâmetros:
configuração de mão, ponto de articulação, movimento, orientação da palma e
expressões não-manuais. Este classificador lê **um** desses parâmetros, em um
único quadro parado, de **uma** mão. Ele não reconhece sinais lexicais, não
processa movimento, não lê expressão facial e não interpreta sintaxe. Chamar
isso de "entender Libras" seria falso — e num sistema de acessibilidade, essa
diferença tem consequência real para o aluno surdo que dependeria dele.

**2. A cobertura é a lista de 15 classes do artefato base.** As demais letras,
números e palavras não são classes desse modelo. Isso não permite inferir que
todos os sinais ausentes sejam dinâmicos ou que não existam dados em outras
fontes. Ampliar a cobertura exige dados adequados, rótulos e nova validação; o
classificador dinâmico separado aprende somente com clipes próprios.

**3. 97% é a acurácia *neste dataset*, não uma promessa para a webcam.** O
dataset vem de um único repositório, provavelmente com poucos sinalizadores,
fundo controlado e iluminação estável. Mãos diferentes, pele diferente,
iluminação de sala de aula, ângulo de webcam de notebook e distância variável
são todas condições fora da distribuição de treino. Espere queda significativa
em uso real. A única forma de saber quanto é medir com os usuários reais.

**4. Não há classe negativa treinada.** O classificador base atribui a entrada a
alguma das 15 letras — inclusive uma mão relaxada ou no meio de uma transição. O
limiar de confiança de 75% ajuda, mas não substitui uma classe "nenhum sinal"
treinada com exemplos negativos. Coleta e validação desses exemplos permanecem
pendentes. A interface também usa margem e estabilidade, como descrito abaixo.

## Reprodução: adaptações necessárias

Os quatro scripts em [scripts/dataset](../scripts/dataset/) foram preservados,
mas ainda contêm caminhos absolutos do ambiente original. Não basta executá-los
na pasta do repositório para reproduzir o treino:

| Script | Dependência de caminho ou arquivo |
| --- | --- |
| `extract.py` | `ROOT`, `DATASET`, `MODEL` e saída `raw_features.json` em caminho absoluto |
| `recover.py` | Mesmos caminhos de imagens/modelo e leitura/escrita em `/home/claude/work/` |
| `train.py` | `WORK`; lê `features.json` e grava `model_nobn.keras`, `labels.json`, `confusion.npy` |
| `export_tfjs.py` | `WORK`/`OUT`; lê modelo/rótulos e também `probe_X.npy`, não gerado pelos demais scripts |

Antes de executar, adapte todos esses caminhos para um diretório de trabalho
local, confira imagens em `client/public/datasets/libras-alphabet/`, disponibilize
o modelo HandLandmarker usado na extração e prepare os dados da sonda de exportação.
Não publique intermediários ou dados brutos adicionais por acidente.

A ordem prevista, **após essas adaptações**, é:

```bash
python3 -m pip install mediapipe opencv-python-headless tensorflow-cpu
cd scripts/dataset
python3 extract.py
python3 recover.py
python3 train.py
python3 export_tfjs.py
```

As versões Python não estão fixadas em um ambiente reproduzível neste pipeline;
esses comandos descrevem a sequência, não um treino revalidado. A exportação
produz `model.json`, `weights.bin` e `labels.json` no diretório `OUT`; compare
inferências e métricas antes de substituir os artefatos servidos pelo cliente.

## Atualizações (setembro/2026)

**Rejeição por confiança + margem.** O limite do item 4 tem uma mitigação
heurística parcial, sem uma nova classe treinada:
além do limiar de confiança de 75% que já existia, `predict()` (em
`gestureClassifier.ts` e `dynamicGestureClassifier.ts`) agora também retorna
a **margem** entre a 1ª e a 2ª classe mais prováveis. O Modo Aluno só afirma
um sinal quando confiança E margem passam do limiar (`StudentMode.tsx`).
O objetivo é reduzir falsos positivos em transições e em pares que o modelo
confunde (C/O, M/N/W — ver tabela histórica acima); o ganho não foi medido nesta
revisão. Continua sendo uma heurística sobre um modelo que nunca viu um exemplo de "nenhum sinal" —
não substitui o que o item 4 já recomendava: uma classe negativa treinada
com dados de verdade.

**Sinais dinâmicos (movimento) já existiam.** `dynamicGestureClassifier.ts`,
`useDynamicGestureClassifier.ts` e a aba "Sinal dinâmico" em `TrainMode.tsx`
já implementavam um classificador Conv1D sobre sequências de landmarks das
duas mãos, com treino e reconhecimento ao vivo no Modo Aluno. A limitação
documentada é a ausência de um dataset de palavras integrado ao projeto e
validado para esse pipeline: o modelo dinâmico atual depende do que o usuário
grava. Ver [DATASETS.md](DATASETS.md) para o levantamento de datasets públicos
candidatos e por que nenhum foi integrado ainda (é trabalho de adaptação de
pipeline, não um ajuste rápido).

**Sala de Aula (videochamada).** Recurso em `client/src/pages/Classroom.tsx`
+ `client/src/hooks/useClassroom.ts`: professor cria uma sala
e alunos entram com um código, em uma chamada WebRTC ponto a ponto (topologia
em estrela — o professor conecta com cada aluno, alunos não se conectam
entre si). Exige um servidor de sinalização separado (`server/`), porque o
client é estático e precisa de um processo WebSocket separado — ver
[server/README.md](../server/README.md) para execução, hospedagem e limites
(sem TURN, sem SFU, sem persistência ou autenticação). A existência do recurso
não atesta um deploy atual nem a capacidade de uma turma.
