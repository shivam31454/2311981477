import { useState, useEffect } from 'react';
import { Container, Typography, Box, Alert, CircularProgress } from '@mui/material';
import NotificationCard from '../components/NotificationCard';
import EmptyState from '../components/EmptyState';
import { fetchNotificationsAPI } from '../services/api';

const PriorityInbox = () => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const calculateScore = (notif) => {
    let weight = 0;
    const type = (notif.type || 'Event').toLowerCase();
    if (type === 'placement') weight = 3;
    else if (type === 'result') weight = 2;
    else if (type === 'event') weight = 1;

    const timestampMs = new Date(notif.timestamp).getTime();
    return (weight * 1e13) + timestampMs;
  };

  useEffect(() => {
    const fetchPriority = async () => {
      setLoading(true);
      try {
        // Fetch a larger pool to calculate priority over
        const rawData = await fetchNotificationsAPI({ page: 1, limit: 50, type: 'All' });
        
        // Compute scores and sort
        const scoredData = rawData.map(n => ({ ...n, score: calculateScore(n) }));
        scoredData.sort((a, b) => b.score - a.score);

        // Keep Top 10
        setData(scoredData.slice(0, 10));
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchPriority();
  }, []);

  const markAsRead = (id) => {
    setData(prev => prev.map(notif => 
      notif.id === id ? { ...notif, isRead: true } : notif
    ));
  };

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Box display="flex" alignItems="center" gap={2} mb={3}>
        <Typography variant="h4" fontWeight="700">
          Priority Inbox
        </Typography>
        <Box sx={{ bgcolor: 'secondary.main', color: 'white', px: 1.5, py: 0.5, borderRadius: 2, fontSize: '0.875rem', fontWeight: 600 }}>
          Top 10
        </Box>
      </Box>

      <Typography variant="body1" color="text.secondary" mb={4}>
        Showing the most critical unread updates across campus based on category weights and recency.
      </Typography>

      {error && (
        <Alert severity="warning" sx={{ mb: 3 }}>
          {error}. Using offline mock data.
        </Alert>
      )}

      {loading ? (
        <Box display="flex" justifyContent="center" py={8}>
          <CircularProgress color="secondary" />
        </Box>
      ) : data.length === 0 ? (
        <EmptyState message="Your priority inbox is clear." />
      ) : (
        <Box>
          {data.map((notif, index) => (
            <Box key={notif.id} position="relative">
              <Box 
                position="absolute" 
                left={-40} 
                top={16} 
                sx={{ 
                  width: 24, height: 24, borderRadius: '50%', bgcolor: 'secondary.light', 
                  color: 'secondary.dark', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontWeight: 700, fontSize: '0.75rem', display: { xs: 'none', sm: 'flex' }
                }}
              >
                {index + 1}
              </Box>
              <NotificationCard notification={notif} onMarkRead={markAsRead} />
            </Box>
          ))}
        </Box>
      )}
    </Container>
  );
};

export default PriorityInbox;
