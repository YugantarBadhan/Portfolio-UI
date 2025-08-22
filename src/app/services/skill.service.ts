import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { Skill, SkillRequest } from '../model/skill.model';
import { ConfigService } from './config.service';

@Injectable({
  providedIn: 'root'
})
export class SkillService {
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

  async getAllSkills(): Promise<Skill[]> {
    try {
      const response = await firstValueFrom(
        this.http.get<Skill[]>(`${this.baseUrl}/skills`, {
          headers: new HttpHeaders({
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          })
        })
      );
      return response || [];
    } catch (error: any) {
      if (error.status === 404) {
        return []; // No skills found
      }
      console.error('Error fetching skills:', error);
      throw new Error(this.getErrorMessage(error, 'Failed to fetch skills'));
    }
  }

  async createSkill(skillData: SkillRequest): Promise<string> {
    try {
      console.log('Creating skill with data:', skillData);
      console.log('API URL:', `${this.baseUrl}/create/skill`);
      
      // Validate the skill data before sending
      this.validateSkillData(skillData);

      const response = await firstValueFrom(
        this.http.post(
          `${this.baseUrl}/create/skill`, 
          skillData, 
          { 
            headers: this.getAdminHeaders(),
            responseType: 'text'
          }
        )
      );
      
      console.log('Create skill response:', response);
      return response || 'Skill created successfully';
    } catch (error: any) {
      console.error('Error creating skill:', error);
      throw new Error(this.getErrorMessage(error, 'Failed to create skill'));
    }
  }

  async updateSkill(id: number, skillData: SkillRequest): Promise<string> {
    try {
      // Validate the skill data before sending
      this.validateSkillData(skillData);

      if (!id || id <= 0) {
        throw new Error('Invalid skill ID');
      }

      const response = await firstValueFrom(
        this.http.put<string>(
          `${this.baseUrl}/update/skill/${id}`, 
          skillData, 
          { 
            headers: this.getAdminHeaders(), 
            responseType: 'text' as 'json' 
          }
        )
      );
      return response || 'Skill updated successfully';
    } catch (error: any) {
      console.error('Error updating skill:', error);
      throw new Error(this.getErrorMessage(error, 'Failed to update skill'));
    }
  }

  async deleteSkill(id: number): Promise<string> {
    try {
      if (!id || id <= 0) {
        throw new Error('Invalid skill ID');
      }

      const response = await firstValueFrom(
        this.http.delete<string>(
          `${this.baseUrl}/delete/skill/${id}`, 
          { 
            headers: this.getAdminHeaders(), 
            responseType: 'text' as 'json' 
          }
        )
      );
      return response || 'Skill deleted successfully';
    } catch (error: any) {
      console.error('Error deleting skill:', error);
      throw new Error(this.getErrorMessage(error, 'Failed to delete skill'));
    }
  }

  private validateSkillData(data: SkillRequest): void {
    const errors: string[] = [];

    // Validate skill name (matches @NotBlank in Java)
    if (!data.name?.trim()) {
      errors.push('Skill name is required');
    }

    // Validate proficiency (matches @Min(0) @Max(5) in Java)
    if (data.proficiency === null || data.proficiency === undefined) {
      errors.push('Proficiency is required');
    } else if (data.proficiency < 0 || data.proficiency > 5) {
      errors.push('Proficiency must be between 0 and 5');
    }

    // Category is optional, no validation needed

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
      return 'A conflict occurred. The skill may already exist.';
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