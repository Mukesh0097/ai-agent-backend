import { Injectable } from '@nestjs/common';
import { readFileSync } from 'fs';
import * as pdfParse from 'pdf-parse';

@Injectable()
export class PdfService {
  async extractText(filePath: string): Promise<string> {
    const dataBuffer = readFileSync(filePath);
    const data = await pdfParse(dataBuffer);
    return data.text;
  }
}
