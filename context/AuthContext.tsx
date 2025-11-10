import React, { createContext, useContext, useState, useEffect } from 'react';
import type { User } from '../types';
import { useLocalStorage } from '../hooks/useLocalStorage';

// Master admin credentials
const MASTER_ADMIN_USERNAME = 'Sameem';
const MASTER_ADMIN_PASSWORD = 'nazia123!';
const MASTER_ADMIN_ID = 'master-admin';

interface AuthContextType {
    currentUser: User | null;
    users: User[];
    login: (username: string, password: string) => Promise<void>;
    logout: () => void;
    updateUsersAndPersist: (users: User[]) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [storedUsers, setStoredUsers] = useLocalStorage<User[]>('users', []);
    const [currentUser, setCurrentUser] = useState<User | null>(null);

    // Seed master admin if no users exist
    useEffect(() => {
        if (storedUsers.length === 0) {
            const masterAdmin: User = {
                id: MASTER_ADMIN_ID,
                username: MASTER_ADMIN_USERNAME,
                password: MASTER_ADMIN_PASSWORD, // In a real app, this would be hashed
                role: 'admin',
            };
            setStoredUsers([masterAdmin]);
        }
    }, [storedUsers, setStoredUsers]);

    const login = async (username: string, password: string): Promise<void> => {
        const user = storedUsers.find(
            u => u.username === username && u.password === password
        );

        if (user) {
            setCurrentUser(user);
        } else {
            throw new Error('Invalid username or password');
        }
    };

    const logout = () => {
        setCurrentUser(null);
    };
    
    const updateUsersAndPersist = (updatedUsers: User[]) => {
        setStoredUsers(updatedUsers);
    };

    const value = {
        currentUser,
        users: storedUsers,
        login,
        logout,
        updateUsersAndPersist,
    };

    return (
        <AuthContext.Provider value={value}>
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