# Stage 1: Notification System API Design

## 1. Core Features Identified

The following core actions support the campus notification platform:
- **Publish Notification**: Send a new notification to a specific group, topic, or globally.
- **Fetch Notifications**: Retrieve a paginated list of notifications for a user/topic, with filtering and sorting.
- **Mark as Read**: Mark a specific notification or all notifications as read for a user.
- **Get Unread Count**: Retrieve the total number of unread notifications for a user to display badges.
- **Subscribe/Unsubscribe**: Allow users to opt-in or opt-out of specific notification topics (e.g., placements, events).

## 2. JSON Schema Design

The central `Notification` entity is designed for scalability and extensibility.

```json
{
  "id": "notif_8f72c3b9e4a1",
  "topic": "placements",
  "priority": "high",
  "title": "Google Campus Drive 2026",
  "body": "Google is visiting the campus for SDE roles. Please register by tomorrow.",
  "metadata": {
    "action_url": "https://campus.edu/placements/google",
    "image_url": "https://campus.edu/assets/google_logo.png"
  },
  "is_read": false,
  "created_at": "2026-05-05T10:00:00Z",
  "expires_at": "2026-05-10T23:59:59Z"
}
```
* **id**: Unique identifier (UUID or ULID for time-based sorting).
* **topic**: Category of notification (e.g., `placements`, `events`, `general`).
* **priority**: Enum (`low`, `normal`, `high`, `urgent`) to dictate delivery mechanisms.
* **metadata**: Flexible JSON object for client-side rendering (action links, images).
* **expires_at**: TTL for transient notifications (avoids DB bloat).

## 3. REST API Design

### 3.1 Fetch Notifications
Retrieves a paginated list of notifications for the user.

- **Method**: `GET`
- **Path**: `/api/v1/users/{userId}/notifications`
- **Headers**:
  - `Content-Type: application/json`
- **Query Parameters**:
  - `page` (default: 1)
  - `limit` (default: 20, max: 100)
  - `topic` (optional filter, e.g., `events`)
  - `is_read` (optional filter, boolean)
  - `sort_by` (default: `created_at:desc`)
- **Response (200 OK)**:
```json
{
  "data": [
    { /* Notification Object */ }
  ],
  "pagination": {
    "current_page": 1,
    "total_pages": 5,
    "total_items": 95,
    "has_next": true
  }
}
```

### 3.2 Get Unread Count
Quickly retrieves the badge count.

- **Method**: `GET`
- **Path**: `/api/v1/users/{userId}/notifications/unread-count`
- **Response (200 OK)**:
```json
{
  "unread_count": 4
}
```

### 3.3 Mark Notification as Read
Idempotent operation to mark a specific notification as read.

- **Method**: `PATCH`
- **Path**: `/api/v1/users/{userId}/notifications/{notificationId}/read`
- **Headers**:
  - `Content-Type: application/json`
  - `Idempotency-Key`: UUID (to prevent duplicate processing)
- **Response (200 OK)**:
```json
{
  "success": true,
  "id": "notif_8f72c3b9e4a1",
  "is_read": true
}
```

### 3.4 Mark All as Read
- **Method**: `POST`
- **Path**: `/api/v1/users/{userId}/notifications/read-all`
- **Response (200 OK)**:
```json
{
  "success": true,
  "updated_count": 4
}
```

### 3.5 Publish Notification (Admin/Service to System)
- **Method**: `POST`
- **Path**: `/api/v1/notifications`
- **Headers**:
  - `Content-Type: application/json`
  - `Idempotency-Key`: UUID
- **Request Body**:
```json
{
  "target_type": "topic",
  "target_id": "placements",
  "priority": "high",
  "title": "Google Campus Drive 2026",
  "body": "Google is visiting the campus for SDE roles.",
  "metadata": { "action_url": "..." },
  "expires_in_hours": 120
}
```
- **Response (202 Accepted)**:
```json
{
  "success": true,
  "message": "Notification queued for delivery",
  "batch_id": "batch_9912xyz"
}
```

## 4. Real-Time Notification Mechanism

### Architecture Approach: Server-Sent Events (SSE)
For a campus notification platform where updates flow strictly from Server -> Client, **Server-Sent Events (SSE)** is the most efficient and scalable choice.

#### Why SSE over WebSockets?
- WebSockets are bi-directional. Notifications are inherently uni-directional (pushing to clients).
- SSE runs over standard HTTP/1.1 or HTTP/2. It easily traverses corporate/campus firewalls and load balancers.
- Built-in automatic reconnection in the browser (using the `EventSource` API).

#### Architecture Flow
1. **Connection**: The client opens an HTTP connection to `/api/v1/notifications/stream?userId={userId}`. The server responds with `Content-Type: text/event-stream` and keeps the connection alive.
2. **Publishing**: When the backend processes a new notification via `POST /api/v1/notifications`, it publishes the payload to a Pub/Sub system (e.g., Redis Pub/Sub).
3. **Delivery**: The SSE handler listens to the Redis channel for the specific `userId` or subscribed `topic`. When an event arrives, it streams the JSON payload down the active HTTP connection.

#### Event Structure
```text
event: new_notification
data: {"id": "notif_123", "title": "New Event", "topic": "events"}

event: unread_count_update
data: {"unread_count": 5}
```

#### Tradeoffs
- **Pros**: Low overhead, multiplexing support natively on HTTP/2, auto-reconnect, simpler backend implementation than WebSockets.
- **Cons**: Strictly one-way communication. Maximum open connection limits in older browsers (HTTP/1.1 limits to 6 connections per domain), though HTTP/2 eliminates this bottleneck.

## 5. Engineering Depth & Scalability Considerations

- **Idempotency**: All mutating endpoints (`PATCH`, `POST`) accept an `Idempotency-Key` header. This key is cached in Redis for 24 hours to prevent network retries from duplicating notifications.
- **Rate Limiting**: API Gateway applies rate limiting based on IP and User ID (e.g., 100 req/min for fetching, 10 req/sec for publishing) to prevent DDoS.
- **Caching Strategy**: 
  - The `unread-count` endpoint is highly trafficked. It is cached in Redis (`user:{userId}:unread_count`).
  - Read operations update the Redis cache incrementally (`DECR`) while asynchronously updating the persistent DB (Write-Behind caching).
- **Database Indexing**: The database uses compound indexes on `(user_id, created_at DESC)` and `(user_id, is_read)` to ensure sub-millisecond pagination and unread filtering.
