'use client';

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Mic, MicOff, Loader } from 'lucide-react';

interface VoiceInputProps {
  onTranscription: (text: string) => void;
  onAudioData?: (audioBlob: Blob) => void;
  disabled?: boolean;
}

export default function VoiceInput({ onTranscription, onAudioData, disabled = false }: VoiceInputProps) {
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const recognitionRef = useRef<any>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const [transcript, setTranscript] = useState('');
  const [mode, setMode] = useState<'text' | 'audio'>('text');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        recognitionRef.current = new SpeechRecognition();
        recognitionRef.current.continuous = false;
        recognitionRef.current.interimResults = true;
        recognitionRef.current.lang = 'en-US';

        recognitionRef.current.onstart = () => {
          setIsListening(true);
          setTranscript('');
        };

        recognitionRef.current.onresult = (event: any) => {
          let interimTranscript = '';

          for (let i = event.resultIndex; i < event.results.length; i++) {
            const transcript = event.results[i][0].transcript;

            if (event.results[i].isFinal) {
              setTranscript(transcript);
            } else {
              interimTranscript += transcript;
            }
          }
        };

        recognitionRef.current.onerror = (event: any) => {
          console.error('Speech recognition error', event.error);
          setIsListening(false);
        };

        recognitionRef.current.onend = () => {
          setIsListening(false);
          if (transcript) {
            setIsProcessing(true);
            // Simulate processing delay
            setTimeout(() => {
              onTranscription(transcript);
              setTranscript('');
              setIsProcessing(false);
            }, 500);
          }
        };
      }
    }
  }, [transcript, onTranscription]);

  const startAudioRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/mp3' });
        stream.getTracks().forEach(track => track.stop());

        if (onAudioData) {
          onAudioData(audioBlob);
        }
        setIsProcessing(false);
      };

      mediaRecorder.start();
      setIsListening(true);
    } catch (error) {
      console.error('Error accessing microphone:', error);
      setIsListening(false);
    }
  };

  const stopAudioRecording = () => {
    if (mediaRecorderRef.current && isListening) {
      mediaRecorderRef.current.stop();
      setIsListening(false);
      setIsProcessing(true);
    }
  };

  const toggleListening = () => {
    if (mode === 'text') {
      // Text-based speech recognition
      if (isListening && recognitionRef.current) {
        recognitionRef.current.stop();
      } else if (recognitionRef.current) {
        recognitionRef.current.start();
      }
    } else {
      // Audio recording
      if (isListening) {
        stopAudioRecording();
      } else {
        startAudioRecording();
      }
    }
  };

  const isDisabled = disabled || isProcessing || !recognitionRef.current;

  return (
    <div className="flex gap-2">
      <Button
        onClick={() => setMode(mode === 'text' ? 'audio' : 'text')}
        variant="outline"
        size="sm"
        className="text-xs"
        disabled={disabled || isListening || isProcessing}
      >
        {mode === 'text' ? '📝' : '🎵'}
      </Button>
      <Button
        onClick={toggleListening}
        disabled={isDisabled}
        variant="outline"
        size="icon"
        className={`border-border/50 ${isListening ? 'bg-primary/20 text-primary' : 'hover:bg-card'
          }`}
        title={mode === 'text' ? 'Voice input (text)' : 'Voice input (audio)'}
      >
        {isProcessing ? (
          <Loader className="w-4 h-4 animate-spin" />
        ) : isListening ? (
          <Mic className="w-4 h-4 animate-pulse" />
        ) : (
          <Mic className="w-4 h-4" />
        )}
      </Button>
    </div>
  );
}
