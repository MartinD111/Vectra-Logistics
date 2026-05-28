# Contributing to VECTRA Platform

Welcome to the VECTRA development environment. We use a monorepo setup.

## Git Workflow
1. We follow a standard feature-branching workflow.
2. The main branches are:
   - `main`: Production-ready code.
   - `develop`: Integration branch for features.
3. To start a new feature: `git checkout -b feature/your-feature-name develop`
4. Once your work is tested locally, create a Pull Request targeting `develop`.

## Code Standards
- **Frontend**: Next.js (React), strict TypeScript, Tailwind CSS. Avoid directly writing generic CSS if Tailwind can be used. Components should be thoroughly typed.
- **Backend (Node)**: Express middleware architecture, strict TypeScript. Always validate incoming request data.
- **Microservices (Python)**: FastAPI, type hints enabled. Write specific logic for algorithm components.
- **Database Modifying**: If altering the schema, update `database/init.sql` for this MVP. (In the future, we will adopt a migration tool like Prisma or Alembic).

## Running Locally
Run `docker-compose up --build` to see all services running together. 
Check individual container logs using `docker logs <container_name>`.
