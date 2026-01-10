'use client'

import { Trash2, CheckCircle2, Clock, XCircle, Loader2 } from 'lucide-react'
import { PDF } from '@/lib/api'

interface PDFCardProps {
  pdf: PDF;
  onDelete: (id: string) => void;
  onToggle?: (id: string, isActive: boolean) => void;
  showToggle?: boolean;
  isDeleting?: boolean;
}

export default function PDFCard({ 
  pdf, 
  onDelete, 
  onToggle, 
  showToggle = false,
  isDeleting = false 
}: PDFCardProps) {
  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const getStatusIcon = () => {
    switch (pdf.upload_status) {
      case 'completed':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'processing':
        return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />;
      case 'pending':
        return <Clock className="h-4 w-4 text-yellow-500" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return null;
    }
  };

  const getStatusText = () => {
    switch (pdf.upload_status) {
      case 'completed':
        return 'Ready';
      case 'processing':
        return 'Processing...';
      case 'pending':
        return 'Pending';
      case 'failed':
        return 'Failed';
      default:
        return pdf.upload_status;
    }
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            {showToggle && onToggle && (
              <input
                type="checkbox"
                checked={pdf.is_active}
                onChange={(e) => onToggle(pdf.id, e.target.checked)}
                className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
              />
            )}
            <h4 className="font-semibold text-gray-900 truncate">
              {pdf.filename}
            </h4>
          </div>

          <div className="flex items-center gap-4 text-sm text-gray-600 mb-2">
            <div className="flex items-center gap-1">
              {getStatusIcon()}
              <span>{getStatusText()}</span>
            </div>
            {pdf.page_count && (
              <span>{pdf.page_count} pages</span>
            )}
            <span>{formatFileSize(pdf.file_size)}</span>
          </div>

          <div className="text-xs text-gray-500">
            Uploaded {new Date(pdf.created_at).toLocaleDateString()}
          </div>

          {pdf.upload_status === 'failed' && pdf.error_message && (
            <div className="mt-2 text-xs text-red-600 bg-red-50 p-2 rounded">
              {pdf.error_message}
            </div>
          )}
        </div>

        <button
          onClick={() => onDelete(pdf.id)}
          disabled={isDeleting}
          className="p-2 text-red-600 hover:bg-red-50 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          title="Delete PDF"
        >
          {isDeleting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Trash2 className="h-4 w-4" />
          )}
        </button>
      </div>
    </div>
  );
}
