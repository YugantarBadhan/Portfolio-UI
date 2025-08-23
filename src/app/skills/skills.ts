import {
  Component,
  OnInit,
  inject,
  signal,
  PLATFORM_ID,
  Inject,
  ViewChild,
  ElementRef,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  OnDestroy,
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import {
  ReactiveFormsModule,
  FormBuilder,
  FormGroup,
  Validators,
} from '@angular/forms';
import { SkillService } from '../services/skill.service';
import { Skill } from '../model/skill.model';
import { ConfigService } from '../services/config.service';

@Component({
  selector: 'app-skills',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './skills.html',
  styleUrls: ['./skills.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SkillsComponent implements OnInit, OnDestroy {
  private skillService = inject(SkillService);
  private fb = inject(FormBuilder);
  private configService = inject(ConfigService);
  private cdr = inject(ChangeDetectorRef);

  skills = signal<Skill[]>([]);
  isLoading = signal(false);
  showForm = signal(false);
  showSkillSelectionModal = signal(false);
  editingId = signal<number | null>(null);
  isAdmin = signal(false);
  selectedOperation = signal<string>('');
  selectedSkillId = signal<number | null>(null);
  private isBrowser: boolean;

  // Performance optimization: Track if data has been loaded
  private dataLoaded = false;
  private animationFrameId?: number;

  // Grouped skills by category
  groupedSkills = signal<Map<string, Skill[]>>(new Map());

  skillForm: FormGroup;

  constructor(@Inject(PLATFORM_ID) platformId: Object) {
    this.isBrowser = isPlatformBrowser(platformId);

    this.skillForm = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(1)]],
      category: [''],
      proficiency: [
        0,
        [Validators.required, Validators.min(1), Validators.max(5)],
      ],
    });
  }

  ngOnInit() {
    // Only load skills if not already loaded (performance optimization)
    if (!this.dataLoaded) {
      this.loadSkills();
      this.dataLoaded = true;
    }
    this.checkAdminStatus();
  }

  ngOnDestroy() {
    if (this.isBrowser) {
      document.body.style.overflow = 'auto';
    }
    // Clean up animation frame if exists
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }
  }

  // Public methods to be called from parent component
  enableAdminMode() {
    this.checkAdminStatus();
    this.isAdmin.set(true);
    this.cdr.markForCheck();
  }

  disableAdminMode() {
    this.isAdmin.set(false);
    this.closeForm();
    this.closeSkillSelectionModal();
    this.cdr.markForCheck();
  }

  // Handle operation from parent
  async handleCreateOperation() {
    this.openForm();
  }

  async handleUpdateOperation() {
    if (this.skills().length === 0) {
      alert('No skills available to update');
      return false;
    }
    this.selectedOperation.set('update');
    this.showSkillSelectionModal.set(true);
    if (this.isBrowser) {
      document.body.style.overflow = 'hidden';
    }
    this.cdr.markForCheck();
    return true;
  }

  async handleDeleteOperation() {
    if (this.skills().length === 0) {
      alert('No skills available to delete');
      return false;
    }
    this.selectedOperation.set('delete');
    this.showSkillSelectionModal.set(true);
    if (this.isBrowser) {
      document.body.style.overflow = 'hidden';
    }
    this.cdr.markForCheck();
    return true;
  }

  // Handle skill selection for update/delete
  async handleSkillSelection(skillId: number, operation: 'update' | 'delete') {
    const skill = this.skills().find((s) => s.id === skillId);
    if (!skill) {
      alert('Skill not found');
      return;
    }

    if (operation === 'update') {
      this.openForm(skill);
    } else if (operation === 'delete') {
      await this.deleteSkill(skillId, skill.name);
    }
  }

  // Refresh skills - optimized to check if already loading
  async refreshSkills() {
    // Reset data loaded flag to force reload
    this.dataLoaded = false;
    await this.loadSkills();
    this.dataLoaded = true;
  }

  // Track by function for ngFor performance
  trackBySkillId(index: number, skill: Skill): number {
    return skill.id;
  }

  // Track by function for category
  trackByCategory(index: number, item: any): string {
    return item.key;
  }

  private checkAdminStatus() {
    if (!this.isBrowser) {
      return;
    }

    const adminToken = localStorage.getItem('adminToken');
    const isAuthenticated = adminToken === this.configService.adminToken;
    this.isAdmin.set(isAuthenticated);
    this.cdr.markForCheck();
  }

  async loadSkills() {
    // Prevent duplicate loading
    if (this.isLoading()) {
      return;
    }

    this.isLoading.set(true);
    try {
      const skills = await this.skillService.getAllSkills();

      // Sort skills by proficiency (highest first) and then by name
      skills.sort((a, b) => {
        if (b.proficiency !== a.proficiency) {
          return b.proficiency - a.proficiency;
        }
        return a.name.localeCompare(b.name);
      });

      this.skills.set(skills);
      this.groupSkillsByCategory(skills);

      // Use requestAnimationFrame for smooth rendering
      if (this.isBrowser) {
        this.animationFrameId = requestAnimationFrame(() => {
          this.cdr.markForCheck();
        });
      } else {
        this.cdr.markForCheck();
      }
    } catch (error) {
      console.error('Error loading skills:', error);
      this.skills.set([]);
      this.groupedSkills.set(new Map());
    } finally {
      this.isLoading.set(false);
      this.cdr.markForCheck();
    }
  }

  private groupSkillsByCategory(skills: Skill[]) {
    const grouped = new Map<string, Skill[]>();

    skills.forEach((skill) => {
      const category = skill.category || 'Other';
      if (!grouped.has(category)) {
        grouped.set(category, []);
      }
      grouped.get(category)!.push(skill);
    });

    // Sort categories
    const sortedGrouped = new Map(
      [...grouped.entries()].sort((a, b) => {
        // Put 'Frontend' and 'Backend' first, then other categories, 'Other' last
        const order = ['Frontend', 'Backend'];
        const aIndex = order.indexOf(a[0]);
        const bIndex = order.indexOf(b[0]);

        if (a[0] === 'Other') return 1;
        if (b[0] === 'Other') return -1;
        if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;
        if (aIndex !== -1) return -1;
        if (bIndex !== -1) return 1;
        return a[0].localeCompare(b[0]);
      })
    );

    this.groupedSkills.set(sortedGrouped);
  }

  openForm(skill?: Skill) {
    this.resetForm();

    if (this.isBrowser) {
      document.body.style.overflow = 'hidden';
    }

    if (skill) {
      this.editingId.set(skill.id);
      this.skillForm.patchValue({
        name: skill.name,
        category: skill.category || '',
        proficiency: skill.proficiency,
      });
    } else {
      this.editingId.set(null);
      // Set default proficiency to 0 (no stars selected) instead of 3
      this.skillForm.patchValue({ proficiency: 0 });
    }

    this.showForm.set(true);
    this.cdr.markForCheck();
  }

  closeForm() {
    this.showForm.set(false);
    this.resetForm();

    if (this.isBrowser) {
      document.body.style.overflow = 'auto';
    }
    this.cdr.markForCheck();
  }

  resetForm() {
    this.skillForm.reset();
    this.skillForm.patchValue({
      name: '',
      category: '',
      proficiency: 0,
    });
    this.editingId.set(null);
  }

  setProficiency(value: number) {
    this.skillForm.patchValue({ proficiency: value });
    this.cdr.markForCheck();
  }

  get currentProficiency(): number {
    return this.skillForm.get('proficiency')?.value || 0;
  }

  async onSubmit() {
    if (!this.skillForm.valid) {
      this.markAllFieldsAsTouched();
      alert('Please fill all required fields correctly');
      return;
    }

    this.isLoading.set(true);
    try {
      const formValue = this.skillForm.value;

      const skillData = {
        name: formValue.name.trim(),
        category: formValue.category?.trim() || null,
        proficiency: formValue.proficiency,
      };

      if (this.editingId()) {
        await this.skillService.updateSkill(this.editingId()!, skillData);
      } else {
        await this.skillService.createSkill(skillData);
      }

      await this.loadSkills();
      this.closeForm();
      alert('Skill saved successfully!');
    } catch (error: any) {
      console.error('Submission error:', error);
      alert(error.message || 'An error occurred while saving');
    } finally {
      this.isLoading.set(false);
      this.cdr.markForCheck();
    }
  }

  private markAllFieldsAsTouched() {
    Object.keys(this.skillForm.controls).forEach((key) => {
      const control = this.skillForm.get(key);
      if (control) {
        control.markAsTouched();
      }
    });
    this.cdr.markForCheck();
  }

  openSkillSelectionModal() {
    this.showSkillSelectionModal.set(true);
    if (this.isBrowser) {
      document.body.style.overflow = 'hidden';
    }
    this.cdr.markForCheck();
  }

  closeSkillSelectionModal() {
    this.showSkillSelectionModal.set(false);
    this.selectedOperation.set('');
    this.selectedSkillId.set(null);

    if (this.isBrowser) {
      document.body.style.overflow = 'auto';
    }
    this.cdr.markForCheck();
  }

  selectSkill(skillId: number) {
    this.selectedSkillId.set(skillId);
    const operation = this.selectedOperation();

    this.closeSkillSelectionModal();

    const skill = this.skills().find((s) => s.id === skillId);
    if (!skill) {
      alert('Skill not found');
      return;
    }

    if (operation === 'update') {
      this.openForm(skill);
    } else if (operation === 'delete') {
      this.deleteSkill(skillId, skill.name);
    }
  }

  async deleteSkill(id: number, name: string) {
    const confirmMessage = `Are you sure you want to delete the skill "${name}"?\n\nThis action cannot be undone.`;
    if (confirm(confirmMessage)) {
      this.isLoading.set(true);
      try {
        await this.skillService.deleteSkill(id);
        await this.loadSkills();
        alert('Skill deleted successfully!');
      } catch (error: any) {
        console.error('Delete error:', error);
        alert(error.message || 'Failed to delete skill');
      } finally {
        this.isLoading.set(false);
        this.cdr.markForCheck();
      }
    }
  }

  // FIXED: Updated rating stars method to show only the number of stars equal to proficiency
  getRatingStars(proficiency: number): number[] {
    // Return array with length equal to proficiency, all filled (1)
    return Array(proficiency).fill(1);
  }

  getCategoryIcon(category: string | null): string {
    if (!category) return 'fas fa-code';

    const categoryLower = category.toLowerCase();
    if (categoryLower.includes('frontend')) return 'fas fa-laptop-code';
    if (categoryLower.includes('backend')) return 'fas fa-server';
    if (categoryLower.includes('database')) return 'fas fa-database';
    if (categoryLower.includes('devops')) return 'fas fa-cogs';
    if (categoryLower.includes('mobile')) return 'fas fa-mobile-alt';
    if (categoryLower.includes('cloud')) return 'fas fa-cloud';
    if (categoryLower.includes('tool')) return 'fas fa-tools';
    return 'fas fa-code';
  }
}
