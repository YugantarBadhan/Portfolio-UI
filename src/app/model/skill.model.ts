export interface Skill {
  id: number;
  name: string;
  category: string | null;
  proficiency: number; // 0-5 rating
}

export interface SkillRequest {
  name: string;
  category: string | null;
  proficiency: number;
}