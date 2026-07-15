import { Worker, Job } from 'bullmq';
import { queueConnection, getQueue } from '../core/queue';
import { dispatchDueEvents } from '../core/events';

interface EventOutboxDispatchPayload {
  limit?: number;
}

const QUEUE_NAME = 'event-outbox';
const REPEAT_JOB_ID = 'event-outbox-repeatable';

export const startEventOutboxWorker = (): Worker => {
  const workerId = `event-outbox-${process.pid}`;
  const worker = new Worker<EventOutboxDispatchPayload>(
    QUEUE_NAME,
    async (job: Job<EventOutboxDispatchPayload>) => {
      const limit = job.data.limit ?? 25;
      const result = await dispatchDueEvents(workerId, limit);
      if (result.claimed > 0) {
        console.log(
          `[EventOutbox] Job ${job.id} claimed=${result.claimed} ` +
          `published=${result.published} retry=${result.retryScheduled} failed=${result.failed}`,
        );
      }
    },
    {
      connection: queueConnection,
      concurrency: 1,
    },
  );

  worker.on('completed', (job) => {
    console.log(`[EventOutbox] Job ${job.id} completed`);
  });

  worker.on('failed', (job, err) => {
    console.error(`[EventOutbox] Job ${job?.id ?? 'unknown'} failed: ${err.message}`);
  });

  worker.on('error', (err) => {
    console.error('[EventOutbox] Worker-level error:', err.message);
  });

  console.log(`[EventOutbox] Worker started - listening on queue "${QUEUE_NAME}"`);
  return worker;
};

export async function scheduleEventOutboxDispatch(): Promise<void> {
  const queue = getQueue(QUEUE_NAME);

  await queue.add(
    'dispatch',
    { limit: 25 },
    {
      repeat: { every: 30 * 1000 },
      jobId: REPEAT_JOB_ID,
      removeOnComplete: { count: 10 },
      removeOnFail: { count: 10 },
    },
  );

  console.log('[EventOutbox] Repeatable dispatch job scheduled (every 30 sec)');
}
