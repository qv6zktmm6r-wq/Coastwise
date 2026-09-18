import { useEffect, useRef, useState, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@clerk/react';
import { getGetFamilyMembershipQueryKey, useGetFamilyMembership, useGetFamilySync, useUpdateFamilySync } from '@workspace/api-client-react';
import { AppState } from './state';
import { sanitizeForSync, mergeStates } from './sync';
import { getGetFamilySyncQueryKey } from '@workspace/api-client-react';

export function useSyncManager(localState: AppState, setLocalState: (s: AppState) => void) {
  const { isSignedIn } = useAuth();
  const queryClient = useQueryClient();
  const [conflict, setConflict] = useState<{ cloudState: AppState; cloudRevision: number } | null>(null);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'error' | 'conflict'>('idle');
  const lastSyncedRevision = useRef(0);
  const lastLocalSyncState = useRef<string>(''); // stringified sanitized state to detect changes
  const syncGeneration = useRef(0);
  const { data: membership } = useGetFamilyMembership({
    query: { enabled: !!isSignedIn, queryKey: getGetFamilyMembershipQueryKey() },
  });

  const { data: syncDoc, refetch } = useGetFamilySync({
    query: {
      enabled: !!isSignedIn && !!membership,
      queryKey: getGetFamilySyncQueryKey(),
      refetchInterval: 15000, // Poll periodically for other-device changes
    }
  });

  const updateSync = useUpdateFamilySync();

  // Polling / Refetch handling
  useEffect(() => {
    if (!syncDoc) return;
    
    if (syncDoc.revision > lastSyncedRevision.current) {
      // Check if it's actually different from what we have locally
      const cloudSerialized = JSON.stringify(syncDoc.state);
      const localSerialized = JSON.stringify(sanitizeForSync(localState));
      
      if (cloudSerialized === localSerialized) {
        // They are identical, no conflict, just catch up tracking refs
        lastSyncedRevision.current = syncDoc.revision;
        lastLocalSyncState.current = localSerialized;
      } else {
        // Different data!
        setConflict({ cloudState: syncDoc.state as unknown as AppState, cloudRevision: syncDoc.revision });
        setSyncStatus('conflict');
      }
    }
  }, [syncDoc, localState]);

  const mergeAndSave = useCallback(async () => {
    if (!conflict) return;
    const generation = syncGeneration.current;
    const merged = mergeStates(localState, conflict.cloudState);
    setLocalState(merged);
    
    // Save merged to cloud
    const sanitized = sanitizeForSync(merged);
    try {
      setSyncStatus('syncing');
      const newDoc = await updateSync.mutateAsync({
        data: {
          revision: conflict.cloudRevision,
          state: sanitized,
        }
      });
      if (generation !== syncGeneration.current) return;
      lastSyncedRevision.current = newDoc.revision;
      lastLocalSyncState.current = JSON.stringify(sanitized);
      setConflict(null);
      setSyncStatus('idle');
      queryClient.setQueryData(getGetFamilySyncQueryKey(), newDoc);
    } catch (e) {
      if (generation !== syncGeneration.current) return;
      setSyncStatus('error');
    }
  }, [conflict, localState, setLocalState, updateSync, queryClient]);

  const useCloudOnly = useCallback(() => {
    if (!conflict) return;
    setLocalState(conflict.cloudState);
    lastSyncedRevision.current = conflict.cloudRevision;
    lastLocalSyncState.current = JSON.stringify(sanitizeForSync(conflict.cloudState));
    setConflict(null);
    setSyncStatus('idle');
  }, [conflict, setLocalState]);

  const isLinked = lastLocalSyncState.current !== '';

  const uploadLocal = useCallback(async () => {
    // Explicit local import (overwrite cloud with local)
    const generation = syncGeneration.current;
    const sanitized = sanitizeForSync(localState);
    try {
      setSyncStatus('syncing');
      const newDoc = await updateSync.mutateAsync({
        data: {
          revision: (syncDoc && syncDoc.revision > lastSyncedRevision.current) ? syncDoc.revision : lastSyncedRevision.current,
          state: sanitized,
        }
      });
      if (generation !== syncGeneration.current) return;
      lastSyncedRevision.current = newDoc.revision;
      lastLocalSyncState.current = JSON.stringify(sanitized);
      setConflict(null);
      setSyncStatus('idle');
      queryClient.setQueryData(getGetFamilySyncQueryKey(), newDoc);
    } catch (e) {
      if (generation !== syncGeneration.current) return;
      setSyncStatus('error');
    }
  }, [localState, syncDoc, updateSync, queryClient]);

  const unlinkDevice = useCallback(() => {
    syncGeneration.current += 1;
    lastLocalSyncState.current = '';
    setConflict(null);
    setSyncStatus('idle');
  }, []);

  // Attempt auto-upload if local changes and no conflict
  useEffect(() => {
    if (!isSignedIn || !membership || conflict || syncStatus === 'syncing') return;
    
    const sanitized = sanitizeForSync(localState);
    const serialized = JSON.stringify(sanitized);
    
    if (isLinked && serialized !== lastLocalSyncState.current) {
      // Local state changed, upload
      const upload = async () => {
        const generation = syncGeneration.current;
        setSyncStatus('syncing');
        try {
          const newDoc = await updateSync.mutateAsync({
            data: {
              revision: lastSyncedRevision.current,
              state: sanitized,
            }
          });
          if (generation !== syncGeneration.current) return;
          lastSyncedRevision.current = newDoc.revision;
          lastLocalSyncState.current = serialized;
          setSyncStatus('idle');
          queryClient.setQueryData(getGetFamilySyncQueryKey(), newDoc);
        } catch (e: any) {
          if (generation !== syncGeneration.current) return;
          if (e.response?.status === 409) {
            // Conflict
            refetch(); // will trigger conflict state via useEffect above
          } else {
            setSyncStatus('error');
          }
        }
      };
      upload();
    }
  }, [localState, isSignedIn, membership, conflict, syncStatus, updateSync, queryClient, refetch]);

  // Clear on sign out
  useEffect(() => {
    if (!isSignedIn) {
      syncGeneration.current += 1;
      setConflict(null);
      setSyncStatus('idle');
      lastSyncedRevision.current = 0;
      lastLocalSyncState.current = '';
    }
  }, [isSignedIn]);

  return { conflict, syncStatus, isLinked, mergeAndSave, useCloudOnly, uploadLocal, unlinkDevice, refetch };
}
