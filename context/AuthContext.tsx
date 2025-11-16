
import React, { createContext, useContext, useEffect, useState } from 'react';
import type { User } from '../types';
import { supabase } from '../services/supabaseClient';

// Master admin credentials (fallback/seed)
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
    const [users, setUsers] = useState<User[]>([]);
    const [currentUser, setCurrentUser] = useState<User | null>(null);

    // Load users and handle seed
    useEffect(() => {
        const fetchUsers = async () => {
            try {
                const { data, error } = await supabase.from('app_users').select('*');
                
                if (error) {
                    // Improved logging to show the actual error object in console
                    console.error('Error fetching users from Supabase:', JSON.stringify(error, null, 2));
                    if (error.code === '42P01') {
                        console.error("Creating 'app_users' table might be required. Check your Supabase SQL Editor.");
                    }
                    return;
                }

                if (!data || data.length === 0) {
                    // Seed master admin
                    const masterAdmin: User = {
                        id: MASTER_ADMIN_ID,
                        username: MASTER_ADMIN_USERNAME,
                        password: MASTER_ADMIN_PASSWORD,
                        role: 'admin',
                    };
                    
                    // Try to insert master admin. This might fail if connection is bad, but we try.
                    const { error: insertError } = await supabase.from('app_users').insert(masterAdmin);
                    if (insertError) {
                        console.error('Error seeding master admin:', JSON.stringify(insertError, null, 2));
                    }
                    
                    setUsers([masterAdmin]);
                } else {
                    setUsers(data);
                }
            } catch (err) {
                console.error('Unexpected error in fetchUsers:', err);
            }
        };

        fetchUsers();

        // Check for existing session in localStorage just for convenience of refresh
        const storedUser = localStorage.getItem('currentUser');
        if (storedUser) {
            setCurrentUser(JSON.parse(storedUser));
        }
    }, []);

    const login = async (username: string, password: string): Promise<void> => {
        // Verify against Supabase
        const { data, error } = await supabase
            .from('app_users')
            .select('*')
            .eq('username', username)
            .eq('password', password)
            .single();

        if (error || !data) {
            console.error("Login error details:", error ? JSON.stringify(error, null, 2) : "No data returned");
            throw new Error('Invalid username or password');
        }

        setCurrentUser(data);
        localStorage.setItem('currentUser', JSON.stringify(data));
    };

    const logout = () => {
        setCurrentUser(null);
        localStorage.removeItem('currentUser');
    };
    
    const updateUsersAndPersist = async (updatedUsers: User[]) => {
        setUsers(updatedUsers);
        
        // We iterate and upsert.
        for (const user of updatedUsers) {
             const { error } = await supabase.from('app_users').upsert(user);
             if (error) {
                 console.error('Error upserting user:', user.username, JSON.stringify(error, null, 2));
             }
        }
    };

    const value = {
        currentUser,
        users,
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
