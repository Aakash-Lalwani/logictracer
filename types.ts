
export interface ExecutionStep {
  lineNo: number;
  code: string;
  action: string;
  reason: string;
  variables: Record<string, any>;
  output: string[];
}

export interface TraceResult {
  steps: ExecutionStep[];
  success: boolean;
  error?: string;
}

export enum AppMode {
  AI_TUTOR = 'AI Tutor',
  OFFLINE = 'Offline Mode'
}

export interface VisualFrame {
  step: number;
  imageUrl: string;
  description: string;
}
