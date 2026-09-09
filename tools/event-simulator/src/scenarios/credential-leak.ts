import { nowIso, type Scenario, type SimulatedMessage } from "./index.js";

/** A pipeline prints a secret, then that key starts being used from a new IP. */
export function credentialLeak(): Scenario {
  let tick = 0;

  return {
    description: "Secret leaked in a build log and used shortly afterwards",
    next(): SimulatedMessage[] {
      tick += 1;
      if (tick === 1) {
        return [
          {
            source: "github-actions",
            body: {
              workflow_run: {
                id: 99231144,
                name: "build-and-publish",
                head_branch: "feature/debug-env",
                head_sha: "aa11bb22cc33",
                conclusion: "success",
                run_started_at: nowIso(-240),
                updated_at: nowIso(),
                environment: "production",
                actor: { login: "dev-user" },
                repository: { name: "payments" },
              },
            },
          },
        ];
      }
      if (tick === 2) {
        return [
          {
            source: "cloudtrail",
            body: {
              eventName: "CreateAccessKey",
              eventTime: nowIso(),
              eventSource: "iam.amazonaws.com",
              awsRegion: "us-east-1",
              sourceIPAddress: "192.0.2.55",
              userIdentity: { arn: "arn:aws:iam::111122223333:user/payments-ci" },
              resources: [{ ARN: "arn:aws:iam::111122223333:role/payments-ci" }],
              tags: { environment: "production" },
            },
          },
        ];
      }
      if (tick > 6) tick = 0;
      return [];
    },
  };
}
