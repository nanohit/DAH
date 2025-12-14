'use client';

export const dynamic = 'force-dynamic';

import { useCallback, useEffect, useRef, useState } from 'react';
import PostList, { Post } from '@/components/PostList';
import useSocketConnection from '@/hooks/useSocketConnection';
import SocketStatus from '@/components/SocketStatus';
import { getMapSummaries, MapSummary } from '@/utils/mapUtils';
import api from '@/services/api';
import UserRecentMaps from '@/components/UserRecentMaps';
import { HeroSearch } from '@/components/HeroSearch';

const FEED_PAGE_SIZE = 10;
const FETCH_BATCH_SIZE = 10;

interface PaginationMeta {
  skip: number;
  hasMore: boolean;
  loading: boolean;
}

export default function HomePage() {
  const [feedItems, setFeedItems] = useState<Post[]>([]);
  const [hasMoreFeed, setHasMoreFeed] = useState(true);
  const [isInitialLoading, setIsInitialLoading] = useState(false);
  const [isFetchingMore, setIsFetchingMore] = useState(false);
  const [isForumActivated, setIsForumActivated] = useState(false);

  const postMetaRef = useRef<PaginationMeta>({ skip: 0, hasMore: true, loading: false });
  const mapMetaRef = useRef<PaginationMeta>({ skip: 0, hasMore: true, loading: false });
  const forumSectionRef = useRef<HTMLDivElement | null>(null);

  const [postStore, setPostStore] = useState<Post[]>([]);
  const [mapStore, setMapStore] = useState<MapSummary[]>([]);

  const postStoreRef = useRef<Post[]>([]);
  const mapStoreRef = useRef<MapSummary[]>([]);
  const feedItemsRef = useRef<Post[]>([]);
  const postCursorRef = useRef(0);
  const mapCursorRef = useRef(0);
  const awaitingPageRef = useRef(false);
  const tlFetchedRef = useRef(false);

  const activateForum = useCallback(() => {
    setIsForumActivated((prev) => {
      if (!prev) {
        setIsInitialLoading(true);
      }
      return true;
    });
  }, []);

  useSocketConnection({
    debugName: 'HomePage',
    checkInterval: 20000,
  });

  useEffect(() => {
    postStoreRef.current = postStore;
  }, [postStore]);

  useEffect(() => {
    mapStoreRef.current = mapStore;
  }, [mapStore]);

  useEffect(() => {
    feedItemsRef.current = feedItems;
  }, [feedItems]);

  const transformPost = useCallback((postData: any): Post => ({
    ...postData,
    isMap: false,
    comments: postData.comments ?? [],
    commentsCount: postData.commentsCount ?? (Array.isArray(postData.comments) ? postData.comments.length : 0),
  }), []);

  const transformMapSummary = useCallback((summary: MapSummary): Post => ({
    _id: summary._id,
    headline: summary.name,
    text: `${summary.elementCount || 0} elements, ${summary.connectionCount || 0} connections`,
    author: summary.user,
    createdAt: summary.createdAt,
    updatedAt: summary.updatedAt ?? summary.lastSaved ?? summary.createdAt,
    comments: [],
    commentsCount: summary.commentsCount ?? 0,
    likes: [],
    dislikes: [],
    bookmarks: [],
    isMap: true,
    mapData: {
      ...summary,
    },
  }), []);

  const fetchMorePosts = useCallback(async () => {
    const meta = postMetaRef.current;
    if (meta.loading || !meta.hasMore) {
      return 0;
    }

    const currentSkip = meta.skip;
    postMetaRef.current = { ...meta, loading: true };

    try {
      const response = await api.get(`/api/posts?limit=${FETCH_BATCH_SIZE}&skip=${currentSkip}`);
      const rawPosts = response.data?.posts ?? [];
      const transformed = rawPosts.map(transformPost);

      if (transformed.length > 0) {
        const updatedStore = [...postStoreRef.current, ...transformed];
        postStoreRef.current = updatedStore;
        setPostStore(updatedStore);
      }

      postMetaRef.current = {
        skip: currentSkip + rawPosts.length,
        hasMore: response.data?.hasMore ?? false,
        loading: false,
      };

      return transformed.length;
    } catch (error) {
      console.error('Error fetching posts:', error);
      postMetaRef.current = { ...meta, loading: false };
      return 0;
    }
  }, [transformPost]);

  const fetchMoreMaps = useCallback(async () => {
    const meta = mapMetaRef.current;
    if (meta.loading || !meta.hasMore) {
      return 0;
    }

    const currentSkip = meta.skip;
    mapMetaRef.current = { ...meta, loading: true };

    try {
      const response = await getMapSummaries({ limit: FETCH_BATCH_SIZE, skip: currentSkip });
      const summaries = response.maps ?? [];

      // One-time fetch TL maps and merge into store
      let tlSummaries: MapSummary[] = [];
      if (!tlFetchedRef.current) {
        tlFetchedRef.current = true;
        try {
          const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
          if (token) {
            const res = await fetch('/api/tl-maps', {
              headers: { Authorization: `Bearer ${token}` },
            });
            if (res.ok) {
              const data = await res.json();
              tlSummaries = (data || []).map((m: any) => ({
                _id: m._id,
                name: m.name || 'Untitled Map',
                user: m.user || { _id: 'unknown', username: 'Unknown' },
                createdAt: m.createdAt || '',
                updatedAt: m.updatedAt || m.createdAt || '',
                lastSaved: m.lastSaved || m.updatedAt || m.createdAt || '',
                elementCount: m.elementCount || 0,
                connectionCount: m.connectionCount || 0,
                commentsCount: m.commentsCount || 0,
                bookmarksCount: 0,
                isPrivate: m.isPrivate || false,
                isOwner: true,
                // marker for TL map
                // @ts-ignore
                isTl: true,
              }));
            }
          }
        } catch (err) {
          console.warn('Failed to fetch TL maps for feed', err);
        }
      }

      if (summaries.length > 0) {
        const updatedStore = [...mapStoreRef.current, ...summaries, ...tlSummaries];
        mapStoreRef.current = updatedStore;
        setMapStore(updatedStore);
      } else if (tlSummaries.length > 0) {
        const updatedStore = [...mapStoreRef.current, ...tlSummaries];
        mapStoreRef.current = updatedStore;
        setMapStore(updatedStore);
      }

      mapMetaRef.current = {
        skip: currentSkip + summaries.length,
        hasMore: response.hasMore,
        loading: false,
      };

      return summaries.length;
    } catch (error) {
      console.error('Error fetching map summaries:', error);
      mapMetaRef.current = { ...meta, loading: false };
      return 0;
    }
  }, []);

  const pickNextItem = useCallback(async (): Promise<Post | null> => {
    while (true) {
      const posts = postStoreRef.current;
      const maps = mapStoreRef.current;
      const postIdx = postCursorRef.current;
      const mapIdx = mapCursorRef.current;

      const nextPost = posts[postIdx];
      const nextMapSummary = maps[mapIdx];

      if (!nextPost && postMetaRef.current.hasMore) {
        const fetched = await fetchMorePosts();
        if (fetched === 0 && !postMetaRef.current.hasMore) {
          // continue to evaluate remaining data
        }
        continue;
      }

      if (!nextMapSummary && mapMetaRef.current.hasMore) {
        const fetched = await fetchMoreMaps();
        if (fetched === 0 && !mapMetaRef.current.hasMore) {
          // continue to evaluate remaining data
        }
        continue;
      }

      const currentPost = postStoreRef.current[postCursorRef.current];
      const currentMap = mapStoreRef.current[mapCursorRef.current];

      if (!currentPost && !currentMap) {
        return null;
      }

      let useMap = false;

      if (currentPost && currentMap) {
        useMap = new Date(currentMap.createdAt).getTime() >= new Date(currentPost.createdAt).getTime();
      } else if (currentMap) {
        useMap = true;
      } else {
        useMap = false;
      }

      if (useMap) {
        mapCursorRef.current += 1;
        return transformMapSummary(currentMap);
      }

      postCursorRef.current += 1;
      return currentPost;
    }
  }, [fetchMorePosts, fetchMoreMaps, transformMapSummary]);

  const loadNextPage = useCallback(async () => {
    if (awaitingPageRef.current || !hasMoreFeed) {
      return;
    }

    awaitingPageRef.current = true;
    setIsFetchingMore(feedItemsRef.current.length > 0);

    try {
      const nextItems: Post[] = [];

      while (nextItems.length < FEED_PAGE_SIZE) {
        const item = await pickNextItem();
        if (!item) {
          break;
        }
        nextItems.push(item);
      }

      if (nextItems.length > 0) {
        setFeedItems(prev => [...prev, ...nextItems]);
      }

      if (nextItems.length < FEED_PAGE_SIZE) {
        if (!postMetaRef.current.hasMore && !mapMetaRef.current.hasMore) {
          setHasMoreFeed(false);
        }
      }

      if (nextItems.length === 0) {
        setHasMoreFeed(false);
      }
    } finally {
      awaitingPageRef.current = false;
      setIsFetchingMore(false);
      setIsInitialLoading(false);
    }
  }, [hasMoreFeed, pickNextItem]);

  useEffect(() => {
    if (!isForumActivated) {
      return;
    }
    loadNextPage();
  }, [isForumActivated, loadNextPage]);

  useEffect(() => {
    if (isForumActivated) {
      return;
    }

    const target = forumSectionRef.current;
    if (!target) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry?.isIntersecting) {
          activateForum();
        }
      },
      {
        // Trigger earlier to ensure scroll activates the feed
        rootMargin: '0px 0px 400px 0px',
        threshold: 0.05,
      }
    );

    observer.observe(target);

    return () => {
      observer.disconnect();
    };
  }, [activateForum, isForumActivated]);

  useEffect(() => {
    if (isForumActivated) {
      return;
    }

    const handleScroll = () => {
      const nearBottom = window.innerHeight + window.scrollY >= document.body.offsetHeight - 400;
      if (nearBottom) {
        activateForum();
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [activateForum, isForumActivated]);

  const handleFeedRefresh = useCallback(() => {
    awaitingPageRef.current = false;
    postMetaRef.current = { skip: 0, hasMore: true, loading: false };
    mapMetaRef.current = { skip: 0, hasMore: true, loading: false };
    postCursorRef.current = 0;
    mapCursorRef.current = 0;

    postStoreRef.current = [];
    mapStoreRef.current = [];
    feedItemsRef.current = [];

    setPostStore([]);
    setMapStore([]);
    setFeedItems([]);
    setHasMoreFeed(true);
    setIsInitialLoading(true);
    setIsFetchingMore(false);

    requestAnimationFrame(() => {
      loadNextPage();
    });
  }, [loadNextPage]);

  const showInitialLoader = isForumActivated && isInitialLoading && feedItems.length === 0;

  return (
    <div className="container mx-auto px-4 py-8">
      <HeroSearch onForumRequest={activateForum} />
      <div className="max-w-4xl mx-auto mt-8 lg:mt-10">
        <div id="alphy-forum-feed" ref={forumSectionRef} className="scroll-mt-24">
          {!isForumActivated ? (
            <div className="flex flex-col items-center gap-3 py-8 text-center text-sm text-gray-500">
              <div>Прокрутите сюда или нажмите «сегодня на alphy», чтобы увидеть форум.</div>
            </div>
          ) : showInitialLoader ? (
            <div className="flex justify-center py-16">
              <div className="h-10 w-10 animate-spin rounded-full border-4 border-gray-200 border-t-gray-700" />
            </div>
          ) : (
            <>
              <UserRecentMaps maxMaps={5} />
              <div className="mt-6">
                <PostList
                  onPostUpdated={handleFeedRefresh}
                  posts={feedItems}
                  hasMorePosts={hasMoreFeed}
                  isLoading={isInitialLoading || isFetchingMore}
                  autoLoadOnScroll
                  onLoadMore={loadNextPage}
                />
              </div>

              {isFetchingMore && feedItems.length > 0 && (
                <div className="flex justify-center py-6">
                  <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-200 border-t-gray-700" />
                </div>
              )}

              {!hasMoreFeed && feedItems.length > 0 && (
                <div className="py-6 text-center text-sm text-gray-500">
                  You've ACTUALLY reached the end of the feed. Wow.
                </div>
              )}
            </>
          )}
        </div>
      </div>
      <SocketStatus />
    </div>
  );
}