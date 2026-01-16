# AGENTS.md

## Overview
- TypeScript home automation system.
- Runtime: Bun (not Node.js).
- Frontend: React + MUI.
- Backend: Bun server with modular architecture.

## Project Structure
- `app/server/`: server entry and modules.
- `app/client/`: React UI (dashboard/config/switch).
- `types/`: shared TypeScript types.
- `scripts/`: utility scripts.
- `tests/`: test configuration.

## Setup
- Install dependencies: `bun install`.
- Use Bun for scripts and execution.

## Common Commands
- Lint + typecheck: `bun lint` (required after changes).
- Compile TypeScript: `bun compile`.
- Run tests: `bun test`.
- E2E tests: `bun test:e2e`.
- Format: `bun format`.

## Development Notes
- Prefer Bun APIs and runtime behavior.
- Keep changes localized to the relevant module or UI.
- Avoid long-running watch commands in CI or automation.
- Secrets/config files are not committed; expect missing local config.

## Coding Guidelines
- Follow existing TypeScript style and ESLint rules.
- Keep changes minimal and consistent with adjacent code.
- Add concise comments only when logic is non-obvious.

## Git Workflow
- Work on the current feature branch.
- Commit with a clear message.
- Push changes to the same branch.
