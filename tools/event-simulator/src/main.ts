import { parseArgs } from "node:util";
import { SCENARIOS, type ScenarioName } from "./scenarios/index.js";
import { send } from "./client.js";

const { values } = parseArgs({
  options: {
    scenario: { type: "string", default: "steady-state" },
    endpoint: { type: "string", default: process.env.SIGNAL_ENGINE_URL ?? "http://localhost:4010" },
    rate: { type: "string", default: "4" },
    duration: { type: "string", default: "120" },
    list: { type: "boolean", default: false },
  },
});

if (values.list) {
  console.log("Available scenarios:\n" + Object.keys(SCENARIOS).map((s) => `  - ${s}`).join("\n"));
  process.exit(0);
}

const name = values.scenario as ScenarioName;
const scenario = SCENARIOS[name];
if (!scenario) {
  console.error(`Unknown scenario "${name}". Run with --list to see the options.`);
  process.exit(1);
}

const endpoint = values.endpoint as string;
const ratePerSecond = Number(values.rate);
const durationSeconds = Number(values.duration);

console.log(`▲ STRATUS simulator — ${name} → ${endpoint} (${ratePerSecond}/s for ${durationSeconds}s)`);

let sent = 0;
const deadline = Date.now() + durationSeconds * 1000;
const interval = Math.max(10, Math.floor(1000 / ratePerSecond));

const timer = setInterval(async () => {
  if (Date.now() > deadline) {
    clearInterval(timer);
    console.log(`done — ${sent} signals sent`);
    return;
  }
  for (const message of scenario.next()) {
    await send(endpoint, message.source, message.body).catch((error) => console.error("send failed", error.message));
    sent += 1;
  }
}, interval);

process.on("SIGINT", () => {
  clearInterval(timer);
  console.log(`\ninterrupted — ${sent} signals sent`);
  process.exit(0);
});
