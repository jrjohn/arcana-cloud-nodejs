# API Documentation

## Base URL

```
http://localhost:3000/api
```

## Authentication

All protected endpoints require a JWT token in the Authorization header:

```
Authorization: Bearer <access_token>
```

---

## Auth Endpoints

### Register User
```http
POST /api/auth/register
Content-Type: application/json

{
  "username": "johndoe",
  "email": "john@example.com",
  "password": "SecurePass123!"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": 1,
      "username": "johndoe",
      "email": "john@example.com",
      "role": "USER",
      "status": "ACTIVE"
    },
    "tokens": {
      "accessToken": "eyJhbG...",
      "refreshToken": "eyJhbG...",
      "expiresIn": 3600
    }
  }
}
```

### Login
```http
POST /api/auth/login
Content-Type: application/json

{
  "usernameOrEmail": "johndoe",
  "password": "SecurePass123!"
}
```

### Logout
```http
POST /api/auth/logout
Authorization: Bearer <access_token>
```

### Refresh Token
```http
POST /api/auth/refresh
Content-Type: application/json

{
  "refreshToken": "eyJhbG..."
}
```

---

## User Endpoints

### List Users
```http
GET /api/users?page=1&limit=20
Authorization: Bearer <access_token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "users": [...],
    "total": 100,
    "page": 1,
    "limit": 20
  }
}
```

### Get User by ID
```http
GET /api/users/:id
Authorization: Bearer <access_token>
```

### Update User
```http
PUT /api/users/:id
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "firstName": "John",
  "lastName": "Doe"
}
```

### Delete User
```http
DELETE /api/users/:id
Authorization: Bearer <access_token>
```

### Change Password
```http
PUT /api/users/:id/password
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "oldPassword": "OldPass123!",
  "newPassword": "NewPass456!"
}
```

---

## Health Endpoints

### Health Check
```http
GET /health
```

### Readiness Probe
```http
GET /health/ready
```

### Liveness Probe
```http
GET /health/live
```

---

## Error Responses

### Validation Error (400)
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed",
    "details": [...]
  }
}
```

### Unauthorized (401)
```json
{
  "success": false,
  "error": {
    "code": "AUTHENTICATION_ERROR",
    "message": "Invalid or expired token"
  }
}
```

### Forbidden (403)
```json
{
  "success": false,
  "error": {
    "code": "AUTHORIZATION_ERROR",
    "message": "Insufficient permissions"
  }
}
```

### Not Found (404)
```json
{
  "success": false,
  "error": {
    "code": "NOT_FOUND_ERROR",
    "message": "Resource not found"
  }
}
```

### Rate Limited (429)
```json
{
  "success": false,
  "error": {
    "code": "RATE_LIMIT_ERROR",
    "message": "Too many requests"
  }
}
```
