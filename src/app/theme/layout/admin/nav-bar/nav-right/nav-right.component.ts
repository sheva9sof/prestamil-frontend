// angular import
import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';

// bootstrap import
import { NgbDropdownConfig } from '@ng-bootstrap/ng-bootstrap';

// project import
import { SharedModule } from 'src/app/theme/shared/shared.module';
import { AuthService } from 'src/app/prestamil/core/services/auth.service';

@Component({
  selector: 'app-nav-right',
  imports: [SharedModule],
  templateUrl: './nav-right.component.html',
  styleUrls: ['./nav-right.component.scss'],
  providers: [NgbDropdownConfig]
})
export class NavRightComponent {
  // public props
  get user() {
    return this.authService.getUser();
  }

  get fullName(): string {
    const user = this.user;
    if (user) {
      return `${user.nombre || ''} ${user.apellidos || ''}`.trim();
    }
    return '';
  }

  // constructor
  constructor(
    private router: Router,
    private authService: AuthService
  ) {
    const config = inject(NgbDropdownConfig);

    config.placement = 'bottom-right';
  }

  // public method
  goToUpdatePassword() {
    this.router.navigate(['/configuracion/actualizar-password']);
  }

  logout() {
    this.authService.logout();
    this.router.navigate(['/login']);
  }
}
