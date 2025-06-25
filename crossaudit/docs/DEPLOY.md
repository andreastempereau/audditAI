# Deploy

## Building the gateway

Use the provided Dockerfile to build a release image:

```bash
docker build -f docker/Dockerfile.gateway -t crossaudit/gateway .
```

Run the container with the required environment variables:

```bash
docker run \
  -e DATABASE_URL=postgres://user:pass@db/crossaudit \
  -e OPENAI_API_KEY=sk-... \
  -e SERVER_ADDR=0.0.0.0:8000 \
  -v $(pwd)/storage:/storage \
  -p 8000:8000 \
  crossaudit/gateway
```

### Environment variables

- `SERVER_ADDR` &ndash; address for the HTTP server (default `0.0.0.0:8000`).
- `DATABASE_URL` &ndash; Postgres connection string.
- `OPENAI_API_KEY` &ndash; API key used by the LLM client.
- `STORAGE_PATH` &ndash; path to store uploaded files.

The other services in this repository follow a similar pattern and each has a
Dockerfile under `docker/`.
