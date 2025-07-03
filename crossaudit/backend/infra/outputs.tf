# CrossAudit AI Infrastructure Outputs

# Networking
output "vpc_id" {
  description = "ID of the VPC"
  value       = aws_vpc.main.id
}

output "vpc_cidr_block" {
  description = "CIDR block of the VPC"
  value       = aws_vpc.main.cidr_block
}

output "public_subnet_ids" {
  description = "IDs of the public subnets"
  value       = aws_subnet.public[*].id
}

output "private_subnet_ids" {
  description = "IDs of the private subnets"
  value       = aws_subnet.private[*].id
}

output "internet_gateway_id" {
  description = "ID of the Internet Gateway"
  value       = aws_internet_gateway.main.id
}

output "nat_gateway_ids" {
  description = "IDs of the NAT Gateways"
  value       = aws_nat_gateway.main[*].id
}

# Security Groups
output "alb_security_group_id" {
  description = "ID of the ALB security group"
  value       = aws_security_group.alb.id
}

output "ecs_security_group_id" {
  description = "ID of the ECS security group"
  value       = aws_security_group.ecs.id
}

output "rds_security_group_id" {
  description = "ID of the RDS security group"
  value       = aws_security_group.rds.id
}

output "redis_security_group_id" {
  description = "ID of the Redis security group"
  value       = aws_security_group.redis.id
}

# Load Balancer
output "alb_arn" {
  description = "ARN of the Application Load Balancer"
  value       = aws_lb.main.arn
}

output "alb_dns_name" {
  description = "DNS name of the Application Load Balancer"
  value       = aws_lb.main.dns_name
}

output "alb_zone_id" {
  description = "Zone ID of the Application Load Balancer"
  value       = aws_lb.main.zone_id
}

output "api_target_group_arn" {
  description = "ARN of the API target group"
  value       = aws_lb_target_group.api.arn
}

# Database
output "rds_cluster_endpoint" {
  description = "RDS cluster endpoint"
  value       = aws_rds_cluster.postgres.endpoint
  sensitive   = true
}

output "rds_cluster_reader_endpoint" {
  description = "RDS cluster reader endpoint"
  value       = aws_rds_cluster.postgres.reader_endpoint
  sensitive   = true
}

output "rds_cluster_id" {
  description = "RDS cluster identifier"
  value       = aws_rds_cluster.postgres.cluster_identifier
}

output "rds_cluster_arn" {
  description = "RDS cluster ARN"
  value       = aws_rds_cluster.postgres.arn
}

output "database_url" {
  description = "Database connection URL"
  value       = "postgresql://${var.db_username}:${var.db_password}@${aws_rds_cluster.postgres.endpoint}:5432/${var.db_name}"
  sensitive   = true
}

# Redis
output "redis_endpoint" {
  description = "Redis cluster endpoint"
  value       = aws_elasticache_replication_group.redis.configuration_endpoint_address
  sensitive   = true
}

output "redis_port" {
  description = "Redis port"
  value       = aws_elasticache_replication_group.redis.port
}

output "redis_url" {
  description = "Redis connection URL"
  value       = "redis://:${var.redis_auth_token}@${aws_elasticache_replication_group.redis.configuration_endpoint_address}:${aws_elasticache_replication_group.redis.port}"
  sensitive   = true
}

# ECS
output "ecs_cluster_id" {
  description = "ID of the ECS cluster"
  value       = aws_ecs_cluster.main.id
}

output "ecs_cluster_arn" {
  description = "ARN of the ECS cluster"
  value       = aws_ecs_cluster.main.arn
}

output "api_service_name" {
  description = "Name of the API ECS service"
  value       = aws_ecs_service.api.name
}

output "api_task_definition_arn" {
  description = "ARN of the API task definition"
  value       = aws_ecs_task_definition.api.arn
}

# IAM
output "ecs_execution_role_arn" {
  description = "ARN of the ECS execution role"
  value       = aws_iam_role.ecs_execution.arn
}

output "ecs_task_role_arn" {
  description = "ARN of the ECS task role"
  value       = aws_iam_role.ecs_task.arn
}

# Storage
output "s3_bucket_id" {
  description = "ID of the S3 bucket for documents"
  value       = aws_s3_bucket.documents.id
}

output "s3_bucket_arn" {
  description = "ARN of the S3 bucket for documents"
  value       = aws_s3_bucket.documents.arn
}

output "s3_bucket_domain_name" {
  description = "Domain name of the S3 bucket"
  value       = aws_s3_bucket.documents.bucket_domain_name
}

# KMS
output "kms_key_id" {
  description = "ID of the KMS key"
  value       = aws_kms_key.main.key_id
}

output "kms_key_arn" {
  description = "ARN of the KMS key"
  value       = aws_kms_key.main.arn
}

output "kms_alias_name" {
  description = "Name of the KMS alias"
  value       = aws_kms_alias.main.name
}

# ECR
output "ecr_repository_url" {
  description = "URL of the ECR repository"
  value       = aws_ecr_repository.api.repository_url
}

output "ecr_repository_arn" {
  description = "ARN of the ECR repository"
  value       = aws_ecr_repository.api.arn
}

# CloudWatch
output "api_log_group_name" {
  description = "Name of the API CloudWatch log group"
  value       = aws_cloudwatch_log_group.api.name
}

output "api_log_group_arn" {
  description = "ARN of the API CloudWatch log group"
  value       = aws_cloudwatch_log_group.api.arn
}

output "celery_log_group_name" {
  description = "Name of the Celery CloudWatch log group"
  value       = aws_cloudwatch_log_group.celery.name
}

# Environment Variables for Application
output "environment_variables" {
  description = "Environment variables for the application"
  value = {
    ENVIRONMENT               = var.environment
    DATABASE_URL             = "postgresql://${var.db_username}:${var.db_password}@${aws_rds_cluster.postgres.endpoint}:5432/${var.db_name}"
    REDIS_URL                = "redis://:${var.redis_auth_token}@${aws_elasticache_replication_group.redis.configuration_endpoint_address}:${aws_elasticache_replication_group.redis.port}"
    S3_BUCKET                = aws_s3_bucket.documents.id
    KMS_KEY_ID               = aws_kms_key.main.key_id
    AWS_REGION               = var.aws_region
    JWT_SECRET_KEY           = var.jwt_secret_key
    ENCRYPTION_KEY           = var.encryption_key
    STRIPE_SECRET_KEY        = var.stripe_secret_key
    STRIPE_WEBHOOK_SECRET    = var.stripe_webhook_secret
    OPENAI_API_KEY          = var.openai_api_key
    ANTHROPIC_API_KEY       = var.anthropic_api_key
    GOOGLE_AI_API_KEY       = var.google_ai_api_key
  }
  sensitive = true
}

# Blue-Green Deployment Outputs
output "deployment_color" {
  description = "Current deployment color"
  value       = var.deployment_color
}

output "blue_green_enabled" {
  description = "Whether blue-green deployment is enabled"
  value       = var.blue_green_deployment
}

# Application URLs
output "application_url" {
  description = "Application URL"
  value       = var.domain_name != "" ? "https://${var.domain_name}" : "http://${aws_lb.main.dns_name}"
}

output "api_url" {
  description = "API base URL"
  value       = var.domain_name != "" ? "https://${var.domain_name}/api" : "http://${aws_lb.main.dns_name}/api"
}

# Monitoring URLs
output "grafana_url" {
  description = "Grafana dashboard URL"
  value       = var.enable_monitoring ? "http://${aws_lb.main.dns_name}:3000" : null
}

output "prometheus_url" {
  description = "Prometheus URL"
  value       = var.enable_monitoring ? "http://${aws_lb.main.dns_name}:9090" : null
}

# Health Check Endpoints
output "health_check_urls" {
  description = "Health check endpoints"
  value = {
    main     = "${var.domain_name != "" ? "https://${var.domain_name}" : "http://${aws_lb.main.dns_name}"}/health"
    api      = "${var.domain_name != "" ? "https://${var.domain_name}" : "http://${aws_lb.main.dns_name}"}/api/health"
    database = "${var.domain_name != "" ? "https://${var.domain_name}" : "http://${aws_lb.main.dns_name}"}/api/health/db"
    redis    = "${var.domain_name != "" ? "https://${var.domain_name}" : "http://${aws_lb.main.dns_name}"}/api/health/redis"
  }
}

# Resource Information
output "resource_summary" {
  description = "Summary of deployed resources"
  value = {
    project_name    = var.project_name
    environment     = var.environment
    aws_region      = var.aws_region
    deployment_time = timestamp()
    image_tag       = var.image_tag
    vpc_id          = aws_vpc.main.id
    cluster_name    = aws_ecs_cluster.main.name
    database_engine = "aurora-postgresql"
    redis_engine    = "redis"
    monitoring      = var.enable_monitoring
    blue_green      = var.blue_green_deployment
  }
}