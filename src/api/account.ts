import { SumoLogicClient, ApiResponse } from './client';

/**
 * Account Owner response
 */
export interface AccountOwner {
    email: string;
    firstName: string;
    lastName: string;
}

/**
 * Account Status response
 */
export interface AccountStatus {
    canManageBillingInfo: boolean;
    canUpdateEmail: boolean;
    canUpdatePassword: boolean;
    canUpdatePlan: boolean;
}

/**
 * Subdomain response
 */
export interface Subdomain {
    subdomain: string;
    url: string;
}

/**
 * Usage Forecast response
 */
export interface UsageForecast {
    dailyUsageForecast: Array<{
        date: string;
        forecastedUsage: number;
    }>;
}

/**
 * Usage Report Job response
 */
export interface UsageReportJob {
    jobId: string;
}

/**
 * Usage Report Status response
 */
export interface UsageReportStatus {
    status: 'InProgress' | 'Success' | 'Failed';
    statusMessage?: string;
    reportDownloadURL?: string;
}

/**
 * Client for Account Management API endpoints
 */
export class AccountClient extends SumoLogicClient {
    /**
     * Get account owner information
     */
    async getAccountOwner(): Promise<ApiResponse<AccountOwner>> {
        return this.makeRequest<AccountOwner>('/api/v1/account/accountOwner', 'GET');
    }

    /**
     * Get account status
     */
    async getAccountStatus(): Promise<ApiResponse<AccountStatus>> {
        return this.makeRequest<AccountStatus>('/api/v1/account/status', 'GET');
    }

    /**
     * Get subdomain
     */
    async getSubdomain(): Promise<ApiResponse<Subdomain>> {
        return this.makeRequest<Subdomain>('/api/v1/account/subdomain', 'GET');
    }

    /**
     * Get usage forecast
     */
    async getUsageForecast(numberOfDays: number): Promise<ApiResponse<UsageForecast>> {
        return this.makeRequest<UsageForecast>(`/api/v1/account/usageForecast?numberOfDays=${numberOfDays}`, 'GET');
    }

    /**
     * Generate credits usage report
     * Note: According to API docs, omit startDate and endDate to get all usage data
     */
    async generateUsageReport(
        groupBy: 'day' | 'week' | 'month',
        reportType: 'standard' | 'detailed' | 'childDetailed',
        includeDeploymentCharge: boolean = false
    ): Promise<ApiResponse<UsageReportJob>> {
        const body = {
            groupBy,
            reportType,
            includeDeploymentCharge
        };
        return this.makeRequest<UsageReportJob>('/api/v1/account/usage/report', 'POST', body);
    }

    /**
     * Get usage report status
     */
    async getUsageReportStatus(jobId: string): Promise<ApiResponse<UsageReportStatus>> {
        return this.makeRequest<UsageReportStatus>(`/api/v1/account/usage/report/${jobId}/status`, 'GET');
    }

    /**
     * Download usage report (raw CSV data)
     * Note: downloadUrl is a pre-signed S3 URL, so we skip authentication
     */
    async downloadUsageReport(downloadUrl: string): Promise<string> {
        return this.makeRawRequest(downloadUrl, 'GET', undefined, undefined, 5, true);
    }
}
