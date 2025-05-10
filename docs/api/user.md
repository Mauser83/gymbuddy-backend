# User API Documentation

## Authentication
All endpoints require authentication unless noted otherwise.

## Endpoints

### Register User
`POST /auth/register`

**Request:**
```json
{
  "email": "user@example.com",
  "password": "securePassword123",
  "username": "newuser"
}
```

**Response (Success):**
```json
{
  "id": "user_123",
  "email": "user@example.com",
  "username": "newuser",
  "token": "jwt.token.here"
}
```

**Error Responses:**
- 400: Invalid input
- 409: Email already exists

---

### Login User  
`POST /auth/login`

**Request:**
```json
{
  "email": "user@example.com",
  "password": "securePassword123"
}
```

**Response:**
```json
{
  "id": "user_123",
  "email": "user@example.com",
  "username": "newuser", 
  "token": "jwt.token.here"
}
```

---

### Get User Profile
`GET /users/:id`

**Headers:**
```
Authorization: Bearer <token>
```

**Response:**
```json
{
  "id": "user_123",
  "email": "user@example.com",
  "username": "newuser",
  "isPremium": false,
  "joinedAt": "2025-04-21T12:00:00Z"
}
```

**Permissions:**
- User can view own profile
- Admin can view any profile

---

### Update User
`PUT /users/:id`

**Request:**
```json
{
  "username": "updatedUsername",
  "email": "new@email.com"
}
```

**Permissions:**
- User can update own profile
- Admin can update any profile

---

### Delete User
`DELETE /users/:id`

**Permissions:**
- Admin only