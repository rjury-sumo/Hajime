import { SumoLogicClient, ApiResponse } from './client';

/**
 * User response from API
 */
export interface UserResponse {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    roleIds: string[];
    isActive: boolean;
    isLockedOut: boolean;
    isMfaEnabled: boolean;
    lastModified?: string;
    createdAt?: string;
    createdBy?: string;
    modifiedAt?: string;
    modifiedBy?: string;
}

/**
 * Role response from API
 */
export interface RoleResponse {
    id: string;
    name: string;
    description?: string;
    filterPredicate?: string;
    users: string[];
    capabilities: string[];
    autofillDependencies: boolean;
    createdAt?: string;
    createdBy?: string;
    modifiedAt?: string;
    modifiedBy?: string;
}

/**
 * List users response
 */
interface ListUsersResponse {
    data: UserResponse[];
    next?: string;
}

/**
 * List roles response
 */
interface ListRolesResponse {
    data: RoleResponse[];
    next?: string;
}

/**
 * Client for User Management and Role Management APIs
 * Docs:
 * - https://help.sumologic.com/docs/api/user-management/
 * - https://help.sumologic.com/docs/api/role-management-v2/
 */
export class UsersRolesClient extends SumoLogicClient {
    /**
     * List all users (with pagination support)
     * API: GET /api/v1/users
     * Docs: https://help.sumologic.com/docs/api/user-management/
     */
    async listUsers(limit: number = 1000, token?: string): Promise<ApiResponse<ListUsersResponse>> {
        let path = `/api/v1/users?limit=${limit}`;
        if (token) {
            path += `&token=${encodeURIComponent(token)}`;
        }
        return this.makeRequest<ListUsersResponse>(path, 'GET');
    }

    /**
     * Get all users (handles pagination automatically)
     */
    async getAllUsers(): Promise<ApiResponse<UserResponse[]>> {
        const allUsers: UserResponse[] = [];
        let token: string | undefined = undefined;

        try {
            do {
                const response = await this.listUsers(1000, token);

                if (response.error) {
                    return { error: response.error, statusCode: response.statusCode };
                }

                if (response.data?.data) {
                    allUsers.push(...response.data.data);
                }

                token = response.data?.next;
            } while (token);

            return { data: allUsers };
        } catch (error: any) {
            return { error: `Failed to fetch users: ${error.message}` };
        }
    }

    /**
     * Get a specific user by ID
     * API: GET /api/v1/users/{id}
     */
    async getUser(userId: string): Promise<ApiResponse<UserResponse>> {
        return this.makeRequest<UserResponse>(`/api/v1/users/${userId}`, 'GET');
    }

    /**
     * List all roles (with pagination support)
     * API: GET /api/v2/roles
     * Docs: https://help.sumologic.com/docs/api/role-management-v2/
     */
    async listRoles(limit: number = 1000, token?: string): Promise<ApiResponse<ListRolesResponse>> {
        let path = `/api/v2/roles?limit=${limit}`;
        if (token) {
            path += `&token=${encodeURIComponent(token)}`;
        }
        return this.makeRequest<ListRolesResponse>(path, 'GET');
    }

    /**
     * Get all roles (handles pagination automatically)
     */
    async getAllRoles(): Promise<ApiResponse<RoleResponse[]>> {
        const allRoles: RoleResponse[] = [];
        let token: string | undefined = undefined;

        try {
            do {
                const response = await this.listRoles(1000, token);

                if (response.error) {
                    return { error: response.error, statusCode: response.statusCode };
                }

                if (response.data?.data) {
                    allRoles.push(...response.data.data);
                }

                token = response.data?.next;
            } while (token);

            return { data: allRoles };
        } catch (error: any) {
            return { error: `Failed to fetch roles: ${error.message}` };
        }
    }

    /**
     * Get a specific role by ID
     * API: GET /api/v2/roles/{id}
     */
    async getRole(roleId: string): Promise<ApiResponse<RoleResponse>> {
        return this.makeRequest<RoleResponse>(`/api/v2/roles/${roleId}`, 'GET');
    }
}
