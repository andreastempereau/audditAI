import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useCallback } from 'react';
import { endpoints, DataRoomFile, Fragment, SearchResult, IndexHealth } from '../api';
import { useSocketEvent } from './useSocket';
import { useAuth } from '../auth-supabase';
import { createClientComponentClient } from '../supabase-client';

export function useDataRoomFiles(params?: {
  page?: number;
  perPage?: number;
  sortBy?: string;
  sensitivity?: string;
  owner?: string;
  search?: string;
}) {
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ['dataroom', 'files', params],
    queryFn: () => endpoints.getDataRoomFiles(params),
    staleTime: 2 * 60 * 1000, // 2 minutes
  });

  const uploadMutation = useMutation({
    mutationFn: ({ file, options }: {
      file: File;
      options?: { sensitivity?: string; expiry?: string; encrypt?: boolean; fileId?: string };
    }) => endpoints.uploadDataRoomFile(file, options),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dataroom', 'files'] });
      queryClient.invalidateQueries({ queryKey: ['dataroom', 'health'] });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: {
      id: string;
      data: { sensitivity?: string; expiry?: string };
    }) => endpoints.updateDataRoomFile(id, data),
    onMutate: async ({ id, data }) => {
      await queryClient.cancelQueries({ queryKey: ['dataroom', 'files'] });
      const previousData = queryClient.getQueryData(['dataroom', 'files', params]);
      
      // Optimistic update
      queryClient.setQueryData(['dataroom', 'files', params], (old: any) => {
        if (!old?.files) return old;
        return {
          ...old,
          files: old.files.map((file: DataRoomFile) =>
            file.id === id ? { ...file, ...data } : file
          ),
        };
      });

      return { previousData };
    },
    onError: (err, variables, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(['dataroom', 'files', params], context.previousData);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['dataroom', 'files'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: endpoints.deleteDataRoomFile,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dataroom', 'files'] });
      queryClient.invalidateQueries({ queryKey: ['dataroom', 'health'] });
    },
  });

  return {
    files: data?.files || [],
    total: data?.total || 0,
    isLoading,
    error,
    uploadFile: uploadMutation.mutateAsync,
    updateFile: updateMutation.mutateAsync,
    deleteFile: deleteMutation.mutateAsync,
    uploadMutation,
    isUploading: uploadMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
  };
}

export function useDataRoomFragments(params?: {
  search?: string;
  sortBy?: 'relevance' | 'date' | 'file';
  confidence?: 'high' | 'medium' | 'low';
  page?: number;
  perPage?: number;
}) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['dataroom', 'fragments', params],
    queryFn: () => endpoints.searchFragments({
      text: params?.search || '',
      filters: {},
      limit: params?.perPage || 50,
    }),
    enabled: !!params?.search,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });

  return {
    data: data?.fragments || [],
    total: data?.total || 0,
    isLoading,
    error,
  };
}

export function useFragmentSearch() {
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState<{
    sensitivity?: string;
    fileId?: string;
    expired?: boolean;
    deprecated?: boolean;
  }>({});
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResult | null>(null);

  const queryClient = useQueryClient();

  const searchMutation = useMutation({
    mutationFn: endpoints.searchFragments,
    onMutate: () => setIsSearching(true),
    onSuccess: (data) => {
      setSearchResults(data);
      setIsSearching(false);
    },
    onError: () => setIsSearching(false),
  });

  const updateFragmentMutation = useMutation({
    mutationFn: ({ id, data }: {
      id: string;
      data: { action: 'deprecate' | 'edit'; newText?: string };
    }) => endpoints.updateFragment(id, data),
    onSuccess: () => {
      // Invalidate search results and re-run search if we have one
      if (query && searchResults) {
        searchMutation.mutate({ text: query, filters, limit: 50 });
      }
      queryClient.invalidateQueries({ queryKey: ['dataroom', 'health'] });
    },
  });

  const search = useCallback((searchQuery: string) => {
    setQuery(searchQuery);
    if (searchQuery.trim()) {
      searchMutation.mutate({
        text: searchQuery,
        filters,
        limit: 50,
      });
    } else {
      setSearchResults(null);
    }
  }, [filters, searchMutation]);

  const updateFilters = useCallback((newFilters: typeof filters) => {
    setFilters(newFilters);
    if (query.trim()) {
      searchMutation.mutate({
        text: query,
        filters: newFilters,
        limit: 50,
      });
    }
  }, [query, searchMutation]);

  return {
    query,
    setQuery,
    filters,
    updateFilters,
    search,
    searchResults,
    isSearching,
    updateFragment: updateFragmentMutation.mutateAsync,
    isUpdatingFragment: updateFragmentMutation.isPending,
  };
}

export function useIndexHealth() {
  const queryClient = useQueryClient();

  const { data: health, isLoading } = useQuery({
    queryKey: ['dataroom', 'health'],
    queryFn: endpoints.getIndexHealth,
    staleTime: 30 * 1000, // 30 seconds
    refetchInterval: 60 * 1000, // 1 minute
  });

  const rebalanceMutation = useMutation({
    mutationFn: endpoints.triggerRebalance,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dataroom', 'health'] });
    },
  });

  // Listen for real-time index updates
  useSocketEvent('indexRebalanced', useCallback((data: {
    timestamp: string;
    orphanCount: number;
    fragmentsTotal: number;
  }) => {
    queryClient.setQueryData(['dataroom', 'health'], (old: IndexHealth | undefined) => {
      if (!old) return old;
      return {
        ...old,
        lastRebalance: data.timestamp,
        orphanCount: data.orphanCount,
        fragmentsTotal: data.fragmentsTotal,
        isHealthy: data.orphanCount < 100, // Arbitrary threshold
      };
    });
  }, [queryClient]));

  return {
    health,
    isLoading,
    triggerRebalance: rebalanceMutation.mutateAsync,
    isRebalancing: rebalanceMutation.isPending,
  };
}

export function useFileVersions(fileId: string) {
  const { data, isLoading } = useQuery({
    queryKey: ['dataroom', 'versions', fileId],
    queryFn: () => endpoints.getFileVersions(fileId),
    enabled: !!fileId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const revertMutation = useMutation({
    mutationFn: ({ version }: { version: number }) =>
      endpoints.revertToVersion(fileId, version),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dataroom', 'files'] });
      queryClient.invalidateQueries({ queryKey: ['dataroom', 'versions', fileId] });
    },
  });

  const queryClient = useQueryClient();

  return {
    versions: data?.versions || [],
    isLoading,
    revertToVersion: revertMutation.mutateAsync,
    isReverting: revertMutation.isPending,
  };
}

export function useVersionDiff(fileId: string, versionA?: number, versionB?: number) {
  const { data: diff, isLoading } = useQuery({
    queryKey: ['dataroom', 'diff', fileId, versionA, versionB],
    queryFn: () => endpoints.getVersionDiff(fileId, versionA!, versionB!),
    enabled: !!(fileId && versionA !== undefined && versionB !== undefined),
    staleTime: 10 * 60 * 1000, // 10 minutes - diffs don't change
  });

  return {
    diff,
    isLoading,
  };
}

// Simple interface for the data room page
export function useDataRoom() {
  const { user } = useAuth();
  const supabase = createClientComponentClient();
  const queryClient = useQueryClient();
  const [uploadProgress, setUploadProgress] = useState(0);

  // Get files from Supabase
  const { data: files, isLoading, error } = useQuery({
    queryKey: ['data-room-files', user?.id],
    queryFn: async () => {
      if (!user) return [];

      // Get user's organization
      const { data: userOrg, error: orgError } = await supabase
        .from('user_organizations')
        .select('organization_id')
        .eq('user_id', user.id)
        .single();

      if (orgError || !userOrg) {
        console.error('Error fetching user organization:', orgError);
        return [];
      }

      // Get files for the organization
      const { data: filesData, error: filesError } = await supabase
        .from('documents')
        .select(`
          id,
          name,
          size,
          type,
          sensitivity,
          created_at,
          profiles (
            name,
            email
          )
        `)
        .eq('organization_id', userOrg.organization_id)
        .order('created_at', { ascending: false });

      if (filesError) {
        console.error('Error fetching files:', filesError);
        return [];
      }

      return (filesData || []).map((file: any) => ({
        id: file.id,
        name: file.name,
        size: file.size,
        type: file.type,
        sensitivity: file.sensitivity || 'public',
        uploadedAt: file.created_at,
        owner: file.profiles?.name || file.profiles?.email || 'Unknown',
      }));
    },
    enabled: !!user,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });

  // Upload file mutation
  const uploadMutation = useMutation({
    mutationFn: async ({ file, options }: { file: File; options?: { sensitivity?: string; encrypted?: boolean } }) => {
      if (!user) throw new Error('User not authenticated');

      // Get user's organization
      const { data: userOrg, error: orgError } = await supabase
        .from('user_organizations')
        .select('organization_id')
        .eq('user_id', user.id)
        .single();

      if (orgError || !userOrg) {
        throw new Error('Organization not found');
      }

      // Upload file to Supabase Storage
      const fileName = `${Date.now()}-${file.name}`;
      
      // Simulate upload progress for UI feedback
      setUploadProgress(25);
      
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('documents')
        .upload(fileName, file);

      if (uploadError) throw uploadError;
      
      setUploadProgress(75);

      // Save metadata to database
      const { data: docData, error: docError } = await supabase
        .from('documents')
        .insert({
          name: file.name,
          size: file.size,
          type: file.type,
          storage_path: uploadData.path,
          sensitivity: options?.sensitivity || 'public',
          organization_id: userOrg.organization_id,
          uploaded_by: user.id,
        })
        .select()
        .single();

      if (docError) throw docError;
      
      setUploadProgress(100);

      return docData;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['data-room-files', user?.id] });
      setUploadProgress(0);
    },
    onError: () => {
      setUploadProgress(0);
    },
  });

  // Delete file mutation
  const deleteMutation = useMutation({
    mutationFn: async (fileId: string) => {
      if (!user) throw new Error('User not authenticated');

      // Get file details first
      const { data: fileData, error: fileError } = await supabase
        .from('documents')
        .select('storage_path')
        .eq('id', fileId)
        .single();

      if (fileError) throw fileError;

      // Delete from storage
      const { error: storageError } = await supabase.storage
        .from('documents')
        .remove([fileData.storage_path]);

      if (storageError) throw storageError;

      // Delete from database
      const { error: dbError } = await supabase
        .from('documents')
        .delete()
        .eq('id', fileId);

      if (dbError) throw dbError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['data-room-files', user?.id] });
    },
  });

  return {
    files: files || [],
    isLoading,
    error,
    uploadFile: (file: File, options?: { sensitivity?: string; encrypted?: boolean }) => 
      uploadMutation.mutate({ file, options }),
    deleteFile: deleteMutation.mutate,
    isUploading: uploadMutation.isPending,
    uploadProgress,
  };
}