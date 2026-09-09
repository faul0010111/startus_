import { Kafka, logLevel, type Consumer, type EachMessagePayload, type Producer } from "kafkajs";
import type { z } from "zod";
import { encode, decode, partitionKey, ContractViolationError } from "./serialization.js";
import { TOPIC_SPECS, dlqTopic, type TopicName } from "./topics.js";
import type { StratusEvent } from "./envelope.js";

export interface BusOptions {
  clientId: string;
  brokers: string[];
  groupId?: string;
  onError?: (error: unknown, context: Record<string, unknown>) => void;
  onMetric?: (metric: "consumed" | "produced" | "dlq", labels: Record<string, string>) => void;
}

export interface HandlerContext {
  topic: string;
  partition: number;
  offset: string;
  attempt: number;
}

/**
 * Thin transport binding over kafkajs. Everything the services share about the
 * bus lives here: envelope validation, dead-lettering and at-least-once
 * delivery semantics with manual commit on success.
 */
export class KafkaBus {
  private readonly kafka: Kafka;
  private producer?: Producer;
  private readonly consumers: Consumer[] = [];

  constructor(private readonly options: BusOptions) {
    this.kafka = new Kafka({
      clientId: options.clientId,
      brokers: options.brokers,
      logLevel: logLevel.WARN,
      retry: { initialRetryTime: 300, retries: 8 },
    });
  }

  /** Creates the topics declared in TOPIC_SPECS. Safe to run on every boot. */
  async ensureTopics(): Promise<void> {
    const admin = this.kafka.admin();
    await admin.connect();
    try {
      const existing = new Set(await admin.listTopics());
      const missing = TOPIC_SPECS.filter((s) => !existing.has(s.topic)).flatMap((spec) => [
        {
          topic: spec.topic,
          numPartitions: spec.partitions,
          replicationFactor: 1,
          configEntries: [
            { name: "retention.ms", value: String(spec.retentionMs) },
            { name: "cleanup.policy", value: spec.compact ? "compact" : "delete" },
          ],
        },
        {
          topic: dlqTopic(spec.topic),
          numPartitions: 1,
          replicationFactor: 1,
          configEntries: [{ name: "retention.ms", value: String(spec.retentionMs) }],
        },
      ]);
      if (missing.length) await admin.createTopics({ topics: missing, waitForLeaders: true });
    } finally {
      await admin.disconnect();
    }
  }

  async publish<T>(topic: TopicName, event: StratusEvent<T>, key: string): Promise<void> {
    this.producer ??= this.kafka.producer({ allowAutoTopicCreation: false, idempotent: true });
    await this.producer.connect();
    await this.producer.send({
      topic,
      messages: [
        {
          key: partitionKey(key),
          value: encode(event),
          headers: {
            "x-correlation-id": event.correlationId,
            "x-event-type": event.eventType,
            "x-contract-version": event.version,
          },
        },
      ],
    });
    this.options.onMetric?.("produced", { topic });
  }

  /**
   * Subscribes with schema validation. Payloads that violate the contract go
   * straight to the topic's DLQ so one bad producer cannot stall a partition.
   */
  async subscribe<S extends z.ZodTypeAny>(
    topic: TopicName,
    payloadSchema: S,
    handler: (event: StratusEvent<z.infer<S>>, ctx: HandlerContext) => Promise<void>,
  ): Promise<void> {
    const groupId = this.options.groupId ?? `${this.options.clientId}-group`;
    const consumer = this.kafka.consumer({ groupId, sessionTimeout: 30_000 });
    await consumer.connect();
    await consumer.subscribe({ topic, fromBeginning: false });
    this.consumers.push(consumer);

    await consumer.run({
      autoCommit: true,
      eachMessage: async ({ topic: t, partition, message }: EachMessagePayload) => {
        try {
          const event = decode(t, message.value, payloadSchema);
          await handler(event, {
            topic: t,
            partition,
            offset: message.offset,
            attempt: Number(message.headers?.["x-attempt"]?.toString() ?? "1"),
          });
          this.options.onMetric?.("consumed", { topic: t, outcome: "ok" });
        } catch (error) {
          this.options.onMetric?.("consumed", { topic: t, outcome: "error" });
          this.options.onError?.(error, { topic: t, partition, offset: message.offset });
          await this.deadLetter(topic, message.value, error);
        }
      },
    });
  }

  private async deadLetter(topic: TopicName, value: Buffer | null, error: unknown): Promise<void> {
    this.producer ??= this.kafka.producer({ allowAutoTopicCreation: false });
    await this.producer.connect();
    await this.producer.send({
      topic: dlqTopic(topic),
      messages: [
        {
          value: value ?? Buffer.from("null"),
          headers: {
            "x-error": error instanceof Error ? error.message : String(error),
            "x-error-kind": error instanceof ContractViolationError ? "contract" : "handler",
            "x-failed-at": new Date().toISOString(),
          },
        },
      ],
    });
    this.options.onMetric?.("dlq", { topic });
  }

  async shutdown(): Promise<void> {
    await Promise.allSettled([
      ...this.consumers.map((c) => c.disconnect()),
      this.producer?.disconnect() ?? Promise.resolve(),
    ]);
  }
}
