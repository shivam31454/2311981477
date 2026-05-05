const express = require('express');
const cors = require('cors');
const { Log, loggerMiddleware } = require('logging-middleware');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Apply our custom logging middleware to intercept all requests
app.use(loggerMiddleware);

// In-memory array to store notifications (Mock DB)
const notifications = [
    { id: 1, message: "Welcome to the Notification System!", status: "SENT", date: new Date().toISOString() }
];

// Routes

// 1. Health check
app.get('/health', (req, res) => {
    Log("backend", "debug", "handler", "Health check endpoint called");
    res.status(200).json({ status: 'OK', message: 'Notification Service is running' });
});

// 2. Get all notifications
app.get('/api/notifications', (req, res) => {
    Log("backend", "info", "handler", "Retrieving all notifications from the database");
    try {
        // Simulating DB fetch
        res.status(200).json(notifications);
        Log("backend", "debug", "db", `Successfully retrieved ${notifications.length} notifications`);
    } catch (error) {
        Log("backend", "fatal", "db", "Critical database connection failure while fetching notifications");
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// 3. Send a new notification
app.post('/api/notifications', (req, res) => {
    Log("backend", "info", "handler", "Received request to dispatch a new notification");
    const { message } = req.body;
    
    if (!message) {
        Log("backend", "error", "handler", "Received empty payload, expected string message");
        return res.status(400).json({ error: 'Message is required' });
    }

    if (typeof message !== 'string') {
        Log("backend", "error", "handler", `Received ${typeof message}, expected string`);
        return res.status(400).json({ error: 'Message must be a string' });
    }

    const newNotification = {
        id: notifications.length + 1,
        message,
        status: "PENDING",
        date: new Date().toISOString()
    };

    notifications.push(newNotification);
    Log("backend", "info", "service", `Notification ID ${newNotification.id} accepted and queued with PENDING status`);

    // Simulate asynchronous sending process via a worker/queue
    setTimeout(() => {
        try {
            // Simulating a random failure to demonstrate warning/error logs
            if (Math.random() < 0.1) {
                throw new Error("Provider rate limit exceeded");
            }
            newNotification.status = "SENT";
            Log("backend", "info", "service", `Worker successfully delivered Notification ID ${newNotification.id}`);
        } catch (error) {
            newNotification.status = "FAILED";
            Log("backend", "warn", "service", `Worker failed to deliver Notification ID ${newNotification.id}: ${error.message}`);
        }
    }, 2000);

    res.status(202).json({ 
        message: 'Notification accepted for delivery', 
        notification: newNotification 
    });
});

app.listen(PORT, () => {
    Log("backend", "info", "domain", `Notification Backend service initialized and listening on port ${PORT}`);
});
