/**
 * Advanced Logging Middleware & Logger Utility
 */
const https = require('https');

// Define constraints for validation
const VALID_LEVELS = ["debug", "info", "warn", "error", "fatal"];
const VALID_PACKAGES = ["cache", "controller", "cron_job", "db", "domain", "handler", "repository", "route", "service"];

/**
 * Reusable Log function that sends logs to the evaluation server.
 * 
 * @param {string} stack - The stack name (e.g., "backend", "frontend")
 * @param {string} level - Log level (debug, info, warn, error, fatal)
 * @param {string} pkg - Package name (e.g., handler, route, db, service)
 * @param {string} message - Descriptive context message
 */
const Log = (stack, level, pkg, message) => {
    // Validate inputs
    const log_level = VALID_LEVELS.includes(level) ? level : "info";
    const log_package = VALID_PACKAGES.includes(pkg) ? pkg : "domain";
    
    const payload = JSON.stringify({
        stack,
        level: log_level,
        package: log_package,
        message,
        timestamp: new Date().toISOString()
    });

    // Make API call to the test server
    // Note: The API requires a token for the protected route.
    // It reads from process.env.LOG_API_TOKEN
    const options = {
        hostname: '20.207.122.201',
        port: 443,
        path: '/eveluation-service/logs',
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(payload),
            'Authorization': `Bearer ${process.env.LOG_API_TOKEN || 'YOUR_TOKEN_HERE'}`
        },
        // In a real environment, you might want to verify the certificate
        // For testing against an IP address, we rejectUnauthorized: false
        rejectUnauthorized: false
    };

    const req = https.request(options, (res) => {
        // We do not need to wait for the response, just fire and forget
        res.on('data', () => {});
    });

    req.on('error', (e) => {
        // Fallback to console logging if the API call fails
        console.error(`[Local Log Fallback] Failed to send log to server: ${e.message}`);
        console.log(`[${log_level.toUpperCase()}] [${stack}] [${log_package}] ${message}`);
    });

    req.write(payload);
    req.end();

    // Also log locally for debugging purposes
    console.log(`[${log_level.toUpperCase()}] [${stack}] [${log_package}] ${message}`);
};

/**
 * Express Middleware to log incoming requests
 */
const loggerMiddleware = (req, res, next) => {
    const start = Date.now();
    
    // Log the incoming request
    Log("backend", "info", "route", `Received ${req.method} request for ${req.url}`);

    res.on('finish', () => {
        const duration = Date.now() - start;
        const statusCode = res.statusCode;
        
        if (statusCode >= 500) {
            Log("backend", "error", "route", `Request ${req.method} ${req.url} failed with status ${statusCode} in ${duration}ms`);
        } else if (statusCode >= 400) {
            Log("backend", "warn", "route", `Request ${req.method} ${req.url} resulted in client error ${statusCode} in ${duration}ms`);
        } else {
            Log("backend", "info", "route", `Request ${req.method} ${req.url} completed with status ${statusCode} in ${duration}ms`);
        }
    });

    next();
};

module.exports = {
    Log,
    loggerMiddleware
};
