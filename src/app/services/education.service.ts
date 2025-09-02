// Author: Yugantar Badhan

import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { Education, EducationRequest } from '../model/education.model';
import { ConfigService } from './config.service';

@Injectable({
  providedIn: 'root'
})
export class EducationService {
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

  async getAllEducations(): Promise<Education[]> {
    try {
      const response = await firstValueFrom(
        this.http.get<Education[]>(`${this.baseUrl}/educations`, {
          headers: new HttpHeaders({
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          })
        })
      );
      return response || [];
    } catch (error: any) {
      if (error.status === 404) {
        return []; // No educations found
      }
      console.error('Error fetching educations:', error);
      throw new Error(this.getErrorMessage(error, 'Failed to fetch educations'));
    }
  }

  async createEducation(educationData: EducationRequest): Promise<string> {
    try {
      console.log('Creating education with data (before processing):', educationData);
      
      // Process the education data to handle empty/null values
      const processedData = this.processEducationData(educationData);
      
      console.log('Creating education with data (after processing):', processedData);
      console.log('API URL:', `${this.baseUrl}/create/education`);
      
      // Validate the education data before sending
      this.validateEducationData(processedData);

      const response = await firstValueFrom(
        this.http.post(
          `${this.baseUrl}/create/education`, 
          processedData, 
          { 
            headers: this.getAdminHeaders(),
            responseType: 'text'
          }
        )
      );
      
      console.log('Create education response:', response);
      return response || 'Education created successfully';
    } catch (error: any) {
      console.error('Error creating education:', error);
      throw new Error(this.getErrorMessage(error, 'Failed to create education'));
    }
  }

  async updateEducation(id: number, educationData: EducationRequest): Promise<string> {
    try {
      // Process the education data to handle empty/null values
      const processedData = this.processEducationData(educationData);
      
      // Validate the education data before sending
      this.validateEducationData(processedData);

      if (!id || id <= 0) {
        throw new Error('Invalid education ID');
      }

      const response = await firstValueFrom(
        this.http.put<string>(
          `${this.baseUrl}/update/education/${id}`, 
          processedData, 
          { 
            headers: this.getAdminHeaders(), 
            responseType: 'text' as 'json' 
          }
        )
      );
      return response || 'Education updated successfully';
    } catch (error: any) {
      console.error('Error updating education:', error);
      throw new Error(this.getErrorMessage(error, 'Failed to update education'));
    }
  }

  async deleteEducation(id: number): Promise<string> {
    try {
      if (!id || id <= 0) {
        throw new Error('Invalid education ID');
      }

      const response = await firstValueFrom(
        this.http.delete<string>(
          `${this.baseUrl}/delete/education/${id}`, 
          { 
            headers: this.getAdminHeaders(), 
            responseType: 'text' as 'json' 
          }
        )
      );
      return response || 'Education deleted successfully';
    } catch (error: any) {
      console.error('Error deleting education:', error);
      throw new Error(this.getErrorMessage(error, 'Failed to delete education'));
    }
  }

  /**
   * Process education data to handle empty/null values properly
   */
  private processEducationData(data: EducationRequest): EducationRequest {
    return {
      degree: data.degree?.trim() || '',
      field: data.field?.trim() || '',
      university: data.university?.trim() || '',
      institute: data.institute?.trim() || '',
      location: data.location?.trim() || null,
      startDate: data.startDate?.trim() || '',
      endDate: data.currentStudying ? null : (data.endDate?.trim() || ''),
      currentStudying: Boolean(data.currentStudying),
      grade: data.grade?.trim() || '',
      educationType: data.educationType?.trim() || '',
      description: data.description?.trim() || null
    };
  }

  private validateEducationData(data: EducationRequest): void {
    const errors: string[] = [];

    // Validate required fields (matches @NotBlank in Java)
    if (!data.degree?.trim()) {
      errors.push('Degree/Qualification is required');
    }

    if (!data.field?.trim()) {
      errors.push('Field of Study/Major is required');
    }

    if (!data.university?.trim()) {
      errors.push('University/Board is required');
    }

    if (!data.institute?.trim()) {
      errors.push('Institute is required');
    }

    if (!data.startDate?.trim()) {
      errors.push('Start date is required');
    }

    if (!data.grade?.trim()) {
      errors.push('Grade/CGPA/Percentage is required');
    }

    if (!data.educationType?.trim()) {
      errors.push('Education type is required');
    }

    // Validate end date logic
    if (!data.currentStudying && !data.endDate?.trim()) {
      errors.push('End date is required when not currently studying');
    }

    if (data.currentStudying && data.endDate?.trim()) {
      errors.push('End date should be empty when currently studying');
    }

    // Validate date logic (basic validation)
    if (!data.currentStudying && data.startDate && data.endDate) {
      if (data.startDate > data.endDate) {
        errors.push('Start date cannot be after end date');
      }
    }

    if (errors.length > 0) {
      throw new Error('Validation failed: ' + errors.join(', '));
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
      return 'A conflict occurred. The education entry may already exist.';
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