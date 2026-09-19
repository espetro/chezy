export { getLogger, configure, reset } from "@logtape/logtape";
export type { Logger, LogLevel } from "@logtape/logtape";

export { configureLogger, type ConfigureLoggerOptions } from "./configure.ts";
export {
  createAuditLogger,
  type AuditEvent,
  type AuditLogger,
} from "./audit.ts";
export { rootLogger, type Category } from "./logger.ts";
