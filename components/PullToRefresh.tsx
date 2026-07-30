'use client';

import { useState, useRef, useEffect } from 'react';

interface PullToRefreshProps {
  onRefresh: () => Promise<void>;
  children: React.ReactNode;
  pullThreshold?: number;
}

export default function PullToRefresh({ onRefresh, children, pullThreshold = 80 }: PullToRefreshProps) {
  const [pulling, setPulling] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [needsPull, setNeedsPull] = useState(false);
  const startYRef = useRef<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    function handleTouchStart(e: TouchEvent) {
      // Only activate if scrolled to top
      if (!container || container.scrollTop === 0) {
        setNeedsPull(true);
        startYRef.current = e.touches[0].clientY;
      } else {
        setNeedsPull(false);
      }
    }

    function handleTouchMove(e: TouchEvent) {
      if (!needsPull || startYRef.current === null || !container) return;
      
      const currentY = e.touches[0].clientY;
      const diff = currentY - startYRef.current;
      
      // Only allow pulling down, not up
      if (diff > 0) {
        // Don't prevent default if we're just scrolling
        if (container.scrollTop === 0 && diff > 10) {
          e.preventDefault();
        }
        setPullDistance(Math.min(diff, pullThreshold * 1.5));
        setPulling(diff > 20);
      }
    }

    function handleTouchEnd() {
      if (!needsPull) return;
      
      if (pullDistance >= pullThreshold && !isRefreshing) {
        // Trigger refresh
        setIsRefreshing(true);
        setPulling(false);
        onRefresh().finally(() => {
          setIsRefreshing(false);
          setPullDistance(0);
          setNeedsPull(false);
        });
      } else {
        setPulling(false);
        setPullDistance(0);
      }
      startYRef.current = null;
    }

    container.addEventListener('touchstart', handleTouchStart, { passive: true });
    container.addEventListener('touchmove', handleTouchMove, { passive: false });
    container.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchmove', handleTouchMove);
      container.removeEventListener('touchend', handleTouchEnd);
    };
  }, [needsPull, pullDistance, pullThreshold, isRefreshing, onRefresh]);

  return (
    <div ref={containerRef} className="h-screen overflow-y-auto">
      {/* Refresh indicator */}
      <div 
        className="flex justify-center items-center h-0 overflow-hidden transition-all duration-200"
        style={{ 
          height: isRefreshing ? 60 : `${pullDistance}px`,
          opacity: pullDistance > 20 || isRefreshing ? 1 : 0 
        }}
      >
        {isRefreshing ? (
          <div className="flex flex-col items-center">
            <div className="w-6 h-6 border-2 border-brand-orange border-t-transparent rounded-full animate-spin" />
            <span className="text-xs text-brand-cream/60 mt-2">Refreshing...</span>
          </div>
        ) : (
          <div className="flex flex-col items-center">
            <svg 
              className={`w-6 h-6 text-brand-orange transition-transform duration-200 ${pulling ? 'rotate-180' : ''}`}
              fill="none" 
              viewBox="0 0 24 24" 
              stroke="currentColor"
              style={{ transform: `rotate(${Math.min(pullDistance / pullThreshold * 180, 180)}deg)` }}
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
            </svg>
            {pullDistance > 40 && (
              <span className="text-xs text-brand-cream/60 mt-1">Release to refresh</span>
            )}
          </div>
        )}
      </div>

      {/* Content */}
      {children}
    </div>
  );
}
