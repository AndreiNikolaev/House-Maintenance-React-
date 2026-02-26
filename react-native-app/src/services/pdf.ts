import { AppSettings } from '../types';

export const pdfService = {
  async extractRelevantText(fileUri: string, onProgress?: (p: number) => void): Promise<{ text: string; rules: string[] }> {
    console.log(`[REQUEST] PDFService.extractRelevantText: ${fileUri}`);
    
    try {
      if (onProgress) onProgress(10);

      const response = await fetch('/api/pdf/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: fileUri })
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'PDF extraction failed');
      }

      if (onProgress) onProgress(90);
      const data = await response.json();
      
      if (onProgress) onProgress(100);

      console.log(`[RESPONSE] PDFService.extractRelevantText: length=${data.text.length}`);
      
      if (data.text.trim().length < 50) {
        throw new Error('PDF seems to be empty or contains no extractable text (might be a scan).');
      }

      return { text: data.text, rules: [] };
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
    try {
      return this.extractRelevantText(url, onProgress);
    } catch (err: any) {
      console.error(`[ERROR] PDFService.extractFromUrl:`, err.message);
      throw err;
    }
  }
};
