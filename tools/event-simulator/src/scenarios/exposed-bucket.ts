import { nowIso, type Scenario, type SimulatedMessage } from "./index.js";

/** A bucket is opened to the world and immediately read by an unknown IP. */
export function exposedBucket(): Scenario {
  let tick = 0;
  const bucket = "arn:aws:s3:::stratus-customer-exports";

  return {
    description: "Public bucket ACL change followed by anonymous reads",
    next(): SimulatedMessage[] {
      tick += 1;
      if (tick === 1) {
        return [
          {
            source: "cloudtrail",
            body: {
              eventName: "PutBucketAcl",
              eventTime: nowIso(),
              eventSource: "s3.amazonaws.com",
              awsRegion: "us-east-1",
              sourceIPAddress: "203.0.113.44",
              userIdentity: { arn: "arn:aws:iam::111122223333:user/ci-deployer" },
              resources: [{ ARN: bucket }],
              tags: { environment: "production" },
              requestParameters: { acl: "public-read" },
            },
          },
        ];
      }
      if (tick % 4 === 0) {
        return [
          {
            source: "cloudtrail",
            body: {
              eventName: "GetObject",
              eventTime: nowIso(),
              eventSource: "s3.amazonaws.com",
              awsRegion: "us-east-1",
              sourceIPAddress: "198.51.100.7",
              userIdentity: { arn: "anonymous" },
              resources: [{ ARN: bucket }],
              tags: { environment: "production" },
            },
          },
        ];
      }
      return [];
    },
  };
}
