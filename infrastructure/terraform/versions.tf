terraform {
  required_version = ">= 1.6.0"

  required_providers {
    aws        = { source = "hashicorp/aws", version = "~> 5.60" }
    kubernetes = { source = "hashicorp/kubernetes", version = "~> 2.32" }
  }

  # Replace with the bucket created by bootstrap/ before running in a real account.
  backend "s3" {
    bucket         = "stratus-tfstate"
    key            = "platform/terraform.tfstate"
    region         = "us-east-1"
    dynamodb_table = "stratus-tf-locks"
    encrypt        = true
  }
}

provider "aws" {
  region = var.region
  default_tags {
    tags = {
      Project     = "stratus"
      Environment = var.environment
      ManagedBy   = "terraform"
    }
  }
}
