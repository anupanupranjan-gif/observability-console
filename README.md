# observability-console

An AI-powered observability console for the SearchX platform. Combines live Prometheus metrics with a local Ollama AI assistant, letting you query the health of your search infrastructure in plain English.

Accessible from Grafana dashboards as a companion ops tool. Built as a standalone React app deployed on Kubernetes.

---

## What It Does

The console pulls real-time metrics from [prometheus-mcp](https://github.com/anupanupranjan-gif/prometheus-mcp) every 30 seconds and injects them as context into a local LLM (Ollama/gemma3:1b). You can ask natural language questions about the system and get answers grounded in live data.

```
Grafana Dashboard
      │
      └──► observability-console (http://localhost/ops)
                 │                        │
                 ▼                        ▼
          Live metric cards         AI Chat (Ollama)
          (auto-refresh 30s)        (Prometheus context injected)
                 │
                 ▼
          prometheus-mcp  ──►  Prometheus  ──►  search-api
```

---

## Screenshots

### System Healthy
![Observability Console - Healthy State](docs/healthy.png)

---

## Example Conversations

> **You**: Is the system healthy?
>
> **AI**: Yes, the system is healthy. All 2/2 pods are running, error rate is 0%, and average search latency is 74ms which is well within acceptable range.

> **You**: What's the current traffic?
>
> **AI**: Search API is currently handling 10.4 requests per minute. The throughput trend over the last 30 minutes shows a peak earlier and steady traffic now.

> **You**: Are there any performance concerns?
>
> **AI**: No current concerns. Latency and error rate are both healthy. Max observed latency is 640ms which is within normal range for a hybrid BM25 + vector search.

---

## Stack

- **Frontend**: React 18
- **Metrics**: prometheus-mcp (REST API over Prometheus)
- **AI**: Ollama (gemma3:1b, local)
- **Fonts**: IBM Plex Mono, IBM Plex Sans
- **Deployment**: Kubernetes (Kind), nginx, Docker

---

## Local Development

```bash
npm install

# Start prometheus-mcp locally first
cd ../prometheus-mcp
PROMETHEUS_URL=http://localhost:9090 node server.js &

# Start the console
cd ../observability-console
REACT_APP_MCP_BASE=http://localhost:3001 \
REACT_APP_OLLAMA_BASE=http://localhost:11434 \
npm start
```

Open `http://localhost:3000`.

---

## Kubernetes Deployment

The app runs as a pod in the `default` namespace, served by nginx, and is accessible via the nginx ingress at `/ops`.

Prometheus MCP is proxied through the same ingress at `/mcp` so the browser can reach it without CORS issues.

```
http://localhost/ops   →  observability-console pod
http://localhost/mcp   →  prometheus-mcp pod
```

Manifests are managed in the [search-infra](https://github.com/anupanupranjan-gif/search-infra) repo:

```bash
kubectl apply -f k8s-configs/observability-console/deployment.yaml
kubectl apply -f k8s-configs/observability-console/ingress.yaml
```

---

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `REACT_APP_MCP_BASE` | `http://localhost:3001` | prometheus-mcp base URL |
| `REACT_APP_OLLAMA_BASE` | `http://localhost:11434` | Ollama base URL |

In production (Kind), `REACT_APP_MCP_BASE` is set to `/mcp` so requests route through the nginx ingress.

---

## Architecture Notes

The AI context is rebuilt on every message using the latest metrics snapshot. This means the assistant always answers based on current data, not stale context. The pattern is similar to how enterprise tools like the Dynatrace MCP integration work — the AI is given structured observability data as grounded context rather than relying on training knowledge.

Ollama runs locally on the host machine (not in Kind) so the browser calls it directly at `http://localhost:11434`.

---

## Part of SearchX

This repo is one component of the SearchX platform:

- [search-api](https://github.com/anupanupranjan-gif/search-api) — Spring Boot hybrid search service (BM25 + vector)
- [search-ui](https://github.com/anupanupranjan-gif/search-ui) — React eCommerce search frontend
- [search-catalog-indexer](https://github.com/anupanupranjan-gif/search-catalog-indexer) — Product indexing pipeline
- [prometheus-mcp](https://github.com/anupanupranjan-gif/prometheus-mcp) — Prometheus MCP server (metrics source for this app)
- [search-infra](https://github.com/anupanupranjan-gif/search-infra) — Kubernetes manifests, Helm charts, ArgoCD, Terraform
