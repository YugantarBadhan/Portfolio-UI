import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./app').then((m) => m.AppComponent),
    children: [
      {
        path: 'experience',
        loadComponent: () =>
          import('./experience/experience').then((m) => m.ExperienceComponent),
      },
      {
        path: 'projects',
        loadComponent: () =>
          import('./projects/projects').then((m) => m.ProjectsComponent),
      },
      {
        path: 'skills',
        loadComponent: () =>
          import('./skills/skills').then((m) => m.SkillsComponent),
      },
      {
        path: '',
        redirectTo: '',
        pathMatch: 'full',
      },
    ],
  },
];
