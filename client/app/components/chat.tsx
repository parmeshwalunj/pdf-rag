"use client"

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useState } from "react"

interface Doc{
    pageContent?: string;
    metadata?: {
        loc?: {
            pageNumber?: number;
        }
        source?: string
    }
}

interface IMessage {
    role: "user" | "assistant";
    content?: string;
    documents?: Doc[];
}

export default function ChatComponent() {

  const [message, setMessage] = useState<string>("");
  const [messages, setMessages] = useState<IMessage[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const handleSend = async () => {
    if (!message.trim() || loading) return;

    const userMessage = message.trim();
    setMessage(""); // Clear input immediately for better UX
    setError(null);
    setLoading(true);
    
    // Add user message to chat
    setMessages(prev => [...prev, {role: "user", content: userMessage}]);

    try {
      const response = await fetch(`http://localhost:8000/chat?message=${encodeURIComponent(userMessage)}`);
      
      // Check if response is ok
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "Unknown error" }));
        throw new Error(errorData.error || `Server error: ${response.status}`);
      }

      const data = await response.json();
      
      // Validate response data
      if (!data || !data.result) {
        throw new Error("Invalid response from server");
      }

      setMessages((prev) => [...prev, {
        role: "assistant", 
        content: data.result, 
        documents: data.docs
      }]);
    } catch (error) {
      console.error("Chat error:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to send message. Please try again.";
      setError(errorMessage);
      
      // Add error message to chat so user knows what went wrong
      setMessages(prev => [...prev, {
        role: "assistant",
        content: `Error: ${errorMessage}`
      }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-4 flex flex-col h-full">
        <div className="flex-1 overflow-y-auto mb-20">
            {messages.length === 0 && (
              <div className="text-center text-gray-500 mt-8">
                Start a conversation by asking a question about your PDF documents.
              </div>
            )}
            {messages.map((msg, index) => (
              <pre key={index} className="mb-2 p-2 bg-gray-100 rounded">
                {JSON.stringify(msg, null, 2)}
              </pre>
            ))}
            {error && (
              <div className="text-red-500 text-sm mt-2 p-2 bg-red-50 rounded">
                {error}
              </div>
            )}
        </div>
        <div className="fixed bottom-4 left-[30vw] right-4 flex gap-3">
            <Input 
              value={message} 
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
              placeholder="Type your message here..." 
              disabled={loading}
            />
            <Button 
              onClick={handleSend} 
              disabled={!message.trim() || loading}
            >
              {loading ? "Sending..." : "Send"}
            </Button>
        </div>
    </div>

    // <div className="flex flex-col h-full">
    //   <div className="flex-1 overflow-y-auto">
    //     {messages.map((message, index) => (
    //       <div key={index} className={`${message.role === "user" ? "self-end" : "self-start"}`}>
    //         {message.content}
    //       </div>
    //     ))}
    //   </div>
    // </div>
  )
}