# RBAC API Documentation

## Permission Types

| Type            | Description                     |
| --------------- | ------------------------------- |
| OWNERSHIP       | User owns the resource          |
| GYM_SCOPE       | Permission within a gym context |
| APP_SCOPE       | App-wide permission             |
| PREMIUM_FEATURE | Requires premium subscription   |

## Endpoint Requirements

### User Endpoints

| Endpoint          | Required Roles            |
| ----------------- | ------------------------- |
| GET /users        | ADMIN or MODERATOR        |
| PUT /users/:id    | ADMIN, MODERATOR or owner |
| DELETE /users/:id | ADMIN only                |

### Gym Endpoints

| Endpoint         | Required Roles         |
| ---------------- | ---------------------- |
| POST /gyms       | ADMIN or MODERATOR     |
| PUT /gyms/:id    | GYM_ADMIN or APP_ADMIN |
| DELETE /gyms/:id | ADMIN only             |

## Error Responses

- `403 Forbidden`: Insufficient permissions
- `401 Unauthorized`: Authentication required
- `400 Bad Request`: Invalid role assignment
