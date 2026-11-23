# Guia de implementação do TeachLi

Atualizado em 19/11/2026. Os detalhes técnicos estão na [documentação técnica](DOCUMENTACAO.md); as convenções de branch e commit, no fim deste guia.
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
- [x] Remover o backend e as integrações herdadas do template anterior (Manus).
- [x] Manter TypeScript no comando completo de build, antes do Vite.
- [x] Telas antigas sem rota (`TrainGestures`, `NotFound`) e componentes de UI sem uso foram removidos (histórico do Git).

Os pacotes atuais são `client/` e `server/`; o `package.json` da raiz só expõe o
atalho `npm run dev:classroom`.
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

- [x] Login Microsoft existente, com Tenant ID da instituição obrigatório, PKCE, `state` e nonce.
- [x] Restringir o login ao tenant configurado (cliente confere `tid`; servidor recusa outro tenant).
- [ ] Confirmar se as contas de alunos (`@alunos.unibarretos.com.br`) pertencem ao mesmo
  tenant dos professores; se não, o GUID único as bloqueia e a restrição precisa ser revista.
- [ ] Confirmar no Entra o registro SPA com os URIs `/entrar` e testar um login real.
- [x] Verificar token no servidor antes da comunicação; definir autoria e papel.
- [x] Aplicar domínios de aluno/professor; rejeitar perfil forjado e conta externa.
- [x] Testar expiração, logout e isolamento com identidades de teste.
- [ ] Conferir o login com contas institucionais reais no ambiente do piloto.
- [ ] Avaliar com a faculdade a administração do aplicativo Microsoft e eventual
  política de vínculo, grupos ou funções de docentes.

**O Tenant ID da faculdade é obrigatório e restringe o login a esse tenant; novo cadastro
de docentes não é exigido nesta entrega.** A regra atual por domínio não prova administrativamente a função de
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

Estado atual em memória, uma instância; sem histórico persistente. A chamada de
vídeo e áudio usa WebRTC ponto a ponto com sinalização pelo servidor de salas
(mensagem `signal`: `hello`, `offer`, `answer`, `candidate`, `bye`). O professor
sempre cria a oferta. Pendentes: validar com contas e dispositivos reais, avaliar
TURN institucional (`VITE_TURN_URL`), banda para uma turma inteira (cada aluno é
uma conexão do professor) e a tradução automática no VLibras, que não tem API
documentada. WebSocket conectado não comprova conexão de mídia.

## 4. Texto do aluno e voz — envio implementado, reprodução avançada futura

- [x] Digitar ou compor por gestos, editar e enviar; a composição por gestos segue ao professor
  automaticamente após uma pausa (desligável), sem botão durante o sinal.
- [x] Letras estáveis entram sozinhas, sem espaços entre elas, com regra de repetição (soltar o gesto),
  rejeição de transições, pausa para correção, espaço, apagar e preservação ao reiniciar a câmera.
- [x] Enter envia texto digitado; Shift+Enter insere linha; ouvir é ação separada e só quando solicitada.
- [ ] Calibrar com alunos os tempos de pausa (palavra 1,5 s, envio 3,5 s) e a regra de repetição.
- [ ] Testes específicos de estabilidade, repetição intencional (LL, RR), transições e correções com câmera real.
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

- [x] Widget VLibras disponível em todas as telas para seleção manual do texto exibido, preservando o original.
- [ ] Avaliar tradução com alunos surdos e profissionais de Libras.
- [ ] Integrar textos finais compartilhados, se a interface suportada permitir.
- [ ] Conferir controles/eventos disponíveis antes de prometer automação do avatar.
- [ ] Se viável, fila de frases finais, repetição, cancelamento e pular para a recente.
- [ ] Definir comportamento em falha e registrar termos inadequados das disciplinas.

Aceite: o texto permanece utilizável sem o widget. Fila e sincronização automática
são expectativas de evolução, não capacidades comprovadas da integração atual.

## 7. Reconhecimento por câmera — A–Z experimental, movimento como próxima etapa

- [x] Ampliar o modelo padrão para A–Z com duas bases e preservar o modelo antigo.
- [x] Modelo base de 178 sinais em movimento (Libras-EQT-UECE); avaliado com informante inédito
  (71,7–85,0% no 1º palpite, 92,9–97,6% no top-5 em clipes isolados).
- [x] Expressões faciais gramaticais (pergunta, dúvida, surpresa, negação, certeza) a partir de sobrancelhas e
  movimento da cabeça, opcionais e sem tráfego de imagem ao servidor.
- [x] Sem desenho de traços sobre as mãos.
- [ ] Confirmar origem e licença do Libras-EQT-UECE antes de redistribuir o modelo.
- [ ] Calibrar as expressões com sinalizantes (ex.: dataset UCI de expressões faciais gramaticais).
- [ ] Classe "nenhum sinal" e avaliação em fala contínua para o modelo dinâmico base.
- [ ] Ampliar vocabulário com MINDS-Libras e V-LIBRASIL (exigem extração de landmarks).
- [x] Preservar modelos pessoais, editor de texto e confirmação antes do envio.
- [x] Versionar artefatos, origem, licenças, scripts e resultados dos experimentos.
- [x] Preservar a posição global do pulso junto aos landmarks de cada mão na captura temporal.
- [x] Versionar clipes e modelo temporal v2; manter o formato antigo sem reinterpretá-lo.
- [x] Importar vídeos locais V-Librasil para treino experimental de sinais isolados.
- [x] Importar o CSV VLibrasBD como referência de glossa e sugestão aproximada de frase.
- [ ] Coletar clipes completos de movimentos, incluindo Ç e distinção de C.
- [ ] Conferir rótulos com pessoa fluente e incluir pausas/transições como negativos.
- [ ] Separar gravações e participantes antes de gerar variações de treino.
- [ ] Treinar modelo temporal e coordená-lo com o modelo por pose para evitar
  aceitar etapas intermediárias de um gesto como letras diferentes.
- [ ] Avaliar por letra com pessoas não usadas no treino, diferentes mãos,
  velocidades, iluminação, distância e enquadramento; melhorar as confusões.
- [ ] Medir letras repetidas, rejeição de desconhecidos e confiança na câmera.

Fotos isoladas podem descrever poses; movimentos exigem sequências ordenadas.
Coleta e treinamento são etapas distintas. H/J/K/X/Z no modelo de letras são experimentais por pose e
Ç ainda não está incluído. A captura temporal v2 preserva também o pulso no quadro, mas ainda não considera a postura do
tronco (as expressões faciais entram só como marcação, não no classificador de sinais). Nos testes com o dataset UECE,
acrescentar a trajetória piorou o acerto com pessoas novas, então isso precisa de nova análise. Métricas internas não
representam acerto independente na câmera. Detalhes e reprodução na
[documentação técnica](DOCUMENTACAO.md#5-reconhecimento-e-treinamento).

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

A chamada WebRTC complementa esse canal sem tornar câmera ou microfone obrigatórios
para texto; é opcional e começa só quando a pessoa clica em entrar na chamada.
Preferências locais não são sincronização por conta; transmissão de texto não
comprova reprodução; seleção no VLibras não comprova controle automático do avatar.

Aceite final: participantes autorizados recebem texto confirmado; parciais viram
finais sem duplicação; voz não se sobrepõe; reconexão não repete falas concluídas;
legendas continuam acessíveis sem câmera, microfone ou avatar. Esses critérios
mantêm a direção do produto sem declarar concluídos os recursos futuros.

## Checklist para cada PR

- [ ] Branch, commits, título e labels seguem as [convenções abaixo](#convenções-de-branch-label-e-commit).
- [ ] Testes descritos com resultados e limitações, distinguindo simulação de uso real.
- [ ] Imports, entradas de compilação e usos indiretos conferidos.
- [ ] Documentação condiz com a entrega e preserva o resultado final planejado.
- [ ] Próximos passos do reconhecimento temporal registrados no PR.
- [ ] Revisão e verificações concluídas antes de integrar à `main`.

## Convenções de branch, label e commit

### Escolher o tipo de trabalho

| Label principal | Branch | Tipos de commit | Exemplo |
| --- | --- | --- | --- |
| `feature` | `feature/descricao` | `feat` | `feature/legendas-compartilhadas` |
| `bug` | `bug/descricao` | `fix` | `bug/repeticao-audio` |
| `documentation` | `documentation/descricao` | `docs` | `documentation/guia-instalacao` |
| `enhancement` | `enhancement/descricao` | `feat`, `perf`, `refactor` | `enhancement/estabilidade-gestos` |
| `maintenance` | `maintenance/descricao` | `chore`, `refactor`, `build`, `ci`, `test` | `maintenance/atualizar-dependencias` |
| `UI/UX` | `ui-ux/descricao` | `style`, `feat`, `fix` | `ui-ux/contraste-botoes` |

Use `feature` para funcionalidade nova, `bug` para comportamento incorreto, `documentation` para guias,
`enhancement` para melhorias existentes, `maintenance` para infraestrutura e `UI/UX` para interface e interação.
Preserve a grafia `UI/UX` na label; a branch usa `ui-ux/`. A descrição da branch é curta, em minúsculas, sem acentos
ou espaços, com hífens; evite `nova-versao` ou `teste`. Não há `develop` nem branch por versão: cada mudança parte da
`main` atual e volta por pull request.

### Commits e título do PR

Formato `tipo(escopo-opcional): descrição`, por exemplo `feat(sala): compartilhar legendas do professor`,
`fix(audio): evitar reprodução duplicada`, `docs: atualizar instruções de instalação`. O título do PR usa o mesmo
formato; a label principal corresponde ao prefixo da branch, e labels secundárias permitem os tipos adicionais da
tabela (uma branch `maintenance/atualizar-guias` com `maintenance,documentation` aceita `chore` e `docs`). Informe só
labels de classificação desta tabela. Tags Git identificam versões e não substituem labels; a política de releases
será definida à parte.

### Fluxo completo

> **Não trabalhe diretamente na `main`.** Crie uma branch, abra um Pull Request e faça o merge só depois de revisar
> as alterações e verificar os testes.

```bash
git switch main
git pull --ff-only origin main
git switch -c documentation/guia-instalacao
git add README.md docs/arquivo.md
git commit -m "docs: atualizar instruções de instalação"
git fetch origin
git push -u origin documentation/guia-instalacao
```

No GitHub, abra o PR para `main`, aplique as labels, preencha o modelo e revise alterações e verificações; resolva
conflitos e repita as verificações afetadas antes de integrar. Nunca use force push na `main`. Os antigos scripts de
convenções e templates `.github/` não estão presentes nesta cópia: revise título, labels, diff e testes manualmente.
