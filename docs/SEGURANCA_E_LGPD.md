# Segurança e LGPD — TeachLi

> Documento técnico de apoio. Descreve medidas técnicas e propostas de enquadramento.
> **Não é parecer jurídico nem declara o sistema "adequado" ou "certificado" à LGPD
> (Lei nº 13.709/2018).** Conformidade exige também medidas organizacionais e jurídicas:
> bases legais, política oficial, papéis (controlador, operador, encarregado) e revisão do
> encarregado/jurídico da UniBarretos. Itens marcados **[revisão jurídica]** dependem disso.

## 1. Arquitetura de segurança

| Camada | Medida | Onde |
| --- | --- | --- |
| Autenticação | Login Microsoft (OIDC + PKCE, `state`, nonce), restrito ao tenant institucional (obrigatório) | `client/src/lib/microsoftAuth.ts` |
| Verificação no servidor | Assinatura RS256, emissor, audiência, tenant, validade e `oid` do token | `server/microsoft.mjs` |
| Autorização | Papel (aluno/professor) por domínio do e-mail, conferido no servidor em toda sessão, conexão e mensagem; aluno só envia `student.message`, professor só `caption.final` | `server/classrooms.mjs` |
| Sessão | Token opaco aleatório (256 bits), em memória, validade de até 1 h, revogação no logout | `server/classrooms.mjs` |
| Abuso | 30 logins/min por IP, 60 mensagens/10 s por conexão, 20 conexões por IP, 10.000 sessões, corpo ≤ 32 KB, mensagem ≤ 2.000 caracteres | `server/classrooms.mjs` |
| Origem/CORS | Lista exata de origens (`TEACHLI_CORS_ORIGIN`), também no WebSocket | `server/classrooms.mjs` |
| Cabeçalhos HTTP | `nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`, CSP restritiva, HSTS, `no-store` | `server/classrooms.mjs` |
| CSP do site | `Content-Security-Policy` injetada no build, limitando scripts, conexões e frames às origens usadas | `client/vite.config.ts` |
| Auditoria | Eventos JSON sem token, e-mail ou nome (usuário = hash curto do ID) | `server/classrooms.mjs` |
| Segredos | Nenhum segredo no frontend; `client/.env.local` fora do Git; só Client ID e Tenant ID públicos | `.gitignore` |

Fora do escopo do código: HTTPS/WSS obrigatório, firewall, backups e monitoramento dependem da
hospedagem (seções 7 e 8).

## 2. Mapeamento de dados pessoais

| Dado | Origem | Onde fica | Finalidade | Retenção | Compartilhamento |
| --- | --- | --- | --- | --- | --- |
| Nome, e-mail institucional, ID Microsoft (`tid`/`oid`) | Token Microsoft | Navegador (`sessionStorage`) e memória do servidor de salas | Identificar e autorizar aluno/professor | Até o fim da sessão (até 1 h) | Microsoft (provedor de identidade) |
| Mensagens do aluno e legendas do professor | Digitação, voz, gestos | Memória do servidor, só durante o envio | Comunicação acessível em sala | Não persistidas | Participantes da mesma sala |
| Áudio do professor | Microfone | Reconhecimento de fala do navegador | Gerar legendas | Não gravado pelo TeachLi; o navegador pode usar serviço próprio de fala **[revisão jurídica]** | Fornecedor do navegador |
| Imagem da câmera e pontos das mãos (landmarks) | Câmera do aluno | Processados no navegador; amostras de treino em `localStorage`/IndexedDB | Reconhecer gestos de Libras | Até o aluno clicar em **Limpar** ou limpar o navegador | Não enviados ao servidor |
| Eventos de auditoria | Servidor | Saída padrão do processo | Segurança e investigação | A definir (sugestão: 90 dias) | Operador de infraestrutura |

Não há banco de dados nem upload de arquivos. O backend herdado (Express/tRPC/MySQL, tabelas
`users`, `sessions`, `translations`, `gestures`) foi removido do repositório.

## 3. Bases legais — proposta **[revisão jurídica]**

Consentimento não é base universal; sugestão por finalidade:

- **Login e autorização (nome, e-mail, ID):** execução de contrato ou procedimentos preliminares
  com o aluno, ou vínculo com o docente (art. 7º, V), ou legítimo interesse de segurança (art. 7º, IX).
- **Mensagens e legendas em sala:** execução do serviço educacional e acessibilidade
  (art. 7º, V). Sem armazenamento, o risco é baixo.
- **Pontos das mãos e imagem para reconhecimento de gestos:** podem configurar dado de
  característica física. Se tratados como biométricos, são **sensíveis** (art. 5º, II; art. 11).
  Hoje o processamento é local e não identifica o titular, mas é preciso decidir com o encarregado
  se há tratamento pela instituição e, se houver, qual hipótese do art. 11 se aplica (por exemplo,
  consentimento específico e destacado). Alternativa menos invasiva: manter 100 % local e opcional
  (já é assim; o treino é opcional).
- **Auditoria:** legítimo interesse de segurança (art. 7º, IX) e prevenção à fraude.

## 4. Direitos dos titulares (art. 18)

| Direito | Como atender hoje |
| --- | --- |
| Acesso e confirmação | Os dados de sessão são só nome e e-mail do próprio titular; as amostras de treino ficam visíveis ao aluno na tela de treino |
| Eliminação | O aluno apaga amostras e modelo em **Treinar gestos → Limpar**; o servidor não guarda mensagens |
| Correção | Nome e e-mail vêm da conta Microsoft institucional (corrigir na origem) |
| Informação sobre compartilhamento | Seção 2 e política de privacidade (seção 9) |
| Portabilidade e demais | Canal do encarregado **[a definir pela instituição]** |

A eliminação pode ter exceções legais de guarda (art. 16); os dados do TeachLi não se enquadram
nelas hoje, pois não são persistidos no servidor.

## 5. Matriz de permissões

| Ação | Aluno | Professor | Anônimo |
| --- | --- | --- | --- |
| Entrar com conta Microsoft institucional | Sim (`@alunos.unibarretos.com.br`) | Sim (`@unibarretos.com.br`) | Não |
| Listar salas | Sim | Sim | Não |
| Entrar em sala | Sim | Sim (uma sala aceita um só professor) | Não |
| Enviar mensagem (`student.message`) | Sim | Não | Não |
| Enviar legenda (`caption.final`) | Não | Sim | Não |
| Treinar e apagar gestos locais | Sim | — | Não |

Limitação: não existem papéis de gestor ou administrador; o papel de professor é atribuído pelo
domínio do e-mail, não por cadastro no Entra (ver `docs/GUIA_IMPLEMENTACAO.md`).

## 6. Política de retenção

- Sessão do servidor: no máximo 1 h ou até o logout; perdida ao reiniciar o servidor.
- Mensagens e legendas: não retidas.
- Dados locais de treino: até o aluno limpar; recomenda-se limpar em computadores compartilhados.
- Logs de auditoria: sugestão de 90 dias, com acesso restrito e rotação pelo operador **[definir]**.

## 7. Plano de backup e recuperação

Não há dados persistentes a restaurar. Recuperar o serviço significa reimplantar o código e as
variáveis (`MICROSOFT_TENANT_ID`, `MICROSOFT_CLIENT_ID`, `TEACHLI_CORS_ORIGIN`) a partir de um cofre
de segredos da instituição. Os usuários entram novamente após o reinício. Guardar a configuração do
Entra (URIs de retorno) e os logs de auditoria conforme a política de retenção.

## 8. Resposta a incidentes (rascunho)

1. **Detectar e conter:** revogar sessões (reiniciar o servidor de salas), rotacionar o Client ID
   se houver suspeita de vazamento de configuração, restringir origens.
2. **Avaliar:** quais dados foram afetados (seção 2), por quanto tempo, quantos titulares.
3. **Comunicar:** encarregado e jurídico avaliam a comunicação à ANPD e aos titulares em caso de
   risco ou dano relevante (art. 48), no prazo regulamentado pela ANPD.
4. **Registrar e corrigir:** causa raiz, correção, lições aprendidas, atualização deste documento.

## 9. Política de privacidade — texto-base **[revisão jurídica]**

O TeachLi apoia a comunicação em sala de aula na UniBarretos. Usamos sua conta institucional
Microsoft para confirmar quem você é (nome, e-mail e identificador) e se você é aluno ou professor.
Mensagens e legendas passam pelo servidor apenas para chegar aos participantes da sala e não são
gravadas. O reconhecimento de gestos acontece no seu navegador: imagens da câmera e pontos das
mãos não são enviados ao servidor, e as amostras de treino ficam salvas só no seu dispositivo até
você apagá-las. Você pode pedir informações sobre seus dados e exercer seus direitos pelo canal
do encarregado **[inserir contato]**.

## 10. Registro das operações de tratamento (art. 37)

O resumo está nas seções 2 e 3. O registro formal (controlador, operador, encarregado, finalidades,
bases, categorias, compartilhamento, retenção e medidas de segurança) deve ser preenchido pela
instituição com esses dados.

## 11. RIPD

Recomenda-se elaborar o Relatório de Impacto, por haver possível tratamento de dado sensível
(imagem e características físicas) e uso de reconhecimento por câmera em ambiente educacional, com
possíveis titulares vulneráveis. Pontos a tratar: necessidade e proporcionalidade, alternativas
(texto e voz já existem), processamento local, ausência de envio ao servidor e eliminação pelo titular.

## 12. Relatório de vulnerabilidades (auditoria de 11/11/2026)

| ID | Gravidade | Achado | Situação |
| --- | --- | --- | --- |
| A1 | Alta | IDOR nas rotas tRPC de sessão e tradução | **Corrigido** (backend legado removido) |
| A2 | Alta | Cookie `SameSite=None` de 1 ano, sem CSRF/CORS no legado | **Corrigido** (removido) |
| A3 | Alta | Corpo de 50 MB sem rate limit no legado | **Corrigido** (removido) |
| A4 | Alta | Rate limit por IP contornável atrás de proxy; mapas sem teto; sem limite de conexões WebSocket | **Corrigido** (`TEACHLI_TRUST_PROXY`, tetos e limite por IP) |
| A5 | Alta | Usuário em `localStorage` sem limpeza; ID token em `sessionStorage` | **Parcial**: `localStorage` do legado removido e chave pendente limpa no logout. O ID token ainda fica em `sessionStorage` até a troca por token de sala **[pendente]** |
| M1 | Média | Sem CSP nem cabeçalhos; VLibras externo sem SRI | **Parcial**: CSP no build e cabeçalhos no servidor. O VLibras segue carregado de `vlibras.gov.br`, sem SRI |
| M2 | Média | HTTPS/WSS não forçado | **Pendente (infraestrutura)**: usar HTTPS/WSS e origens explícitas em produção |
| M3 | Média | Landmarks sem aviso e sem opção clara de apagar | **Corrigido** (aviso e botão Limpar); criptografia local **pendente** |
| M5 | Média | Papel de professor só por domínio | **Pendente** (decisão institucional) |
| M6 | Média | `.tar.gz`, `timestamp-*` e `env.development.local` versionados | **Corrigido** (permanecem no histórico do Git) |
| M7 | Média | Raiz sem lockfile | **Corrigido** (manifesto da raiz reduzido ao atalho) |
| B1 | Baixa | Sem log de auditoria | **Corrigido** |
| B2 | Baixa | Sem cabeçalhos no servidor de salas | **Corrigido** |

## 13. Plano de adequação à LGPD (resumo)

1. Instituição nomeia o encarregado e define controlador e operador **[organizacional]**.
2. Validar as bases legais da seção 3 e publicar a política da seção 9 **[jurídico]**.
3. Elaborar o RIPD da seção 11 **[jurídico/técnico]**.
4. Definir retenção de logs e canal de direitos dos titulares **[organizacional]**.
5. Configurar HTTPS/WSS, proxy, monitoramento e cofre de segredos na hospedagem **[infraestrutura]**.
6. Decidir sobre papéis adicionais (gestor e admin) e a atribuição de professores **[produto]**.
7. Reauditar após mudanças relevantes e antes de uso em produção.

## 14. Verificação realizada

Os testes automatizados (`npm test` em `server/`, `npm run test:auth` em `client/`) cobrem
autenticação, autorização por papel, origem, limite de tentativas, cabeçalhos de segurança, auditoria
sem dados pessoais e restrição de tenant. Não foram feitos testes de penetração externos nem a
validação da CSP em navegador com o VLibras: **conferir manualmente** se o widget VLibras, a câmera e
o login continuam funcionando no build, e ajustar a CSP em `client/vite.config.ts` se necessário.
