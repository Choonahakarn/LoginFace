/**
 * Authentication Hook สำหรับ Supabase Auth
 * จัดการการล็อกอิน, สมัครสมาชิก, และ session
 */
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import type { User, Session } from '@supabase/supabase-js';

export interface AuthUser {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  avatarUrl?: string;
  role?: string;
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    let mounted = true;
    let timeoutId: NodeJS.Timeout;
    let loadingProfile = false; // ป้องกันการเรียก loadUserProfile ซ้ำ

    // ตั้ง timeout เพื่อป้องกัน loading นานเกินไป (เพิ่มเป็น 3 วินาที)
    timeoutId = setTimeout(() => {
      if (mounted) {
        console.warn('Auth loading timeout - forcing loading to false');
        setLoading(false);
        loadingProfile = false;
      }
    }, 3000); // 3 วินาที

    // ตรวจสอบ session ปัจจุบัน
    const checkSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (!mounted) return;
        
        if (error) {
          console.error('Error getting session:', error);
          clearTimeout(timeoutId);
          setSession(null);
          setUser(null);
          setAuthUser(null);
          setLoading(false);
          return;
        }
        
        // ตรวจสอบว่า session ยัง valid หรือไม่
        if (session && session.expires_at) {
          const expiresAt = session.expires_at * 1000; // Convert to milliseconds
          const now = Date.now();
          if (now >= expiresAt) {
            console.log('Session expired - clearing');
            await supabase.auth.signOut();
            setSession(null);
            setUser(null);
            setAuthUser(null);
            clearTimeout(timeoutId);
            setLoading(false);
            return;
          }
        }
        
        setSession(session);
        setUser(session?.user ?? null);
        
        console.log('Session check result:', { hasSession: !!session, hasUser: !!session?.user, expiresAt: session?.expires_at });
        
        if (session?.user) {
          // Set authUser จาก metadata ทันที (ไม่รอ database query)
          setAuthUser({
            id: session.user.id,
            email: session.user.email || '',
            firstName: session.user.user_metadata?.first_name,
            lastName: session.user.user_metadata?.last_name,
            avatarUrl: session.user.user_metadata?.avatar_url,
          });
          
          // Set loading = false ทันที (user พร้อมใช้งานแล้ว)
          clearTimeout(timeoutId);
          setLoading(false);
          
          // Load profile จาก database แบบ async (ไม่ blocking)
          loadingProfile = true;
          setTimeout(async () => {
            try {
              const { data, error } = await supabase
                .from('user_profiles')
                .select('*')
                .eq('id', session.user.id)
                .single();

              if (data && !error && mounted) {
                setAuthUser({
                  id: data.id,
                  email: data.email,
                  firstName: data.first_name,
                  lastName: data.last_name,
                  avatarUrl: data.avatar_url,
                  role: data.role,
                });
              }
            } catch (dbError: any) {
              if (dbError?.code !== 'PGRST116' && dbError?.message !== 'requested path is invalid') {
                console.warn('Database query failed (using metadata instead):', dbError);
              }
            } finally {
              loadingProfile = false;
            }
          }, 0);
        } else {
          console.log('No session found - setting loading to false');
          clearTimeout(timeoutId);
          setLoading(false);
        }
      } catch (error) {
        console.error('Error getting session:', error);
        if (mounted) {
          clearTimeout(timeoutId);
          setSession(null);
          setUser(null);
          setAuthUser(null);
          setLoading(false);
          loadingProfile = false;
        }
      }
    };

    checkSession();

    // ฟังการเปลี่ยนแปลง auth state
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return;
      
      console.log('Auth state changed:', event, { hasSession: !!session, hasUser: !!session?.user });
      
      // ถ้าเป็น SIGNED_OUT event ให้ clear ทุกอย่าง
      if (event === 'SIGNED_OUT') {
        console.log('SIGNED_OUT event received - clearing all state');
        setSession(null);
        setUser(null);
        setAuthUser(null);
        clearTimeout(timeoutId);
        if (mounted) {
          setLoading(false);
        }
        // Force redirect to login after state is cleared
        setTimeout(() => {
          window.location.href = window.location.origin;
        }, 100);
        return;
      }
      
      // Set user และ session ก่อน load profile
      setSession(session);
      setUser(session?.user ?? null);
      
      if (session?.user) {
        // Set authUser จาก metadata ทันที (ไม่รอ database query)
        setAuthUser({
          id: session.user.id,
          email: session.user.email || '',
          firstName: session.user.user_metadata?.first_name,
          lastName: session.user.user_metadata?.last_name,
          avatarUrl: session.user.user_metadata?.avatar_url,
        });
        
        // Set loading = false ทันที (user พร้อมใช้งานแล้ว)
        clearTimeout(timeoutId);
        if (mounted) {
          setLoading(false);
        }
        
        // Load profile จาก database แบบ async (ไม่ blocking)
        if (!loadingProfile) {
          loadingProfile = true;
          // ใช้ setTimeout เพื่อไม่ block UI
          setTimeout(async () => {
            try {
              const { data, error } = await supabase
                .from('user_profiles')
                .select('*')
                .eq('id', session.user.id)
                .single();

              if (data && !error && mounted) {
                setAuthUser({
                  id: data.id,
                  email: data.email,
                  firstName: data.first_name,
                  lastName: data.last_name,
                  avatarUrl: data.avatar_url,
                  role: data.role,
                });
              }
            } catch (dbError: any) {
              if (dbError?.code !== 'PGRST116' && dbError?.message !== 'requested path is invalid') {
                console.warn('Database query failed (using metadata instead):', dbError);
              }
            } finally {
              loadingProfile = false;
            }
          }, 0);
        }
      } else {
        setAuthUser(null);
        clearTimeout(timeoutId);
        if (mounted) {
          setLoading(false);
        }
      }
    });

    return () => {
      mounted = false;
      clearTimeout(timeoutId);
      subscription.unsubscribe();
    };
  }, []);


  const signOut = async () => {
    // Clear React state immediately (no sensitive data left in memory)
    setUser(null);
    setSession(null);
    setAuthUser(null);
    setLoading(false);

    // ลบ session/token ทั้งหมดออกจาก browser — ป้องกันข้อมูลค้างหลัง logout
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch (e) {
      console.error('Error clearing storage on signOut:', e);
    }

    // แจ้ง Supabase ให้ invalidate session (รันในพื้นหลัง)
    supabase.auth.signOut().catch(() => {});

    // Redirect ไปหน้า login ทันที (หน้าที่โหลดใหม่จะไม่มี session)
    window.location.href = window.location.origin;
  };

  return {
    user,
    session,
    authUser,
    loading,
    isAuthenticated: !!user,
    signOut,
  };
}
