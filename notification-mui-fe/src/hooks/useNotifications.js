import { useState, useEffect, useCallback } from 'react';
import { fetchNotificationsAPI } from '../services/api';

export const useNotifications = (type = 'All') => {
  const [data, setData] = useState([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);
  const [hasMore, setHasMore] = useState(true);

  const limit = 10;

  // Initial fetch or filter change
  useEffect(() => {
    let isMounted = true;
    
    const loadInitial = async () => {
      setLoading(true);
      setError(null);
      try {
        const result = await fetchNotificationsAPI({ page: 1, limit, type });
        if (isMounted) {
          setData(result);
          setPage(1);
          setHasMore(result.length === limit);
        }
      } catch (err) {
        if (isMounted) setError(err.message);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadInitial();

    return () => { isMounted = false; };
  }, [type]);

  // Load more (pagination)
  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return;

    setLoadingMore(true);
    try {
      const nextPage = page + 1;
      const result = await fetchNotificationsAPI({ page: nextPage, limit, type });
      setData(prev => [...prev, ...result]);
      setPage(nextPage);
      setHasMore(result.length === limit);
    } catch (err) {
      console.error("Failed to load more:", err);
    } finally {
      setLoadingMore(false);
    }
  }, [page, type, loadingMore, hasMore]);

  // Mark as read locally for UI feedback
  const markAsRead = (id) => {
    setData(prev => prev.map(notif => 
      notif.id === id ? { ...notif, isRead: true } : notif
    ));
  };

  return { data, loading, loadingMore, error, hasMore, loadMore, markAsRead };
};
