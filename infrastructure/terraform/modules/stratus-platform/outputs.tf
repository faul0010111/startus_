output "kafka_bootstrap_brokers" {
  value     = aws_msk_cluster.bus.bootstrap_brokers_tls
  sensitive = true
}

output "database_endpoint" {
  value     = aws_db_instance.incidents.endpoint
  sensitive = true
}

output "cluster_name" {
  value = "stratus-${var.environment}"
}
