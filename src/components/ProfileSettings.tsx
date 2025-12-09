import { useState, useEffect, useCallback } from 'react';
import { User, Save, CheckCircle, MapPin, Heart, Zap, AlertCircle, RefreshCw, MapPinOff, Bell, MessageSquare } from 'lucide-react';
import { ShareVibeCheckButton } from './ShareVibeCheckButton';
import { FeedbackModal } from './FeedbackModal';
import {
  useProfile,
  GENDER_OPTIONS,
  GENDER_LABELS,
  ORIENTATION_OPTIONS,
  ORIENTATION_LABELS,
  PROFILE_RELATIONSHIP_STATUS_OPTIONS,
  PROFILE_RELATIONSHIP_STATUS_LABELS,
} from '../hooks/useProfile';
import type {
  Gender,
  Orientation,
  ProfileRelationshipStatus,
  FavoriteCity,
} from '../hooks/useProfile';
import type { RelationshipStatus, OnsIntent, Intent } from '../types';
import {
  RELATIONSHIP_STATUS_LABELS,
  ONS_INTENT_LABELS,
  INTENT_LABELS,
  INTENT_OPTIONS,
} from '../types';
import { getBirthYearOptions, getAgeBandFromBirthYear, getAgeBandLabel } from '../utils/age';
import { getCities, City } from '../api/cities';

// ============================================
// PROFILE SETTINGS COMPONENT
// ============================================

export function ProfileSettings() {
  const {
    profile,
    localPrefs,
    isLoading,
    error,
    updateProfile,
    updateLocalPrefs,
  } = useProfile();
  
  // ============================================
  // LOCAL FORM STATE
  // ============================================
  
  // Basic profile fields (stored in Supabase)
  const [relationshipStatus, setRelationshipStatus] = useState<ProfileRelationshipStatus | null>(null);
  const [gender, setGender] = useState<Gender | null>(null);
  const [orientation, setOrientation] = useState<Orientation | null>(null);
  const [birthYear, setBirthYear] = useState<number | null>(null);
  const [showAsSingle, setShowAsSingle] = useState(false);
  const [smartCheckinEnabled, setSmartCheckinEnabled] = useState(false);
  const [allowNotifications, setAllowNotifications] = useState(false);
  
  // Check-in defaults (stored in localStorage)
  const [defaultRelationshipStatus, setDefaultRelationshipStatus] = useState<RelationshipStatus | null>(null);
  const [defaultOnsIntent, setDefaultOnsIntent] = useState<OnsIntent | null>(null);
  const [defaultIntent, setDefaultIntent] = useState<Intent | null>(null);
  const [favoriteCity, setFavoriteCity] = useState<FavoriteCity>('auto');
  
  // UI state
  const [showSaved, setShowSaved] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  
  // Cities for favorite city dropdown
  const [availableCities, setAvailableCities] = useState<City[]>([]);
  
  // Geolocation permission state (for smart check-in warning)
  const [geoPermission, setGeoPermission] = useState<'prompt' | 'granted' | 'denied' | 'unavailable'>('prompt');
  
  // Feedback modal state
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);

  // ============================================
  // CHECK GEOLOCATION PERMISSION
  // ============================================
  
  const checkGeoPermission = useCallback(async () => {
    if (!navigator.geolocation) {
      setGeoPermission('unavailable');
      return;
    }
    
    if (navigator.permissions) {
      try {
        const result = await navigator.permissions.query({ name: 'geolocation' });
        setGeoPermission(result.state as 'prompt' | 'granted' | 'denied');
        
        // Listen for changes
        result.addEventListener('change', () => {
          setGeoPermission(result.state as 'prompt' | 'granted' | 'denied');
        });
      } catch {
        // Permissions API not supported
        setGeoPermission('prompt');
      }
    }
  }, []);

  // Check permission on mount and when smart check-in changes
  useEffect(() => {
    if (smartCheckinEnabled) {
      checkGeoPermission();
    }
  }, [smartCheckinEnabled, checkGeoPermission]);

  // ============================================
  // SYNC FORM STATE WITH PROFILE
  // ============================================
  
  useEffect(() => {
    if (profile) {
      // Supabase profile fields
      setRelationshipStatus(profile.relationshipStatus);
      setGender(profile.gender);
      setOrientation(profile.orientation);
      setBirthYear(profile.birthYear);
      setShowAsSingle(profile.showAsSingle);
      setSmartCheckinEnabled(profile.smartCheckinEnabled);
      setAllowNotifications(profile.allowNotifications);
    }
  }, [profile]);

  useEffect(() => {
    // Local preferences
    setDefaultRelationshipStatus(localPrefs.defaultRelationshipStatus);
    setDefaultOnsIntent(localPrefs.defaultOnsIntent);
    setDefaultIntent(localPrefs.defaultIntent);
    setFavoriteCity(localPrefs.favoriteCity);
  }, [localPrefs]);

  // Fetch cities for favorite city dropdown
  useEffect(() => {
    getCities()
      .then(cities => {
        setAvailableCities(cities);
      })
      .catch(err => {
        console.error('Failed to fetch cities for profile:', err);
      });
  }, []);

  // ============================================
  // HANDLERS
  // ============================================

  const handleSave = async () => {
    setIsSaving(true);
    setSaveError(null);

    try {
      // Save Supabase profile
      await updateProfile({
        relationshipStatus,
        gender,
        orientation,
        birthYear,
        showAsSingle,
        smartCheckinEnabled,
        allowNotifications,
      });

      // Save local preferences
      updateLocalPrefs({
        defaultRelationshipStatus,
        defaultOnsIntent,
        defaultIntent,
        favoriteCity,
      });
      
      setShowSaved(true);
      setTimeout(() => setShowSaved(false), 2000);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Kunne ikke lagre profilen';
      setSaveError(message);
    } finally {
      setIsSaving(false);
    }
  };

  const birthYearOptions = getBirthYearOptions();
  const ageBand = getAgeBandFromBirthYear(birthYear);

  // ============================================
  // LOADING STATE
  // ============================================

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <RefreshCw size={32} className="mx-auto text-violet-400 animate-spin mb-3" />
          <p className="text-slate-400">Laster profil...</p>
        </div>
      </div>
    );
  }

  // ============================================
  // NOT LOGGED IN STATE
  // ============================================

  if (!profile) {
    return (
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="bg-slate-800 rounded-2xl border border-slate-700 p-6 max-w-md w-full text-center">
          <User size={48} className="mx-auto text-slate-500 mb-4" />
          <h2 className="text-xl font-bold text-white mb-2">Logg inn for å se profilen</h2>
          <p className="text-slate-400 text-sm">
            Du må være logget inn for å redigere profilen din.
          </p>
        </div>
      </div>
    );
  }

  // ============================================
  // RENDER
  // ============================================

  return (
    <div className="flex-1 flex items-start justify-center py-4 overflow-y-auto">
      <div className="bg-slate-800 rounded-2xl border border-slate-700 p-6 max-w-md w-full">
        {/* Header */}
        <div className="flex items-center gap-3 mb-2">
          <User size={24} className="text-violet-400" />
          <h2 className="text-2xl font-bold text-white">Min profil</h2>
        </div>
        <p className="text-slate-400 text-sm mb-6">
          Lagres sikkert i skyen. Brukes til matching og heatmap.
        </p>

        {/* Error banner */}
        {(error || saveError) && (
          <div className="flex items-center gap-2 p-3 mb-4 bg-red-500/20 border border-red-500/50 rounded-lg text-red-300">
            <AlertCircle size={18} />
            <span className="text-sm">{saveError || error}</span>
          </div>
        )}

        <div className="space-y-5">
          
          {/* ============================================
              SECTION: Basic Profile Info
              ============================================ */}
          <div className="bg-slate-900/50 rounded-xl p-4 border border-slate-600">
            <h3 className="text-sm font-semibold text-slate-200 mb-4 flex items-center gap-2">
              <Heart size={16} className="text-pink-400" />
              Om meg
            </h3>

            {/* Relationship Status */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Sivilstatus
              </label>
              <select
                value={relationshipStatus ?? ''}
                onChange={(e) => setRelationshipStatus(
                  e.target.value === '' ? null : (e.target.value as ProfileRelationshipStatus)
                )}
                className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-violet-500 focus:border-violet-500"
              >
                <option value="">Ikke valgt</option>
                {PROFILE_RELATIONSHIP_STATUS_OPTIONS.map((status) => (
                  <option key={status} value={status}>
                    {PROFILE_RELATIONSHIP_STATUS_LABELS[status]}
                  </option>
                ))}
              </select>
            </div>

            {/* Gender */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Kjønn
              </label>
              <select
                value={gender ?? ''}
                onChange={(e) => setGender(e.target.value === '' ? null : (e.target.value as Gender))}
                className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-violet-500 focus:border-violet-500"
              >
                <option value="">Ikke valgt</option>
                {GENDER_OPTIONS.map((g) => (
                  <option key={g} value={g}>{GENDER_LABELS[g]}</option>
                ))}
              </select>
            </div>

            {/* Orientation */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Legning
              </label>
              <select
                value={orientation ?? ''}
                onChange={(e) => setOrientation(
                  e.target.value === '' ? null : (e.target.value as Orientation)
                )}
                className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-violet-500 focus:border-violet-500"
              >
                <option value="">Ikke valgt</option>
                {ORIENTATION_OPTIONS.map((o) => (
                  <option key={o} value={o}>{ORIENTATION_LABELS[o]}</option>
                ))}
              </select>
            </div>

            {/* Birth Year */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Fødselsår
              </label>
              <select
                value={birthYear ?? ''}
                onChange={(e) => setBirthYear(e.target.value === '' ? null : Number(e.target.value))}
                className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-violet-500 focus:border-violet-500"
              >
                <option value="">Ikke valgt</option>
                {birthYearOptions.map((year) => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
              {ageBand && (
                <p className="text-xs text-slate-400 mt-1">
                  Aldersgruppe: {getAgeBandLabel(ageBand)}
                </p>
              )}
            </div>
          </div>

          {/* ============================================
              SECTION: Heatmap & Feature Toggles
              ============================================ */}
          <div className="bg-slate-900/50 rounded-xl p-4 border border-slate-600">
            <h3 className="text-sm font-semibold text-slate-200 mb-4 flex items-center gap-2">
              <Zap size={16} className="text-yellow-400" />
              Funksjoner
            </h3>

            {/* Show as Single Toggle */}
            <div className="mb-4">
              <label className="flex items-center justify-between cursor-pointer">
                <div>
                  <span className="text-sm font-medium text-slate-300">
                    Vis meg som singel i heatmap
                  </span>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Brukes anonymt i statistikken for å vise hvor det er flest single.
                  </p>
                </div>
                <div className="relative ml-4">
                  <input
                    type="checkbox"
                    checked={showAsSingle}
                    onChange={(e) => setShowAsSingle(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-600 rounded-full peer peer-checked:bg-pink-500 peer-focus:ring-2 peer-focus:ring-pink-500/50 transition-colors"></div>
                  <div className="absolute left-0.5 top-0.5 w-5 h-5 bg-white rounded-full transition-transform peer-checked:translate-x-5"></div>
                </div>
              </label>
            </div>

            {/* Smart Check-in Toggle */}
            <div>
              <label className="flex items-center justify-between cursor-pointer">
                <div>
                  <span className="text-sm font-medium text-slate-300">
                    Smart check-in (beta)
                  </span>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Sjekker deg inn automatisk når du er på et sted – kun når appen er åpen.
                  </p>
                </div>
                <div className="relative ml-4">
                  <input
                    type="checkbox"
                    checked={smartCheckinEnabled}
                    onChange={(e) => setSmartCheckinEnabled(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-600 rounded-full peer peer-checked:bg-violet-500 peer-focus:ring-2 peer-focus:ring-violet-500/50 transition-colors"></div>
                  <div className="absolute left-0.5 top-0.5 w-5 h-5 bg-white rounded-full transition-transform peer-checked:translate-x-5"></div>
                </div>
              </label>
              
              {/* Geolocation permission warning */}
              {smartCheckinEnabled && (geoPermission === 'denied' || geoPermission === 'unavailable') && (
                <div className="mt-2 flex items-start gap-2 p-2 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                  <MapPinOff size={14} className="text-amber-400 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-amber-300">
                    {geoPermission === 'denied' 
                      ? 'Smart check-in krever posisjonstilgang i nettleseren. Gi tilgang i nettleserinnstillinger.'
                      : 'Geolocation er ikke tilgjengelig i denne nettleseren.'}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* ============================================
              SECTION: Notifications
              ============================================ */}
          <div className="bg-slate-900/50 rounded-xl p-4 border border-slate-600">
            <h3 className="text-sm font-semibold text-slate-200 mb-4 flex items-center gap-2">
              <Bell size={16} className="text-amber-400" />
              Varsler
            </h3>

            {/* Allow Notifications Toggle */}
            <div>
              <label className="flex items-center justify-between cursor-pointer">
                <div>
                  <span className="text-sm font-medium text-slate-300">
                    Tillat varsler fra VibeCheck
                  </span>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Vi kan varsle deg når steder som matcher filtrene dine blir ekstra aktive. Du kan slå dette av når som helst.
                  </p>
                </div>
                <div className="relative ml-4">
                  <input
                    type="checkbox"
                    checked={allowNotifications}
                    onChange={(e) => setAllowNotifications(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-600 rounded-full peer peer-checked:bg-amber-500 peer-focus:ring-2 peer-focus:ring-amber-500/50 transition-colors"></div>
                  <div className="absolute left-0.5 top-0.5 w-5 h-5 bg-white rounded-full transition-transform peer-checked:translate-x-5"></div>
                </div>
              </label>
            </div>
          </div>

          {/* ============================================
              SECTION: Favorite City
              ============================================ */}
          <div className="bg-slate-900/50 rounded-xl p-4 border border-slate-600">
            <label className="block text-sm font-medium text-slate-300 mb-2 flex items-center gap-2">
              <MapPin size={16} className="text-violet-400" />
              Favorittby (startby for kartet)
            </label>
            <select
              value={favoriteCity}
              onChange={(e) => setFavoriteCity(e.target.value as FavoriteCity)}
              className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-violet-500 focus:border-violet-500"
            >
              <option value="auto">Automatisk (GPS-basert)</option>
              {availableCities.map((city) => (
                <option key={city.id} value={city.name}>{city.name}</option>
              ))}
            </select>
            <p className="text-xs text-slate-500 mt-2">
              {favoriteCity === 'auto' 
                ? 'Kartet vil bruke din GPS-posisjon for å finne nærmeste by'
                : `Kartet starter alltid i ${favoriteCity}`}
            </p>
          </div>

          {/* ============================================
              SECTION: Check-in Defaults
              ============================================ */}
          <div className="border-t border-slate-700 pt-4">
            <p className="text-xs text-slate-500 mb-4">Standardverdier for check-in (lagres lokalt)</p>
          </div>

          {/* Default Relationship Status (for check-in) */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Standard sivilstatus (check-in)
            </label>
            <select
              value={defaultRelationshipStatus ?? ''}
              onChange={(e) => setDefaultRelationshipStatus(
                e.target.value === '' ? null : (e.target.value as RelationshipStatus)
              )}
              className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-violet-500 focus:border-violet-500"
            >
              <option value="">Ikke valgt</option>
              <option value="single">{RELATIONSHIP_STATUS_LABELS.single}</option>
              <option value="in_relationship">{RELATIONSHIP_STATUS_LABELS.in_relationship}</option>
              <option value="complicated">{RELATIONSHIP_STATUS_LABELS.complicated}</option>
              <option value="prefer_not_to_say">{RELATIONSHIP_STATUS_LABELS.prefer_not_to_say}</option>
            </select>
          </div>

          {/* Default ONS Intent */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Standard 👉👌 ONS-intent
            </label>
            <select
              value={defaultOnsIntent ?? ''}
              onChange={(e) => setDefaultOnsIntent(
                e.target.value === '' ? null : (e.target.value as OnsIntent)
              )}
              className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-violet-500 focus:border-violet-500"
            >
              <option value="">Ikke valgt</option>
              <option value="open">{ONS_INTENT_LABELS.open}</option>
              <option value="maybe">{ONS_INTENT_LABELS.maybe}</option>
              <option value="not_interested">{ONS_INTENT_LABELS.not_interested}</option>
              <option value="prefer_not_to_say">{ONS_INTENT_LABELS.prefer_not_to_say}</option>
            </select>
          </div>

          {/* Default Intent */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Standard kveldsmål
            </label>
            <select
              value={defaultIntent ?? ''}
              onChange={(e) => setDefaultIntent(
                e.target.value === '' ? null : (e.target.value as Intent)
              )}
              className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-violet-500 focus:border-violet-500"
            >
              <option value="">Ikke valgt</option>
              {INTENT_OPTIONS.map((intent) => (
                <option key={intent} value={intent}>{INTENT_LABELS[intent]}</option>
              ))}
            </select>
          </div>

          {/* ============================================
              SUCCESS MESSAGE
              ============================================ */}
          {showSaved && (
            <div className="flex items-center gap-2 p-3 bg-green-500/20 border border-green-500/50 rounded-lg text-green-300">
              <CheckCircle size={18} />
              <span className="text-sm">Profil lagret!</span>
            </div>
          )}

          {/* ============================================
              ACTION BUTTONS
              ============================================ */}
          <div className="pt-2">
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="w-full flex items-center justify-center gap-2 bg-violet-600 hover:bg-violet-700 disabled:bg-violet-600/50 text-white px-6 py-3 rounded-xl font-semibold transition-colors"
            >
              {isSaving ? (
                <>
                  <RefreshCw size={18} className="animate-spin" />
                  Lagrer...
                </>
              ) : (
                <>
                  <Save size={18} />
                  Lagre profil
                </>
              )}
            </button>
          </div>

          {/* ============================================
              SHARE VIBECHECK
              ============================================ */}
          <div className="pt-4 border-t border-slate-700/50">
            <p className="text-sm text-slate-400 mb-3 text-center">
              Flere venner = bedre vibes 🔥
            </p>
            <ShareVibeCheckButton />
          </div>

          {/* ============================================
              FEEDBACK BUTTON
              ============================================ */}
          <div className="pt-4 border-t border-slate-700/50">
            <p className="text-sm text-slate-400 mb-3 text-center">
              Har du tilbakemeldinger? 💬
            </p>
            <button
              type="button"
              onClick={() => setIsFeedbackOpen(true)}
              className="w-full flex items-center justify-center gap-2 bg-slate-700 hover:bg-slate-600 text-white px-6 py-3 rounded-xl font-medium transition-colors"
            >
              <MessageSquare size={18} />
              Gi tilbakemelding 📝
            </button>
          </div>
        </div>

        {/* Footer info */}
        <p className="text-center text-xs text-slate-500 mt-4">
          Profildata lagres sikkert i Supabase.
        </p>
      </div>

      {/* Feedback Modal */}
      <FeedbackModal
        isOpen={isFeedbackOpen}
        onClose={() => setIsFeedbackOpen(false)}
      />
    </div>
  );
}
