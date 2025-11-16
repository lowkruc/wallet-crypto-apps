export interface AuthResponse {
  accessToken: string;
  user: {
    id: string;
    email: string;
    username: string;
    name?: string | null;
    walletId: string;
  };
}
