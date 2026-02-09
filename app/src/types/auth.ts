import type { User } from './domain';

export interface LoginCredentials {
  email: string;
  password: string;
  schoolCode?: string;
}

export interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}
