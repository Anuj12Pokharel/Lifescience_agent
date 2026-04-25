'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { X } from 'lucide-react';

interface BookingDialogProps {
  open: boolean;
  onSubmit: (data: { name: string; email: string; purpose: string }) => void;
  onCancel: () => void;
}

export default function BookingDialog({ open, onSubmit, onCancel }: BookingDialogProps) {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    purpose: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!open) return null;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim() || !formData.email.trim() || !formData.purpose.trim()) {
      alert('Please fill in all fields');
      return;
    }

    // Validate email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      alert('Please enter a valid email');
      return;
    }

    setIsSubmitting(true);
    try {
      onSubmit(formData);
      setFormData({ name: '', email: '', purpose: '' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-md z-40 transition-opacity"
        onClick={onCancel}
      />

      {/* Dialog */}
      <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-md mx-4 animate-in fade-in zoom-in-95">
        <div className="bg-card border border-border/50 rounded-3xl shadow-2xl overflow-hidden backdrop-blur-xl">
          {/* Header */}
          <div className="flex items-center justify-between p-7 border-b border-border/30 bg-gradient-to-r from-primary/15 via-primary/5 to-accent/10">
            <div>
              <h2 className="text-2xl font-bold text-foreground">Complete Your Booking</h2>
              <p className="text-sm text-muted-foreground/80 mt-1">
                Provide your details to finalize the appointment
              </p>
            </div>
            <button
              onClick={onCancel}
              className="text-muted-foreground hover:text-foreground hover:bg-primary/10 transition-all p-2 rounded-lg"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-7 space-y-5">
            {/* Name Field */}
            <div>
              <label className="block text-sm font-semibold text-foreground mb-3">
                Full Name <span className="text-primary">*</span>
              </label>
              <Input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                placeholder="John Doe"
                className="bg-input/60 border-border/30 text-foreground placeholder:text-muted-foreground/50 focus:border-primary/50 focus:bg-input rounded-xl transition-all focus:shadow-lg focus:shadow-primary/10"
                required
              />
            </div>

            {/* Email Field */}
            <div>
              <label className="block text-sm font-semibold text-foreground mb-3">
                Email Address <span className="text-primary">*</span>
              </label>
              <Input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="john@example.com"
                className="bg-input/60 border-border/30 text-foreground placeholder:text-muted-foreground/50 focus:border-primary/50 focus:bg-input rounded-xl transition-all focus:shadow-lg focus:shadow-primary/10"
                required
              />
            </div>

            {/* Purpose Field */}
            <div>
              <label className="block text-sm font-semibold text-foreground mb-3">
                Purpose of Meeting <span className="text-primary">*</span>
              </label>
              <textarea
                name="purpose"
                value={formData.purpose}
                onChange={handleChange}
                placeholder="Describe your meeting purpose..."
                rows={4}
                className="w-full px-4 py-3 bg-input/60 border border-border/30 rounded-xl text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 focus:bg-input resize-none transition-all focus:shadow-lg focus:shadow-primary/10"
                required
              />
            </div>

            {/* Buttons */}
            <div className="flex gap-3 pt-6">
              <Button
                type="button"
                onClick={onCancel}
                variant="outline"
                className="flex-1 rounded-xl border-border/30 hover:bg-card/50 transition-all"
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="flex-1 bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90 text-primary-foreground rounded-xl shadow-lg hover:shadow-primary/30 transition-all disabled:opacity-50"
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Submitting...' : 'Confirm Booking'}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}
