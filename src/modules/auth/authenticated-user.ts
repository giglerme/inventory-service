export type AuthenticatedUser = {
  sub: string;
  email?: string;
  roles: string[];
  issuer?: string;
  audience?: string | string[];
  kid?: string;
};
