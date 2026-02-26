import { AppSettings } from '../types';

import * as pdfjs from 'pdfjs-dist';

// Set worker source to CDN for the preview environment
// @ts-ignore
pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/5.4.624/pdf.worker.min.js`;

export const pdfService = {
  async extractRelevantText(fileUri: string, onProgress?: (p: number) => void): Promise<{ text: string; rules: string[] }> {
    console.log(`[REQUEST] PDFService.extractRelevantText: ${fileUri}`);
    
    try {
      // Use proxy to bypass CORS if it's a remote URL
      const targetUrl = fileUri.startsWith('http') 
        ? `/api/proxy?url=${encodeURIComponent(fileUri)}` 
        : fileUri;

      // Use pdfjs-dist to extract text from the PDF
      const loadingTask = pdfjs.getDocument(targetUrl);
      const pdf = await loadingTask.promise;
      
      let fullText = '';
      const totalPages = pdf.numPages;

      for (let i = 1; i <= totalPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items
          .map((item: any) => item.str)
          .join(' ');
        
        fullText += `--- Page ${i} ---\n${pageText}\n\n`;
        
        if (onProgress) {
          onProgress(Math.round((i / totalPages) * 100));
        }
      }

      console.log(`[RESPONSE] PDFService.extractRelevantText: length=${fullText.length}`);
      
      if (fullText.trim().length < 50) {
        throw new Error('PDF seems to be empty or contains no extractable text (might be a scan).');
      }

      return { text: fullText, rules: [] };
    } catch (err: any) {
      console.error(`[ERROR] PDFService.extractRelevantText:`, err.message);
      throw new Error(`Failed to extract text from PDF: ${err.message}`);
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
    console.log(`[REQUEST] PDFService.extractFromUrl: ${url}`);
    // In RN, we can fetch the file directly or use a proxy if needed.
    // Since RN doesn't have CORS, we can try direct fetch.
    try {
      return this.extractRelevantText(url, onProgress);
    } catch (err: any) {
      console.error(`[ERROR] PDFService.extractFromUrl:`, err.message);
      throw err;
    }
  }
};
