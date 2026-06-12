import type { UsageSnapshotV2 } from "./snapshot/v2-types.js";

export * from "./snapshot/v2-types.js";

export declare const ANALYZER_NAME: "codex-usage-analyzer";
export declare const ANALYZER_VERSION: string;

export interface AnalyzeUsageOptions {
  capturedAt?: string | Date | null;
}

export interface CliIo {
  stdout?: {
    write(chunk: string): unknown;
  };
  stderr?: {
    write(chunk: string): unknown;
  };
}

export declare function analyzeUsage(options?: AnalyzeUsageOptions): Promise<UsageSnapshotV2>;

export declare function createSampleUsageSnapshotV2(
  overrides?: Record<string, unknown>
): UsageSnapshotV2;

export declare function runCli(argv: string[], io?: CliIo): Promise<number>;
