# Guia de implementação do TeachLi

Este roteiro recupera a proposta de `maintenance/limpeza-estrutura-documentacao`
e a adapta à `main` em `5cf6d3c`. “Implementado” significa presente no código;
não significa validado com usuários reais. Os itens abaixo são prioridades
propostas e critérios de aceite, não compromissos aprovados para um piloto.
As convenções estão em [BRANCHES.md](BRANCHES.md).

O resumo `TeachLi.txt` enviado pelo usuário acrescenta uma prioridade: conectar
professor e aluno por texto compartilhado, preservando correção/confirmação do
aluno e legendas legíveis. A referência à ausência de WebRTC no resumo é
histórica; a videochamada já existe na base atual. A sequência proposta é definir
o protocolo de texto, integrar transcrições parciais/finais, criar o painel de
mensagens do professor e preferências de voz, e então validar o controle do
avatar. Os números abaixo organizam áreas de trabalho, não uma dependência
obrigatória de concluir todo o sistema antes de experimentar o fluxo de texto.

O usuário esclareceu que “modelo híbrido” se refere a **aula EAD**, abrangendo
participação remota e sua combinação com a sala presencial. O guia
[MODELO_HIBRIDO.md](MODELO_HIBRIDO.md) descreve essa proposta. A implementação
deve testar comunicação entre dispositivos e redes diferentes; voz na caixa de
som da sala física não substitui acesso ao texto para quem está remoto.

## 0. Regularizar o cliente independente — bloqueio técnico confirmado

Branch: `maintenance/regularizar-build-client`. Label: `maintenance`.

`npm ci` em `client/` passou, mas `npm run typecheck` falhou na base funcional
inalterada. O `tsconfig` inclui toda a pasta `src`, incluindo arquivos legados
com dependências ausentes no pacote independente (`@trpc/client`, `@radix-ui/*`),
alias `@shared` não configurado e exports incompatíveis (`buttonVariants`,
`LIBRAS_GESTURES`). `npm run build` também falhou no TypeScript após a cópia dos
WASM. O teste de desenvolvimento iniciou o Vite, mas encontrou
`@radix-ui/react-dialog` não resolvido em `components/ui/dialog.tsx`, alcançado
pela interface ativa. Assim, a correção é necessária também para validar o uso
local, antes de publicar ou ampliar a aplicação.

Os testes foram feitos com Node.js 18.19.1/npm 9.2.0. O Node.js 22 recomendado
nos guias não estava disponível e precisa entrar na validação da correção;
trocar a versão não foi demonstrado como solução para imports/exports ausentes.

- [ ] Mapear fontes da aplicação independente e do caminho legado sem remover
  arquivos por estarem fora das rotas apenas.
- [ ] Definir a fronteira de compilação e corrigir imports, exports e dependências
  de acordo com os usos comprovados; manter lockfiles coerentes.
- [ ] Não silenciar erros ou excluir arquivos arbitrariamente para obter build verde.
- [ ] Executar `npm ci`, `npm run typecheck` e `npm run build` em ambiente limpo
  do cliente, usando a versão de Node recomendada, e conferir a saída e os fluxos ativos.
- [ ] Executar `npm run dev` e abrir a interface, confirmando que não há erro de
  dependência ativa; iniciar o processo sozinho não satisfaz o teste de uso.

Aceite: instalação, tipos e build passam com configuração coerente; eventuais
limites do legado ficam documentados. Os cinco testes de convenções, a CLI e a
checagem sintática do servidor já passaram nesta revisão, mas não comprovam esse
aceite. A correção funcional não faz parte da recuperação de documentação.

## 1. Definir e validar o piloto — futuro

Branch sugerida: `documentation/escopo-primeira-entrega`. Label: `documentation`.

- [ ] Confirmar participantes, equipamentos e responsáveis pela avaliação em Libras.
- [ ] Definir entrada como convidado ou conta institucional e autorização de professor.
- [ ] Definir dados armazenados, retenção, exclusão e informação aos participantes.
- [ ] Acordar cenários, métricas e limites do piloto antes de ampliar o uso.
- [ ] Incluir cenários EAD e de participação presencial/remota, definindo quem
  recebe cada mensagem e quais recursos funcionam sem câmera ou com voz desativada.

Aceite: escopo documentado com responsáveis e cenários reproduzíveis. A digitação
com voz local pode ser avaliada já; texto para um receptor remoto e legendas
compartilhadas ainda exigem implementação.

## 2. Identidade e autorização — futuro

Branch: `feature/autenticacao-institucional`. Label: `feature`.

A sala atual aceita o papel informado na URL. OAuth Manus e papéis `user/admin`
existem na infraestrutura legada, mas não autenticam a Sala de Aula independente.

- [ ] Integrar um provedor aprovado e verificar o vínculo de professor no servidor.
- [ ] Autorizar criação, participação e encerramento de aulas.
- [ ] Se a API de sessões for reutilizada, verificar a associação do usuário em
  toda consulta/alteração de sessão ou tradução.
- [ ] Testar expiração, logout e acesso permitido/negado entre participantes e salas.

Aceite: um aluno não consegue assumir papel de professor por parâmetro de URL;
dados de outra sala ficam inacessíveis. Domínio de e-mail sozinho não prova papel.

## 3. Salas e videochamada — parcial

Branch para evolução: `enhancement/salas-compartilhadas`. Label: `enhancement`.

**Implementado:** código de sala, entrada por nome/papel, um professor por sala,
alunos associados ao professor, chamada WebRTC em estrela e aviso quando o
professor sai. O estado reside na memória de `server/index.mjs`.

- [ ] Definir sala, sessão e participação persistentes se o piloto exigir histórico.
- [ ] Implementar reconexão e recuperação explícita de estado.
- [ ] Validar a proposta de WebSocket de aplicação para texto e WebRTC para mídia;
  DataChannel é alternativa, e a sinalização atual não implementa mensagens de texto.
- [ ] Permitir participação apenas por texto sem exigir câmera e microfone,
  mantendo a chamada de mídia como recurso separado.
- [ ] Melhorar estados de falha: sinalização conectada não comprova mídia conectada.
- [ ] Avaliar TURN em redes restritivas e capacidade de banda com vários alunos.
- [ ] Definir encerramento autorizado e impedir mensagens após saída/encerramento.

Aceite: duas máquinas entram na mesma aula, falhas são compreensíveis e outras
salas permanecem isoladas. Medir em redes reais; não declarar capacidade de turma
apenas por funcionar com duas abas.

## 4. Texto do aluno para áudio — local implementado, compartilhamento futuro

Branch: `feature/mensagens-aluno-audio`. Label: `feature`.

**Implementado:** digitar, revisar e falar no próprio navegador, por botão ou
Enter; Shift+Enter cria nova linha. Não há envio desse texto na videochamada.

- [ ] Criar protocolo de mensagens com autoria, IDs e ordenação por sessão.
- [ ] Criar painel do professor com mensagem confirmada, autor e estado de entrega.
- [ ] Definir o receptor conectado à caixa de som e fila de reprodução.
- [ ] Definir entrega de texto e leitura opcional para participantes remotos;
  não depender apenas do áudio emitido na sala física.
- [ ] Mostrar envio, entrega, reprodução e falha; tratar reconexão sem duplicação.
- [ ] Oferecer ao receptor iniciar áudio, pausar, repetir e descartar mensagens.
- [ ] Criar editor para corrigir o reconhecimento e confirmar explicitamente o
  texto antes do envio; preservar a revisão da digitação e oferecer vocabulário
  inicial limitado, validado com participantes.
- [ ] Listar vozes disponíveis, priorizar `pt-BR`, permitir velocidade/tom e teste;
  tratar carregamento assíncrono e voz salva indisponível.
- [ ] Definir persistência das preferências: local por navegador inicialmente ou
  por usuário quando identidade/sincronização estiverem implementadas.

Aceite: mensagem digitada em um dispositivo é falada uma vez no receptor;
mensagens de alunos não se sobrepõem e uma reconexão não repete falas concluídas.
Validar também as políticas de reprodução de áudio do navegador.
O painel deve continuar legível com voz desativada, e o aluno não pode enviar
involuntariamente uma predição ainda não confirmada.

## 5. Legendas da fala do professor — futuro

Branch: `feature/legendas-compartilhadas`. Label: `feature`.

`ProfessorMode.tsx` tem transcrição local, mas não está nas rotas atuais. A sala
WebRTC não publica legendas. Reutilização desse código exige integração explícita.

- [ ] Iniciar/pausar microfone por ação clara e mostrar o estado da captura.
- [ ] Transmitir transcrições parciais/finais com IDs e atualização sem duplicação.
- [ ] Substituir parciais do mesmo trecho e fixar a versão final no histórico
  compartilhado; identificar ordem e remetente para reconexão.
- [ ] Tratar permissões, desconexão, ausência de fala e encerramento.
- [ ] Evitar retranscrever o áudio sintetizado no receptor da turma.
- [ ] Medir legibilidade, latência e erros no equipamento real.
- [ ] Testar aulas longas e o ciclo iniciar/pausar/reiniciar ao integrar o código
  legado, reproduzindo eventuais falhas antes de afirmar uma causa.
- [ ] Oferecer tamanho de legenda, alto contraste e histórico rolável.

Aceite: alunos da mesma sala recebem o texto final; parciais são substituídas;
pausar interrompe captura; nenhuma legenda aparece em outra sala.

## 6. Apresentação em Libras — widget local implementado, integração parcial

Branch: `feature/libras-na-sala`. Label: `feature`; `UI/UX` quando pertinente.

**Implementado:** opção VLibras em Digitar e Ouvir, com seleção do texto visível
no widget. Não há API própria de vídeo nem conexão com legendas compartilhadas.

- [ ] Avaliar tradução com usuários surdos e profissionais de Libras.
- [ ] Integrar textos finais compartilhados sem esconder o original.
- [ ] Verificar quais controles/eventos a integração VLibras suporta antes de
  prometer alimentação automática, conclusão ou cancelamento de uma frase.
- [ ] Se os controles necessários forem comprovados, implementar fila de frases
  finais e opção de pular para a mais recente; caso contrário, manter seleção
  manual do texto no widget e registrar essa limitação.
- [ ] Definir repetição e comportamento quando o serviço externo falhar.
- [ ] Registrar termos e exemplos das disciplinas com tradução inadequada.

Aceite: a legenda permanece utilizável sem o widget; a avaliação do piloto define
em quais situações a tradução pode apoiar a comunicação.
Fila e sincronização com avatar são propostas; o wrapper atual não as implementa
nem comprova disponibilidade de uma API externa para controlá-las.

## 7. Reconhecimento por câmera — implementado, validação e dados pendentes

Branch: `enhancement/reconhecimento-gestos`. Label: `enhancement`.

**Implementado:** 15 letras estáticas no modelo base, modelos pessoais, confiança
e margem para filtrar predições, treino estático e classificador dinâmico Conv1D.
A arquitetura temporal já existe; falta dataset de palavras integrado e validado.

- [ ] Avaliar por classe com participantes separados dos usados no treino.
- [ ] Medir condições de iluminação, mão, distância e enquadramento.
- [ ] Coletar exemplos negativos e avaliar rejeição de gestos desconhecidos.
- [ ] Verificar letras repetidas, estabilidade e correção antes do envio à sala.
- [ ] Avaliar dados dinâmicos com licença e consentimento adequados antes de integrar.
- [ ] Tornar o pipeline Python portátil, incluindo arquivos usados nas sondas.
- [ ] Versionar modelo, rótulos, dados permitidos e resultados de avaliação juntos.

Aceite: métricas e falhas documentadas, sem afirmar precisão de webcam a partir
apenas do treino. Ver [MODELO.md](MODELO.md) e [DATASETS.md](DATASETS.md).

## 8. Histórico e controles de dados — futuro

Branch: `feature/historico-aulas`. Label: `feature`.

O histórico de gestos atual dura a página. A página `History.tsx` legada tem
exemplos e não está nas rotas; a API legada não comprova persistência da sala.

- [ ] Definir quais mensagens serão persistidas e quem pode consultar/excluir.
- [ ] Implementar integração autorizada e estados vazio, carregando e falha.
- [ ] Aplicar retenção e exclusão; evitar gravar áudio/vídeo sem requisito definido.

Aceite: dados reais persistem só conforme a regra acordada; exemplos fictícios
não aparecem como aulas, e participantes de outra sala não conseguem consultá-los.

## 9. Acessibilidade, operação e publicação — parcial

Separar `ui-ux/acessibilidade` (label `UI/UX`) e `maintenance/deploy-piloto`
(label `maintenance`).

**Configurado:** comandos independentes de desenvolvimento/build do cliente e
início do servidor. A falha de tipos descrita na etapa 0 impede considerar o build
regularizado. Publicação, acessibilidade e desempenho exigem validação própria.

- [ ] Concluir `maintenance/regularizar-build-client` antes de publicar.
- [ ] Testar teclado, foco, contraste, zoom, áudio e legendas legíveis.
- [ ] Medir CPU, memória, carregamento e banda com o equipamento da faculdade.
- [ ] Validar HTTPS/WSS, rotas diretas e caminhos de assets na hospedagem escolhida.
- [ ] Examinar conteúdo de `client/public/` antes de publicar; imagens brutas ainda
  estão nessa pasta, e o build do Vite as copia.
- [ ] Preparar suporte e executar piloto acompanhado, registrando problemas.

Aceite: cenários acordados passam no ambiente publicado com os dispositivos reais.

## Checklist para cada PR

- [ ] Branch, commits, título e labels seguem [BRANCHES.md](BRANCHES.md).
- [ ] Verificador de convenções executado na raiz com labels propostas:
  `node scripts/check-conventions.mjs --labels <labels-separadas-por-virgula> --base origin/main`.
- [ ] Antes de haver commits novos, usar `--title "tipo: descrição"` para validar a proposta.
- [ ] `npm run typecheck` e `npm run build` executados em `client/` quando pertinentes.
- [ ] Testes funcionais adequados à mudança descritos, com limitações explícitas.
- [ ] Diff revisado para não incluir credenciais, dependências locais, build ou intermediários.
- [ ] Remoções conferidas contra imports, configurações e usos indiretos.
- [ ] Documentação atualizada e revisão do subagente concluída conforme `AGENTS.md`.
- [ ] Verificações e revisão concluídas antes do merge em `main`.
