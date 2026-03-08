'use client';

import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { buyerApi } from '@/lib/api';
import { Button } from '@/components/ui/button';

interface SaveSearchButtonProps {
  query: string;
  status?: string;
  className?: string;
}

export function SaveSearchButton({ query, status = 'LIVE', className }: SaveSearchButtonProps) {
  const { user } = useAuth();
  const toast = useToast();
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(false);

  if (!user) return null;

  const handleSave = async () => {
    setLoading(true);
    try {
      const searchLabel = query.trim() || 'All';
      await buyerApi.savedSearches.create(searchLabel, { status, search: query || undefined });
      setSaved(true);
      toast.addToast('Search saved. You can find it in your dashboard.', 'success');
    } catch (e) {
      toast.addToast(e instanceof Error ? e.message : 'Failed to save search', 'error');
    } finally {
      setLoading(false);
    }
  };

  if (saved) {
    return (
      <span className="text-sm text-muted-foreground">Search saved</span>
    );
  }

  return (
    <Button
      variant="outline"
      size="sm"
      className={`rounded-xl ${className ?? ''}`}
      onClick={handleSave}
      disabled={loading}
    >
      {loading ? 'Saving...' : 'Save this search'}
    </Button>
  );
}
