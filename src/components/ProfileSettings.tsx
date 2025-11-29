import { useState, useEffect } from 'react';
import { User, Save, CheckCircle, Trash2, MapPin } from 'lucide-react';
import { useProfile, GENDER_OPTIONS, GENDER_LABELS, FAVORITE_CITY_OPTIONS, FAVORITE_CITY_LABELS } from '../hooks/useProfile';
import type { Gender, FavoriteCity } from '../hooks/useProfile';
import type { RelationshipStatus, OnsIntent, Intent } from '../types';
import {
  RELATIONSHIP_STATUS_LABELS,
  ONS_INTENT_LABELS,
  INTENT_LABELS,
  INTENT_OPTIONS,
} from '../types';
import { getBirthYearOptions, getAgeBandFromBirthYear, getAgeBandLabel } from '../utils/age';

export function ProfileSettings() {
  const { profile, updateProfile, clearProfile, isLoaded } = useProfile();
  
  // Local form state
  const [birthYear, setBirthYear] = useState<number | null>(null);
  const [gender, setGender] = useState<Gender | null>(null);
  const [defaultRelationshipStatus, setDefaultRelationshipStatus] = useState<RelationshipStatus | null>(null);
  const [defaultOnsIntent, setDefaultOnsIntent] = useState<OnsIntent | null>(null);
  const [defaultIntent, setDefaultIntent] = useState<Intent | null>(null);
  const [favoriteCity, setFavoriteCity] = useState<FavoriteCity>('auto');
  
  const [showSaved, setShowSaved] = useState(false);

  // Sync form state with profile when loaded
  useEffect(() => {
    if (isLoaded) {
      setBirthYear(profile.birthYear);
      setGender(profile.gender);
      setDefaultRelationshipStatus(profile.defaultRelationshipStatus);
      setDefaultOnsIntent(profile.defaultOnsIntent);
      setDefaultIntent(profile.defaultIntent);
      setFavoriteCity(profile.favoriteCity);
    }
  }, [isLoaded, profile]);

  const handleSave = () => {
    updateProfile({
      birthYear,
      gender,
      defaultRelationshipStatus,
      defaultOnsIntent,
      defaultIntent,
      favoriteCity,
    });
    
    setShowSaved(true);
    setTimeout(() => setShowSaved(false), 2000);
  };

  const handleClear = () => {
    if (window.confirm('Er du sikker på at du vil slette profilen din?')) {
      clearProfile();
      setBirthYear(null);
      setGender(null);
      setDefaultRelationshipStatus(null);
      setDefaultOnsIntent(null);
      setDefaultIntent(null);
      setFavoriteCity('auto');
    }
  };

  const birthYearOptions = getBirthYearOptions();
  const ageBand = getAgeBandFromBirthYear(birthYear);

  if (!isLoaded) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-slate-400">Laster profil...</div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex items-start justify-center py-4 overflow-y-auto">
      <div className="bg-slate-800 rounded-2xl border border-slate-700 p-6 max-w-md w-full">
        <div className="flex items-center gap-3 mb-2">
          <User size={24} className="text-violet-400" />
          <h2 className="text-2xl font-bold text-white">Min profil</h2>
        </div>
        <p className="text-slate-400 text-sm mb-6">
          Lagres lokalt på denne enheten. Brukes som standardverdier ved check-in.
        </p>

        <div className="space-y-5">
          {/* Favorite City */}
          <div className="bg-slate-900/50 rounded-xl p-4 border border-slate-600">
            <label className="block text-sm font-medium text-slate-300 mb-2 flex items-center gap-2">
              <MapPin size={16} className="text-violet-400" />
              Favorittby
            </label>
            <select
              value={favoriteCity}
              onChange={(e) => setFavoriteCity(e.target.value as FavoriteCity)}
              className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-violet-500 focus:border-violet-500"
            >
              {FAVORITE_CITY_OPTIONS.map((city) => (
                <option key={city} value={city}>{FAVORITE_CITY_LABELS[city]}</option>
              ))}
            </select>
            <p className="text-xs text-slate-500 mt-2">
              Velg by for å overstyre automatisk geolocation
            </p>
          </div>

          {/* Gender */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Kjønn (valgfritt)
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

          {/* Birth Year */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Fødselsår (valgfritt)
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

          {/* Divider */}
          <div className="border-t border-slate-700 pt-4">
            <p className="text-xs text-slate-500 mb-4">Standardverdier for check-in</p>
          </div>

          {/* Default Relationship Status */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Standard sivilstatus
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
              Standard one night stand-intent
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

          {/* Success message */}
          {showSaved && (
            <div className="flex items-center gap-2 p-3 bg-green-500/20 border border-green-500/50 rounded-lg text-green-300">
              <CheckCircle size={18} />
              <span className="text-sm">Profil lagret!</span>
            </div>
          )}

          {/* Buttons */}
          <div className="flex gap-3 pt-2">
            <button
              onClick={handleSave}
              className="flex-1 flex items-center justify-center gap-2 bg-violet-600 hover:bg-violet-700 text-white px-6 py-3 rounded-xl font-semibold transition-colors"
            >
              <Save size={18} />
              Lagre profil
            </button>
            <button
              onClick={handleClear}
              className="flex items-center justify-center gap-2 px-4 py-3 border border-slate-600 text-slate-400 rounded-xl hover:border-red-500 hover:text-red-400 transition-colors"
              title="Slett profil"
            >
              <Trash2 size={18} />
            </button>
          </div>
        </div>

        {/* Info text */}
        <p className="text-center text-xs text-slate-500 mt-4">
          Profilen lagres kun lokalt og er helt anonym.
        </p>
      </div>
    </div>
  );
}
