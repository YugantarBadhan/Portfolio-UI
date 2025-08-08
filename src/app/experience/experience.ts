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
    
    // Simplified form validation to match backend requirements
    this.experienceForm = this.fb.group({
      companyName: ['', [Validators.required]], // Just required, no minLength
      role: ['', [Validators.required]], // Just required, no minLength  
      startDate: ['', [Validators.required]], // Required
      endDate: [''], // No validation initially
      current: [false],
      description: ['', [Validators.required]], // Required but no minLength
      skills: this.fb.array([this.fb.control('', [Validators.required])])
    });

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
  }

  private checkAdminStatus() {
    if (!this.isBrowser) {
      return;
    }
    
    const adminToken = localStorage.getItem('adminToken');
    this.isAdmin.set(adminToken === this.configService.adminToken);
  }

  toggleAdminMode() {
    if (!this.isBrowser) {
      return;
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
    const skillControl = this.fb.control('', [Validators.required]);
    this.skillsArray.push(skillControl);
  }

  removeSkill(index: number) {
    if (this.skillsArray.length > 1) {
      this.skillsArray.removeAt(index);
    }
  }

  // Simplified skills validation
  hasValidSkills(): boolean {
    if (this.skillsArray.length === 0) return false;
    
    // Check if at least one skill has a valid value (non-empty and trimmed)
    const validSkills = this.skillsArray.controls.filter(control => {
      const value = control.value;
      return value && typeof value === 'string' && value.trim().length > 0;
    });
    
    return validSkills.length > 0;
  }

  // Much simpler form validation matching backend requirements exactly
  isFormValid(): boolean {
    const formValue = this.experienceForm.value;
    
    // Check required fields exactly as backend expects
    const companyName = formValue.companyName?.trim();
    const role = formValue.role?.trim();
    const startDate = formValue.startDate;
    const description = formValue.description?.trim();
    const current = formValue.current;
    const endDate = formValue.endDate;

    // Basic validation - all required fields must have values
    const hasCompanyName = !!companyName;
    const hasRole = !!role;
    const hasStartDate = !!startDate;
    const hasDescription = !!description;
    
    // End date is only required if not currently working
    const hasValidEndDate = current === true || !!endDate;
    
    // At least one valid skill
    const hasValidSkills = this.hasValidSkills();

    const isValid = hasCompanyName && hasRole && hasStartDate && hasDescription && hasValidEndDate && hasValidSkills;
    
    // Debug logging
    console.log('=== FORM VALIDATION DEBUG ===');
    console.log('Company Name:', { value: companyName, valid: hasCompanyName });
    console.log('Role:', { value: role, valid: hasRole });
    console.log('Start Date:', { value: startDate, valid: hasStartDate });
    console.log('Description:', { value: description, valid: hasDescription });
    console.log('Current:', { value: current });
    console.log('End Date:', { value: endDate, required: !current, valid: hasValidEndDate });
    console.log('Skills:', { 
      count: this.skillsArray.length, 
      values: this.skillsArray.controls.map(c => c.value),
      valid: hasValidSkills 
    });
    console.log('FORM IS VALID:', isValid);
    console.log('=== END DEBUG ===');

    return isValid;
  }

  onSkillChange() {
    // Simple change detection trigger
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
    
    // Trigger validation update
    this.onSkillChange();
  }

  openForm(experience?: Experience) {
    this.resetForm();
    
    if (this.isBrowser) {
      document.body.style.overflow = 'hidden';
    }
    
    if (experience) {
      this.editingId.set(experience.id);
      
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
      if (experience.skills && experience.skills.length > 0) {
        experience.skills.forEach(skill => {
          this.skillsArray.push(this.fb.control(skill, [Validators.required]));
        });
      } else {
        // Add at least one empty skill field
        this.skillsArray.push(this.fb.control('', [Validators.required]));
      }
    } else {
      this.editingId.set(null);
      // Form already has one empty skill field from constructor
    }
    this.showForm.set(true);
  }

  closeForm() {
    this.showForm.set(false);
    this.resetForm();
    
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
    // Add one empty skill field
    this.skillsArray.push(this.fb.control('', [Validators.required]));
    this.experienceForm.patchValue({ current: false });
    this.editingId.set(null);
  }

  async onSubmit() {
    console.log('=== FORM SUBMISSION ===');
    console.log('Form value:', this.experienceForm.value);
    console.log('Form valid check:', this.isFormValid());
    
    if (!this.isFormValid()) {
      console.log('Form validation failed - marking fields as touched');
      
      // Mark all fields as touched to show validation errors
      this.markAllFieldsAsTouched();
      
      alert('Please fill all required fields correctly');
      return;
    }

    this.isLoading.set(true);
    try {
      const formValue = this.experienceForm.value;
      
      // Get valid skills (filter out empty ones)
      const validSkills: string[] = [];
      this.skillsArray.controls.forEach(control => {
        const skill = control.value;
        if (skill && typeof skill === 'string' && skill.trim().length > 0) {
          validSkills.push(skill.trim());
        }
      });
      
      console.log('Processed valid skills:', validSkills);
      
      const experienceData = {
        companyName: formValue.companyName.trim(),
        role: formValue.role.trim(),
        startDate: formValue.startDate, // Already in YYYY-MM-DD format from date input
        endDate: formValue.current ? null : formValue.endDate,
        current: formValue.current,
        description: formValue.description.trim(),
        skills: validSkills
      };

      console.log('Final experience data to send:', experienceData);

      if (this.editingId()) {
        await this.experienceService.updateExperience(this.editingId()!, experienceData);
      } else {
        await this.experienceService.createExperience(experienceData);
      }
      
      await this.loadExperiences();
      this.closeForm();
      alert('Experience saved successfully!');
    } catch (error: any) {
      console.error('Submission error:', error);
      alert(error.message || 'An error occurred while saving');
    } finally {
      this.isLoading.set(false);
    }
  }

  private markAllFieldsAsTouched() {
    // Mark all form controls as touched
    Object.keys(this.experienceForm.controls).forEach(key => {
      const control = this.experienceForm.get(key);
      if (control) {
        control.markAsTouched();
      }
    });
    
    // Mark skills array controls as touched
    this.skillsArray.controls.forEach(control => {
      control.markAsTouched();
    });
  }

  async deleteExperience(id: number, companyName: string) {
    if (confirm(`Are you sure you want to delete the experience at ${companyName}?`)) {
      this.isLoading.set(true);
      try {
        await this.experienceService.deleteExperience(id);
        await this.loadExperiences();
        alert('Experience deleted successfully!');
      } catch (error: any) {
        alert(error.message || 'Failed to delete experience');
      } finally {
        this.isLoading.set(false);
      }
    }
  }

  private formatDateForInput(dateString: string): string {
    const date = new Date(dateString);
    return date.toISOString().split('T')[0]; // This gives YYYY-MM-DD format
  }

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

  // Helper method to check if it's the last item for timeline rendering
  isLastExperience(index: number): boolean {
    return index === this.experiences().length - 1;
  }

  // Helper method for skills error display
  shouldShowSkillsError(): boolean {
    return this.skillsArray.length > 0 && !this.hasValidSkills() && this.skillsArray.controls.some(control => control.touched);
  }
}