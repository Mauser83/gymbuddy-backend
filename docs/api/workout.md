# Workout API Documentation

## Authentication

All endpoints require authentication.

## Endpoints

### Create Workout

`POST /workouts`

**Request:**

```json
{
  "name": "My Workout Plan",
  "description": "Weekly strength training",
  "exercises": [
    {
      "exerciseId": "ex_123",
      "sets": 3,
      "reps": 10,
      "restInterval": 60
    }
  ]
}
```

**Response:**

```json
{
  "id": "workout_123",
  "name": "My Workout Plan",
  "ownerId": "user_123",
  "createdAt": "2025-04-21T12:00:00Z"
}
```

---

### Get Workouts

`GET /workouts`

**Response:**

```json
[
  {
    "id": "workout_123",
    "name": "My Workout Plan",
    "description": "Weekly strength training",
    "lastPerformed": "2025-04-20T09:00:00Z"
  }
]
```

---

### Share Workout

`POST /workouts/:id/share`

**Request:**

```json
{
  "userId": "user_456",
  "accessLevel": "VIEW" // or "EDIT"
}
```

**Permissions:**

- Workout owner or admin only

---

### Get Workout Details

`GET /workouts/:id`

**Response:**

```json
{
  "id": "workout_123",
  "name": "My Workout Plan",
  "exercises": [
    {
      "id": "ex_123",
      "name": "Bench Press",
      "sets": 3,
      "reps": 10
    }
  ],
  "sharedWith": [
    {
      "userId": "user_456",
      "accessLevel": "VIEW"
    }
  ]
}
```

**Permissions:**

- Owner
- Users with shared access
- Admin

---

### Delete Workout

`DELETE /workouts/:id`

**Permissions:**

- Owner or admin only
