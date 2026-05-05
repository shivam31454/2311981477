import { useState } from 'react';
import { Container, Typography, Tabs, Tab, Box, Button, Alert } from '@mui/material';
import NotificationCard from '../components/NotificationCard';
import NotificationSkeleton from '../components/NotificationSkeleton';
import EmptyState from '../components/EmptyState';
import { useNotifications } from '../hooks/useNotifications';

const AllNotifications = () => {
  const [tabIndex, setTabIndex] = useState(0);
  
  const types = ['All', 'Placement', 'Result', 'Event'];
  const currentType = types[tabIndex];

  const { data, loading, loadingMore, error, hasMore, loadMore, markAsRead } = useNotifications(currentType);

  const handleTabChange = (event, newValue) => {
    setTabIndex(newValue);
  };

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Typography variant="h4" fontWeight="700" mb={3}>
        Campus Feed
      </Typography>

      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs value={tabIndex} onChange={handleTabChange} variant="scrollable" scrollButtons="auto">
          {types.map((type, idx) => (
            <Tab key={idx} label={type} sx={{ textTransform: 'none', fontWeight: 600, fontSize: '1rem' }} />
          ))}
        </Tabs>
      </Box>

      {error && (
        <Alert severity="warning" sx={{ mb: 3 }}>
          {error}. Using offline mock data.
        </Alert>
      )}

      {loading ? (
        <>
          <NotificationSkeleton />
          <NotificationSkeleton />
          <NotificationSkeleton />
        </>
      ) : data.length === 0 ? (
        <EmptyState message={`No ${currentType !== 'All' ? currentType : ''} notifications right now.`} />
      ) : (
        <>
          {data.map((notif) => (
            <NotificationCard key={notif.id} notification={notif} onMarkRead={markAsRead} />
          ))}

          {hasMore && (
            <Box display="flex" justifyContent="center" mt={4}>
              <Button 
                variant="outlined" 
                onClick={loadMore} 
                disabled={loadingMore}
                sx={{ px: 4, py: 1 }}
              >
                {loadingMore ? 'Loading...' : 'Load More'}
              </Button>
            </Box>
          )}
        </>
      )}
    </Container>
  );
};

export default AllNotifications;
