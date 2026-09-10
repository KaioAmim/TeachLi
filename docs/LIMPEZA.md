# Limpeza e próximos passos do TeachLi

## Diagnóstico

O commit e7d3d42 (Projeto Limpo e treinado) adicionou 13 arquivos dentro de
libras-modelo-treinado, sem excluir os arquivos anteriores. O PR #9 foi integrado
na main (09a976f), mas o Vite continuava usando client/, sem carregar essa cópia.

## Alterações desta revisão

- Integração dos quatro arquivos de frontend da versão treinada em client/src.
- Modelo, pesos, rótulos e landmarks incorporados ao client/public ativo.
- Remoção da pasta duplicada após incorporar seu conteúdo.
- Remoção de interprete-libras-completo.tar.gz, sem referências no aplicativo.
- Fotos e metadados de treinamento preservados em datasets-raw/libras-alphabet,
  fora do diretório público e do build. Não são arquivos inúteis para pesquisa.
- Scripts e documentação preservados em scripts/dataset e docs.
- Caminhos absolutos da máquina original substituídos por caminhos do projeto.
- Arquivos intermediários de treino ignorados pelo Git.

Excluir na versão atual do GitHub não apaga o histórico dos commits antigos.
Esta revisão não reescreve o histórico.

## Proposta para a primeira entrega

1. Tela inicial com entradas Aluno e Professor; salas com código e sessão ativa.
2. Um dispositivo receptor conectado à caixa de som da sala, com fila de mensagens
   e reprodução única. Cada aluno confirma o texto antes de enviá-lo.
3. Fala do professor transmitida como texto aos alunos da mesma sala, com controles
   visíveis para iniciar, pausar e encerrar o microfone.
4. Autenticação institucional com autorização de professor verificada no backend:
   possuir um e-mail da faculdade, sozinho, não distingue professor de aluno.
5. Exibição de Libras acompanhada do texto original e validação com usuários surdos
   e profissionais de Libras da faculdade.
6. Reconhecimento por câmera como experimento: o modelo entregue contém 15 classes
   de letras estáticas. Avaliar com pessoas que não participaram do treinamento,
   coletar exemplos negativos e permitir corrigir a saída antes de reproduzir.

A API atual tem sessões por usuário, mas ainda precisa de um modelo de salas e
transmissão entre dispositivos para implementar o fluxo descrito. As rotas de
consulta/alteração de sessões e traduções também precisam verificar a associação
do usuário à sessão, além de exigir login.

## Limite de validação

As métricas em MODELO.md foram trazidas do trabalho anterior; não representam
uma nova avaliação de precisão nesta revisão. A câmera e o fluxo com usuários
reais precisam de validação presencial.

## Auditoria ampliada

A revisão seguiu os imports a partir de client/src/main.tsx, server/_core/index.ts
 e das configurações de Vite e Drizzle, incluindo imports dinâmicos. Arquivos de
 declarações TypeScript e migrações foram avaliados separadamente.

Foram removidos componentes sem uso, a página ComponentShowcase, o layout de
 dashboard abandonado, mapas, chat de IA e helpers de armazenamento, geração de
 imagem, LLM e transcrição remota sem consumidores. Foram retiradas 46 dependências
 diretas, os plugins de instrumentação Manus/Builder e seu patch do Wouter.

A configuração Vitest não tinha testes; foi removida junto com o comando vazio.
DOCUMENTACAO.md foi reescrito para refletir a implementação atual; todo.md foi substituído por docs/GUIA_IMPLEMENTACAO.md, e o README foi atualizado. Arquivos .gitkeep em pastas preenchidas
ou sem função foram retirados. O ambiente local foi preservado em .env, ignorado,
 e .env.example documenta as variáveis sem credenciais.

O classificador antigo por distância e seus landmarks fixos foram removidos;
foram preservados os nomes usados na tela de treino. Consultas de gestos no banco
sem consumidores também foram retiradas, preservando schema e migrações existentes.
O TypeScript passou a rejeitar variáveis, parâmetros e imports locais sem uso.

A autenticação Manus e a rota administrativa de notificação continuam conectadas
à API; removê-las exige uma substituição funcional, não apenas limpeza de arquivos.
A configuração Vercel foi preservada como configuração de deploy existente, com
sua limitação documentada no README.

## Validação executada

- TypeScript sem erros, com noUnusedLocals e noUnusedParameters habilitados.
- Build do frontend e backend concluído.
- Servidor de produção iniciado e respostas HTTP verificadas nas cinco páginas,
  nos cinco artefatos de reconhecimento e na rota system.health.
- Modelo carregado no TensorFlow.js e inferência executada com 15 probabilidades
  finitas cuja soma é aproximadamente 1 (não é uma avaliação de precisão).
- 2.615 arquivos de dados/modelo conferidos contra os blobs do Git, admitindo
  apenas a conversão CRLF/LF dos arquivos de texto.
- Sintaxe dos quatro scripts Python e estrutura dos landmarks/pesos verificadas.
- Fotos brutas ausentes de dist/public e .env confirmado como ignorado.
- git diff --check sem erros.

O Vite ainda avisa sobre o tamanho do bundle que inclui TensorFlow.js. Login real,
câmera, microfone, widget externo e treinamento Python completo não foram testados.

A pedido da equipe, foi acrescentado um verificador de convenções de branch/commit
baseado nas seis labels reais do GitHub, com cinco testes usando Node.js.
A documentação técnica e o guia de implementação incluem os comandos de checagem.
O Vitest removido não era utilizado; os novos testes não adicionam dependências.
