'use client'

import { useState, useEffect, useRef } from 'react'
import { Loader2, FileText, AlertCircle, RefreshCw } from 'lucide-react'
import { api, PDF } from '@/lib/api'
import PDFCard from './pdf-card'

interface PDFListProps {
  onPDFsChange?: (pdfs: PDF[]) => void;
}

export default function PDFList({ onPDFsChange }: PDFListProps) {
  const [pdfs, setPdfs] = useState<PDF[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const loadPDFs = async (showRefreshing = false) => {
    try {
      if (showRefreshing) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);
      const data = await api.getPDFs();
      setPdfs(data);
      onPDFsChange?.(data);
      
      // Check if all PDFs are completed or failed (no need to poll)
      const hasActiveUploads = data.some(
        pdf => pdf.upload_status === 'pending' || pdf.upload_status === 'processing'
      );
      
      // Stop polling if no active uploads
      if (!hasActiveUploads && intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      
      // Start polling if there are active uploads and not already polling
      if (hasActiveUploads && !intervalRef.current) {
        intervalRef.current = setInterval(() => loadPDFs(false), 30000); // 30 seconds
      }
    } catch (err) {
      console.error('Error loading PDFs:', err);
      setError(err instanceof Error ? err.message : 'Failed to load PDFs');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleManualRefresh = () => {
    loadPDFs(true);
  };

  useEffect(() => {
    loadPDFs();
    
    // Cleanup on unmount
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this PDF? This action cannot be undone.')) {
      return;
    }

    try {
      setDeletingId(id);
      await api.deletePDF(id);
      // Reload PDFs after deletion
      await loadPDFs();
    } catch (err) {
      console.error('Error deleting PDF:', err);
      alert(err instanceof Error ? err.message : 'Failed to delete PDF');
    } finally {
      setDeletingId(null);
    }
  };

  const handleToggle = async (id: string, isActive: boolean) => {
    try {
      await api.togglePDF(id, isActive);
      // Update local state
      setPdfs(prev => prev.map(pdf => 
        pdf.id === id ? { ...pdf, is_active: isActive } : pdf
      ));
    } catch (err) {
      console.error('Error toggling PDF:', err);
      alert(err instanceof Error ? err.message : 'Failed to update PDF');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
        <div className="flex items-center gap-2 text-red-700">
          <AlertCircle className="h-5 w-5" />
          <span>{error}</span>
        </div>
        <button
          onClick={() => loadPDFs(false)}
          className="mt-2 text-sm text-red-600 hover:underline"
        >
          Retry
        </button>
      </div>
    );
  }

  if (pdfs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-gray-500">
        <FileText className="h-12 w-12 mb-4 text-gray-300" />
        <p className="text-sm">No PDFs uploaded yet</p>
        <p className="text-xs mt-1">Upload your first PDF to get started</p>
      </div>
    );
  }

  const hasActiveUploads = pdfs.some(
    pdf => pdf.upload_status === 'pending' || pdf.upload_status === 'processing'
  );

  return (
    <div className="space-y-3">
      {/* Header with refresh button */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-gray-500">
          {hasActiveUploads ? 'Auto-refreshing every 30s' : 'All PDFs ready'}
        </span>
        <button
          onClick={handleManualRefresh}
          disabled={refreshing}
          className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors disabled:opacity-50"
          title="Refresh PDF list"
        >
          <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* PDF Cards */}
      {pdfs.map((pdf) => (
        <PDFCard
          key={pdf.id}
          pdf={pdf}
          onDelete={handleDelete}
          onToggle={handleToggle}
          showToggle={true}
          isDeleting={deletingId === pdf.id}
        />
      ))}
    </div>
  );
}
