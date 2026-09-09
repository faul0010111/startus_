# Network. Private subnets only for data services; nothing in this module is
# given a public IP, which is the same rule the CLOUD-DB-PUBLIC finding enforces.
resource "aws_vpc" "this" {
  cidr_block           = var.vpc_cidr
  enable_dns_hostnames = true
  enable_dns_support   = true
  tags                 = { Name = "stratus-${var.environment}" }
}

resource "aws_subnet" "private" {
  count             = 3
  vpc_id            = aws_vpc.this.id
  cidr_block        = cidrsubnet(var.vpc_cidr, 4, count.index)
  availability_zone = data.aws_availability_zones.available.names[count.index]
  tags              = { Name = "stratus-private-${count.index}", Tier = "private" }
}

data "aws_availability_zones" "available" {
  state = "available"
}

resource "aws_kms_key" "stratus" {
  description             = "STRATUS platform encryption key"
  enable_key_rotation     = true
  deletion_window_in_days = 30
}

# Event bus.
resource "aws_msk_cluster" "bus" {
  cluster_name           = "stratus-${var.environment}"
  kafka_version          = "3.7.x"
  number_of_broker_nodes = var.kafka_broker_count

  broker_node_group_info {
    instance_type   = "kafka.m5.large"
    client_subnets  = aws_subnet.private[*].id
    security_groups = [aws_security_group.bus.id]
    storage_info {
      ebs_storage_info { volume_size = 200 }
    }
  }

  encryption_info {
    encryption_at_rest_kms_key_arn = aws_kms_key.stratus.arn
    encryption_in_transit {
      client_broker = "TLS"
      in_cluster    = true
    }
  }
}

resource "aws_security_group" "bus" {
  name        = "stratus-bus-${var.environment}"
  description = "Broker access from the platform subnets only"
  vpc_id      = aws_vpc.this.id

  ingress {
    description = "Kafka TLS from inside the VPC"
    from_port   = 9094
    to_port     = 9094
    protocol    = "tcp"
    cidr_blocks = [var.vpc_cidr]
  }

  egress {
    description = "Broker egress"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = [var.vpc_cidr]
  }
}

# Incident store.
resource "aws_db_subnet_group" "this" {
  name       = "stratus-${var.environment}"
  subnet_ids = aws_subnet.private[*].id
}

resource "aws_db_instance" "incidents" {
  identifier                  = "stratus-${var.environment}"
  engine                      = "postgres"
  engine_version              = "16.3"
  instance_class              = var.database_instance_class
  allocated_storage           = 100
  storage_encrypted           = true
  kms_key_id                  = aws_kms_key.stratus.arn
  db_subnet_group_name        = aws_db_subnet_group.this.name
  publicly_accessible         = false
  deletion_protection         = var.environment == "production"
  backup_retention_period     = 14
  auto_minor_version_upgrade  = true
  manage_master_user_password = true
  username                    = "stratus"
  skip_final_snapshot         = var.environment != "production"
}

resource "aws_elasticache_serverless_cache" "state" {
  engine = "redis"
  name   = "stratus-${var.environment}"
  cache_usage_limits {
    data_storage {
      maximum = 5
      unit    = "GB"
    }
    ecpu_per_second { maximum = 5000 }
  }
  subnet_ids         = aws_subnet.private[*].id
  security_group_ids = [aws_security_group.bus.id]
  kms_key_id         = aws_kms_key.stratus.arn
}
