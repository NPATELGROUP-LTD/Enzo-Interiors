import { useState, useEffect, useCallback } from "react";

export type NotificationType =
  | "message"
  | "invoice"
  | "appointment"
  | "design"
  | "enquiry";

export interface AppNotification {
  id: number;
  type: NotificationType;
  text: string;
  time: string;
  read: boolean;
}

const SIMULATED_POOL: Omit<AppNotification, "id" | "time" | "read">[] = [
  { type: "message", text: "New message from Sarah Thompson" },
  { type: "invoice", text: "Invoice INV-007 is due in 3 days" },
  { type: "appointment", text: "Appointment reminder: tomorrow at 10am" },
  { type: "design", text: "New design renders are ready to review" },
  { type: "enquiry", text: "New enquiry from James Patel" },
  { type: "message", text: "Hannah Green replied to your message" },
  { type: "design", text: "Your 3D kitchen design is ready" },
  { type: "appointment", text: "Consultation scheduled for next Monday" },
];

let nextId = 100;

function relativeTime(date: Date): string {
  const diff = Math.floor((Date.now() - date.getTime()) / 1000);
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)} min ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export function useNotifications(
  initialNotifications: Omit<AppNotification, "id">[] = [],
  simulateInterval = 180_000, // 3 minutes
) {
  const [notifications, setNotifications] = useState<AppNotification[]>(() =>
    initialNotifications.map((n, i) => ({ ...n, id: i + 1 })),
  );

  useEffect(() => {
    if (simulateInterval <= 0) return;
    const timer = setInterval(() => {
      const randomItem =
        SIMULATED_POOL[Math.floor(Math.random() * SIMULATED_POOL.length)];
      const newNotif: AppNotification = {
        ...randomItem,
        id: ++nextId,
        time: relativeTime(new Date()),
        read: false,
      };
      setNotifications((prev) => [newNotif, ...prev]);
    }, simulateInterval);
    return () => clearInterval(timer);
  }, [simulateInterval]);

  const markRead = useCallback((id: number) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n)),
    );
  }, []);

  const markAllRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }, []);

  const unreadCount = notifications.filter((n) => !n.read).length;

  return { notifications, markRead, markAllRead, unreadCount };
}
