# Ausk

> **Real‑time, multi‑model AI‑response governance with auditable data provenance.**

Ausk AI is a drop‑in gateway that intercepts every LLM interaction, tests it against customer policies across multiple evaluator models, rewrites or blocks unsafe content in ≤ 2 s, and logs a forensically complete chain of evidence.
A built‑in **Data Room** stores your approved documents, a full **RBAC** layer isolates tenants, and Timescale‑powered metrics keep you ahead of SLO drift.

---

## ✨ Key Features

| Category          | What it does                                                                                                                           |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| **Policy Engine** | Declarative YAML rules (`allow`, `block`, `rewrite`, `redact`) evaluated by a mesh of GPT‑4o, Claude‑3, Gemini, or local Llama models. |
| **Data Room**     | Encrypted file storage → automatic text extraction → vector embeddings → semantic search, all scoped by organization.                  |
| **Chat Gateway**  | WebSocket streaming, message history, evaluator consensus, caching, and sub‑2‑second rewrite pipeline.                                 |
| **RBAC & Auth**   | Google/Okta SSO, email + MFA, per‑org roles and permissions resolved in ≤ 5 ms with Redis.                                             |
| **Audit Trail**   | Actor, verb, target, diff, IP, user‑agent, policy result, tamper‑proof HMAC.                                                           |
| **Admin Surface** | API keys (hashed), outbound webhooks, Stripe billing, quota enforcement.                                                               |
| **Observability** | Timescale hypertable + Prometheus exporter for latency, violation rates, token counts.                                                 |
| **IaC**           | Terraform module provisioning Supabase, Redis, Timescale, S3, ECS Fargate, Grafana.                                                    |
| **CI/CD**         | GitHub Actions for test → build → blue‑green deploy with rollback.                                                                     |

---

## 🏗 Project Structure

```
Ausk/
├── app/                    # FastAPI application  
│   ├── auth/               # OAuth, MFA, password flows  
│   ├── routes/             # Versioned API routers  
│   ├── services/           # Business logic (governor, data_room, rbac, admin, metrics)  
│   ├── middleware/         # JWT guard, quota, metrics collector  
│   ├── workers/            # Celery tasks & embedder gRPC service  
│   └── cli/                # Management commands (sync_perms, create_admin)  
├── infra/                  # Terraform IaC  
├── docker-compose.yml      # Local dev stack  
├── migrations/             # SQL migrations (001‑004)  
├── tests/                  # Pytest suite  
├── e2e/                    # Cypress scripts (frontend repo)  
├── docs/                   # Mermaid diagrams, policy DSL spec, deployment guide  
└── README.md               # You are here
```

---

## ⚡ Quick Start (Local Dev)

Prerequisites: Docker 20+, Docker Compose, Python 3.12, Node 20 (for frontend).

```bash
# 1. Clone
git clone https://github.com/Ausk/Ausk.git && cd Ausk

# 2. Environment
cp .env.example .env          # fill in dummy secrets

# 3. Bring up services (Postgres, Redis, MinIO, Embedder)
docker compose up -d

# 4. Install deps & run migrations
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
supabase db reset             # creates schema & RLS policies

# 5. Start API & Celery worker
uvicorn app.main:app --reload
celery -A app.workers.worker worker -l info

# 6. (Optional) Run frontend in separate tab
cd frontend && pnpm install && pnpm dev
```

Open **[http://localhost:9000/docs](http://localhost:9000/docs)** for interactive Swagger.
Login with Google or create the first user via CLI:

```bash
python -m app.cli.create_admin --email admin@demo.io --password P@ssw0rd!
```

---

## 🚀 Production Deploy (AWS ECS Fargate)

```bash
cd infra
terraform init
terraform apply -var-file=prod.tfvars
```

The module provisions:

* VPC, ALB, public/private subnets
* ECS service (API + worker) with rolling blue‑green deploy
* Aurora Postgres instance with Timescale and pgvector extensions
* Elasticache Redis cluster
* S3 bucket for document binaries (+ KMS key)
* Grafana + Prometheus stack behind Cognito
* Route 53 records and ACM certificate

See **docs/deployment.md** for full parameter list and zero‑downtime rollback strategy.

---

## 🔑 Environment Variables (Core)

| Key                                                     | Description                           |
| ------------------------------------------------------- | ------------------------------------- |
| `DATABASE_URL`                                          | Postgres URL with `sslmode=require`   |
| `SUPABASE_SERVICE_ROLE_KEY`                             | Supabase service role JWT             |
| `JWT_SECRET`                                            | Signing secret for first‑party tokens |
| `GOOGLE_CLIENT_ID` & `GOOGLE_CLIENT_SECRET`             | OAuth creds                           |
| `S3_ENDPOINT`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`         | MinIO/S3 storage                      |
| `EMBEDDER_GRPC_URL`                                     | gRPC endpoint for embeddings          |
| `STRIPE_SECRET_KEY`                                     | Billing integration                   |
| `KMS_KEY_ID`                                            | AWS KMS for envelope encryption       |
| `REDIS_URL`                                             | Caching, WebSocket pub/sub            |
| `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GEMINI_API_KEY` | BYO evaluator credentials             |

Full list in **.env.example**.

---

## 🧪 Testing

```bash
# Unit tests
pytest -q

# Coverage
pytest --cov=app --cov-report=term-missing

# Load test (k6)
make k6-load   # requires k6 binary

# Cypress e2e (frontend)
pnpm cypress run
```

Coverage must stay ≥ 85 %; CI enforces this gate.

---

## 🛡️ Security & Responsible Disclosure

We follow **Coordinated Vulnerability Disclosure**.
Please email **[security@Ausk.ai](mailto:security@Ausk.ai)** with the details; you will receive a PGP key for encrypted communication. Critical issues are fixed within 72 h of triage.

---

## 🤝 Contributing

1. Fork and create a feature branch.
2. Write tests that fail.
3. Make the tests pass without breaking lint/mypy (`make lint`).
4. Submit a PR, fill out the template, sign the CLA.

All code must be typed (`mypy --strict`) and formatted with **ruff** (`make fmt`).

---

## 📜 License

```
Apache License 2.0
Copyright 2025 Ausk
```

Commercial OEM licensing available for on‑prem banks; contact **[sales@Ausk.ai](mailto:sales@Ausk.ai)**.

---

## 💡 Roadmap

* **Q3 2025** – Multi‑tenant on‑prem installer, vector‑quantized fragment compression.
* **Q4 2025** – Differential‑privacy audit mode, SOC 2 Type II, Azure OpenAI evaluator pool.
* **H1 2026** – Real‑time multi‑modal (image + text) governance, policy marketplace.

Star ☆ the repo to follow releases and help enterprises ship responsible AI faster!
