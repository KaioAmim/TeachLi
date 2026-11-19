# Treinamento do modelo base de sinais em movimento

Os datasets grandes ficam fora do repositório; só o modelo pequeno (~1,4 MB) é publicado.

1. `python training/convert_uece.py "<pasta Hand Landmarks>" uece.npz` — normaliza e reamostra para 40 quadros.
2. `python training/train_dynamic.py uece.npz --test-informant 5 --no-traj --wide` — avalia com um informante fora do treino.
3. `python training/train_dynamic.py uece.npz --final saida --no-traj --wide` — treina com todos.
4. `python training/export_weights.py saida/model.keras saida/weights.json`
5. `node training/export_tfjs.mjs saida/weights.json saida/labels.json client/public/models/gesture-classifier-dynamic`
   (rodar de dentro de `client/`, onde o `@tensorflow/tfjs` está instalado).

Achados: acrescentar a trajetória do pulso piorou o acerto com informantes novos (58% contra 65% na mesma rede),
então o modelo usa só as 126 features de forma da mão. O modelo do aluno (Treinar gestos) continua tendo prioridade.
Limitação: o app ainda não tem classe "nenhum sinal"; por isso o modelo base usa limiares mais rígidos.
