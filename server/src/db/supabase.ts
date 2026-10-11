import { createClient, SupabaseClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { QuestionBankItem, MatchSummary } from '@quickfire/shared';
import { INITIAL_QUESTIONS } from '../data/questionBank.js';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

export class DatabaseService {
  private supabase: SupabaseClient | null = null;
  private isConnected = false;

  constructor() {
    if (supabaseUrl && supabaseKey && !supabaseUrl.includes('placeholder')) {
      try {
        this.supabase = createClient(supabaseUrl, supabaseKey);
        this.isConnected = true;
        console.log('✅ Supabase PostgreSQL client connected.');
      } catch (err) {
        console.warn('⚠️ Supabase connection failed, falling back to in-memory question bank:', err);
      }
    } else {
      console.log('ℹ️ Running with local in-memory Question Bank and Match Store (Supabase credentials not set).');
    }
  }

  public async getActiveQuestions(): Promise<QuestionBankItem[]> {
    if (this.supabase && this.isConnected) {
      try {
        const { data, error } = await this.supabase
          .from('questions')
          .select('*')
          .eq('is_active', true);

        if (!error && data && data.length > 0) {
          return data as QuestionBankItem[];
        }
      } catch (err) {
        console.warn('⚠️ Error fetching questions from Supabase, falling back to local bank:', err);
      }
    }

    return [...INITIAL_QUESTIONS];
  }

  public async saveMatch(summary: MatchSummary): Promise<void> {
    if (!this.supabase || !this.isConnected) return;

    try {
      await this.supabase.from('matches').insert({
        id: summary.matchId,
        room_code: summary.roomCode,
        status: summary.status,
        is_private: summary.isPrivate,
        target_round: summary.settings.targetRound,
        winner_username: summary.winnerUsername,
        started_at: summary.startedAt ? new Date(summary.startedAt).toISOString() : null,
        ended_at: summary.endedAt ? new Date(summary.endedAt).toISOString() : null,
      });

      // Insert match players
      const playerInserts = Object.values(summary.players).map((p) => ({
        match_id: summary.matchId,
        player_id: p.id,
        username: p.username,
        final_score: p.totalScore,
        final_round: p.currentRound,
        violations_count: p.focusStatus.violationsCount,
        is_disqualified: p.focusStatus.isDisqualified,
      }));

      if (playerInserts.length > 0) {
        await this.supabase.from('match_players').insert(playerInserts);
      }
    } catch (err) {
      console.warn('⚠️ Error saving match to Supabase:', err);
    }
  }

  public async recordViolation(
    matchId: string,
    playerId: string,
    eventType: string,
    penaltyTier: string
  ): Promise<void> {
    if (!this.supabase || !this.isConnected) return;

    try {
      await this.supabase.from('focus_violations').insert({
        match_id: matchId,
        player_id: playerId,
        event_type: eventType,
        penalty_tier: penaltyTier,
      });
    } catch (err) {
      console.warn('⚠️ Error recording violation to Supabase:', err);
    }
  }
}

export const dbService = new DatabaseService();
