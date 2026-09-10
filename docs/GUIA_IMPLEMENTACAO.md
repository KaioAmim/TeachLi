# Guia de implementação do TeachLi

Este roteiro descreve trabalho futuro, em ordem de dependência. As caixas abaixo
não representam funcionalidades já entregues. Dividir cada etapa em PRs pequenos
 e validar com a faculdade antes de ampliar o uso. As convenções completas estão
na [documentação técnica](../DOCUMENTACAO.md#labels-branches-e-commits).

## 1. Definir a primeira entrega com a faculdade

Branch sugerida: documentation/escopo-primeira-entrega. Label: documentation.
Commits: docs: descrição.

- [ ] Confirmar quem participa do piloto e quem valida a comunicação em Libras.
- [ ] Identificar o provedor de login institucional e como verificar o vínculo de professor.
- [ ] Definir quais equipamentos estarão disponíveis: notebooks, webcams,
  microfone do professor e computador conectado à caixa de som.
- [ ] Definir se o aluno entra como convidado por código ou por conta institucional.
- [ ] Definir o que será armazenado, por quanto tempo e como o usuário controla isso.
- [ ] Registrar os cenários de avaliação e os limites apresentados aos participantes.

Aceite: escopo aprovado pela equipe, responsáveis definidos e cenários de teste
reproduzíveis. Primeira entrega proposta: texto do aluno para áudio na sala e
fala do professor para legendas compartilhadas; câmera permanece experimental.

## 2. Implementar identidade e autorização

Branch: feature/autenticacao-institucional. Label: feature. Commits: feat(auth): descrição.

- [ ] Integrar o provedor institucional e substituir o fluxo Manus quando houver
  uma alternativa funcional validada.
- [ ] Representar aluno/professor e a origem da autorização no backend.
- [ ] Verificar o vínculo por informação confiável do provedor ou cadastro aprovado
  pela faculdade; o domínio do e-mail sozinho não distingue professor de aluno.
- [ ] Proteger criação/encerramento de aulas e acesso aos recursos da sala.
- [ ] Corrigir autorização das operações de sessão/tradução já existentes.

Aceite: professor autorizado entra; aluno não consegue se declarar professor;
usuário sem vínculo não acessa dados de outra sala; logout e expiração funcionam.
Criar testes de acesso permitido/negado no backend antes do piloto.

## 3. Criar salas e sessões de aula

Branch: feature/salas-compartilhadas. Label: feature. Commits: feat(salas): descrição.

- [ ] Separar sala física, sessão de aula e participação de usuário no schema.
- [ ] Criar migrações novas, preservando as anteriores.
- [ ] Implementar criar aula, listar/selecionar sala e entrar por código.
- [ ] Registrar participantes e papel do dispositivo receptor de áudio.
- [ ] Tratar código inválido/expirado, sala encerrada e saída do participante.
- [ ] Definir IDs de mensagens e sequência por sessão para evitar duplicatas.

Aceite: dois dispositivos entram na mesma aula; outra sala permanece isolada;
encerrar a aula bloqueia novas mensagens. Testar isolamento também pela API.

## 4. Transmitir texto do aluno para a caixa de som

Branch: feature/mensagens-aluno-audio. Label: feature. Commits: feat(mensagens): descrição.

- [ ] Implementar envio de texto para a sessão, com autoria e ID único.
- [ ] Implementar comunicação em tempo real e recuperação após reconexão.
- [ ] Definir um dispositivo receptor conectado à caixa de som da sala.
- [ ] Criar fila de reprodução nesse receptor, com confirmação de entrega.
- [ ] Permitir ao aluno revisar/corrigir o texto e confirmar o envio.
- [ ] Mostrar estados de envio, entrega, reprodução e falha.
- [ ] Oferecer ao receptor iniciar áudio, pausar, repetir ou descartar uma mensagem.

Aceite: a mensagem digitada em um notebook é falada no outro uma única vez;
dois alunos não geram falas sobrepostas; reconexão não repete mensagens já tocadas.
Testar a necessidade de interação inicial para habilitar áudio no navegador.

## 5. Compartilhar a fala do professor como legenda

Branch: feature/legendas-compartilhadas. Label: feature. Commits: feat(legendas): descrição.

- [ ] Iniciar o microfone por ação explícita, mostrar captura ativa e permitir pausa.
- [ ] Publicar transcrições parciais e finais com identificadores consistentes.
- [ ] Atualizar legendas nos dispositivos dos alunos da mesma aula.
- [ ] Tratar falta de permissão, ausência de fala, desconexão e fim da aula.
- [ ] Evitar que o áudio da caixa de som seja retranscrito como fala do professor.
- [ ] Avaliar reconhecimento no navegador com o equipamento real da sala.

Aceite: legenda final chega aos alunos sem duplicação; parciais são substituídas;
pausa interrompe a captura; mensagens de outra sala não aparecem. Registrar
latência e taxa de erros observadas, com critérios acordados na etapa 1.

## 6. Integrar a apresentação em Libras ao fluxo compartilhado

Branch: feature/libras-na-sala. Label principal: feature; UI/UX quando pertinente.
Commits: feat(libras): descrição.

- [ ] Validar com profissionais de Libras se a integração atual atende ao piloto.
- [ ] Usar o texto final compartilhado como origem, mantendo a legenda visível.
- [ ] Definir controles de leitura/repetição e o comportamento em falha do widget.
- [ ] Testar termos das disciplinas e registrar exemplos com tradução inadequada.
- [ ] Apresentar limites de forma compreensível aos participantes.

Aceite: texto original permanece acessível; falha do recurso de Libras não bloqueia
as legendas; a avaliação dos participantes determina o uso permitido no piloto.
O widget atual não deve ser documentado como geração de vídeos via uma API própria.

## 7. Evoluir o reconhecimento por câmera

Branch: enhancement/reconhecimento-gestos. Label: enhancement.
Commits: feat(modelo):, perf(modelo): ou refactor(modelo): conforme a mudança.

- [ ] Medir o modelo atual com pessoas que não participaram do treinamento.
- [ ] Registrar condições de iluminação, distância, enquadramento e mão utilizada.
- [ ] Coletar exemplos de transição, mão relaxada e gestos fora das classes.
- [ ] Implementar rejeição de gestos desconhecidos e calibração da confiança.
- [ ] Validar estabilidade, repetição de letras e formação do texto desejado.
- [ ] Permitir corrigir o texto reconhecido antes de enviar à fila da sala.
- [ ] Se o objetivo avançar para sinais dinâmicos, definir um novo dataset e uma
  abordagem temporal; não tratar letras estáticas como tradução de frases.
- [ ] Versionar modelo, rótulos, procedimento e resultados de avaliação juntos.

Aceite: métricas por classe em participantes separados do treino, exemplos de
falha documentados e ausência de reprodução involuntária de texto reconhecido.
O ganho de precisão deve ser medido; uma execução sem erro não demonstra acurácia.

## 8. Integrar histórico real e controles de dados

Branch: feature/historico-aulas. Label: feature. Commits: feat(historico): descrição.

- [ ] Substituir os exemplos fixos da página History por consultas reais autorizadas.
- [ ] Salvar mensagens/transcrições segundo o escopo definido com os participantes.
- [ ] Mostrar estados vazio, carregando e falha.
- [ ] Implementar encerramento, consulta e exclusão conforme a regra acordada.
- [ ] Evitar armazenamento de vídeo/áudio bruto sem necessidade definida para o piloto.

Aceite: dados persistem entre acessos autorizados; exemplos fictícios não aparecem
como aulas reais; participantes de outra sala não conseguem consultar o histórico.

## 9. Validar acessibilidade, operação e publicação

Separar PRs: ui-ux/acessibilidade (UI/UX) e maintenance/deploy-piloto (maintenance).

- [ ] Testar navegação por teclado, foco, contraste, zoom e legendas legíveis.
- [ ] Testar várias pessoas, reconexão e encerramento da aula.
- [ ] Medir consumo de CPU e tempo de carregamento do modelo em notebooks reais.
- [ ] Validar build e hospedagem do servidor/API; revisar vercel.json se esse for
  o destino escolhido, sem pressupor que a configuração herdada funciona.
- [ ] Configurar segredos no ambiente de hospedagem, sem colocá-los em commits.
- [ ] Preparar instruções de uso para professor e aluno e um procedimento de suporte.
- [ ] Executar o piloto acompanhado e registrar os problemas encontrados.

Aceite: os cenários das etapas anteriores passam no ambiente publicado e os
participantes conseguem usar o sistema com os equipamentos da faculdade.

## Checklist para cada PR

- [ ] Branch segue o prefixo da label principal documentada.
- [ ] Título e commits correspondem às labels efetivamente aplicadas no GitHub.
- [ ] pnpm check:conventions --labels <labels-separadas-por-virgula> --base origin/main passa.
- [ ] pnpm check, pnpm test e pnpm build passam.
- [ ] Testes funcionais adequados à mudança foram executados e descritos.
- [ ] Diff não inclui .env, node_modules, dist, backups ou intermediários de treino.
- [ ] Arquivos removidos tiveram imports e usos indiretos conferidos.
- [ ] README, DOCUMENTACAO.md e este guia refletem o comportamento entregue.
- [ ] Revisão e merge em main ocorrem depois das verificações.
