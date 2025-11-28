"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import {
    User,
    GoogleAuthProvider,
    signInWithPopup,
    signOut as firebaseSignOut,
    onAuthStateChanged,
} from "firebase/auth";
import { auth } from "../lib/firebase";

interface AuthContextType {
    user: User | null;
    loading: boolean;
    signInWithGoogle: () => Promise<void>;
    signOut: () => Promise<void>;
    error: string | null;
    clearError: () => void;
}

const AuthContext = createContext<AuthContextType>({
    user: null,
    loading: true,
    signInWithGoogle: async () => { },
    signOut: async () => { },
    error: null,
    clearError: () => { },
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
            setLoading(true);
            if (currentUser) {
                // Domain Restriction Check
                if (currentUser.email?.endsWith("@tesaban6.ac.th")) {
                    setUser(currentUser);
                    setError(null);
                } else {
                    // Unauthorized domain
                    await firebaseSignOut(auth);
                    setUser(null);
                    setError("Access Restricted: Only @tesaban6.ac.th emails are allowed.");
                }
            } else {
                setUser(null);
            }
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    const signInWithGoogle = async () => {
        setError(null);
        const provider = new GoogleAuthProvider();
        try {
            await signInWithPopup(auth, provider);
            // The onAuthStateChanged listener will handle the domain check
        } catch (err: any) {
            console.error("Login failed", err);
            setError(err.message || "Failed to sign in with Google.");
        }
    };

    const signOut = async () => {
        try {
            await firebaseSignOut(auth);
            setUser(null);
        } catch (err: any) {
            console.error("Logout failed", err);
        }
    };

    const clearError = () => setError(null);

    return (
        <AuthContext.Provider
            value={{ user, loading, signInWithGoogle, signOut, error, clearError }}
        >
            {children}
        </AuthContext.Provider>
    );
};
