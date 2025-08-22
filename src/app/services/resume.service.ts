// src/app/services/resume.service.ts

import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders, HttpEventType } from '@angular/common/http';
import { firstValueFrom, Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ConfigService } from './config.service';

export interface ResumeResponse {
  id: number;
  fileName: string;
  originalFileName: string;
  fileFormat: string;
  fileSize: number;
  fileSizeFormatted: string;
  contentType: string;
  uploadedDate: string;
  isActive: boolean;
}

export interface ResumeUploadResponse {
  success: boolean;
  message: string;
  resumeInfo?: ResumeResponse;
  errorCode?: string;
}

export interface ResumeDownloadInfo {
  available: boolean;
  fileName?: string;
  fileFormat?: string;
  message: string;
  resumeId?: number;
}

@Injectable({
  providedIn: 'root'
})
export class ResumeService {
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
      'X-ADMIN-TOKEN': this.adminToken
    });
  }

  /**
   * Upload a new resume
   */
  uploadResume(file: File): Observable<any> {
    const formData = new FormData();
    formData.append('file', file);

    return this.http.post(
      `${this.baseUrl}/resume/upload`,
      formData,
      {
        headers: this.getAdminHeaders(),
        reportProgress: true,
        observe: 'events'
      }
    );
  }

  /**
   * Get all uploaded resumes (admin only)
   */
  async getAllResumes(): Promise<ResumeResponse[]> {
    try {
      const response = await firstValueFrom(
        this.http.get<ResumeResponse[]>(`${this.baseUrl}/resumes`, {
          headers: this.getAdminHeaders()
        })
      );
      return response || [];
    } catch (error: any) {
      console.error('Error fetching resumes:', error);
      if (error.status === 401) {
        throw new Error('Unauthorized access');
      }
      return [];
    }
  }

  /**
   * Get resume download info (public)
   */
  async getResumeDownloadInfo(): Promise<ResumeDownloadInfo> {
    try {
      const response = await firstValueFrom(
        this.http.get<ResumeDownloadInfo>(`${this.baseUrl}/resume/download-info`)
      );
      return response;
    } catch (error: any) {
      console.error('Error fetching resume download info:', error);
      return {
        available: false,
        message: 'Unable to fetch resume information'
      };
    }
  }

  /**
   * Set a resume as active
   */
  async setActiveResume(resumeId: number): Promise<string> {
    try {
      const response = await firstValueFrom(
        this.http.put(
          `${this.baseUrl}/resume/${resumeId}/activate`,
          {},
          {
            headers: this.getAdminHeaders(),
            responseType: 'text'
          }
        )
      );
      return response || 'Resume set as active successfully';
    } catch (error: any) {
      console.error('Error setting active resume:', error);
      throw new Error(this.getErrorMessage(error, 'Failed to set active resume'));
    }
  }

  /**
   * Delete a resume
   */
  async deleteResume(resumeId: number): Promise<string> {
    try {
      const response = await firstValueFrom(
        this.http.delete(
          `${this.baseUrl}/resume/${resumeId}`,
          {
            headers: this.getAdminHeaders(),
            responseType: 'text'
          }
        )
      );
      return response || 'Resume deleted successfully';
    } catch (error: any) {
      console.error('Error deleting resume:', error);
      throw new Error(this.getErrorMessage(error, 'Failed to delete resume'));
    }
  }

  /**
   * Preview resume in new tab
   */
  previewResume(resumeId: number): void {
    const previewUrl = `${this.baseUrl}/resume/preview/${resumeId}`;
    window.open(previewUrl, '_blank');
  }

  /**
   * Download active resume
   */
  downloadResume(): void {
    const downloadUrl = `${this.baseUrl}/resume/download`;
    window.open(downloadUrl, '_blank');
  }

  /**
   * Validate file before upload
   */
  validateFile(file: File): string | null {
    const maxSize = 10 * 1024 * 1024; // 10MB
    const allowedTypes = ['application/pdf', 'application/msword', 
                          'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    const allowedExtensions = ['pdf', 'doc', 'docx'];

    // Check file size
    if (file.size > maxSize) {
      return 'File size exceeds 10MB limit';
    }

    // Check file type
    if (!allowedTypes.includes(file.type)) {
      return 'Invalid file type. Please upload PDF, DOC, or DOCX files only';
    }

    // Check file extension
    const fileName = file.name.toLowerCase();
    const extension = fileName.split('.').pop();
    if (!extension || !allowedExtensions.includes(extension)) {
      return 'Invalid file extension. Please upload PDF, DOC, or DOCX files only';
    }

    return null; // File is valid
  }

  private getErrorMessage(error: any, defaultMessage: string): string {
    if (error.status === 401 || error.status === 403) {
      return 'Unauthorized access. Please check your admin credentials.';
    }
    
    if (error.status === 404) {
      return 'Resume not found.';
    }
    
    if (error.status === 400) {
      return error.error || 'Invalid request. Please check your input.';
    }
    
    if (error.status === 500) {
      return 'Server error occurred. Please try again later.';
    }
    
    if (error.status === 0) {
      return 'Network error. Please check your internet connection.';
    }

    if (error.error && typeof error.error === 'string') {
      return error.error;
    }
    
    if (error.message) {
      return error.message;
    }
    
    return defaultMessage;
  }
}