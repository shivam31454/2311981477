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

## Stage 3: Query Optimization & Performance Analysis

### 1. Query Review & Performance Analysis

**Original Query:**
```sql
SELECT * FROM notifications
WHERE studentID = 1042
AND isRead = false
ORDER BY createdAt ASC;
```

**Query Evaluation:**
While logically correct for fetching unread notifications chronologically, this query is structurally catastrophic for a table with 50,000,000 rows.

**Why it is slow at scale:**
1. **Full Table Scan ($O(N)$)**: Without a covering index, MySQL scans 50M rows sequentially to find matching `studentID` and `isRead` conditions, resulting in massive disk I/O and CPU spikes.
2. **The `SELECT *` Impact**: Pulling all columns (especially large `TEXT` bodies or JSON metadata) forces the database to read massive payloads from disk into memory, blowing out the InnoDB Buffer Pool and significantly increasing network latency.
3. **Sorting Cost (Filesort)**: Without an index supporting the `ORDER BY`, MySQL must load the unindexed filtered results into memory (or a temporary table on disk) to sort them. The computational complexity becomes $O(K \log K)$, where $K$ is the number of filtered rows.

### 2. Optimized Solution & Indexing Strategy

**Optimized Query:**
```sql
SELECT id, topic, priority, title, createdAt 
FROM notifications
WHERE studentID = 1042 
  AND isRead = false
ORDER BY createdAt ASC
LIMIT 20; -- Enforce pagination
```
*We explicitly select only the necessary lightweight fields required to render the notification list, omitting heavy payload bodies.*

**Proper Indexing Strategy:**
To execute this query optimally (achieving $O(\log N)$ complexity), we must implement a **Composite B-Tree Index**.

The column order inside the index is critical. We follow the rule of thumb for B-Tree composite indexes: **Equality first, Range/Sort second**.
1. `studentID` (Equality)
2. `isRead` (Equality)
3. `createdAt` (Sort)

This order allows MySQL to traverse the B-Tree directly to the exact subset of rows for the student and read state, and inherently retrieve them pre-sorted by `createdAt` without an expensive `filesort`.

**Index Definition:**
```sql
CREATE INDEX idx_student_read_created 
ON notifications (studentID, isRead, createdAt);
```

### 3. Critical Evaluation: "Add indexes on every column to be safe"

This is an **anti-pattern** and highly detrimental in production for the following reasons:
* **Write Performance Degradation**: Every `INSERT`, `UPDATE`, or `DELETE` requires MySQL to synchronously update every corresponding B-Tree index. In a high-throughput notification system, over-indexing will cripple bulk insertion rates.
* **Storage Overhead**: B-Tree indexes consume significant disk space and memory. Indexing every column on a 50M row table can easily double or triple the total database size, pushing valuable data out of the InnoDB Buffer Pool cache.
* **Query Optimizer Confusion**: Having too many redundant or overlapping indexes can confuse the MySQL query optimizer, causing it to pick a sub-optimal execution plan.

### 4. Additional System Optimizations

* **Cursor-Based Pagination**: Append `AND createdAt > ?` instead of `OFFSET X`. Cursor pagination utilizes the index directly, whereas `OFFSET` forces the engine to scan and discard rows, becoming exponentially slower on deep pages.
* **Query Limits**: Always append a `LIMIT`. A buggy client without a limit could attempt to fetch tens of thousands of unread notifications, crashing the backend memory.
* **Archival Strategy (Partitioning)**: Partition the `notifications` table by `RANGE (createdAt)` on a monthly basis. This allows for lightning-fast archiving (dropping an old partition takes milliseconds vs deleting millions of rows) and keeps the active index sizes small.

### 5. New Query Requirement: Placement Notifications (Last 7 Days)

To find all students who received a "placement" notification in the last 7 days optimally:

**Optimized Query:**
```sql
SELECT DISTINCT studentID 
FROM notifications
WHERE notificationType = 'placement' 
  AND createdAt >= NOW() - INTERVAL 7 DAY;
```

**Required Index:**
```sql
CREATE INDEX idx_type_created_student 
ON notifications (notificationType, createdAt, studentID);
```
