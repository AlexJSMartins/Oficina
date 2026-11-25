// backend/src/modules/billing/subscription-lock.interceptor.ts

/* Usamos um Interceptor global em vez de APP_GUARD
 porque no NestJS os interceptors rodam depois do JwtAuthGuard — 
 garantindo que req.user já esteja autenticado e disponível 
 sem precisar alterar os demais controllers.*/
import {
    Injectable,
    NestInterceptor,
    ExecutionContext,
    CallHandler,
    ForbiddenException,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { BillingService } from './billing.service';

@Injectable()
export class SubscriptionLockInterceptor implements NestInterceptor {
    constructor(private readonly billingService: BillingService) { }

    async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<any>> {
        const req = context.switchToHttp().getRequest();
        const user = req?.user;

        // Rotas públicas ou acesso master (/console) nunca sofrem bloqueio de assinatura
        if (!user || user.role === 'SUPER_ADMIN' || !user.workshopId) {
            return next.handle();
        }

        const method = String(req.method || 'GET').toUpperCase();
        const path = String(req.originalUrl || req.url || '').toLowerCase();

        // Rotas sempre liberadas mesmo com assinatura expirada (para pagar, consultar perfil ou sair)
        const isAlwaysAllowed =
            path.includes('/billing') ||
            path.includes('/auth/me') ||
            path.includes('/auth/login') ||
            path.includes('/super-admin') ||
            path.includes('/sys-auth');

        if (isAlwaysAllowed) {
            return next.handle();
        }

        // Permite leitura (GET) apenas para consulta/exportação; bloqueia qualquer gravação/emissão em contas expiradas
        if (method !== 'GET' && method !== 'HEAD' && method !== 'OPTIONS') {
            const sub = await this.billingService.getWorkshopSubscriptionStatus(user.workshopId);
            if (sub.entitlements.isLocked) {
                throw new ForbiddenException({
                    code: 'SUBSCRIPTION_EXPIRED',
                    message:
                        'Sua assinatura ou período gratuito expirou. Acesse "Minha Assinatura" para reativar imediatamente.',
                });
            }
        }

        return next.handle();
    }
}