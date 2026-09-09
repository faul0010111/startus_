# Terraform

Provisions the managed dependencies STRATUS needs: a private VPC, an MSK cluster
for the event bus, an encrypted Postgres instance for the incident store and a
serverless Redis for stream state.

```bash
terraform init
terraform plan  -var environment=staging
terraform apply -var environment=staging
```

The state backend points at an S3 bucket that must exist first. Nothing here is
publicly reachable by design — the platform is deployed behind a private
ingress and reached through the cluster.
