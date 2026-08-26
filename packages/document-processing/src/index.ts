export interface ExtractedPage { pageNumber: number; text: string; }
export interface DocumentTextExtractor { extract(filePath: string): Promise<ExtractedPage[]>; }
