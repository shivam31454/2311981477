const express = require('express');
const cors = require('cors');
const loggerMiddleware = require('logging-middleware');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Apply our custom logging middleware
app.use(loggerMiddleware);

// In-memory array to store notifications (Mock DB)
const notifications = [
    { id: 1, message: "Welcome to the Notification System!", status: "SENT", date: new Date().toISOString() }
];

// Routes

// 1. Health check
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'OK', message: 'Notification Service is running' });
});

// 2. Get all notifications
app.get('/api/notifications', (req, res) => {
    res.status(200).json(notifications);
});

// 3. Send a new notification
app.post('/api/notifications', (req, res) => {
    const { message } = req.body;
    
    if (!message) {
        return res.status(400).json({ error: 'Message is required' });
    }

    const newNotification = {
        id: notifications.length + 1,
        message,
        status: "PENDING",
        date: new Date().toISOString()
    };

    notifications.push(newNotification);

    // Simulate asynchronous sending process
    setTimeout(() => {
        newNotification.status = "SENT";
        console.log(`[Worker Mock] Notification ID ${newNotification.id} sent successfully.`);
    }, 2000);

    res.status(202).json({ 
        message: 'Notification accepted for delivery', 
        notification: newNotification 
    });
});

app.listen(PORT, () => {
    console.log(`Notification Backend is running on http://localhost:${PORT}`);
});
