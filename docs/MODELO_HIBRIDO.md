# Aula híbrida e EAD — proposta de implementação

## Objetivo e origem

Neste documento, **híbrido** significa aula com participação presencial e a
distância, incluindo uma turma totalmente remota em EAD. Não significa combinar
modelos de machine learning ou contratar processamento em nuvem.

A proposta foi consolidada a partir do resumo `TeachLi.txt` fornecido pela equipe
e do esclarecimento de 9 de outubro de 2026. É uma especificação para começar a
implementação, não a descrição de funcionalidades já entregues.

O resumo foi escrito antes da videochamada atual: `lib/webrtc/` já contém código,
há sinalização em `server/index.mjs` e a rota `/sala/:roomId` oferece chamada.
`ProfessorMode.tsx` contém transcrição local legada, mas não está nas rotas atuais.
O [estado comprovado](../DOCUMENTACAO.md) prevalece para descrever o que funciona.

## Cenários de uso

| Cenário | Professor | Aluno | Saída de voz das mensagens |
| --- | --- | --- | --- |
| Presencial com apoio digital | Dispositivo conectado à sala | Dispositivo próprio ou disponibilizado | Receptor escolhido, como o computador conectado à caixa de som |
| Híbrido | Na sala ou remoto | Parte presencial, parte remota | Um receptor definido por contexto, evitando reprodução duplicada |
| EAD | Remoto | Remoto | Painel do professor; outros receptores somente se essa opção for definida |

Todos participam da mesma sessão lógica. O primeiro incremento deve priorizar
troca de texto acessível; a videochamada existente é um canal complementar.
Entrar apenas para ler legendas ou digitar não deve exigir câmera e microfone.
Hoje `useClassroom` solicita ambos, portanto essa separação exige alteração de código.

## O que já podemos aproveitar

| Existente na main | Evolução necessária |
| --- | --- |
| Código de sala e sinalização WebSocket | Canal de mensagens com autorização, confirmação, ordenação e reconexão |
| Chamada WebRTC em estrela | Separar entrada na sala da ativação de mídia; avaliar mute, TURN e escala |
| Digitar e Ouvir no Modo Aluno | Integrar editor e envio confirmado à sala |
| Modelos estático/dinâmico locais | Gerar rascunho revisável; nunca enviar predições automaticamente |
| `speechSynthesis` com seleção automática pt-BR | Seletor de voz, teste, velocidade, tom e preferências |
| Widget VLibras com seleção de texto | Avaliar integração com frases finais e controle de fila |
| Transcrição em `ProfessorMode.tsx`, fora das rotas | Integrar, revisar ciclo de captura/reinício e testar permissões/erros |

## Fluxo professor → aluno

1. Professor entra na sessão e ativa explicitamente a transcrição.
2. O reconhecimento produz segmentos parciais e finais identificados.
3. Um parcial atualiza a mesma legenda; não cria várias cópias da frase.
4. O final substitui o parcial e entra no histórico rolável da sessão.
5. Alunos ajustam tamanho e contraste das legendas; falha do avatar não oculta o texto.
6. Frases finais podem alimentar uma fila de apresentação em Libras, **se a
   integração suportada pelo widget permitir esse controle**.

Antes de prometer execução automática dessa fila, fazer uma prova de integração
com as interfaces documentadas do VLibras, incluindo início/fim/cancelamento.
O componente atual só incorpora o widget; não oferece esse contrato. Se não houver
suporte adequado, manter seleção manual do texto visível e registrar a limitação.
Uma fila implementada deve permitir pausar, repetir e pular para a frase mais recente.

O ciclo de reconhecimento deve distinguir pausa voluntária de encerramento
inesperado, evitar estado desatualizado em callbacks e limitar tentativas de
reinício. Medir comportamento em aulas longas; não assumir captura contínua.
Serviços externos de STT só devem ser avaliados em uma decisão posterior com
qualidade, custo e tratamento de áudio explícitos.

## Fluxo aluno → professor

1. Aluno digita ou usa reconhecimento local para produzir um rascunho.
2. Revisa e corrige o texto no editor, mesmo quando a previsão tem alta confiança.
3. Um botão **Enviar** confirma a mensagem; reconhecimento ou Enter para leitura
   local não devem enviá-la implicitamente sem uma regra de interface definida.
4. O professor recebe autoria, texto e estado de entrega no painel da sala.
5. A mensagem entra na fila do receptor de voz designado, sem falas sobrepostas.
6. O receptor pode reproduzir, pausar, repetir ou descartar; repetir é ação explícita.

Começar por digitação e um vocabulário de necessidades de sala validado com
participantes, como “não entendi” e “pode repetir”. Esses exemplos são conteúdo
proposto para o piloto, não classes prontas do reconhecedor. As 15 letras base
não constituem tradução de frases em Libras.

## Contrato de mensagens proposto

Para o primeiro incremento, a proposta é usar **WebSocket para texto** e manter
**WebRTC para mídia**. Isso aproveita o servidor existente sem depender de a
negociação de vídeo estar concluída. DataChannel é uma alternativa citada no
resumo, não uma segunda implementação exigida. A decisão deve ser validada na
etapa inicial e registrada caso mude.

O protocolo de aplicação deve ser versionado e separado dos eventos `signal`
usados atualmente para SDP/ICE. Sugestão de envelope:

```json
{
  "version": 1,
  "type": "caption.partial",
  "sessionId": "sessao-exemplo",
  "messageId": "mensagem-exemplo",
  "segmentId": "segmento-exemplo",
  "revision": 2,
  "text": "Trecho em andamento"
}
```

IDs acima são ilustrativos. O servidor deve validar vínculo e papel e atribuir
autoria/ordem confiáveis; não aceitar `role`, `senderId` ou `sessionId` arbitrários
como autorização. `roomCode` de entrada e ID de sessão precisam ter semânticas
distintas para impedir confusão após encerramento e reutilização de código.

| Evento proposto | Regra de processamento |
| --- | --- |
| `caption.partial` | Atualiza segmento pela revisão; descarta revisões antigas e não inicia voz/avatar |
| `caption.final` | Finaliza segmento uma vez; parciais atrasados não o sobrescrevem |
| `student.message` | Envio confirmado; mesma mensagem reenviada não cria novo item |
| `message.ack` | Confirma recebimento/entrega definido no protocolo; não significa que áudio foi ouvido |
| `playback.status` | Receptor informa estado de sua fila; falha e descarte são diferentes de conclusão |
| `session.closed` | Impede novos envios e encerra captura/filas conforme regra da interface |

Definir limites de texto, frequência, tamanho da fila e retenção antes do piloto.
Usar sequência por sessão e IDs para deduplicar; horários do cliente servem apenas
para apresentação, não como única fonte de ordenação. Reconexão deve recuperar
texto sem reler automaticamente mensagens já concluídas. Não prometer entrega
“exatamente uma vez” só por usar WebSocket: confirme estados e teste reenvios.

## Voz, dados e acessibilidade

- Listar vozes disponíveis com `speechSynthesis.getVoices()` e tratar atualização
  da lista; preferir pt-BR e oferecer fallback quando a voz salva não existir.
- Permitir teste, velocidade e tom. Persistir por perfil local inicialmente;
  sincronização por usuário depende de autenticação futura.
- Não iniciar áudio sem respeitar interação e políticas de reprodução do navegador.
- No reconhecimento, a câmera pode permanecer local. Na videochamada atual,
  áudio/vídeo **são transmitidos aos pares**. Distinguir os dois usos na interface.
- O uso de APIs do navegador não garante processamento de fala offline; verificar
  o comportamento e o provedor utilizado antes de informar como o áudio é tratado.
- Dados de sala em memória, histórico persistente e preferências locais são coisas
  diferentes; definir retenção, consulta e exclusão se houver persistência.
- Oferecer teclado, foco visível, contraste, legenda ajustável, histórico rolável
  e feedback textual para falhas que também sejam indicadas por som.

## Etapas e aceite

Pré-requisito de execução: regularizar as dependências e a compilação do cliente
em `maintenance/regularizar-build-client`. A revisão encontrou falha no início
limpo do Vite e no TypeScript; o [README](../README.md) registra os impedimentos.

| Etapa | Branch sugerida | Aceite principal |
| --- | --- | --- |
| 1. Contrato e cenário piloto | `documentation/contrato-aula-hibrida` | Papéis, eventos, receptor de voz, limites e cenários definidos |
| 2. Sala com texto e mídia opcional | `feature/canal-texto-sala` | Dois dispositivos trocam texto sem exigir captura; salas isoladas e reenvios deduplicados |
| 3. Editor e painel do professor | `feature/mensagens-confirmadas` | Aluno corrige/confirma; professor recebe texto e estado de entrega |
| 4. Transcrição e legendas | `feature/legendas-compartilhadas` | Parciais viram finais sem duplicar; pausar/encerrar interrompe captura |
| 5. Fila e preferências de voz | `feature/fila-voz-sala` | Fila sem sobreposição e sem repetição involuntária após reconectar |
| 6. Prova de integração Libras | `enhancement/libras-legendas` | Suporte do widget verificado; fallback manual documentado e legenda sempre acessível |
| 7. Operação híbrida/EAD | `enhancement/operacao-aula-hibrida` | Testes com redes distintas, acessibilidade, perda de conexão e equipamentos do piloto |

As branches seguem [BRANCHES.md](BRANCHES.md). Autenticação/autorização e proteção
contra abuso devem acompanhar o canal compartilhado antes de um piloto com
participantes reais. TURN, limites de banda e eventual SFU dependem da necessidade
de mídia e da turma; um teste com duas abas não valida capacidade de EAD.

Em cada etapa, registrar testes executados, latência observada, falhas e limitações.
Validar reconhecimento com pessoas separadas do treino e avaliar comunicação com
alunos surdos e profissionais de Libras. O [guia de implementação](GUIA_IMPLEMENTACAO.md)
mantém o restante das melhorias e dependências do projeto.
