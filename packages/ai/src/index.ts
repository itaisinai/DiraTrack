export interface AnalysisEstimate { inputTokens: number; estimatedCostUsd: number; }
export interface DocumentAnalysis<T = unknown> { result: T; warnings: string[]; pageReferences: number[]; }
export interface DocumentAnalyzer { estimate(text: string): Promise<AnalysisEstimate>; analyze<T>(text: string): Promise<DocumentAnalysis<T>>; }
