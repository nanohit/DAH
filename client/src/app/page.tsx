'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState, useCallback, useRef } from 'react';
import { HeroSearch } from '@/components/HeroSearch';
import { useAuth } from '@/context/AuthContext';
import AnimatedBackground from '@/components/AnimatedBackground';

// Forum-related imports
import PostList, { Post } from '@/components/PostList';
import useSocketConnection from '@/hooks/useSocketConnection';
import { getMapSummaries, MapSummary } from '@/utils/mapUtils';
import api from '@/services/api';
import UserRecentMaps from '@/components/UserRecentMaps';

const FEED_PAGE_SIZE = 10;
const FETCH_BATCH_SIZE = 10;

interface PaginationMeta {
  skip: number;
  hasMore: boolean;
  loading: boolean;
}

export default function HomePage() {
  const { isAuthenticated } = useAuth();
  const [isForumVisible, setIsForumVisible] = useState(false);
  const [isForumLoading, setIsForumLoading] = useState(false);
  const forumRef = useRef<HTMLDivElement>(null);

  // Forum state
  const [feedItems, setFeedItems] = useState<Post[]>([]);
  const [hasMoreFeed, setHasMoreFeed] = useState(true);
  const [isInitialLoading, setIsInitialLoading] = useState(false);
  const [isFetchingMore, setIsFetchingMore] = useState(false);

  const postMetaRef = useRef<PaginationMeta>({ skip: 0, hasMore: true, loading: false });
  const mapMetaRef = useRef<PaginationMeta>({ skip: 0, hasMore: true, loading: false });

  const [postStore, setPostStore] = useState<Post[]>([]);
  const [mapStore, setMapStore] = useState<MapSummary[]>([]);

  const postStoreRef = useRef<Post[]>([]);
  const mapStoreRef = useRef<MapSummary[]>([]);
  const feedItemsRef = useRef<Post[]>([]);
  const postCursorRef = useRef(0);
  const mapCursorRef = useRef(0);

  useSocketConnection({
    debugName: 'HomePage',
    checkInterval: 20000,
  });

  // Lock scroll on mount - prevents any scrolling on the main page until forum is activated
  useEffect(() => {
    if (isForumVisible) {
      // Unlock scrolling when forum is visible
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
      document.body.style.position = '';
      document.body.style.width = '';
      document.body.style.height = '';
    } else {
      // Lock scrolling completely
      document.body.style.overflow = 'hidden';
      document.documentElement.style.overflow = 'hidden';
      document.body.style.position = 'fixed';
      document.body.style.width = '100%';
      document.body.style.height = '100%';
    }
    
    return () => {
      // Restore on unmount
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
      document.body.style.position = '';
      document.body.style.height = '';
      document.body.style.width = '';
    };
  }, [isForumVisible]);

  // Fetch posts and maps when forum becomes visible
  const fetchInitialFeed = useCallback(async () => {
    if (!isForumVisible) return;
    setIsInitialLoading(true);

    try {
      // Fetch posts
      const postsResponse = await api.get('/api/posts', {
        params: { limit: FETCH_BATCH_SIZE, skip: 0 }
      });
      const posts: Post[] = postsResponse.data?.posts || [];
      postStoreRef.current = posts;
      setPostStore(posts);
      postMetaRef.current = {
        skip: posts.length,
        hasMore: postsResponse.data?.hasMore ?? posts.length === FETCH_BATCH_SIZE,
        loading: false,
      };

      // Fetch maps
      const mapsResult = await getMapSummaries({ limit: FETCH_BATCH_SIZE, skip: 0 });
      const maps: MapSummary[] = mapsResult.maps || [];
      mapStoreRef.current = maps;
      setMapStore(maps);
      mapMetaRef.current = {
        skip: maps.length,
        hasMore: mapsResult.hasMore ?? maps.length === FETCH_BATCH_SIZE,
        loading: false,
      };

      // Interleave posts and maps
      const interleaved = interleaveFeed(posts, maps, FEED_PAGE_SIZE);
      feedItemsRef.current = interleaved;
      setFeedItems(interleaved);
      setHasMoreFeed(postMetaRef.current.hasMore || mapMetaRef.current.hasMore || posts.length + maps.length > interleaved.length);
    } catch (error) {
      console.error('Error fetching initial feed:', error);
    } finally {
      setIsInitialLoading(false);
    }
  }, [isForumVisible]);

  useEffect(() => {
    if (isForumVisible) {
      fetchInitialFeed();
    }
  }, [isForumVisible, fetchInitialFeed]);

  const interleaveFeed = (posts: Post[], maps: MapSummary[], count: number): Post[] => {
    const result: Post[] = [];
    let pIdx = postCursorRef.current;
    let mIdx = mapCursorRef.current;
    
    while (result.length < count && (pIdx < posts.length || mIdx < maps.length)) {
      if (pIdx < posts.length && (mIdx >= maps.length || Math.random() > 0.4)) {
        result.push(posts[pIdx]);
        pIdx++;
      } else if (mIdx < maps.length) {
        const map = maps[mIdx];
        result.push({
          _id: map._id,
          headline: map.name || 'Untitled Map',
          text: '',
          author: map.user,
          createdAt: map.createdAt,
          updatedAt: map.updatedAt,
          comments: [],
          commentsCount: map.commentsCount || 0,
          bookmarksCount: map.bookmarksCount || 0,
          isMap: true,
          mapData: map,
        } as Post);
        mIdx++;
      }
    }
    
    postCursorRef.current = pIdx;
    mapCursorRef.current = mIdx;
    return result;
  };

  const handleLoadMore = useCallback(async () => {
    if (isFetchingMore) return;
    setIsFetchingMore(true);

    try {
      // Check if we need to fetch more posts from the server
      const postsRemaining = postStoreRef.current.length - postCursorRef.current;
      const mapsRemaining = mapStoreRef.current.length - mapCursorRef.current;
      
      // Fetch more from server if running low
      if (postsRemaining < FEED_PAGE_SIZE && postMetaRef.current.hasMore) {
        const postsResponse = await api.get('/api/posts', {
          params: { limit: FETCH_BATCH_SIZE, skip: postMetaRef.current.skip }
        });
        const newPosts: Post[] = postsResponse.data?.posts || [];
        if (newPosts.length > 0) {
          postStoreRef.current = [...postStoreRef.current, ...newPosts];
          setPostStore([...postStoreRef.current]);
          postMetaRef.current = {
            skip: postMetaRef.current.skip + newPosts.length,
            hasMore: postsResponse.data?.hasMore ?? newPosts.length === FETCH_BATCH_SIZE,
            loading: false,
          };
        } else {
          postMetaRef.current.hasMore = false;
        }
      }

      if (mapsRemaining < FEED_PAGE_SIZE && mapMetaRef.current.hasMore) {
        const mapsResult = await getMapSummaries({ limit: FETCH_BATCH_SIZE, skip: mapMetaRef.current.skip });
        const newMaps: MapSummary[] = mapsResult.maps || [];
        if (newMaps.length > 0) {
          mapStoreRef.current = [...mapStoreRef.current, ...newMaps];
          setMapStore([...mapStoreRef.current]);
          mapMetaRef.current = {
            skip: mapMetaRef.current.skip + newMaps.length,
            hasMore: mapsResult.hasMore ?? newMaps.length === FETCH_BATCH_SIZE,
            loading: false,
          };
        } else {
          mapMetaRef.current.hasMore = false;
        }
      }

      // Now interleave from the updated stores
      const newItems = interleaveFeed(postStoreRef.current, mapStoreRef.current, FEED_PAGE_SIZE);
      if (newItems.length > 0) {
        feedItemsRef.current = [...feedItemsRef.current, ...newItems];
        setFeedItems([...feedItemsRef.current]);
      }
      
      const stillHasMore = 
        postCursorRef.current < postStoreRef.current.length || 
        mapCursorRef.current < mapStoreRef.current.length ||
        postMetaRef.current.hasMore ||
        mapMetaRef.current.hasMore;
      setHasMoreFeed(stillHasMore);
    } catch (error) {
      console.error('Error loading more feed:', error);
    } finally {
      setIsFetchingMore(false);
    }
  }, [isFetchingMore]);

  const handleShowForum = useCallback(() => {
    setIsForumVisible(true);
    setIsForumLoading(true);
    // Scroll to forum after a short delay
    setTimeout(() => {
      forumRef.current?.scrollIntoView({ behavior: 'smooth' });
      setIsForumLoading(false);
    }, 100);
  }, []);

  return (
    <div className={`home-page-container ${isForumVisible ? 'forum-visible' : ''}`}>
      {/* Interactive network background */}
      <div className="home-background">
        <AnimatedBackground />
      </div>
      
      {/* Main content */}
      <div className="home-content">
        <HeroSearch onShowForum={handleShowForum} />
      </div>

      {/* Forum Section - only rendered when visible */}
      {isForumVisible && (
        <div ref={forumRef} className="forum-section">
          <div className="forum-content">
            {isAuthenticated && <UserRecentMaps maxMaps={5} />}
            {isInitialLoading ? (
              <div className="loading-placeholder">
                <div className="spinner" />
                <p>Загрузка...</p>
              </div>
            ) : (
              <PostList
                posts={feedItems}
                onPostUpdated={fetchInitialFeed}
                showPostCreation={isAuthenticated}
                hasMorePosts={hasMoreFeed}
                onLoadMore={handleLoadMore}
                isLoading={isFetchingMore}
                autoLoadOnScroll={true}
              />
            )}
          </div>
        </div>
      )}

      <style jsx>{`
        .home-page-container {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          width: 100vw;
          height: 100vh;
          overflow: hidden;
          background: #000;
        }

        .home-page-container.forum-visible {
          position: relative;
          height: auto;
          min-height: 100vh;
          overflow: auto;
        }

        .home-background {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          z-index: 0;
        }

        .home-content {
          position: relative;
          z-index: 1;
          min-height: 100vh;
          width: 100%;
          padding-top: 60px;
          display: flex;
          flex-direction: column;
        }

        .forum-section {
          position: relative;
          z-index: 1;
          min-height: 100vh;
          background: linear-gradient(to bottom, rgba(0,0,0,0) 0%, rgba(0,0,0,0.98) 10%, #0a0a0a 20%);
          padding: 60px 20px 40px;
        }

        .forum-content {
          max-width: 900px;
          margin: 0 auto;
        }

        .loading-placeholder {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 60px;
          color: rgba(255, 255, 255, 0.6);
          font-family: 'Geometria', 'Manrope', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }

        .spinner {
          width: 32px;
          height: 32px;
          border: 2px solid rgba(255, 255, 255, 0.2);
          border-top-color: white;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
          margin-bottom: 16px;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
