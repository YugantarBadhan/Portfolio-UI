// src/app/model/certification.model.ts
export interface Certification {
  id: number;
  title: string;
  description: string;
  monthYear: string;
  certificationLink: string | null;
}

export interface CertificationRequest {
  title: string;
  description: string;
  monthYear: string;
  certificationLink: string | null;
}