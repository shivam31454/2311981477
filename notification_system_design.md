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

## Stage 2: Persistent Storage Design

### 1. Database Selection & Architecture

**Primary Database: PostgreSQL (Relational SQL)**
* **Justification**: A notification system requires strong transactional consistency (ACID) for state transitions (e.g., ensuring a notification is not marked read twice concurrently). Relational data models handle the 1-to-N relationships (1 notification template to N user recipients) extremely efficiently. PostgreSQL's robust support for JSONB allows us to maintain rigid schemas for core routing fields while retaining flexibility for arbitrary metadata.
* **Caching Layer: Redis**: Used heavily as a write-behind cache for `unread_count` increments/decrements and idempotency key storage. It prevents the database from being overwhelmed by high-frequency, low-value read/write queries.

### 2. Schema Design

We separate the notification *content* from the notification *delivery state* to avoid duplicating the payload when broadcasting to thousands of students.

#### Table: `notifications` (The Template)
Stores the actual content of the broadcast.
```sql
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    topic VARCHAR(50) NOT NULL,
    priority VARCHAR(20) DEFAULT 'normal',
    title VARCHAR(255) NOT NULL,
    body TEXT NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_notifications_created_at ON notifications(created_at DESC);
```

#### Table: `user_notifications` (The State)
Maps the notification to a specific user and tracks delivery/read state.
```sql
CREATE TABLE user_notifications (
    user_id UUID NOT NULL,
    notification_id UUID NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
    is_read BOOLEAN DEFAULT FALSE,
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (user_id, notification_id)
);
-- Optimized for: Fetching user's feed sorted by newest
CREATE INDEX idx_user_notif_user_created ON user_notifications(user_id, created_at DESC);
-- Optimized for: Unread counts and filtering
CREATE INDEX idx_user_notif_unread ON user_notifications(user_id) WHERE is_read = FALSE;
```

### 3. Query Design

#### 3.1 Fetch Notifications (Keyset / Cursor Pagination)
*Using `created_at` and `notification_id` as the cursor to avoid `OFFSET` performance degradation.*
```sql
SELECT n.id, n.topic, n.priority, n.title, n.body, n.metadata, un.is_read, un.created_at
FROM user_notifications un
JOIN notifications n ON un.notification_id = n.id
WHERE un.user_id = 'user-uuid'
  AND (un.created_at, un.notification_id) < ('cursor-timestamp', 'cursor-uuid')
ORDER BY un.created_at DESC, un.notification_id DESC
LIMIT 20;
```

#### 3.2 Mark as Read
*Idempotent query that only updates if currently unread, returning the affected row.*
```sql
UPDATE user_notifications
SET is_read = TRUE, read_at = NOW()
WHERE user_id = 'user-uuid' 
  AND notification_id = 'notif-uuid' 
  AND is_read = FALSE
RETURNING notification_id;
```

#### 3.3 Get Unread Count
*Leverages the partial index `idx_user_notif_unread`.*
```sql
SELECT COUNT(*) 
FROM user_notifications 
WHERE user_id = 'user-uuid' AND is_read = FALSE;
```

#### 3.4 Bulk Create Notification Deliveries (Fan-out)
*Optimized batch insert for broadcasting a notification to a cohort of students.*
```sql
INSERT INTO user_notifications (user_id, notification_id)
SELECT u.id, 'new-notif-uuid'
FROM users u
WHERE u.topic_subscription = 'placements'
ON CONFLICT (user_id, notification_id) DO NOTHING;
```

### 4. Performance, Reliability & Scaling Strategies

#### 4.1 Scaling Challenges & Practical Solutions
* **The Bulk Write / Fan-out Problem**: Broadcasting a placement alert to 10,000 students synchronously will lock the database and timeout the API.
  * **Solution (Async Processing)**: The `/api/v1/notifications` endpoint simply writes the `notifications` template to the DB and pushes a job to a message queue (e.g., RabbitMQ or AWS SQS). Background worker nodes consume the queue and perform batch `INSERT` operations into `user_notifications` in chunks of 500.
* **High Read Traffic (The Badge Count Issue)**: Every page load polls the unread count, hammering the database.
  * **Solution (Redis Counter)**: The `unread_count` is stored in Redis (`user:{id}:unread`). When a worker inserts a new row, it runs `INCR user:{id}:unread`. When a user marks a message as read, it runs `DECR user:{id}:unread`. The SQL query is only used as a fallback if the Redis key expires or is evicted.

#### 4.2 Pagination Strategy
We strictly utilize **Cursor-based (Keyset) Pagination** rather than `OFFSET/LIMIT`. As tables grow into millions of rows, `OFFSET 500000` requires the database to scan and discard half a million rows. Cursors utilize the B-Tree index directly for `O(log N)` lookups regardless of depth.

#### 4.3 Data Archival & Cleanup Strategy (Time-To-Live)
Notification tables grow infinitely. Retaining old data severely degrades index size and cache hit ratios.
* **Partitioning**: The `user_notifications` table is partition-bound by `RANGE (created_at)` grouped by month.
* **Cron Cleanup**: A nightly cron job drops partitions older than 90 days. For transient alerts (e.g., "Event starts in 1 hour"), a background worker hard-deletes rows where `notifications.expires_at < NOW()`.

#### 4.4 Idempotency Handling
Network retries can result in duplicate push notifications. 
* A Redis cache stores the `Idempotency-Key` provided in the request headers (`SET key "processed" EX 86400 NX`). If `NX` (Not Exists) fails, the request is rejected as a duplicate before any database transaction begins.

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

## Stage 4: Performance Optimization & Load Reduction

### 1. Problem Analysis: The "On-Load Fetch" Bottleneck

Fetching notifications synchronously from the primary database on every page load is an anti-pattern at scale. 
* **Database Overload**: If 50,000 students refresh their dashboards twice an hour, it generates 100,000 reads/hour. During an event announcement (e.g., "Placements Open"), a thundering herd of users hitting refresh can exhaust DB connection pools, locking out write operations.
* **Redundant Queries**: 95% of the time, the user's notification feed has not changed between page loads, meaning the database is executing expensive B-Tree lookups to return identical, unmodified data.
* **Increased Latency**: Sequential disk I/O over the network introduces hundreds of milliseconds of latency, blocking the initial page render and degrading user experience.

### 2. Proposed Solutions & Tradeoff Analysis

#### A) Caching Layer (Redis)
Store user notification feeds and unread counts in memory (Redis) instead of querying the DB.
* **Pros**: Sub-millisecond read latency; offloads 90%+ of read traffic from the primary database.
* **Cons**: Introduces state complexity and stale data risks if cache invalidation fails.
* **When to use**: Mandatory for the `unread_count` badge and the first 20 items of the user's feed.

#### B) Lazy Loading & Cursor Pagination
Fetch only a limited subset of notifications (e.g., top 20) and fetch older ones only when the user scrolls down.
* **Pros**: Prevents massive payload transfers; cursor pagination eliminates deep-offset scanning penalties in the DB.
* **Cons**: Requires slightly more complex frontend state management.
* **When to use**: Always. Returning a full list of thousands of notifications is never acceptable.

#### C) Push-Based Model (Server-Sent Events)
Instead of the client asking "Do I have new notifications?" on every load, the server holds an open HTTP connection and pushes the notification instantly when it occurs.
* **Pros**: Eliminates polling entirely; zero redundant queries; instantaneous delivery.
* **Cons**: Requires maintaining thousands of concurrent open TCP connections on the load balancers/servers.
* **When to use**: Ideal for real-time campus platforms to prevent the "thundering herd" refresh problem.

#### D) Polling Optimization (Throttling/Backoff)
If legacy clients cannot use SSE, introduce exponential backoff (e.g., poll every 10s, then 30s, then 1m if no interaction).
* **Pros**: Easy to implement on the frontend; reduces total request volume compared to aggressive polling.
* **Cons**: Not truly real-time; still generates empty "No new notifications" HTTP requests.
* **When to use**: Only as a fallback mechanism for clients that drop SSE/WebSocket connections.

#### E) Read Optimization (Read Replicas)
Route all `GET` requests to asynchronous database Read Replicas, keeping the Primary instance dedicated to `INSERT` and `UPDATE` traffic.
* **Pros**: Massively scales read throughput horizontally.
* **Cons**: Replication lag (e.g., 50ms-200ms). A user might mark a notification as read on the primary, refresh, and still see it unread if the replica hasn't caught up.
* **When to use**: Essential for heavy reporting or complex filtering that bypasses the cache.

#### F) Background Processing (Precomputing Feeds)
Instead of querying relationships dynamically when a user loads the page, background workers pre-build a static JSON representation of the user's inbox and store it in an object store or Redis.
* **Pros**: The fetch operation becomes a simple O(1) key-value lookup.
* **Cons**: High write-amplification. Broadcasting one message to 50,000 students requires 50,000 cache writes.
* **When to use**: Best for highly personalized, heavy-aggregation feeds (like social media timelines), less necessary for simple chronological lists.

### 3. Recommended Architecture Configuration

The optimal production approach is a **hybrid configuration** combining A, B, C, and E:

1. **Initial Load (Cache-First)**: When the application loads, it queries Redis for `user:{id}:unread_count` and `user:{id}:feed:page1` (which stores the 20 most recent notifications). The Primary DB is bypassed entirely for 99% of page loads.
2. **Real-Time Updates (SSE)**: The client establishes a Server-Sent Events (SSE) connection. New notifications bypass the database read path and are pushed directly to the UI.
3. **Cache Invalidation (Write-Through)**: When a background worker processes a new notification, it synchronously updates the Redis feed cache and increments the unread count before firing the SSE event. 
4. **Historical Scrolling (Read Replica + Cursors)**: If the user scrolls past the 20th notification, the cache is bypassed. The backend uses Cursor Pagination to query a PostgreSQL Read Replica, ensuring historical deep-scrolling never impacts active insertion throughput on the Primary DB.

### 4. Performance Impact Summary

* **Latency**: Reduced from ~150ms (SQL disk read) to **<5ms** (Redis memory lookup + SSE).
* **Database Load**: Primary DB read IOPS reduced by **>95%**. The DB is now primarily an immutable ledger for writes and a fallback for cache misses.
* **Scalability**: The system transitions from a CPU/Disk-bound architecture to a horizontally scalable Memory/Network-bound architecture. Supporting 500,000 students simply requires scaling the Redis cluster horizontally and adding more stateless SSE nodes, without touching the relational database limits.
## Stage 5: Reliable Notification Delivery Architecture

### 1. Problem Analysis: The Synchronous Loop Failure

**Current Flawed Implementation:**
```python
def notify_all(student_ids, message):
    for student_id in student_ids:
        send_email(student_id, message)     # Blocks thread, external network call
        save_to_db(student_id, message)     # Synchronous DB lock
        push_to_app(student_id, message)    # Blocks on WebSocket/SSE emit
```

**Shortcomings & System Risks:**
* **Sequential Processing Bottleneck**: If `send_email` takes 500ms, processing 50,000 students synchronously will take ~7 hours. The HTTP request will inevitably timeout.
* **Tight Coupling**: Database insertions, mobile push notifications, and email delivery are chained together. If the third-party Email API experiences an outage, database insertion and app pushes are completely halted.
* **No Retry or Fault Tolerance**: If the loop crashes at student #20,000 due to a temporary network blip, there is no state tracking. The remaining 30,000 students will never receive the notification, and there is no safe way to resume the job without risking duplicating messages for the first 20,000.
* **Should DB Writes and Emails be Coupled?** Absolutely not. Internal database writes are highly reliable and fast. External APIs (like SendGrid/AWS SES) are inherently slow and prone to rate-limiting or timeouts. They must be isolated.

### 2. Proposed Solution: Event-Driven Architecture

To achieve true scalability and fault tolerance, we must redesign the system using an **Event-Driven Architecture (EDA)** backed by a **Message Queue** (e.g., Apache Kafka, RabbitMQ, or AWS SQS).

#### Architecture Flow:
1. **Trigger**: HR clicks "Notify All".
2. **API (Producer)**: The backend API immediately writes the primary Notification Template to the database and publishes a single `notification.broadcast` event to the Message Queue. It responds with `HTTP 202 Accepted` to the HR dashboard instantly.
3. **Fan-Out Worker**: A background worker consumes the broadcast event, queries the database for the 50,000 targeted `student_ids`, and generates 50,000 individual `notification.deliver` events, pushing them into respective service queues.
4. **Dedicated Consumers (Workers)**: 
   * **Email Workers** consume from the Email Queue.
   * **Push Workers** consume from the Push/SSE Queue.
   * **DB Workers** consume from the DB Write Queue.

### 3. Reliability & Performance Enhancements

* **Retry Mechanism & DLQ**: If an email worker fails to deliver an email due to a 5XX error from the provider, the message is placed back in the queue with **Exponential Backoff** (retry in 1s, 5s, 30s, 5m). If it fails after 5 retries, the message is routed to a **Dead-Letter Queue (DLQ)** for manual inspection.
* **Idempotency**: Message queues guarantee **At-Least-Once Delivery**, meaning a worker might process the same message twice during a network partition. We implement idempotency keys (e.g., `notif_id + student_id + channel`) in Redis. The worker checks if this key was already processed before sending the email.
* **Horizontal Scaling**: We can spin up 100 Email Worker pods during placement season to process the queue in parallel, reducing the 7-hour synchronous loop down to a few seconds.

### 4. Revised Pseudocode (Event-Driven)

**1. Producer (API Endpoint)**
```python
# API Endpoint: POST /notify
def handle_notify_all_request(audience_criteria, message):
    # 1. Save core notification template
    notification_id = db.create_notification(message)
    
    # 2. Publish to Fan-Out Queue (O(1) fast response)
    message_queue.publish(
        topic="fanout.broadcast",
        payload={"notification_id": notification_id, "criteria": audience_criteria}
    )
    
    return {"status": "202 Accepted", "job_id": notification_id}
```

**2. Consumer Workers (Running independently in the background)**
```python
# Email Worker (Listens to "queue.email")
def process_email_job(job):
    idempotency_key = f"email_{job.notification_id}_{job.student_id}"
    
    if redis.exists(idempotency_key):
        return  # Already sent, skip
        
    try:
        send_email_via_provider(job.student_id, job.message)
        redis.set(idempotency_key, "done", ttl=86400)
        job.acknowledge() # Remove from queue
        
    except TemporaryNetworkError:
        job.retry_with_backoff()
        
    except PermanentHardBounceError:
        job.move_to_dlq()

# Push Worker (Listens to "queue.push")
def process_push_job(job):
    # Isolated from Email failures. Processes at its own speed.
    sse_service.emit(job.student_id, job.message)
    job.acknowledge()
```

### 5. Architectural Tradeoffs

* **Complexity vs. Reliability**: We sacrifice the simplicity of a single loop for a distributed system requiring queue monitoring, worker deployment, and DLQ management. However, this is a strict requirement for enterprise reliability.
* **Eventual Consistency**: The HR user receives a "Success" response before the students actually receive the emails. The system is eventually consistent. The UI must be designed to show a "Processing..." progress bar (reading from worker metrics) rather than immediate completion.

## Stage 6: Priority Inbox Implementation

### 1. Approach & Algorithm
The Priority Inbox guarantees that users immediately see the most critical notifications (Placements > Results > Events) while preserving chronological order within the same category. 

To process a potentially massive incoming stream of $M$ notifications and extract the top $N$ elements, we use a **Min-Heap (Priority Queue)** data structure bounded to size $N$. 

**Scoring Formula:**
```text
Score = (TypeWeight * 10,000,000,000,000) + UnixTimestampMs
```
*(Where Placement=3, Result=2, Event=1)*

By elevating the `TypeWeight` to a massive magnitude, the category strictly dominates the mathematical score. The `UnixTimestampMs` acts as the fractional tie-breaker, ensuring recent items rank higher within identical categories.

### 2. Time Complexity
* **Processing:** For every notification in the stream $M$, we attempt to insert it into a Min-Heap of fixed size $N$. Inserting/replacing an element in a Heap of size $N$ takes $O(\log N)$ time.
* **Total Time Complexity:** **$O(M \log N)$** (where $M$ is total stream size and $N$ is the inbox size limit). 
* **Space Complexity:** **$O(N)$** because we only ever store $N$ elements in memory, dropping the rest.

### 3. Scalability & Continuous Updates
This approach scales incredibly well for continuous data streams (like Server-Sent Events). Instead of re-sorting an entire array of millions of notifications ($O(M \log M)$), the backend holds the bounded Min-Heap in memory. As a new notification arrives in real-time, the system calculates its score in $O(1)$ and pushes it into the Heap in $O(\log N)$. If it doesn't beat the current minimum, it is instantly discarded. This means maintaining the Top N feed has virtually zero CPU overhead, even at hyper-scale.
