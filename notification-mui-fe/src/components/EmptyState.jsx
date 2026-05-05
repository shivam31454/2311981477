import { Box, Typography } from '@mui/material';
import { NotificationsOff } from '@mui/icons-material';

const EmptyState = ({ message = "No notifications found." }) => {
  return (
    <Box 
      display="flex" 
      flexDirection="column" 
      alignItems="center" 
      justifyContent="center" 
      py={8}
      textAlign="center"
    >
      <NotificationsOff sx={{ fontSize: 60, color: 'text.disabled', mb: 2 }} />
      <Typography variant="h6" color="text.secondary">
        {message}
      </Typography>
      <Typography variant="body2" color="text.disabled" mt={1}>
        Check back later for new updates.
      </Typography>
    </Box>
  );
};

export default EmptyState;
