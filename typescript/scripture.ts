import type { FeasonContextRequestOptions } from './index.js';

export interface ScriptureRequest {
  /** Provider-specific reference; the SDK does not invent or translate it. */
  reference: string;
  translation?: string;
}

export interface ScripturePassage {
  provider: string;
  reference: string;
  /** Exact provider text, never generated or rewritten by this SDK. */
  text: string;
  provenance: {
    sourceUrl: string;
    translation: string;
    license: string;
    attribution: string;
  };
}

/**
 * Applications supply an adapter and their own authorized credentials.
 * Provider terms still apply. External text is kept out of Feason evidence
 * packets, citation verification, and model prompts by this SDK.
 */
export interface ScriptureProvider {
  getPassage(input: ScriptureRequest, options?: FeasonContextRequestOptions): Promise<ScripturePassage>;
}
