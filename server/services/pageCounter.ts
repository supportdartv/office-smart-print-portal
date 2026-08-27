import { PDFDocument } from 'pdf-lib';

export interface PageCountResult {
  pageCount: number;
  type: string;
  error?: string;
}

export class PageCounterService {
  public static async countPages(buffer: Buffer, mimeType: string, filename: string): Promise<PageCountResult> {
    const ext = filename.split('.').pop()?.toLowerCase() || '';

    // 1. PDF
    if (mimeType === 'application/pdf' || ext === 'pdf') {
      try {
        const pdfDoc = await PDFDocument.load(buffer, { ignoreEncryption: false });
        const count = pdfDoc.getPageCount();
        if (count < 1) {
          throw new Error('PDF has no pages');
        }
        return { pageCount: count, type: 'PDF' };
      } catch (err: any) {
        console.error('[PageCounter] PDF parsing error:', err.message);
        throw new Error('Unable to determine PDF pages. The file may be corrupt or encrypted.');
      }
    }

    // 2. Images (JPEG / PNG)
    if (
      mimeType === 'image/jpeg' ||
      mimeType === 'image/png' ||
      mimeType === 'image/jpg' ||
      ext === 'jpg' ||
      ext === 'jpeg' ||
      ext === 'png'
    ) {
      return { pageCount: 1, type: 'IMAGE' };
    }

    // 3. Word Documents (DOCX / DOC)
    if (
      mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      mimeType === 'application/msword' ||
      ext === 'docx' ||
      ext === 'doc'
    ) {
      try {
        // Inspect DOCX xml if available (Word app properties app.xml contains <Pages> tag)
        const docText = buffer.toString('utf-8');
        const pagesMatch = docText.match(/<Pages>(\d+)<\/Pages>/i);
        if (pagesMatch && pagesMatch[1]) {
          const parsed = parseInt(pagesMatch[1], 10);
          if (!isNaN(parsed) && parsed > 0) {
            return { pageCount: parsed, type: 'DOCX' };
          }
        }

        // Fallback word count estimation for DOCX without page metadata: ~350 words per page
        const wordsMatch = docText.match(/<Words>(\d+)<\/Words>/i);
        if (wordsMatch && wordsMatch[1]) {
          const words = parseInt(wordsMatch[1], 10);
          if (!isNaN(words) && words > 0) {
            const estimated = Math.max(1, Math.ceil(words / 350));
            return { pageCount: estimated, type: 'DOCX' };
          }
        }

        // Default to safe 1 page minimum for word doc preview before conversion
        return { pageCount: 1, type: 'DOCX' };
      } catch (err) {
        return { pageCount: 1, type: 'DOCX' };
      }
    }

    throw new Error('Unsupported file type. Please upload PDF, DOCX, JPG or PNG.');
  }
}
