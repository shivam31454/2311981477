import { AppBar, Toolbar, Typography, Button, Box, Container } from '@mui/material';
import { NotificationsActive, Star } from '@mui/icons-material';
import { useLocation, useNavigate } from 'react-router-dom';

const Navbar = () => {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <AppBar position="sticky" elevation={0} sx={{ borderBottom: '1px solid #e2e8f0', bgcolor: 'background.paper' }}>
      <Container maxWidth="md">
        <Toolbar disableGutters>
          <NotificationsActive sx={{ color: 'primary.main', mr: 2 }} />
          <Typography variant="h6" component="div" sx={{ flexGrow: 1, color: 'text.primary', fontWeight: 700 }}>
            Campus<span style={{ color: '#4f46e5' }}>Notify</span>
          </Typography>

          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button 
              color={location.pathname === '/notifications' ? 'primary' : 'inherit'}
              variant={location.pathname === '/notifications' ? 'contained' : 'text'}
              onClick={() => navigate('/notifications')}
              disableElevation
            >
              All Notifications
            </Button>
            <Button 
              color={location.pathname === '/priority' ? 'secondary' : 'inherit'}
              variant={location.pathname === '/priority' ? 'contained' : 'text'}
              startIcon={<Star />}
              onClick={() => navigate('/priority')}
              disableElevation
              sx={{
                ...(location.pathname !== '/priority' && { color: 'text.secondary' })
              }}
            >
              Priority Inbox
            </Button>
          </Box>
        </Toolbar>
      </Container>
    </AppBar>
  );
};

export default Navbar;
