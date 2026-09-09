export const TOPICS = {
  assetDiscovered: "stratus.asset.discovered",
  signalReceived: "stratus.signal.received",
  /** Internal: correlation clusters emitted by the event processor. */
  correlationDetected: "stratus.correlation.detected",
  findingDetected: "stratus.security.finding.detected",
  findingUpdated: "stratus.security.finding.updated",
  deploymentCompleted: "stratus.deployment.completed",
  performanceAlert: "stratus.performance.alert",
  riskScoreUpdated: "stratus.risk.score.updated",
  incidentCreated: "stratus.incident.created",
  incidentUpdated: "stratus.incident.updated",
  systemAlert: "stratus.system.alert",
} as const;

export type TopicName = (typeof TOPICS)[keyof typeof TOPICS];

/** Topic provisioning used by the bootstrap job and the Kafka admin client. */
export interface TopicSpec {
  topic: TopicName;
  partitions: number;
  retentionMs: number;
  /** Compacted topics keep the latest state per key (asset id, finding id, ...). */
  compact?: boolean;
}

const DAY = 86_400_000;

export const TOPIC_SPECS: TopicSpec[] = [
  { topic: TOPICS.assetDiscovered, partitions: 6, retentionMs: 30 * DAY, compact: true },
  { topic: TOPICS.signalReceived, partitions: 12, retentionMs: 7 * DAY },
  { topic: TOPICS.correlationDetected, partitions: 6, retentionMs: 14 * DAY },
  { topic: TOPICS.findingDetected, partitions: 6, retentionMs: 30 * DAY },
  { topic: TOPICS.findingUpdated, partitions: 6, retentionMs: 30 * DAY },
  { topic: TOPICS.deploymentCompleted, partitions: 3, retentionMs: 30 * DAY },
  { topic: TOPICS.performanceAlert, partitions: 6, retentionMs: 7 * DAY },
  { topic: TOPICS.riskScoreUpdated, partitions: 6, retentionMs: 90 * DAY, compact: true },
  { topic: TOPICS.incidentCreated, partitions: 3, retentionMs: 90 * DAY },
  { topic: TOPICS.incidentUpdated, partitions: 3, retentionMs: 90 * DAY },
  { topic: TOPICS.systemAlert, partitions: 3, retentionMs: 7 * DAY },
];

/** Dead-letter topic naming convention: <topic>.dlq */
export const dlqTopic = (topic: TopicName): string => `${topic}.dlq`;
