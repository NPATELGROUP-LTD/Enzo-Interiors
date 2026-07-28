export interface SearchResult {
  id: string;
  type:
    | "client"
    | "project"
    | "invoice"
    | "message"
    | "booking"
    | "testimonial";
  title: string;
  subtitle?: string;
  description?: string;
  url: string;
}

export const searchableData: SearchResult[] = [
  // Clients
  {
    id: "client-1",
    type: "client",
    title: "Sarah Thompson",
    subtitle: "sarah@example.com",
    description: "Bedroom Renovation Client",
    url: "/admin/clients",
  },
  {
    id: "client-2",
    type: "client",
    title: "James Mitchell",
    subtitle: "james@mitchell.co.uk",
    description: "Kitchen Redesign Client",
    url: "/admin/clients",
  },
  {
    id: "client-3",
    type: "client",
    title: "Emma Richardson",
    subtitle: "emma@richardson.com",
    description: "Media Wall Installation",
    url: "/admin/clients",
  },
  {
    id: "client-4",
    type: "client",
    title: "David Chen",
    subtitle: "david@chenarch.com",
    description: "Walk-in Wardrobe Project",
    url: "/admin/clients",
  },
  {
    id: "client-5",
    type: "client",
    title: "Priya Patel",
    subtitle: "priya@patel.co.uk",
    description: "Full Home Renovation",
    url: "/admin/clients",
  },

  // Projects
  {
    id: "project-1",
    type: "project",
    title: "Bedroom Renovation",
    subtitle: "Sarah Thompson",
    description: "Manufacturing - 5 days remaining",
    url: "/admin/projects",
  },
  {
    id: "project-2",
    type: "project",
    title: "Kitchen Redesign",
    subtitle: "James Mitchell",
    description: "Design - 12 days remaining",
    url: "/admin/projects",
  },
  {
    id: "project-3",
    type: "project",
    title: "Media Wall Installation",
    subtitle: "Emma Richardson",
    description: "Installation - 3 days remaining",
    url: "/admin/projects",
  },
  {
    id: "project-4",
    type: "project",
    title: "Walk-in Wardrobe",
    subtitle: "David Chen",
    description: "Consultation - 2 days remaining",
    url: "/admin/projects",
  },
  {
    id: "project-5",
    type: "project",
    title: "Full Home Renovation",
    subtitle: "Priya Patel",
    description: "Completed",
    url: "/admin/projects",
  },

  // Invoices
  {
    id: "invoice-1",
    type: "invoice",
    title: "INV-001",
    subtitle: "Sarah Thompson - £1,200",
    description: "Bedroom Renovation - Paid",
    url: "/admin/invoices",
  },
  {
    id: "invoice-2",
    type: "invoice",
    title: "INV-002",
    subtitle: "Sarah Thompson - £1,400",
    description: "Bedroom Renovation - Outstanding",
    url: "/admin/invoices",
  },
  {
    id: "invoice-3",
    type: "invoice",
    title: "INV-003",
    subtitle: "James Mitchell - £2,500",
    description: "Kitchen Redesign - Outstanding",
    url: "/admin/invoices",
  },
  {
    id: "invoice-4",
    type: "invoice",
    title: "INV-004",
    subtitle: "Emma Richardson - £800",
    description: "Media Wall - Paid",
    url: "/admin/invoices",
  },
  {
    id: "invoice-5",
    type: "invoice",
    title: "INV-005",
    subtitle: "David Chen - £1,800",
    description: "Walk-in Wardrobe - Draft",
    url: "/admin/invoices",
  },

  // Bookings
  {
    id: "booking-1",
    type: "booking",
    title: "Rachel Adams Consultation",
    subtitle: "Mar 15, 2026 at 10:00 AM",
    description: "Kitchen consultation appointment",
    url: "/admin/bookings",
  },
  {
    id: "booking-2",
    type: "booking",
    title: "Oliver Kent Meeting",
    subtitle: "Mar 18, 2026 at 2:00 PM",
    description: "Bedroom design review",
    url: "/admin/bookings",
  },
  {
    id: "booking-3",
    type: "booking",
    title: "Sophie Harris Visit",
    subtitle: "Mar 20, 2026 at 11:00 AM",
    description: "Wardrobe consultation",
    url: "/admin/bookings",
  },

  // Messages
  {
    id: "message-1",
    type: "message",
    title: "Sarah Thompson",
    subtitle: "Bedroom fabric samples",
    description: "Can we review the fabric samples for the bedroom?",
    url: "/admin/messages",
  },
  {
    id: "message-2",
    type: "message",
    title: "James Mitchell",
    subtitle: "Kitchen timeline query",
    description: "Quick question about the installation timeline",
    url: "/admin/messages",
  },
  {
    id: "message-3",
    type: "message",
    title: "Emma Richardson",
    subtitle: "Media wall dimensions",
    description: "Need to confirm the final dimensions",
    url: "/admin/messages",
  },

  // Testimonials
  {
    id: "testimonial-1",
    type: "testimonial",
    title: "Sarah Thompson Review",
    subtitle: "5 stars - Bedroom Renovation",
    description: "Outstanding craftsmanship and attention to detail",
    url: "/admin/testimonials",
  },
  {
    id: "testimonial-2",
    type: "testimonial",
    title: "James Mitchell Review",
    subtitle: "5 stars - Kitchen Redesign",
    description: "Exceeded all expectations",
    url: "/admin/testimonials",
  },
  {
    id: "testimonial-3",
    type: "testimonial",
    title: "Emma Richardson Review",
    subtitle: "5 stars - Media Wall",
    description: "Transformed our living space",
    url: "/admin/testimonials",
  },

  // Quick Actions / Pages
  {
    id: "page-dashboard",
    type: "project",
    title: "Dashboard",
    description: "View admin dashboard overview",
    url: "/admin/dashboard",
  },
  {
    id: "page-clients",
    type: "client",
    title: "Clients",
    description: "Manage all clients",
    url: "/admin/clients",
  },
  {
    id: "page-projects",
    type: "project",
    title: "Projects",
    description: "View and manage all projects",
    url: "/admin/projects",
  },
  {
    id: "page-invoices",
    type: "invoice",
    title: "Invoices",
    description: "Manage invoices and payments",
    url: "/admin/invoices",
  },
  {
    id: "page-bookings",
    type: "booking",
    title: "Bookings",
    description: "View appointment calendar",
    url: "/admin/bookings",
  },
  {
    id: "page-messages",
    type: "message",
    title: "Messages",
    description: "View all conversations",
    url: "/admin/messages",
  },
  {
    id: "page-testimonials",
    type: "testimonial",
    title: "Testimonials",
    description: "Manage customer testimonials",
    url: "/admin/testimonials",
  },
  {
    id: "page-settings",
    type: "client",
    title: "Settings",
    description: "Admin panel settings",
    url: "/admin/settings",
  },
];

/**
 * Fuzzy search function - matches if all characters of query appear in order in the text
 */
export function fuzzyMatch(text: string, query: string): boolean {
  const lowerText = text.toLowerCase();
  const lowerQuery = query.toLowerCase();

  let queryIndex = 0;
  for (let i = 0; i < lowerText.length && queryIndex < lowerQuery.length; i++) {
    if (lowerText[i] === lowerQuery[queryIndex]) {
      queryIndex++;
    }
  }

  return queryIndex === lowerQuery.length;
}

/**
 * Search through all data with fuzzy matching
 */
export function searchData(query: string): SearchResult[] {
  if (!query.trim()) {
    return [];
  }

  return searchableData.filter((item) => {
    const searchableText = `${item.title} ${item.subtitle || ""} ${item.description || ""}`;
    return fuzzyMatch(searchableText, query);
  });
}
