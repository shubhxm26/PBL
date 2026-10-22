import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api, getStoredPersona, setStoredPersona } from '../services/api';

const PersonaContext = createContext(null);

import { FALLBACK_PROFILES } from '../constants/personaProfiles.js';
export { FALLBACK_PROFILES };

export function PersonaProvider({ children }) {
  const [currentRole, setCurrentRole] = useState(getStoredPersona());
  const [profile, setProfile] = useState(FALLBACK_PROFILES[getStoredPersona()] || FALLBACK_PROFILES.director);
  const [rolesMap, setRolesMap] = useState(FALLBACK_PROFILES);
  const [loading, setLoading] = useState(false);

  // Load roles & profile from backend
  const loadProfile = useCallback(async (role) => {
    setLoading(true);
    try {
      const data = await api.getPersonaProfile(role);
      setProfile(data);
    } catch {
      // Fallback gracefully
      if (FALLBACK_PROFILES[role]) {
        setProfile(FALLBACK_PROFILES[role]);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const loadAllRoles = useCallback(async () => {
    try {
      const data = await api.getPersonaRoles();
      if (data && data.profiles) {
        setRolesMap(data.profiles);
      }
    } catch {
      // Use fallback map
      setRolesMap(FALLBACK_PROFILES);
    }
  }, []);

  useEffect(() => {
    loadAllRoles();
    loadProfile(currentRole);
  }, [loadAllRoles, loadProfile, currentRole]);

  const switchPersona = (newRole) => {
    if (!newRole || newRole === currentRole) return;
    setStoredPersona(newRole);
    setCurrentRole(newRole);
    if (rolesMap[newRole]) {
      setProfile(rolesMap[newRole]);
    } else if (FALLBACK_PROFILES[newRole]) {
      setProfile(FALLBACK_PROFILES[newRole]);
    }
    loadProfile(newRole);
  };

  const canView = (viewName) => {
    if (currentRole === 'admin') return true;
    const views = profile?.permissions?.views || [];
    return views.includes('*') || views.includes(viewName);
  };

  const canPerform = (actionName) => {
    if (currentRole === 'admin') return true;
    const actions = profile?.permissions?.actions || [];
    return actions.includes('*') || actions.includes(actionName);
  };

  const canDo = canPerform;

  return (
    <PersonaContext.Provider value={{
      currentRole,
      profile,
      rolesMap,
      switchPersona,
      canView,
      canPerform,
      canDo,
      loading
    }}>
      {children}
    </PersonaContext.Provider>
  );
}

export function usePersona() {
  const context = useContext(PersonaContext);
  if (!context) {
    throw new Error('usePersona must be used within a PersonaProvider');
  }
  return context;
}
