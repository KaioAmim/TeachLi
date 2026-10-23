# Guia de implementação do TeachLi

Atualizado em 23/10/2026 para `feature/entrada-salas-aula`.
Este roteiro mantém o objetivo final e distingue a entrega atual das próximas
etapas. “Implementado” significa presente no aplicativo; não equivale a
aprovação do piloto ou validação com usuários reais.

## Resultado final desejado

Permitir que alunos surdos e professores se comuniquem em uma aula presencial,
remota ou híbrida por texto acessível, voz opcional e apoio em Libras. O aluno
poderá digitar ou produzir um rascunho por gestos, revisar e confirmar o envio;
o professor receberá a mensagem e poderá ouvi-la com controle de reprodução.
A fala do professor deverá chegar aos alunos em legendas legíveis, com apoio do
avatar quando a integração e a qualidade da tradução forem comprovadas.

A comunicação deve funcionar nos dispositivos dos participantes. A voz emitida
na caixa de som física não substitui texto para quem está remoto. Texto deve
continuar disponível sem câmera, microfone ou avatar. Reconhecimento experimental
não deve ser apresentado como tradução completa de Libras nem substituir a
avaliação de alunos surdos e profissionais de Libras.

## 0. Build e organização — regularizados para o aplicativo atual

- [x] Definir a fronteira do cliente a partir de `src/main.tsx` e todos os imports,
  das declarações locais e da configuração Vite, mantendo TypeScript estrito.
- [x] Preservar o código herdado e sua auditoria em `npm run typecheck:legacy`.
- [x] Manter TypeScript no comando completo de build, antes do Vite.
- [ ] Regularizar separadamente telas e APIs legadas, caso sejam reintegradas.

Os pacotes atuais são `client/` e `server/`; o manifesto completo da raiz é
herdado. A auditoria legada ainda possui erros e não é apresentada como aprovada.
O aceite desta etapa exige instalação limpa, tipos e build do pacote atual,
sem remover a checagem ou silenciar erros. Resultados das execuções ficam no PR.

## 1. Piloto e avaliação — próximos passos

- [ ] Confirmar participantes, equipamentos, responsáveis e avaliação em Libras.
- [ ] Acordar cenários, métricas, limites, retenção e exclusão de dados do piloto.
- [ ] Validar com duas contas institucionais em dispositivos e redes diferentes.
- [ ] Incluir participação presencial/remota, apenas por texto e com voz desativada.

O login institucional já é a escolha implementada. Uma alteração dessa política
precisa de decisão explícita, não é um requisito pendente para usar as salas.
Aceite: responsáveis e cenários definidos, resultados registrados sem extrapolar
um teste com duas sessões para capacidade de uma turma.

## 2. Identidade e autorização — base implementada

- [x] Login Microsoft existente, com `organizations`, PKCE, `state` e nonce.
- [x] Verificar token no servidor antes da comunicação; definir autoria e papel.
- [x] Aplicar domínios de aluno/professor; rejeitar perfil forjado e conta externa.
- [x] Testar expiração, logout e isolamento com identidades de teste.
- [ ] Conferir o login com contas institucionais reais no ambiente do piloto.
- [ ] Avaliar com a faculdade a administração do aplicativo Microsoft e eventual
  política de vínculo, grupos ou funções de docentes.

**Tenant ID da faculdade e novo cadastro de docentes não são exigidos nesta
entrega.** A regra atual por domínio não prova administrativamente a função de
professor. Restrições adicionais dependerão do acordo com a instituição.
Se a API legada de sessões for reutilizada, autorizar cada consulta/alteração por
participação; exigir login sozinho não basta.

## 3. Salas e comunicação — implementadas, piloto pendente

- [x] Laboratórios A/B/C e salas 01/02 após login; nome visível na comunicação.
- [x] Presença, entrada antes do professor, um professor por sala e troca de sala.
- [x] Mensagens e frases finais somente entre perfis opostos na mesma sala.
- [x] Participação por texto sem exigir câmera ou microfone.
- [x] Estados de falha, nova entrada explícita e encerramento da sessão no logout.
- [ ] Validar em dispositivos/redes reais, inclusive interrupção de conexão.
- [ ] Definir turmas, matrículas, encerramento de aula e histórico se o piloto exigir.
- [ ] Evoluir reconexão e recuperação de estado sem duplicar mensagens.

Estado atual em memória, uma instância; sem histórico persistente. O código
WebRTC antigo está preservado, fora das rotas e sem integração com o servidor
atual. Retomar videochamada requer projeto próprio de sinalização e mídia,
permissões opcionais, avaliação de TURN e banda. WebSocket conectado não comprova
conexão de mídia nem capacidade de turma.

## 4. Texto do aluno e voz — envio implementado, reprodução avançada futura

- [x] Digitar ou formar rascunho por gestos, editar e confirmar o envio.
- [x] Enter envia; Shift+Enter insere linha; ouvir localmente é ação separada.
- [x] Painel do professor com autoria e botão de ouvir a mensagem.
- [x] IDs, limite de texto, deduplicação e confirmação de encaminhamento.
- [ ] Fila de reprodução sem sobreposição, com pausar, repetir e descartar.
- [ ] Diferenciar encaminhamento, leitura e reprodução na interface/protocolo.
- [ ] Definir receptor da caixa de som e experiência dos participantes remotos.
- [ ] Escolha de voz `pt-BR`, velocidade, tom, teste e preferências locais.
- [ ] Garantir que reconectar não reproduza mensagens já ouvidas.

Aceite final: texto confirmado chega ao receptor correto, permanece legível com
voz desligada e pode ser reproduzido de forma controlada, sem sobreposição ou
envio involuntário de uma predição. A confirmação atual não comprova leitura.

## 5. Legendas do professor — finais implementadas, parciais futuras

- [x] Iniciar/parar captura por ação explícita e informar compartilhamento.
- [x] Compartilhar frases finalizadas apenas com alunos da mesma sala.
- [x] Tratar falhas de permissão e parar a captura na desconexão.
- [ ] Compartilhar parciais com IDs de segmento, substituindo-as pelo texto final.
- [ ] Impedir parciais atrasadas de sobrescrever finais e duplicação na reconexão.
- [ ] Testar aulas longas, pausas/reinícios, latência, erros e legibilidade.
- [ ] Evitar que a voz sintetizada na sala seja retranscrita pelo microfone.
- [ ] Oferecer tamanho de legenda, contraste e navegação no histórico da sessão.

Aceite final: legendas legíveis com parciais atualizadas e finais estáveis; parar
interrompe a captura; nenhum texto chega a outra sala. Reconhecimento de fala
depende do navegador e precisa de avaliação real com microfone.

## 6. Apoio em Libras — widget disponível, integração a evoluir

- [x] VLibras para seleção manual do texto exibido, preservando o original.
- [ ] Avaliar tradução com alunos surdos e profissionais de Libras.
- [ ] Integrar textos finais compartilhados, se a interface suportada permitir.
- [ ] Conferir controles/eventos disponíveis antes de prometer automação do avatar.
- [ ] Se viável, fila de frases finais, repetição, cancelamento e pular para a recente.
- [ ] Definir comportamento em falha e registrar termos inadequados das disciplinas.

Aceite: o texto permanece utilizável sem o widget. Fila e sincronização automática
são expectativas de evolução, não capacidades comprovadas da integração atual.

## 7. Reconhecimento por câmera — A–Z experimental, movimento como próxima etapa

- [x] Ampliar o modelo padrão para A–Z com duas bases e preservar o modelo antigo.
- [x] Preservar modelos pessoais, editor de texto e confirmação antes do envio.
- [x] Versionar artefatos, origem, licenças, scripts e resultados dos experimentos.
- [ ] Corrigir a captura temporal para preservar trajetória, tempo e posição relativa.
- [ ] Versionar o novo formato, sem reinterpretar ou apagar clipes/modelos antigos.
- [ ] Coletar clipes completos de movimentos, incluindo Ç e distinção de C.
- [ ] Conferir rótulos com pessoa fluente e incluir pausas/transições como negativos.
- [ ] Separar gravações e participantes antes de gerar variações de treino.
- [ ] Treinar modelo temporal e coordená-lo com o modelo por pose para evitar
  aceitar etapas intermediárias de um gesto como letras diferentes.
- [ ] Avaliar por letra com pessoas não usadas no treino, diferentes mãos,
  velocidades, iluminação, distância e enquadramento; melhorar as confusões.
- [ ] Medir letras repetidas, rejeição de desconhecidos e confiança na câmera.

Fotos isoladas podem descrever poses; movimentos exigem sequências ordenadas.
Coleta e treinamento são etapas distintas. Não há modelo temporal base distribuído;
H/J/K/X/Z no modelo atual são experimentais por pose e Ç ainda não está incluído.
A captura dinâmica centraliza a mão em cada quadro, removendo deslocamento global:
corrigir isso deve preceder a coleta. Métricas internas não representam acerto
independente na câmera. Detalhes em [TREINAMENTO_ALFABETO.md](TREINAMENTO_ALFABETO.md)
e, para o próximo trabalho, na descrição do PR.

O script do experimento A–Z tem instruções de reprodução. Os scripts históricos
anteriores ainda têm caminhos específicos e precisam de adaptação se reutilizados.

## 8. Histórico e dados — futuro

- [ ] Definir quais mensagens persistem, retenção e quem pode consultar/excluir.
- [ ] Integrar armazenamento autorizado com estados vazio, carregando e falha.
- [ ] Separar histórico de aula, preferências locais e amostras pessoais de treino.
- [ ] Não gravar áudio/vídeo sem requisito definido; permitir exclusão dos dados.

A página `History.tsx` e as tabelas legadas não comprovam persistência no aplicativo.
Aceite: registros reais seguem a política acordada e são inacessíveis a outra sala.

## 9. Acessibilidade, operação e publicação — parcial

- [x] Rolagem nativa e identidade visual com logo transparente e contorno branco.
- [x] Comandos independentes e atalho para iniciar site e servidor juntos.
- [ ] Testar teclado, foco, contraste, zoom e legibilidade com participantes.
- [ ] Medir CPU, memória, carregamento e banda no equipamento da faculdade.
- [ ] Configurar HTTPS/WSS, retorno Microsoft, origens, rotas diretas e assets.
- [ ] Revisar os datasets em `public/`, copiados pelo Vite para a publicação.
- [ ] Avaliar capacidade do processo único, suporte e necessidade de escala.
- [ ] Executar piloto acompanhado antes de ampliar o uso.

Aceite: cenários acordados passam no ambiente publicado com equipamentos reais.
A regularização do build não certifica implantação, precisão ou acessibilidade.

## 10. Aula híbrida/EAD — evolução preservada

O primeiro canal compartilhado já usa WebSocket para `student.message` e
`caption.final`, com `message.ack`/`message.rejected`. A evolução deve definir
segmentos e revisão de legendas, ordem e recuperação da sessão, estados de
reprodução e encerramento autorizado. Eventos como `caption.partial`,
`playback.status` e `session.closed` ainda são propostas.

A mídia WebRTC pode complementar esse canal no futuro, sem tornar câmera ou
microfone obrigatórios para texto. Não há videochamada ativa nesta entrega.
Preferências locais não são sincronização por conta; transmissão de texto não
comprova reprodução; seleção no VLibras não comprova controle automático do avatar.

Aceite final: participantes autorizados recebem texto confirmado; parciais viram
finais sem duplicação; voz não se sobrepõe; reconexão não repete falas concluídas;
legendas continuam acessíveis sem câmera, microfone ou avatar. Esses critérios
mantêm a direção do produto sem declarar concluídos os recursos futuros.

## Checklist para cada PR

- [ ] Branch, commits, título e labels seguem [BRANCHES.md](BRANCHES.md).
- [ ] Testes descritos com resultados e limitações, distinguindo simulação de uso real.
- [ ] Imports, entradas de compilação e usos indiretos conferidos.
- [ ] Documentação condiz com a entrega e preserva o resultado final planejado.
- [ ] Próximos passos do reconhecimento temporal registrados no PR.
- [ ] Revisão e verificações concluídas antes de integrar à `main`.
