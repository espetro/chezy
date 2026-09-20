import { getLogger } from "@chezy/observability";
import { ADAPTATION_ERRORS } from "~/lib/adaptation/machine";
import { DevinClientError } from "~/lib/devin/client";

const logger = getLogger(["chezy", "adaptation"]);

export const providerFailureMessage = (error: unknown): string => {
  if (!(error instanceof DevinClientError)) return ADAPTATION_ERRORS.provider;
  if (error.code === "out_of_quota") return ADAPTATION_ERRORS.quota;
  if (error.code === "unauthorized") return ADAPTATION_ERRORS.unauthorized;
  return ADAPTATION_ERRORS.provider;
};

export const logProviderFailure = (
  op: "create" | "poll" | "message",
  jobId: string,
  error: unknown,
) => {
  const known = error instanceof DevinClientError ? error : undefined;
  logger.error("devin session {op} failed for job {jobId}: {status} {code} {detail}", {
    op,
    jobId,
    status: known?.status,
    code: known?.code ?? "unknown",
    detail: known?.detail ?? (error instanceof Error ? error.message : String(error)),
  });
};
