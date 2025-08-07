import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { Experience, ExperienceRequest } from './experience.model';

@Injectable({
  providedIn: 'root'
})
export class ExperienceService {
  private baseUrl = 'http://localhost:8080/api';
  private adminToken = 'yugantarportfoliobadhan';

  constructor(private http: HttpClient) {}

  private getAdminHeaders(): HttpHeaders {
    return new HttpHeaders({
      'X-ADMIN-TOKEN': this.adminToken,
      'Content-Type': 'application/json'
    });
  }

  async getAllExperiences(): Promise<Experience[]> {
    try {
      const response = await firstValueFrom(
        this.http.get<Experience[]>(`${this.baseUrl}/experiences`)
      );
      return response || [];
    } catch (error: any) {
      if (error.status === 404) {
        return []; // No experiences found
      }
      throw new Error('Failed to fetch experiences: ' + (error.message || 'Unknown error'));
    }
  }

  async createExperience(experienceData: ExperienceRequest): Promise<string> {
    try {
      const response = await firstValueFrom(
        this.http.post<string>(
          `${this.baseUrl}/create/experience`, 
          experienceData, 
          { headers: this.getAdminHeaders(), responseType: 'text' as 'json' }
        )
      );
      return response;
    } catch (error: any) {
      throw new Error(this.getErrorMessage(error));
    }
  }

  async updateExperience(id: number, experienceData: ExperienceRequest): Promise<string> {
    try {
      const response = await firstValueFrom(
        this.http.put<string>(
          `${this.baseUrl}/update/experience/${id}`, 
          experienceData, 
          { headers: this.getAdminHeaders(), responseType: 'text' as 'json' }
        )
      );
      return response;
    } catch (error: any) {
      throw new Error(this.getErrorMessage(error));
    }
  }

  async deleteExperience(id: number): Promise<string> {
    try {
      const response = await firstValueFrom(
        this.http.delete<string>(
          `${this.baseUrl}/delete/experience/${id}`, 
          { headers: this.getAdminHeaders(), responseType: 'text' as 'json' }
        )
      );
      return response;
    } catch (error: any) {
      throw new Error(this.getErrorMessage(error));
    }
  }

  private getErrorMessage(error: any): string {
    if (error.status === 401 || error.status === 403) {
      return 'Unauthorized: Invalid admin token';
    }
    if (error.status === 404) {
      return 'Resource not found';
    }
    if (error.status === 400) {
      return error.error || 'Bad request: Please check your input data';
    }
    if (error.error && typeof error.error === 'string') {
      return error.error;
    }
    if (error.message) {
      return error.message;
    }
    return 'An unexpected error occurred';
  }
}