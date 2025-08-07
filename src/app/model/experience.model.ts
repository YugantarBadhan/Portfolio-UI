export interface Experience {
  id: number;
  companyName: string;
  role: string;
  startDate: string; // Format: YYYY-MM-DD
  endDate: string | null; // Format: YYYY-MM-DD or null for current
  current: boolean;
  description: string;
  skills: string[];
}

export interface ExperienceRequest {
  companyName: string;
  role: string;
  startDate: string; // Format: YYYY-MM-DD
  endDate: string | null; // Format: YYYY-MM-DD or null for current
  current: boolean;
  description: string;
  skills: string[];
}