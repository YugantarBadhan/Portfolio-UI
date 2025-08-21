export interface Project {
  id: number;
  title: string;
  description: string;
  techStack: string | null;
  githubLink: string | null;
  liveDemoLink: string | null;
}

export interface ProjectRequest {
  title: string;
  description: string;
  techStack: string | null;
  githubLink: string | null;
  liveDemoLink: string | null;
}