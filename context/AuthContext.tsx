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
import { doc, getDoc, setDoc, updateDoc, serverTimestamp, onSnapshot } from "firebase/firestore";
import { UserRole } from "../types";

interface AuthContextType {
    user: User | null;
    role: UserRole | null;
    isPhotographer: boolean;
    loading: boolean;
    signInWithGoogle: () => Promise<void>;
    signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
    user: null,
    role: null,
    isPhotographer: false,
    loading: true,
    signInWithGoogle: async () => { },
    signOut: async () => { },
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
    const [user, setUser] = useState<User | null>(null);
    const [role, setRole] = useState<UserRole | null>(null);
    const [isPhotographer, setIsPhotographer] = useState(false);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let unsubscribeUser: (() => void) | null = null;

        const unsubscribeAuth = onAuthStateChanged(auth, async (currentUser) => {
            // Cleanup previous user listener
            if (unsubscribeUser) {
                unsubscribeUser();
                unsubscribeUser = null;
            }

            setLoading(true);
            if (currentUser) {
                // 1. Check Domain
                if (!currentUser.email?.endsWith("@tesaban6.ac.th")) {
                    await firebaseSignOut(auth);
                    setUser(null);
                    setRole(null);
                    setIsPhotographer(false);
                    alert("Access Restricted: Only @tesaban6.ac.th emails are allowed.");
                    setLoading(false);
                    return;
                }

                // 2. Setup realtime listener for user document
                const userRef = doc(db, "users", currentUser.uid);

                try {
                    const userSnap = await getDoc(userRef);

                    if (!userSnap.exists()) {
                        // New user, create doc with default role 'user'
                        const defaultRole: UserRole = 'user';
                        await setDoc(userRef, {
                            uid: currentUser.uid,
                            email: currentUser.email,
                            displayName: currentUser.displayName,
                            photoURL: currentUser.photoURL,
                            role: defaultRole,
                            isPhotographer: false,
                            createdAt: serverTimestamp()
                        });
                    } else {
                        // Sync latest Google Profile data (Name & Photo)
                        const userData = userSnap.data();
                        if (currentUser.displayName !== userData.displayName || currentUser.photoURL !== userData.photoURL) {
                            await updateDoc(userRef, {
                                displayName: currentUser.displayName,
                                photoURL: currentUser.photoURL,
                                updatedAt: serverTimestamp()
                            });
                        }
                    }
                } catch (error) {
                    console.error("Error setting up user doc:", error);
                }

                // 3. Subscribe to realtime updates
                unsubscribeUser = onSnapshot(userRef, (docSnap) => {
                    if (docSnap.exists()) {
                        const userData = docSnap.data();
                        setRole(userData.role as UserRole);
                        setIsPhotographer(userData.isPhotographer || false);
                    } else {
                        setRole('user');
                        setIsPhotographer(false);
                    }
                    setLoading(false);
                }, (error) => {
                    console.error("Error listening to user doc:", error);
                    setRole('user');
                    setIsPhotographer(false);
                    setLoading(false);
                });

                setUser(currentUser);
            } else {
                setUser(null);
                setRole(null);
                setIsPhotographer(false);
                setLoading(false);
            }
        });

        return () => {
            unsubscribeAuth();
            if (unsubscribeUser) {
                unsubscribeUser();
            }
        };
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
            setIsPhotographer(false);
        } catch (error) {
            console.error("Error signing out", error);
        }
    };

    return (
        <AuthContext.Provider value={{ user, role, isPhotographer, loading, signInWithGoogle, signOut }}>
            {children}
        </AuthContext.Provider>
    );
};
