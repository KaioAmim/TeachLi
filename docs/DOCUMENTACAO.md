# Documentação técnica do TeachLi

Atualizada em 19/11/2026. Este é o documento técnico único: estado da aplicação,
arquitetura, reconhecimento e treinamento, segurança/LGPD e identidade visual.
O plano de evolução, os critérios de aceite e as convenções de branch/commit estão
no [plano de implementação](GUIA_IMPLEMENTACAO.md). Implementação no código e teste
automatizado não substituem avaliação com a turma.

**Índice:** [1. Estado atual](#1-estado-atual) · [2. Arquitetura e rotas](#2-arquitetura-e-rotas) ·
[3. Instalação, login e publicação](#3-instalação-login-e-publicação) ·
[4. Salas e armazenamento](#4-salas-e-armazenamento) ·
[5. Reconhecimento e treinamento](#5-reconhecimento-e-treinamento) ·
[6. Texto, voz e VLibras](#6-texto-voz-e-vlibras) · [7. Segurança e LGPD](#7-segurança-e-lgpd) ·
[8. Identidade visual](#8-identidade-visual) · [9. Verificações](#9-verificações)

## 1. Estado atual

TeachLi é um protótipo de apoio à comunicação entre aluno e professor. O aluno
digita ou sinaliza diante da câmera; os gestos reconhecidos formam a mensagem e
seguem ao professor automaticamente após uma pausa. O professor recebe o texto e
pode ouvi-lo; ao ativar a transcrição, compartilha frases finalizadas com os
alunos da mesma sala.

| Recurso | Implementado | Limite atual |
| --- | --- | --- |
| Login | Microsoft com PKCE, `state` e nonce; perfis por domínio institucional | Sem matrícula por turma ou comprovação administrativa de função docente |
| Salas | Laboratórios A/B/C, Sala 01/02; seleção após login, presença, troca e logout | Um professor por sala; estado em memória, uma instância |
| Mensagem do aluno | Digitação ou composição por gestos; envio automático após pausa (desligável), Enter para texto digitado | Sem fila para destinatário ausente; confirmação não comprova leitura |
| Composição por gestos | Letras estáveis entram sozinhas, formam palavras e separam por pausa; pausar, espaço, apagar e editar; sem desenho de traços sobre as mãos | Heurística de tempos fixos, não calibrada com usuários |
| Fala do professor | Transcrição local e envio de frases finais aos alunos da sala | Sem legendas parciais compartilhadas; depende do navegador |
| Voz | Leitura local só quando solicitada e botão de ouvir no painel do professor | Sem fila automática de reprodução |
| Reconhecimento por pose | Modelo experimental A–Z ou modelo pessoal | H/J/K/X/Z sem validação do movimento completo; sem Ç |
| Reconhecimento dinâmico | Modelo base de 178 sinais em movimento (Libras-EQT-UECE) e treino Conv1D local | Acurácia medida só em clipes isolados; sem classe "nenhum sinal"; licença do dataset a confirmar |
| Expressões faciais | Pergunta, dúvida, surpresa, negação e certeza (sobrancelhas e movimento da cabeça) | Limiares não calibrados com sinalizantes; só complementam a mensagem |
| VLibras | Widget externo para texto selecionado na página | Sem contrato próprio de fila ou controle automático do avatar |
| Chamada de vídeo e áudio | Aluno e professor na mesma sala, WebRTC ponto a ponto; professor envia câmera e microfone, aluno só a câmera | Experimental; só STUN público; sem gravação; não validado com contas e dispositivos reais |
| Histórico de aulas | Não implementado | Backend e tela de histórico foram removidos |

## 2. Arquitetura e rotas

| Pacote | Papel | Entrada e saída |
| --- | --- | --- |
| `client/` | React 18, TypeScript, Vite 5, Tailwind 3, Wouter, MediaPipe e TensorFlow.js | `index.html` → `src/main.tsx` → `App.tsx`; saída `client/dist/` |
| `server/` | Node.js, `ws` e `jose`; autenticação e encaminhamento de texto | `index.mjs` → `classrooms.mjs` e `microsoft.mjs` |
| `training/` | Scripts offline (Python/Node) que geram o modelo base dinâmico; os do alfabeto ficam em `client/public/models/gesture-classifier-26/source/` | Não faz parte do build do site |

O reconhecimento e o treino acontecem no navegador. O servidor recebe o texto
confirmado e as frases finais e encaminha só ao perfil oposto na mesma sala. A mídia
da chamada segue direto entre os navegadores por WebRTC; o servidor retransmite
apenas a sinalização (SDP e ICE) e não grava nem transmite câmera ou áudio.

| Rota | Uso |
| --- | --- |
| `/` | Apresentação e escolha do perfil |
| `/entrar` | Retorno do login Microsoft |
| `/salas` | Preparação da sessão e seleção de sala |
| `/aluno` | Câmera, composição por gestos, digitação, voz e mensagens da sala |
| `/aluno/treinar` | Amostras e modelos pessoais do aluno |
| `/professor` | Mensagens recebidas e transcrição compartilhada |

As telas de comunicação exigem login do perfil e sala selecionada; atualizar a
página exige escolher a sala de novo. A
chamada aparece em `/aluno` e `/professor`; o aluno precisa ligar a câmera para entrar nela.

**Fronteira de compilação.** `client/tsconfig.json` verifica `src/main.tsx`, todos os
imports transitivos, as declarações locais e `vite.config.ts`. Novos módulos importados
passam a ser verificados; uma entrada independente (como um worker) precisa ser
cadastrada. O modo `strict` permanece ativo e o build executa TypeScript antes do Vite.
O `package.json` da raiz só contém o atalho `npm run dev:classroom`. O backend herdado
(Express/tRPC/Drizzle/MySQL, OAuth e integrações do template anterior) foi removido.

## 3. Instalação, login e publicação

Use Node.js 22 ou posterior e npm (validado com 24.21.0; a 22 não foi executada).

```bash
npm ci --prefix client
npm ci --prefix server
npm run dev:classroom
```

O site usa a porta fixa 5173 e o servidor, a 8787; porta ocupada gera erro, sem mudar
para 5174 (isso causou o erro Microsoft AADSTS50011). Também é possível iniciar
separadamente com `npm run dev` em `client/` e `npm start` em `server/`. Não há banco de dados.

O aplicativo Microsoft precisa de Client ID público e retorno SPA para a origem exata
(`http://localhost:5173/entrar` e/ou `http://127.0.0.1:5173/entrar`). O Tenant ID da
instituição é obrigatório (GUID; `organizations` não é aceito): restringe o acesso, mas
não substitui a regra de perfil por domínio nem exige cadastro de docentes. Nunca coloque
Client Secret em variáveis `VITE_*`. Detalhes no [README](../README.md) e no [guia do servidor](../server/README.md).

Depois do retorno, o servidor verifica assinatura RS256, emissor, audiência, tenant e
expiração antes de emitir uma sessão opaca. O perfil deriva do domínio exato:
`@alunos.unibarretos.com.br` (aluno) e `@unibarretos.com.br` (professor). Editar
armazenamento ou URL no cliente não autoriza nada no servidor. Isso não equivale à
validação administrativa da função de professor. A indisponibilidade do servidor não
impede o login; logout encerra só a sessão do TeachLi.

| Configuração | Uso |
| --- | --- |
| `VITE_MICROSOFT_CLIENT_ID` | ID público do aplicativo já usado no login |
| `VITE_MICROSOFT_TENANT_ID` | GUID do tenant (obrigatório) |
| `VITE_SIGNALING_URL` | Servidor de salas; padrão `ws://localhost:8787` |
| `MICROSOFT_CLIENT_ID` / `MICROSOFT_TENANT_ID` (servidor) | Opcionais se lidos do cliente; o servidor recusa tokens de outro tenant |
| `TEACHLI_CORS_ORIGIN` | Origens exatas autorizadas; padrão localhost/127.0.0.1:5173 |
| `TEACHLI_ROOMS` | Catálogo opcional de salas com IDs estáveis |
| `PORT` | Porta do servidor; padrão 8787 |
| `OPENAI_API_KEY` | Segredo do servidor para gerar resumo sob solicitação do aluno |
| `OPENAI_SUMMARY_MODEL` | Modelo da Responses API; padrão `gpt-6-luna` |

Em publicação, sirva `client/dist/` por HTTPS com fallback para `index.html` e um processo
Node com WSS; cadastre a origem na Microsoft e no servidor. `localhost` em outro
dispositivo aponta para o próprio dispositivo. `predev` e `prebuild` copiam o WASM do
MediaPipe para `public/`. Os modelos de mão e de rosto e o VLibras ainda carregam recursos
externos, e o reconhecimento de fala depende do navegador: o sistema não é inteiramente
offline. A base Vite é `/`. O Vite copia `public/` ao build, inclusive os modelos e `datasets/libras-landmarks.json` (só vetores numéricos já normalizados;
as fotos originais do alfabeto foram removidas do repositório): revise esses arquivos antes de publicar. O WASM do MediaPipe em
`public/mediapipe/` é gerado por `predev`/`prebuild` e não é versionado.

## 4. Salas e armazenamento

O protocolo completo está em [server/README.md](../server/README.md). Eventos principais:
`joined`, `presence`, `student.message`, `caption.final`, `message.ack`, `message.rejected`
(e `signal` para a chamada). Autoria e destino são definidos pelo servidor.

- Aluno pode entrar antes do professor; não há envio pendente para entrega futura.
- Um professor por sala e uma conexão por sessão; trocar de sala remove a associação anterior.
- Texto até 2.000 caracteres; limites de frequência e deduplicação no servidor.
- `message.ack` confirma encaminhamento, não leitura ou reprodução.
- Estado em memória, sem sincronização entre servidores nem histórico.
- O cliente mantém até 100 mensagens recebidas; sair ou trocar de sala limpa o painel.
- Sessões duram no máximo 1 hora (e até a expiração Microsoft); qualquer conta do perfil pode escolher qualquer sala.

O ID token e a sessão ficam em `sessionStorage`. Modelos pessoais ficam em IndexedDB;
rótulos e amostras de treino, em localStorage — por origem/navegador, sem sincronizar por
conta; limpar os dados do site apaga o treino pessoal. Não registre tokens nem dados de
participantes em logs de teste.

## 5. Reconhecimento e treinamento

### 5.1 Pipeline ao vivo (`StudentMode.tsx`)

1. O HandLandmarker detecta até duas mãos; o FaceLandmarker (opcional) analisa o rosto a
   cada 2 quadros. Os traços sobre as mãos **não são desenhados** (apenas o vídeo aparece).
2. **Letras (pose):** a primeira mão vira 63 valores (21 pontos, pulso na origem, escala
   pulso→base do dedo médio). Um gesto só é confirmado com confiança > 0,75, margem > 0,15
   sobre a 2ª classe e 6 quadros estáveis.
3. **Sinais em movimento:** a detecção das mãos roda a ~30 quadros/s (o rosto, a ~10/s). Buffer de até 120
   quadros com as duas mãos, **limpo quando a mão fica 6 quadros fora do quadro** (para não misturar sinais vizinhos),
   consultado a cada 4 quadros. O modelo base testa janelas de 20, 30, 45, 60, 90 e 120 quadros (reamostradas para 40)
   e fica com a mais confiante que não seja "nenhum sinal": confiança > 0,9, margem > 0,4 e 3 consultas seguidas iguais.
   O modelo do usuário (sem essa classe) usa janela única de 60 quadros: confiança > 0,85, margem > 0,25 e 4 consultas.
   Os limiares priorizam precisão: é preferível deixar de emitir um sinal a enviar um errado. Foram endurecidos depois
   da simulação da seção 5.4, então os números dessa tabela valem para os limiares anteriores (0,8/0,25/2 e 0,75/0,15/3).
   Uma consulta sem certeza zera a sequência de confirmação.
4. **Composição automática:** a letra confirmada entra no texto sem espaço; sinais inteiros entram
   separados por espaço. A mesma letra só se repete depois de o gesto ser solto (≥ 8 quadros sem
   gesto confiável). Transições incertas e ausência de mão não acrescentam nada. Uma barra indica
   a confirmação e o aviso "Adicionado à mensagem" confirma a inclusão.
5. **Pausa e envio:** após 1,5 s sem gestos entra um espaço (separa palavras); após 5 s a mensagem
   segue ao professor e o campo é limpo. Só vale com câmera ligada, composição não pausada,
   professor conectado e campo de texto sem foco. O aluno pode pausar a composição, inserir espaço,
   apagar a última letra, editar livremente ou desligar o envio automático (o botão "Enviar ao
   professor" reaparece). O rascunho é preservado ao parar e reiniciar a câmera. Voz só quando solicitada.
6. "Adicionar ao texto" continua como alternativa manual, usando a mesma regra de repetição. Corrigido
   o bug em que o botão ficava desabilitado com confiança arredondada para 75% e em que uma detecção
   antiga permanecia selecionável após a mão sair do quadro.

Constantes (`WORD_GAP_MS`, `AUTO_SEND_MS`, `RELEASE_FRAMES`, limiares) ficam no topo do arquivo.

### 5.2 Expressões faciais

`useFaceLandmarker.ts` carrega o FaceLandmarker (blendshapes e matriz de pose da cabeça);
`lib/facialExpression.ts` interpreta os sinais gramaticais da Libras:

| Expressão | Critério | Entra na mensagem como |
| --- | --- | --- |
| Pergunta | Sobrancelhas erguidas | `?` |
| Surpresa/ênfase | Sobrancelhas erguidas com olhos arregalados ou boca aberta | `!` |
| Dúvida | Sobrancelhas franzidas | `(dúvida)` |
| Negação | Sobrancelhas franzidas com cantos da boca para baixo, ou balançar a cabeça | `(negação)` |
| Certeza | Acenar a cabeça (cima/baixo) | `(certeza)` |

Só vale se a expressão ficou estável por ~0,5 s (o aceno/balançar vêm do movimento), houve gesto de
mão nos últimos 4 s e já existe texto; há pausa de 2 s entre expressões e a mesma só se repete após
voltar ao neutro. Um checkbox desliga o recurso (o modelo nem é carregado); falha do modelo do rosto
não afeta as mãos. Os limiares são heurísticas ainda não calibradas. O dataset
[Grammatical Facial Expressions (UCI)](https://archive.ics.uci.edu/dataset/317/grammatical+facial+expressions)
é a referência candidata para calibrá-los. As expressões complementam a mensagem; não são tradução.

### 5.3 Modelo do alfabeto (pose)

O modelo base fica em `public/models/gesture-classifier-26/`: MLP `63→256→128→64→26`, A–Z
experimental; modelos pessoais têm prioridade. H/J/K/X/Z são classificados pela posição da mão, sem
validar o movimento; Ç não está incluído (a tela de treino aceita rótulos personalizados, inclusive Ç,
mas isso não significa que o modelo distribuído reconheça Ç). O modelo original de 15 letras
(A, B, C, D, E, I, L, M, N, O, R, S, U, V, W) foi preservado em `public/models/gesture-classifier/`.

**Fontes.** Usadas: landmarks legados (base de Bianka Passos) e
[Libras Landmark Dataset, Heitorccf](https://www.kaggle.com/datasets/heitorccf/librasign) (26 CSVs A–Z,
1.000 amostras/letra, 63 coordenadas, GPL 3, sem Ç nem metadados de clipe/participante; SHA-256 do ZIP
`f1ca1f53d47bbba99b64c6f5815f740a200b354a6ddf7f939f6b78655313b8dd`). Candidatas não incorporadas:
[Libras, Willians Oliveira](https://www.kaggle.com/datasets/williansoliveira/libras) (licença `Unknown`),
[Alfabeto em Libras, Roboflow](https://universe.roboflow.com/alfabeto-libras/alfabeto-em-libras-qrvnw-5tcwx)
(CC BY 4.0, 21 classes, sem H/J/X/Y/Z/Ç) e o [projeto da UFRGS](https://github.com/drdgfv/libras-gesture-recognition)
(as pastas de dados do commit consultado só têm `.gitkeep`). Não há base verificada com exemplos
temporais do Ç e licença clara; o Ç é C acrescido de movimento
([Unesp](https://repositorio.unesp.br/bitstream/handle/11449/140104/ISBN9788579833236.pdf?isAllowed=y&sequence=1)).

**Experimentos.** O primeiro candidato (21 classes) falhou nos critérios de regressão (acerto nas letras
antigas 97,30% → 93,26%; O caiu para 45,45%) e não foi instalado. O ajuste por transferência (camadas e saídas das
15 letras preservadas, taxa 0,00015, peso 2 para a base legada e para O/M/C, rotações 3D) chegou ao
modelo A–Z atual:

| Comparação interna | Original (15) | 1º candidato (21) | Atual (26) |
| --- | ---: | ---: | ---: |
| Acerto nas letras antigas | 97,30% | 93,26% | 97,61% |
| O | 95,45% | 45,45% | 95,45% |
| M | 85,29% | 75,00% | 85,29% |
| C | 88,46% | 82,05% | 91,03% |
| Precisão das previsões aceitas, letras antigas | 99,04% | 95,28% | 97,80% |

As 11 classes novas obtiveram 100% no recorte da LibraSign, o que **não** mede generalização: a divisão
foi por blocos de linhas (sem identificador de participante), o modelo antigo já viu os dados legados, e
espelhos não são pessoas independentes. M ainda se confunde com N; C, com A/P. A exportação foi conferida
contra o TF.js (diferença máxima `2,38e-7` em 114 previsões; normalização `2,38e-7` em 78 exemplos).
Relatórios: [alphabet-21](experiments/alphabet-21-report.json),
[alphabet-21-transfer](experiments/alphabet-21-transfer-report.json),
[alphabet-26-transfer](experiments/alphabet-26-transfer-report.json). Avisos de licença e código de
reprodução acompanham o artefato (`NOTICE.md`, `source/`). Reprodução (caminhos de exemplo; o ZIP não
está no repositório):

```sh
python3 -m venv /tmp/teachli-alphabet-venv
/tmp/teachli-alphabet-venv/bin/pip install numpy==2.2.6 scikit-learn==1.7.2
python experiment_alphabet.py --zip librasign.zip --output saida --base-model client/public/models/gesture-classifier \
  --initialize-from-base --learning-rate .00015 --legacy-weight 2 --focus-weight 2 --rotation-3d --additions FGHJKPQTXYZ
node verify_tfjs.mjs saida
```

(`experiment_alphabet.py` e `verify_tfjs.mjs` estão em `client/public/models/gesture-classifier-26/source/`.)
O teste já foi inspecionado: novas iterações precisam de avaliação independente.

### 5.4 Modelo base de sinais em movimento

Treinado com o dataset **Libras-EQT-UECE (Hand Landmarks)**: 178 sinais (palavras e frases), 5 informantes,
5.347 clipes (29–36 por sinal), 2 mãos × 21 pontos × 3 por quadro, 47–279 quadros por clipe. A pasta
"Landmarks" do mesmo dataset inclui 64 pontos de corpo/rosto por quadro, ainda não usados (o app não os
tem ao vivo). Entrada: 40 quadros × 126 valores, com a mesma normalização do app e as mãos na ordem
`[lado esquerdo da imagem, direito]` (o dataset guarda a ordem invertida; `convert_uece.py` troca).
Os datasets ficam fora do repositório; só o modelo (~1,4 MB) é publicado em
`public/models/gesture-classifier-dynamic/`. O modelo do usuário e o base funcionam juntos (vale a predição aceita de maior confiança). O modelo base tem uma 179ª
classe, `__nenhum__` ("nenhum sinal"), que não aparece na interface.

Avaliação com informante inédito (leave-one-signer-out), top-1 / top-5:

| Variante | Informante 5 | Observação |
| --- | ---: | --- |
| Arquitetura do app | 64,7% / 89,0% | Referência |
| + trajetória do pulso | 58,3% / 86,1% | Piorou: descartada |
| Rede maior (`--wide`: 3 blocos Conv1D 96/192/256) + aumento (corte/reamostragem, escala, ruído) | 71,7% / 92,9% | **Adotada** |

Com a rede adotada: informante 1 = 85,0% / 97,6%; informante 3 = 77,9% / 93,3%. Esses números são de clipes
isolados e já recortados.

**Classe "nenhum sinal" e fala contínua (v2).** Ao vivo o modelo vê janelas que cortam o sinal ou misturam dois sinais,
e sem uma classe negativa ele sempre responde com algum sinal. A v2 (`train_dynamic_v2.py`) acrescenta `__nenhum__`,
treinada com transições entre sinais, trechos parciais e poses paradas, e exemplos positivos com recortes e sobras do sinal
vizinho. Em clipes isolados o acerto fica quase igual (70,4% / 93,5% contra 72,2% / 95,1% sem a classe) e 98,7% dos trechos
de transição de teste são reconhecidos como "nenhum".

O teste de fala contínua (`simulate_live.py`) concatena 8 clipes de um informante que não entrou no treino, 30 fluxos
(240 sinais), e reproduz o laço do app, com ou sem pausas (mão fora do quadro) entre os sinais:

| Cenário | Algoritmo | Sinais reconhecidos | Emissões corretas | Emissões por sinal |
| --- | --- | ---: | ---: | ---: |
| Sem pausas | Anterior (janela fixa de 60, sem "nenhum sinal") | 45,0% | 26,5% | 1,70 |
| Sem pausas | Anterior com o modelo v2 aplicado a várias janelas | 37,5% | 16,8% | 2,23 |
| Sem pausas | **Atual (várias janelas + "nenhum sinal")** | **58,8%** | **58,0%** | **1,01** |
| Com pausas | Anterior | 40,0% | 24,2% | 1,65 |
| Com pausas | **Atual** | **53,7%** | **58,6%** | **0,92** |

(A linha "Anterior com várias janelas" usa o modelo sem a classe negativa: várias janelas sem ela pioram o resultado,
por isso o modelo do usuário continua com janela única.) Os falsos sinais caíram a menos da metade, mas ainda se perdem
cerca de 45% dos sinais com um informante novo. É uma simulação com clipes concatenados, não uma medida com câmera real.
**A origem e a licença do dataset não foram verificadas** (nenhuma fonte encontrada):
confirmar com o autor antes de redistribuir o modelo (`NOTICE.md` na pasta do modelo).

Reprodução (de dentro do ambiente Python com `tensorflow`, `numpy`, `scikit-learn`):

```sh
python training/convert_uece.py "<pasta Hand Landmarks>" uece.npz uece_raw.npz   # uece_raw.npz: clipes de comprimento variável
python training/train_dynamic_v2.py uece_raw.npz --holdout 5 --out avaliacao          # avaliação (informante 5 fora do treino)
python training/simulate_live.py uece_raw.npz --model avaliacao --algo novo [--gaps]  # fala contínua
python training/train_dynamic_v2.py uece_raw.npz --holdout 0 --out saida              # modelo final, todos os informantes
python training/export_weights.py saida/model.keras saida/weights.json
# de dentro de client/ (onde o @tensorflow/tfjs está instalado):
node ../training/export_tfjs.mjs saida/weights.json saida/labels.json public/models/gesture-classifier-dynamic
```

O `export_tfjs.mjs` reordena os pesos (o TF.js espera todos os treináveis antes dos não treináveis) e a
paridade com o Keras foi conferida em 9 clipes (diferença máxima de probabilidade 1,2e-7). `tfjs-node` não instala com Node 24; por isso o treino usa Python.

### 5.5 Próximas etapas e limites

- O treino dinâmico do usuário já preserva a posição do pulso (formato v2, seção 5.6), mas ainda gera variações antes
  da divisão de validação; separar gravações antes de gerar variações precisa ser corrigido antes de uma campanha de
  coleta. Nos testes com o dataset UECE, acrescentar a trajetória piorou o acerto com informantes novos (seção 5.4);
  isso precisa de nova análise com o formato v2.
- Coletar clipes (não fotos) de movimentos, incluindo Ç; conferir rótulos com pessoa fluente; incluir pausas,
  transições e exemplos negativos; avaliar por participante e por gravação, com pessoas não usadas no treino.
- Datasets candidatos para ampliar o vocabulário: [MINDS-Libras](https://zenodo.org/records/2667329)
  (20 sinais, 12 sinalizadores), [V-LIBRASIL](https://ieee-dataport.org/documents/v-librasil-new-dataset-signs-brazilian-sign-language-libras)
  (1.364 termos, 4.089 sinais; vídeo, exige extração de landmarks), [Grammatical Facial Expressions (UCI)](https://archive.ics.uci.edu/dataset/317/grammatical+facial+expressions).
  Referências: [subconjuntos de landmarks do MediaPipe para Libras](https://arxiv.org/pdf/2510.24887v3)
  (usar todos os pontos piora o resultado), [SignForest](https://github.com/Jovinull/SignForest),
  [ST-LibrasNet](https://codeberg.org/Jovinull/STLibrasNet).
- Confiança, margem e estabilidade filtram predições; não garantem correção nem substituem uma classe
  negativa treinada. O aplicativo não traduz Libras completa nem frases sinalizadas.

### 5.6 Formato temporal v2, V-Librasil e VLibrasBD

O classificador temporal do treino pessoal usa sequências de 40 quadros e Conv1D local. Cada mão combina 63 valores de
pose normalizada com a posição do pulso no quadro (66 por mão, 132 por quadro), preservando parte da trajetória espacial.
O formato v2 e seus clipes ficam no IndexedDB; clipes pessoais antigos são migrados e modelos v1 (126 valores) seguem
compatíveis. O modelo base (seção 5.4) foi treinado com 126 valores, então é consultado com os mesmos quadros sem a posição
do pulso; ele roda junto com o modelo pessoal.

Na tela de treino, vídeos locais do [V-Librasil](https://libras.cin.ufpe.br/) podem ser convertidos pelo MediaPipe em clipes
temporais e adicionados ao treino. É possível fornecer um CSV de anotações com `video_name` e `class` quando os nomes dos
vídeos não identificam o sinal. O [VLibrasBD](https://data.mendeley.com/datasets/ryj88ckjww/2) é importado como corpus
textual português/glossa (licença CC BY-SA 4.0) e fornece uma sugestão aproximada de frase após sinais dinâmicos
reconhecidos; ele não contém vídeos nem treina o classificador visual. A sugestão pode estar errada e precisa ser revisada.
Os arquivos selecionados e os resultados ficam no navegador, sem upload pelo TeachLi.

O V-Librasil fornece sinais isolados e não frases contínuas, e o VLibrasBD traz pares de frases, não alinhamentos de vídeo
por palavra. Portanto, essa integração experimental não traduz frases sinalizadas com fluência. Ainda é preciso separar
gravações por sinalizador antes da validação e avaliar os rótulos e resultados com pessoas fluentes em Libras.

## 6. Texto, voz e VLibras

No texto digitado, Enter envia ao professor e Shift+Enter insere linha. Mensagens compostas por gestos
seguem automaticamente após a pausa (seção 5.1). Os botões de ouvir usam a síntese de voz do
dispositivo, sempre por ação do usuário; o professor ouve cada mensagem manualmente, sem fila
compartilhada. Ao iniciar a gravação, as frases finais da transcrição vão aos alunos; parciais ficam
locais. Não há confirmação de leitura.

VLibras é um widget externo disponível em todas as telas, para traduzir texto selecionado. Não há API própria
de vídeo, fila automática ou sincronização garantida; o texto original continua sendo o canal disponível.

## 7. Segurança e LGPD

> Documento técnico de apoio. **Não é parecer jurídico nem declara o sistema "adequado" ou "certificado"
> à LGPD (Lei nº 13.709/2018).** A conformidade exige medidas organizacionais e jurídicas (bases legais,
> política oficial, controlador, operador, encarregado). Itens **[revisão jurídica]** dependem disso.

### 7.1 Medidas técnicas

| Camada | Medida | Onde |
| --- | --- | --- |
| Autenticação | Login Microsoft (OIDC + PKCE, `state`, nonce), restrito ao tenant (obrigatório) | `client/src/lib/microsoftAuth.ts` |
| Verificação | Assinatura RS256, emissor, audiência, tenant, validade e `oid` | `server/microsoft.mjs` |
| Autorização | Papel por domínio do e-mail, conferido no servidor; aluno só envia `student.message`, professor só `caption.final` | `server/classrooms.mjs` |
| Sessão | Token opaco (256 bits), em memória, até 1 h, revogado no logout | `server/classrooms.mjs` |
| Abuso | 30 logins/min por IP, 60 mensagens/10 s por conexão, 20 conexões por IP, 10.000 sessões, corpo comum ≤ 32 KB; resumo ≤ 180 KB e 5 gerações/10 min por aluno | `server/classrooms.mjs` |
| Origem/CORS | Lista exata (`TEACHLI_CORS_ORIGIN`), também no WebSocket | `server/classrooms.mjs` |
| Cabeçalhos | `nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`, CSP, HSTS, `no-store` | `server/classrooms.mjs` |
| CSP do site | Injetada no build, limitando scripts, conexões e frames; inclui `storage.googleapis.com` (modelos de mão e rosto) e `vlibras.gov.br` | `client/vite.config.ts` |
| Auditoria | Eventos JSON sem token, e-mail ou nome (usuário = hash curto) | `server/classrooms.mjs` |
| Chamada | Sinalização só entre aluno e professor da mesma sala, payload ≤ 12 KB, 300 sinais/10 s; mídia ponto a ponto | `server/classrooms.mjs`, `useRoomCall.ts` |
| Segredos | Chave OpenAI apenas no servidor; `client/.env.local` fora do Git; Client ID e Tenant ID são públicos | `.gitignore` |

HTTPS/WSS, firewall, backups e monitoramento dependem da hospedagem.

### 7.2 Dados pessoais

| Dado | Onde fica | Finalidade | Retenção | Compartilhamento |
| --- | --- | --- | --- | --- |
| Nome, e-mail, ID Microsoft (`tid`/`oid`) | `sessionStorage` e memória do servidor | Identificar e autorizar | Até 1 h / logout | Microsoft |
| Mensagens e legendas | Memória do servidor; até 500 legendas recentes ficam temporariamente na sala para alunos que chegam depois | Comunicação em sala | Apagadas quando todos saem da sala ou quando o servidor reinicia | Participantes da sala |
| Legendas enviadas para resumir | Memória do navegador; enviadas ao servidor e à OpenAI somente quando o aluno solicita o resumo | Síntese de conteúdo da aula | Não persistidas pelo TeachLi; retenção do fornecedor depende da conta/API **[revisão institucional]** | OpenAI API |
| Áudio do professor | Reconhecimento de fala do navegador | Legendas | Não gravado pelo TeachLi; o navegador pode usar serviço próprio **[revisão jurídica]** | Fornecedor do navegador |
| Imagem da câmera, pontos das mãos e do rosto (expressões) | Processados no navegador; amostras de treino em `localStorage`/IndexedDB | Reconhecer gestos e expressões | Até o aluno clicar em **Limpar** ou limpar o navegador | Não enviados ao servidor |
| Vídeo e áudio da chamada | Em trânsito, ponto a ponto (WebRTC), só após **Entrar na chamada** | Comunicação em aula | Nenhuma além da chamada | Aluno/professor da sala; STUN do Google vê o IP; TURN, se houver **[revisão jurídica]** |
| Eventos de auditoria | Saída padrão do processo | Segurança | A definir (sugestão: 90 dias) | Operador de infraestrutura |

Os modelos de mão e de rosto são baixados de `storage.googleapis.com`; nenhuma imagem é enviada a esse serviço.
Não há banco de dados nem upload de arquivos. As legendas só são compartilhadas com a OpenAI API após o aluno
acionar **Resumir aula**; o segredo da API fica no servidor e `store: false` é solicitado.

### 7.3 Bases legais (proposta) **[revisão jurídica]**

- **Login e autorização:** execução de contrato/procedimentos preliminares ou vínculo docente (art. 7º, V) ou legítimo interesse de segurança (art. 7º, IX).
- **Mensagens e legendas:** execução do serviço educacional e acessibilidade (art. 7º, V); sem armazenamento, risco baixo.
- **Resumo de aula com IA:** avaliar e documentar a base legal e o compartilhamento das legendas com o fornecedor da API, incluindo retenção, transferência internacional e contrato antes de habilitar a chave em produção.
- **Pontos das mãos, do rosto e imagem:** podem configurar característica física; se biométricos, são **sensíveis** (art. 5º, II; art. 11). O treino e o reconhecimento são locais; a chamada transmite a imagem do aluno ao professor. Decidir com o encarregado se há tratamento pela instituição e qual hipótese do art. 11 se aplica (ex.: consentimento específico e destacado). Alternativa menos invasiva: manter 100% local e opcional (já é assim; as expressões podem ser desligadas).
- **Auditoria:** legítimo interesse de segurança (art. 7º, IX).

### 7.4 Direitos, matriz de permissões e retenção

| Direito (art. 18) | Como atender hoje |
| --- | --- |
| Acesso | Dados de sessão são só nome e e-mail do titular; amostras de treino visíveis ao aluno |
| Eliminação | **Treinar gestos → Limpar**; o servidor não guarda mensagens |
| Correção | Nome e e-mail vêm da conta Microsoft (corrigir na origem) |
| Informação / portabilidade | Seção 7.2 e política (7.7); canal do encarregado **[a definir]** |

| Ação | Aluno | Professor | Anônimo |
| --- | --- | --- | --- |
| Entrar com conta institucional | Sim (`@alunos…`) | Sim (`@unibarretos…`) | Não |
| Listar e entrar em sala | Sim | Sim (um professor por sala) | Não |
| Enviar `student.message` / `caption.final` | Sim / Não | Não / Sim | Não |
| Treinar e apagar gestos locais | Sim | — | Não |

Não existem papéis de gestor/administrador; o papel de professor vem do domínio. Retenção: sessão no máximo
1 h; mensagens e legendas não retidas; dados locais até o aluno limpar (recomendado em computadores
compartilhados); logs com sugestão de 90 dias **[definir]**.

### 7.5 Backup e resposta a incidentes (rascunho)

Não há dados persistentes a restaurar: recuperar o serviço é reimplantar código e variáveis
(`MICROSOFT_TENANT_ID`, `MICROSOFT_CLIENT_ID`, `TEACHLI_CORS_ORIGIN`) a partir de um cofre da instituição;
guardar a configuração do Entra (URIs de retorno) e os logs. Em incidente: (1) conter — revogar sessões
reiniciando o servidor, rotacionar o Client ID se houver suspeita, restringir origens; (2) avaliar dados,
período e titulares; (3) comunicar — encarregado e jurídico avaliam a comunicação à ANPD e aos titulares
(art. 48); (4) registrar causa, correção e atualizar este documento.

### 7.6 Vulnerabilidades (auditoria de 11/11/2026)

| ID | Gravidade | Achado | Situação |
| --- | --- | --- | --- |
| A1–A3 | Alta | IDOR em tRPC, cookie `SameSite=None` de 1 ano, corpo de 50 MB sem limite (legado) | **Corrigido** (backend removido) |
| A4 | Alta | Rate limit contornável atrás de proxy; mapas sem teto; sem limite de conexões | **Corrigido** (`TEACHLI_TRUST_PROXY`, tetos, limite por IP) |
| A5 | Alta | Usuário em `localStorage`; ID token em `sessionStorage` | **Parcial**: legado removido; o ID token ainda fica em `sessionStorage` até a troca por token de sala |
| M1 | Média | Sem CSP/cabeçalhos; VLibras externo sem SRI | **Parcial**: CSP e cabeçalhos aplicados; VLibras segue sem SRI |
| M2 | Média | HTTPS/WSS não forçado | **Pendente (infraestrutura)** |
| M3 | Média | Landmarks sem aviso nem opção de apagar | **Corrigido** (aviso e **Limpar**); criptografia local pendente |
| M5 | Média | Papel de professor só por domínio | **Pendente** (decisão institucional) |
| M6–M7 | Média | Arquivos indevidos versionados; raiz sem lockfile | **Corrigido** (permanecem no histórico do Git) |
| B1–B2 | Baixa | Sem auditoria nem cabeçalhos no servidor | **Corrigido** |

### 7.7 Política de privacidade (texto-base) **[revisão jurídica]**

O TeachLi apoia a comunicação em sala de aula na UniBarretos. Usamos sua conta institucional Microsoft para
confirmar quem você é (nome, e-mail e identificador) e se é aluno ou professor. Mensagens e legendas passam pelo
servidor apenas para chegar aos participantes da sala e não são gravadas. O reconhecimento de gestos e de expressões
acontece no seu navegador: imagens da câmera e pontos das mãos e do rosto não são enviados ao servidor, e as
amostras de treino ficam só no seu dispositivo até você apagá-las. Você pode pedir informações sobre seus dados e
exercer seus direitos pelo canal do encarregado **[inserir contato]**.

### 7.8 O que a instituição deve decidir

**Governança e jurídico:** nomear o encarregado (DPO) e o canal dos titulares; definir controlador e operador;
validar a base legal de cada finalidade, inclusive a do dado possivelmente sensível (imagem, pontos de mão e rosto,
art. 11); elaborar o **RIPD** (reconhecimento por câmera em ambiente educacional, possíveis titulares vulneráveis,
necessidade/proporcionalidade, alternativas de texto e voz, processamento local) e o registro das operações (art. 37);
aprovar a política de privacidade; tratar menores de idade (art. 14); revisar contratos com Microsoft e hospedagem
(localização, transferência internacional, art. 33); avaliar o serviço de fala do navegador e o VLibras; definir quem
autoriza professores e contas especiais.

**Segurança e operação:** HTTPS/WSS, firewall, proxy confiável e origens explícitas; segredos em cofre e rotação do
Client ID (os antigos continuam no histórico do Git); retenção, acesso e rotação dos logs; plano de incidentes e
comunicação à ANPD (art. 48); backup da configuração do Entra; papéis de gestor/administrador; confirmar se as contas
de alunos pertencem ao mesmo tenant dos professores (senão o GUID único as bloqueia); teste de invasão e reauditoria
antes da produção.

**Uso em sala:** orientar a limpar os dados de treino em computadores compartilhados; treinar professores e alunos sobre
uso aceitável; decidir sobre a chamada de vídeo (aviso de imagem e voz, gravação proibida, menores, TURN institucional);
avaliar o reconhecimento de Libras com usuários (experimental; não substitui intérprete).

## 8. Identidade visual

**Direção.** Portal acadêmico de apoio à comunicação: a marca institucional identifica o ambiente e a TeachLi
identifica a ferramenta. A entrada dá espaço à mensagem e à escolha de perfil; as áreas de trabalho priorizam
controles e leitura. Paleta: azul UniBarretos `#2B57A2`, laranja `#F5822A`, azul profundo `#153566`, branco,
fundo frio `#F3F6FB`, texto secundário `#53647D`. O laranja é destaque com texto azul profundo; ações primárias usam
azul e branco. Tipografia: Outfit variável hospedada em `client/public/fonts/` (SIL OFL incluída), com Segoe UI
como alternativa. Alinhamento à esquerda, largura de leitura limitada, layout responsivo. A referência
https://unibarretos.edu.br/ orienta a paleta; o vidro translúcido nas áreas de acesso (com alternativa opaca) é
adaptação do TeachLi. A mão aparece só na logo original.

**Marcas** (preservar o desenho): `client/public/brand/unibarretos.png` (do site oficial, 16/10/2026; letras brancas,
pede fundo azul) e `teachli.jpg` (original). A variante `teachli-outline.png` (PNG com alpha, 1446 × 1087, contorno
branco de ~4 px em 1024, sem fundo) substitui a placa branca na interface e é o favicon ativo
(`teachli-favicon.png` fica preservado, sem uso). Um contorno CSS de 1 px reforça a leitura em tamanho pequeno.

**Movimento e rolagem.** Animações de 6 a 18 px e 650 ms a 1 s; trocas rápidas cancelam a seleção pendente. A rolagem é
nativa (sem captura de roda nem animação própria). A preferência do sistema por menos movimento é respeitada; o botão
"Ativar/Reduzir animações" grava a escolha em `localStorage` (`teachli.motion`), por origem. Perguntas compartilham
um único estado aberto, com `aria-expanded`, `aria-controls` e teclado.

**Áreas internas.** Painéis brancos sobre fundo claro, estilos limitados a `student.css` e `professor.css`.
- *Aluno:* câmera e resultado no mesmo painel, com indicador de confirmação, expressão atual e controles de
  composição (pausar, espaço, apagar, envio automático); a mensagem editável fica na coluna ao lado, o histórico de
  detecções e os gestos disponíveis ficam recolhidos e as dicas numa faixa secundária. Nenhum controle falso de salvar.
- *Professor:* frase atual em destaque, gravação logo abaixo, histórico separado; orientações do VLibras numa coluna
  lateral que desce no celular.
- *Seleção de sala:* formulário à esquerda e orientação lateral no desktop; seletor nativo (Laboratórios A/B/C, Salas 01/02),
  botão ativo só após a escolha; faixa azul com sala, presença e troca/saída.

**Endereço de desenvolvimento.** `http://127.0.0.1:5173` com `strictPort: true`; o retorno `/entrar` fica na mesma origem
para preservar a sessão PKCE, e o Entra precisa conter o endereço exato. **Escopo do login:** o fluxo direto com a
Microsoft foi preservado; não há consulta ao servidor de salas antes do redirecionamento, e a seleção de sala permite
tentar de novo sem perder o login.

Validação visual feita em ensaios anteriores com identidades fictícias, em 1440, 1265, 390 e 320 px, sem rolagem
horizontal; não houve câmera ou microfone reais, e a composição automática, as expressões faciais e o modelo
dinâmico ainda não passaram por revisão visual ou teste com câmera.

## 9. Verificações

```bash
npm run typecheck --prefix client
npm run build --prefix client
npm run test:auth --prefix client
npm test --prefix server
```

Os testes de autenticação/salas cobrem perfis, callback, assinatura com chaves de teste, expiração, logout, isolamento,
troca de sala, origem, limites, cabeçalhos, auditoria e tenant. Respostas Microsoft simuladas não comprovam login no Entra
real; duas sessões no mesmo computador não equivalem a dois dispositivos.

| Revisão | Resultado |
| --- | --- |
| 11/11/2026 (segurança) | Testes de servidor (12) e de autenticação do cliente (17) passaram; typecheck e build passaram, com CSP injetada e aviso de tamanho do JavaScript; `npm audit` de produção sem vulnerabilidades; CSP com VLibras, câmera e login em navegador **não executada** |
| 23/10/2026 (build e interface) | Instalação limpa dos lockfiles, typecheck, build e 21 testes passaram; checagem estrita detectou um erro proposital em memória; interface sobre o build com duas sessões isoladas (390 px e 1440 px) passou; contas reais, microfone real e dois dispositivos **não executados** |
| 19/11/2026 | `tsc --noEmit` passa após a composição automática, as expressões faciais e o modelo dinâmico (paridade Keras × TF.js conferida); **nada disso foi testado com câmera, mão e professor reais** |

Para a conferência real, use uma conta de aluno e outra de professor em dispositivos diferentes, acessando a mesma
instalação: texto nos dois sentidos, troca e isolamento de salas, saída, reconexão, microfone, transcrição, e — para o
reconhecimento — composição por gestos, envio automático, expressões e sinais em movimento. Os titulares fazem o login;
não é preciso compartilhar senhas. Build aprovado não comprova precisão em câmera, qualidade em Libras ou capacidade de
uma turma. Registre o resultado exato de cada execução no PR.
