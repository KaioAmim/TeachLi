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
- [ ] Integrar com VLibras API para tradução
- [x] Criar componente LibrasVideoPlayer para exibir vídeos
- [x] Implementar indicador de status de reconhecimento de fala
- [x] Adicionar controles de iniciar/parar reconhecimento
- [x] Criar procedimentos tRPC para professor (translateToLibras, getVideoStatus, getVideo)

## Modo Aluno (Libras → Fala)
- [x] Criar página StudentMode
- [ ] Implementar componente HandGestureCapture com MediaPipe Hands
- [x] Criar sistema de reconhecimento básico de gestos (letras/números)
- [x] Implementar componente TextToSpeech com Web Speech API
- [ ] Adicionar visualização de landmarks das mãos
- [x] Criar indicador de gesto reconhecido
- [x] Criar procedimentos tRPC para aluno (recognizeGesture, convertToSpeech)

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
- [ ] Treinar modelo de ML para reconhecimento avançado de Libras
- [ ] Adicionar suporte a frases completas em Libras
- [ ] Implementar modo de treinamento de novos gestos
- [ ] Adicionar suporte a múltiplos usuários simultâneos
- [ ] Implementar cache de vídeos VLibras para palavras comuns


## Reconhecimento Real de Gestos com MediaPipe Hands
- [x] Instalar e configurar MediaPipe Hands no frontend
- [x] Implementar detecção de landmarks das mãos em tempo real
- [x] Criar visualização dos landmarks na câmera
- [x] Implementar sistema de reconhecimento básico de gestos
- [x] Treinar modelo para reconhecer letras (A-Z)
- [x] Treinar modelo para reconhecer números (0-9)
- [x] Integrar reconhecimento com backend tRPC
- [ ] Testar reconhecimento em diferentes condições de iluminação
- [ ] Otimizar performance do reconhecimento em tempo real


## Bugs a Corrigir
- [x] Erro 404 do MediaPipe - fallback não está funcionando
- [x] API de Libras (VLibras) não está sendo exibida no Modo Professor
