CREATE TABLE IF NOT EXISTS assets (
  id                text PRIMARY KEY,
  organization_id   text NOT NULL,
  project_id        text NOT NULL,
  external_id       text NOT NULL,
  name              text NOT NULL,
  kind              text NOT NULL,
  provider          text NOT NULL,
  environment       text NOT NULL,
  region            text NOT NULL,
  criticality       text NOT NULL DEFAULT 'tier-2',
  internet_exposed  boolean NOT NULL DEFAULT false,
  service           text NOT NULL,
  owner             text NOT NULL DEFAULT 'unassigned',
  tags              jsonb NOT NULL DEFAULT '{}'::jsonb,
  health            text NOT NULL DEFAULT 'healthy',
  risk_score        numeric(5,2) NOT NULL DEFAULT 0,
  discovered_at     timestamptz NOT NULL DEFAULT now(),
  last_seen_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS assets_env_idx ON assets (organization_id, environment);
CREATE INDEX IF NOT EXISTS assets_risk_idx ON assets (risk_score DESC);

CREATE TABLE IF NOT EXISTS findings (
  id                text PRIMARY KEY,
  organization_id   text NOT NULL,
  project_id        text NOT NULL,
  rule_id           text NOT NULL,
  title             text NOT NULL,
  description       text NOT NULL DEFAULT '',
  category          text NOT NULL,
  severity          text NOT NULL,
  status            text NOT NULL DEFAULT 'open',
  asset_id          text NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  asset_name        text NOT NULL,
  environment       text NOT NULL,
  internet_exposed  boolean NOT NULL DEFAULT false,
  risk_score        numeric(5,2) NOT NULL DEFAULT 0,
  remediation       text NOT NULL DEFAULT '',
  references_urls   text[] NOT NULL DEFAULT '{}',
  compliance        text[] NOT NULL DEFAULT '{}',
  evidence          jsonb NOT NULL DEFAULT '{}'::jsonb,
  first_seen_at     timestamptz NOT NULL DEFAULT now(),
  last_seen_at      timestamptz NOT NULL DEFAULT now(),
  resolved_at       timestamptz
);
CREATE INDEX IF NOT EXISTS findings_open_idx ON findings (status, severity);
CREATE INDEX IF NOT EXISTS findings_asset_idx ON findings (asset_id);

CREATE TABLE IF NOT EXISTS incidents (
  id                   text PRIMARY KEY,
  organization_id      text NOT NULL,
  project_id           text NOT NULL,
  title                text NOT NULL,
  priority             text NOT NULL,
  status               text NOT NULL DEFAULT 'open',
  environment          text NOT NULL,
  risk_score           numeric(5,2) NOT NULL DEFAULT 0,
  confidence           numeric(3,2) NOT NULL DEFAULT 0,
  correlation_id       text NOT NULL,
  related_asset_ids    text[] NOT NULL DEFAULT '{}',
  related_finding_ids  text[] NOT NULL DEFAULT '{}',
  timeline             jsonb NOT NULL DEFAULT '[]'::jsonb,
  suggested_actions    jsonb NOT NULL DEFAULT '[]'::jsonb,
  opened_at            timestamptz NOT NULL DEFAULT now(),
  closed_at            timestamptz
);
CREATE INDEX IF NOT EXISTS incidents_open_idx ON incidents (status, priority);
CREATE INDEX IF NOT EXISTS incidents_correlation_idx ON incidents (correlation_id);

-- Hourly roll-up written by the risk engine and read by the trend endpoints.
CREATE TABLE IF NOT EXISTS risk_snapshots (
  bucket            timestamptz NOT NULL,
  organization_id   text NOT NULL,
  environment       text NOT NULL,
  score             numeric(5,2) NOT NULL,
  open_findings     integer NOT NULL DEFAULT 0,
  open_incidents    integer NOT NULL DEFAULT 0,
  PRIMARY KEY (bucket, organization_id, environment)
);
