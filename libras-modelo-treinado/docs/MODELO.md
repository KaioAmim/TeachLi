# Modelo de reconhecimento de gestos — treino, métricas e limites

## O que foi feito

A extração de landmarks do dataset saiu do navegador e virou uma etapa offline
(`scripts/dataset/`). O resultado é dois artefatos servidos com a aplicação:

| Artefato | Caminho | Tamanho |
|---|---|---|
| Modelo base treinado | `client/public/models/gesture-classifier/` | 237 KB |
| Landmarks já extraídos | `client/public/datasets/libras-landmarks.json` | 1,1 MB (350 KB gzip) |

As 2.611 imagens JPEG saíram de `client/public/` para `datasets-raw/`, fora do
build. O deploy caiu de **49 MB para 12 MB**.

O modelo base carrega automaticamente quando o usuário ainda não treinou o seu,
então o Modo Aluno funciona no primeiro acesso — antes, sem modelo treinado, a
tela ficava permanentemente em "Aguardando gestos...".

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

O MediaPipe rejeita configurações de mão fechada com o limiar padrão. Antes da
segunda passada, a distribuição era inviável:

| Letra | 1ª passada | Após recuperação |
|---|---|---|
| N | 32 / 156 | **111** |
| M | 79 / 197 | **169** |
| O | 88 / 150 | **113** |
| S | 104 / 151 | **114** |

Com 32 amostras, N seria uma classe que o modelo nunca aprenderia.

## Métricas

**Split agrupado, não aleatório.** Os arquivos são quadros sequenciais de vídeo:
medi que quadros consecutivos são ~2× mais parecidos entre si que pares
aleatórios. Um split aleatório colocaria quadros quase idênticos em treino e
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

As confusões são coerentes com a fonologia da língua: C↔O e M↔N↔W diferem por
detalhes de flexão que 21 landmarks capturam mal, e são pares que humanos também
confundem em datilologia rápida.

Para comparação, o mesmo modelo com split aleatório dá 97,93% — 0,5 ponto de
inflação. Menor do que eu esperava, mas o número honesto é o de 97,47%.

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

**2. As letras que faltam não têm dados.** H, J, K, X, Y e Z envolvem movimento
e não existem no dataset. Números e palavras também não. Não há como treiná-los
sem coletar dados novos — nenhum ajuste de modelo resolve ausência de dados.

**3. 97% é a acurácia *neste dataset*, não uma promessa para a webcam.** O
dataset vem de um único repositório, provavelmente com poucos sinalizadores,
fundo controlado e iluminação estável. Mãos diferentes, pele diferente,
iluminação de sala de aula, ângulo de webcam de notebook e distância variável
são todas condições fora da distribuição de treino. Espere queda significativa
em uso real. A única forma de saber quanto é medir com os usuários reais.

**4. Não há rejeição de classe.** Qualquer mão detectada é classificada como
alguma das 15 letras — inclusive uma mão relaxada ou no meio de uma transição. O
limiar de confiança de 75% ajuda, mas não substitui uma classe "nenhum sinal"
treinada com exemplos negativos. É a melhoria mais valiosa a fazer em seguida, e
depende de coletar dados, não de treinar mais.

## Reproduzir

```bash
pip install mediapipe opencv-python-headless tensorflow-cpu
cd scripts/dataset
python extract.py      # 1ª passada sobre datasets-raw/
python recover.py      # 2ª passada nas falhas
python train.py        # treino + relatório por classe
python export_tfjs.py  # gera model.json + weights.bin
```

Os scripts esperam as imagens em `client/public/datasets/libras-alphabet/`;
ajuste a constante `DATASET` se você mantiver a pasta em `datasets-raw/`.
