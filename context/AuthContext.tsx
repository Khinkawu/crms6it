"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import {
    onAuthStateChanged,
    signInWithPopup,
    GoogleAuthProvider,
    signOut as firebaseSignOut,
    User
} from "firebase/auth";
import { auth, db } from "../lib/firebase";
import { doc, getDoc, setDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { UserRole } from "../types";

interface AuthContextType {
    user: User | null;
    role: UserRole | null;
    loading: boolean;
    signInWithGoogle: () => Promise<void>;
    signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
    user: null,
    role: null,
    loading: true,
    signInWithGoogle: async () => { },
    signOut: async () => { },
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
    const [user, setUser] = useState<User | null>(null);
    const [role, setRole] = useState<UserRole | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
            setLoading(true);
            if (currentUser) {
                // 1. Check Domain
                if (!currentUser.email?.endsWith("@tesaban6.ac.th")) {
                    await firebaseSignOut(auth);
                    setUser(null);
                    setRole(null);
                    alert("Access Restricted: Only @tesaban6.ac.th emails are allowed.");
                    setLoading(false);
                    return;
                }

                // 2. Fetch User Role from Firestore
                try {
                    const userRef = doc(db, "users", currentUser.uid);
                    const userSnap = await getDoc(userRef);

                    if (userSnap.exists()) {
                        // User exists, get role
                        const userData = userSnap.data();
                        setRole(userData.role as UserRole);

                        // Sync latest Google Profile data (Name & Photo)
                        if (currentUser.displayName !== userData.displayName || currentUser.photoURL !== userData.photoURL) {
                            await updateDoc(userRef, {
                                displayName: currentUser.displayName,
                                photoURL: currentUser.photoURL,
                                updatedAt: serverTimestamp()
                            });
                        }
                    } else {
                        // New user, create doc with default role 'user'
                        const defaultRole: UserRole = 'user';
                        await setDoc(userRef, {
                            uid: currentUser.uid,
                            email: currentUser.email,
                            displayName: currentUser.displayName,
                            photoURL: currentUser.photoURL,
                            role: defaultRole,
                            createdAt: serverTimestamp()
                        });
                        setRole(defaultRole);
                    }
                } catch (error) {
                    console.error("Error fetching user role:", error);
                    setRole('user'); // Fallback
                }

                setUser(currentUser);
            } else {
                setUser(null);
                setRole(null);
            }
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    const signInWithGoogle = async () => {
        try {
            const provider = new GoogleAuthProvider();
            await signInWithPopup(auth, provider);
            // The onAuthStateChanged listener will handle the domain check and role fetching
        } catch (error) {
            console.error("Error signing in with Google", error);
        }
    };

    const signOut = async () => {
        try {
            await firebaseSignOut(auth);
            setUser(null);
            setRole(null);
        } catch (error) {
            console.error("Error signing out", error);
        }
    };

    return (
        <AuthContext.Provider value={{ user, role, loading, signInWithGoogle, signOut }}>
            {children}
        </AuthContext.Provider>
    );
};
