import { useState, useEffect } from 'react'

function App() {
  const [notifications, setNotifications] = useState([]);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  // Fetch initial notifications
  useEffect(() => {
    fetchNotifications();
  }, []);

  const fetchNotifications = async () => {
    try {
      // Assuming backend is running on 5000
      const res = await fetch('http://localhost:5000/api/notifications');
      if(res.ok) {
        const data = await res.json();
        setNotifications(data.reverse()); // latest first
      }
    } catch (err) {
      console.error("Failed to fetch notifications. Make sure backend is running.", err);
    }
  }

  const handleSend = async (e) => {
    e.preventDefault();
    if (!message.trim()) return;

    setLoading(true);
    try {
      const res = await fetch('http://localhost:5000/api/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message })
      });
      if(res.ok) {
        setMessage('');
        fetchNotifications();
      }
    } catch (err) {
      console.error("Failed to send notification.", err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="app-container">
      <div className="glass-panel">
        <header className="header">
          <div className="logo">
            <span className="pulse-dot"></span>
            <h1>Notification Central</h1>
          </div>
          <p className="subtitle">Enterprise-grade notification dispatcher</p>
        </header>

        <main className="main-content">
          <section className="composer">
            <h2>Send New Broadcast</h2>
            <form onSubmit={handleSend}>
              <div className="input-group">
                <textarea 
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Type your notification message here..."
                  rows="3"
                />
              </div>
              <button type="submit" disabled={loading || !message.trim()} className="btn-primary">
                {loading ? 'Sending...' : 'Dispatch Notification'}
                {!loading && <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/></svg>}
              </button>
            </form>
          </section>

          <section className="history">
            <h2>Recent Broadcasts <span className="badge">{notifications.length}</span></h2>
            <div className="notification-list">
              {notifications.length === 0 ? (
                <div className="empty-state">No notifications found. Start by sending one.</div>
              ) : (
                notifications.map((notif) => (
                  <div key={notif.id} className="notification-card">
                    <div className="notif-header">
                      <span className={`status ${notif.status.toLowerCase()}`}>{notif.status}</span>
                      <span className="time">{new Date(notif.date).toLocaleString()}</span>
                    </div>
                    <p className="notif-message">{notif.message}</p>
                    <div className="notif-id">ID: #{notif.id}</div>
                  </div>
                ))
              )}
            </div>
          </section>
        </main>
      </div>
    </div>
  )
}

export default App
