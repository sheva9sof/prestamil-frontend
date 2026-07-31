// angular import
import { Component, OnInit, OnDestroy } from '@angular/core';
import { RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';

// project import
import { NavBarComponent } from './nav-bar/nav-bar.component';
import { NavigationComponent } from './navigation/navigation.component';
import { ConfigurationComponent } from 'src/app/theme/layout/admin/configuration/configuration.component';
import { BreadcrumbsComponent } from '../../shared/components/breadcrumbs/breadcrumbs.component';
import { Footer } from './footer/footer';
import { AuthStreamService } from 'src/app/prestamil/core/services/auth-stream.service';
import { SessionWarningModalComponent } from 'src/app/prestamil/core/components/session-warning-modal/session-warning-modal.component';

@Component({
  selector: 'app-admin',
  imports: [NavBarComponent, NavigationComponent, RouterModule, CommonModule, ConfigurationComponent, BreadcrumbsComponent, Footer, SessionWarningModalComponent],
  templateUrl: './admin.component.html',
  styleUrls: ['./admin.component.scss']
})
export class AdminComponent implements OnInit, OnDestroy {
  // public props
  navCollapsed;
  navCollapsedMob: boolean;
  windowWidth: number;
  isLoggingOut = false;
  private sseSubscription?: Subscription;

  // constructor
  constructor(private authStreamService: AuthStreamService) {
    this.windowWidth = window.innerWidth;
    this.navCollapsedMob = false;
  }

  ngOnInit(): void {
    // Suscribirse al observable de logout del servicio SSE
    this.sseSubscription = this.authStreamService.isLoggingOut$.subscribe(isLoggingOut => {
      console.log('[AdminComponent] Estado de logout:', isLoggingOut);
      this.isLoggingOut = isLoggingOut;
    });
  }

  ngOnDestroy(): void {
    if (this.sseSubscription) {
      this.sseSubscription.unsubscribe();
    }
  }

  // public method
  navMobClick() {
    if (this.navCollapsedMob && !document.querySelector('app-navigation.pcoded-navbar').classList.contains('mob-open')) {
      this.navCollapsedMob = !this.navCollapsedMob;
      setTimeout(() => {
        this.navCollapsedMob = !this.navCollapsedMob;
      }, 100);
    } else {
      this.navCollapsedMob = !this.navCollapsedMob;
    }
  }

  // this is for eslint rule
  handleKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      this.closeMenu();
    }
  }

  closeMenu() {
    if (document.querySelector('app-navigation.pcoded-navbar').classList.contains('mob-open')) {
      document.querySelector('app-navigation.pcoded-navbar').classList.remove('mob-open');
    }
  }
}
