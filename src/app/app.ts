import {
  Component,
  OnInit,
  HostListener,
  Inject,
  PLATFORM_ID,
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { ExperienceComponent } from './experience/experience';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, ExperienceComponent],
  templateUrl: './app.html',
  styleUrls: ['./app.css'],
})
export class AppComponent implements OnInit {
  title = 'Portfolio-UI';
  isDarkTheme = true; // Default to dark theme
  isScrolled = false;
  isMobileMenuOpen = false;

  constructor(@Inject(PLATFORM_ID) private platformId: Object) {}

  ngOnInit() {
    // Set dark theme as default
    this.isDarkTheme = true;

    // Only access localStorage in browser environment
    if (isPlatformBrowser(this.platformId)) {
      // Load saved theme preference, default to dark
      const savedTheme = localStorage.getItem('theme');
      this.isDarkTheme = savedTheme === null || savedTheme === 'dark';
    }

    // Apply theme to body - always call this
    this.applyTheme();
  }

  @HostListener('window:scroll')
  onWindowScroll() {
    if (isPlatformBrowser(this.platformId)) {
      this.isScrolled = window.scrollY > 50;
    }
  }

  toggleTheme() {
    this.isDarkTheme = !this.isDarkTheme;

    // Only access localStorage in browser environment
    if (isPlatformBrowser(this.platformId)) {
      localStorage.setItem('theme', this.isDarkTheme ? 'dark' : 'light');
    }

    this.applyTheme();
  }

  private applyTheme() {
    // Apply theme immediately, don't wait for browser check
    if (typeof document !== 'undefined') {
      document.body.classList.toggle('dark-theme', this.isDarkTheme);
    }
  }

  downloadResume() {
    if (isPlatformBrowser(this.platformId)) {
      const resumePath = 'assets/resume/Resume_Yugantar_Badhan.pdf';

      const link = document.createElement('a');
      link.href = resumePath;
      link.download = 'Resume_Yugantar_Badhan.pdf';
      link.target = '_blank';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      console.log('Resume download triggered.');
    }
  }

  toggleMobileMenu() {
    this.isMobileMenuOpen = !this.isMobileMenuOpen;
    
    if (isPlatformBrowser(this.platformId)) {
      // Prevent body scroll when mobile menu is open
      document.body.style.overflow = this.isMobileMenuOpen ? 'hidden' : 'auto';
    }
  }

  scrollToSection(sectionId: string, event: Event) {
    event.preventDefault();

    // Close mobile menu if open
    this.isMobileMenuOpen = false;
    if (isPlatformBrowser(this.platformId)) {
      document.body.style.overflow = 'auto';
    }

    // Only execute in browser environment
    if (isPlatformBrowser(this.platformId)) {
      const element = document.getElementById(sectionId);
      if (element) {
        const navbarHeight = 80; // Adjust based on your navbar height
        const elementPosition = element.offsetTop - navbarHeight;
        
        window.scrollTo({
          top: elementPosition,
          behavior: 'smooth'
        });
      }
    }
  }
}