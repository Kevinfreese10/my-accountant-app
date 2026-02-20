'use client';
import { createContext, useState, useContext, ReactNode, useEffect } from 'react';
import type { User } from '@/lib/types';
import { useRouter } from 'next/navigation';
import { getFirestore, collection, query, where, getDocs, doc, setDoc, updateDoc, getDoc, serverTimestamp, writeBatch } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, User as FirebaseUser, signOut, reauthenticateWithCredential, EmailAuthProvider } from 'firebase/auth';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError, type SecurityRuleContext } from '@/firebase/errors';
import { isPast } from 'date-fns';

const db = getFirestore(firebaseApp);
const auth = getAuth(firebaseApp);

interface AuthContextType {
  user: User | null;
  login: (email: string, password?: string) => Promise<User | 'invalid_role' | 'invalid_credentials' | 'subscription_lapsed' | undefined>;
  reauthenticate: (firebaseUser: FirebaseUser) => Promise<User | 'invalid_credentials' | 'subscription_lapsed' | undefined>;
  logout: () => void;
  signup: (values: { name: string; surname: string; cellNumber: string; email: string; password?: string }) => Promise<User | string>;
  updateUser: (updatedUser: User | null) => void;
  isAuthenticated: boolean | undefined;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | undefined>(undefined);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
        if (firebaseUser) {
            if (user && firebaseUser.uid === user.uid) {
                if (isAuthenticated === false) setIsAuthenticated(true);
                return;
            }
            await reauthenticate(firebaseUser);
        } else {
            updateUser(null);
            setIsAuthenticated(false);
        }
    });

    return () => unsubscribe();
  }, []);
  
  const updateUser = (updatedUser: User | null) => {
    setUser(updatedUser);
    if (updatedUser) {
        localStorage.setItem('my-accountant-user', JSON.stringify(updatedUser));
    } else {
        localStorage.removeItem('my-accountant-user');
    }
  }

  const login = async (email: string, password?: string): Promise<User | 'invalid_role' | 'invalid_credentials' | 'subscription_lapsed' | undefined> => {
    if (!password) return 'invalid_credentials';
    try {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        return await reauthenticate(userCredential.user);
    } catch (error: any) {
        const expectedAuthErrors = ['auth/user-not-found', 'auth/wrong-password', 'auth/invalid-credential'];
        if (error.code && !expectedAuthErrors.includes(error.code) && error.code !== 'permission-denied') { 
             console.error("Error logging in:", error.code, error.message);
        }

        if (expectedAuthErrors.includes(error.code)) {
             return 'invalid_credentials';
        }
        return undefined;
    }
  };

  const reauthenticate = async (firebaseUser: FirebaseUser): Promise<User | 'invalid_credentials' | 'subscription_lapsed' | undefined> => {
        if (!firebaseUser.email) return 'invalid_credentials';
        
        try {
            const collectionsToTry = ['users', 'aiAccountantClients', 'adminClients', 'partnerClients'];
            let foundUser: User | null = null;
            
            for (const collectionName of collectionsToTry) {
                const userDocRef = doc(db, collectionName, firebaseUser.uid);
                const userDocSnap = await getDoc(userDocRef);
                if (userDocSnap.exists()) {
                    foundUser = { ...userDocSnap.data(), id: userDocSnap.id, uid: userDocSnap.id } as User;
                    break;
                }
            }

            if (foundUser) {
                if (foundUser.source === 'AI Accountant' && foundUser.subscription) {
                    const endDate = foundUser.subscription.subscriptionEndDate?.toDate();
                    if (endDate && isPast(endDate) && foundUser.subscription.subscriptionStatus !== 'active') {
                        setUser(foundUser); 
                        return 'subscription_lapsed';
                    }
                }
                 updateUser(foundUser);
                 setIsAuthenticated(true);
                 return foundUser;
            } else {
                console.warn(`User document not found for UID: ${firebaseUser.uid} in any collection.`)
                await signOut(auth);
                return 'invalid_credentials';
            }

        } catch (serverError: any) {
            if (serverError.code === 'permission-denied') {
                const permissionError = new FirestorePermissionError({
                    path: `users/${firebaseUser.uid}`,
                    operation: 'get',
                } satisfies SecurityRuleContext);
                errorEmitter.emit('permission-error', permissionError);
            }
             console.error("Error re-authenticating:", serverError);
             return undefined;
        }
  }

  const logout = () => {
    signOut(auth);
    updateUser(null);
    setIsAuthenticated(false);
  };

  const signup = async (values: { name: string; surname: string; cellNumber: string; email: string; password?: string }): Promise<User | string> => {
    if (!values.password) return 'Password is required.';

    try {
        const q = query(collection(db, "users"), where("email", "==", values.email));
        const existingUserSnapshot = await getDocs(q);
        if (!existingUserSnapshot.empty) {
            return 'An account with this email already exists.';
        }

        const userCredential = await createUserWithEmailAndPassword(auth, values.email, values.password);
        const firebaseUser = userCredential.user;

        const newUserDocRef = doc(db, "users", firebaseUser.uid);
        const newUser: User = {
            id: firebaseUser.uid,
            uid: firebaseUser.uid,
            name: `${values.name} ${values.surname}`,
            email: values.email,
            contactNumber: values.cellNumber,
            role: 'client',
            createdAt: serverTimestamp(),
        };

        await setDoc(newUserDocRef, newUser);
        updateUser(newUser);
        setIsAuthenticated(true);
        
        const ordersRef = collection(db, "orders");
        const batch = writeBatch(db);
        let linkCount = 0;

        const q1 = query(ordersRef, where("customerEmail", "==", values.email), where("userId", "==", null));
        const snap1 = await getDocs(q1);
        snap1.forEach(orderDoc => {
            batch.update(orderDoc.ref, { userId: firebaseUser.uid });
            linkCount++;
        });

        const q2 = query(ordersRef, where("endCustomerEmail", "==", values.email), where("userId", "==", null));
        const snap2 = await getDocs(q2);
        snap2.forEach(orderDoc => {
            batch.update(orderDoc.ref, { userId: firebaseUser.uid });
            linkCount++;
        });

        if (linkCount > 0) {
            await batch.commit();
        }

        return newUser;
    } catch (error: any) {
        console.error("Error signing up:", error);
        if (error.code === 'auth/email-already-in-use') {
            return 'An account with this email already exists in our authentication system, but not in our database. Please contact support.';
        }
        return 'An unexpected error occurred during signup.';
    }
  };
  
  return (
    <AuthContext.Provider value={{ user, login, reauthenticate, logout, signup, updateUser, isAuthenticated }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const ProtectedRoute = ({ children }: { children: ReactNode }) => {
  const { isAuthenticated } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isAuthenticated === false) {
      router.push('/login');
    }
  }, [isAuthenticated, router]);
  
  if(isAuthenticated === false) return null;
  if(isAuthenticated === true) return <>{children}</>;
  return null;
}