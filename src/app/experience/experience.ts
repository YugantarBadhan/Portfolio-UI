import { Component, OnInit, inject, signal, PLATFORM_ID, Inject } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators, FormArray } from '@angular/forms';
import { ExperienceService } from '../services/experience.service';
import { Experience } from '../model/experience.model';
import { ConfigService } from '../services/config.service';

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
  private configService = inject(ConfigService);

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
    this.setupFormValidation();
  }

  private setupFormValidation() {
    // Add conditional validation for end date
    this.experienceForm.get('current')?.valueChanges.subscribe(isCurrent => {
      const endDateControl = this.experienceForm.get('endDate');
      if (isCurrent) {
        endDateControl?.clearValidators();
        endDateControl?.setValue('');
      } else {
        endDateControl?.setValidators([Validators.required]);
      }
      endDateControl?.updateValueAndValidity();
    });

    // Add validation for skills array
    this.skillsArray.valueChanges.subscribe(() => {
      this.experienceForm.updateValueAndValidity();
    });
  }

  private checkAdminStatus() {
    if (!this.isBrowser) {
      return; // Skip localStorage access during SSR
    }
    
    // Use admin token from environment config
    const adminToken = localStorage.getItem('adminToken');
    this.isAdmin.set(adminToken === this.configService.adminToken);
  }

  toggleAdminMode() {
    if (!this.isBrowser) {
      return; // Skip localStorage access during SSR
    }
    
    const currentToken = localStorage.getItem('adminToken');
    if (currentToken === this.configService.adminToken) {
      localStorage.removeItem('adminToken');
      this.isAdmin.set(false);
    } else {
      const token = prompt('Enter admin token:');
      if (token === this.configService.adminToken) {
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
    this.skillsArray.push(this.fb.control('', [Validators.required, Validators.minLength(1)]));
    // Trigger form validation update
    setTimeout(() => this.experienceForm.updateValueAndValidity(), 0);
  }

  removeSkill(index: number) {
    this.skillsArray.removeAt(index);
    // Trigger form validation update
    setTimeout(() => this.experienceForm.updateValueAndValidity(), 0);
  }

  hasValidSkills(): boolean {
    if (this.skillsArray.length === 0) return false;
    const skills = this.skillsArray.value as string[];
    return skills.some(skill => skill && skill.trim().length > 0);
  }

  isFormValid(): boolean {
    return this.experienceForm.valid && this.hasValidSkills();
  }

  onSkillChange() {
    // Trigger form validation update when skills change
    setTimeout(() => {
      this.experienceForm.updateValueAndValidity();
    }, 0);
  }

  onCurrentChange() {
    const isCurrentlyWorking = this.experienceForm.get('current')?.value;
    const endDateControl = this.experienceForm.get('endDate');
    
    if (isCurrentlyWorking) {
      endDateControl?.setValue('');
      endDateControl?.clearValidators();
    } else {
      endDateControl?.setValidators([Validators.required]);
    }
    endDateControl?.updateValueAndValidity();
  }

  openForm(experience?: Experience) {
    this.resetForm();
    
    // Prevent body scroll when modal opens
    if (this.isBrowser) {
      document.body.style.overflow = 'hidden';
    }
    
    if (experience) {
      this.editingId.set(experience.id);
      
      // Format dates for form inputs (date inputs expect YYYY-MM-DD)
      const startDate = this.formatDateForInput(experience.startDate);
      const endDate = experience.endDate ? this.formatDateForInput(experience.endDate) : '';
      
      this.experienceForm.patchValue({
        companyName: experience.companyName,
        role: experience.role,
        startDate: startDate,
        endDate: endDate,
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
    
    // Restore body scroll when modal closes
    if (this.isBrowser) {
      document.body.style.overflow = 'auto';
    }
  }

  closeFormOnBackdrop(event: Event) {
    if (event.target === event.currentTarget) {
      this.closeForm();
    }
  }

  resetForm() {
    this.experienceForm.reset();
    this.skillsArray.clear();
    this.experienceForm.patchValue({ current: false });
  }

  async onSubmit() {
    if (this.isFormValid()) {
      this.isLoading.set(true);
      try {
        const formValue = this.experienceForm.value;
        const experienceData = {
          ...formValue,
          skills: formValue.skills.filter((skill: string) => skill && skill.trim() !== ''),
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

  // Format date for input fields (YYYY-MM-DD)
  private formatDateForInput(dateString: string): string {
    const date = new Date(dateString);
    return date.toISOString().split('T')[0];
  }

  // Format date for display (DD Month YYYY)
  formatDate(dateString: string): string {
    const date = new Date(dateString);
    const months = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    
    const day = date.getDate().toString().padStart(2, '0');
    const month = months[date.getMonth()];
    const year = date.getFullYear();
    return `${day} ${month} ${year}`;
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