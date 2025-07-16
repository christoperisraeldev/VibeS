import { useState, useEffect, useCallback } from 'react';
import { database, auth, Profile, initAuthState } from '@/lib/firebaseClient';
import { ref, get, update, onValue } from 'firebase/database';
import { User as FirebaseUser } from 'firebase/auth';

export default function useUserProfile() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch user profile
  const fetchProfile = useCallback(async (user: FirebaseUser) => {
    setLoading(true);
    setError(null);
    
    try {
      const profileRef = ref(database, `profiles/${user.uid}`);
      const snapshot = await get(profileRef);
      
      if (snapshot.exists()) {
        setProfile(snapshot.val());
      } else {
        setProfile(null);
      }
    } catch (err) {
      console.error('Error fetching profile:', err);
      setError(err instanceof Error ? err.message : 'Failed to load profile');
    } finally {
      setLoading(false);
    }
  }, []);

  // Update user profile
  const updateProfile = useCallback(async (updates: Partial<Profile>) => {
    const user = auth.currentUser;
    if (!user) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const profileRef = ref(database, `profiles/${user.uid}`);
      await update(profileRef, updates);
      setProfile(prev => ({ ...prev!, ...updates }));
    } catch (err) {
      console.error('Error updating profile:', err);
      setError(err instanceof Error ? err.message : 'Failed to update profile');
    } finally {
      setLoading(false);
    }
  }, []);

  // Set up real-time subscription
  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;

    const profileRef = ref(database, `profiles/${user.uid}`);
    const unsubscribe = onValue(profileRef, (snapshot) => {
      if (snapshot.exists()) {
        setProfile(snapshot.val());
      }
    });

    return () => unsubscribe();
  }, []);

  // Initialize auth state listener
  useEffect(() => {
    const unsubscribe = initAuthState((user) => {
      if (user) {
        fetchProfile(user);
      } else {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [fetchProfile]);

  return {
    profile,
    loading,
    error,
    updateProfile,
    refreshProfile: () => {
      const user = auth.currentUser;
      if (user) fetchProfile(user);
    }
  };
}