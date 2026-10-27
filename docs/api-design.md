# QuickNotes API Design

This is the API the backend team should build for QuickNotes.

- **Base URL:** `https://api.quicknotes.example/v1`
- **Format:** JSON for all requests and responses.
- **Authentication:** every endpoint except login needs the header `Authorization: Bearer <token>`.
- **Style:** resources are plural nouns, the HTTP method says the action, and the server keeps no session between requests.

## Endpoints

| Method | Path | Description | Success status |
|---|---|---|---|
| `POST` | `/auth/login` | Exchange an email and password for an access token | `200 OK` |
| `GET` | `/notes` | List the signed-in user's notes (supports `?tag=`, `?page=` and `?limit=`) | `200 OK` |
| `GET` | `/notes/{id}` | Get one note | `200 OK` |
| `POST` | `/notes` | Create a note | `201 Created` |
| `PUT` | `/notes/{id}` | Update a note's title, body and tags | `200 OK` |
| `DELETE` | `/notes/{id}` | Delete a note | `204 No Content` |
| `GET` | `/tags` | List the user's tags | `200 OK` |
| `POST` | `/notes/{id}/tags` | Attach a tag to a note | `201 Created` |

## Example: create a note

**Request:** `POST /notes`

```json
{
  "title": "Buy milk",
  "body": "Two litres of milk and a loaf of bread",
  "tagIds": [1, 3]
}
```

**Response:** `201 Created` (with the header `Location: /v1/notes/42`)

```json
{
  "id": 42,
  "title": "Buy milk",
  "body": "Two litres of milk and a loaf of bread",
  "tags": [
    { "id": 1, "name": "personal" },
    { "id": 3, "name": "shopping" }
  ],
  "createdAt": "2026-10-27T09:30:00Z",
  "updatedAt": "2026-10-27T09:30:00Z"
}
```

## Example: list notes

**Request:** `GET /notes?page=1&limit=2`

**Response:** `200 OK`

```json
{
  "data": [
    {
      "id": 42,
      "title": "Buy milk",
      "body": "Two litres of milk and a loaf of bread",
      "tags": [{ "id": 1, "name": "personal" }],
      "createdAt": "2026-10-27T09:30:00Z"
    },
    {
      "id": 41,
      "title": "Revise SQL joins",
      "body": "",
      "tags": [{ "id": 2, "name": "study" }],
      "createdAt": "2026-10-26T18:05:00Z"
    }
  ],
  "page": 1,
  "limit": 2,
  "total": 37
}
```

## Error codes

| Status | Meaning | Example of when it happens |
|---|---|---|
| `400 Bad Request` | The request is invalid or incomplete | `POST /notes` with an empty title, a title over 100 characters, or broken JSON |
| `401 Unauthorized` | No valid login | The `Authorization` header is missing, or the token has expired |
| `403 Forbidden` | Logged in, but not allowed | A user calls `DELETE /notes/42` on a note that belongs to someone else |
| `404 Not Found` | The resource does not exist | `GET /notes/9999` when no note has that id |
| `500 Internal Server Error` | An unexpected server problem | The database is unreachable while saving a note |

**Example error body** (`400 Bad Request`):

```json
{
  "error": {
    "status": 400,
    "code": "VALIDATION_ERROR",
    "message": "Title is required and must be 100 characters or fewer."
  }
}
```

All errors use the same shape, with a different `status`, `code` and `message`:

- `401`: `"code": "UNAUTHORIZED"`, `"message": "Your session has expired. Please log in again."`
- `403`: `"code": "FORBIDDEN"`, `"message": "You do not have permission to delete this note."`
- `404`: `"code": "NOT_FOUND"`, `"message": "Note 9999 does not exist."`
- `500`: `"code": "INTERNAL_ERROR"`, `"message": "Something went wrong on our side. Please try again later."`