export interface NotificationMessage { to: string; subject: string; body: string; metadata?: Record<string, string> }
export interface NotificationAdapter { send(message: NotificationMessage): Promise<{ id: string; accepted: boolean }> }
/** Records notifications for the demo; production adapters can target email, Teams or Slack. */
export class MockNotificationAdapter implements NotificationAdapter {
  readonly outbox: Array<NotificationMessage & { id: string; sentAt: string }> = [];
  async send(message: NotificationMessage) { const id = `note_${this.outbox.length + 1}`; this.outbox.push({ ...message, id, sentAt: new Date().toISOString() }); return { id, accepted: true } }
}
