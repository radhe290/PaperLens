/* eslint-disable react/prop-types */
/* eslint-disable react-refresh/only-export-components */
import axios from "axios";
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import {
  fetchCurrentUser,
  loginUser,
  registerUser
} from "../services/authApi";

const TOKEN_STORAGE_KEY = "paperlens.authToken";
const USER_STORAGE_KEY = "paperlens.currentUser";

const AuthContext = createContext(null);

function applyAuthToken(token) {
  if (token) {
    axios.defaults.headers.common.Authorization = `Bearer ${token}`;
  } else {
    delete axios.defaults.headers.common.Authorization;
  }
}

function readStoredUser() {
  try {
    const storedUser = window.localStorage.getItem(USER_STORAGE_KEY);
    return storedUser ? JSON.parse(storedUser) : null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() =>
    window.localStorage.getItem(TOKEN_STORAGE_KEY)
  );
  const [user, setUser] = useState(readStoredUser);
  const [isAuthLoading, setIsAuthLoading] = useState(Boolean(token));
  const [authMessage, setAuthMessage] = useState(null);

  const persistSession = useCallback((nextUser, nextToken) => {
    setUser(nextUser);
    setToken(nextToken);
    applyAuthToken(nextToken);
    window.localStorage.setItem(TOKEN_STORAGE_KEY, nextToken);
    window.localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(nextUser));
  }, []);

  const clearSession = useCallback((message = "") => {
    setUser(null);
    setToken("");
    applyAuthToken("");
    window.localStorage.removeItem(TOKEN_STORAGE_KEY);
    window.localStorage.removeItem(USER_STORAGE_KEY);

    if (message) {
      setAuthMessage({ id: Date.now(), message });
    }
  }, []);

  const register = useCallback(
    async (payload) => {
      const result = await registerUser(payload);
      persistSession(result.user, result.token);
      return result.user;
    },
    [persistSession]
  );

  const login = useCallback(
    async (payload) => {
      const result = await loginUser(payload);
      persistSession(result.user, result.token);
      return result.user;
    },
    [persistSession]
  );

  const logout = useCallback(() => {
    clearSession("Logged out successfully.");
  }, [clearSession]);

  const consumeAuthMessage = useCallback(() => {
    setAuthMessage(null);
  }, []);

  useEffect(() => {
    applyAuthToken(token);

    if (!token) {
      setIsAuthLoading(false);
      return undefined;
    }

    const controller = new AbortController();

    async function restoreSession() {
      try {
        const currentUser = await fetchCurrentUser({ signal: controller.signal });
        setUser(currentUser);
        window.localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(currentUser));
      } catch (error) {
        if (error?.code !== "ERR_CANCELED") {
          clearSession("Session expired.");
        }
      } finally {
        setIsAuthLoading(false);
      }
    }

    restoreSession();

    return () => controller.abort();
  }, [clearSession, token]);

  useEffect(() => {
    const interceptorId = axios.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401 && token) {
          clearSession(error.response?.data?.error || "Session expired.");
        }

        return Promise.reject(error);
      }
    );

    return () => axios.interceptors.response.eject(interceptorId);
  }, [clearSession, token]);

  return (
    <AuthContext.Provider
      value={{
        authMessage,
        consumeAuthMessage,
        isAuthenticated: Boolean(user && token),
        isAuthLoading,
        login,
        logout,
        register,
        token,
        user
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used within AuthProvider.");
  }

  return context;
}
