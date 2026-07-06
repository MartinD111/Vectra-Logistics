import { Worker, Job } from 'bullmq';
import { queueConnection } from '../core/queue';
import { outlookRepository } from '../domains/outlook/outlook.repository';
import { outlookService } from '../domains/outlook/outlook.service';

interface EmailSyncPayload {
  // Empty — this is a system-triggered sweep job, no input needed.
}

export const startEmailWorker = (): Worker => {
  const worker = new Worker<EmailSyncPayload>(
    'email-sync',
    async (_job: Job<EmailSyncPayload>) => {
      console.log('[EmailSync] Starting mailbox sweep…');

      const mailboxes = await outlookRepository.listConnectedMailboxes();

      if (mailboxes.length === 0) {
        console.log('[EmailSync] No connected mailboxes — skipping sweep');
        return;
      }

      await Promise.allSettled(
        mailboxes.map((mb) => outlookService.syncEmails(mb.company_id, null)),
      );

      console.log(`[EmailSync] Sweep complete — processed ${mailboxes.length} mailbox(es)`);
    },
    {
      connection: queueConnection,
      concurrency: 1,
    },
  );

  worker.on('completed', (job) => {
    console.log(`[EmailSync] Job ${job.id} completed`);
  });

  worker.on('failed', (job, err) => {
    console.error(`[EmailSync] Job ${job?.id ?? 'unknown'} failed: ${err.message}`);
  });

  worker.on('error', (err) => {
    console.error('[EmailSync] Worker-level error:', err.message);
  });

  console.log('[EmailSync] Worker started — listening on queue "email-sync"');
  return worker;
};

export async function scheduleEmailSync(): Promise<void> {
  const { getQueue } = await import('../core/queue');
  const queue = getQueue('email-sync');

  await queue.add(
    'sync',
    {},
    {
      repeat: { every: 15 * 60 * 1000 }, // every 15 minutes
      jobId: 'email-sync-repeatable',
      removeOnComplete: { count: 10 },
      removeOnFail: { count: 5 },
    },
  );

  console.log('[EmailSync] Repeatable sync job scheduled (every 15 min)');
}
