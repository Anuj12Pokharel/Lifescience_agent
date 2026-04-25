'use client';

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Mic, Square, Loader } from 'lucide-react';

interface AudioRecorderProps {
  onAudioRecorded: (blob: Blob) => void;
  disabled?: boolean;
}

export default function AudioRecorder({ onAudioRecorded, disabled = false }: AudioRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  const startRecording = async () => {
    try {
      console.log('[v0] Requesting microphone access');
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        console.log('[v0] Recording stopped, processing audio');
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        
        // Convert webm to mp3 format (for simplicity, we'll send webm but label it as audio)
        console.log('[v0] Audio blob created, size:', audioBlob.size);
        setIsProcessing(false);
        onAudioRecorded(audioBlob);
      };

      mediaRecorder.start();
      setIsRecording(true);
      console.log('[v0] Recording started');
    } catch (error) {
      console.error('[v0] Error accessing microphone:', error);
      alert('Please allow microphone access to record audio');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      console.log('[v0] Stopping recording');
      setIsProcessing(true);
      mediaRecorderRef.current.stop();
      setIsRecording(false);

      // Clean up stream
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    }
  };

  return (
    <div className="relative">
      <Button
        onClick={isRecording ? stopRecording : startRecording}
        disabled={disabled || isProcessing}
        className={`relative transition-all duration-300 ${
          isRecording
            ? 'bg-red-500 hover:bg-red-600 text-white shadow-lg shadow-red-500/50'
            : 'bg-primary/10 hover:bg-primary/20 text-primary border border-primary/30'
        }`}
        size="icon"
        title={isRecording ? 'Stop recording' : 'Start recording'}
      >
        {isProcessing ? (
          <Loader className="w-4 h-4 animate-spin" />
        ) : isRecording ? (
          <>
            <Square className="w-4 h-4" />
            <span className="absolute inset-0 rounded-lg border-2 border-red-500/50 animate-pulse"></span>
          </>
        ) : (
          <Mic className="w-4 h-4" />
        )}
      </Button>

      {/* Recording Indicator */}
      {isRecording && (
        <div className="absolute right-full mr-3 top-1/2 -translate-y-1/2 flex gap-1">
          <div className="w-1.5 h-1.5 bg-red-500 rounded-full animate-bounce"></div>
          <div className="w-1.5 h-1.5 bg-red-500 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
          <div className="w-1.5 h-1.5 bg-red-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
        </div>
      )}
    </div>
  );
}
