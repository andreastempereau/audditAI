# CrossAudit AI Governance Platform - Terraform Infrastructure
# Provisions: Supabase, Redis cluster, TimescaleDB, KMS keys, S3, ECS Fargate

terraform {
  required_version = ">= 1.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    supabase = {
      source  = "supabase/supabase"
      version = "~> 1.0"
    }
    grafana = {
      source  = "grafana/grafana"
      version = "~> 2.0"
    }
  }
}

provider "aws" {
  region = var.aws_region
  
  default_tags {
    tags = {
      Project     = "CrossAudit AI"
      Environment = var.environment
      ManagedBy   = "Terraform"
    }
  }
}

# Data sources
data "aws_availability_zones" "available" {
  state = "available"
}

data "aws_caller_identity" "current" {}

# VPC and Networking
resource "aws_vpc" "main" {
  cidr_block           = var.vpc_cidr
  enable_dns_hostnames = true
  enable_dns_support   = true

  tags = {
    Name = "${var.project_name}-${var.environment}-vpc"
  }
}

resource "aws_internet_gateway" "main" {
  vpc_id = aws_vpc.main.id

  tags = {
    Name = "${var.project_name}-${var.environment}-igw"
  }
}

resource "aws_subnet" "public" {
  count = length(var.public_subnet_cidrs)

  vpc_id                  = aws_vpc.main.id
  cidr_block              = var.public_subnet_cidrs[count.index]
  availability_zone       = data.aws_availability_zones.available.names[count.index]
  map_public_ip_on_launch = true

  tags = {
    Name = "${var.project_name}-${var.environment}-public-${count.index + 1}"
    Type = "Public"
  }
}

resource "aws_subnet" "private" {
  count = length(var.private_subnet_cidrs)

  vpc_id            = aws_vpc.main.id
  cidr_block        = var.private_subnet_cidrs[count.index]
  availability_zone = data.aws_availability_zones.available.names[count.index]

  tags = {
    Name = "${var.project_name}-${var.environment}-private-${count.index + 1}"
    Type = "Private"
  }
}

resource "aws_route_table" "public" {
  vpc_id = aws_vpc.main.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.main.id
  }

  tags = {
    Name = "${var.project_name}-${var.environment}-public-rt"
  }
}

resource "aws_route_table_association" "public" {
  count = length(aws_subnet.public)

  subnet_id      = aws_subnet.public[count.index].id
  route_table_id = aws_route_table.public.id
}

# NAT Gateway for private subnets
resource "aws_eip" "nat" {
  count = var.enable_nat_gateway ? length(aws_subnet.public) : 0
  
  domain = "vpc"
  
  tags = {
    Name = "${var.project_name}-${var.environment}-nat-eip-${count.index + 1}"
  }
}

resource "aws_nat_gateway" "main" {
  count = var.enable_nat_gateway ? length(aws_subnet.public) : 0

  allocation_id = aws_eip.nat[count.index].id
  subnet_id     = aws_subnet.public[count.index].id

  tags = {
    Name = "${var.project_name}-${var.environment}-nat-${count.index + 1}"
  }

  depends_on = [aws_internet_gateway.main]
}

resource "aws_route_table" "private" {
  count = var.enable_nat_gateway ? length(aws_subnet.private) : 0

  vpc_id = aws_vpc.main.id

  route {
    cidr_block     = "0.0.0.0/0"
    nat_gateway_id = aws_nat_gateway.main[count.index].id
  }

  tags = {
    Name = "${var.project_name}-${var.environment}-private-rt-${count.index + 1}"
  }
}

resource "aws_route_table_association" "private" {
  count = var.enable_nat_gateway ? length(aws_subnet.private) : 0

  subnet_id      = aws_subnet.private[count.index].id
  route_table_id = aws_route_table.private[count.index].id
}

# Security Groups
resource "aws_security_group" "alb" {
  name_prefix = "${var.project_name}-${var.environment}-alb-"
  vpc_id      = aws_vpc.main.id

  ingress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "${var.project_name}-${var.environment}-alb-sg"
  }
}

resource "aws_security_group" "ecs" {
  name_prefix = "${var.project_name}-${var.environment}-ecs-"
  vpc_id      = aws_vpc.main.id

  ingress {
    from_port       = 8000
    to_port         = 8000
    protocol        = "tcp"
    security_groups = [aws_security_group.alb.id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "${var.project_name}-${var.environment}-ecs-sg"
  }
}

resource "aws_security_group" "redis" {
  name_prefix = "${var.project_name}-${var.environment}-redis-"
  vpc_id      = aws_vpc.main.id

  ingress {
    from_port       = 6379
    to_port         = 6379
    protocol        = "tcp"
    security_groups = [aws_security_group.ecs.id]
  }

  tags = {
    Name = "${var.project_name}-${var.environment}-redis-sg"
  }
}

resource "aws_security_group" "rds" {
  name_prefix = "${var.project_name}-${var.environment}-rds-"
  vpc_id      = aws_vpc.main.id

  ingress {
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.ecs.id]
  }

  tags = {
    Name = "${var.project_name}-${var.environment}-rds-sg"
  }
}

# KMS Keys for encryption
resource "aws_kms_key" "main" {
  description             = "CrossAudit AI encryption key"
  deletion_window_in_days = 7

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          AWS = "arn:aws:iam::${data.aws_caller_identity.current.account_id}:root"
        }
        Action   = "kms:*"
        Resource = "*"
      }
    ]
  })

  tags = {
    Name = "${var.project_name}-${var.environment}-kms-key"
  }
}

resource "aws_kms_alias" "main" {
  name          = "alias/${var.project_name}-${var.environment}"
  target_key_id = aws_kms_key.main.key_id
}

# S3 Bucket for document storage
resource "aws_s3_bucket" "documents" {
  bucket = "${var.project_name}-${var.environment}-documents-${random_string.bucket_suffix.result}"

  tags = {
    Name = "${var.project_name}-${var.environment}-documents"
  }
}

resource "random_string" "bucket_suffix" {
  length  = 8
  special = false
  upper   = false
}

resource "aws_s3_bucket_versioning" "documents" {
  bucket = aws_s3_bucket.documents.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "documents" {
  bucket = aws_s3_bucket.documents.id

  rule {
    apply_server_side_encryption_by_default {
      kms_master_key_id = aws_kms_key.main.arn
      sse_algorithm     = "aws:kms"
    }
  }
}

resource "aws_s3_bucket_public_access_block" "documents" {
  bucket = aws_s3_bucket.documents.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# Redis Cluster
resource "aws_elasticache_subnet_group" "redis" {
  name       = "${var.project_name}-${var.environment}-redis-subnet-group"
  subnet_ids = aws_subnet.private[*].id

  tags = {
    Name = "${var.project_name}-${var.environment}-redis-subnet-group"
  }
}

resource "aws_elasticache_replication_group" "redis" {
  replication_group_id         = "${var.project_name}-${var.environment}-redis"
  description                  = "Redis cluster for CrossAudit AI"
  
  port                         = 6379
  parameter_group_name         = "default.redis7"
  node_type                    = var.redis_node_type
  num_cache_clusters           = var.redis_num_nodes
  
  engine_version               = "7.0"
  at_rest_encryption_enabled   = true
  transit_encryption_enabled   = true
  auth_token                   = var.redis_auth_token
  
  subnet_group_name            = aws_elasticache_subnet_group.redis.name
  security_group_ids           = [aws_security_group.redis.id]
  
  automatic_failover_enabled   = var.redis_num_nodes > 1
  multi_az_enabled            = var.redis_num_nodes > 1

  tags = {
    Name = "${var.project_name}-${var.environment}-redis"
  }
}

# RDS PostgreSQL with TimescaleDB
resource "aws_db_subnet_group" "postgres" {
  name       = "${var.project_name}-${var.environment}-postgres-subnet-group"
  subnet_ids = aws_subnet.private[*].id

  tags = {
    Name = "${var.project_name}-${var.environment}-postgres-subnet-group"
  }
}

resource "aws_rds_cluster" "postgres" {
  cluster_identifier     = "${var.project_name}-${var.environment}-postgres"
  engine                 = "aurora-postgresql"
  engine_version         = "15.4"
  
  database_name          = var.db_name
  master_username        = var.db_username
  master_password        = var.db_password
  
  vpc_security_group_ids = [aws_security_group.rds.id]
  db_subnet_group_name   = aws_db_subnet_group.postgres.name
  
  storage_encrypted      = true
  kms_key_id            = aws_kms_key.main.arn
  
  backup_retention_period = var.db_backup_retention_period
  preferred_backup_window = "03:00-04:00"
  preferred_maintenance_window = "sun:04:00-sun:05:00"
  
  skip_final_snapshot = var.environment != "production"
  final_snapshot_identifier = var.environment == "production" ? "${var.project_name}-${var.environment}-final-snapshot-${formatdate("YYYY-MM-DD-hhmm", timestamp())}" : null
  
  # Enable performance insights
  performance_insights_enabled = true
  performance_insights_kms_key_id = aws_kms_key.main.arn
  
  tags = {
    Name = "${var.project_name}-${var.environment}-postgres"
  }
}

resource "aws_rds_cluster_instance" "postgres" {
  count              = var.db_instance_count
  identifier         = "${var.project_name}-${var.environment}-postgres-${count.index}"
  cluster_identifier = aws_rds_cluster.postgres.id
  instance_class     = var.db_instance_class
  engine             = aws_rds_cluster.postgres.engine
  engine_version     = aws_rds_cluster.postgres.engine_version
  
  performance_insights_enabled = true
  performance_insights_kms_key_id = aws_kms_key.main.arn
  
  tags = {
    Name = "${var.project_name}-${var.environment}-postgres-${count.index}"
  }
}

# ECS Cluster
resource "aws_ecs_cluster" "main" {
  name = "${var.project_name}-${var.environment}"

  setting {
    name  = "containerInsights"
    value = "enabled"
  }

  tags = {
    Name = "${var.project_name}-${var.environment}-ecs-cluster"
  }
}

# Application Load Balancer
resource "aws_lb" "main" {
  name               = "${var.project_name}-${var.environment}-alb"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [aws_security_group.alb.id]
  subnets            = aws_subnet.public[*].id

  enable_deletion_protection = var.environment == "production"

  tags = {
    Name = "${var.project_name}-${var.environment}-alb"
  }
}

resource "aws_lb_target_group" "api" {
  name     = "${var.project_name}-${var.environment}-api-tg"
  port     = 8000
  protocol = "HTTP"
  vpc_id   = aws_vpc.main.id

  health_check {
    enabled             = true
    healthy_threshold   = 2
    unhealthy_threshold = 2
    timeout             = 5
    interval            = 30
    path                = "/health"
    matcher             = "200"
    port                = "traffic-port"
    protocol            = "HTTP"
  }

  tags = {
    Name = "${var.project_name}-${var.environment}-api-tg"
  }
}

resource "aws_lb_listener" "api" {
  load_balancer_arn = aws_lb.main.arn
  port              = "80"
  protocol          = "HTTP"

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.api.arn
  }
}

# CloudWatch Log Groups
resource "aws_cloudwatch_log_group" "api" {
  name              = "/ecs/${var.project_name}-${var.environment}-api"
  retention_in_days = var.log_retention_days

  tags = {
    Name = "${var.project_name}-${var.environment}-api-logs"
  }
}

resource "aws_cloudwatch_log_group" "celery" {
  name              = "/ecs/${var.project_name}-${var.environment}-celery"
  retention_in_days = var.log_retention_days

  tags = {
    Name = "${var.project_name}-${var.environment}-celery-logs"
  }
}

# IAM Roles for ECS
resource "aws_iam_role" "ecs_execution" {
  name = "${var.project_name}-${var.environment}-ecs-execution-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "ecs-tasks.amazonaws.com"
        }
      }
    ]
  })

  tags = {
    Name = "${var.project_name}-${var.environment}-ecs-execution-role"
  }
}

resource "aws_iam_role_policy_attachment" "ecs_execution" {
  role       = aws_iam_role.ecs_execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

resource "aws_iam_role" "ecs_task" {
  name = "${var.project_name}-${var.environment}-ecs-task-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "ecs-tasks.amazonaws.com"
        }
      }
    ]
  })

  tags = {
    Name = "${var.project_name}-${var.environment}-ecs-task-role"
  }
}

resource "aws_iam_role_policy" "ecs_task" {
  name = "${var.project_name}-${var.environment}-ecs-task-policy"
  role = aws_iam_role.ecs_task.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:PutObject",
          "s3:DeleteObject",
          "s3:ListBucket"
        ]
        Resource = [
          aws_s3_bucket.documents.arn,
          "${aws_s3_bucket.documents.arn}/*"
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "kms:Decrypt",
          "kms:Encrypt",
          "kms:GenerateDataKey"
        ]
        Resource = [aws_kms_key.main.arn]
      },
      {
        Effect = "Allow"
        Action = [
          "secretsmanager:GetSecretValue"
        ]
        Resource = ["arn:aws:secretsmanager:${var.aws_region}:${data.aws_caller_identity.current.account_id}:secret:${var.project_name}/${var.environment}/*"]
      }
    ]
  })
}

# ECR Repository
resource "aws_ecr_repository" "api" {
  name                 = "${var.project_name}/${var.environment}/api"
  image_tag_mutability = "MUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }

  encryption_configuration {
    encryption_type = "KMS"
    kms_key         = aws_kms_key.main.arn
  }

  tags = {
    Name = "${var.project_name}-${var.environment}-api-repo"
  }
}

# ECS Task Definition
resource "aws_ecs_task_definition" "api" {
  family                   = "${var.project_name}-${var.environment}-api"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = var.api_cpu
  memory                   = var.api_memory
  execution_role_arn       = aws_iam_role.ecs_execution.arn
  task_role_arn           = aws_iam_role.ecs_task.arn

  container_definitions = jsonencode([
    {
      name  = "api"
      image = "${aws_ecr_repository.api.repository_url}:latest"
      
      portMappings = [
        {
          containerPort = 8000
          hostPort      = 8000
          protocol      = "tcp"
        }
      ]
      
      environment = [
        {
          name  = "ENVIRONMENT"
          value = var.environment
        },
        {
          name  = "DATABASE_URL"
          value = "postgresql://${var.db_username}:${var.db_password}@${aws_rds_cluster.postgres.endpoint}:5432/${var.db_name}"
        },
        {
          name  = "REDIS_URL"
          value = "redis://:${var.redis_auth_token}@${aws_elasticache_replication_group.redis.configuration_endpoint_address}:6379"
        },
        {
          name  = "S3_BUCKET"
          value = aws_s3_bucket.documents.id
        },
        {
          name  = "KMS_KEY_ID"
          value = aws_kms_key.main.key_id
        }
      ]
      
      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = aws_cloudwatch_log_group.api.name
          "awslogs-region"        = var.aws_region
          "awslogs-stream-prefix" = "ecs"
        }
      }
      
      healthCheck = {
        command     = ["CMD-SHELL", "curl -f http://localhost:8000/health || exit 1"]
        interval    = 30
        timeout     = 5
        retries     = 3
        startPeriod = 60
      }
    }
  ])

  tags = {
    Name = "${var.project_name}-${var.environment}-api-task"
  }
}

# ECS Service
resource "aws_ecs_service" "api" {
  name            = "${var.project_name}-${var.environment}-api"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.api.arn
  desired_count   = var.api_desired_count
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = aws_subnet.private[*].id
    security_groups  = [aws_security_group.ecs.id]
    assign_public_ip = false
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.api.arn
    container_name   = "api"
    container_port   = 8000
  }

  deployment_configuration {
    maximum_percent         = 200
    minimum_healthy_percent = 100
  }

  depends_on = [aws_lb_listener.api]

  tags = {
    Name = "${var.project_name}-${var.environment}-api-service"
  }
}

# Auto Scaling
resource "aws_appautoscaling_target" "api" {
  max_capacity       = var.api_max_capacity
  min_capacity       = var.api_min_capacity
  resource_id        = "service/${aws_ecs_cluster.main.name}/${aws_ecs_service.api.name}"
  scalable_dimension = "ecs:service:DesiredCount"
  service_namespace  = "ecs"
}

resource "aws_appautoscaling_policy" "api_cpu" {
  name               = "${var.project_name}-${var.environment}-api-cpu-scaling"
  policy_type        = "TargetTrackingScaling"
  resource_id        = aws_appautoscaling_target.api.resource_id
  scalable_dimension = aws_appautoscaling_target.api.scalable_dimension
  service_namespace  = aws_appautoscaling_target.api.service_namespace

  target_tracking_scaling_policy_configuration {
    predefined_metric_specification {
      predefined_metric_type = "ECSServiceAverageCPUUtilization"
    }
    target_value = 70.0
  }
}

# Monitoring and Alerting
resource "aws_cloudwatch_metric_alarm" "api_high_cpu" {
  alarm_name          = "${var.project_name}-${var.environment}-api-high-cpu"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "CPUUtilization"
  namespace           = "AWS/ECS"
  period              = "300"
  statistic           = "Average"
  threshold           = "80"
  alarm_description   = "This metric monitors ecs cpu utilization"
  alarm_actions       = var.sns_alarm_topic_arn != "" ? [var.sns_alarm_topic_arn] : []

  dimensions = {
    ServiceName = aws_ecs_service.api.name
    ClusterName = aws_ecs_cluster.main.name
  }

  tags = {
    Name = "${var.project_name}-${var.environment}-api-high-cpu-alarm"
  }
}

resource "aws_cloudwatch_metric_alarm" "api_high_memory" {
  alarm_name          = "${var.project_name}-${var.environment}-api-high-memory"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "MemoryUtilization"
  namespace           = "AWS/ECS"
  period              = "300"
  statistic           = "Average"
  threshold           = "80"
  alarm_description   = "This metric monitors ecs memory utilization"
  alarm_actions       = var.sns_alarm_topic_arn != "" ? [var.sns_alarm_topic_arn] : []

  dimensions = {
    ServiceName = aws_ecs_service.api.name
    ClusterName = aws_ecs_cluster.main.name
  }

  tags = {
    Name = "${var.project_name}-${var.environment}-api-high-memory-alarm"
  }
}

# Grafana and Prometheus (optional)
resource "aws_ecs_task_definition" "monitoring" {
  count                    = var.enable_monitoring ? 1 : 0
  family                   = "${var.project_name}-${var.environment}-monitoring"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = 512
  memory                   = 1024
  execution_role_arn       = aws_iam_role.ecs_execution.arn

  container_definitions = jsonencode([
    {
      name  = "prometheus"
      image = "prom/prometheus:latest"
      
      portMappings = [
        {
          containerPort = 9090
          hostPort      = 9090
          protocol      = "tcp"
        }
      ]
      
      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = "/ecs/${var.project_name}-${var.environment}-monitoring"
          "awslogs-region"        = var.aws_region
          "awslogs-stream-prefix" = "prometheus"
        }
      }
    },
    {
      name  = "grafana"
      image = "grafana/grafana:latest"
      
      portMappings = [
        {
          containerPort = 3000
          hostPort      = 3000
          protocol      = "tcp"
        }
      ]
      
      environment = [
        {
          name  = "GF_SECURITY_ADMIN_PASSWORD"
          value = var.grafana_admin_password
        }
      ]
      
      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = "/ecs/${var.project_name}-${var.environment}-monitoring"
          "awslogs-region"        = var.aws_region
          "awslogs-stream-prefix" = "grafana"
        }
      }
    }
  ])

  tags = {
    Name = "${var.project_name}-${var.environment}-monitoring-task"
  }
}

resource "aws_cloudwatch_log_group" "monitoring" {
  count             = var.enable_monitoring ? 1 : 0
  name              = "/ecs/${var.project_name}-${var.environment}-monitoring"
  retention_in_days = var.log_retention_days

  tags = {
    Name = "${var.project_name}-${var.environment}-monitoring-logs"
  }
}