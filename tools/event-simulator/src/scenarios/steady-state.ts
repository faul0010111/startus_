import { choose, nowIso, SERVICES, type Scenario, type SimulatedMessage } from "./index.js";

/** Background noise: routine audit and cluster events, nothing alarming. */
export function steadyState(): Scenario {
  return {
    description: "Routine audit and Kubernetes events with occasional warnings",
    next(): SimulatedMessage[] {
      const service = choose(SERVICES);
      if (Math.random() < 0.5) {
        return [
          {
            source: "cloudtrail",
            body: {
              eventName: choose(["DescribeInstances", "GetObject", "AssumeRole", "CreateAccessKey"]),
              eventTime: nowIso(),
              eventSource: "ec2.amazonaws.com",
              awsRegion: "us-east-1",
              sourceIPAddress: "10.4.2.11",
              userIdentity: { arn: `arn:aws:iam::111122223333:role/${service}` },
              resources: [{ ARN: `arn:aws:ec2:us-east-1:111122223333:instance/${service}` }],
            },
          },
        ];
      }
      return [
        {
          source: "kubernetes",
          body: {
            metadata: { namespace: service, labels: { environment: "production", "app.kubernetes.io/name": service } },
            involvedObject: { kind: "Pod", name: `${service}-7d9f` },
            reason: choose(["Scheduled", "Pulled", "Started", "BackOff"]),
            type: Math.random() < 0.2 ? "Warning" : "Normal",
            message: "Container lifecycle event",
            lastTimestamp: nowIso(),
          },
        },
      ];
    },
  };
}
