# Modelo base de sinais em movimento

Treinado com o dataset **Libras-EQT-UECE (Hand Landmarks)**: 178 sinais, 5 informantes, 5.347 clipes.
Entrada: 40 quadros × 126 valores (duas mãos, mesma normalização de `client/src/lib/handFeatures.ts`).

**Licença e origem do dataset não foram verificadas** — confirme os termos de uso com o autor antes de
publicar ou redistribuir este modelo.

Reprodução e resultados: docs/DOCUMENTACAO.md, seção 5.4.

Avaliação com informante inédito (leave-one-signer-out), top-1 / top-5:
informante 5: 71,7% / 92,9% · informante 1: 85,0% / 97,6% · informante 3: 77,9% / 93,3%.
Medida só em clipes isolados e já recortados; ao vivo, com fala contínua, o acerto tende a ser menor.
