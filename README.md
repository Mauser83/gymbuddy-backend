# Gymbuddy Backend

GraphQL/Express backend for managing workouts, gyms, exercises, users, and media—with computer-vision–assisted image flows.

> **Showcase only.** This repository is a portfolio showcase; it is not a turnkey starter. External services and credentials are intentionally omitted.

**Quick links:** [`src/server.ts`](src/server.ts) · [`src/graphql/rootSchema.ts`](src/graphql/rootSchema.ts) · [`src/graphql/rootResolvers.ts`](src/graphql/rootResolvers.ts)

## Highlights

- Modular GraphQL schema: gyms, workouts, exercises, users, auth, media.
- WebSocket subscriptions for user and gym events.
- Prisma ORM with DI-registered services (permissions, users, media).
- Express middleware: CORS, input sanitization, logging, Prometheus metrics.
- REST proxy endpoints to Google Places (autocomplete, place details).
- Image pipeline (ONNX) with background workers for embeddings/moderation.
- Health and metrics endpoints for uptime and observability.

## Tech stack

Node.js • Express • Apollo Server • GraphQL • Prisma ORM • PostgreSQL • Jest • ONNX Runtime • Sharp • class-validator • AWS S3-compatible storage

## Architecture (brief)

- **Entry point:** `src/server.ts` bootstraps Express, middleware, REST routes, then mounts `/graphql` with Apollo and WebSocket subscriptions.
- **Modules:** feature-focused folders in `src/modules/<feature>` (schema, resolvers, services, DTOs).
- **Flow:** HTTP → security/sanitization/logging → REST or `/graphql` → domain services → DB/storage.

## Directory layout

```
.
├─ src/
│ ├─ server.ts # Express + Apollo entry
│ ├─ graphql/ # Root schema and resolvers
│ ├─ modules/ # Domain modules
│ ├─ middlewares/ # Express/Apollo middlewares
│ └─ lib/ # Prisma client wrapper
├─ prisma/ # Prisma schema & migrations
├─ docs/ # Optional design notes
└─ __tests__/ # Jest tests
```

## API overview

- **Auth:** Bearer JWT for GraphQL. Header-based auth means CSRF tokens aren't required.
- **Errors:** REST returns `{ error, message }`; GraphQL uses the standard `errors` array.

**Flagship endpoints**

1. `POST /graphql` — queries & mutations (login/register, workouts, etc.)
2. `GET /api/autocomplete` — Google Places proxy (location suggestions)
3. `GET /api/place-details` — Google Places proxy (address details)
4. `GET /health` — liveness probe
5. `GET /metrics` — Prometheus scrape

### Curl examples

```bash
# GraphQL login
curl -X POST http://localhost:4000/graphql \
  -H "Content-Type: application/json" \
  -d '{"query":"mutation Login($e:String!,$p:String!){login(input:{email:$e,password:$p}){accessToken refreshToken user{id}}}", "variables":{"e":"USER_EMAIL","p":"PASSWORD"}}'

# Query users
curl -X POST http://localhost:4000/graphql \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TOKEN" \
  -d '{"query":"query { users { id username } }"}'

# Google Places autocomplete proxy
curl "http://localhost:4000/api/autocomplete?input=gym"
```

OpenAPI/Swagger: not included in this showcase; see GraphQL schema for types.

## Environment variables

See [.env.example](./.env.example) for the full list.

| NAME                 | Purpose                     | Required | Scope    |
| -------------------- | --------------------------- | -------- | -------- |
| DATABASE_URL         | Postgres connection string  | Yes      | dev/prod |
| JWT_SECRET           | JWT signing key             | Yes      | dev/prod |
| PORT                 | HTTP port (default 4000)    | No       | dev/prod |
| CLIENT_URL           | Frontend origin for cookies | No       | dev/prod |
| GOOGLE_MAPS_API_KEY  | Google Places calls         | No       | dev/prod |
| R2_ACCESS_KEY_ID     | R2 storage access key       | Yes      | dev/prod |
| R2_SECRET_ACCESS_KEY | R2 storage secret           | Yes      | dev/prod |
| R2_BUCKET            | R2 bucket name              | Yes      | dev/prod |

## Run locally

```bash
npm install
npx prisma generate
npm run dev
# tests
npm test
```

Full production setup requires external services/credentials and is intentionally not documented in this showcase.

## Testing & quality

- Unit tests via Jest (`npm test`).
- TypeScript compilation via `tsc`.

CI is supported via GitHub Actions (badge not included).

## Security posture

- Secrets via environment variables only; none are committed.
- CORS restricted to approved origins; credentials required for allowed hosts.
- Stateless JWT auth in headers; cookies aren't used, minimizing CSRF risk.
- Request input sanitized; logs avoid PII and tokens.

## Performance & reliability

- Prometheus metrics endpoint with standard process metrics.
- Graceful shutdown on SIGTERM/SIGINT to finish in-flight requests.
- Image processing offloaded to background workers.

## Roadmap

- Add request rate limiting and caching layer.
- Publish OpenAPI/Swagger (or schema docs) for REST/GraphQL where applicable.
- Containerization and CI pipeline hardening.
- Fine-grained authorization policies.

## License

All Rights Reserved (showcase only).

## Contact

Mauno Elo — mauser83@hotmail.com
