import { Injectable, OnModuleInit } from '@nestjs/common';
import { ChromaClient, Collection, EmbeddingFunction } from 'chromadb';
import { AppService } from 'src/app.service';
import { OpenAiService } from 'src/open-ai/open-ai.service';

const Database = require('better-sqlite3');

@Injectable()
export class VectorService implements OnModuleInit {
    db = new Database('vectors.db');
    private chroma = new ChromaClient();
    private collection: Collection;

    constructor(private openai: OpenAiService) { }

    async onModuleInit() {

        // Create table if not exists
        this.db.prepare(`
      CREATE TABLE IF NOT EXISTS vectors (
        id TEXT PRIMARY KEY,
        text TEXT,
        embedding TEXT
      )
    `).run();
        // Optional: log how many vectors already exist
        const count = this.db.prepare('SELECT COUNT(*) as cnt FROM vectors').get().cnt;
    }

    private vectors: { id: string; embedding: number[]; text: string }[] = [];

    async addDocument(id: string, text: string) {
        const embedding = await this.openai.getEmbedding(text);
        this.db.prepare('INSERT OR REPLACE INTO vectors (id, text, embedding) VALUES (?, ?, ?)')
            .run(id, text, JSON.stringify(embedding));
    }

    // Cosine similarity function
    private cosineSim(a: number[], b: number[]) {
        const dot = a.reduce((sum, val, i) => sum + val * b[i], 0);
        const magA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
        const magB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));
        return dot / (magA * magB);
    }

    // Query top-K vectors
    async query(question: string, topK = 3) {
        const qEmbedding = await this.openai.getEmbedding(question);
        const rows = this.db.prepare('SELECT * FROM vectors').all();
        const scored = rows.map(row => ({
            ...row,
            embedding: JSON.parse(row.embedding),
            score: this.cosineSim(qEmbedding, JSON.parse(row.embedding)),
        }));
        scored.sort((a, b) => b.score - a.score);
        return scored.slice(0, topK).map(r => r.text);
    }


    async deleteVectorData() {
        await this.db.prepare('DELETE FROM vectors').run();
        const count = this.db.prepare('SELECT COUNT(*) as cnt FROM vectors').get().cnt;
    }

    async getVectorCount() {
        const count = this.db.prepare('SELECT COUNT(*) as cnt FROM vectors').get().cnt;
        return count;
    }
}
