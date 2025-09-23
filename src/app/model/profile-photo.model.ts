// src/app/model/profile-photo.model.ts
export interface ProfilePhoto {
  id: number;
  fileName: string;
  originalFileName: string;
  fileFormat: string;
  fileSize: number;
  fileSizeFormatted: string;
  contentType: string;
  uploadedDate: string;
  isActive: boolean;
  imageWidth: number;
  imageHeight: number;
  imageUrl: string;
}

export interface ProfilePhotoUploadResponse {
  success: boolean;
  message: string;
  photoInfo?: ProfilePhoto;
  errorCode?: string;
}

export interface ProfilePhotoInfo {
  available: boolean;
  imageUrl?: string;
  fileName?: string;
  fileFormat?: string;
  message: string;
  photoId?: number;
  imageWidth?: number;
  imageHeight?: number;
}