export interface AvailabilityLock {
  acquire(roomId: string, from: Date, to: Date): Promise<boolean>;
}
