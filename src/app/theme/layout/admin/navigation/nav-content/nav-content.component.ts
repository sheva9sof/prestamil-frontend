// angular import
import { Component, inject, output, OnInit, OnDestroy } from '@angular/core';
import { Location } from '@angular/common';
import { Subscription } from 'rxjs';

// project import
import { environment } from 'src/environments/environment';
import { NavigationItem, NavigationItems } from '../navigation';
import { SharedModule } from 'src/app/theme/shared/shared.module';
import { NavGroupComponent } from './nav-group/nav-group.component';
import { AuthService } from 'src/app/prestamil/core/services/auth.service';

@Component({
  selector: 'app-nav-content',
  imports: [SharedModule, NavGroupComponent],
  templateUrl: './nav-content.component.html',
  styleUrls: ['./nav-content.component.scss']
})
export class NavContentComponent implements OnInit, OnDestroy {
  private location = inject(Location);
  private authService = inject(AuthService);
  private menuSubscription?: Subscription;

  // public method
  // version
  title = 'Demo application for version numbering';
  currentApplicationVersion = environment.appVersion;

  navigations: NavigationItem[] = [];
  wrapperWidth: number;
  windowWidth = window.innerWidth;

  NavCollapsedMob = output();

  // constructor
  constructor() {
    // Inicializar con menú vacío, se actualizará desde el servicio
  }

  ngOnInit() {
    // Suscribirse a los cambios del menú
    this.menuSubscription = this.authService.menuItems$.subscribe(menuItems => {
      if (menuItems && menuItems.length > 0) {
        this.navigations = menuItems;
      } else {
        // Solo usar menú estático si el usuario NO está autenticado
        // Si está autenticado pero sin menú, dejar vacío (se cargará cuando llegue)
        if (!this.authService.isAuthenticated()) {
          this.navigations = NavigationItems;
        } else {
          this.navigations = [];
        }
      }
    });
    
    // Cargar menú inicial si existe
    const menuItems = this.authService.getMenuItems();
    if (menuItems && menuItems.length > 0) {
      this.navigations = menuItems;
    } else {
      // Solo usar menú estático si el usuario NO está autenticado
      if (!this.authService.isAuthenticated()) {
    this.navigations = NavigationItems;
      } else {
        // Si está autenticado pero sin menú aún, dejar vacío
        this.navigations = [];
      }
    }
  }

  ngOnDestroy() {
    if (this.menuSubscription) {
      this.menuSubscription.unsubscribe();
    }
  }

  fireOutClick() {
    let current_url = this.location.path();
    if (this.location['_baseHref']) {
      current_url = this.location['_baseHref'] + this.location.path();
    }
    const link = "a.nav-link[ href='" + current_url + "' ]";
    const ele = document.querySelector(link);
    if (ele !== null && ele !== undefined) {
      const parent = ele.parentElement;
      const up_parent = parent.parentElement.parentElement;
      const last_parent = up_parent.parentElement;
      if (parent.classList.contains('pcoded-hasmenu')) {
        parent.classList.add('pcoded-trigger');
        parent.classList.add('active');
      } else if (up_parent.classList.contains('pcoded-hasmenu')) {
        up_parent.classList.add('pcoded-trigger');
        up_parent.classList.add('active');
      } else if (last_parent.classList.contains('pcoded-hasmenu')) {
        last_parent.classList.add('pcoded-trigger');
        last_parent.classList.add('active');
      }
    }
  }
}
