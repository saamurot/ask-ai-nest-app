import { Injectable } from '@nestjs/common';

interface SessionData {
    intent?: string;
    status?: string;
    collectedData: Record<string, any>;
}

@Injectable()
export class SessionService {
    private sessions = new Map<string, SessionData>();

    getSession(userId: string): SessionData {
        if (!this.sessions.has(userId)) {
            this.sessions.set(userId, { collectedData: {} });
        }
        return this.sessions.get(userId);
    }

    updateSession(userId: string, data: Partial<SessionData>) {
        const session = this.getSession(userId);
        this.sessions.set(userId, { ...session, ...data });
    }

    clearSession(userId: string) {
        this.sessions.delete(userId);
    }
    
}
