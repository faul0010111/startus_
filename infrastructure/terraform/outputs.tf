output "kafka_bootstrap_brokers" {
  description = "TLS bootstrap endpoint for the event bus"
  value       = module.platform.kafka_bootstrap_brokers
  sensitive   = true
}

output "database_endpoint" {
  description = "Endpoint of the incident store"
  value       = module.platform.database_endpoint
  sensitive   = true
}

output "cluster_name" {
  description = "EKS cluster hosting the STRATUS services"
  value       = module.platform.cluster_name
}
