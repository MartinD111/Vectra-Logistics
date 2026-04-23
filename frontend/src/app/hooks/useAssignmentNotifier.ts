'use client';

import { useCallback, useRef } from 'react';
import { AssignmentCommunications } from '../../lib/api/marketplace.api';

// ── Toast state ───────────────────────────────────────────────────────────────
// A lightweight, dependency-free toast implementation. We avoid adding a
// third-party toast library since the app doesn't have one yet.

export interface SmartActionsToast {
  id:            string;
  whatsappUrl:   string | null;
  whatsappPhone: string | null;
  mailtoUrl:     string;
  subject:       string;
  aiGenerated:   boolean;
}

type ToastListener = (toast: SmartActionsToast | null) => void;

const listeners = new Set<ToastListener>();
let currentToast: SmartActionsToast | null = null;

function publish(toast: SmartActionsToast | null) {
  currentToast = toast;
  listeners.forEach((l) => l(toast));
}

export function subscribeToSmartActions(listener: ToastListener): () => void {
  listeners.add(listener);
  // Immediately emit current state so late subscribers don't miss it
  listener(currentToast);
  return () => listeners.delete(listener);
}

export function dismissSmartActions() {
  publish(null);
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useAssignmentNotifier() {
  const toastIdRef = useRef(0);

  const notify = useCallback((comms: AssignmentCommunications) => {
    const id = `smart-actions-${++toastIdRef.current}`;

    publish({
      id,
      whatsappUrl:   comms.whatsapp.url,
      whatsappPhone: comms.whatsapp.phone,
      mailtoUrl:     comms.outlook.mailto,
      subject:       comms.outlook.subject,
      aiGenerated:   comms.aiGenerated,
    });

    // Auto-dismiss after 12 seconds
    setTimeout(() => {
      if (currentToast?.id === id) publish(null);
    }, 12_000);
  }, []);

  return { notify };
}
