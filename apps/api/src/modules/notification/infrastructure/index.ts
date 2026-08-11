export interface Mailer {
  send(input: { to: string; subject: string; html: string }): Promise<void>;
}
