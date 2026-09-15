import { Module } from '@nestjs/common';
import { DomainEventsListener } from './events.listener';

@Module({ providers: [DomainEventsListener], exports: [DomainEventsListener] })
export class EventsModule {}
