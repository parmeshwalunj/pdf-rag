'use client'

import { useState } from "react"
import { Upload } from "lucide-react"
import { api } from "@/lib/api"

export default function FileUpload() {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<boolean>(false);

  const handleUploadButtonClick = () => {
    const el = document.createElement('input');
    el.setAttribute('type','file');
    el.setAttribute('accept','application/pdf');
    el.addEventListener('change', async (ev) => {
        if (el.files && el.files.length > 0) {
            const selectedFile = el.files.item(0);
            if (selectedFile) {
              // Validate file type
              if (selectedFile.type !== 'application/pdf') {
                setError('Please select a PDF file');
                return;
              }

              // Validate file size (10MB limit)
              const maxSize = 10 * 1024 * 1024; // 10MB
              if (selectedFile.size > maxSize) {
                setError('File size exceeds 10MB limit');
                return;
              }

              setFile(selectedFile);
              setError(null);
              setSuccess(false);
              setUploading(true);

              try {
                const data = await api.uploadPDF(selectedFile);
                console.log("File uploaded successfully:", data);
                setSuccess(true);
                setFile(null); // Reset file after successful upload
                
                // Clear success message after 3 seconds
                setTimeout(() => setSuccess(false), 3000);
              } catch (error) {
                console.error("Upload error:", error);
                const errorMessage = error instanceof Error ? error.message : "Failed to upload file. Please try again.";
                setError(errorMessage);
                setFile(null);
              } finally {
                setUploading(false);
              }
            }
        }
    });
    el.click();
  }

  return (
    <div className="bg-slate-900 text-white shadow-2xl flex justify-center items-center p-4 rounded-lg border-white border-2 min-h-[200px]">
      <div className="flex flex-col items-center justify-center gap-4 w-full">
      <div 
          onClick={!uploading ? handleUploadButtonClick : undefined}
          className={`flex items-center justify-center flex-col cursor-pointer transition-opacity ${
            uploading ? 'opacity-50 cursor-not-allowed' : 'hover:opacity-80'
          }`}
        >
          <h3 className="mb-2">Upload PDF file</h3>
          <Upload className={uploading ? "animate-pulse" : ""} />
          {file && (
            <p className="text-sm mt-2 text-gray-300">
              Selected: {file.name}
            </p>
          )}
        </div>

        {uploading && (
          <div className="text-sm text-blue-300">
            Uploading and processing...
          </div>
        )}

        {success && (
          <div className="text-sm text-green-300 bg-green-900/30 p-2 rounded">
            ✓ File uploaded successfully! Processing in background...
          </div>
        )}

        {error && (
          <div className="text-sm text-red-300 bg-red-900/30 p-2 rounded max-w-full wrap-break-word">
            ✗ {error}
          </div>
        )}

        <p className="text-xs text-gray-400 mt-2 text-center">
          Maximum file size: 10MB
        </p>
      </div>
    </div>
  )
}