# Guia de uso

Para instalar, siga o [README](../README.md). A interface atual não exige login.
A página inicial oferece **Modo Aluno**, **Treinar Gestos** e **Sala de Aula**.

Os passos descrevem as telas presentes no código. A instalação limpa da `main`
tem impedimentos de dependências/build registrados no README; este guia não
significa que esses fluxos foram todos testados em uma publicação operacional.

## Digitar e ouvir

1. Abra **Modo Aluno** (`/aluno`).
2. Em **Digitar e Ouvir**, escreva o texto que deseja dizer.
3. Clique em **Falar** ou pressione **Enter**; **Shift+Enter** insere linha.
4. A fala sai no dispositivo atual. **Limpar** apaga o texto.

Não é necessário ligar a câmera. O texto não é enviado aos participantes da Sala
de Aula. A voz depende do navegador/sistema; o código procura português brasileiro.

Para experimentar Libras, marque **Mostrar opção de tradução em Libras (VLibras)**,
clique em **Falar**, abra o ícone azul e selecione o texto exibido abaixo do campo.
O widget externo precisa de conexão. Não há API própria gerando arquivos de vídeo.

## Reconhecer pela webcam

1. Aguarde os modelos carregarem no Modo Aluno.
2. Clique em **Iniciar Câmera** e permita acesso à webcam.
3. Mantenha a mão visível e iluminada; faça uma configuração existente no modelo.
4. Observe gesto, confiança e histórico. Há limiares e uma janela de estabilidade
   antes de registrar resultados.
5. **Adicionar ao Texto**, quando disponível, acrescenta e fala o sinal. Em
   **Texto Reconhecido**, **Falar** lê o acumulado e **Limpar** o apaga.
6. Use **Parar Câmera** ao terminar.

O modelo base reconhece **A, B, C, D, E, I, L, M, N, O, R, S, U, V e W**.
O modelo estático pessoal substitui o base; o dinâmico pessoal reconhece clipes
treinados. Previsões confiantes podem estar erradas. Não há interpretação de frases
nem validação linguística automática.

## Treinar um modelo pessoal

Abra **Treinar Gestos** (`/aluno/treinar`). Amostras e modelos ficam no navegador
usado para treinar, sem sincronização entre contas, salas ou computadores. Limpar
os dados do site pode removê-los.

### Sinal estático

1. Selecione **Sinal estático (foto)** e inicie a câmera.
2. Informe um rótulo, posicione a mão e clique em **Capturar** várias vezes.
3. Repita com pelo menos duas classes e varie as condições de captura.
4. Opcionalmente, **Importar alfabeto** adiciona amostras pré-extraídas do projeto.
5. Clique em **Treinar**, aguarde e volte ao Modo Aluno.

**Limpar** no tipo estático remove amostras e modelo pessoal estático; o modelo
base volta a ser a opção de carga.

### Sinal dinâmico

1. Selecione **Sinal dinâmico (movimento)**, inicie a câmera e informe um rótulo.
2. Clique em **Gravar**, faça o movimento e escolha **Parar e salvar**.
3. Grave repetições e pelo menos duas classes; clipes curtos demais são rejeitados.
4. Clique em **Treinar** e volte ao Modo Aluno.

Não há vocabulário dinâmico pronto distribuído como modelo base. O resultado depende
dos seus clipes. **Limpar** nessa aba remove apenas dados e modelo dinâmicos.
A acurácia de treino não substitui avaliação com amostras novas.

## Participar de uma sala

O frontend e o [servidor de sinalização](../server/README.md) precisam funcionar.
Todos os participantes devem apontar para o mesmo servidor.

**Professor:** abra **Sala de Aula**, informe o nome e clique em **Iniciar aula**.
Permita câmera e microfone, aguarde conexão e compartilhe o código de seis
caracteres do topo. Pode haver um professor conectado por sala.

**Aluno:** abra **Sala de Aula**, informe nome e código e clique em **Entrar na aula**.
Permita câmera e microfone. O professor deve ter iniciado a sala primeiro.

O professor recebe os alunos e cada aluno se conecta ao professor; alunos não
se conectam diretamente entre si. **Sair** deixa a sala; quando o professor sai,
os alunos recebem o aviso de encerramento. Não há controles individuais de
mute/câmera na tela atual.

O código permite entrada, mas não verifica identidade ou vínculo institucional.
Não há gravação persistente, legendas compartilhadas ou envio de mensagens do
Modo Aluno à chamada. Em falhas, volte à entrada e tente novamente; não há
recuperação automática completa.

## Problemas frequentes

| Sintoma | O que conferir |
| --- | --- |
| Câmera/microfone não abrem | Permissões, dispositivo disponível e uso de localhost ou HTTPS |
| Aguardando gestos | Mão detectada, classe existente, carga do modelo e iluminação |
| Falha em MediaPipe/WASM | Execute `npm ci` e `npm run dev` em `client/`; use o runtime da versão instalada |
| Texto não é falado | Volume, saída de áudio, síntese de voz/vozes do sistema e interação com o botão Falar |
| VLibras não aparece | Opção ativada, serviço externo acessível e bloqueadores |
| Aula ainda não começou | Professor conectado, código correto e mesmo servidor |
| Conectando sem vídeo | WebSocket acessível, permissões e restrições de rede; não há TURN |
| Funciona só em um computador | Configure `VITE_SIGNALING_URL` compartilhada; `localhost` no aluno aponta para o aluno; reinicie/recompile o frontend |
| Modelo pessoal desapareceu | Mesmo navegador, perfil e endereço do treino; os dados são locais à origem |
| Link `/sala/...` dá 404 | A hospedagem precisa de fallback para a aplicação; testar também URLs diretas |

Ao abrir um bug, informe passos, navegador, sistema, versão/commit e resultado
esperado. Não publique dados pessoais de participantes.
