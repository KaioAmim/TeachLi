# TeachLi

Protótipo de apoio à comunicação em sala de aula, com texto para voz,
reconhecimento experimental de gestos pela webcam e videochamada entre professor
e alunos. O objetivo é ampliar as formas de participação de alunos surdos.

**O modelo base reconhece 15 letras estáticas; ele não traduz Libras completa.**
O reconhecimento depende dos dados de treino e precisa de avaliação com usuários.

## O que está disponível

| Recurso | Funcionamento atual |
| --- | --- |
| Modo Aluno | Digitar e ouvir no próprio dispositivo; Enter fala e Shift+Enter insere linha |
| Reconhecimento estático | MediaPipe + TensorFlow.js, 15 letras no modelo base ou modelo pessoal |
| Sinais dinâmicos | Treino local com clipes das mãos; depende das amostras do usuário |
| VLibras | Widget opcional no Modo Aluno para traduzir o texto exibido na página |
| Sala de Aula | Professor cria um código e alunos entram em videochamada WebRTC |

A sala ainda não envia o texto digitado/reconhecido a outros dispositivos,
nem oferece legendas compartilhadas, autenticação institucional ou histórico
persistente de aulas. Veja o [plano de melhorias](docs/GUIA_IMPLEMENTACAO.md).

A próxima direção é a [aula híbrida/EAD](docs/MODELO_HIBRIDO.md): participantes
presenciais e remotos na mesma sala, com legendas, mensagens confirmadas e voz.
O documento define os fluxos e etapas ainda necessários para implementar isso.

## Executar localmente

> **Pendência conhecida na main:** a instalação de `client/` conclui, mas o
> início do Vite acusa `@radix-ui/react-dialog` ausente; `typecheck` e `build`
> também falham em dependências e exports legados. Os comandos abaixo documentam
> o fluxo previsto, ainda dependente da regularização do pacote do cliente.
> Esta atualização de documentação não corrige esses arquivos de aplicação.

Use Node.js 22 e npm, um navegador com WebGL, câmera para reconhecimento e câmera
mais microfone para videochamadas. A digitação com voz não exige ligar a câmera.

```bash
git clone https://github.com/KaioAmim/TeachLi.git
cd TeachLi/client
npm ci
npm run dev
```

Abra o endereço informado pelo Vite, normalmente `http://localhost:5173`.
O comando copia automaticamente o runtime WASM do MediaPipe para `client/public/`.

Para usar **Sala de Aula**, abra outro terminal na raiz do TeachLi:

```bash
cd server
npm ci
npm start
```

O servidor de sinalização escuta em `ws://localhost:8787`. Ele conecta a chamada;
os modos Aluno e Treinar podem ser usados sem ele. Não é necessário configurar
banco de dados ou OAuth para esse fluxo atual.

Para conectar dispositivos diferentes, todos devem acessar o mesmo servidor de
sinalização. Configure `VITE_SIGNALING_URL` em `client/.env.local`; `localhost`
aponta para o próprio dispositivo. Fora de localhost, use HTTPS no site e WSS
no servidor. Detalhes na [configuração da sala](server/README.md) e no
[guia de uso](docs/USO.md).

> O `package.json` da raiz pertence ao caminho herdado Express/tRPC/Drizzle,
> com versões diferentes de React e Vite. Os comandos acima usam os pacotes de
> `client/` e `server/`. Não misture instalações nem execute migrações para
> iniciar a aplicação atual. Consulte [arquitetura e legado](DOCUMENTACAO.md).

## Verificar e gerar o site

Na pasta `client/`:

```bash
npm run typecheck
npm run build
npm run preview
```

O build independente gera `client/dist/`; o preview serve esse build localmente.
Essa é a saída prevista quando a compilação passa; as falhas conhecidas acima
impedem atestar um build novo nesta revisão. Não use o preview como validação
de uma alteração se ele estiver servindo artefatos antigos.
Publicar esses arquivos não publica o servidor WebSocket. A hospedagem deve
suportar as rotas do frontend e os caminhos dos modelos; o Vite atual usa a base
`/`. Configurações antigas não comprovam um deploy funcional atual.

Na raiz, verifique as convenções sem instalar dependências:

```bash
node --test scripts/check-conventions.test.mjs
node scripts/check-conventions.mjs --branch documentation/guia-instalacao --labels documentation --title "docs: atualizar guia de instalação"
```

Compilar e verificar tipos não valida câmera, áudio, tradução, conexão entre
redes ou precisão dos modelos. O [guia de contribuição](CONTRIBUTING.md) traz
verificações manuais por recurso.

## Documentação

| Documento | Conteúdo |
| --- | --- |
| [Guia de uso](docs/USO.md) | Digitação, câmera, treinamento, sala e problemas frequentes |
| [Documentação técnica](DOCUMENTACAO.md) | Arquitetura, rotas, armazenamento e legado |
| [Contribuição](CONTRIBUTING.md) | Preparação, testes, revisão e manutenção documental |
| [Branches, labels e commits](docs/BRANCHES.md) | Os seis tipos, exemplos e verificador |
| [Plano de melhorias](docs/GUIA_IMPLEMENTACAO.md) | Estado atual, prioridades e critérios de aceite |
| [Aula híbrida/EAD](docs/MODELO_HIBRIDO.md) | Proposta de comunicação acessível entre participantes presenciais e remotos |
| [Modelo](docs/MODELO.md) | Artefatos, métricas históricas, limites e pipeline |
| [Datasets](docs/DATASETS.md) | Dados utilizados e candidatos para pesquisa |
| [Servidor de sinalização](server/README.md) | Execução, configuração e limites da chamada |
| [Histórico da recuperação](docs/LIMPEZA.md) | O que veio da branch antiga e pendências |

## Organização do trabalho

Novas branches usam `feature/`, `bug/`, `documentation/`, `enhancement/`,
`maintenance/` ou `ui-ux/`, conforme o [padrão completo](docs/BRANCHES.md).
Cada alteração volta à `main` por PR com escopo, testes e documentação revisados.
Há modelos de issue e PR em `.github/`; as instruções do responsável pela
documentação estão em [AGENTS.md](AGENTS.md).

## Dados e limites

O treino pessoal fica no navegador e não é sincronizado entre dispositivos.
O servidor de sinalização não grava aulas. A sala atual não autentica participantes
e não possui TURN para redes restritivas. O VLibras carrega um serviço externo.

A atribuição do dataset está em
[ATTRIBUTION.md](client/public/datasets/libras-alphabet/ATTRIBUTION.md). O manifesto
da raiz declara MIT, mas ainda não há um arquivo `LICENSE` geral; essa formalização
está pendente e não altera a licença dos dados de terceiros.
