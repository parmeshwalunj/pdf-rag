"use client"

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useState, useRef, useEffect } from "react"
import { api } from "@/lib/api"
import { Send, Loader2 } from "lucide-react"

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

interface ChatComponentProps {
  selectedPDFIds?: string[];
}

export default function ChatComponent({ selectedPDFIds = [] }: ChatComponentProps) {
  const [message, setMessage] = useState<string>("");
  const [messages, setMessages] = useState<IMessage[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    if (!message.trim() || loading) return;

    const userMessage = message.trim();
    setMessage(""); // Clear input immediately for better UX
    setError(null);
    setLoading(true);
    
    // Add user message to chat
    setMessages(prev => [...prev, {role: "user", content: userMessage}]);

    try {
      // Pass selected PDF IDs to chat API
      const data = await api.chat(userMessage, selectedPDFIds.length > 0 ? selectedPDFIds : undefined);
      
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
    <div className="flex flex-col h-full bg-gray-50 overflow-hidden">
      {/* Messages area */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center text-gray-500 mt-8">
            <p className="text-lg mb-2">👋 Welcome!</p>
            <p>Start a conversation by asking a question about your PDF documents.</p>
          </div>
        )}
        
        {messages.map((msg, index) => (
          <div
            key={index}
            className={`flex ${
              msg.role === "user" ? "justify-end" : "justify-start"
            }`}
          >
            <div
              className={`max-w-[80%] rounded-lg p-3 ${
                msg.role === "user"
                  ? "bg-blue-500 text-white"
                  : "bg-white text-gray-800 shadow-sm border border-gray-200"
              }`}
            >
              <div className="whitespace-pre-wrap wrap-break-word overflow-wrap-anywhere">
                {msg.content}
              </div>
              
              {/* Show source documents if available */}
              {msg.documents && msg.documents.length > 0 && (
                <div className="mt-2 pt-2 border-t border-gray-300 text-xs opacity-75">
                  <p className="font-semibold mb-1">Sources:</p>
                  {msg.documents.map((doc, docIndex) => (
                    <div key={docIndex} className="mb-1">
                      {doc.metadata?.source && (
                        <span className="italic">
                          {doc.metadata.source.split('/').pop()}
                        </span>
                      )}
                      {doc.metadata?.loc?.pageNumber && (
                        <span className="ml-2">(Page {doc.metadata.loc.pageNumber})</span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
        
        {/* Loading indicator */}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-white rounded-lg p-3 shadow-sm border border-gray-200">
              <div className="flex items-center gap-2 text-gray-500">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm">Thinking...</span>
              </div>
            </div>
          </div>
        )}
        
        {/* Error message */}
        {error && !loading && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
            {error}
          </div>
        )}
        
        {/* Scroll anchor */}
        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div className="border-t border-gray-200 bg-white p-4 shrink-0">
        <div className="flex gap-2">
          <Input
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="Type your message here..."
            disabled={loading}
            className="flex-1"
          />
          <Button
            onClick={handleSend}
            disabled={!message.trim() || loading}
            className="px-6"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
        </div>
    </div>
  )
}