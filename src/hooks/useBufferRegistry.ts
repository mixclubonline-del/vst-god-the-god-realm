/**
 * useBufferRegistry — React hook for the unified BufferRegistry.
 * Phase 2: Provides reactive access to the buffer pool.
 *
 * Components that need AudioBuffer data subscribe to this hook
 * instead of receiving `buffers` as a prop.
 */
import { useSyncExternalStore, useCallback } from 'react';
import { BufferRegistry } from '../audio/BufferRegistry';

/**
 * Subscribe to the BufferRegistry and get a reactive buffer record.
 * Re-renders when any buffer is added, removed, or replaced.
 */
export function useBufferRegistry(registry: BufferRegistry): Record<number, AudioBuffer> {
  const subscribe = useCallback(
    (onStoreChange: () => void) => registry.subscribe(onStoreChange),
    [registry],
  );

  const getSnapshot = useCallback(
    () => registry.toBufferRecord(),
    [registry],
  );

  return useSyncExternalStore(subscribe, getSnapshot);
}
