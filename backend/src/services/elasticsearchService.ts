import esClient, { EMAIL_INDEX } from '../config/elasticsearch';
import { EmailJob } from '../types';

/**
 * Index an email job document in Elasticsearch for full-text search.
 */
export async function indexEmail(job: EmailJob): Promise<void> {
  try {
    await esClient.index({
      index: EMAIL_INDEX,
      id: job.id,  // Use DB UUID as doc ID for idempotency (re-indexing is safe)
      document: {
        id: job.id,
        to_email: job.to_email,
        subject: job.subject,
        body: job.body,
        sender_email: job.sender_email,
        status: job.status,
        scheduled_at: job.scheduled_at,
        sent_at: job.sent_at,
        user_id: job.user_id,
        created_at: job.created_at,
      },
    });
  } catch (err) {
    console.error('Elasticsearch index error:', err);
    // Don't throw - indexing failure should not break email sending
  }
}

/**
 * Update the status of an indexed email (e.g. scheduled -> sent).
 */
export async function updateEmailIndex(
  jobId: string,
  updates: Partial<Pick<EmailJob, 'status' | 'sent_at' | 'error_message'>>
): Promise<void> {
  try {
    await esClient.update({
      index: EMAIL_INDEX,
      id: jobId,
      doc: updates,
    });
  } catch (err) {
    console.error('Elasticsearch update error:', err);
  }
}

/**
 * Search emails by query string (full-text on subject + body) with filters.
 */
export async function searchEmails(
  userId: string,
  query: string,
  status?: string,
  from = 0,
  size = 20
): Promise<{ hits: unknown[]; total: number }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const must: any[] = [
    { term: { user_id: userId } },
  ];

  if (query) {
    must.push({
      multi_match: {
        query,
        fields: ['subject^2', 'body', 'to_email', 'sender_email'],
      },
    });
  }

  if (status) {
    must.push({ term: { status } });
  }

  const result = await esClient.search({
    index: EMAIL_INDEX,
    from,
    size,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    query: { bool: { must } } as any,
    sort: [{ scheduled_at: { order: 'desc' } }],
  });

  const total =
    typeof result.hits.total === 'number'
      ? result.hits.total
      : result.hits.total?.value ?? 0;

  return {
    hits: result.hits.hits.map((h) => h._source),
    total,
  };
}
