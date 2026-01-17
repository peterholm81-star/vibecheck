/**
 * Venue Room Page - v0 MVP
 * 
 * Shows:
 * 1) Venue header with name and back button
 * 2) "Du i rommet" - current user's avatar
 * 3) "I rommet nå" - demo grid of mock avatars
 * 
 * This is a UI-only demo. Real room functionality coming later.
 */

import { useState, useEffect } from 'react';
import { ArrowLeft, Users, Loader2, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { getCurrentAvatarProfile } from '../lib/avatarProfile';
import { AvatarChip, type AvatarChipData } from '../components/venueRoom/AvatarChip';

// ============================================
// MOCK DATA - Demo avatars, easy to delete later
// ============================================

const MOCK_AVATARS: AvatarChipData[] = [
  {
    avatarGender: 'female',
    avatarAgeRange: '25_30',
    showRelationship: true,
    relationshipStatus: 'single',
    showOns: false,
    openForOns: null,
    energy: 'curious',
  },
  {
    avatarGender: 'male',
    avatarAgeRange: '30_35',
    showRelationship: true,
    relationshipStatus: 'single',
    showOns: true,
    openForOns: true,
    energy: 'playful',
  },
  {
    avatarGender: 'female',
    avatarAgeRange: '18_25',
    showRelationship: false,
    relationshipStatus: null,
    showOns: false,
    openForOns: null,
    energy: 'calm',
  },
  {
    avatarGender: 'male',
    avatarAgeRange: '35_40',
    showRelationship: true,
    relationshipStatus: 'relationship',
    showOns: false,
    openForOns: null,
    energy: null,
  },
  {
    avatarGender: 'female',
    avatarAgeRange: '25_30',
    showRelationship: true,
    relationshipStatus: 'single',
    showOns: true,
    openForOns: true,
    energy: 'playful',
  },
  {
    avatarGender: 'male',
    avatarAgeRange: '25_30',
    showRelationship: false,
    relationshipStatus: null,
    showOns: false,
    openForOns: null,
    energy: 'curious',
  },
];

// ============================================
// TYPES
// ============================================

interface VenueBasic {
  id: string;
  name: string;
}

interface VenueRoomPageProps {
  venueId: string;
  onBack: () => void;
}

// ============================================
// MAIN COMPONENT
// ============================================

export function VenueRoomPage({ venueId, onBack }: VenueRoomPageProps) {
  // Venue state
  const [venue, setVenue] = useState<VenueBasic | null>(null);
  const [venueLoading, setVenueLoading] = useState(true);
  const [venueError, setVenueError] = useState<string | null>(null);

  // Current user avatar state
  const [currentUserAvatar, setCurrentUserAvatar] = useState<AvatarChipData | null>(null);
  const [avatarLoading, setAvatarLoading] = useState(true);

  // Fetch venue data
  useEffect(() => {
    async function fetchVenue() {
      if (!supabase || !venueId) {
        setVenue({ id: venueId, name: 'Ukjent venue' });
        setVenueLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('venues')
          .select('id, name')
          .eq('id', venueId)
          .single();

        if (error) {
          console.error('[VenueRoom] Error fetching venue:', error);
          setVenueError('Kunne ikke laste venue');
          setVenue({ id: venueId, name: 'Ukjent venue' });
        } else if (data) {
          setVenue(data);
        } else {
          setVenue({ id: venueId, name: 'Ukjent venue' });
        }
      } catch (err) {
        console.error('[VenueRoom] Exception:', err);
        setVenueError('Noe gikk galt');
        setVenue({ id: venueId, name: 'Ukjent venue' });
      } finally {
        setVenueLoading(false);
      }
    }

    fetchVenue();
  }, [venueId]);

  // Fetch current user's avatar profile
  useEffect(() => {
    async function fetchAvatar() {
      try {
        const profile = await getCurrentAvatarProfile();
        if (profile.avatarGender && profile.avatarAgeRange) {
          setCurrentUserAvatar({
            avatarGender: profile.avatarGender,
            avatarAgeRange: profile.avatarAgeRange,
            showRelationship: profile.showRelationship,
            relationshipStatus: profile.relationshipStatus,
            showOns: profile.showOns,
            openForOns: profile.openForOns,
            energy: profile.energy,
            isCurrentUser: true,
          });
        } else {
          setCurrentUserAvatar(null);
        }
      } catch (err) {
        console.error('[VenueRoom] Error fetching avatar:', err);
        setCurrentUserAvatar(null);
      } finally {
        setAvatarLoading(false);
      }
    }

    fetchAvatar();
  }, []);

  // Loading state
  if (venueLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-violet-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-slate-800 border-b border-slate-700">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-4">
          <button
            onClick={onBack}
            className="p-2 -ml-2 text-slate-400 hover:text-white transition-colors"
          >
            <ArrowLeft size={24} />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold text-white truncate">
              {venue?.name || 'Venue Room'}
            </h1>
            <p className="text-sm text-slate-400">Venue Room</p>
          </div>
          <div className="flex items-center gap-2 text-slate-400">
            <Users size={18} />
            <span className="text-sm font-medium">{MOCK_AVATARS.length + (currentUserAvatar ? 1 : 0)}</span>
          </div>
        </div>
      </header>

      {/* Error banner */}
      {venueError && (
        <div className="bg-amber-900/30 border-b border-amber-800/50 px-4 py-2">
          <div className="max-w-2xl mx-auto flex items-center gap-2 text-amber-300 text-sm">
            <AlertCircle size={16} />
            <span>{venueError}</span>
          </div>
        </div>
      )}

      {/* Content */}
      <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-6 space-y-6">
        {/* Current User Section */}
        <section className="bg-slate-800 rounded-xl border border-slate-700 p-5">
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <span className="text-violet-400">👤</span>
            Du i rommet
          </h2>

          {avatarLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 text-violet-400 animate-spin" />
            </div>
          ) : currentUserAvatar ? (
            <div className="flex justify-center">
              <AvatarChip data={currentUserAvatar} size="lg" />
            </div>
          ) : (
            <div className="text-center py-6">
              <p className="text-slate-400 mb-2">Du har ikke satt opp avatar ennå</p>
              <button
                onClick={() => {
                  const returnTo = encodeURIComponent(`/venue-room/${venueId}`);
                  window.history.pushState({}, '', `/avatar-setup?returnTo=${returnTo}`);
                  window.location.reload();
                }}
                className="px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white font-medium rounded-lg transition-colors"
              >
                Sett opp avatar
              </button>
            </div>
          )}
        </section>

        {/* Demo Room Section */}
        <section className="bg-slate-800 rounded-xl border border-slate-700 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <Users size={20} className="text-emerald-400" />
              I rommet nå
            </h2>
            <span className="text-xs text-slate-500 bg-slate-700 px-2 py-1 rounded">
              {MOCK_AVATARS.length} andre
            </span>
          </div>

          {/* Demo label */}
          <div className="mb-4 p-3 bg-amber-900/20 border border-amber-700/30 rounded-lg">
            <p className="text-amber-300 text-sm text-center">
              🚧 Demo – ekte rom kommer snart
            </p>
          </div>

          {/* Avatar Grid */}
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
            {MOCK_AVATARS.map((avatar, index) => (
              <AvatarChip key={index} data={avatar} size="sm" />
            ))}
          </div>
        </section>

        {/* Info Section */}
        <section className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-4">
          <h3 className="text-sm font-semibold text-slate-300 mb-2">Om Venue Rooms</h3>
          <p className="text-sm text-slate-400">
            Venue Rooms lar deg se hvem andre som er på stedet akkurat nå. 
            Du kan vise din avatar anonymt og se hvem som matcher dine preferanser.
          </p>
        </section>
      </main>
    </div>
  );
}

export default VenueRoomPage;

