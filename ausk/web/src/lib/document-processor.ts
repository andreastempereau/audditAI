import { Buffer } from 'buffer';

export interface DocumentMetadata {
  filename: string;
  mimeType: string;
  size: number;
  pages?: number;
  author?: string;
  title?: string;
  createdAt?: Date;
  modifiedAt?: Date;
  language?: string;
}

export interface ProcessedDocument {
  content: string;
  metadata: DocumentMetadata;
  chunks: DocumentChunk[];
  extractedImages?: ExtractedImage[];
}

export interface DocumentChunk {
  id: string;
  content: string;
  metadata: {
    chunkIndex: number;
    pageNumber?: number;
    section?: string;
    wordCount: number;
  };
}

export interface ExtractedImage {
  id: string;
  data: Buffer;
  mimeType: string;
  description?: string;
  ocrText?: string;
}

export class DocumentProcessor {
  private supportedMimeTypes = [
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
    'application/msword', // .doc
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
    'application/vnd.ms-excel', // .xls
    'application/vnd.openxmlformats-officedocument.presentationml.presentation', // .pptx
    'application/vnd.ms-powerpoint', // .ppt
    'text/plain',
    'text/csv',
    'application/json',
    'text/markdown',
    'application/rtf',
    'image/jpeg',
    'image/png',
    'image/tiff',
    'image/bmp'
  ];

  async processDocument(
    buffer: Buffer,
    filename: string,
    mimeType?: string
  ): Promise<ProcessedDocument> {
    // Detect MIME type if not provided
    const detectedMimeType = mimeType || this.detectMimeType(buffer, filename);
    
    if (!this.supportedMimeTypes.includes(detectedMimeType)) {
      throw new Error(`Unsupported file type: ${detectedMimeType}`);
    }

    let metadata: DocumentMetadata = {
      filename,
      mimeType: detectedMimeType,
      size: buffer.length
    };

    let content = '';
    let extractedImages: ExtractedImage[] = [];

    try {
      switch (detectedMimeType) {
        case 'application/pdf':
          ({ content, metadata, extractedImages } = await this.processPDF(buffer, metadata));
          break;
        
        case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
        case 'application/msword':
          ({ content, metadata } = await this.processWord(buffer, metadata));
          break;
        
        case 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':
        case 'application/vnd.ms-excel':
          ({ content, metadata } = await this.processExcel(buffer, metadata));
          break;
        
        case 'application/vnd.openxmlformats-officedocument.presentationml.presentation':
        case 'application/vnd.ms-powerpoint':
          ({ content, metadata } = await this.processPowerPoint(buffer, metadata));
          break;
        
        case 'text/plain':
        case 'text/csv':
        case 'application/json':
        case 'text/markdown':
          content = buffer.toString('utf-8');
          break;
        
        case 'application/rtf':
          content = await this.processRTF(buffer);
          break;
        
        case 'image/jpeg':
        case 'image/png':
        case 'image/tiff':
        case 'image/bmp':
          content = await this.processImage(buffer, detectedMimeType);
          break;
        
        default:
          throw new Error(`Processing not implemented for ${detectedMimeType}`);
      }

      // Generate chunks
      const chunks = this.generateChunks(content, filename);

      return {
        content,
        metadata,
        chunks,
        extractedImages
      };

    } catch (error) {
      console.error('Document processing error:', error);
      throw new Error(`Failed to process document: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private detectMimeType(buffer: Buffer, filename: string): string {
    // Simple MIME type detection based on file extension and magic bytes
    const extension = filename.split('.').pop()?.toLowerCase();
    
    // Check magic bytes first
    if (buffer.length >= 4) {
      const header = buffer.subarray(0, 4);
      
      // PDF
      if (header.toString('ascii').startsWith('%PDF')) {
        return 'application/pdf';
      }
      
      // ZIP-based Office formats (check first 2 bytes)
      if (header[0] === 0x50 && header[1] === 0x4B) {
        switch (extension) {
          case 'docx': return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
          case 'xlsx': return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
          case 'pptx': return 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
        }
      }
      
      // Image formats
      if (header[0] === 0xFF && header[1] === 0xD8) return 'image/jpeg';
      if (header.toString('ascii', 0, 4) === '\x89PNG') return 'image/png';
    }

    // Fallback to extension-based detection
    switch (extension) {
      case 'pdf': return 'application/pdf';
      case 'docx': return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
      case 'doc': return 'application/msword';
      case 'xlsx': return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
      case 'xls': return 'application/vnd.ms-excel';
      case 'pptx': return 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
      case 'ppt': return 'application/vnd.ms-powerpoint';
      case 'txt': return 'text/plain';
      case 'csv': return 'text/csv';
      case 'json': return 'application/json';
      case 'md': return 'text/markdown';
      case 'rtf': return 'application/rtf';
      case 'jpg':
      case 'jpeg': return 'image/jpeg';
      case 'png': return 'image/png';
      case 'tiff':
      case 'tif': return 'image/tiff';
      case 'bmp': return 'image/bmp';
      default: return 'application/octet-stream';
    }
  }

  private async processPDF(buffer: Buffer, metadata: DocumentMetadata): Promise<{
    content: string;
    metadata: DocumentMetadata;
    extractedImages: ExtractedImage[];
  }> {
    // In production, use libraries like pdf-parse or pdf2pic
    // For now, return placeholder implementation
    const content = await this.extractPDFText(buffer);
    const images = await this.extractPDFImages(buffer);
    
    metadata.pages = await this.getPDFPageCount(buffer);
    
    return { content, metadata, extractedImages: images };
  }

  private async extractPDFText(buffer: Buffer): Promise<string> {
    try {
      const pdf = require('pdf-parse');
      const data = await pdf(buffer);
      return data.text;
    } catch (error) {
      console.error('PDF text extraction error:', error);
      throw new Error('PDF text extraction failed');
    }
  }

  private async extractPDFImages(buffer: Buffer): Promise<ExtractedImage[]> {
    // Placeholder - in production use pdf2pic or similar
    return [];
  }

  private async getPDFPageCount(buffer: Buffer): Promise<number> {
    try {
      const pdf = require('pdf-parse');
      const data = await pdf(buffer);
      return data.numpages;
    } catch (error) {
      console.error('PDF page count error:', error);
      return 1;
    }
  }

  private async processWord(buffer: Buffer, metadata: DocumentMetadata): Promise<{
    content: string;
    metadata: DocumentMetadata;
  }> {
    try {
      const mammoth = require('mammoth');
      
      // Extract text from .docx files
      if (metadata.mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
        const result = await mammoth.extractRawText({ buffer });
        return { content: result.value, metadata };
      }
      
      // For .doc files, we'd need a different approach (antiword or textract)
      // For now, fallback to simple extraction
      return {
        content: 'Legacy .doc format processing requires additional tools',
        metadata
      };
    } catch (error) {
      console.error('Word document processing error:', error);
      throw new Error('Word document processing failed');
    }
  }

  private async processExcel(buffer: Buffer, metadata: DocumentMetadata): Promise<{
    content: string;
    metadata: DocumentMetadata;
  }> {
    try {
      const XLSX = require('xlsx');
      const workbook = XLSX.read(buffer, { type: 'buffer' });
      let content = '';
      
      // Process all sheets
      workbook.SheetNames.forEach((sheetName: string) => {
        const sheet = workbook.Sheets[sheetName];
        const sheetData = XLSX.utils.sheet_to_txt(sheet);
        content += `Sheet: ${sheetName}\n${sheetData}\n\n`;
      });
      
      // Extract metadata
      if (workbook.Props) {
        metadata.author = workbook.Props.Author;
        metadata.title = workbook.Props.Title;
        metadata.createdAt = workbook.Props.CreatedDate ? new Date(workbook.Props.CreatedDate) : undefined;
        metadata.modifiedAt = workbook.Props.ModifiedDate ? new Date(workbook.Props.ModifiedDate) : undefined;
      }
      
      return { content: content.trim(), metadata };
    } catch (error) {
      console.error('Excel document processing error:', error);
      throw new Error('Excel document processing failed');
    }
  }

  private async processPowerPoint(buffer: Buffer, metadata: DocumentMetadata): Promise<{
    content: string;
    metadata: DocumentMetadata;
  }> {
    try {
      // For .pptx files, we can extract text using yauzl to read the ZIP structure
      if (metadata.mimeType === 'application/vnd.openxmlformats-officedocument.presentationml.presentation') {
        return await this.extractPPTXText(buffer, metadata);
      }
      
      // For .ppt files, we'd need a different approach
      return {
        content: 'Legacy .ppt format processing requires additional tools',
        metadata
      };
    } catch (error) {
      console.error('PowerPoint processing error:', error);
      throw new Error('PowerPoint processing failed');
    }
  }

  private async extractPPTXText(buffer: Buffer, metadata: DocumentMetadata): Promise<{
    content: string;
    metadata: DocumentMetadata;
  }> {
    return new Promise((resolve, reject) => {
      const StreamZip = require('node-stream-zip');
      let content = '';
      
      try {
        const zip = new StreamZip.async({ buffer });
        
        zip.extract(null, null).then(() => {
          // Extract text from slides
          const slidePattern = /ppt\/slides\/slide\d+\.xml/;
          const entries = zip.entries();
          
          for (const entry of Object.values(entries) as any[]) {
            if (slidePattern.test(entry.name)) {
              const slideContent = zip.entryDataSync(entry.name).toString();
              // Extract text nodes from XML
              const textMatches = slideContent.match(/<a:t[^>]*>(.*?)<\/a:t>/g);
              if (textMatches) {
                textMatches.forEach((match: string) => {
                  const text = match.replace(/<[^>]*>/g, '');
                  content += text + ' ';
                });
                content += '\n\n';
              }
            }
          }
          
          zip.close();
          resolve({ content: content.trim(), metadata });
        }).catch(reject);
      } catch (error) {
        reject(error);
      }
    });
  }

  private async processRTF(buffer: Buffer): Promise<string> {
    // In production, use rtf-parser or similar
    try {
      // Basic RTF text extraction (removes RTF formatting codes)
      const rtfContent = buffer.toString('utf-8');
      return rtfContent.replace(/\\[a-z]+\d*\s?/g, '').replace(/[{}]/g, '');
    } catch (error) {
      throw new Error('RTF processing failed');
    }
  }

  private async processImage(buffer: Buffer, mimeType: string): Promise<string> {
    try {
      const Tesseract = require('tesseract.js');
      const { data: { text } } = await Tesseract.recognize(buffer, 'eng', {
        logger: (m: any) => console.log('OCR Progress:', m)
      });
      return text;
    } catch (error) {
      console.error('Image OCR processing error:', error);
      throw new Error('Image OCR processing failed');
    }
  }

  private generateChunks(content: string, filename: string): DocumentChunk[] {
    const chunks: DocumentChunk[] = [];
    const chunkSize = 1000; // characters
    const overlap = 100; // character overlap between chunks

    if (content.length <= chunkSize) {
      return [{
        id: `${filename}-chunk-0`,
        content,
        metadata: {
          chunkIndex: 0,
          wordCount: content.split(/\s+/).length
        }
      }];
    }

    let start = 0;
    let chunkIndex = 0;

    while (start < content.length) {
      let end = Math.min(start + chunkSize, content.length);
      
      // Try to break at word boundary
      if (end < content.length) {
        const lastSpace = content.lastIndexOf(' ', end);
        if (lastSpace > start + chunkSize * 0.8) {
          end = lastSpace;
        }
      }

      const chunkContent = content.substring(start, end);
      chunks.push({
        id: `${filename}-chunk-${chunkIndex}`,
        content: chunkContent,
        metadata: {
          chunkIndex,
          wordCount: chunkContent.split(/\s+/).length
        }
      });

      start = end - overlap;
      chunkIndex++;
    }

    return chunks;
  }

  getSupportedMimeTypes(): string[] {
    return [...this.supportedMimeTypes];
  }

  isSupported(mimeType: string): boolean {
    return this.supportedMimeTypes.includes(mimeType);
  }
}

// Singleton instance
export const documentProcessor = new DocumentProcessor();