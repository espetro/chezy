import {
  configure as configureLogtape,
  getConsoleSink,
  type LogLevel,
} from "@logtape/logtape";
import { getFileSink } from "@logtape/file";
import {
  getAnsiColorFormatter,
  getJsonLinesFormatter,
} from "@logtape/logtape";

import { rootLogger } from "./logger.ts";

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
export async function configureLogger(
  options: ConfigureLoggerOptions,
): Promise<void> {
  const level: LogLevel =
    options.level ??
    ((process.env["CHEZY_LOG_LEVEL"] as LogLevel | undefined) ?? "info");

  const env = options.environment ?? process.env["NODE_ENV"] ?? "development";
  const isTty = process.stderr.isTTY === true;

  const sinks = {
    stderr: getConsoleSink({
      formatter: getAnsiColorFormatter({
        timestamp: "date-time-tz",
        level: "tiny",
        category: "tiny",
      }),
      // In dev (TTY) the pretty ANSI is readable; in prod (CI / no TTY)
      // we still emit colors because most log shippers strip them.
      useColor: isTty || env !== "development",
    }),
    ...(options.auditFile !== null
      ? {
          audit: getFileSink(
            options.auditFile ?? defaultAuditPath(options.service),
            {
              formatter: getJsonLinesFormatter({
                timestamp: "date-time-tz",
                categoryDelimiter: ".",
              }),
            },
          ),
        }
      : {}),
  };

  await configureLogtape({
    sinks,
    loggers: [
      {
        category: [...rootLogger.category],
        lowestLevel: level,
        sinks: Object.keys(sinks) as ("stderr" | "audit")[],
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
