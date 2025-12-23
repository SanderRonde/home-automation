# Cursor Rules Overview

This directory contains Cursor rules that help the AI understand and work with this codebase effectively.

## Rule Types

### Always Applied Rules

These rules apply to every AI request automatically:

- **`project-structure.mdc`** - Overall project layout, technologies, and key paths

### Scope-Based Rules (Glob Patterns)

These rules apply automatically when working with specific file types:

#### TypeScript/Server Rules

- **`typescript-style.mdc`** (`*.ts`, `*.tsx`) - TypeScript coding standards, type safety, class conventions
- **`bun-runtime.mdc`** (`app/server/**/*.ts`) - Bun-specific APIs and patterns (not Node.js!)
- **`logging.mdc`** (`app/server/**/*.ts`) - Logging utilities and conventions
- **`error-handling.mdc`** (`app/server/**/*.ts`, `app/client/**/*.tsx`) - Error handling patterns

#### React/Client Rules

- **`react-components.mdc`** (`app/client/**/*.tsx`) - React component patterns, MUI usage
- **`react-performance.mdc`** (`app/client/**/*.tsx`) - React performance optimization with memoization and hooks
- **`api-communication.mdc`** (`app/client/**/*.tsx`, `app/client/**/*.ts`) - Client-side API patterns

#### Testing Rules

- **`testing.mdc`** (`**/*.test.ts`, `**/*.test.tsx`, `**/*.spec.ts`, `**/*.spec.tsx`) - Bun test patterns

### On-Demand Rules (Descriptions)

These rules can be fetched when needed by asking about specific topics:

- **`module-system.mdc`** - Creating and working with server modules
- **`routing-patterns.mdc`** - API routing and request handling
- **`database-patterns.mdc`** - JSON and SQLite database usage
- **`websocket-communication.mdc`** - WebSocket patterns for real-time updates
- **`matter-integration.mdc`** - Matter.js smart home integration
- **`ai-integration.mdc`** - ChatGPT and Model Context Protocol (AI integration)
- **`device-clusters.mdc`** - Understanding and working with device clusters
- **`scenes-automation.mdc`** - Working with scenes and automation triggers
- **`shared-types.mdc`** - Creating and using shared TypeScript types
- **`validation-schemas.mdc`** - Zod validation patterns and schema design
- **`security-patterns.mdc`** - Security and authentication best practices
- **`async-patterns.mdc`** - Async operations, promises, queues, and concurrency
- **`file-organization.mdc`** - File organization, naming conventions, and directory structure
- **`temperature-control.mdc`** - Temperature control system with scheduler, TRV control, and decision logic
- **`modules-overview.mdc`** - Overview of all server modules, their purposes, and how they work together

## Quick Reference

### Working on Server Code?

→ Check: `bun-runtime.mdc`, `module-system.mdc`, `modules-overview.mdc`, `routing-patterns.mdc`, `database-patterns.mdc`, `validation-schemas.mdc`, `security-patterns.mdc`, `async-patterns.mdc`

### Working on Client Code?

→ Check: `react-components.mdc`, `react-performance.mdc`, `api-communication.mdc`

### Adding Real-Time Features?

→ Check: `websocket-communication.mdc`

### Working with Smart Devices?

→ Check: `matter-integration.mdc`, `device-clusters.mdc`

### Working with Temperature Control?

→ Check: `temperature-control.mdc`

### Creating Scenes or Automations?

→ Check: `scenes-automation.mdc`, `device-clusters.mdc`

### Adding AI Integration?

→ Check: `ai-integration.mdc`

### Creating Shared Types?

→ Check: `shared-types.mdc`

### Validating Input or Creating Schemas?

→ Check: `validation-schemas.mdc`

### Implementing Security or Authentication?

→ Check: `security-patterns.mdc`

### Working with Async Operations?

→ Check: `async-patterns.mdc`

### Optimizing React Performance?

→ Check: `react-performance.mdc`

### Organizing Files or Naming Conventions?

→ Check: `file-organization.mdc`

### Writing Tests?

→ Check: `testing.mdc`

## Rule Structure

All rules follow this format:

```markdown
---
# Frontmatter (metadata)
alwaysApply: true          # Always applies to every request
globs: *.ts,*.tsx          # Applies to specific file patterns
description: "..."         # Allows AI to fetch on demand
---

# Rule Title

Content with code examples and best practices...
```

## Adding New Rules

When creating new rules:

1. Create a `.mdc` file in this directory
2. Add appropriate frontmatter (alwaysApply, globs, or description)
3. Use markdown with code examples
4. Reference related files using `[filename](mdc:path/to/file)`
5. Keep rules focused on a single topic
6. Include both ✅ good and ❌ bad examples

## Updating Rules

Rules should be updated when:

- Coding patterns change in the project
- New technologies or libraries are added
- Best practices evolve
- Common mistakes are identified

## Current Coverage

✅ Project structure and organization
✅ TypeScript style and conventions
✅ Bun runtime specifics
✅ Module system architecture
✅ API routing patterns
✅ Database usage (JSON & SQLite)
✅ WebSocket communication
✅ React components and MUI
✅ Type-safe API communication
✅ Error handling
✅ Logging conventions
✅ Testing with Bun
✅ Matter.js integration
✅ AI integration (ChatGPT + MCP)
✅ Device cluster system
✅ Scenes and automation
✅ Shared type definitions
✅ Validation and schema patterns (Zod)
✅ Security and authentication patterns
✅ Async operations and concurrency patterns
✅ React performance optimization patterns
✅ File organization and naming conventions
✅ Temperature control system and scheduler
✅ Complete modules overview and architecture

## Contributing

When adding features or making architectural changes, consider updating or adding rules to help the AI understand the new patterns.
