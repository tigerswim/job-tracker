# API Documentation

This document describes the API endpoints available in the Job Tracker application.

## Authentication

All API endpoints require authentication via Supabase Auth. The client automatically handles authentication tokens through the `@supabase/auth-helpers-nextjs` package.

## Base URL

Development: `http://localhost:3001/api`
Production: `https://your-domain.com/api`

## Contacts API

### GET /api/contacts

Retrieve contacts for the authenticated user.

**Query Parameters:**
- `search` (string, optional): Search term for filtering contacts
- `limit` (number, optional): Maximum number of results (default: 50)
- `offset` (number, optional): Number of records to skip for pagination

**Response:**
```json
{
  "contacts": [
    {
      "id": "uuid",
      "name": "John Doe",
      "email": "john@example.com",
      "phone": "+1 (555) 123-4567",
      "current_location": "San Francisco, CA",
      "company": "Tech Corp",
      "job_title": "Senior Developer",
      "linkedin_url": "https://linkedin.com/in/johndoe",
      "notes": "Met at tech conference",
      "experience": [...],
      "education": [...],
      "mutual_connections": ["Alice Smith", "Bob Johnson"],
      "created_at": "2024-01-01T00:00:00Z",
      "updated_at": "2024-01-01T00:00:00Z"
    }
  ],
  "total": 25,
  "hasMore": true
}
```

### POST /api/contacts

Create a new contact.

**Request Body:**
```json
{
  "name": "Jane Smith",
  "email": "jane@example.com",
  "phone": "+1 (555) 987-6543",
  "current_location": "New York, NY",
  "company": "Design Studio",
  "job_title": "UX Designer",
  "linkedin_url": "https://linkedin.com/in/janesmith",
  "notes": "Referred by mutual friend",
  "experience": [
    {
      "company": "Previous Corp",
      "title": "Junior Designer",
      "start_date": "2022-01",
      "end_date": "2023-12",
      "is_current": false,
      "description": "Designed user interfaces for web applications"
    }
  ],
  "education": [
    {
      "institution": "University of Design",
      "degree_and_field": "Bachelor's in Graphic Design",
      "year": "2021",
      "notes": "Magna Cum Laude"
    }
  ],
  "mutual_connections": ["Sarah Wilson"]
}
```

**Response:**
```json
{
  "id": "new-uuid",
  "message": "Contact created successfully"
}
```

## Reminders API

### GET /api/reminders

Retrieve reminders for the authenticated user.

**Query Parameters:**
- `status` (string, optional): Filter by status (`pending`, `sent`, `failed`, `cancelled`)
- `contact_id` (string, optional): Filter by specific contact
- `job_id` (string, optional): Filter by specific job
- `limit` (number, optional): Maximum number of results (default: 50)
- `offset` (number, optional): Number of records to skip
- `sort_by` (string, optional): Sort field (`scheduled_time`, `created_at`)
- `sort_order` (string, optional): Sort direction (`asc`, `desc`)

**Response:**
```json
{
  "reminders": [
    {
      "id": "uuid",
      "title": "Follow up on application",
      "description": "Send thank you email after interview",
      "scheduled_time": "2024-01-15T10:00:00Z",
      "status": "pending",
      "contact_id": "contact-uuid",
      "job_id": "job-uuid",
      "reminder_type": "follow_up",
      "created_at": "2024-01-01T00:00:00Z",
      "updated_at": "2024-01-01T00:00:00Z"
    }
  ],
  "total": 12,
  "hasMore": false
}
```

### POST /api/reminders

Create a new reminder.

**Request Body:**
```json
{
  "title": "Follow up on interview",
  "description": "Send thank you note to hiring manager",
  "scheduled_time": "2024-01-20T14:00:00Z",
  "contact_id": "contact-uuid",
  "job_id": "job-uuid",
  "reminder_type": "follow_up"
}
```

**Response:**
```json
{
  "id": "new-reminder-uuid",
  "message": "Reminder created successfully"
}
```

### GET /api/reminders/stats

Get reminder statistics for the authenticated user.

**Response:**
```json
{
  "total": 45,
  "pending": 12,
  "sent": 28,
  "failed": 2,
  "cancelled": 3,
  "thisMonth": 15,
  "thisWeek": 5,
  "overdue": 2
}
```

### PUT /api/reminders/[id]

Update an existing reminder.

**Request Body:**
```json
{
  "title": "Updated reminder title",
  "description": "Updated description",
  "scheduled_time": "2024-01-25T16:00:00Z",
  "status": "pending"
}
```

**Response:**
```json
{
  "message": "Reminder updated successfully"
}
```

### DELETE /api/reminders/[id]

Delete a reminder.

**Response:**
```json
{
  "message": "Reminder deleted successfully"
}
```

## Error Responses

All endpoints return appropriate HTTP status codes and error messages:

### 400 Bad Request
```json
{
  "error": "Invalid request parameters",
  "details": "Description of the specific validation error"
}
```

### 401 Unauthorized
```json
{
  "error": "Authentication required",
  "message": "Please sign in to access this resource"
}
```

### 403 Forbidden
```json
{
  "error": "Access denied",
  "message": "You don't have permission to access this resource"
}
```

### 404 Not Found
```json
{
  "error": "Resource not found",
  "message": "The requested resource could not be found"
}
```

### 500 Internal Server Error
```json
{
  "error": "Internal server error",
  "message": "An unexpected error occurred. Please try again later."
}
```

## Rate Limiting

API endpoints are protected against abuse with the following limits:
- 100 requests per minute per user for GET requests
- 20 requests per minute per user for POST/PUT/DELETE requests

## Data Models

### Contact
- `id`: UUID (auto-generated)
- `name`: String (required, max 255 chars)
- `email`: String (optional, valid email format)
- `phone`: String (optional, max 50 chars)
- `current_location`: String (optional, max 255 chars)
- `company`: String (optional, max 255 chars)
- `job_title`: String (optional, max 255 chars)
- `linkedin_url`: String (optional, valid URL)
- `notes`: Text (optional)
- `experience`: Array of ExperienceEntry objects
- `education`: Array of EducationEntry objects
- `mutual_connections`: Array of strings
- `user_id`: UUID (auto-set from auth)
- `created_at`: DateTime (auto-generated)
- `updated_at`: DateTime (auto-updated)

### ExperienceEntry
- `id`: UUID (auto-generated)
- `company`: String (required, max 255 chars)
- `title`: String (required, max 255 chars)
- `start_date`: String (YYYY-MM format)
- `end_date`: String (YYYY-MM format, null if current)
- `is_current`: Boolean
- `description`: Text (optional)

### EducationEntry
- `id`: UUID (auto-generated)
- `institution`: String (required, max 255 chars)
- `degree_and_field`: String (required, max 255 chars)
- `year`: String (graduation year or range)
- `notes`: Text (optional)

### Reminder
- `id`: UUID (auto-generated)
- `title`: String (required, max 255 chars)
- `description`: Text (optional)
- `scheduled_time`: DateTime (required)
- `status`: Enum (`pending`, `sent`, `failed`, `cancelled`)
- `contact_id`: UUID (optional, foreign key)
- `job_id`: UUID (optional, foreign key)
- `reminder_type`: String (optional, max 50 chars)
- `user_id`: UUID (auto-set from auth)
- `created_at`: DateTime (auto-generated)
- `updated_at`: DateTime (auto-updated)

## Authentication Flow

1. **User Registration/Login**: Handled by Supabase Auth
2. **Session Management**: Automatic token refresh via auth helpers
3. **API Access**: All requests include authentication headers
4. **Row Level Security**: Database enforces user-specific data access

## Best Practices

1. **Error Handling**: Always handle potential error responses
2. **Pagination**: Use limit/offset for large datasets
3. **Validation**: Validate data on both client and server side
4. **Authentication**: Check auth status before making API calls
5. **Rate Limiting**: Implement client-side request throttling
6. **Caching**: Cache static data where appropriate

## SDKs and Libraries

The application uses these key libraries for API interaction:
- `@supabase/supabase-js`: Core Supabase client
- `@supabase/auth-helpers-nextjs`: Next.js authentication helpers
- `axios` or `fetch`: HTTP client for API requests
- `swr` or similar: Data fetching with caching (if implemented)