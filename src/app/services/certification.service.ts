// src/app/services/certification.service.ts
import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { Certification, CertificationRequest } from '../model/certification.model';
import { ConfigService } from './config.service';

@Injectable({
  providedIn: 'root'
})
export class CertificationService {
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

  async getAllCertifications(): Promise<Certification[]> {
    try {
      const response = await firstValueFrom(
        this.http.get<Certification[]>(`${this.baseUrl}/certifications`, {
          headers: new HttpHeaders({
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          })
        })
      );
      return response || [];
    } catch (error: any) {
      if (error.status === 404) {
        return []; // No certifications found
      }
      console.error('Error fetching certifications:', error);
      throw new Error(this.getErrorMessage(error, 'Failed to fetch certifications'));
    }
  }

  async createCertification(certificationData: CertificationRequest): Promise<string> {
    try {
      console.log('Creating certification with data:', certificationData);
      console.log('API URL:', `${this.baseUrl}/create/certification`);
      
      // Validate the certification data before sending
      this.validateCertificationData(certificationData);

      const response = await firstValueFrom(
        this.http.post(
          `${this.baseUrl}/create/certification`, 
          certificationData, 
          { 
            headers: this.getAdminHeaders(),
            responseType: 'text'
          }
        )
      );
      
      console.log('Create certification response:', response);
      return response || 'Certification created successfully';
    } catch (error: any) {
      console.error('Error creating certification:', error);
      throw new Error(this.getErrorMessage(error, 'Failed to create certification'));
    }
  }

  async updateCertification(id: number, certificationData: CertificationRequest): Promise<string> {
    try {
      // Validate the certification data before sending
      this.validateCertificationData(certificationData);

      if (!id || id <= 0) {
        throw new Error('Invalid certification ID');
      }

      const response = await firstValueFrom(
        this.http.put<string>(
          `${this.baseUrl}/update/certification/${id}`, 
          certificationData, 
          { 
            headers: this.getAdminHeaders(), 
            responseType: 'text' as 'json' 
          }
        )
      );
      return response || 'Certification updated successfully';
    } catch (error: any) {
      console.error('Error updating certification:', error);
      throw new Error(this.getErrorMessage(error, 'Failed to update certification'));
    }
  }

  async deleteCertification(id: number): Promise<string> {
    try {
      if (!id || id <= 0) {
        throw new Error('Invalid certification ID');
      }

      const response = await firstValueFrom(
        this.http.delete<string>(
          `${this.baseUrl}/delete/certification/${id}`, 
          { 
            headers: this.getAdminHeaders(), 
            responseType: 'text' as 'json' 
          }
        )
      );
      return response || 'Certification deleted successfully';
    } catch (error: any) {
      console.error('Error deleting certification:', error);
      throw new Error(this.getErrorMessage(error, 'Failed to delete certification'));
    }
  }

  private validateCertificationData(data: CertificationRequest): void {
    const errors: string[] = [];

    // Validate title (matches @NotBlank in Java)
    if (!data.title?.trim()) {
      errors.push('Certification title is required');
    }

    // Validate description (matches @NotBlank in Java)
    if (!data.description?.trim()) {
      errors.push('Certification description is required');
    }

    // Validate monthYear (matches @NotBlank in Java)
    if (!data.monthYear?.trim()) {
      errors.push('Month and year is required');
    }

    // Optional certification link validation (basic URL format check if provided)
    if (data.certificationLink && data.certificationLink.trim() && !this.isValidUrl(data.certificationLink.trim())) {
      errors.push('Invalid certification link format');
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
      return 'A conflict occurred. The certification may already exist.';
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