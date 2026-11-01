import { createContext,useContext } from 'react';
import type { Role,Session } from '../../types';
import type { ApiClient } from '../../services/api';
export interface AuthState {session:Session|null;token:string}
export interface AuthValue extends AuthState {api:ApiClient;login:(token:string)=>Promise<Session>;demo:(role:Role)=>void;logout:()=>void}
export const AuthContext=createContext<AuthValue|null>(null);
export function useAuth(){const value=useContext(AuthContext);if(!value)throw new Error('AuthProvider missing');return value;}
