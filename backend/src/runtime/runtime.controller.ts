import { Body, Controller, Get, Post } from '@nestjs/common';
import { RuntimePresenceService } from './runtime-presence.service';

@Controller('runtime')
export class RuntimeController {
  constructor(private readonly runtime: RuntimePresenceService) {}

  @Post('heartbeat')
  heartbeat(@Body() body: { clientId?: string; active?: boolean }) {
    this.runtime.heartbeat(body.clientId ?? 'anonymous', body.active !== false);
    return { ok: true };
  }

  /** Lo consulta scripts/start.mjs para cerrar el servidor cuando ya no queda ninguna pestaña abierta */
  @Get('active-clients')
  activeClients() {
    return { count: this.runtime.activeCount() };
  }

  @Get('status')
  status() {
    return this.runtime.snapshot();
  }
}
