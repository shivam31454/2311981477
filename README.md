# 2311981477 - Campus Notification Platform

This repository contains the full-stack architecture, documentation, and implementation for a highly scalable Campus Notification Platform.

## 📂 Project Structure & File Contents

The project is divided into several directories representing the different components and stages of the system design and implementation:

### 1. System Architecture & Design
* **`notification_system_design.md`**: The master design document. Contains:
  * **Stage 1**: REST API Design & JSON Schemas.
  * **Stage 2**: Persistent Storage Design (PostgreSQL schema & Redis caching).
  * **Stage 3**: Query Optimization (MySQL composite indexing strategies).
  * **Stage 4**: Performance Optimization (Caching, SSE, Read Replicas).
  * **Stage 6**: Priority Inbox Algorithm design and mathematical scoring formula.

### 2. Frontend Application (`notification-mui-fe/`)
A responsive React dashboard built with Vite and Material UI.
* **`src/pages/AllNotifications.jsx`**: The main Campus Feed. Implements infinite-scroll pagination and category filtering (Placement, Result, Event).
* **`src/pages/PriorityInbox.jsx`**: Implements the Top N Priority Inbox logic. Uses the scoring algorithm `(TypeWeight * 1e13) + Timestamp` to sort streams of notifications.
* **`src/hooks/useNotifications.js`**: Custom React hook managing the API state, pagination, and read/unread status.
* **`src/services/api.js`**: API integration layer. Fetches data from the remote evaluation service and includes a robust offline fallback to generate mock data if the API is blocked.
* **`src/components/`**: Reusable UI components including `Navbar.jsx`, `NotificationCard.jsx` (with dynamic styling based on category), `EmptyState.jsx`, and `NotificationSkeleton.jsx`.

### 3. Backend Services & Algorithms (`notification_app_be/`)
Express.js backend services and standalone algorithmic scripts.
* **`priority_inbox.js`**: A pure JavaScript implementation of the Priority Inbox algorithm using a **Min-Heap (Priority Queue)** data structure to efficiently maintain the Top N notifications in $O(N \log K)$ time complexity.
* **`index.js`**: The main Express.js backend server handling API routes and mock database integration.

### 4. Middleware (`logging middleware/`)
* **`index.js`**: A reusable logging utility (`Log(stack, level, package, message)`) that tracks the entire application lifecycle and transmits logs securely to a remote evaluation server.

---

## 🚀 How to Run the Project

### Running the Frontend (React + MUI)
The frontend requires Node.js to be installed on your machine.

1. Open your terminal and navigate to the frontend directory:
   ```bash
   cd notification-mui-fe
   ```
2. Install the required dependencies:
   ```bash
   npm install
   ```
3. Start the Vite development server:
   ```bash
   npm run dev
   ```
4. Open your browser and navigate to **[http://localhost:3000](http://localhost:3000)**.

### Running the Priority Inbox Algorithm (Backend Script)
To test the standalone Min-Heap algorithm script:

1. Navigate to the backend directory:
   ```bash
   cd notification_app_be
   ```
2. Execute the script via Node.js:
   ```bash
   node priority_inbox.js
   ```
   *(This will fetch the stream, process the priority queue, and output the Top 10 notifications to your terminal).*
