// src/app/services/project.service.ts
import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { Project, ProjectRequest } from '../model/project.model';
import { ConfigService } from './config.service';

@Injectable({
  providedIn: 'root'
})
export class ProjectService {
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

  async getAllProjects(): Promise<Project[]> {
    try {
      const response = await firstValueFrom(
        this.http.get<Project[]>(`${this.baseUrl}/projects`, {
          headers: new HttpHeaders({
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          })
        })
      );
      return response || [];
    } catch (error: any) {
      if (error.status === 404) {
        return []; // No projects found
      }
      console.error('Error fetching projects:', error);
      throw new Error(this.getErrorMessage(error, 'Failed to fetch projects'));
    }
  }

  async createProject(projectData: ProjectRequest): Promise<string> {
    try {
      console.log('Creating project with data:', projectData);
      console.log('API URL:', `${this.baseUrl}/create/project`);
      console.log('Headers:', this.getAdminHeaders());
      
      // Validate the project data before sending
      this.validateProjectData(projectData);

      const response = await firstValueFrom(
        this.http.post(
          `${this.baseUrl}/create/project`, 
          projectData, 
          { 
            headers: this.getAdminHeaders(),
            responseType: 'text'
          }
        )
      );
      
      console.log('Create project response:', response);
      return response || 'Project created successfully';
    } catch (error: any) {
      console.error('Error creating project:', error);
      console.error('Error details:', {
        status: error.status,
        message: error.message,
        error: error.error,
        url: error.url
      });
      throw new Error(this.getErrorMessage(error, 'Failed to create project'));
    }
  }

  async updateProject(id: number, projectData: ProjectRequest): Promise<string> {
    try {
      // Validate the project data before sending
      this.validateProjectData(projectData);

      if (!id || id <= 0) {
        throw new Error('Invalid project ID');
      }

      const response = await firstValueFrom(
        this.http.put<string>(
          `${this.baseUrl}/update/project/${id}`, 
          projectData, 
          { 
            headers: this.getAdminHeaders(), 
            responseType: 'text' as 'json' 
          }
        )
      );
      return response || 'Project updated successfully';
    } catch (error: any) {
      console.error('Error updating project:', error);
      throw new Error(this.getErrorMessage(error, 'Failed to update project'));
    }
  }

  async deleteProject(id: number): Promise<string> {
    try {
      if (!id || id <= 0) {
        throw new Error('Invalid project ID');
      }

      const response = await firstValueFrom(
        this.http.delete<string>(
          `${this.baseUrl}/delete/project/${id}`, 
          { 
            headers: this.getAdminHeaders(), 
            responseType: 'text' as 'json' 
          }
        )
      );
      return response || 'Project deleted successfully';
    } catch (error: any) {
      console.error('Error deleting project:', error);
      throw new Error(this.getErrorMessage(error, 'Failed to delete project'));
    }
  }

  private validateProjectData(data: ProjectRequest): void {
    const errors: string[] = [];

    // Validate title (matches @NotBlank and @Size(max = 400) in Java)
    if (!data.title?.trim()) {
      errors.push('Project title is required');
    } else if (data.title.trim().length > 400) {
      errors.push('Project title can be at most 400 characters');
    }

    // Validate description (matches @NotBlank in Java)
    if (!data.description?.trim()) {
      errors.push('Project description is required');
    }

    // Optional fields validation (basic URL format check if provided)
    if (data.githubLink && data.githubLink.trim() && !this.isValidUrl(data.githubLink.trim())) {
      errors.push('Invalid GitHub link format');
    }

    if (data.liveDemoLink && data.liveDemoLink.trim() && !this.isValidUrl(data.liveDemoLink.trim())) {
      errors.push('Invalid live demo link format');
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