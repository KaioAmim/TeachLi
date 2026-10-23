# TeachLi — modelo experimental A–Z

Modelo por pose de uma mão (63 coordenadas normalizadas), com 26 saídas A–Z.
H/J/K/X/Z estão incluídos como poses experimentais: o modelo não verifica a
trajetória temporal do gesto. Ç não está incluído.

## Origem

- LibraSign, Heitor Câmara Costa Fernandes:
  <https://www.kaggle.com/datasets/heitorccf/librasign>, versão 1.
  Licença declarada no Kaggle: GPL 3. ZIP SHA-256:
  `f1ca1f53d47bbba99b64c6f5815f740a200b354a6ddf7f939f6b78655313b8dd`.
- Brazilian Sign Language Alphabet, Bianka Passos, Anita M. R. Fernandes e
  Eros Comunello: <https://github.com/biankatpas/Brazilian-Sign-Language-Alphabet-Dataset>.
  MIT; copyright (c) 2020 Bianka Passos. Landmarks e pesos legados do TeachLi.
- Ajuste com transferência das camadas e das saídas antigas, equilíbrio de
  origens/classes e aumento de dados aplicado somente ao conjunto de treino.

Este artefato experimental e o código de reprodução em `source/` são
disponibilizados sob GPL-3.0-only; veja `LICENSE-GPL-3.0.txt`. Os avisos da
base legada são preservados em `LICENSE-legacy-MIT.txt`. Este aviso se refere
a estes arquivos, não declara uma licença global para o aplicativo TeachLi.

## Reprodução

No checkout TeachLi, os scripts correspondem a `scripts/dataset/` e devem ser
executados desse diretório lógico (eles localizam a raiz do projeto). A cópia
em `source/` permite consultar o código exato junto do modelo. Use Python 3.12
e as dependências de `source/requirements.txt` em um ambiente isolado.

Dados de entrada: ZIP público LibraSign, landmarks em
`client/public/datasets/libras-landmarks.json` e modelo legado preservado em
`client/public/models/gesture-classifier/`.

```sh
OPENBLAS_NUM_THREADS=2 OMP_NUM_THREADS=2 python scripts/dataset/experiment_alphabet.py --zip /caminho/librasign.zip --output /tmp/teachli-alphabet-26 --base-model client/public/models/gesture-classifier --initialize-from-base --learning-rate .00015 --legacy-weight 2 --focus-weight 2 --rotation-3d --additions FGHJKPQTXYZ
node scripts/dataset/verify_tfjs.mjs /tmp/teachli-alphabet-26
```

## Limites da avaliação

O recorte de desenvolvimento foi inspecionado anteriormente e o modelo legado
pode já ter visto exemplos dessa base. Não há identificação dos participantes
no CSV; não foi realizada uma avaliação independente com pessoas novas ou
câmera. A precisão das previsões aceitas nas letras antigas foi de 97,80%,
contra 99,04% do modelo legado. As métricas não garantem desempenho em uso real.
Veja `docs/TREINAMENTO_ALFABETO.md` e
`docs/experiments/alphabet-26-transfer-report.json` no repositório.
