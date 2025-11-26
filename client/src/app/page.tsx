'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import PostList, { Post } from '@/components/PostList';
import useSocketConnection from '@/hooks/useSocketConnection';
import SocketStatus from '@/components/SocketStatus';
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
  const [feedItems, setFeedItems] = useState<Post[]>([]);
  const [hasMoreFeed, setHasMoreFeed] = useState(true);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
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
  const awaitingPageRef = useRef(false);

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

      if (summaries.length > 0) {
        const updatedStore = [...mapStoreRef.current, ...summaries];
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
    loadNextPage();
  }, [loadNextPage]);

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

  const showInitialLoader = isInitialLoading && feedItems.length === 0;

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto">
        <UserRecentMaps maxMaps={5} />

        {showInitialLoader ? (
          <div className="flex justify-center py-16">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-gray-200 border-t-gray-700" />
          </div>
        ) : (
          <>
            <PostList
              onPostUpdated={handleFeedRefresh}
              posts={feedItems}
              hasMorePosts={hasMoreFeed}
              isLoading={isInitialLoading || isFetchingMore}
              autoLoadOnScroll
              onLoadMore={loadNextPage}
            />

            {isFetchingMore && feedItems.length > 0 && (
              <div className="flex justify-center py-6">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-200 border-t-gray-700" />
              </div>
            )}

            {!hasMoreFeed && feedItems.length > 0 && (
              <div className="py-6 text-center text-sm text-gray-500">
                You\'ve reached the end of the feed.
              </div>
            )}
          </>
        )}
      </div>
      <SocketStatus />
    </div>
  );
}