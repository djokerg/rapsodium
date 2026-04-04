export interface AuthResponse {
  access_token: string;
}

export interface JwtPayload {
  sub: string;
}

export interface VerifiedJwtPayload extends JwtPayload {
  iat: number;
  exp: number;
}
