'use client';

import { MessageCircle, Brain, Play, Pause, Volume2 } from 'lucide-react';
import { useMemo, useRef, useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';

interface AudioMessage {
  id: string;
  audioUrl: string;
  sender: 'user' | 'ai';
  timestamp: Date;
}

interface AudioMessageProps {
  message: AudioMessage;
}

export default function AudioMessageComponent({ message }: AudioMessageProps) {
  const isUser = message.sender === 'user';
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);

  const formattedTime = useMemo(() => {
    const hours = message.timestamp.getHours().toString().padStart(2, '0');
    const minutes = message.timestamp.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  }, [message.timestamp]);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleLoadedMetadata = () => setDuration(audio.duration);
    const handleTimeUpdate = () => setCurrentTime(audio.currentTime);
    const handleEnded = () => setIsPlaying(false);

    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('ended', handleEnded);
    };
  }, []);

  const togglePlayPause = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

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
          className={`px-5 py-4 rounded-2xl border transition-all ${
            isUser
              ? 'bg-gradient-to-r from-primary/90 to-accent/90 border-primary/50 text-primary-foreground shadow-lg shadow-primary/20 rounded-br-none'
              : 'bg-card/80 border-border/40 text-foreground shadow-lg backdrop-blur-sm rounded-bl-none hover:border-primary/30 hover:shadow-primary/10'
          }`}
        >
          <div className="flex items-center gap-3">
            <Button
              onClick={togglePlayPause}
              size="sm"
              variant="ghost"
              className={`h-8 w-8 p-0 ${isUser ? 'hover:bg-primary/20' : 'hover:bg-primary/10'}`}
            >
              {isPlaying ? (
                <Pause className="w-4 h-4" />
              ) : (
                <Play className="w-4 h-4" />
              )}
            </Button>

            <div className="flex-1 flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <Volume2 className="w-3 h-3 opacity-60" />
                <div className="text-xs font-medium">Audio Message</div>
              </div>
              <div className="text-xs opacity-70">
                {formatDuration(currentTime)} / {formatDuration(duration)}
              </div>
            </div>
          </div>

          <audio ref={audioRef} src={message.audioUrl} className="hidden" />
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
