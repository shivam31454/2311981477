/**
 * API Service for Notifications
 */

const API_BASE_URL = 'http://20.207.122.201/evaluation-service';

// Mock data fallback in case the external API is unreachable during local dev
const MOCK_NOTIFICATIONS = Array.from({ length: 50 }).map((_, i) => {
  const types = ['Event', 'Result', 'Placement'];
  const type = types[Math.floor(Math.random() * types.length)];
  return {
    id: `notif_${i}`,
    type,
    message: `This is a sample ${type} notification message #${i + 1}.`,
    timestamp: new Date(Date.now() - Math.random() * 10000000000).toISOString(),
    isRead: Math.random() > 0.5,
  };
}).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

export const fetchNotificationsAPI = async ({ page = 1, limit = 10, type = 'All' }) => {
  try {
    // Build Query Params
    const params = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
    });
    if (type !== 'All') {
      params.append('notification_type', type);
    }

    const response = await fetch(`${API_BASE_URL}/notifications?${params.toString()}`);
    
    if (!response.ok) {
      throw new Error(`API Error: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.warn("External API failed or CORS blocked. Falling back to Mock Data.", error);
    
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 800));

    let filtered = MOCK_NOTIFICATIONS;
    if (type !== 'All') {
      filtered = filtered.filter(n => n.type.toLowerCase() === type.toLowerCase());
    }

    const start = (page - 1) * limit;
    const end = start + limit;
    const paginatedData = filtered.slice(start, end);

    return paginatedData;
  }
};
