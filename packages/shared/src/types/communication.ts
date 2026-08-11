import type { ISODateString, SenderType, UUID } from './common';

export interface Conversation {
  id: UUID;
  clientId: UUID;
  createdAt: ISODateString;
}

export interface Message {
  id: UUID;
  conversationId: UUID;
  senderId: UUID;
  senderType: SenderType;
  body: string;
  attachments: string[] | null;
  readAt: ISODateString | null;
  createdAt: ISODateString;
}

export interface SavedReplyTemplate {
  id: UUID;
  /** null = shared/global template */
  staffId: UUID | null;
  title: string;
  body: string;
}

export interface NotificationPreference {
  id: UUID;
  ownerId: UUID;
  ownerType: SenderType;
  emailEnabled: boolean;
  smsEnabled: boolean;
  inAppEnabled: boolean;
}
