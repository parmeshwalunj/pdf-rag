'use client'

import { UserButton, useUser } from '@clerk/nextjs';

export default function UserProfile() {
  const { user, isLoaded } = useUser();

  if (!isLoaded) {
    return (
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 bg-gray-200 rounded-full animate-pulse" />
        <div className="w-20 h-4 bg-gray-200 rounded animate-pulse" />
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3">
      {user && (
        <div className="hidden sm:block text-sm text-gray-700">
          {user.firstName || user.emailAddresses[0]?.emailAddress || 'User'}
        </div>
      )}
      <UserButton 
        appearance={{
          elements: {
            avatarBox: "w-8 h-8",
          },
        }}
      />
    </div>
  );
}
