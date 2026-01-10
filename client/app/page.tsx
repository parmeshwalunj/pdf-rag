'use client'

import { SignedIn, SignedOut, RedirectToSignIn } from '@clerk/nextjs'
import { useState } from 'react'
import { useApiAuth } from '@/lib/auth-helper'
import FileUpload from "./components/file-upload"
import ChatComponent from "./components/chat"
import UserProfile from "./components/user-profile"
import PDFList from "./components/pdf-list"
import PDFSelector from "./components/pdf-selector"
import { PDF } from '@/lib/api'

export default function Home() {
  // Initialize API client with auth token
  useApiAuth();
  
  const [pdfs, setPdfs] = useState<PDF[]>([]);
  const [selectedPDFIds, setSelectedPDFIds] = useState<string[]>([]);

  const handlePDFsChange = (newPDFs: PDF[]) => {
    setPdfs(newPDFs);
  };

  const handleUploadSuccess = () => {
    // PDF list will auto-refresh via its interval
    // This is just for immediate feedback
  };

  return (
    <>
      <SignedOut>
        <RedirectToSignIn />
      </SignedOut>
      <SignedIn>
        <div className="h-screen w-screen overflow-hidden flex flex-col">
          {/* Header with user profile */}
          <header className="bg-white border-b border-gray-200 px-4 py-3 flex justify-between items-center shrink-0">
            <h1 className="text-xl font-bold text-gray-900">PDF RAG</h1>
            <UserProfile />
          </header>
          
          {/* Main content */}
          <div className="h-full w-full flex flex-1 overflow-hidden">
            {/* Left sidebar: PDF List + Upload */}
            <div className="w-[30vw] h-full flex flex-col border-r border-gray-200 overflow-hidden">
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                <div>
                  <h2 className="text-sm font-semibold text-gray-700 mb-3">My PDFs</h2>
                  <PDFList onPDFsChange={handlePDFsChange} />
                </div>
              </div>
              <div className="shrink-0 p-4 border-t border-gray-200">
                <FileUpload onUploadSuccess={handleUploadSuccess} />
              </div>
            </div>

            {/* Right side: PDF Selector + Chat */}
            <div className="w-[70vw] h-full flex flex-col overflow-hidden">
              <div className="shrink-0 p-4 border-b border-gray-200">
                <PDFSelector
                  pdfs={pdfs}
                  selectedPDFIds={selectedPDFIds}
                  onSelectionChange={setSelectedPDFIds}
                />
              </div>
              <div className="flex-1 overflow-hidden">
                <ChatComponent selectedPDFIds={selectedPDFIds} />
              </div>
            </div>
          </div>
        </div>
      </SignedIn>
    </>
  );
}
