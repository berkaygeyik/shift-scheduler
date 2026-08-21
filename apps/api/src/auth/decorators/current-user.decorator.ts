import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';
import { AccessTokenPayload } from '../auth.service';

export const CurrentUser = createParamDecorator(
  (_: unknown, context: ExecutionContext): AccessTokenPayload => {
    const request = context.switchToHttp().getRequest<Request>();
    return request.user as AccessTokenPayload;
  },
);
