import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger, type OnModuleInit } from '@nestjs/common';
import type { Job } from 'bullmq';
import Handlebars from 'handlebars';
import { createTransport, type Transporter } from 'nodemailer';
import { AppConfigService } from '../config/app-config.service';
import { MAIL_QUEUE, MAIL_SUBJECTS, type MailJobs, type MailTemplate } from './mail.constants';

type Renderer = Handlebars.TemplateDelegate<Record<string, unknown>>;

/** Consumer side: renders a Handlebars template and delivers it over SMTP. */
@Processor(MAIL_QUEUE)
export class MailProcessor extends WorkerHost implements OnModuleInit {
  private readonly logger = new Logger(MailProcessor.name);
  private readonly templates = new Map<string, Renderer>();
  private layout!: Renderer;
  private transporter!: Transporter;

  constructor(private readonly config: AppConfigService) {
    super();
  }

  onModuleInit(): void {
    const dir = join(__dirname, 'templates');
    for (const file of readdirSync(dir).filter((f) => f.endsWith('.hbs'))) {
      const name = file.replace(/\.hbs$/, '');
      const compiled: Renderer = Handlebars.compile<Record<string, unknown>>(
        readFileSync(join(dir, file), 'utf8'),
      );
      if (name === 'layout') this.layout = compiled;
      else this.templates.set(name, compiled);
    }

    const { host, port, secure, user, pass } = this.config.mail;
    this.transporter = createTransport({
      host,
      port,
      secure,
      auth: user ? { user, pass } : undefined,
    });
  }

  async process(job: Job<MailJobs[MailTemplate], void, MailTemplate>): Promise<void> {
    const template = this.templates.get(job.name);
    if (!template) throw new Error(`Unknown mail template "${job.name}"`);

    const context = { ...job.data, appName: 'IAM Platform', year: new Date().getFullYear() };
    const html = this.layout({ ...context, body: template(context) });

    await this.transporter.sendMail({
      from: this.config.mail.from,
      to: job.data.to,
      subject: MAIL_SUBJECTS[job.name],
      html,
    });
    this.logger.log(`Sent "${job.name}" email (job ${job.id})`);
  }
}
