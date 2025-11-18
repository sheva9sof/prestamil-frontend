// Angular Import
import { Component, Input, inject, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NavigationEnd, Router, RouterModule, Event } from '@angular/router';
import { Title } from '@angular/platform-browser';
import { Subscription } from 'rxjs';

// project import
import { NavigationItem, NavigationItems } from 'src/app/theme/layout/admin/navigation/navigation';
import { SharedModule } from '../../shared.module';
import { AuthService } from 'src/app/prestamil/core/services/auth.service';

interface titleType {
  // eslint-disable-next-line
  url: string | boolean | any | undefined;
  title: string;
  breadcrumbs: unknown;
  type: string;
}

@Component({
  selector: 'app-breadcrumb',
  imports: [CommonModule, RouterModule, SharedModule],
  templateUrl: './breadcrumbs.component.html',
  styleUrls: ['./breadcrumbs.component.scss']
})
export class BreadcrumbsComponent implements OnInit, OnDestroy {
  private route = inject(Router);
  private titleService = inject(Title);
  private authService = inject(AuthService);
  private menuSubscription?: Subscription;

  // public props
  @Input() type: string;

  navigations: NavigationItem[] = [];
  breadcrumbList: string[] = [];
  navigationList!: titleType[];

  // constructor
  constructor() {
    this.type = 'theme1';
  }

  ngOnInit() {
    // Suscribirse a los cambios del menú dinámico
    this.menuSubscription = this.authService.menuItems$.subscribe(menuItems => {
      if (menuItems && menuItems.length > 0) {
        this.navigations = menuItems;
      } else {
        // Usar menú estático como fallback
        this.navigations = NavigationItems;
      }
    });
    
    // Cargar menú inicial si existe
    const menuItems = this.authService.getMenuItems();
    if (menuItems && menuItems.length > 0) {
      this.navigations = menuItems;
    } else {
      this.navigations = NavigationItems;
    }
    
    this.setBreadcrumb();
  }

  ngOnDestroy() {
    if (this.menuSubscription) {
      this.menuSubscription.unsubscribe();
    }
  }

  // public method
  setBreadcrumb() {
    this.route.events.subscribe((router: Event) => {
      if (router instanceof NavigationEnd) {
        const activeLink = router.url;
        const breadcrumbList = this.filterNavigation(this.navigations, activeLink);
        this.navigationList = breadcrumbList;
        const title = breadcrumbList[breadcrumbList.length - 1]?.title || 'Welcome';
        this.titleService.setTitle(title + ' | Berry Angular Admin Template');
      }
    });
  }

  filterNavigation(navItems: NavigationItem[], activeLink: string): titleType[] {
    // Normalizar la URL activa (remover query params y hash)
    const normalizedActiveLink = activeLink.split('?')[0].split('#')[0];
    
    for (const navItem of navItems) {
      // Comparar URLs normalizadas
      if (navItem.type === 'item' && navItem.url) {
        const normalizedNavUrl = navItem.url.split('?')[0].split('#')[0];
        if (normalizedNavUrl === normalizedActiveLink) {
          return [
            {
              url: navItem.url || false,
              title: navItem.title,
              breadcrumbs: navItem.breadcrumbs !== false,
              type: navItem.type
            }
          ];
        }
      }
      if ((navItem.type === 'group' || navItem.type === 'collapse') && navItem.children) {
        const breadcrumbList = this.filterNavigation(navItem.children, normalizedActiveLink);
        if (breadcrumbList.length > 0) {
          breadcrumbList.unshift({
            url: navItem.url || false,
            title: navItem.title,
            breadcrumbs: navItem.breadcrumbs !== false,
            type: navItem.type
          });
          return breadcrumbList;
        }
      }
    }
    return [];
  }
}
