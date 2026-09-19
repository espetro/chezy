export { getLogger, configure, reset } from "@logtape/logtape";
export type { Logger, LogLevel } from "@logtape/logtape";

export { configureLogger, type ConfigureLoggerOptions } from "./configure";
export { createAuditLogger, type AuditEvent, type AuditLogger } from "./audit";
export { rootLogger, type Category } from "./logger";
