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
    const skillControl = this.fb.control('', [Validators.required, Validators.minLength(1)]);
    this.skillsArray.push(skillControl);
  }

  removeSkill(index: number) {
    this.skillsArray.removeAt(index);
  }

  // Simplified validation methods
  hasValidSkills(): boolean {
    if (this.skillsArray.length === 0) return false;
    
    // Check if at least one skill has a valid value
    for (let i = 0; i < this.skillsArray.length; i++) {
      const value = this.skillsArray.at(i).value;
      if (value && value.trim().length > 0) {
        return true;
      }
    }
    return false;
  }

  isFormValid(): boolean {
    // Check basic form fields
    const companyName = this.experienceForm.get('companyName');
    const role = this.experienceForm.get('role');
    const startDate = this.experienceForm.get('startDate');
    const description = this.experienceForm.get('description');
    const current = this.experienceForm.get('current');
    const endDate = this.experienceForm.get('endDate');

    const basicValid = companyName?.valid && 
                      role?.valid && 
                      startDate?.valid && 
                      description?.valid;

    // Check end date only if not currently working
    const dateValid = current?.value || endDate?.valid;

    // Check skills
    const skillsValid = this.hasValidSkills();

    return !!(basicValid && dateValid && skillsValid);
  }

  onSkillChange() {
    // Simple trigger for change detection
    this.experienceForm.updateValueAndValidity();
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
      experience.skills.forEach(skill => {
        this.skillsArray.push(this.fb.control(skill, [Validators.required, Validators.minLength(1)]));
      });
    } else {
      this.editingId.set(null);
      // Add one empty skill field by default
      this.addSkill();
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
    this.experienceForm.patchValue({ current: false });
    this.editingId.set(null);
  }

  async onSubmit() {    
    if (this.isFormValid()) {
      this.isLoading.set(true);
      try {
        const formValue = this.experienceForm.value;
        
        // Get valid skills
        const validSkills: string[] = [];
        for (let i = 0; i < this.skillsArray.length; i++) {
          const skill = this.skillsArray.at(i).value;
          if (skill && skill.trim().length > 0) {
            validSkills.push(skill.trim());
          }
        }
        
        const experienceData = {
          companyName: formValue.companyName,
          role: formValue.role,
          startDate: formValue.startDate,
          endDate: formValue.current ? null : formValue.endDate,
          current: formValue.current,
          description: formValue.description,
          skills: validSkills
        };

        if (this.editingId()) {
          await this.experienceService.updateExperience(this.editingId()!, experienceData);
        } else {
          await this.experienceService.createExperience(experienceData);
        }
        
        await this.loadExperiences();
        this.closeForm();
      } catch (error: any) {
        console.error('Submission error:', error);
        alert(error.message || 'An error occurred');
      } finally {
        this.isLoading.set(false);
      }
    } else {
      alert('Please fill all required fields correctly');
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

  private formatDateForInput(dateString: string): string {
    const date = new Date(dateString);
    return date.toISOString().split('T')[0];
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
    return this.skillsArray.length > 0 && !this.hasValidSkills();
  }
}