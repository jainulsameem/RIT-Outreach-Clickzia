
import React, { createContext, useContext, useEffect, useState } from 'react';
import type { User } from '../types';
import { supabase } from '../services/supabaseClient';

// Master admin credentials (fallback/seed)
const MASTER_ADMIN_USERNAME = 'Sameem';
const MASTER_ADMIN_PASSWORD = 'nazia123!';
const MASTER_ADMIN_ID = 'master-admin';
const DEFAULT_ORG_ID = 'org-default';

// Default tools for new users if not specified
const DEFAULT_TOOLS = ['hub', 'search', 'crm-list', 'email-campaign', 'time-tracking'];

interface AuthContextType {
    currentUser: User | null;
    users: User[];
    login: (username: string, password: string) => Promise<void>;
    logout: () => void;
    updateUsersAndPersist: (users: User[]) => void;
    switchOrganization: (orgId: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [users, setUsers] = useState<User[]>([]);
    const [currentUser, setCurrentUser] = useState<User | null>(null);

    const fetchOrgUsers = async (orgId: string) => {
        try {
            const { data, error } = await supabase
                .from('app_users')
                .select('*')
                .eq('organization_id', orgId);
            
            if (error) {
                console.error('Error fetching org users:', error);
                return;
            }
            
            if (data) {
                // Normalize allowed_tools from DB (which might be null)
                const normalizedUsers = data.map((u: any) => ({
                    ...u,
                    organizationId: u.organization_id, // Map DB column to TS prop
                    allowedTools: u.allowed_tools || DEFAULT_TOOLS
                }));
                setUsers(normalizedUsers);
            } else {
                setUsers([]);
            }
        } catch (err) {
            console.error('Error in fetchOrgUsers:', err);
        }
    };

    // Initialize session from local storage
    useEffect(() => {
        const storedUser = localStorage.getItem('currentUser');
        if (storedUser) {
            const user = JSON.parse(storedUser);
            setCurrentUser(user);
            if (user.organizationId) {
                fetchOrgUsers(user.organizationId);
            }
        }
    }, []);

    const login = async (username: string, password: string): Promise<void> => {
        // 1. Check for Master Admin Seed Requirement
        // We attempt to fetch the specific user first
        let { data: user, error } = await supabase
            .from('app_users')
            .select('*')
            .eq('username', username)
            .eq('password', password)
            .maybeSingle();

        // If no user found, check if DB is empty (first run)
        if (!user) {
            const { count } = await supabase.from('app_users').select('*', { count: 'exact', head: true });
            if (count === 0 && username === MASTER_ADMIN_USERNAME && password === MASTER_ADMIN_PASSWORD) {
                 // Seed Master Admin & Default Org
                 const masterAdmin: any = {
                    id: MASTER_ADMIN_ID,
                    username: MASTER_ADMIN_USERNAME,
                    password: MASTER_ADMIN_PASSWORD,
                    role: 'admin',
                    organization_id: DEFAULT_ORG_ID,
                    allowed_tools: DEFAULT_TOOLS
                };
                
                // Ensure Org Exists
                await supabase.from('organizations').upsert({ 
                    id: DEFAULT_ORG_ID, 
                    name: 'Default Organization', 
                    plan: 'enterprise' 
                });

                const { error: insertError } = await supabase.from('app_users').insert(masterAdmin);
                if (!insertError) {
                    user = masterAdmin;
                }
            }
        }

        if (!user) {
            throw new Error('Invalid username or password');
        }

        // Normalize user object
        const loggedInUser: User = {
            ...user,
            organizationId: user.organization_id,
            allowedTools: user.allowed_tools || DEFAULT_TOOLS
        };

        setCurrentUser(loggedInUser);
        localStorage.setItem('currentUser', JSON.stringify(loggedInUser));

        // Fetch all users in this organization
        if (loggedInUser.organizationId) {
            await fetchOrgUsers(loggedInUser.organizationId);
        }
    };

    const logout = () => {
        setCurrentUser(null);
        setUsers([]);
        localStorage.removeItem('currentUser');
    };
    
    const updateUsersAndPersist = async (updatedUsers: User[]) => {
        setUsers(updatedUsers);
        
        // Upsert users to DB
        for (const user of updatedUsers) {
             const dbUser = {
                 id: user.id,
                 username: user.username,
                 password: user.password,
                 role: user.role,
                 organization_id: user.organizationId || currentUser?.organizationId,
                 allowed_tools: user.allowedTools
             };

             const { error } = await supabase.from('app_users').upsert(dbUser);
             if (error) {
                 console.error('Error upserting user:', user.username, JSON.stringify(error, null, 2));
             }
        }
    };

    // ONLY for Master Admin: Switches the "viewing" organization
    const switchOrganization = async (orgId: string) => {
        if (currentUser && currentUser.id === MASTER_ADMIN_ID) {
            // 1. Update local state to reflect new org (impersonate context)
            const updatedUser = { ...currentUser, organizationId: orgId };
            setCurrentUser(updatedUser);
            localStorage.setItem('currentUser', JSON.stringify(updatedUser));

            // 2. Fetch users for this new org
            await fetchOrgUsers(orgId);
        }
    };

    const value = {
        currentUser,
        users,
        login,
        logout,
        updateUsersAndPersist,
        switchOrganization
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
