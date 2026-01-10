'use client'

import { useState, useEffect } from 'react'
import { CheckSquare, Square } from 'lucide-react'
import { PDF } from '@/lib/api'

interface PDFSelectorProps {
  pdfs: PDF[];
  selectedPDFIds: string[];
  onSelectionChange: (pdfIds: string[]) => void;
}

export default function PDFSelector({ 
  pdfs, 
  selectedPDFIds, 
  onSelectionChange 
}: PDFSelectorProps) {
  // Filter to only completed PDFs
  const completedPDFs = pdfs.filter(pdf => pdf.upload_status === 'completed');

  const handleToggle = (pdfId: string) => {
    if (selectedPDFIds.includes(pdfId)) {
      // Deselect
      onSelectionChange(selectedPDFIds.filter(id => id !== pdfId));
    } else {
      // Select
      onSelectionChange([...selectedPDFIds, pdfId]);
    }
  };

  const handleSelectAll = () => {
    const allCompletedIds = completedPDFs.map(pdf => pdf.pdf_id);
    onSelectionChange(allCompletedIds);
  };

  const handleDeselectAll = () => {
    onSelectionChange([]);
  };

  // Auto-select all active PDFs on mount
  useEffect(() => {
    if (selectedPDFIds.length === 0 && completedPDFs.length > 0) {
      const activePDFIds = completedPDFs
        .filter(pdf => pdf.is_active)
        .map(pdf => pdf.pdf_id);
      if (activePDFIds.length > 0) {
        onSelectionChange(activePDFIds);
      }
    }
  }, [pdfs]);

  if (completedPDFs.length === 0) {
    return (
      <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
        <p className="text-sm text-gray-600">
          No PDFs ready for chat. Upload and wait for processing to complete.
        </p>
      </div>
    );
  }

  return (
    <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-700">
          Select PDFs for Chat ({selectedPDFIds.length}/{completedPDFs.length})
        </h3>
        <div className="flex gap-2">
          <button
            onClick={handleSelectAll}
            className="text-xs text-blue-600 hover:underline"
          >
            Select All
          </button>
          <span className="text-gray-300">|</span>
          <button
            onClick={handleDeselectAll}
            className="text-xs text-blue-600 hover:underline"
          >
            Deselect All
          </button>
        </div>
      </div>

      <div className="space-y-2 max-h-32 overflow-y-auto">
        {completedPDFs.map((pdf) => {
          const isSelected = selectedPDFIds.includes(pdf.pdf_id);
          return (
            <label
              key={pdf.id}
              className="flex items-center gap-2 p-2 hover:bg-gray-100 rounded cursor-pointer"
            >
              <input
                type="checkbox"
                checked={isSelected}
                onChange={() => handleToggle(pdf.pdf_id)}
                className="hidden"
              />
              {isSelected ? (
                <CheckSquare className="h-4 w-4 text-blue-600" />
              ) : (
                <Square className="h-4 w-4 text-gray-400" />
              )}
              <span className="text-sm text-gray-700 truncate flex-1">
                {pdf.filename}
              </span>
            </label>
          );
        })}
      </div>

      {selectedPDFIds.length === 0 && (
        <p className="text-xs text-amber-600 mt-2">
          ⚠️ Please select at least one PDF to chat with
        </p>
      )}
    </div>
  );
}
