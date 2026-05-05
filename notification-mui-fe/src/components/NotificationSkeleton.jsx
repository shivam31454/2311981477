import { Card, CardContent, Skeleton, Box } from '@mui/material';

const NotificationSkeleton = () => {
  return (
    <Card sx={{ mb: 2, borderRadius: 3 }}>
      <CardContent>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
          <Skeleton variant="rounded" width={80} height={24} />
          <Skeleton variant="text" width={120} />
        </Box>
        <Skeleton variant="text" width="90%" height={24} />
        <Skeleton variant="text" width="60%" height={24} />
      </CardContent>
    </Card>
  );
};

export default NotificationSkeleton;
