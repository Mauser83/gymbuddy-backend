# Gymbuddy Server Architecture Overview

This document explains how the backend server of Gymbuddy is structured, how it works, and what to update when making changes to the domain model or Prisma schema.

---

## 🧠 Overview: How the Server Works

### 1. **Entry Point**: `server.ts`

- Loads env variables with `dotenv`
- Initializes Express with middlewares
- Attaches Apollo Server at `/graphql`
- Sets up WebSocket server for subscriptions
- Registers REST proxy endpoints like `/api/autocomplete`

### 2. **GraphQL Setup**: `graphql/`

- `rootSchema.ts`: Collects and combines all module-level typeDefs
- `rootResolvers.ts`: Merges all module resolvers
- `setupApollo.ts`: Sets up ApolloServer with Express middleware
- `setupWebsocket.ts`: WebSocket context handler and auth validation

### 3. **Auth System**

- Located in `modules/auth`
- Handles login, register, token refresh, password reset
- `auth.guard.ts` validates token and builds the `AuthContext`
- `auth.roles.ts` and `PermissionService` enforce RBAC rules

### 4. **Dependency Injection**: `modules/core/di.container.ts`

- Centralized DI container for Prisma and services (e.g., audit, permissions)
- Used to inject dependencies into services, guards, and Apollo context

### 5. **Middlewares**: `middlewares/`

- Express and Apollo middleware for:
  - `logger.ts`, `metrics.ts`, `validation.ts`, `sanitization.ts`, `errorHandler.ts`

- Grouped by purpose, modular and reusable

### 6. **Domain Modules**: `modules/<feature>`

Each domain (auth, user, exercise, etc.) follows this structure:

```
modules/
  └── feature/
      ├── feature.schema.ts     # GraphQL SDL
      ├── feature.resolvers.ts  # GraphQL resolver functions
      ├── feature.service.ts    # Business logic
      ├── feature.dto.ts        # Class-validator DTOs
      ├── feature.types.ts      # TS interfaces + inputs
```

---

## 🛠️ Making Changes: What To Update

### 🧬 If You Change `schema.prisma`

1. Run `npx prisma generate` and `npx prisma migrate dev`
2. Update related:
   - TypeScript types (`*.types.ts`)
   - DTOs (`*.dto.ts`)
   - GraphQL SDL (`*.schema.ts`)
   - Services and resolvers using the affected model

### 🧩 If You Change a Domain Module

Example: Renaming `WorkoutPlan` to `Workout`

1. Rename and update `modules/workout/*` files accordingly:
   - `workout.schema.ts`
   - `workout.resolvers.ts`
   - `workout.service.ts`
   - `workout.dto.ts`
   - `workout.types.ts`

2. Update references in:
   - `rootSchema.ts` and `rootResolvers.ts`
   - Any services (e.g., SharingService) that use this module
   - Any seed data if applicable

### 💡 Pro Tips

- Keep DTOs and `types.ts` files tightly aligned with GraphQL inputs and Prisma models
- Always validate input using `validateInput(input, DTOClass)` in services
- Use `PermissionService` to manage any RBAC logic cleanly

---

## ✅ Summary

You now have a modular, scalable backend with:

- Domain-driven module structure
- Clean separation of GraphQL, services, and validation
- Centralized DI, logging, and permissions

This setup enables fast iteration and maintainable feature growth. Refer to this document whenever you evolve the domain model.
