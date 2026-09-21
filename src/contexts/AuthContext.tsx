import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import type { RoleCode, UserProfile } from '../types/domain';

interface AuthValue { user:UserProfile|null; loading:boolean; mode:'demo'|'supabase'; loginDemo:(r:RoleCode)=>void; loginWithPassword:(e:string,p:string)=>Promise<void>; logout:()=>Promise<void>; }
const AuthContext=createContext<AuthValue|undefined>(undefined);
const requested=(import.meta.env.VITE_DATA_MODE ?? 'demo') as 'demo'|'supabase';
const mode: 'demo'|'supabase' = requested==='supabase' && isSupabaseConfigured ? 'supabase':'demo';
const names:Record<RoleCode,string>={admin:'Administrador Cronos',gestor:'Gestor Prime Tech',atendimento:'Atendimento Prime Tech',comercial:'Comercial Prime Tech',tecnico:'Técnico Prime Tech',estoque:'Estoque Prime Tech',financeiro:'Financeiro Prime Tech',fiscal:'Fiscal Prime Tech'};
export function AuthProvider({children}:{children:ReactNode}){
 const [user,setUser]=useState<UserProfile|null>(()=>{if(mode!=='demo')return null;const raw=localStorage.getItem('cronos-user');return raw?JSON.parse(raw):null});
 const [loading,setLoading]=useState(mode==='supabase');
 useEffect(()=>{if(mode!=='supabase'||!supabase)return;let alive=true;const hydrate=async()=>{const {data}=await supabase.auth.getSession();const au=data.session?.user;if(!au){if(alive){setUser(null);setLoading(false)};return}const {data:profile}=await supabase.from('profiles').select('*').eq('id',au.id).single();if(profile&&alive){setUser(profile as UserProfile);setLoading(false)}};void hydrate();const {data:l}=supabase.auth.onAuthStateChange(()=>void hydrate());return()=>{alive=false;l.subscription.unsubscribe()}},[]);
 const value=useMemo<AuthValue>(()=>({user,loading,mode,loginDemo(role){const next:UserProfile={id:`demo-${role}`,full_name:names[role],role_code:role,active:true};localStorage.setItem('cronos-user',JSON.stringify(next));setUser(next)},async loginWithPassword(email,password){if(!supabase)throw new Error('Supabase não configurado');const {error}=await supabase.auth.signInWithPassword({email,password});if(error)throw error},async logout(){if(mode==='supabase'&&supabase)await supabase.auth.signOut();localStorage.removeItem('cronos-user');setUser(null)}}),[user,loading]);
 return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
export function useAuth(){const c=useContext(AuthContext);if(!c)throw new Error('useAuth fora do provider');return c}
