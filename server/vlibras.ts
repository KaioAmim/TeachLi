/**
 * Integração com a API VLibras do Governo Federal
 * Documentação: https://www.gov.br/conecta/catalogo/apis/vlibras
 */

const VLIBRAS_BASE_URL = 'https://vlibras.gov.br/api';

export interface VLibrasTranslateResponse {
  gloss: string;
}

export interface VLibrasVideoRequest {
  gloss: string;
}

export interface VLibrasVideoResponse {
  id: string;
}

export interface VLibrasVideoStatus {
  status: 'processing' | 'completed' | 'error';
  filename?: string;
  size?: number;
}

/**
 * Traduz texto em português para glosa em Libras
 */
export async function translateToGloss(text: string): Promise<string> {
  try {
    const response = await fetch(`${VLIBRAS_BASE_URL}/translate?text=${encodeURIComponent(text)}`);
    
    if (!response.ok) {
      throw new Error(`VLibras API error: ${response.statusText}`);
    }
    
    const data: VLibrasTranslateResponse = await response.json();
    return data.gloss;
  } catch (error) {
    console.error('Error translating to gloss:', error);
    throw new Error('Falha ao traduzir para Libras');
  }
}

/**
 * Solicita geração de vídeo a partir da glosa
 */
export async function requestVideoGeneration(gloss: string): Promise<string> {
  try {
    const formData = new URLSearchParams();
    formData.append('gloss', gloss);
    
    const response = await fetch(`${VLIBRAS_BASE_URL}/video`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData,
    });
    
    if (!response.ok) {
      throw new Error(`VLibras API error: ${response.statusText}`);
    }
    
    const data: VLibrasVideoResponse = await response.json();
    return data.id;
  } catch (error) {
    console.error('Error requesting video generation:', error);
    throw new Error('Falha ao solicitar geração de vídeo');
  }
}

/**
 * Verifica o status da geração do vídeo
 */
export async function getVideoStatus(videoId: string): Promise<VLibrasVideoStatus> {
  try {
    const response = await fetch(`${VLIBRAS_BASE_URL}/video/status/${videoId}`);
    
    if (!response.ok) {
      throw new Error(`VLibras API error: ${response.statusText}`);
    }
    
    const data = await response.json();
    
    // Mapear resposta da API para nosso formato
    return {
      status: data.status === 'completed' ? 'completed' : 
              data.status === 'error' ? 'error' : 'processing',
      filename: data.filename,
      size: data.size,
    };
  } catch (error) {
    console.error('Error getting video status:', error);
    throw new Error('Falha ao verificar status do vídeo');
  }
}

/**
 * Obtém a URL do vídeo gerado
 */
export async function getVideoUrl(videoId: string): Promise<string> {
  return `${VLIBRAS_BASE_URL}/video/${videoId}`;
}

/**
 * Fluxo completo: traduz texto e gera vídeo
 * Retorna o ID do vídeo para polling de status
 */
export async function translateAndGenerateVideo(text: string): Promise<string> {
  // 1. Traduzir para glosa
  const gloss = await translateToGloss(text);
  
  // 2. Solicitar geração de vídeo
  const videoId = await requestVideoGeneration(gloss);
  
  return videoId;
}
