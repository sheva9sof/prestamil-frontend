// angular import
import { Component, inject, TemplateRef, ViewChild } from '@angular/core';
import { Router } from '@angular/router';

// bootstrap import
import { NgbDropdownConfig, NgbModal } from '@ng-bootstrap/ng-bootstrap';

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
  @ViewChild('logoutModal') logoutModal!: TemplateRef<unknown>;

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
    private authService: AuthService,
    private modalService: NgbModal
  ) {
    const config = inject(NgbDropdownConfig);

    config.placement = 'bottom-right';
  }

  // public method
  goToUpdatePassword() {
    this.router.navigate(['/configuracion/actualizar-password']);
  }

  logout() {
    this.modalService.open(this.logoutModal, { centered: true, size: 'sm' }).result.then(
      (result) => {
        if (result === 'confirm') {
          this.authService.logout();
          this.router.navigate(['/login']);
        }
      },
      () => {}
    );
  }
}
