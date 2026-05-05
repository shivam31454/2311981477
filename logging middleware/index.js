/**
 * Logging Middleware
 * 
 * Intercepts incoming HTTP requests and logs:
 * - Timestamp
 * - HTTP Method
 * - Request URL
 * - Status Code
 * - Response Time (ms)
 */
const loggerMiddleware = (req, res, next) => {
    const start = Date.now();
    const { method, url } = req;
    const timestamp = new Date().toISOString();

    // Listen to the 'finish' event to log the response details once it's sent
    res.on('finish', () => {
        const duration = Date.now() - start;
        const statusCode = res.statusCode;
        
        console.log(`[${timestamp}] ${method} ${url} ${statusCode} - ${duration}ms`);
    });

    next();
};

module.exports = loggerMiddleware;
