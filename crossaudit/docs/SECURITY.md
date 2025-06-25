# Security

This project handles sensitive chat content and user data. The following
practices are recommended when deploying the gateway and related services:

- **TLS** – terminate TLS at the load balancer or reverse proxy so that all
  traffic to the services is encrypted in transit.
- **Authentication** – protect the web app and API using Auth0 or another
  OIDC provider. All requests should carry a valid bearer token.
- **Database access** – restrict Postgres credentials to the minimum required
  privileges and use network firewalls to limit access to the database.
- **Secrets management** – provide API keys and other credentials via
  environment variables or a secret store such as Vault.
- **Monitoring** – expose Prometheus metrics from each service and configure
  alerts for high error rates or latency.

Following these guidelines will help keep deployments secure and auditable.
