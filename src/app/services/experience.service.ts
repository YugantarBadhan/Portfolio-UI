import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { Experience, ExperienceRequest } from '../model/experience.model';
import { ConfigService } from './config.service';

@Injectable({
  providedIn: 'root'
})
export class ExperienceService {
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

  async getAllExperiences(): Promise<Experience[]> {
    try {
      const response = await firstValueFrom(
        this.http.get<Experience[]>(`${this.baseUrl}/experiences`, {
          headers: new HttpHeaders({
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          })
        })
      );
      return response || [];
    } catch (error: any) {
      if (error.status === 404) {
        return []; // No experiences found
      }
      console.error('Error fetching experiences:', error);
      throw new Error(this.getErrorMessage(error, 'Failed to fetch experiences'));
    }
  }

  async createExperience(experienceData: ExperienceRequest): Promise<string> {
    try {
      console.log('Creating experience with data:', experienceData);
      console.log('API URL:', `${this.baseUrl}/create/experience`);
      console.log('Headers:', this.getAdminHeaders());
      
      // Validate the experience data before sending
      this.validateExperienceData(experienceData);

      const response = await firstValueFrom(
        this.http.post(
          `${this.baseUrl}/create/experience`, 
          experienceData, 
          { 
            headers: this.getAdminHeaders(),
            responseType: 'text'
          }
        )
      );
      
      console.log('Create experience response:', response);
      return response || 'Experience created successfully';
    } catch (error: any) {
      console.error('Error creating experience:', error);
      console.error('Error details:', {
        status: error.status,
        message: error.message,
        error: error.error,
        url: error.url
      });
      throw new Error(this.getErrorMessage(error, 'Failed to create experience'));
    }
  }

  async updateExperience(id: number, experienceData: ExperienceRequest): Promise<string> {
    try {
      // Validate the experience data before sending
      this.validateExperienceData(experienceData);

      if (!id || id <= 0) {
        throw new Error('Invalid experience ID');
      }

      const response = await firstValueFrom(
        this.http.put<string>(
          `${this.baseUrl}/update/experience/${id}`, 
          experienceData, 
          { 
            headers: this.getAdminHeaders(), 
            responseType: 'text' as 'json' 
          }
        )
      );
      return response || 'Experience updated successfully';
    } catch (error: any) {
      console.error('Error updating experience:', error);
      throw new Error(this.getErrorMessage(error, 'Failed to update experience'));
    }
  }

  async deleteExperience(id: number): Promise<string> {
    try {
      if (!id || id <= 0) {
        throw new Error('Invalid experience ID');
      }

      const response = await firstValueFrom(
        this.http.delete<string>(
          `${this.baseUrl}/delete/experience/${id}`, 
          { 
            headers: this.getAdminHeaders(), 
            responseType: 'text' as 'json' 
          }
        )
      );
      return response || 'Experience deleted successfully';
    } catch (error: any) {
      console.error('Error deleting experience:', error);
      throw new Error(this.getErrorMessage(error, 'Failed to delete experience'));
    }
  }

  private validateExperienceData(data: ExperienceRequest): void {
    const errors: string[] = [];

    // Validate company name (matches @NotBlank in Java)
    if (!data.companyName?.trim()) {
      errors.push('Company name is required');
    }

    // Validate role (matches @NotBlank in Java)
    if (!data.role?.trim()) {
      errors.push('Role is required');
    }

    // Validate start date (matches @NotNull in Java)
    if (!data.startDate) {
      errors.push('Start date is required');
    } else if (!this.isValidDate(data.startDate)) {
      errors.push('Invalid start date format');
    }

    // Validate end date only if not current (no backend validation for this)
    if (!data.current && data.endDate) {
      if (!this.isValidDate(data.endDate)) {
        errors.push('Invalid end date format');
      } else if (new Date(data.endDate) <= new Date(data.startDate)) {
        errors.push('End date must be after start date');
      }
    }

    // Description validation - backend doesn't have validation, so just check if it exists
    if (!data.description?.trim()) {
      errors.push('Description is required');
    }

    // Skills validation - backend doesn't have validation, but we want at least one skill
    if (!data.skills || data.skills.length === 0) {
      errors.push('At least one skill is required');
    } else {
      const validSkills = data.skills.filter(skill => skill?.trim());
      if (validSkills.length === 0) {
        errors.push('At least one valid skill is required');
      }
    }

    if (errors.length > 0) {
      throw new Error('Validation failed: ' + errors.join(', '));
    }
  }

  private isValidDate(dateString: string): boolean {
    // Check if the date string matches YYYY-MM-DD format
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(dateString)) {
      return false;
    }
    
    const date = new Date(dateString);
    return date instanceof Date && !isNaN(date.getTime());
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
      return 'A conflict occurred. The resource may already exist.';
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