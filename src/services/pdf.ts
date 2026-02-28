import * as pdfjs from 'pdfjs-dist';
import { CapacitorHttp, Capacitor } from '@capacitor/core';
import { logger } from './logger';
import { API_ENDPOINTS } from '../config';
import { apiRequest } from './api';

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
    logger.add('request', 'PDFService', 'extractFromUrl', { url });
    
    const isNative = Capacitor.isNativePlatform();
    
    if (isNative) {
      try {
        if (onProgress) onProgress(10);
        console.log('[PDF] Native direct download:', url);
        const response = await CapacitorHttp.get({ 
          url, 
          responseType: 'blob' 
        });
        
        let blob: Blob;
        if (typeof response.data === 'string') {
          const byteCharacters = atob(response.data);
          const byteNumbers = new Array(byteCharacters.length);
          for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
          }
          const byteArray = new Uint8Array(byteNumbers);
          blob = new Blob([byteArray], { type: 'application/pdf' });
        } else {
          blob = response.data;
        }

        const file = new File([blob], 'manual.pdf', { type: 'application/pdf' });
        return this.extractRelevantText(file, onProgress);
      } catch (err: any) {
        console.error('[PDF] Native download failed, trying proxy...', err);
      }
    }

    try {
      if (onProgress) onProgress(10);
      
      const data = await apiRequest({
        url: API_ENDPOINTS.PDF_EXTRACT,
        method: 'POST',
        body: { url }
      });
      
      if (onProgress) onProgress(100);
      
      logger.add('response', 'PDFService', 'extractFromUrl', { length: data.text?.length });
      return { text: data.text, rules: [] };
    } catch (err: any) {
      logger.add('error', 'PDFService', 'extractFromUrl', { error: err.message });
      throw new Error(err.message);
    }
  }
};
