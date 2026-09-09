import type { Provider } from "@nestjs/common";
import { KafkaBus } from "@stratus/event-contracts";
import { loadConfig } from "@stratus/config";
import { createLogger, eventsProduced, eventsConsumed } from "@stratus/observability";

export const BUS = Symbol("STRATUS_BUS");

/**
 * One bus per service process. Metrics and errors are wired here so every
 * service reports the same counters without repeating the plumbing.
 */
export const BusProvider: Provider = {
  provide: BUS,
  useFactory: async () => {
    const config = loadConfig("security-engine", 4030);
    const log = createLogger(config.serviceName);
    const bus = new KafkaBus({
      clientId: config.serviceName,
      brokers: config.brokers,
      groupId: `${config.serviceName}-group`,
      onError: (error, ctx) => log.error({ err: error, ...ctx }, "bus failure"),
      onMetric: (metric, labels) => {
        if (metric === "produced") eventsProduced.inc({ service: config.serviceName, topic: labels.topic ?? "unknown" });
        if (metric === "consumed")
          eventsConsumed.inc({
            service: config.serviceName,
            topic: labels.topic ?? "unknown",
            outcome: labels.outcome ?? "ok",
          });
      },
    });
    await bus.ensureTopics();
    return bus;
  },
};
