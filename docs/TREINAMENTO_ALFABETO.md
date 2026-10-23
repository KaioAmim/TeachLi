# Ampliação do reconhecimento do alfabeto

Atualizado em 22/10/2026. **Modelo experimental A–Z treinado com as duas bases
e configurado como modelo padrão do aplicativo. Ç ainda não está incluído.**

## Escopo solicitado

Adicionar F, G, H, J, K, P, Q, T, X, Y, Z e Ç, mantendo as letras já
reconhecidas. O Ç deve ter sua própria classe, distinta do C.

## Estado atual verificado

- O modelo original preservado em `client/public/models/gesture-classifier/labels.json`
  contém A, B, C, D, E, I, L, M, N, O, R, S, U, V e W.
- O novo modelo fica em `client/public/models/gesture-classifier-26/` e inclui
  as 26 letras de A a Z. H/J/K/X/Z são classes experimentais reconhecidas por
  pose; não há validação do movimento completo.
- As imagens e os landmarks da importação manual continuam cobrindo 15 letras;
  o botão na tela de treino informa essa cobertura. O ZIP LibraSign foi usado
  offline; não é necessário baixá-lo para usar o novo modelo.
- A tela de treinamento aceita rótulos personalizados, inclusive Ç, mas isso
  não significa que o modelo distribuído já reconheça Ç. Modelos pessoais
  mantêm prioridade: nenhum modelo ou dado pessoal foi apagado nesta atualização.
- Há treinamento de sequências no navegador, mas não há modelo dinâmico base
  distribuído com o aplicativo.
- A preparação dinâmica atual centraliza cada mão no pulso **em cada quadro**.
  Assim, um deslocamento da mão inteira pode desaparecer dos dados. Antes de
  treinar movimentos, é necessário preservar a trajetória em treino e inferência.
- O treino dinâmico atual cria variações das amostras antes da divisão de
  validação. A nova avaliação deverá separar gravações originais antes de gerar
  variações, evitando medir o desempenho com versões da mesma gravação.

## Fontes candidatas consultadas

| Fonte | Cobertura e limite verificados |
| --- | --- |
| [Base atual de Bianka Passos](https://github.com/biankatpas/Brazilian-Sign-Language-Alphabet-Dataset) | 15 letras estáticas; não contém as adições solicitadas. |
| [Libras, Willians Oliveira](https://www.kaggle.com/datasets/williansoliveira/libras) | Candidata para ampliar letras estáticas. A API pública retornou licença `Unknown`; esclarecer os termos antes de incorporar dados ou distribuir artefatos derivados. |
| [Libras Landmark Dataset, Heitorccf](https://www.kaggle.com/datasets/heitorccf/librasign) | Download público confirmado e ZIP inspecionado: 26 arquivos CSV de A–Z, 1.000 amostras por letra, 63 coordenadas por amostra. Não contém Ç nem metadados que delimitam clipes, tempo, participantes ou sessões. Licença informada pela API: GPL 3. |
| [Alfabeto em Libras, Roboflow](https://universe.roboflow.com/alfabeto-libras/alfabeto-em-libras-qrvnw-5tcwx) | Página declara CC BY 4.0 e 1.666 imagens, em 21 classes: A, B, C, D, E, F, G, I, K, L, M, N, O, P, Q, R, S, T, U, V e W. Inclui F/G/P/Q/T; não inclui H/J/X/Y/Z/Ç. K aparece como imagem, o que não comprova reconhecimento do movimento. A versão 1 informa todas as imagens em treino e nenhuma em validação/teste. Download anunciado; arquivo não baixado nesta consulta. |
| [Projeto de reconhecimento da UFRGS](https://github.com/drdgfv/libras-gesture-recognition) | Documenta gravações próprias para H, J, K, X e Z; não documenta Ç. Conferida a árvore de arquivos do commit `7e52c62c564657b5da8c75031f165ef284712131`: as pastas de dados e modelos contêm somente `.gitkeep`. As sequências descritas não estão disponibilizadas nessa revisão. |

LibraSign e os landmarks legados foram usados nos experimentos abaixo. As
demais fontes permanecem candidatas não incorporadas. Não foi
encontrada, neste levantamento, uma base verificada que cubra todas as adições
com exemplos temporais do Ç e condições claras de reutilização.

O movimento do Ç precisa ser preservado: a configuração da mão é a do C,
acrescida de movimento. Referência: [publicação da Unesp, Núcleos de
Ensino](https://repositorio.unesp.br/bitstream/handle/11449/140104/ISBN9788579833236.pdf?isAllowed=y&sequence=1).

### Inspeção da base LibraSign

- Versão 1, baixada pelo endpoint público do Kaggle, sem credenciais, para
  `/tmp/teachli-public-datasets/librasign.zip`; não incorporada ao aplicativo.
- SHA-256 do ZIP: `f1ca1f53d47bbba99b64c6f5815f740a200b354a6ddf7f939f6b78655313b8dd`.
- 26.000 amostras numéricas, todas com 63 valores finitos e sem linhas
  exatamente duplicadas dentro de cada classe. Isso verifica o formato, não a
  correção linguística nem a diversidade das pessoas que fizeram os gestos.
- O ZIP contém apenas `landmarks/A.csv` até `landmarks/Z.csv`.
  Não é possível reconstruir com segurança os limites de cada gesto dinâmico
  ou uma divisão por participante a partir desses arquivos.
- A normalização foi avaliada e a base foi usada no ajuste do modelo A–Z.
  Os rótulos H/J/K/X/Z no arquivo não substituem exemplos temporais desses
  sinais: a versão atual classifica suas poses como recurso experimental.
- Para Ç, a pesquisa encontrou um [trabalho da UFSJ](https://repositorio.ufsj.edu.br/bitstreams/df9d1b47-7893-4665-b742-f5f4305ab36a/download)
  que descreve exemplos de 27 letras, mas não foi confirmado um download
  público dos dados com licença explícita. Não tratar o artigo como dataset
  disponível.

## Dados necessários para concluir

1. Obter imagens ou gravações de Libras com rótulos conferidos por pessoa fluente;
   para movimentos, guardar a sequência completa, incluindo exemplos de Ç e C.
2. Registrar a origem, autorização de uso e identificadores anônimos de
   participante, sessão e gravação, para separar treino, validação e teste.
3. Incluir variação real de participantes, iluminação, posição e velocidade,
   além de pausas e transições que não devem produzir uma letra.
4. Preservar a trajetória temporal sem alterar a representação usada pelo modelo
   estático existente. Versionar os dados e modelos dinâmicos se o formato mudar;
   não reinterpretar amostras antigas silenciosamente.
5. Treinar e avaliar por letra, em gravações separadas. Quando houver participantes
   suficientes, reservar participantes inteiros para teste e informar essa divisão.
6. Testar especialmente C/Ç e as confusões com as letras existentes, antes de
   substituir o modelo distribuído. Informar métricas e limitações reais, sem
   apresentar acurácia do próprio treino como desempenho com pessoas novas.

## Experimento realizado: 15 letras atuais + F, G, P, Q, T e Y

Foi utilizada a base LibraSign baixada do Kaggle, combinada com os landmarks
legados. Os CSVs brutos foram centralizados no pulso e divididos pela distância
pulso–base do dedo médio, como no aplicativo. Não foram incluídas classes
dinâmicas como se fotos comprovassem a captura de seus movimentos.

Treino: MLP `63→256→128→64→21` com Adam, semente 42, equilíbrio por classe e
origem, espelhamento e pequenas perturbações geométricas. Foram executadas 71
épocas; o melhor ponto na validação foi a época 51. A escolha do ponto usou
somente a validação; o teste foi calculado no final.

A divisão por blocos de linhas reservou 10% para validação e 20% para teste,
com exclusão de cinco linhas vizinhas às fronteiras de treino. Divisão feita
antes do espelhamento e augmentation. Não há identificadores de participantes:
essa divisão **não mede generalização para pessoas novas**. O modelo antigo
pode já ter visto os dados legados; a comparação abaixo é uma verificação de
regressão, não uma competição em dados independentes para ambos os modelos.

| Verificação | Modelo atual | Candidato |
| --- | ---: | ---: |
| Acerto nas 15 letras antigas | 97,30% | 93,26% |
| Precisão das previsões aceitas pelo filtro, nas letras antigas | 99,04% | 95,28% |
| Acerto na letra O | 95,45% | 45,45% |
| Acerto nas seis letras novas, na base LibraSign | Sem essas classes | 100,00% |

O teste legado contém 482 exemplos originais mais seus espelhos (964 entradas).
O teste das seis adições contém 1.200 exemplos originais mais seus espelhos
(2.400 entradas). Espelhos não são participantes nem gravações independentes.
O resultado de 100% está restrito a esse recorte, com possível semelhança entre
quadros da mesma coleta; não é uma promessa de acerto em webcam.

Os critérios definidos no experimento exigiam queda global de no máximo 3
pontos percentuais nas letras antigas e de no máximo 10 pontos por letra,
entre outros controles. O candidato falhou nesses critérios. A regressão
descreve **esta combinação de dados e treinamento**, não prova que a base
LibraSign seja inutilizável. Não substituir o modelo atual por este candidato.

O modelo foi exportado e carregado pelo TensorFlow.js instalado no projeto.
Em 94 exemplos, a diferença máxima entre as probabilidades Python e TF.js foi
`2,38e-7`. A implementação usada para avaliar o modelo antigo também foi
conferida contra TF.js em 94 exemplos (diferença máxima `1,02e-6`). Isso verifica
a exportação e o cálculo; não substitui testes com câmera.

### Reprodução e arquivos

- Script: `scripts/dataset/experiment_alphabet.py`.
- Verificação de exportação: `scripts/dataset/verify_tfjs.mjs`.
- Relatório com métricas por letra, confusões, critérios e hashes de origem:
  [alphabet-21-report.json](experiments/alphabet-21-report.json).
- Candidato, divisão de exemplos e referências numéricas desta execução:
  `/tmp/teachli-alphabet-experiment/` (temporário, fora dos arquivos servidos pelo app).

```sh
python3 -m venv /tmp/teachli-alphabet-venv
/tmp/teachli-alphabet-venv/bin/pip install numpy==2.2.6 scikit-learn==1.7.2
OPENBLAS_NUM_THREADS=2 OMP_NUM_THREADS=2 /tmp/teachli-alphabet-venv/bin/python scripts/dataset/experiment_alphabet.py --zip /tmp/teachli-public-datasets/librasign.zip --output /tmp/teachli-alphabet-experiment
node scripts/dataset/verify_tfjs.mjs /tmp/teachli-alphabet-experiment
```

O primeiro candidato não foi instalado. O ajuste que o substituiu está
documentado a seguir. Como este teste já foi inspecionado, futuras iterações
precisam de uma nova avaliação independente para alegar desempenho fora dos
dados usados no desenvolvimento.

## Versão atual: transferência do modelo original e cobertura A–Z

Após o primeiro teste, foram preservadas as camadas aprendidas e as saídas das
15 letras antigas. O modelo ganhou novas saídas para as demais letras. O ajuste
usou taxa de aprendizado `0,00015`, peso relativo 2 para a base legada, peso 2
para O/M/C e pequenas rotações 3D no aumento de dados. O ponto escolhido pela
validação foi a época 15, de 35 épocas executadas. Nenhum exemplo reservado
foi adicionado diretamente ao treino; contudo, os pesos originais já carregam
a exposição anterior a dados legados. **Não é um teste independente.**

Antes da versão A–Z, um ajuste de 21 classes recuperou o acerto legado para
97,51%. Seu relatório foi preservado em
[alphabet-21-transfer-report.json](experiments/alphabet-21-transfer-report.json).
Ele foi sucedido pelo modelo A–Z após o pedido de incluir as demais classes
existentes na base. A inclusão de H/J/K/X/Z é explicitamente experimental,
com classificação por pose, sem aprendizado de trajetórias.

| Comparação interna | Original (15 classes) | Primeiro candidato (21) | Atual (26) |
| --- | ---: | ---: | ---: |
| Acerto nas letras antigas | 97,30% | 93,26% | 97,61% |
| O | 95,45% | 45,45% | 95,45% |
| M | 85,29% | 75,00% | 85,29% |
| C | 88,46% | 82,05% | 91,03% |
| Precisão das previsões aceitas, letras antigas | 99,04% | 95,28% | 97,80% |

A recuperação de acerto não eliminou todas as limitações: a precisão entre
previsões aceitas ainda está abaixo da original. M segue se confundindo com N;
C se confunde com A/P. As 11 novas classes obtiveram 100% no recorte da
LibraSign (2.200 exemplos originais e seus espelhos), o que não demonstra
generalização para novas pessoas nem valida movimentos. Não foram capturadas
imagens de câmera nesta tarefa.

Os seis controles internos definidos no script passaram. O aplicativo carrega
o novo artefato em `/models/gesture-classifier-26/`; o modelo original foi
preservado para comparação e eventual reversão. Os avisos de licenças, fontes
e código de reprodução acompanham o novo artefato em `NOTICE.md` e `source/`.
O relatório completo está em
[alphabet-26-transfer-report.json](experiments/alphabet-26-transfer-report.json).

Verificação da integração: o carregador real do aplicativo foi executado em
Chrome, em contexto de teste sem modelo pessoal. As 114 previsões de referência
coincidiram com o resultado exportado (diferença máxima de probabilidade
`2,38e-7`). A normalização offline foi comparada à função TypeScript real em
78 exemplos brutos, com erro máximo `2,38e-7`. O build de produção do Vite
passou, mantendo o aviso já existente de pacote JavaScript grande.

```sh
OPENBLAS_NUM_THREADS=2 OMP_NUM_THREADS=2 /tmp/teachli-alphabet-venv/bin/python scripts/dataset/experiment_alphabet.py --zip /tmp/teachli-public-datasets/librasign.zip --output /tmp/teachli-alphabet-26 --base-model client/public/models/gesture-classifier --initialize-from-base --learning-rate .00015 --legacy-weight 2 --focus-weight 2 --rotation-3d --additions FGHJKPQTXYZ
node scripts/dataset/verify_tfjs.mjs /tmp/teachli-alphabet-26
```

Prioridades futuras: teste com pessoas e gravações independentes, exemplos
negativos/transições, melhoria de M/N/C e classificação temporal dos sinais
com movimento, incluindo a coleta de Ç. Não considerar A–Z por pose como
interpretação completa do alfabeto manual em movimento ou de Libras.
