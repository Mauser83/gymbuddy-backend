# Gym API Documentation

## Authentication
All endpoints require authentication.

## Endpoints

### List Gyms
`GET /gyms`

**Response:**
```json
[
  {
    "id": "gym_123",
    "name": "Fitness Center",
    "location": "123 Main St",
    "memberCount": 150
  }
]
```

---

### Create Gym (Admin only)
`POST /gyms`

**Request:**
```json
{
  "name": "New Gym",
  "location": "456 Oak Ave",
  "description": "24/7 fitness facility"
}
```

---

### Get Gym Details
`GET /gyms/:id`

**Response:**
```json
{
  "id": "gym_123",
  "name": "Fitness Center",
  "location": "123 Main St",
  "members": [
    {
      "userId": "user_123",
      "joinDate": "2025-01-15",
      "role": "MEMBER"
    }
  ]
}
```

**Permissions:**
- Gym members
- Admin

---

### Add Gym Member
`POST /gyms/:id/members`

**Request:**
```json
{
  "userId": "user_456"
}
```

**Permissions:**
- Gym admin
- System admin

---

### Update Member Role
`PUT /gyms/:id/members/:userId`

**Request:**
```json
{
  "role": "GYM_ADMIN"
}
```

**Permissions:**
- Gym admin
- System admin

---

### Remove Member
`DELETE /gyms/:id/members/:userId`

**Permissions:**
- Gym admin
- System admin