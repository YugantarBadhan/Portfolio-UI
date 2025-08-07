import { Component, OnInit, inject, signal, PLATFORM_ID, Inject } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators, FormArray } from '@angular/forms';
import { ExperienceService } from '../services/experience.service';
import { Experience } from '../model/experience.model';

@Component({
  selector: 'app-experience',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './experience.html',
  styleUrls: ['./experience.css']
})
export class ExperienceComponent implements OnInit {
  private experienceService = inject(ExperienceService);
  private fb = inject(FormBuilder);

  experiences = signal<Experience[]>([]);
  isLoading = signal(false);
  showForm = signal(false);
  editingId = signal<number | null>(null);
  isAdmin = signal(false);
  private isBrowser: boolean;

  experienceForm: FormGroup;

  constructor(@Inject(PLATFORM_ID) platformId: Object) {
    this.isBrowser = isPlatformBrowser(platformId);
    
    this.experienceForm = this.fb.group({
      companyName: ['', [Validators.required, Validators.minLength(2)]],
      role: ['', [Validators.required, Validators.minLength(2)]],
      startDate: ['', Validators.required],
      endDate: [''],
      current: [false],
      description: ['', [Validators.required, Validators.minLength(10)]],
      skills: this.fb.array([])
    });

    // Check if user is admin by checking if they have the admin token
    this.checkAdminStatus();
  }

  ngOnInit() {
    this.loadExperiences();
  }

  private checkAdminStatus() {
    if (!this.isBrowser) {
      return; // Skip localStorage access during SSR
    }
    
    // Check if user is admin by checking if they have the admin token
    const adminToken = localStorage.getItem('adminToken');
    this.isAdmin.set(adminToken === 'yugantarportfoliobadhan');
  }

  toggleAdminMode() {
    if (!this.isBrowser) {
      return; // Skip localStorage access during SSR
    }
    
    const currentToken = localStorage.getItem('adminToken');
    if (currentToken === 'yugantarportfoliobadhan') {
      localStorage.removeItem('adminToken');
      this.isAdmin.set(false);
    } else {
      const token = prompt('Enter admin token:');
      if (token === 'yugantarportfoliobadhan') {
        localStorage.setItem('adminToken', token);
        this.isAdmin.set(true);
      } else {
        alert('Invalid admin token');
      }
    }
  }

  async loadExperiences() {
    this.isLoading.set(true);
    try {
      const experiences = await this.experienceService.getAllExperiences();
      // Sort by start date (most recent first)
      experiences.sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime());
      this.experiences.set(experiences);
    } catch (error) {
      console.error('Error loading experiences:', error);
      this.experiences.set([]);
    } finally {
      this.isLoading.set(false);
    }
  }

  get skillsArray(): FormArray {
    return this.experienceForm.get('skills') as FormArray;
  }

  addSkill() {
    this.skillsArray.push(this.fb.control('', Validators.required));
  }

  removeSkill(index: number) {
    this.skillsArray.removeAt(index);
  }

  openForm(experience?: Experience) {
    this.resetForm();
    if (experience) {
      this.editingId.set(experience.id);
      this.experienceForm.patchValue({
        companyName: experience.companyName,
        role: experience.role,
        startDate: experience.startDate,
        endDate: experience.endDate,
        current: experience.current,
        description: experience.description
      });
      
      // Set skills
      this.skillsArray.clear();
      experience.skills.forEach(skill => {
        this.skillsArray.push(this.fb.control(skill, Validators.required));
      });
    } else {
      this.editingId.set(null);
      this.addSkill(); // Add one skill field by default
    }
    this.showForm.set(true);
  }

  closeForm() {
    this.showForm.set(false);
    this.resetForm();
  }

  resetForm() {
    this.experienceForm.reset();
    this.skillsArray.clear();
    this.experienceForm.patchValue({ current: false });
  }

  async onSubmit() {
    if (this.experienceForm.valid) {
      this.isLoading.set(true);
      try {
        const formValue = this.experienceForm.value;
        const experienceData = {
          ...formValue,
          skills: formValue.skills.filter((skill: string) => skill.trim() !== ''),
          endDate: formValue.current ? null : formValue.endDate
        };

        if (this.editingId()) {
          await this.experienceService.updateExperience(this.editingId()!, experienceData);
        } else {
          await this.experienceService.createExperience(experienceData);
        }
        
        await this.loadExperiences();
        this.closeForm();
      } catch (error: any) {
        alert(error.message || 'An error occurred');
      } finally {
        this.isLoading.set(false);
      }
    }
  }

  async deleteExperience(id: number, companyName: string) {
    if (confirm(`Are you sure you want to delete the experience at ${companyName}?`)) {
      this.isLoading.set(true);
      try {
        await this.experienceService.deleteExperience(id);
        await this.loadExperiences();
      } catch (error: any) {
        alert(error.message || 'Failed to delete experience');
      } finally {
        this.isLoading.set(false);
      }
    }
  }

  formatDate(date: string): string {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short'
    });
  }

  calculateDuration(startDate: string, endDate: string | null, isCurrent: boolean): string {
    const start = new Date(startDate);
    const end = isCurrent ? new Date() : new Date(endDate!);
    
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    const diffMonths = Math.floor(diffDays / 30);
    const years = Math.floor(diffMonths / 12);
    const months = diffMonths % 12;

    if (years > 0 && months > 0) {
      return `${years} year${years > 1 ? 's' : ''} ${months} month${months > 1 ? 's' : ''}`;
    } else if (years > 0) {
      return `${years} year${years > 1 ? 's' : ''}`;
    } else if (months > 0) {
      return `${months} month${months > 1 ? 's' : ''}`;
    } else {
      return 'Less than a month';
    }
  }
}