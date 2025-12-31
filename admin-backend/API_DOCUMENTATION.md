# Admin Backend API Documentation

**Base URL:** `http://localhost:5001/api`  
**Version:** 1.0.0  
**Last Updated:** December 2025

---

## Table of Contents

1. [Authentication](#authentication)
2. [Admin Routes](#admin-routes)
3. [Workflow Routes](#workflow-routes)
4. [SuperAdmin Routes](#superadmin-routes)
5. [Vehicle Routes](#vehicle-routes)
6. [Error Handling](#error-handling)
7. [Data Models](#data-models)

---

## Authentication

Most endpoints require authentication via JWT Bearer token. Include the token in the Authorization header:

```
Authorization: Bearer <your_jwt_token>
```

### Token Format
- **Type:** JWT (JSON Web Token)
- **Expiration:** 7 days
- **Algorithm:** HS256
- **Payload:** Contains `id`, `email`, `name`, `role`, `isSuperAdmin`

---

## Authentication Routes

### POST `/api/auth/login`

Login endpoint for admins and superadmins.

**Request Body:**
```json
{
  "email": "admin@example.com",
  "password": "password123"
}
```

**Response (200 OK):**
```json
{
  "message": "Login successful",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "admin": {
    "id": "688dd7895dd46e54f70d552c",
    "name": "Admin Name",
    "email": "admin@example.com",
    "role": "admin",
    "isActive": true
  },
  "isSuperAdmin": false,
  "uiRoute": "/dashboard"
}
```

**Error Responses:**
- `400` - Email and password required
- `401` - Invalid credentials
- `403` - Account is deactivated

**Notes:**
- Password is automatically hashed if stored as plain text (legacy support)
- Trailing commas in password hashes are automatically cleaned
- Role is normalized: `sadmin` → `superadmin`

---

## Admin Routes

Base Path: `/api/admin`

### POST `/api/admin/register`

Register a new admin account.

**Request Body:**
```json
{
  "name": "Admin Name",
  "email": "admin@example.com",
  "password": "password123",
  "workflows": ["contact creation", "cibil", "housevisit"]
}
```

**Response (201 Created):**
```json
{
  "_id": "688dd7895dd46e54f70d552c",
  "name": "Admin Name",
  "email": "admin@example.com",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Error Responses:**
- `400` - Admin already exists

---

### POST `/api/admin/login`

Alternative login endpoint (legacy).

**Request Body:**
```json
{
  "email": "admin@example.com",
  "password": "password123"
}
```

**Response (200 OK):**
```json
{
  "_id": "688dd7895dd46e54f70d552c",
  "name": "Admin Name",
  "email": "admin@example.com",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

---

### GET `/api/admin/profile`

Get the authenticated admin's profile.

**Authentication:** Required

**Response (200 OK):**
```json
{
  "_id": "688dd7895dd46e54f70d552c",
  "name": "Admin Name",
  "email": "admin@example.com",
  "role": "admin",
  "workflows": ["contact creation", "cibil", "housevisit"],
  "isActive": true,
  "lastLoginAt": "2025-12-05T04:58:01.976Z",
  "createdAt": "2025-11-01T10:00:00.000Z",
  "updatedAt": "2025-12-05T04:58:01.976Z"
}
```

---

### GET `/api/admin/workflow`

Get the authenticated admin's workflow stages.

**Authentication:** Required

**Response (200 OK):**
```json
{
  "workflow": ["contact creation", "cibil", "housevisit", "document collection"]
}
```

---

### PUT `/api/admin/workflow`

Update the authenticated admin's workflow stages.

**Authentication:** Required

**Request Body:**
```json
{
  "workflow": ["contact creation", "cibil", "housevisit"]
}
```

**Or as comma-separated string:**
```json
{
  "workflow": "contact creation, cibil, housevisit"
}
```

**Response (200 OK):**
```json
{
  "workflow": ["contact creation", "cibil", "housevisit"]
}
```

---

## Workflow Routes

Base Path: `/api/workflow`

All endpoints require authentication.

### GET `/api/workflow/pending`

Get all pending applications that the admin has access to.

**Authentication:** Required  
**Query Parameters:** None

**Response (200 OK):**
```json
[
  {
    "_id": "69009d519e1b48d5b3c4d494",
    "formId": "FORM-702897",
    "applicant": {
      "applicant": {
        "name": "John Doe",
        "email": "john@example.com",
        "aadharNo": "1234 5678 9012",
        "photo": "https://...",
        "aadharFront": "https://...",
        "aadharBack": "https://...",
        "panImage": "https://...",
        "panNo": "ABCDE1234F"
      }
    },
    "coApplicant": {
      "name": "Jane Doe",
      "photo": "https://..."
    },
    "vehicleDetails": {
      "brandName": "Toyota",
      "modelName": "Camry",
      "priceOfVehicle": "1500000",
      "financeRequired": "1200000",
      "tenure": "60"
    },
    "dealer": {
      "_id": "...",
      "email": "dealer@example.com",
      "name": "Dealer Name",
      "district": "Mumbai",
      "branch": "Main Branch"
    },
    "dealerDetails": {
      "name": "Dealer Name",
      "email": "dealer@example.com",
      "branch": "Main Branch",
      "district": "Mumbai"
    },
    "status": "pending",
    "workflowStage": "contact creation",
    "history": []
  }
]
```

**Notes:**
- Only returns applications at workflow stages the admin has access to
- Includes new applications without a workflowStage
- Automatically runs auto-merge before returning results

---

### GET `/api/workflow/pending/:id`

Get a specific pending application by ID.

**Authentication:** Required  
**Path Parameters:**
- `id` - Application ID

**Response (200 OK):**
```json
{
  "_id": "69009d519e1b48d5b3c4d494",
  "formId": "FORM-702897",
  "applicant": { ... },
  "coApplicant": { ... },
  "vehicleDetails": { ... },
  "dealer": { ... },
  "dealerDetails": { ... },
  "status": "pending",
  "workflowStage": "contact creation",
  "history": []
}
```

**Error Responses:**
- `404` - Application not found

---

### GET `/api/workflow/:id`

Get an application by ID (works for pending applications).

**Authentication:** Required  
**Path Parameters:**
- `id` - Application ID

**Response:** Same as `/api/workflow/pending/:id`

---

### PATCH `/api/workflow/update/:id`

Update an application's workflow stage.

**Authentication:** Required  
**Path Parameters:**
- `id` - Application ID

**Request Body:**
```json
{
  "nextWorkflowStage": "cibil",
  "expectedCurrentStage": "contact creation"
}
```

**Response (200 OK):**
```json
{
  "message": "Workflow stage updated",
  "application": {
    "_id": "69009d519e1b48d5b3c4d494",
    "workflowStage": "cibil",
    "history": [
      {
        "action": "UPDATE_STAGE",
        "fromStage": "contact creation",
        "toStage": "cibil",
        "adminId": "688dd7895dd46e54f70d552c",
        "timestamp": "2025-12-05T10:00:00.000Z"
      }
    ]
  }
}
```

**Error Responses:**
- `400` - Invalid stage or stage not allowed for admin
- `404` - Application not found
- `409` - Current stage mismatch (if expectedCurrentStage provided)

**Alternative Endpoints (deprecated but supported):**
- `PATCH /api/workflow/update/:id`
- `PATCH /api/workflow/applications/:id`
- `PATCH /api/workflow/applications/update/:id`

**Notes:**
- Validates that the requested stage is in the admin's workflow list
- Prevents skipping workflow stages
- If `nextWorkflowStage` is "disbursement" or "disbursed", it moves to final stage but doesn't auto-approve

---

### POST `/api/workflow/approve/:id`

Approve an application and move it to the Approved collection.

**Authentication:** Required  
**Path Parameters:**
- `id` - Application ID

**Request Body:**
```json
{
  "note": "Approved via admin UI",
  "approvedByName": "Admin Name"
}
```

**Response (200 OK):**
```json
{
  "message": "Application approved successfully",
  "approvedApplication": {
    "_id": "...",
    "formId": "FORM-702897",
    "status": "approved",
    "workflowStage": "disbursement",
    "approvedAt": "2025-12-05T10:00:00.000Z",
    "approval": {
      "approvedAt": "2025-12-05T10:00:00.000Z",
      "approvedBy": "688dd7895dd46e54f70d552c",
      "notes": "Approved via admin UI"
    }
  }
}
```

**Error Responses:**
- `404` - Application not found
- `400` - Application already approved/rejected

**Notes:**
- Removes application from pending collection
- Creates entry in ApprovedApplication collection
- Logs activity in ActivityLog

---

### POST `/api/workflow/reject/:id`

Reject an application and move it to the Rejected collection.

**Authentication:** Required  
**Path Parameters:**
- `id` - Application ID

**Request Body:**
```json
{
  "reason": "Incomplete documentation",
  "note": "Rejected by admin",
  "rejectedByName": "Admin Name"
}
```

**Response (200 OK):**
```json
{
  "message": "Application rejected successfully",
  "rejectedApplication": {
    "_id": "...",
    "formId": "FORM-702897",
    "status": "rejected",
    "rejectedAt": "2025-12-05T10:00:00.000Z",
    "rejection": {
      "rejectedAt": "2025-12-05T10:00:00.000Z",
      "rejectedBy": "688dd7895dd46e54f70d552c",
      "reason": "Incomplete documentation",
      "notes": "Rejected by admin"
    }
  }
}
```

**Error Responses:**
- `404` - Application not found
- `400` - Application already approved/rejected

---

### GET `/api/workflow/applications/approved`

Get all approved applications.

**Authentication:** Required

**Response (200 OK):**
```json
[
  {
    "_id": "...",
    "formId": "FORM-702897",
    "applicant": { ... },
    "coApplicant": { ... },
    "vehicleDetails": { ... },
    "dealer": { ... },
    "dealerDetails": { ... },
    "status": "approved",
    "workflowStage": "disbursement",
    "approvedAt": "2025-12-05T10:00:00.000Z",
    "approval": {
      "approvedAt": "2025-12-05T10:00:00.000Z",
      "approvedBy": "...",
      "notes": "..."
    }
  }
]
```

---

### GET `/api/workflow/applications/approved/:id`

Get a specific approved application by ID.

**Authentication:** Required  
**Path Parameters:**
- `id` - Approved Application ID

**Response:** Same structure as approved application object

---

### GET `/api/workflow/applications/rejected`

Get all rejected applications.

**Authentication:** Required

**Response (200 OK):**
```json
[
  {
    "_id": "...",
    "formId": "FORM-702897",
    "applicant": { ... },
    "coApplicant": { ... },
    "vehicleDetails": { ... },
    "dealer": { ... },
    "dealerDetails": { ... },
    "status": "rejected",
    "rejectedAt": "2025-12-05T10:00:00.000Z",
    "rejection": {
      "rejectedAt": "2025-12-05T10:00:00.000Z",
      "rejectedBy": "...",
      "reason": "Incomplete documentation",
      "notes": "..."
    }
  }
]
```

---

### GET `/api/workflow/applications/rejected/:id`

Get a specific rejected application by ID.

**Authentication:** Required  
**Path Parameters:**
- `id` - Rejected Application ID

**Response:** Same structure as rejected application object

---

### POST `/api/workflow/fix-dealers`

Maintenance endpoint to fix dealer references in applications.

**Authentication:** Required

**Request Body:**
```json
{}
```

**Response (200 OK):**
```json
{
  "message": "Dealer references fixed",
  "updated": 42
}
```

---

### GET `/api/workflow/debug/pending-stages`

Debug endpoint to see distribution of workflow stages in pending applications.

**Authentication:** Required

**Response (200 OK):**
```json
[
  { "_id": "contact creation", "count": 15 },
  { "_id": "cibil", "count": 8 },
  { "_id": "housevisit", "count": 5 }
]
```

---

## SuperAdmin Routes

Base Path: `/api/superadmin`

**All endpoints require SuperAdmin authentication.**

### POST `/api/superadmin/admins`

Create a new admin account.

**Authentication:** Required (SuperAdmin only)

**Request Body:**
```json
{
  "name": "New Admin",
  "email": "newadmin@example.com",
  "password": "password123",
  "role": "admin",
  "workflows": [
    "contact creation",
    "cibil",
    "housevisit",
    "document collection",
    "credit sanction",
    "agreement",
    "pre-disbursement documentation",
    "disbursement"
  ]
}
```

**Response (201 Created):**
```json
{
  "message": "Admin created",
  "admin": {
    "id": "688dd7895dd46e54f70d552c",
    "name": "New Admin",
    "email": "newadmin@example.com",
    "role": "admin",
    "isActive": true
  }
}
```

**Error Responses:**
- `400` - Missing required fields or invalid role
- `409` - Email already in use
- `403` - Not a superadmin

---

### GET `/api/superadmin/admins`

Get all admin accounts.

**Authentication:** Required (SuperAdmin only)

**Response (200 OK):**
```json
{
  "admins": [
    {
      "_id": "688dd7895dd46e54f70d552c",
      "name": "Admin Name",
      "email": "admin@example.com",
      "role": "admin",
      "isActive": true,
      "lastLoginAt": "2025-12-05T04:58:01.976Z",
      "createdAt": "2025-11-01T10:00:00.000Z",
      "workflows": [
        "contact creation",
        "cibil",
        "housevisit"
      ]
    }
  ]
}
```

---

### PATCH `/api/superadmin/admins/:id`

Update an admin account.

**Authentication:** Required (SuperAdmin only)  
**Path Parameters:**
- `id` - Admin ID

**Request Body:**
```json
{
  "name": "Updated Admin Name",
  "email": "updated@example.com",
  "role": "admin",
  "workflows": [
    "contact creation",
    "cibil",
    "housevisit",
    "document collection"
  ]
}
```

**Response (200 OK):**
```json
{
  "message": "Admin updated",
  "admin": {
    "id": "688dd7895dd46e54f70d552c",
    "name": "Updated Admin Name",
    "email": "updated@example.com",
    "role": "admin",
    "workflows": [
      "contact creation",
      "cibil",
      "housevisit",
      "document collection"
    ]
  }
}
```

**Error Responses:**
- `400` - Invalid role or cannot change own role
- `404` - Admin not found
- `403` - Not a superadmin

**Notes:**
- Cannot change your own role from superadmin to admin
- Password updates not supported via this endpoint (use separate password reset)

---

### DELETE `/api/superadmin/admins/:id`

Delete an admin account.

**Authentication:** Required (SuperAdmin only)  
**Path Parameters:**
- `id` - Admin ID

**Response (200 OK):**
```json
{
  "message": "Admin deleted"
}
```

**Error Responses:**
- `400` - Cannot delete your own account
- `404` - Admin not found
- `403` - Not a superadmin

---

### PATCH `/api/superadmin/admins/toggle`

Activate or deactivate an admin account.

**Authentication:** Required (SuperAdmin only)

**Request Body:**
```json
{
  "adminId": "688dd7895dd46e54f70d552c",
  "isActive": false
}
```

**Response (200 OK):**
```json
{
  "message": "Updated",
  "admin": {
    "id": "688dd7895dd46e54f70d552c",
    "isActive": false
  }
}
```

**Error Responses:**
- `400` - Cannot change your own active status
- `404` - Admin not found
- `403` - Not a superadmin

---

### GET `/api/superadmin/dashboard/recent`

Get recent activity logs.

**Authentication:** Required (SuperAdmin only)  
**Query Parameters:**
- `limit` - Number of logs to return (default: 50)

**Example:** `/api/superadmin/dashboard/recent?limit=25`

**Response (200 OK):**
```json
{
  "logs": [
    {
      "_id": "...",
      "adminId": {
        "_id": "688dd7895dd46e54f70d552c",
        "name": "Admin Name",
        "email": "admin@example.com",
        "role": "admin"
      },
      "applicationId": {
        "_id": "69009d519e1b48d5b3c4d494"
      },
      "action": "UPDATE_STAGE",
      "fromStage": "contact creation",
      "toStage": "cibil",
      "notes": "Stage updated",
      "at": "2025-12-05T10:00:00.000Z"
    }
  ]
}
```

---

### GET `/api/superadmin/dashboard/summary`

Get admin activity summary.

**Authentication:** Required (SuperAdmin only)  
**Query Parameters:**
- `from` - Start date (ISO format)
- `to` - End date (ISO format)

**Example:** `/api/superadmin/dashboard/summary?from=2025-12-01&to=2025-12-31`

**Response (200 OK):**
```json
{
  "summary": [
    {
      "adminId": "688dd7895dd46e54f70d552c",
      "name": "Admin Name",
      "email": "admin@example.com",
      "role": "admin",
      "totalActions": 150,
      "updates": 100,
      "approvals": 30,
      "rejections": 15,
      "edits": 5,
      "lastActionAt": "2025-12-05T10:00:00.000Z"
    }
  ]
}
```

---

### GET `/api/superadmin/dashboard/stats`

Get application statistics.

**Authentication:** Required (SuperAdmin only)

**Response (200 OK):**
```json
{
  "stats": {
    "pending": 45,
    "approved": 120,
    "rejected": 25,
    "total": 190
  }
}
```

---

### GET `/api/superadmin/dashboard/application/:applicationId/history`

Get complete history for a specific application.

**Authentication:** Required (SuperAdmin only)  
**Path Parameters:**
- `applicationId` - Application ID

**Response (200 OK):**
```json
{
  "application": {
    "_id": "69009d519e1b48d5b3c4d494",
    "status": "pending",
    "stage": "cibil",
    "updatedAt": "2025-12-05T10:00:00.000Z"
  },
  "history": [
    {
      "_id": "...",
      "adminId": {
        "name": "Admin Name",
        "email": "admin@example.com",
        "role": "admin"
      },
      "action": "UPDATE_STAGE",
      "fromStage": "contact creation",
      "toStage": "cibil",
      "at": "2025-12-05T10:00:00.000Z"
    }
  ]
}
```

---

### GET `/api/superadmin/files/:type`

Get all files (applications) by type.

**Authentication:** Required (SuperAdmin only)  
**Path Parameters:**
- `type` - One of: `pending`, `approved`, `rejected`

**Example:** `/api/superadmin/files/pending`

**Response (200 OK):**
```json
[
  {
    "_id": "...",
    "formId": "FORM-702897",
    "applicant": { ... },
    "coApplicant": { ... },
    "vehicleDetails": { ... },
    "dealer": { ... },
    "dealerDetails": { ... },
    "status": "pending",
    "workflowStage": "contact creation"
  }
]
```

**Error Responses:**
- `400` - Invalid type (must be pending, approved, or rejected)

---

### POST `/api/superadmin/applications/revoke`

Revoke a rejected application and move it back to pending.

**Authentication:** Required (SuperAdmin only)

**Request Body:**
```json
{
  "applicationId": "69009d519e1b48d5b3c4d494"
}
```

**Response (200 OK):**
```json
{
  "message": "Application revoked and moved back to pending",
  "application": {
    "_id": "...",
    "formId": "FORM-702897",
    "status": "pending",
    "workflowStage": "pending",
    "history": [
      {
        "action": "REVOKED",
        "adminId": "...",
        "notes": "Application revoked from rejected status",
        "timestamp": "2025-12-05T10:00:00.000Z"
      }
    ]
  }
}
```

**Error Responses:**
- `404` - Rejected application not found

**Notes:**
- Removes application from RejectedApplication collection
- Creates new entry in Application collection with status "pending"
- Resets workflowStage to "pending"
- Logs activity in ActivityLog

---

## Vehicle Routes

Base Path: `/api/vehicles`

### GET `/api/vehicles`

Get all vehicle details with user information.

**Authentication:** Required

**Response (200 OK):**
```json
[
  {
    "_id": "...",
    "brandName": "Toyota",
    "modelName": "Camry",
    "priceOfVehicle": "1500000",
    "financeRequired": "1200000",
    "tenure": "60",
    "user": {
      "_id": "...",
      "name": "User Name",
      "email": "user@example.com",
      "region": "Mumbai",
      "branch": "Main Branch"
    }
  }
]
```

---

## Error Handling

All endpoints follow consistent error response format:

### Standard Error Response

```json
{
  "message": "Error description",
  "error": "Detailed error message (optional)"
}
```

### HTTP Status Codes

- `200` - Success
- `201` - Created
- `400` - Bad Request (validation errors, missing fields)
- `401` - Unauthorized (missing or invalid token)
- `403` - Forbidden (insufficient permissions)
- `404` - Not Found
- `409` - Conflict (duplicate email, stage mismatch)
- `500` - Internal Server Error

### Common Error Scenarios

#### Authentication Errors
```json
{
  "message": "Not authorized, no token"
}
```

```json
{
  "message": "Not authorized, token invalid"
}
```

#### Validation Errors
```json
{
  "message": "Email and password required"
}
```

```json
{
  "message": "nextWorkflowStage is required"
}
```

#### Permission Errors
```json
{
  "message": "Super Admin required"
}
```

```json
{
  "message": "Stage 'invalid_stage' is not allowed for your account (admin workflow).",
  "allowedStages": ["contact creation", "cibil", "housevisit"]
}
```

#### Conflict Errors
```json
{
  "message": "Current stage mismatch",
  "current": "cibil"
}
```

---

## Data Models

### Admin Model

```typescript
{
  _id: ObjectId,
  name: string,
  email: string (unique),
  password: string (hashed),
  role: "admin" | "superadmin",
  workflows: string[],
  isActive: boolean,
  createdBy: ObjectId | null,
  lastLoginAt: Date | null,
  createdAt: Date,
  updatedAt: Date
}
```

### Application Model

```typescript
{
  _id: ObjectId,
  formId: string,
  applicant: {
    applicant: {
      name: string,
      email: string,
      aadharNo: string,
      photo: string,
      aadharFront: string,
      aadharBack: string,
      panImage: string,
      panNo: string,
      fatherName: string,
      dateOfBirth: string,
      age: number,
      address: string
    }
  },
  coApplicant: {
    name: string,
    photo: string,
    aadharNo: string,
    aadharFront: string,
    aadharBack: string,
    panImage: string,
    panNo: string,
    fatherName: string,
    dateOfBirth: string,
    age: number,
    address: string,
    pincode: string,
    policeStation: string,
    postOffice: string,
    relation: string,
    documentType: string,
    form60: string
  },
  vehicleDetails: {
    brandName: string,
    modelName: string,
    priceOfVehicle: string,
    financeRequired: string,
    tenure: string
  },
  dealer: ObjectId (reference to User),
  dealerDetails: {
    name: string,
    email: string,
    branch: string,
    district: string
  },
  status: "pending" | "approved" | "rejected",
  workflowStage: string,
  history: Array<{
    action: string,
    fromStage: string,
    toStage: string,
    adminId: ObjectId,
    timestamp: Date,
    notes: string
  }>
}
```

### ApprovedApplication Model

Extends Application with:
```typescript
{
  approvedAt: Date,
  approval: {
    approvedAt: Date,
    approvedBy: ObjectId,
    notes: string
  }
}
```

### RejectedApplication Model

Extends Application with:
```typescript
{
  rejectedAt: Date,
  rejection: {
    rejectedAt: Date,
    rejectedBy: ObjectId,
    reason: string,
    notes: string
  }
}
```

### ActivityLog Model

```typescript
{
  _id: ObjectId,
  adminId: ObjectId (reference to Admin),
  applicationId: ObjectId (reference to Application),
  action: "UPDATE_STAGE" | "APPROVE" | "REJECT" | "REVOKE_REJECTION" | "EDIT_FIELDS",
  fromStage: string,
  toStage: string,
  notes: string,
  at: Date
}
```

---

## Workflow Stages

Valid workflow stages (in order):

1. `contact creation`
2. `cibil`
3. `housevisit`
4. `document collection`
5. `credit sanction`
6. `agreement`
7. `pre-disbursement documentation`
8. `disbursement` (or `disbursed` - alias)

**Note:** `disbursed` is automatically mapped to `disbursement` for consistency.

---

## Rate Limiting

Currently not implemented. Consider adding rate limiting for production.

---

## CORS

CORS is enabled for all origins. Configure in `server.js` for production.

---

## Environment Variables

Required environment variables:

```env
MONGO_URI=mongodb://localhost:27017/admin_db
PORT=5001
JWT_SECRET=your_secret_key_here
JWT_EXPIRES_IN=7d
NODE_ENV=development
```

---

## Testing

### Example cURL Requests

#### Login
```bash
curl -X POST http://localhost:5001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"password123"}'
```

#### Get Pending Applications
```bash
curl -X GET http://localhost:5001/api/workflow/pending \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

#### Update Workflow Stage
```bash
curl -X PATCH http://localhost:5001/api/workflow/update/APPLICATION_ID \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -H "Content-Type: application/json" \
  -d '{"nextWorkflowStage":"cibil","expectedCurrentStage":"contact creation"}'
```

#### Create Admin (SuperAdmin)
```bash
curl -X POST http://localhost:5001/api/superadmin/admins \
  -H "Authorization: Bearer SUPERADMIN_TOKEN_HERE" \
  -H "Content-Type: application/json" \
  -d '{
    "name":"New Admin",
    "email":"newadmin@example.com",
    "password":"password123",
    "role":"admin",
    "workflows":["contact creation","cibil","housevisit"]
  }'
```

---

## Changelog

### Version 1.0.0 (December 2025)
- Initial API documentation
- Added password hashing with auto-migration
- Added workflow alias support (`disbursed` → `disbursement`)
- Added SuperAdmin features (admin management, stats, file management)
- Added application revocation feature
- Enhanced error handling and logging

---

## Support

For issues or questions, contact the development team or refer to the source code in the `admin-backend` directory.

