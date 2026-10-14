import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import type { Queue } from 'bullmq';
import { MAIL_QUEUE, type MailJobs, type MailTemplate } from './mail.constants';

/** Producer side: request handlers enqueue emails and return immediately. */
@Injectable()
export class MailService {
  constructor(@InjectQueue(MAIL_QUEUE) private readonly queue: Queue) {}

  async send<T extends MailTemplate>(template: T, data: MailJobs[T]): Promise<void> {
    await this.queue.add(template, data, {
      attempts: 5,
      backoff: { type: 'exponential', delay: 2000 },
      removeOnComplete: 1000,
      removeOnFail: 5000,
    });
  }
}
