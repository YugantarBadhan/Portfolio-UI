// src/app/services/award.service.ts
import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { Award, AwardRequest } from '../model/award.model';
import { ConfigService } from './config.service';

@Injectable({
  providedIn: 'root'
})
export class AwardService {
  private http = inject(HttpClient);
  private configService = inject(ConfigService);

  private get baseUrl(): string {
    return this.configService.apiUrl;
  }

  private get adminToken(): string {
    return this.configService.adminToken;
  }

  private getAdminHeaders(): HttpHeaders {
    return new HttpHeaders({
      'X-ADMIN-TOKEN': this.adminToken,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    });
  }

  async getAllAwards(): Promise<Award[]> {
    try {
      const response = await firstValueFrom(
        this.http.get<Award[]>(`${this.baseUrl}/awards`, {
          headers: new HttpHeaders({
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          })
        })
      );
      return response || [];
    } catch (error: any) {
      if (error.status === 404) {
        return []; // No awards found
      }
      console.error('Error fetching awards:', error);
      throw new Error(this.getErrorMessage(error, 'Failed to fetch awards'));
    }
  }

  async createAward(awardData: AwardRequest): Promise<string> {
    try {
      console.log('Creating award with data (before processing):', awardData);
      
      // Process the award data to handle empty/null values
      const processedData = this.processAwardData(awardData);
      
      console.log('Creating award with data (after processing):', processedData);
      console.log('API URL:', `${this.baseUrl}/create/award`);
      
      // Validate the award data before sending
      this.validateAwardData(processedData);

      const response = await firstValueFrom(
        this.http.post(
          `${this.baseUrl}/create/award`, 
          processedData, 
          { 
            headers: this.getAdminHeaders(),
            responseType: 'text'
          }
        )
      );
      
      console.log('Create award response:', response);
      return response || 'Award created successfully';
    } catch (error: any) {
      console.error('Error creating award:', error);
      throw new Error(this.getErrorMessage(error, 'Failed to create award'));
    }
  }

  async updateAward(id: number, awardData: AwardRequest): Promise<string> {
    try {
      // Process the award data to handle empty/null values
      const processedData = this.processAwardData(awardData);
      
      // Validate the award data before sending
      this.validateAwardData(processedData);

      if (!id || id <= 0) {
        throw new Error('Invalid award ID');
      }

      const response = await firstValueFrom(
        this.http.put<string>(
          `${this.baseUrl}/update/award/${id}`, 
          processedData, 
          { 
            headers: this.getAdminHeaders(), 
            responseType: 'text' as 'json' 
          }
        )
      );
      return response || 'Award updated successfully';
    } catch (error: any) {
      console.error('Error updating award:', error);
      throw new Error(this.getErrorMessage(error, 'Failed to update award'));
    }
  }

  async deleteAward(id: number): Promise<string> {
    try {
      if (!id || id <= 0) {
        throw new Error('Invalid award ID');
      }

      const response = await firstValueFrom(
        this.http.delete<string>(
          `${this.baseUrl}/delete/award/${id}`, 
          { 
            headers: this.getAdminHeaders(), 
            responseType: 'text' as 'json' 
          }
        )
      );
      return response || 'Award deleted successfully';
    } catch (error: any) {
      console.error('Error deleting award:', error);
      throw new Error(this.getErrorMessage(error, 'Failed to delete award'));
    }
  }

  /**
   * Process award data to handle empty/null values properly
   * Convert empty/null award link and year to null (not empty string)
   */
  private processAwardData(data: AwardRequest): AwardRequest {
    return {
      awardName: data.awardName?.trim() || '',
      description: data.description?.trim() || '',
      awardCompanyName: data.awardCompanyName?.trim() || '',
      // Convert empty strings to null for optional fields
      awardLink: data.awardLink?.trim() || null,
      awardYear: data.awardYear?.trim() || null
    };
  }

  private validateAwardData(data: AwardRequest): void {
    const errors: string[] = [];

    // Validate required fields (matches @NotBlank in Java)
    if (!data.awardName?.trim()) {
      errors.push('Award name is required');
    }

    if (!data.description?.trim()) {
      errors.push('Award description is required');
    }

    if (!data.awardCompanyName?.trim()) {
      errors.push('Award company name is required');
    }

    // Validate award link if provided (only check if it's not empty)
    if (data.awardLink && data.awardLink.trim() && !this.isValidUrl(data.awardLink.trim())) {
      errors.push('Invalid award link format');
    }

    if (errors.length > 0) {
      throw new Error('Validation failed: ' + errors.join(', '));
    }
  }

  private isValidUrl(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  private getErrorMessage(error: any, defaultMessage: string): string {
    // Handle specific HTTP status codes
    if (error.status === 401 || error.status === 403) {
      return 'Unauthorized access. Please check your admin credentials.';
    }
    
    if (error.status === 404) {
      return 'The requested resource was not found.';
    }
    
    if (error.status === 400) {
      return error.error || 'Invalid request data. Please check your input.';
    }
    
    if (error.status === 409) {
      return 'A conflict occurred. The award may already exist.';
    }
    
    if (error.status === 422) {
      return 'Invalid data provided. Please check all fields.';
    }
    
    if (error.status === 500) {
      return 'Server error occurred. Please try again later.';
    }
    
    if (error.status === 0) {
      return 'Network error. Please check your internet connection.';
    }

    // Handle error response body
    if (error.error && typeof error.error === 'string') {
      return error.error;
    }
    
    if (error.error && error.error.message) {
      return error.error.message;
    }
    
    if (error.message) {
      return error.message;
    }
    
    return defaultMessage;
  }

  // Utility method to get environment info for debugging
  getServiceInfo(): { baseUrl: string; version: string; isProduction: boolean } {
    return {
      baseUrl: this.baseUrl,
      version: this.configService.version,
      isProduction: this.configService.isProduction
    };
  }
}