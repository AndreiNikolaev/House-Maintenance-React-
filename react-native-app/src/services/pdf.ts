import { API_ENDPOINTS } from '../config';

export const pdfService = {
  async extractRelevantText(file: any, onProgress?: (p: number) => void): Promise<{ text: string; rules: string[] }> {
    // В React Native для извлечения текста из PDF лучше использовать бэкенд
    // так как библиотеки типа pdfjs-dist слишком тяжелые и требуют много полифиллов.
    
    // Здесь мы могли бы загрузить файл на бэкенд, но текущий бэкенд принимает только URL.
    // Для демонстрации предположим, что мы используем бэкенд для извлечения.
    throw new Error('Загрузка локальных PDF файлов в мобильной версии пока не поддерживается. Используйте поиск или URL.');
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
    try {
      if (onProgress) onProgress(10);
      const response = await fetch(API_ENDPOINTS.PDF_EXTRACT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url })
      });
      
      if (onProgress) onProgress(50);
      
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Ошибка извлечения текста');
      }
      
      const data = await response.json();
      if (onProgress) onProgress(100);
      
      return { text: data.text, rules: [] };
    } catch (err: any) {
      throw new Error(err.message);
    }
  }
};
