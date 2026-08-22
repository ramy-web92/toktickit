\# Lab 2 REST API Contract



Base path: `/api/v1`. All request/response bodies are JSON (camelCase) except attachment upload

(multipart/form-data) and attachment download (binary stream). No authentication in Lab 2 — every

endpoint that touches a Ticket or Attachment requires a `requesterId` parameter representing the

currently selected Development Requester; the backend verifies ownership server-side on every call.



\---



\## 1. GET /dev-requesters

Response 200:

```json

{ "requesters": \[ { "id": 1, "name": "Jennifer Anderson", "email": "jennifer@example.com" } ] }

```



\## 2. GET /categories

Response 200:

```json

{ "categories": \[ { "id": 1, "name": "Hardware" } ] }

```



\## 3. GET /related-systems

Response 200:

```json

{ "relatedSystems": \[ { "id": 1, "name": "Corporate Laptop" } ] }

```



\## 4. POST /tickets

Request (multipart/form-data): requesterId, categoryId, relatedSystemId, summary, description,

requestedPriority, attachments\[] (optional, 0-5 files, ≤5MB each, JPG/PNG/WEBP/PDF).



Response 201:

```json

{

&#x20; "ticket": {

&#x20;   "id": 123, "ticketNumber": "TKT-2026-000123", "requesterId": 1,

&#x20;   "summary": "Laptop battery drains quickly", "requestedPriority": "MEDIUM",

&#x20;   "itPriority": "MEDIUM", "currentStatus": "NEW", "createdAt": "2026-08-22T10:00:00Z"

&#x20; },

&#x20; "attachmentResults": \[ { "fileName": "photo.png", "status": "UPLOADED", "attachmentId": 5 } ]

}

```

Response 422 (validation failure):

```json

{ "error": { "code": "VALIDATION\_ERROR", "fields": { "summary": "Summary must be between 5 and 120 characters" } } }

```



\## 5. GET /tickets

Query params: requesterId (required), search, categoryId, requestedPriority, itPriority,

currentStatus, sort (createdAt|ticketNumber|summary|updatedAt), order (asc|desc), page, pageSize

(10|25|50).



Response 200:

```json

{

&#x20; "tickets": \[ { "id": 123, "ticketNumber": "TKT-2026-000123", "summary": "...", "currentStatus": "NEW" } ],

&#x20; "pagination": { "page": 1, "pageSize": 10, "totalItems": 42, "totalPages": 5 }

}

```



\## 6. GET /tickets/:id

Query: requesterId (required)



Response 200:

```json

{

&#x20; "ticket": { "id": 123, "ticketNumber": "TKT-2026-000123", "summary": "...", "description": "..." },

&#x20; "attachments": \[ { "id": 5, "originalFileName": "photo.png", "isRemoved": false } ]

}

```

Response 404: Ticket not found OR not owned by requesterId — same response either way:

```json

{ "error": { "code": "TICKET\_NOT\_FOUND" } }

```



\## 7. POST /tickets/:id/attachments

Request (multipart/form-data): requesterId, file



Response 201:

```json

{ "attachment": { "id": 6, "originalFileName": "photo2.png", "sizeBytes": 204800 } }

```

Response 409 (limit reached): `{ "error": { "code": "ATTACHMENT\_LIMIT\_REACHED" } }`

Response 413: `{ "error": { "code": "FILE\_TOO\_LARGE" } }`

Response 415: `{ "error": { "code": "UNSUPPORTED\_FILE\_TYPE" } }`



\## 8. GET /attachments/:id/metadata

Query: requesterId (required)



Response 200:

```json

{ "id": 5, "ticketId": 123, "originalFileName": "photo.png", "isRemoved": false }

```



\## 9. GET /attachments/:id/download

Query: requesterId (required)



Response 200: binary stream

Response 404: not found/not owned — `{ "error": { "code": "ATTACHMENT\_NOT\_FOUND" } }`

Response 410: attachment removed — `{ "error": { "code": "ATTACHMENT\_REMOVED" } }`



\## 10. DELETE /attachments/:id

Request body: `{ "requesterId": 1, "reason": "Wrong file uploaded" }`



Response 200:

```json

{ "attachment": { "id": 5, "isRemoved": true, "removalReason": "Wrong file uploaded" } }

```

Response 409 (already removed): `{ "error": { "code": "ATTACHMENT\_ALREADY\_REMOVED" } }`

Response 422 (missing reason): `{ "error": { "code": "VALIDATION\_ERROR", "fields": { "reason": "Reason is required (min 3 characters)" } } }`



\---



\## HTTP Status Code Summary

| Code | Meaning |

|---|---|

| 200 | Successful retrieval / soft-removal |

| 201 | Resource created |

| 404 | Missing resource OR not owned (never distinguished) |

| 409 | Conflict (attachment limit, already removed) |

| 410 | Resource exists but is removed |

| 413 | File exceeds size limit |

| 415 | Unsupported file type |

| 422 | Validation error |

| 500 | Unexpected server error |

