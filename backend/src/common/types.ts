export interface RequestWithUser {
  headers: { authorization?: string };
  user: { id: string };
}
