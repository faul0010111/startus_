module "platform" {
  source = "./modules/stratus-platform"

  environment             = var.environment
  region                  = var.region
  vpc_cidr                = var.vpc_cidr
  database_instance_class = var.database_instance_class
  kafka_broker_count      = var.kafka_broker_count
}
