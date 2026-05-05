import { Card, CardContent, Typography, Box, Chip, IconButton, Tooltip } from '@mui/material';
import { Event, Assessment, Work, CheckCircleOutline, Circle } from '@mui/icons-material';

const NotificationCard = ({ notification, onMarkRead }) => {
  const { id, type, message, timestamp, isRead, score } = notification;

  const getTypeConfig = (t) => {
    switch(t?.toLowerCase()) {
      case 'placement': return { color: 'success', icon: <Work fontSize="small" />, label: 'Placement' };
      case 'result': return { color: 'warning', icon: <Assessment fontSize="small" />, label: 'Result' };
      default: return { color: 'primary', icon: <Event fontSize="small" />, label: 'Event' };
    }
  };

  const config = getTypeConfig(type);

  return (
    <Card 
      sx={{ 
        mb: 2, 
        position: 'relative',
        bgcolor: isRead ? 'background.paper' : '#f0fdfa',
        borderLeft: isRead ? '4px solid transparent' : '4px solid #0d9488',
        transition: 'all 0.2s ease',
        '&:hover': { transform: 'translateY(-2px)', boxShadow: 3 }
      }}
    >
      <CardContent sx={{ pb: '16px !important' }}>
        <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={1}>
          <Box display="flex" alignItems="center" gap={1}>
            {!isRead && <Circle sx={{ color: '#0d9488', fontSize: 12 }} />}
            <Chip 
              icon={config.icon} 
              label={config.label} 
              size="small" 
              color={config.color} 
              variant={isRead ? "outlined" : "filled"}
            />
            {score && (
              <Chip label={`Score: ${score}`} size="small" variant="outlined" />
            )}
          </Box>
          <Typography variant="caption" color="text.secondary">
            {new Date(timestamp).toLocaleString()}
          </Typography>
        </Box>
        
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Typography variant="body1" sx={{ color: isRead ? 'text.secondary' : 'text.primary', fontWeight: isRead ? 400 : 500 }}>
            {message}
          </Typography>
          
          {!isRead && onMarkRead && (
            <Tooltip title="Mark as read">
              <IconButton onClick={() => onMarkRead(id)} size="small" color="primary">
                <CheckCircleOutline />
              </IconButton>
            </Tooltip>
          )}
        </Box>
      </CardContent>
    </Card>
  );
};

export default NotificationCard;
