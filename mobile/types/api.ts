export interface AuthResponse {
  access_token: string;
}

export interface ApiErrorBody {
  statusCode: number;
  message: string | string[];
  error?: string;
}
