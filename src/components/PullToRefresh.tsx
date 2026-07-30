'use client';

import { useState, useRef, useEffect, ReactNode } from 'react';

interface PullToRefreshProps {
  children: ReactNode;
  onRefresh: () => Promise<void>;
  pullThreshold?: number;
}

export default function PullToRefresh({ children, onRefresh, pullThreshold = 80 }: PullToRefreshProps) {
  const [pulling, setPulling] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startYRef = useRef<number | null>(null);
  const isPullingRef = useRef(false);

  useEffect(() => {
    const handleTouchStart = (e: TouchEvent) => {
      // Only activate if we're at the top of the page
      if (window.scrollY === 0) {
        startYRef.current = e.touches[0].clientY;
        isPullingRef.current = true;
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!isPullingRef.current || startYRef.current === null) return;
      
      const currentY = e.touches[0].clientY;
      const diff = currentY - startYRef.current;
      
      // Only show pulling state if pulling down and at top
      if (diff > 0 && window.scrollY === 0) {
        setPulling(true);
        // Apply resistance to the pull
        const resistance = 0.5;
        setPullDistance(Math.min(diff * resistance, pullThreshold * 1.5));
        e.preventDefault();
      } else {
        setPulling(false);
        setPullDistance(0);
      }
    };

    const handleTouchEnd = async () => {
      if (pulling && pullDistance > pullThreshold) {
        setRefreshing(true);
        setPullDistance(0);
        setPulling(false);
        try {
          await onRefresh();
        } finally {
          setRefreshing(false);
        }
      } else {
        setPullDistance(0);
        setPulling(false);
      }
      startYRef.current = null;
      isPullingRef.current = false;
    };

    document.addEventListener('touchstart', handleTouchStart, { passive: true });
    document.addEventListener('touchmove', handleTouchMove, { passive: false });
    document.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
    };
  }, [pulling, pullDistance, pullThreshold, onRefresh]);

  return (
    <div className="relative">
      {/* Pull indicator */}
      <div 
        className="absolute top-0 left-0 right-0 flex items-center justify-center transition-all duration-200 z-50"
        style={{ 
          height: `${pullDistance}px`,
          opacity: refreshing ? 1 : pullDistance > 0 ? 1 : 0,
          transform: pullDistance > 0 ? 'translateY(0)' : 'translateY(-20px)',
        }}
      >
        <div className="flex flex-col items-center">
          {refreshing ? (
            <div className="w-6 h-6 border-2 border-brand-orange border-t-transparent rounded-full animate-spin" />
          ) : (
            <div className="w-6 h-6 text-brand-orange text-2xl" style={{ transform: `rotate(${Math.min(pullDistance, pullThreshold) * (180 / pullThreshold)}deg)` }}>
              ↓
            </div>
          )}
          <span className="text-xs text-brand-cream/60 mt-1">
            {refreshing ? 'Refreshing...' : pullDistance > pullThreshold ? 'Release to refresh' : 'Pull down'}
          </span>
        </div>
      </div>

      {/* Content */}
      <div style={{ transform: `translateY(${pullDistance}px)` }}>
        {children}
      </div>
    </div>
  );
}
