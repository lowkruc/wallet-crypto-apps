export interface AuthResponse {
  accessToken: string;
  user: {
    id: string;
    email: string;
    name?: string | null;
    walletId: string;
  };
}
