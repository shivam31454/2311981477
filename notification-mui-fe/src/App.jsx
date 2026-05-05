import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Navbar from './components/Navbar';
import AllNotifications from './pages/AllNotifications';
import PriorityInbox from './pages/PriorityInbox';

function App() {
  return (
    <Router>
      <Navbar />
      <Routes>
        <Route path="/notifications" element={<AllNotifications />} />
        <Route path="/priority" element={<PriorityInbox />} />
        <Route path="*" element={<Navigate to="/notifications" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
