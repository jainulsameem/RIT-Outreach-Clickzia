
import React, { createContext, useContext, useEffect, useState } from 'react';
import type { User } from '../types';
import { supabase } from '../services/supabaseClient';
import { hashPassword } from '../services/security';

// Master admin credentials (fallback/seed)
const MASTER_ADMIN_USERNAME = 'Sameem';
// Note: This plain text password is NOT stored. It's only used to generate the initial hash if the DB is empty.
const MASTER_ADMIN_DEFAULT_PASS = 'nazia123!'; 
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
            try {
                const user = JSON.parse(storedUser);
                setCurrentUser(user);
                if (user.organizationId) {
                    fetchOrgUsers(user.organizationId);
                }
            } catch (e) {
                console.error("Failed to parse stored user");
                localStorage.removeItem('currentUser');
            }
        }
    }, []);

    const login = async (username: string, password: string): Promise<void> => {
        const inputHash = await hashPassword(password);

        // 1. Attempt to fetch user by Username
        let { data: user, error } = await supabase
            .from('app_users')
            .select('*')
            .eq('username', username)
            .maybeSingle();

        // 2. Check for Master Admin Seed Requirement (First Run Only)
        if (!user) {
            const { count } = await supabase.from('app_users').select('*', { count: 'exact', head: true });
            
            // Only seed if DB is completely empty and credentials match hardcoded default
            if (count === 0 && username === MASTER_ADMIN_USERNAME && password === MASTER_ADMIN_DEFAULT_PASS) {
                 // Seed Master Admin & Default Org
                 const masterAdminHash = await hashPassword(MASTER_ADMIN_DEFAULT_PASS);
                 
                 // Prepare admin object
                 const masterAdmin: any = {
                    id: MASTER_ADMIN_ID,
                    username: MASTER_ADMIN_USERNAME,
                    password: masterAdminHash, // STORED AS HASH
                    role: 'admin',
                    allowed_tools: DEFAULT_TOOLS
                };
                
                // Try to create Default Org
                const { error: orgError } = await supabase.from('organizations').upsert({ 
                    id: DEFAULT_ORG_ID, 
                    name: 'Default Organization', 
                    plan: 'enterprise' 
                });

                if (orgError) {
                    console.warn("Could not seed organization (check if table exists):", orgError.message);
                    // If Org creation fails, we still try to create user but without org_id link to avoid FK error
                    // masterAdmin.organization_id = DEFAULT_ORG_ID; // Skip this if org failed
                } else {
                    masterAdmin.organization_id = DEFAULT_ORG_ID;
                }

                const { error: insertError } = await supabase.from('app_users').insert(masterAdmin);
                
                if (!insertError) {
                    user = masterAdmin;
                } else {
                    console.error("Failed to seed admin:", insertError);
                    
                    // Specific RLS Error Handling
                    if (insertError.message?.includes('row-level security') || insertError.code === '42501') {
                         throw new Error(`Database Permission Error: RLS is enabled but no policy exists. Run this SQL: create policy "Allow all" on app_users for all using (true) with check (true);`);
                    }

                    // If insert failed, it might be because 'organization_id' column doesn't exist yet.
                    // Try one last fallback: insert without extra columns
                    if (insertError.message?.includes('column') || insertError.message?.includes('organization_id')) {
                        console.warn("Database schema might be outdated. Attempting legacy admin seed...");
                        const legacyAdmin = {
                            id: MASTER_ADMIN_ID,
                            username: MASTER_ADMIN_USERNAME,
                            password: masterAdminHash,
                            role: 'admin'
                        };
                        const { error: legacyError } = await supabase.from('app_users').insert(legacyAdmin);
                        if (!legacyError) {
                            user = legacyAdmin;
                        } else {
                             console.error("Failed to seed admin (legacy attempt):", JSON.stringify(legacyError));
                             throw new Error(`Failed to initialize admin account: ${legacyError.message}`);
                        }
                    } else {
                        throw new Error(`Failed to initialize admin account: ${insertError.message}`);
                    }
                }
            }
        }

        if (!user) {
            throw new Error('Invalid username or password');
        }

        // 3. Verify Password
        // Check against hash (Secure) OR plain text (Legacy/Migration support)
        const isMatch = user.password === inputHash || user.password === password;

        if (!isMatch) {
             throw new Error('Invalid username or password');
        }

        // Normalize user object
        const loggedInUser: User = {
            ...user,
            organizationId: user.organization_id,
            allowedTools: user.allowed_tools || DEFAULT_TOOLS
        };

        setCurrentUser(loggedInUser);
        
        // SECURITY: Remove password before storing in LocalStorage
        const { password: _removedPass, ...safeUser } = loggedInUser;
        localStorage.setItem('currentUser', JSON.stringify(safeUser));

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
                 password: user.password, // Already hashed by AddEditUserModal
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
            
            // Security: Store without password
            const { password: _removedPass, ...safeUser } = updatedUser;
            localStorage.setItem('currentUser', JSON.stringify(safeUser));

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
