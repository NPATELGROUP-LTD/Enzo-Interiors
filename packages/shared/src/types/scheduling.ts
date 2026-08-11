import type { BookingStatus, ISODateString, ServiceType, UUID } from './common';

export interface Booking {
  id: UUID;
  clientId: UUID;
  serviceType: ServiceType;
  dateTime: ISODateString;
  status: BookingStatus;
  linkedQuoteId: UUID | null;
  createdAt: ISODateString;
}

export interface AvailabilitySettings {
  id: UUID;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  slotDurationMins: number;
  isClosed: boolean;
}
