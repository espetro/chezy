import {
  configure as configureLogtape,
  getAnsiColorFormatter,
  getConsoleSink,
  getJsonLinesFormatter,
  getTextFormatter,
  type LogLevel,
  type Sink,
  type TextFormatterOptions,
} from "@logtape/logtape";
import { getFileSink } from "@logtape/file";

import { Console } from "node:console";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

import { rootLogger } from "./logger";

export interface ConfigureLoggerOptions {
  /**
   * Minimum level emitted to all sinks. Default: `"info"`.
   * Use `process.env.CHEZY_LOG_LEVEL` to override without code changes.
   */
  level?: LogLevel;

  /**
   * Service name embedded in every audit record's `service` field.
   * Required for multi-app observability — the scraper uses `"chezy-scraper"`,
   * the web app uses `"chezy-web"`, and so on.
   */
  service: string;

  /**
   * Environment label embedded in every record's `env` field.
   * Defaults to `process.env.NODE_ENV ?? "development"`.
   */
  environment?: string;

  /**
   * Path to the JSONL audit log file. Defaults to
   * `${process.env.CHEZY_AUDIT_DIR ?? ".audit"}/${service}-${date}.jsonl`.
   * Set to `null` to skip file output (logs only to stderr).
   */
  auditFile?: string | null;
}

/**
 * Configure LogTape once per process. Idempotent — calling twice replaces
 * sinks cleanly (useful in tests). Reads `CHEZY_LOG_LEVEL` from env so
 * operators can raise verbosity without a code change:
 *
 *   CHEZY_LOG_LEVEL=debug mise run dev
 */
export async function configureLogger(options: ConfigureLoggerOptions): Promise<void> {
  const level: LogLevel =
    options.level ?? (process.env["CHEZY_LOG_LEVEL"] as LogLevel | undefined) ?? "info";

  const env = options.environment ?? process.env["NODE_ENV"] ?? "development";
  const isTty = process.stderr.isTTY === true;

  const auditPath = options.auditFile ?? defaultAuditPath(options.service);
  if (options.auditFile !== null) {
    mkdirSync(dirname(auditPath), { recursive: true });
  }

  // In dev (TTY) the pretty ANSI is readable; in prod (CI / no TTY)
  // we still emit colors because most log shippers strip them. Piped
  // dev output gets the plain text formatter instead.
  const colorize = isTty || env !== "development";
  const textOptions = {
    timestamp: "date-time-tz",
    level: "l",
    category: ".",
  } satisfies TextFormatterOptions;

  const sinks: Record<string, Sink> = {
    stderr: getConsoleSink({
      formatter: colorize ? getAnsiColorFormatter(textOptions) : getTextFormatter(textOptions),
      // Route every level to stderr so stdout stays clean for data output.
      console: new Console({ stdout: process.stderr, stderr: process.stderr }),
    }),
  };
  if (options.auditFile !== null) {
    sinks["audit"] = getFileSink(auditPath, {
      formatter: getJsonLinesFormatter({
        categorySeparator: ".",
        // Keep the jq-friendly flat shape: audit fields land at the
        // record root instead of under a nested `properties` object.
        properties: "flatten",
      }),
    });
  }

  await configureLogtape({
    sinks,
    loggers: [
      {
        category: [...rootLogger.category],
        lowestLevel: level,
        sinks: Object.keys(sinks),
      },
    ],
    reset: true,
  });
}

function defaultAuditPath(service: string): string {
  const dir = process.env["CHEZY_AUDIT_DIR"] ?? ".audit";
  const date = new Date().toISOString().slice(0, 10);
  return `${dir}/${service}-${date}.jsonl`;
}
