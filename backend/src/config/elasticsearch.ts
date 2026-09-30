import { Client } from '@elastic/elasticsearch';
import dotenv from 'dotenv';

dotenv.config();

const esClient = new Client({
  node: process.env.ELASTICSEARCH_URL || 'http://localhost:9200',
});

export const EMAIL_INDEX = 'emails';

export async function initElasticsearch() {
  try {
    const exists = await esClient.indices.exists({ index: EMAIL_INDEX });
    if (!exists) {
      await esClient.indices.create({
        index: EMAIL_INDEX,
        mappings: {
          properties: {
            id: { type: 'keyword' },
            to_email: { type: 'keyword' },
            subject: { type: 'text', analyzer: 'standard' },
            body: { type: 'text', analyzer: 'standard' },
            sender_email: { type: 'keyword' },
            status: { type: 'keyword' },
            scheduled_at: { type: 'date' },
            sent_at: { type: 'date' },
            user_id: { type: 'keyword' },
            created_at: { type: 'date' },
          },
        },
      });
      console.log(`✅ Elasticsearch index "${EMAIL_INDEX}" created`);
    } else {
      console.log(`✅ Elasticsearch index "${EMAIL_INDEX}" ready`);
    }
  } catch (err) {
    console.error('❌ Elasticsearch init failed:', err);
  }
}

export default esClient;
