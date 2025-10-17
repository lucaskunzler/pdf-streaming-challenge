import { useQuery } from '@tanstack/react-query';
import { api, DocumentMetadata } from '@/services/api';

export const useDocumentMetadata = (documentId: string) => {
  return useQuery<DocumentMetadata>({
    queryKey: ['document-metadata', documentId],
    queryFn: () => api.getDocumentMetadata(documentId),
    enabled: !!documentId,
    staleTime: 1000 * 60 * 5, // 5 minutes
    retry: 2,
  });
};

