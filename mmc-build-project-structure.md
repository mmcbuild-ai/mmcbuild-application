# MMC Build MVP — PyCharm Project Structure

> Monorepo layout aligned to PRD v3.0 architecture layers.
> Backend: Python (FastAPI) · Frontend: Next.js (TypeScript) · Infra: Terraform + Docker

```
mmc-build/
│
├── .github/
│   └── workflows/
│       ├── ci-backend.yml                # Lint, test, type-check backend
│       ├── ci-frontend.yml               # Lint, test, build frontend
│       └── deploy.yml                    # CD pipeline (ECS/Fargate)
│
├── .vscode/                              # Optional VS Code settings
├── .idea/                                # PyCharm project settings (auto-generated)
│
├── docs/
│   ├── PRD_v3.0.md                       # Product Requirements Document
│   ├── architecture.md                   # Architecture decision records
│   ├── api-spec.yaml                     # OpenAPI 3.1 spec
│   ├── db-schema.md                      # ERD and migration notes
│   └── runbooks/                         # Operational runbooks
│       ├── incident-response.md
│       └── deployment.md
│
├── infrastructure/
│   ├── terraform/
│   │   ├── environments/
│   │   │   ├── dev/
│   │   │   │   └── main.tf
│   │   │   ├── staging/
│   │   │   │   └── main.tf
│   │   │   └── prod/
│   │   │       └── main.tf
│   │   ├── modules/
│   │   │   ├── vpc/
│   │   │   ├── ecs/
│   │   │   ├── rds/                      # PostgreSQL + pgvector
│   │   │   ├── redis/
│   │   │   ├── opensearch/
│   │   │   ├── s3/                       # Plan files & reports
│   │   │   ├── sqs/                      # Job queues
│   │   │   └── eventbridge/              # Event bus
│   │   └── variables.tf
│   └── docker/
│       ├── Dockerfile.api                # FastAPI backend
│       ├── Dockerfile.worker             # Celery/SQS workers
│       ├── Dockerfile.frontend           # Next.js
│       └── docker-compose.yml            # Local dev stack
│
│
│ ═══════════════════════════════════════════════════════════════
│  BACKEND (Python · FastAPI)
│ ═══════════════════════════════════════════════════════════════
│
├── backend/
│   ├── pyproject.toml                    # Project metadata, deps (Poetry/uv)
│   ├── alembic.ini                       # DB migration config
│   ├── alembic/
│   │   ├── env.py
│   │   └── versions/                     # Migration scripts
│   │
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py                       # FastAPI app factory, lifespan events
│   │   ├── config.py                     # Pydantic Settings (env-based config)
│   │   ├── dependencies.py               # Shared DI (db sessions, current_user)
│   │   │
│   │   ├── api/                          # ── REST + GraphQL endpoints ──
│   │   │   ├── __init__.py
│   │   │   ├── router.py                 # Top-level router aggregator
│   │   │   ├── v1/
│   │   │   │   ├── __init__.py
│   │   │   │   ├── auth.py               # Login, register, JWT refresh
│   │   │   │   ├── users.py              # Profile, RBAC management
│   │   │   │   ├── orgs.py               # Org onboarding, invitations
│   │   │   │   ├── projects.py           # CRUD projects
│   │   │   │   ├── plans.py              # Plan upload, status polling
│   │   │   │   ├── comply.py             # MMC Comply — compliance endpoints
│   │   │   │   ├── build.py              # MMC Build — design optimisation
│   │   │   │   ├── quote.py              # MMC Quote — cost estimation
│   │   │   │   ├── directory.py          # MMC Direct — trade directory
│   │   │   │   ├── training.py           # MMC Train — course modules
│   │   │   │   ├── billing.py            # Stripe webhooks, subscriptions
│   │   │   │   ├── feedback.py           # Thumbs up/down, CSAT, corrections
│   │   │   │   └── reports.py            # Report download (PDF, XLSX, CAD)
│   │   │   └── deps.py                   # Route-level dependencies
│   │   │
│   │   ├── models/                       # ── SQLAlchemy ORM models ──
│   │   │   ├── __init__.py
│   │   │   ├── base.py                   # Declarative base, tenant mixin
│   │   │   ├── user.py
│   │   │   ├── org.py
│   │   │   ├── project.py
│   │   │   ├── plan.py                   # Plan file metadata
│   │   │   ├── compliance_report.py
│   │   │   ├── design_report.py
│   │   │   ├── quote.py
│   │   │   ├── directory_listing.py      # Trade/consultant profiles
│   │   │   ├── training_module.py
│   │   │   ├── training_progress.py
│   │   │   ├── feedback.py
│   │   │   ├── subscription.py
│   │   │   └── audit_log.py              # Immutable audit trail
│   │   │
│   │   ├── schemas/                      # ── Pydantic request/response schemas ──
│   │   │   ├── __init__.py
│   │   │   ├── auth.py
│   │   │   ├── user.py
│   │   │   ├── org.py
│   │   │   ├── project.py
│   │   │   ├── plan.py
│   │   │   ├── comply.py
│   │   │   ├── build.py
│   │   │   ├── quote.py
│   │   │   ├── directory.py
│   │   │   ├── training.py
│   │   │   ├── billing.py
│   │   │   ├── feedback.py
│   │   │   └── common.py                 # Pagination, error responses
│   │   │
│   │   ├── services/                     # ── Business logic layer ──
│   │   │   ├── __init__.py
│   │   │   ├── auth_service.py           # JWT, password hashing, RBAC checks
│   │   │   ├── org_service.py            # Org CRUD, invitation workflow
│   │   │   ├── project_service.py
│   │   │   ├── plan_service.py           # Upload validation, S3 storage
│   │   │   ├── comply_service.py         # Orchestrates compliance pipeline
│   │   │   ├── build_service.py          # Orchestrates design optimisation
│   │   │   ├── quote_service.py          # Cost estimation logic
│   │   │   ├── directory_service.py      # Search, filter, shortlist
│   │   │   ├── training_service.py       # Course progress, certificates
│   │   │   ├── billing_service.py        # Stripe integration
│   │   │   ├── report_service.py         # PDF/XLSX generation
│   │   │   └── feedback_service.py
│   │   │
│   │   ├── ai/                           # ── AI Orchestration Layer (§4.4) ──
│   │   │   ├── __init__.py
│   │   │   ├── orchestrator.py           # Central prompt router & model selector
│   │   │   ├── providers/
│   │   │   │   ├── __init__.py
│   │   │   │   ├── openai_provider.py    # GPT-4 Turbo
│   │   │   │   ├── anthropic_provider.py # Claude
│   │   │   │   └── base.py              # Abstract LLM provider interface
│   │   │   ├── rag/
│   │   │   │   ├── __init__.py
│   │   │   │   ├── pipeline.py           # Parse → Embed → Index → Query → Generate → Cite
│   │   │   │   ├── embeddings.py         # Embedding generation (pgvector)
│   │   │   │   ├── retriever.py          # Vector + keyword search (OpenSearch)
│   │   │   │   ├── reranker.py           # Result reranking
│   │   │   │   └── citation.py           # NCC clause citation builder
│   │   │   ├── prompts/
│   │   │   │   ├── __init__.py
│   │   │   │   ├── compliance.py         # NCC compliance check prompts
│   │   │   │   ├── design.py             # Design optimisation prompts
│   │   │   │   ├── quoting.py            # Cost estimation prompts
│   │   │   │   └── templates.py          # Shared prompt fragments
│   │   │   └── evaluation/
│   │   │       ├── __init__.py
│   │   │       ├── accuracy.py           # Precision/recall benchmarks
│   │   │       └── drift.py              # Output quality drift detection
│   │   │
│   │   ├── workers/                      # ── Async Job Pipelines (§4.5) ──
│   │   │   ├── __init__.py
│   │   │   ├── celery_app.py             # Celery config (or SQS consumer)
│   │   │   ├── tasks/
│   │   │   │   ├── __init__.py
│   │   │   │   ├── plan_parsing.py       # PDF → text, DWG → geometry
│   │   │   │   ├── compliance_check.py   # Full NCC analysis job
│   │   │   │   ├── design_optimise.py    # Design suggestion job
│   │   │   │   ├── quote_calculate.py    # Cost model job
│   │   │   │   ├── embedding_index.py    # Vector indexing job
│   │   │   │   └── report_generate.py    # PDF/XLSX report export
│   │   │   └── callbacks.py              # Post-task event handlers
│   │   │
│   │   ├── integrations/                 # ── Integration & Event Bus (§4.6) ──
│   │   │   ├── __init__.py
│   │   │   ├── stripe_client.py          # Payments & subscriptions
│   │   │   ├── s3_client.py              # File storage
│   │   │   ├── opensearch_client.py      # Search engine
│   │   │   ├── eventbridge.py            # Event publishing
│   │   │   └── email_client.py           # Transactional emails (SES/SendGrid)
│   │   │
│   │   ├── core/                         # ── Cross-cutting concerns ──
│   │   │   ├── __init__.py
│   │   │   ├── security.py               # JWT, password hashing, encryption
│   │   │   ├── rbac.py                   # Role-based access control
│   │   │   ├── audit.py                  # Audit trail logger
│   │   │   ├── exceptions.py             # Custom exception hierarchy
│   │   │   ├── middleware.py             # Tenant isolation, request tracing
│   │   │   ├── pagination.py
│   │   │   └── telemetry.py              # OpenTelemetry setup (§5.4)
│   │   │
│   │   └── db/                           # ── Database utilities ──
│   │       ├── __init__.py
│   │       ├── session.py                # Async SQLAlchemy session factory
│   │       └── seed.py                   # Dev seed data (NCC rules, test orgs)
│   │
│   ├── data/                             # ── Knowledge base source files ──
│   │   ├── ncc/                          # NCC/BCA documents for RAG indexing
│   │   │   ├── ncc_volume_one.pdf
│   │   │   ├── ncc_volume_two.pdf
│   │   │   └── README.md
│   │   ├── suppliers/                    # Supplier specs & price lists
│   │   │   └── README.md
│   │   └── training/                     # Training course content
│   │       └── README.md
│   │
│   └── tests/
│       ├── conftest.py                   # Fixtures: test DB, mock AI, test client
│       ├── unit/
│       │   ├── test_auth_service.py
│       │   ├── test_comply_service.py
│       │   ├── test_rag_pipeline.py
│       │   ├── test_quote_service.py
│       │   └── test_rbac.py
│       ├── integration/
│       │   ├── test_plan_upload_flow.py
│       │   ├── test_compliance_pipeline.py
│       │   ├── test_stripe_billing.py
│       │   └── test_directory_search.py
│       └── ai_eval/                      # AI accuracy evaluation suite
│           ├── test_compliance_accuracy.py
│           ├── test_drift_detection.py
│           └── fixtures/
│               ├── sample_plans/
│               └── expected_results/
│
│
│ ═══════════════════════════════════════════════════════════════
│  FRONTEND (Next.js · React · TypeScript)
│ ═══════════════════════════════════════════════════════════════
│
├── frontend/
│   ├── package.json
│   ├── tsconfig.json
│   ├── next.config.ts
│   ├── tailwind.config.ts
│   ├── .env.local.example
│   │
│   ├── public/
│   │   ├── favicon.ico
│   │   └── images/
│   │
│   ├── src/
│   │   ├── app/                          # Next.js App Router
│   │   │   ├── layout.tsx                # Root layout (nav, auth provider)
│   │   │   ├── page.tsx                  # Landing / dashboard
│   │   │   ├── (auth)/
│   │   │   │   ├── login/page.tsx
│   │   │   │   ├── register/page.tsx
│   │   │   │   └── invite/[token]/page.tsx
│   │   │   ├── dashboard/
│   │   │   │   └── page.tsx              # Feature selection hub
│   │   │   ├── projects/
│   │   │   │   ├── page.tsx              # Project list
│   │   │   │   ├── [id]/page.tsx         # Project detail
│   │   │   │   └── new/page.tsx
│   │   │   ├── comply/                   # MMC Comply
│   │   │   │   ├── page.tsx              # Upload + questionnaire
│   │   │   │   └── [reportId]/page.tsx   # Compliance report viewer
│   │   │   ├── build/                    # MMC Build
│   │   │   │   ├── page.tsx
│   │   │   │   └── [reportId]/page.tsx   # Original vs Optimised viewer
│   │   │   ├── quote/                    # MMC Quote
│   │   │   │   ├── page.tsx
│   │   │   │   └── [quoteId]/page.tsx
│   │   │   ├── directory/                # MMC Direct
│   │   │   │   ├── page.tsx              # Category listing + filters
│   │   │   │   └── [profileId]/page.tsx  # Trade/consultant profile
│   │   │   ├── training/                 # MMC Train
│   │   │   │   ├── page.tsx              # Course catalog
│   │   │   │   └── [courseId]/page.tsx    # Module player + progress
│   │   │   ├── billing/
│   │   │   │   └── page.tsx              # Subscription management
│   │   │   └── settings/
│   │   │       ├── page.tsx              # Org settings
│   │   │       └── members/page.tsx      # Team RBAC management
│   │   │
│   │   ├── components/
│   │   │   ├── ui/                       # Generic: Button, Modal, Table, etc.
│   │   │   ├── layout/                   # Sidebar, TopNav, Footer
│   │   │   ├── plans/                    # PlanUploader, PlanViewer
│   │   │   ├── comply/                   # ComplianceReport, CitationPanel
│   │   │   ├── build/                    # DesignComparison, 3DViewer
│   │   │   ├── quote/                    # CostBreakdown, QuoteExport
│   │   │   ├── directory/                # DirectoryFilters, ProfileCard
│   │   │   ├── training/                 # CourseCard, ProgressBar
│   │   │   ├── feedback/                 # FeedbackWidget, ThumbsUpDown
│   │   │   └── billing/                  # PricingCard, InvoiceTable
│   │   │
│   │   ├── lib/
│   │   │   ├── api-client.ts             # Typed fetch wrapper for backend
│   │   │   ├── auth.ts                   # JWT token management
│   │   │   └── utils.ts
│   │   │
│   │   ├── hooks/
│   │   │   ├── useAuth.ts
│   │   │   ├── useProject.ts
│   │   │   ├── usePlanUpload.ts
│   │   │   └── usePolling.ts             # Poll job status
│   │   │
│   │   ├── stores/                       # Zustand or React Context
│   │   │   ├── auth-store.ts
│   │   │   └── project-store.ts
│   │   │
│   │   └── types/
│   │       ├── api.ts                    # Auto-generated from OpenAPI spec
│   │       ├── user.ts
│   │       ├── project.ts
│   │       └── comply.ts
│   │
│   └── tests/
│       ├── components/
│       └── e2e/                          # Playwright or Cypress
│           ├── compliance-flow.spec.ts
│           └── plan-upload.spec.ts
│
│
│ ═══════════════════════════════════════════════════════════════
│  ROOT CONFIG
│ ═══════════════════════════════════════════════════════════════
│
├── .env.example                          # Template for all env vars
├── .gitignore
├── .pre-commit-config.yaml               # Pre-commit hooks (ruff, prettier)
├── Makefile                              # dev, test, migrate, seed, deploy
├── README.md
└── LICENSE
```

---

## Key Design Decisions

| Decision | Rationale |
|---|---|
| **Monorepo** | Single repo for backend + frontend + infra simplifies CI/CD and keeps PRD traceability tight for MVP |
| **`app/ai/` as dedicated package** | Maps directly to PRD §4.4 (AI Orchestration Layer) — keeps RAG pipeline, prompts, and model providers isolated and testable |
| **`app/workers/tasks/`** | Maps to PRD §4.5 (Job Pipelines) — each async job is a discrete task file for clarity |
| **Feature-aligned API routes** | Each product (Comply, Build, Quote, Direct, Train) gets its own route file — mirrors PRD §2.2 feature table |
| **`data/ncc/`** | NCC documents live in-repo for RAG indexing during development; moves to S3 in production |
| **`tests/ai_eval/`** | Dedicated AI accuracy test suite for precision/recall benchmarks (PRD §5.2, §9.1) |
| **Multi-tenant via schema + RBAC** | PRD §4.8 specifies shared infra with tenant isolation — `core/middleware.py` handles this |
| **`core/telemetry.py`** | OpenTelemetry setup per PRD §5.4 — distributed tracing from upload → AI → report |

## PyCharm Configuration Tips

1. **Mark `backend/` as Sources Root** → right-click → *Mark Directory as → Sources Root*
2. **Mark `backend/tests/` as Test Sources Root**
3. **Set Python interpreter** to the Poetry/uv venv for backend
4. **Add Node.js interpreter** for the `frontend/` directory
5. **Run Configurations**: create separate configs for FastAPI (`uvicorn app.main:app`), Celery workers, and Next.js dev server
6. **Database tool**: connect PyCharm's DB browser to PostgreSQL for schema inspection
