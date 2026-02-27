import * as pdfjs from 'pdfjs-dist';
import { logger } from './logger';
import { CONFIG } from '../config';

// Use Vite's asset import for the worker
// @ts-ignore
import pdfWorker from 'pdfjs-dist/build/pdf.worker.mjs?url';

pdfjs.GlobalWorkerOptions.workerSrc = pdfWorker;

export const pdfService = {
  async extractRelevantText(file: File | Blob, onProgress?: (p: number) => void): Promise<{ text: string; rules: string[] }> {
    logger.add('request', 'PDFService', 'extractRelevantText', { size: file.size });
    
    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
      const totalPages = pdf.numPages;
      
      let relevantText = '';
      const keywords = ['обслуживание', 'регламент', 'сервис', 'maintenance', 'service', 'schedule', 'правила', 'безопасность'];
      
      for (let i = 1; i <= totalPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map((item: any) => item.str).join(' ');
        
        const hasKeywords = keywords.some(k => pageText.toLowerCase().includes(k));
        
        if (hasKeywords) {
          relevantText += `--- Page ${i} ---\n${pageText}\n\n`;
        }
        
        if (onProgress) onProgress(Math.round((i / totalPages) * 100));
      }

      if (!relevantText.trim()) {
        throw new Error('PDF не содержит текстового слоя или релевантных разделов по ТО.');
      }

      logger.add('response', 'PDFService', 'extractRelevantText', { length: relevantText.length });
      return { text: relevantText, rules: [] }; // Rules will be extracted by LLM from text
    } catch (err: any) {
      throw new Error(err.message);
    }
  },

  chunkText(text: string, size = 8000, overlap = 500): string[] {
    const chunks: string[] = [];
    let start = 0;
    
    while (start < text.length) {
      const end = Math.min(start + size, text.length);
      chunks.push(text.substring(start, end));
      start += size - overlap;
    }
    
    return chunks;
  },

  async extractFromUrl(url: string, onProgress?: (p: number) => void): Promise<{ text: string; rules: string[] }> {
    // Using our local proxy for CORS bypass
    const proxyUrl = `${CONFIG.API_BASE_URL}/api/proxy?url=${encodeURIComponent(url)}`;
    const response = await fetch(proxyUrl, { credentials: 'include' });
    if (!response.ok) throw new Error('Не удалось загрузить файл по ссылке');
    const blob = await response.blob();
    return this.extractRelevantText(blob, onProgress);
  }
};
