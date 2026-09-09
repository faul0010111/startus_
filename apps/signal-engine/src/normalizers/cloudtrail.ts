import type { NormalizedSignal, Severity } from "@stratus/shared-types";
import { baseSignal } from "./index.js";

/** Actions that change the security posture of an account. */
const SENSITIVE_ACTIONS: Record<string, Severity> = {
  PutBucketAcl: "high",
  DeleteTrail: "critical",
  AuthorizeSecurityGroupIngress: "high",
  CreateAccessKey: "medium",
  AttachRolePolicy: "medium",
  StopLogging: "critical",
};

export function normalizeCloudTrail(raw: any): NormalizedSignal[] {
  const records: any[] = raw?.Records ?? [raw];
  return records.filter(Boolean).map((record) =>
    baseSignal({
      type: "audit-event",
      source: "aws.cloudtrail",
      resourceId: record.resources?.[0]?.ARN ?? record.recipientAccountId ?? "aws:unknown",
      service: record.eventSource ?? "aws",
      severity: SENSITIVE_ACTIONS[record.eventName] ?? "info",
      title: `${record.eventName} by ${record.userIdentity?.arn ?? "unknown principal"}`,
      environment: record.tags?.environment ?? "production",
      observedAt: record.eventTime ?? new Date().toISOString(),
      attributes: {
        eventName: record.eventName,
        region: record.awsRegion,
        sourceIp: record.sourceIPAddress,
        principal: record.userIdentity?.arn,
        errorCode: record.errorCode ?? null,
      },
    }),
  );
}
