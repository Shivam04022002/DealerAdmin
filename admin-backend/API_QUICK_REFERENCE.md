# API Quick Reference Guide

**Base URL:** `http://localhost:5001/api`

---

## 🔐 Authentication

All protected endpoints require:
```
Authorization: Bearer <token>
```

---

## 📋 Endpoint Summary

### Authentication
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/auth/login` | ❌ | Login (admin/superadmin) |

### Admin Management
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/admin/register` | ❌ | Register new admin |
| POST | `/admin/login` | ❌ | Admin login (legacy) |
| GET | `/admin/profile` | ✅ | Get admin profile |
| GET | `/admin/workflow` | ✅ | Get admin workflows |
| PUT | `/admin/workflow` | ✅ | Update admin workflows |

### Workflow Management
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/workflow/pending` | ✅ | Get pending applications |
| GET | `/workflow/pending/:id` | ✅ | Get pending app by ID |
| GET | `/workflow/:id` | ✅ | Get application by ID |
| PATCH | `/workflow/update/:id` | ✅ | Update workflow stage |
| POST | `/workflow/approve/:id` | ✅ | Approve application |
| POST | `/workflow/reject/:id` | ✅ | Reject application |
| GET | `/workflow/applications/approved` | ✅ | Get approved apps |
| GET | `/workflow/applications/rejected` | ✅ | Get rejected apps |
| GET | `/workflow/applications/approved/:id` | ✅ | Get approved app by ID |
| GET | `/workflow/applications/rejected/:id` | ✅ | Get rejected app by ID |

### SuperAdmin Only
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/superadmin/admins` | ✅🔒 | Create admin |
| GET | `/superadmin/admins` | ✅🔒 | List all admins |
| PATCH | `/superadmin/admins/:id` | ✅🔒 | Update admin |
| DELETE | `/superadmin/admins/:id` | ✅🔒 | Delete admin |
| PATCH | `/superadmin/admins/toggle` | ✅🔒 | Activate/deactivate admin |
| GET | `/superadmin/dashboard/recent` | ✅🔒 | Recent activity logs |
| GET | `/superadmin/dashboard/summary` | ✅🔒 | Admin activity summary |
| GET | `/superadmin/dashboard/stats` | ✅🔒 | Application statistics |
| GET | `/superadmin/files/:type` | ✅🔒 | Get files by type |
| POST | `/superadmin/applications/revoke` | ✅🔒 | Revoke rejected app |

### Vehicles
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/vehicles` | ✅ | Get all vehicle details |

---

## 🔑 Status Codes

- `200` - Success
- `201` - Created
- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `409` - Conflict
- `500` - Server Error

---

## 📝 Common Request Examples

### Login
```json
POST /api/auth/login
{
  "email": "admin@example.com",
  "password": "password123"
}
```

### Update Workflow Stage
```json
PATCH /api/workflow/update/:id
{
  "nextWorkflowStage": "cibil",
  "expectedCurrentStage": "contact creation"
}
```

### Approve Application
```json
POST /api/workflow/approve/:id
{
  "note": "Approved",
  "approvedByName": "Admin Name"
}
```

### Create Admin (SuperAdmin)
```json
POST /api/superadmin/admins
{
  "name": "New Admin",
  "email": "newadmin@example.com",
  "password": "password123",
  "role": "admin",
  "workflows": ["contact creation", "cibil"]
}
```

---

## 🎯 Workflow Stages

1. `contact creation`
2. `cibil`
3. `housevisit`
4. `document collection`
5. `credit sanction`
6. `agreement`
7. `pre-disbursement documentation`
8. `disbursement` (or `disbursed`)

---

**Legend:**
- ✅ = Requires Authentication
- ❌ = No Authentication Required
- 🔒 = SuperAdmin Only

For detailed documentation, see [API_DOCUMENTATION.md](./API_DOCUMENTATION.md)

