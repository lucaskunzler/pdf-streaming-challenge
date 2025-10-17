const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

export interface DocumentMetadata {
  id: string;
  filename: string;
  pageCount: number;
  fileSize: number;
  lastModified: string;
  etag: string;
}

export const api = {
  // Get document metadata
  getDocumentMetadata: async (documentId: string): Promise<DocumentMetadata> => {
    const response = await fetch(`${API_BASE_URL}/api/documents/${documentId}/metadata`);
    if (!response.ok) {
      throw new Error(`Failed to fetch metadata: ${response.statusText}`);
    }
    return response.json();
  },

  // Get document URL for streaming (supports range requests)
  getDocumentUrl: (documentId: string): string => {
    return `${API_BASE_URL}/api/documents/${documentId}/range`;
  },

  // Health check
  checkHealth: async () => {
    const response = await fetch(`${API_BASE_URL}/health`);
    if (!response.ok) {
      throw new Error('Backend health check failed');
    }
    return response.json();
  },
};

