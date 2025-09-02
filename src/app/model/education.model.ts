// Author: Yugantar Badhan

export interface Education {
  id: number;
  degree: string;
  field: string;
  university: string;
  institute: string;
  location: string | null;
  startDate: string;
  endDate: string | null;
  currentStudying: boolean;
  grade: string;
  educationType: string;
  description: string | null;
}

export interface EducationRequest {
  degree: string;
  field: string;
  university: string;
  institute: string;
  location: string | null;
  startDate: string;
  endDate: string | null;
  currentStudying: boolean;
  grade: string;
  educationType: string;
  description: string | null;
}