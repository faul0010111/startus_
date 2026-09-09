variable "region" {
  description = "AWS region for the platform"
  type        = string
  default     = "us-east-1"
}

variable "environment" {
  description = "Deployment environment name"
  type        = string
  default     = "production"

  validation {
    condition     = contains(["production", "staging", "development", "sandbox"], var.environment)
    error_message = "environment must match one of the STRATUS environment names."
  }
}

variable "vpc_cidr" {
  description = "CIDR block for the platform VPC"
  type        = string
  default     = "10.42.0.0/16"
}

variable "database_instance_class" {
  description = "Instance class for the incident store"
  type        = string
  default     = "db.t4g.medium"
}

variable "kafka_broker_count" {
  description = "Number of MSK brokers"
  type        = number
  default     = 3
}
