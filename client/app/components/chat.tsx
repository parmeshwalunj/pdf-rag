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

  const handleSend = async () => {
    setMessages(prev => [...prev, {role: "user", content: message}]);
    const response = await fetch(`http://localhost:8000/chat?message=${message}`);
    const data = await response.json();
    console.log({data});
    setMessages((prev) => [...prev, {role: "assistant", content: data?.result, documents: data?.docs}])
  }

  return (
    <div className="p-4">
        <div>
            {messages.map((message, index) => <pre key={index}>{JSON.stringify(message, null, 2)}</pre>)}
        </div>
        <div className="fixed bottom-4 w-100 flex gap-3">
            <Input value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Type you message here..." />
            <Button onClick={handleSend} disabled={!message.trim()}>Send</Button>
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