# Identidade visual TeachLi · UniBarretos

## Direção

Portal acadêmico de apoio à comunicação. A marca institucional identifica o
ambiente; a marca TeachLi identifica a ferramenta. A entrada dá espaço à mensagem
e à escolha de perfil. As áreas de trabalho priorizam os controles e a leitura.

Paleta: azul UniBarretos `#2B57A2`, laranja `#F5822A`, azul profundo `#153566`,
branco `#FFFFFF`, fundo frio `#F3F6FB`, texto secundário `#53647D`.
O laranja é destaque com texto azul profundo; ações primárias usam azul e branco.

Tipografia: Outfit variável, hospedada localmente em `client/public/fonts/`, com
Segoe UI e sans-serif como alternativas. Licença SIL Open Font License incluída.
Títulos de entrada amplos; textos e controles de trabalho compactos e legíveis.
Alinhamento à esquerda, largura de leitura limitada e layout responsivo.

```
[ UniBarretos                   navegação     TeachLi ]
[ título + apresentação     |  explorar texto/voz/gestos ]
[ escolha de perfil                                    ]
[ aluno em azul claro      |  professor em laranja claro ]
[ como usar / limites                                   ]
[ assinatura institucional                              ]
```

Revisão da proposta: evitar um painel genérico de cartões iguais. A apresentação
usa títulos grandes sobre azul profundo e balões de conversa sobrepostos, com
exemplos de texto, voz e gestos. As duas áreas de acesso usam superfícies brancas translúcidas sobre campos suaves de azul e laranja, com desfoque de fundo e alternativa opaca em navegadores sem suporte.
Livro e formatura identificam os perfis, com assinatura TeachLi nos rodapés.
A logo do menu fica reta, preservando a proporção original.
A referência https://unibarretos.edu.br/ orienta a paleta e os destaques em
laranja nos títulos; o efeito de vidro é a adaptação solicitada para o TeachLi. A mão aparece apenas na logo original, sem repetição de ícones decorativos. A navegação e os cabeçalhos são compartilhados nas telas funcionais.
O movimento responde à seleção e ao foco; respeita redução de movimento.

## Marcas

- `client/public/brand/unibarretos.png`: arquivo completo obtido do site oficial,
  https://unibarretos.edu.br/images/unibarretos1.png (16/10/2026). A imagem enviada
  estava cortada na direita. Esta versão tem letras brancas e pede fundo azul.
- `client/public/brand/teachli.jpg`: cópia da marca original `TeachLi.jpg`, já
  existente no repositório. Preservar proporção, cores e fundo branco.

Preservar o desenho das marcas. A variante transparente com contorno branco
foi solicitada para o TeachLi e substitui a placa branca na interface. Usar textos alternativos, navegação por teclado,
foco visível e controles com áreas de toque confortáveis. Manter os limites reais
do protótipo: A–Z experimental por pose, sem Ç e sem prometer tradução completa
ou validação de movimentos de H/J/K/X/Z.

## Registro da validação visual anterior

- Build direto do Vite concluído; o pacote mantém o aviso de tamanho do JavaScript.
- Teste de autenticação existente passou. Os domínios institucionais e as regras
  de sessão foram preservados.
- Na etapa visual anterior, a checagem de tipos ainda misturava aplicação e
  arquivos herdados. A regularização atual está descrita na
  [documentação técnica](DOCUMENTACAO.md#fronteira-de-compilação-e-legado); esse
  registro histórico não representa o estado do build atual.
- Navegação e capturas de tela em desktop (1440px), celular (390px) e verificações
  adicionais de largura a 320px: sem rolagem horizontal nos fluxos verificados.
- Seletores de recursos, perguntas expansíveis, estados de login, retorno da
  Microsoft simulado, rotas protegidas, aluno, professor, treino e página 404
  verificados em navegador. Sem autenticação real, gravação de câmera ou microfone
  nesta revisão visual; as sessões das telas internas eram fixtures locais.

## Endereço de desenvolvimento e login

A prévia usa `http://127.0.0.1:5173`. Desenvolvimento e preview de build têm
`strictPort: true` para impedir a mudança silenciosa para 5174, que provocou
o erro Microsoft AADSTS50011 mostrado pelo usuário. O retorno continua na mesma
origem em `/entrar`, preservando a sessão temporária e o fluxo PKCE. A configuração
SPA no Entra precisa conter esse endereço, conforme o README. Nenhum cadastro
no Entra foi alterado nesta revisão.

## Favicon e movimento

O favicon ativo em `client/index.html` usa
`client/public/brand/teachli-outline.png`, a mesma variante transparente com
contorno branco da interface. O navegador dimensiona a imagem para a aba. O
recurso anterior `teachli-favicon.png` permanece preservado, mas não é o ícone
referenciado pelo HTML. O prompt de criação da variante está registrado abaixo.

As animações usam deslocamentos entre 6 e 18 pixels e durações entre 650 ms e
1 segundo. Ao selecionar Texto, Voz ou Gestos, a demonstração atual se apaga em
220 ms; o cartão principal entra em 850 ms e a resposta começa 400 ms depois.
Trocas rápidas cancelam a seleção pendente e preservam a última escolha.
Os cartões de acesso usam inclinação limitada e reflexos discretos.

A rolagem usa o comportamento nativo do navegador, tanto na roda do mouse
quanto nos links para seções. Não há captura de eventos de roda, saltos entre
seções nem animação personalizada de rolagem. As demais animações visuais e a
preferência de reduzir movimento continuam independentes da navegação.

Perguntas compartilham um único estado aberto. Ao abrir outra, a anterior se
recolhe; altura, cor e opacidade do texto mudam gradualmente. Os controles mantêm
`aria-expanded`, `aria-controls` e navegação por teclado.

A preferência do sistema é respeitada por padrão. O botão visível “Ativar animações” /
“Reduzir animações” permite uma escolha explícita apenas para o TeachLi, persistida
em `localStorage` na chave `teachli.motion`. Alterações do sistema e entre abas são
acompanhadas. Quando o movimento está reduzido, as transições e a rolagem automática
são desativadas, sem esconder conteúdo. A preferência é por origem (hostname/porta).

## Áreas funcionais de aluno e professor

As páginas internas usam painéis brancos sobre fundo claro, títulos compactos e
controles próximos ao conteúdo correspondente, sem efeitos de entrada ou
interceptação da rolagem. Os estilos ficam limitados a `student.css` e
`professor.css`, carregados depois da identidade compartilhada.

- Aluno: câmera e resultado no mesmo painel; mensagem digitada e texto dos gestos
  em áreas distintas. Gestos disponíveis ficam recolhidos, com dicas em uma faixa
  secundária. Os botões de fala indicam quando não há texto disponível.
- Professor: frase atual em destaque, gravação imediatamente abaixo e histórico
  separado. O texto duplicado foi removido; orientações de VLibras ficam em uma
  coluna lateral que passa para baixo no celular. Dicas adicionais ficam recolhidas.
- As funções de câmera, reconhecimento, fala, autenticação e montagem do VLibras
  foram preservadas. A revisão não incluiu captura real de câmera ou microfone.

Revisão visual com os componentes reais em uma prévia temporária removida ao
final, sem alterar a proteção das rotas. Larguras de 1265, 390 e 320 pixels
verificadas, sem rolagem horizontal. Digitação, limpeza do campo, disponibilidade
dos botões e abertura/fechamento das instruções conferidos. A checagem de tipos
não apontou erros nas duas páginas naquela etapa. A auditoria legada é hoje
separada do build da aplicação atual, conforme a documentação técnica.

Build direto do Vite desta revisão concluído (2937 módulos), mantendo apenas o
aviso existente de tamanho do pacote JavaScript.

### Campo de mensagem com gestos

A mensagem composta fica em destaque no topo da coluna ao lado da câmera, em um
campo editável e selecionável, com revisão e envio explícito ao professor. O histórico de detecções fica recolhido junto à
câmera; não é apresentado como histórico de frases. O campo usa o estado
`recognizedText` já existente e mantém a adição manual, a leitura em voz e a limpeza.
O aviso de sessão deixa claro que não existe salvamento persistente.

Ainda fora da entrega atual: composição automática de letras em palavras,
separação automática, persistência de mensagens e reconhecimento de frases em
Libras. A edição manual e o envio confirmado do rascunho já estão implementados;
o layout não apresenta controles falsos de salvar ou reconhecimento automático.

## Entrada por sala de aula

A seleção de sala mantém Outfit e a paleta institucional, com formulário alinhado
à esquerda e uma orientação lateral no desktop. No celular, os blocos ficam
empilhados. Um seletor nativo lista os laboratórios A/B/C e as salas 01/02; o
botão de entrada só fica disponível após a escolha. Nome, perfil e e-mail ajudam
a reconhecer a conta utilizada. A faixa azul nas telas de comunicação informa
sala, conexão/presença e oferece troca ou saída da conta.

Validação local desta etapa: seleção em 1440px e 390px, sem overflow horizontal
na seleção móvel; mensagem digitada chegando ao professor; legenda retornando ao
aluno com reconhecimento de voz simulado; espera pelo professor, troca de sala e
logout. Foram usadas identidades fictícias emitidas por um servidor de teste,
sem login Microsoft real. Esse registro corresponde ao ensaio visual anterior; a suíte atual contém
14 testes de autenticação do cliente e sete cenários do servidor. O estado da
compilação foi atualizado na documentação técnica. Microfone real e validação
com contas institucionais em dispositivos diferentes continuam pendentes.


## Logo transparente com contorno branco

Arquivo ativo: `client/public/brand/teachli-outline.png`, PNG com canal alpha,
1446 × 1087. O JPEG original permanece preservado. O cabeçalho deixou de usar
fundo branco e mistura de cores sobre a logo. Um contorno CSS de 1px reforça
a leitura da imagem em tamanho pequeno; a variante é usada também nas
áreas de acesso. A marca UniBarretos não foi alterada.

Edição feita com ImageGen integrado (sem CLI). Prompt final: remover o fundo
branco, inclusive vazados, e adicionar contorno branco fino de aproximadamente
4 pixels em largura 1024; preservar desenho, cores, proporções e palavra TeachLi;
não adicionar fundo, placa, sombra ou novos elementos; pequena margem transparente.

## Ajuste de escopo da entrada por salas

O login Microsoft anterior foi restaurado: não há consulta ao servidor de salas
antes do redirecionamento ou no retorno Microsoft. A seleção de sala prepara a
sessão de comunicação e permite tentar novamente sem perder o login caso o
servidor esteja indisponível. Não se exige Tenant ID da faculdade, função Entra
ou cadastro extra de professores. O scroll nativo e a logo transparente com
contorno branco permanecem aplicados.
