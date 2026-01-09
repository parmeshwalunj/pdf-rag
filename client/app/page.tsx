'use client'

import { SignedIn, SignedOut, RedirectToSignIn } from '@clerk/nextjs'
import { useApiAuth } from '@/lib/auth-helper'
import FileUpload from "./components/file-upload"
import ChatComponent from "./components/chat"
import UserProfile from "./components/user-profile"

export default function Home() {
  // Initialize API client with auth token
  useApiAuth();
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
            <div className="w-[30vw] h-full flex items-center justify-center p-4 overflow-y-auto border-r border-gray-200">
              <FileUpload />
            </div>
            <div className="w-[70vw] h-full overflow-hidden">
              <ChatComponent />
            </div>
          </div>
        </div>
      </SignedIn>
    </>
  );
}
