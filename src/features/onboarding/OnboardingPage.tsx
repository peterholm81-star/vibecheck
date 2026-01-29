import { useState } from 'react';
import { 
  ChevronRight, 
  ChevronLeft,
  Loader2, 
  MapPin,
  Shield,
  Eye,
  Heart,
  Users,
  Clock,
  Sparkles,
  User
} from 'lucide-react';
import { saveOnboarding2ToSupabase } from '../../lib/vibeUsers';

// ============================================
// STORY-ONLY ONBOARDING FLOW - 10 SCREENS (ENGLISH)
// ============================================
// Screens 1-9: Story / explanation (READ-ONLY, no user input)
// Screen 10: Final CTA - "Set up profile" button
// 
// After pressing "Set up profile":
// - Sets onboarding_complete = true
// - Redirects user to Profile tab (handled by App.tsx gating)
// - Does NOT set avatar_setup_complete (that happens in Profile)
// ============================================

interface OnboardingPageProps {
  onComplete: () => void;
}

const TOTAL_STEPS = 10;

export function OnboardingPage({ onComplete }: OnboardingPageProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [isSaving, setIsSaving] = useState(false);

  // Navigation
  const goNext = () => setCurrentStep((s) => Math.min(s + 1, TOTAL_STEPS));
  const goBack = () => setCurrentStep((s) => Math.max(s - 1, 1));

  // Complete onboarding story - marks story as seen, redirects to Profile tab
  const handleSetUpProfile = async () => {
    setIsSaving(true);

    // Save to localStorage as fallback
    localStorage.setItem('vibecheck_onboarding_complete', 'true');

    try {
      // Save onboarding_complete = true to Supabase
      // NOTE: avatar_setup_complete stays false - that's set when user saves Profile
      const result = await saveOnboarding2ToSupabase({
        mode: null,
        vibe_preferences: [],
        age_group: null,
        onboarding_complete: true,
        // Do NOT set avatar fields here - Profile tab handles that
        avatar_setup_complete: false,
      });

      if (!result.success) {
        console.error('[Onboarding] Supabase save failed:', result.error);
        console.warn('[Onboarding] Continuing anyway - localStorage saved');
      } else {
        console.log('[Onboarding] Story complete, redirecting to Profile tab');
      }

      setIsSaving(false);
      onComplete();
    } catch (err) {
      console.error('[Onboarding] Exception during save:', err);
      console.warn('[Onboarding] Continuing anyway - localStorage saved');
      setIsSaving(false);
      onComplete();
    }
  };

  // Progress indicator
  const ProgressIndicator = () => (
    <div className="flex items-center justify-center gap-1 mb-6">
      {Array.from({ length: TOTAL_STEPS }, (_, i) => (
        <div
          key={i}
          className={`h-1 rounded-full transition-all duration-300 ${
            i + 1 === currentStep
              ? 'w-6 bg-gradient-to-r from-violet-500 to-purple-500'
              : i + 1 < currentStep
              ? 'w-3 bg-violet-500'
              : 'w-3 bg-slate-300/30'
          }`}
        />
      ))}
    </div>
  );

  // Shared screen wrapper
  const ScreenWrapper = ({ 
    children, 
    showBack = true,
    showNext = true,
    nextLabel = 'Next',
    onNext = goNext,
    icon,
  }: { 
    children: React.ReactNode;
    showBack?: boolean;
    showNext?: boolean;
    nextLabel?: string;
    onNext?: () => void;
    icon?: React.ReactNode;
  }) => (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-violet-50 to-purple-50 flex flex-col items-center justify-center px-5 py-10">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-[22px] shadow-xl shadow-violet-200/50 p-8">
          <ProgressIndicator />
          
          {icon && (
            <div className="flex justify-center mb-6">
              <div className="w-16 h-16 bg-gradient-to-br from-violet-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg shadow-violet-400/40">
                {icon}
              </div>
            </div>
          )}
          
          {children}
          
          {/* Navigation */}
          <div className="flex gap-3 mt-8">
            {showBack && currentStep > 1 && (
              <button
                onClick={goBack}
                className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium py-3.5 px-4 rounded-xl transition-all flex items-center justify-center gap-2"
              >
                <ChevronLeft size={18} />
                Back
              </button>
            )}
            {showNext && (
              <button
                onClick={onNext}
                className="flex-1 font-semibold py-3.5 px-4 rounded-xl transition-all flex items-center justify-center gap-2 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white shadow-lg shadow-violet-400/30"
              >
                {nextLabel}
                <ChevronRight size={18} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  // ============================================
  // SCREEN 1: Recognition
  // ============================================
  if (currentStep === 1) {
    return (
      <ScreenWrapper icon={<MapPin size={32} className="text-white" />} showBack={false}>
        <h1 className="text-2xl font-bold text-slate-800 text-center mb-4">
          We've all spent a night looking for the right place
        </h1>
        <p className="text-slate-600 text-center leading-relaxed text-[15px]">
          Maybe you're visiting a new city.
          <br />
          Maybe you're out of town for the weekend.
          <br />
          Or maybe you just don't know where you want to go tonight.
          <br /><br />
          You walk from place to place.
          <br />
          Trying to read the atmosphere.
          <br />
          Spending more time searching than actually enjoying the night.
          <br /><br />
          <strong className="text-slate-800">That's where the idea for VibeCheck started.</strong>
        </p>
      </ScreenWrapper>
    );
  }

  // ============================================
  // SCREEN 2: Why VibeCheck exists
  // ============================================
  if (currentStep === 2) {
    return (
      <ScreenWrapper icon={<Sparkles size={32} className="text-white" />}>
        <h1 className="text-2xl font-bold text-slate-800 text-center mb-4">
          Nights out should feel easier
        </h1>
        <p className="text-slate-600 text-center leading-relaxed text-[15px]">
          We didn't want nightlife to be about
          <br />
          the most popular place,
          <br />
          reviews,
          <br />
          or photos from another night.
          <br /><br />
          We wanted it to be about finding a place that matches
          <br />
          <strong className="text-slate-800">your mood — right now.</strong>
          <br /><br />
          So you can stop guessing
          <br />
          and start enjoying the evening.
        </p>
      </ScreenWrapper>
    );
  }

  // ============================================
  // SCREEN 3: What VibeCheck shows
  // ============================================
  if (currentStep === 3) {
    return (
      <ScreenWrapper icon={<Eye size={32} className="text-white" />}>
        <h1 className="text-2xl font-bold text-slate-800 text-center mb-4">
          How the city feels, in real time
        </h1>
        <p className="text-slate-600 text-center leading-relaxed text-[15px]">
          VibeCheck shows how nightlife actually develops during the night.
          <br /><br />
          Where it's lively.
          <br />
          Where it's calm.
          <br />
          Which age groups are there.
          <br />
          What people are generally looking for.
          <br /><br />
          Based on <strong className="text-slate-800">anonymous activity</strong> —
          <br />
          not opinions, profiles, or photos.
        </p>
      </ScreenWrapper>
    );
  }

  // ============================================
  // SCREEN 4: Not a dating app
  // ============================================
  if (currentStep === 4) {
    return (
      <ScreenWrapper icon={<Heart size={32} className="text-white" />}>
        <h1 className="text-2xl font-bold text-slate-800 text-center mb-4">
          A bit of excitement — without dating apps
        </h1>
        <p className="text-slate-600 text-center leading-relaxed text-[15px]">
          When people are in the same place, at the same time,
          <br />
          and want the same thing,
          <br />
          something interesting can happen.
          <br /><br />
          We wanted to keep a bit of that excitement —
          <br />
          without swiping, profiles, or pictures.
          <br /><br />
          <strong className="text-slate-800">That's why VibeCheck uses avatars.</strong>
        </p>
      </ScreenWrapper>
    );
  }

  // ============================================
  // SCREEN 5: The avatar
  // ============================================
  if (currentStep === 5) {
    return (
      <ScreenWrapper icon={<Users size={32} className="text-white" />}>
        <h1 className="text-2xl font-bold text-slate-800 text-center mb-4">
          Your anonymous presence
        </h1>
        <p className="text-slate-600 text-center leading-relaxed text-[15px]">
          Your avatar represents you anonymously at the venues you visit.
          <br /><br />
          It lets you see who else is around
          <br />
          and, over time, communicate anonymously
          <br />
          with people who match the same vibe.
          <br /><br />
          A way to stay social —
          <br />
          <strong className="text-slate-800">without exposing yourself.</strong>
        </p>
      </ScreenWrapper>
    );
  }

  // ============================================
  // SCREEN 6: Social, but still alone
  // ============================================
  if (currentStep === 6) {
    return (
      <ScreenWrapper icon={<Users size={32} className="text-white" />}>
        <h1 className="text-2xl font-bold text-slate-800 text-center mb-4">
          Social, on your own terms
        </h1>
        <p className="text-slate-600 text-center leading-relaxed text-[15px]">
          Some nights you just want to observe.
          <br />
          Other nights you're more open.
          <br /><br />
          The avatar gives room for both.
          <br />
          You decide how active you want to be.
          <br /><br />
          <strong className="text-slate-800">You can be present — without expectations.</strong>
        </p>
      </ScreenWrapper>
    );
  }

  // ============================================
  // SCREEN 7: Nothing follows you home
  // ============================================
  if (currentStep === 7) {
    return (
      <ScreenWrapper icon={<Clock size={32} className="text-white" />}>
        <h1 className="text-2xl font-bold text-slate-800 text-center mb-4">
          Everything happens here and now
        </h1>
        <p className="text-slate-600 text-center leading-relaxed text-[15px]">
          VibeCheck is built for the moment.
          <br /><br />
          No history.
          <br />
          No saved conversations.
          <br />
          Nothing from tonight exists tomorrow.
          <br /><br />
          When you leave a venue,
          <br />
          <strong className="text-slate-800">you disappear from its digital space.</strong>
        </p>
      </ScreenWrapper>
    );
  }

  // ============================================
  // SCREEN 8: Why no account
  // ============================================
  if (currentStep === 8) {
    return (
      <ScreenWrapper icon={<Shield size={32} className="text-white" />}>
        <h1 className="text-2xl font-bold text-slate-800 text-center mb-4">
          No email. No profile. No identity.
        </h1>
        <p className="text-slate-600 text-center leading-relaxed text-[15px]">
          We don't ask for your name, email, or photos.
          <br /><br />
          We only create an anonymous user ID on this device.
          <br />
          That's enough to understand patterns —
          <br />
          without knowing who you are.
          <br /><br />
          <strong className="text-slate-800">Honest data requires anonymity.</strong>
        </p>
        
        {/* Shield icon badge */}
        <div className="flex items-center justify-center gap-2 text-emerald-600 bg-emerald-50 rounded-xl px-4 py-3 mt-6">
          <Shield size={20} />
          <span className="text-sm font-medium">100% anonymous</span>
        </div>
      </ScreenWrapper>
    );
  }

  // ============================================
  // SCREEN 9: Early users
  // ============================================
  if (currentStep === 9) {
    return (
      <ScreenWrapper icon={<Sparkles size={32} className="text-white" />}>
        <h1 className="text-2xl font-bold text-slate-800 text-center mb-4">
          You're among the first
        </h1>
        <p className="text-slate-600 text-center leading-relaxed text-[15px]">
          VibeCheck is new, and it will evolve over the coming months.
          <br /><br />
          How it grows depends on how it's used
          <br />
          and on feedback from early users like you.
          <br /><br />
          If you enjoy the idea,
          <br />
          <strong className="text-slate-800">sharing it helps more than you think.</strong>
        </p>
      </ScreenWrapper>
    );
  }

  // ============================================
  // SCREEN 10: Final CTA - Set up profile
  // ============================================
  if (currentStep === 10) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-violet-50 to-purple-50 flex flex-col items-center justify-center px-5 py-10">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-[22px] shadow-xl shadow-violet-200/50 p-8">
            <ProgressIndicator />
            
            {/* User icon */}
            <div className="flex justify-center mb-6">
              <div className="w-16 h-16 bg-gradient-to-br from-violet-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg shadow-violet-400/40">
                <User size={32} className="text-white" />
              </div>
            </div>

            <h1 className="text-2xl font-bold text-slate-800 text-center mb-4">
              Your profile is next
            </h1>
            <p className="text-slate-600 text-center leading-relaxed text-[15px] mb-8">
              To use VibeCheck, we need a simple default profile.
              <br /><br />
              You can change everything later.
            </p>

            {/* Navigation */}
            <div className="flex gap-3">
              <button
                onClick={goBack}
                disabled={isSaving}
                className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium py-3.5 px-4 rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <ChevronLeft size={18} />
                Back
              </button>
              <button
                onClick={handleSetUpProfile}
                disabled={isSaving}
                className="flex-1 font-semibold py-3.5 px-4 rounded-xl transition-all flex items-center justify-center gap-2 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white shadow-lg shadow-violet-400/30 disabled:opacity-70"
              >
                {isSaving ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    Loading...
                  </>
                ) : (
                  <>
                    Set up profile
                    <ChevronRight size={18} />
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
