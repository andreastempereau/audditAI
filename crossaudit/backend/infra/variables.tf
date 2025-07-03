# CrossAudit AI Infrastructure Variables

variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "us-east-1"
}

variable "project_name" {
  description = "Project name"
  type        = string
  default     = "crossaudit"
}

variable "environment" {
  description = "Environment name"
  type        = string
  validation {
    condition     = contains(["development", "staging", "production"], var.environment)
    error_message = "Environment must be development, staging, or production."
  }
}

variable "image_tag" {
  description = "Docker image tag to deploy"
  type        = string
  default     = "latest"
}

# Blue-Green Deployment Variables
variable "blue_green_deployment" {
  description = "Enable blue-green deployment"
  type        = bool
  default     = false
}

variable "deployment_color" {
  description = "Deployment color (blue or green)"
  type        = string
  default     = "blue"
  validation {
    condition     = contains(["blue", "green"], var.deployment_color)
    error_message = "Deployment color must be blue or green."
  }
}

# Networking
variable "vpc_cidr" {
  description = "VPC CIDR block"
  type        = string
  default     = "10.0.0.0/16"
}

variable "public_subnet_cidrs" {
  description = "Public subnet CIDR blocks"
  type        = list(string)
  default     = ["10.0.1.0/24", "10.0.2.0/24"]
}

variable "private_subnet_cidrs" {
  description = "Private subnet CIDR blocks"
  type        = list(string)
  default     = ["10.0.10.0/24", "10.0.20.0/24"]
}

variable "enable_nat_gateway" {
  description = "Enable NAT Gateway for private subnets"
  type        = bool
  default     = true
}

# Database
variable "db_name" {
  description = "Database name"
  type        = string
  default     = "crossaudit"
}

variable "db_username" {
  description = "Database username"
  type        = string
  default     = "crossaudit"
}

variable "db_password" {
  description = "Database password"
  type        = string
  sensitive   = true
}

variable "db_instance_class" {
  description = "Database instance class"
  type        = string
  default     = "db.r6g.large"
}

variable "db_instance_count" {
  description = "Number of database instances"
  type        = number
  default     = 2
}

variable "db_backup_retention_period" {
  description = "Database backup retention period in days"
  type        = number
  default     = 7
}

# Redis
variable "redis_node_type" {
  description = "Redis node type"
  type        = string
  default     = "cache.r7g.large"
}

variable "redis_num_nodes" {
  description = "Number of Redis nodes"
  type        = number
  default     = 2
}

variable "redis_auth_token" {
  description = "Redis authentication token"
  type        = string
  sensitive   = true
}

# ECS Configuration
variable "api_cpu" {
  description = "API container CPU units"
  type        = number
  default     = 1024
}

variable "api_memory" {
  description = "API container memory in MB"
  type        = number
  default     = 2048
}

variable "api_desired_count" {
  description = "Desired number of API tasks"
  type        = number
  default     = 2
}

variable "api_min_capacity" {
  description = "Minimum number of API tasks"
  type        = number
  default     = 1
}

variable "api_max_capacity" {
  description = "Maximum number of API tasks"
  type        = number
  default     = 10
}

# Worker Configuration
variable "worker_cpu" {
  description = "Worker container CPU units"
  type        = number
  default     = 512
}

variable "worker_memory" {
  description = "Worker container memory in MB"
  type        = number
  default     = 1024
}

variable "worker_desired_count" {
  description = "Desired number of worker tasks"
  type        = number
  default     = 2
}

# Monitoring
variable "log_retention_days" {
  description = "CloudWatch log retention in days"
  type        = number
  default     = 14
}

variable "enable_monitoring" {
  description = "Enable Prometheus and Grafana monitoring"
  type        = bool
  default     = false
}

variable "grafana_admin_password" {
  description = "Grafana admin password"
  type        = string
  sensitive   = true
  default     = ""
}

# Alerting
variable "sns_alarm_topic_arn" {
  description = "SNS topic ARN for alarms"
  type        = string
  default     = ""
}

# Billing
variable "stripe_secret_key" {
  description = "Stripe secret key"
  type        = string
  sensitive   = true
  default     = ""
}

variable "stripe_webhook_secret" {
  description = "Stripe webhook secret"
  type        = string
  sensitive   = true
  default     = ""
}

variable "stripe_starter_price_id" {
  description = "Stripe starter plan price ID"
  type        = string
  default     = ""
}

variable "stripe_business_price_id" {
  description = "Stripe business plan price ID"
  type        = string
  default     = ""
}

variable "stripe_enterprise_price_id" {
  description = "Stripe enterprise plan price ID"
  type        = string
  default     = ""
}

# External API Keys
variable "openai_api_key" {
  description = "OpenAI API key"
  type        = string
  sensitive   = true
  default     = ""
}

variable "anthropic_api_key" {
  description = "Anthropic API key"
  type        = string
  sensitive   = true
  default     = ""
}

variable "google_ai_api_key" {
  description = "Google AI API key"
  type        = string
  sensitive   = true
  default     = ""
}

# Security
variable "jwt_secret_key" {
  description = "JWT secret key"
  type        = string
  sensitive   = true
}

variable "encryption_key" {
  description = "Encryption key for sensitive data"
  type        = string
  sensitive   = true
}

# Domain Configuration
variable "domain_name" {
  description = "Domain name for the application"
  type        = string
  default     = ""
}

variable "certificate_arn" {
  description = "ACM certificate ARN for HTTPS"
  type        = string
  default     = ""
}

# Feature Flags
variable "enable_data_room" {
  description = "Enable data room functionality"
  type        = bool
  default     = true
}

variable "enable_governance" {
  description = "Enable AI governance features"
  type        = bool
  default     = true
}

variable "enable_billing" {
  description = "Enable billing integration"
  type        = bool
  default     = true
}

variable "enable_analytics" {
  description = "Enable analytics and monitoring"
  type        = bool
  default     = true
}

# Resource Tags
variable "tags" {
  description = "Additional tags for resources"
  type        = map(string)
  default     = {}
}