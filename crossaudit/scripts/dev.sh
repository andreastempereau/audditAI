#!/bin/sh
docker compose up -d db gateway ingestor
pnpm --prefix web dev
