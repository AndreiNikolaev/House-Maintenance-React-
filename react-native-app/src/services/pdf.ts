import { AppSettings } from '../types';

export const pdfService = {
  async extractRelevantText(fileUri: string, onProgress?: (p: number) => void): Promise<{ text: string; rules: string[] }> {
    console.log(`[REQUEST] PDFService.extractRelevantText: ${fileUri}`);
    
    try {
      // In React Native, we would use a library like react-native-pdf or expo-file-system
      // to read the file and then a parser to get the text.
      // For this demo, we simulate the extraction process.
      
      for (let i = 1; i <= 10; i++) {
        await new Promise(resolve => setTimeout(resolve, 200));
        if (onProgress) onProgress(i * 10);
      }

      const mockText = `
        --- Page 1 ---
        Техническое обслуживание Vaillant.
        Регламент работ:
        1. Проверка давления в системе отопления - каждые 6 месяцев.
        2. Очистка первичного теплообменника - раз в год.
        3. Проверка расширительного бака - каждые 12 месяцев.
        
        --- Page 5 ---
        Правила безопасности:
        - Всегда отключайте электропитание перед началом работ.
        - Используйте только оригинальные запасные части.
        - Регулярно проверяйте герметичность газовых соединений.
      `;

      console.log(`[RESPONSE] PDFService.extractRelevantText: length=${mockText.length}`);
      return { text: mockText, rules: [] };
    } catch (err: any) {
      console.error(`[ERROR] PDFService.extractRelevantText:`, err.message);
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
