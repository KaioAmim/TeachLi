# Project TODO

## Estrutura do Banco de Dados
- [x] Criar tabela sessions para armazenar sessões de interpretação
- [x] Criar tabela translations para histórico de traduções
- [x] Criar tabela gestures para gestos de Libras treinados
- [x] Executar migração do banco de dados

## Interface Base
- [x] Criar página Home com seleção de modo (Professor/Aluno)
- [x] Criar layout responsivo com Tailwind CSS
- [x] Implementar tema visual acessível com bom contraste
- [x] Adicionar navegação entre páginas

## Modo Professor (Fala → Libras)
- [x] Criar página ProfessorMode
- [x] Implementar componente SpeechRecognizer com Web Speech API
- [x] Integrar com VLibras (widget oficial embutido na página)
- [x] Criar componente LibrasVideoPlayer para exibir vídeos
- [x] Implementar indicador de status de reconhecimento de fala
- [x] Adicionar controles de iniciar/parar reconhecimento
- [x] Criar procedimentos tRPC para professor (translateToLibras, getVideoStatus, getVideo)

## Modo Aluno (Libras → Fala)
- [x] Criar página StudentMode
- [ ] Implementar componente HandGestureCapture com MediaPipe Hands
- [x] Criar sistema de reconhecimento de gestos com classificador TensorFlow.js treinável (letras/números/palavras)
- [x] Implementar componente TextToSpeech com Web Speech API
- [x] Adicionar visualização de landmarks das mãos
- [x] Criar indicador de gesto reconhecido
- [x] Criar procedimentos tRPC para aluno (sessão/tradução — reconhecimento roda 100% no cliente, sem backend)

## Histórico e Sessões
- [x] Criar página History para visualizar traduções anteriores
- [x] Implementar sistema de sessões (criar, finalizar, listar)
- [x] Salvar traduções no banco de dados
- [x] Criar interface para visualizar estatísticas de uso
- [x] Criar procedimentos tRPC para sessões e traduções

## Testes e Documentação
- [x] Testar reconhecimento de fala em português brasileiro
- [ ] Testar integração com VLibras API
- [ ] Testar captura de gestos com MediaPipe
- [x] Testar síntese de voz em português brasileiro
- [x] Criar documentação de uso do sistema
- [x] Criar guia de instalação e configuração

## Melhorias Futuras
- [x] Treinar modelo de ML para reconhecimento avançado de Libras (MLP em TensorFlow.js sobre landmarks, ver client/src/lib/gestureClassifier.ts)
- [ ] Adicionar suporte a frases completas em Libras
- [x] Implementar modo de treinamento de novos gestos (página /aluno/treinar)
- [ ] Adicionar suporte a múltiplos usuários simultâneos
- [ ] Implementar cache de vídeos VLibras para palavras comuns


## Reconhecimento Real de Gestos com MediaPipe Hands
- [x] Instalar e configurar MediaPipe Hands no frontend
- [x] Implementar detecção de landmarks das mãos em tempo real
- [x] Criar visualização dos landmarks na câmera
- [x] Implementar sistema de reconhecimento básico de gestos
- [x] Treinar modelo para reconhecer letras (A-Z) — via página de treinamento em /aluno/treinar; 15 letras estáticas (A,B,C,D,E,I,L,M,N,O,R,S,U,V,W) podem ser importadas automaticamente do dataset público "Brazilian Sign Language Alphabet" (MIT), letras com movimento exigem captura manual pela webcam
- [x] Treinar modelo para reconhecer números (0-9) — captura manual pela webcam em /aluno/treinar
- [x] Reconhecimento roda 100% no cliente (TensorFlow.js), sem enviar vídeo/landmarks ao servidor
- [ ] Testar reconhecimento em diferentes condições de iluminação
- [ ] Otimizar performance do reconhecimento em tempo real


## Bugs a Corrigir
- [x] Erro 404 do MediaPipe - fallback corrigido (modelAssetPath apontava para /wasm/hand_landmarker.task, que não existe; agora usa o host oficial do modelo + cópia local em /models como fallback)
- [x] API de Libras (VLibras) não está sendo exibida no Modo Professor
