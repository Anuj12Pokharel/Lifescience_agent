'use client';

import { MessageCircle, Brain } from 'lucide-react';
import { useMemo } from 'react';

interface Message {
  id: string;
  text: string;
  sender: 'user' | 'ai';
  timestamp: Date;
}

interface ChatMessageProps {
  message: Message;
}

export default function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.sender === 'user';
  
  const formattedTime = useMemo(() => {
    const hours = message.timestamp.getHours().toString().padStart(2, '0');
    const minutes = message.timestamp.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  }, [message.timestamp]);

  return (
    <div className={`flex gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}>
      {!isUser && (
        <div className="flex-shrink-0 pt-1">
          <div className="w-8 h-8 bg-gradient-to-br from-primary via-accent to-primary rounded-xl flex items-center justify-center shadow-lg">
            <Brain className="w-4 h-4 text-white" />
          </div>
        </div>
      )}

      <div className="flex flex-col gap-1 max-w-md lg:max-w-lg">
        <div
          className={`px-5 py-3 rounded-2xl border transition-all ${
            isUser
              ? 'bg-gradient-to-r from-primary/90 to-accent/90 border-primary/50 text-primary-foreground shadow-lg shadow-primary/20 rounded-br-none'
              : 'bg-card/80 border-border/40 text-foreground shadow-lg backdrop-blur-sm rounded-bl-none hover:border-primary/30 hover:shadow-primary/10'
          }`}
        >
          <p className="text-sm leading-relaxed whitespace-pre-wrap break-words font-medium">{message.text}</p>
        </div>
        <p className={`text-xs ${isUser ? 'text-primary/60 text-right' : 'text-muted-foreground/60'}`}>
          {formattedTime}
        </p>
      </div>

      {isUser && (
        <div className="flex-shrink-0 pt-1">
          <div className="w-8 h-8 bg-gradient-to-br from-primary/80 to-accent/80 rounded-xl flex items-center justify-center shadow-lg shadow-primary/20">
            <MessageCircle className="w-4 h-4 text-white" />
          </div>
        </div>
      )}
    </div>
  );
}
