// src/app/model/award.model.ts
export interface Award {
  id: number;
  awardName: string;
  description: string;
  awardCompanyName: string;
  awardLink: string | null;
  awardYear: string | null;
}

export interface AwardRequest {
  awardName: string;
  description: string;
  awardCompanyName: string;
  awardLink: string | null;
  awardYear: string | null;
}