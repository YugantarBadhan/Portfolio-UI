// src/app/services/profile-photo.service.ts
import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { firstValueFrom, Observable } from 'rxjs';
import { ConfigService } from './config.service';
import {
  ProfilePhoto,
  ProfilePhotoUploadResponse,
  ProfilePhotoInfo,
} from '../model/profile-photo.model';

@Injectable({
  providedIn: 'root',
})
export class ProfilePhotoService {
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
    });
  }

  /**
   * Get profile photo info for public access (no auth required)
   */
  async getProfilePhotoInfo(): Promise<ProfilePhotoInfo> {
    try {
      console.log('Loading active profile photo info...');
      console.log('API URL:', `${this.baseUrl}/profile-photo/info`);
      
      const response = await firstValueFrom(
        this.http.get<ProfilePhotoInfo>(`${this.baseUrl}/profile-photo/info`, {
          headers: new HttpHeaders({
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          })
        })
      );

      console.log('Raw backend response:', response);
      return response || {
        available: false,
        message: 'No profile photo information available',
      };
    } catch (error: any) {
      if (error.status === 404) {
        return {
          available: false,
          message: 'No profile photo found',
        };
      }
      console.error('Error fetching profile photo info:', error);
      throw new Error(this.getErrorMessage(error, 'Failed to fetch profile photo info'));
    }
  }

  /**
   * Upload a new profile photo (admin only)
   */
  uploadProfilePhoto(file: File): Observable<any> {
    console.log('Uploading profile photo:', file.name);
    console.log('API URL:', `${this.baseUrl}/profile-photo/upload`);
    console.log('Headers:', this.getAdminHeaders());

    // Validate the file before uploading
    const validationError = this.validateFile(file);
    if (validationError) {
      throw new Error(validationError);
    }

    const formData = new FormData();
    formData.append('file', file);

    return this.http.post(`${this.baseUrl}/profile-photo/upload`, formData, {
      headers: this.getAdminHeaders(),
      reportProgress: true,
      observe: 'events',
    });
  }

  /**
   * Get all uploaded profile photos (admin only)
   */
  async getAllProfilePhotos(): Promise<ProfilePhoto[]> {
    try {
      console.log('Fetching all profile photos');
      console.log('API URL:', `${this.baseUrl}/profile-photos`);

      const response = await firstValueFrom(
        this.http.get<ProfilePhoto[]>(`${this.baseUrl}/profile-photos`, {
          headers: this.getAdminHeaders(),
        })
      );
      return response || [];
    } catch (error: any) {
      if (error.status === 404) {
        return []; // No photos found
      }
      console.error('Error fetching profile photos:', error);
      throw new Error(this.getErrorMessage(error, 'Failed to fetch profile photos'));
    }
  }

  /**
   * Set a profile photo as active (admin only)
   */
  async setActiveProfilePhoto(photoId: number): Promise<string> {
    try {
      if (!photoId || photoId <= 0) {
        throw new Error('Invalid photo ID');
      }

      console.log('Setting profile photo as active:', photoId);
      console.log('API URL:', `${this.baseUrl}/profile-photo/${photoId}/activate`);

      const response = await firstValueFrom(
        this.http.put<string>(
          `${this.baseUrl}/profile-photo/${photoId}/activate`,
          {},
          {
            headers: this.getAdminHeaders(),
            responseType: 'text' as 'json'
          }
        )
      );
      return response || 'Profile photo set as active successfully';
    } catch (error: any) {
      console.error('Error setting active profile photo:', error);
      throw new Error(
        this.getErrorMessage(error, 'Failed to set active profile photo')
      );
    }
  }

  /**
   * Delete a profile photo (admin only)
   */
  async deleteProfilePhoto(photoId: number): Promise<string> {
    try {
      if (!photoId || photoId <= 0) {
        throw new Error('Invalid photo ID');
      }

      console.log('Deleting profile photo:', photoId);
      console.log('API URL:', `${this.baseUrl}/profile-photo/${photoId}`);

      const response = await firstValueFrom(
        this.http.delete<string>(
          `${this.baseUrl}/profile-photo/${photoId}`,
          {
            headers: this.getAdminHeaders(),
            responseType: 'text' as 'json'
          }
        )
      );
      return response || 'Profile photo deleted successfully';
    } catch (error: any) {
      console.error('Error deleting profile photo:', error);
      throw new Error(
        this.getErrorMessage(error, 'Failed to delete profile photo')
      );
    }
  }

  /**
   * Get active profile photo URL for direct access
   */
  getActiveProfilePhotoUrl(): string {
    return `${this.baseUrl}/profile-photo/active`;
  }

  /**
   * Get specific profile photo URL for display
   */
  getProfilePhotoUrl(photoId: number): string {
    return `${this.baseUrl}/profile-photo/view/${photoId}`;
  }

  /**
   * Validate image file before upload
   */
  validateFile(file: File): string | null {
    const maxSize = 5 * 1024 * 1024; // 5MB
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    const allowedExtensions = ['jpg', 'jpeg', 'png', 'webp'];

    // Check if file exists
    if (!file) {
      return 'Please select an image file to upload';
    }

    // Check file size
    if (file.size > maxSize) {
      return 'File size exceeds 5MB limit';
    }

    // Check file type
    if (!allowedTypes.includes(file.type.toLowerCase())) {
      return 'Invalid file type. Please upload JPG, PNG, or WebP images only';
    }

    // Check file extension
    const fileName = file.name.toLowerCase();
    const extension = fileName.split('.').pop();
    if (!extension || !allowedExtensions.includes(extension)) {
      return 'Invalid file extension. Please upload JPG, PNG, or WebP images only';
    }

    // Additional security check for file content
    if (file.size < 100) { // Too small to be a valid image
      return 'File appears to be corrupted or invalid';
    }

    return null; // File is valid
  }

  private getErrorMessage(error: any, defaultMessage: string): string {
    // Handle specific HTTP status codes
    if (error.status === 401 || error.status === 403) {
      return 'Unauthorized access. Please check your admin credentials.';
    }
    
    if (error.status === 404) {
      return 'The requested profile photo was not found.';
    }
    
    if (error.status === 400) {
      return error.error || 'Invalid request data. Please check your input.';
    }
    
    if (error.status === 409) {
      return 'A conflict occurred. The photo may already exist.';
    }
    
    if (error.status === 413) {
      return 'File size too large. Maximum size is 5MB.';
    }
    
    if (error.status === 415) {
      return 'Unsupported file type. Please upload JPG, PNG, or WebP images only.';
    }
    
    if (error.status === 422) {
      return 'Invalid image data provided. Please check the file format.';
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