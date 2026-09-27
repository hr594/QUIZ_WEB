import { useState, useEffect } from 'react';
import { useParams, useLocation, useNavigate, Link } from 'react-router-dom';
import {
  Check, CheckCircle2, Clock, Video, Play, ArrowRight,
  Users, Laptop, GraduationCap, TrendingUp, Rocket,
  FileText, Award, Loader2, Sparkles, Mic, Share2, Briefcase
} from 'lucide-react';
import {
  getQuizResult,
  getStoredQuizConfig,
  fetchQuizConfig,
  computeWebinarSchedule,
  type QuizEngineConfig,
  type WebinarSchedule,
} from '@/services/quizService';
import { getBootcampForDomain, registerForBootcamp } from '@/services/bootcampService';
import { trackLeadActivity } from '@/services/leadService';
import { getPersistedStudentId } from '@/lib/analytics';
import { formatTimeTaken } from '@/lib/scoring';
import { isSupabaseConfigured } from '@/lib/supabase';
import supabase from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/useToast';
import { getDomainIconPath } from '@/lib/domainIcons';
import { FloatingInstagramButton } from '@/components/layout/FloatingInstagramButton';
import type { QuizResult, SkillLevel, Bootcamp } from '@/types';

function WhatsAppIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="WhatsApp"
    >
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
}

export default function ResultPage() {
  const { attemptId } = useParams<{ attemptId: string }>();
  const location = useLocation();
  const navigate = useNavigate();

  const [result, setResult] = useState<QuizResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [studentName, setStudentName] = useState<string>('');
  const [bootcamp, setBootcamp] = useState<Bootcamp | null>(null);
  const [imgError, setImgError] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [quizConfig, setQuizConfig] = useState<QuizEngineConfig>(() => getStoredQuizConfig());
  const [hasJoinedWebinar, setHasJoinedWebinar] = useState(false);
  const [schedule, setSchedule] = useState<WebinarSchedule>(() => {
    const conf = getStoredQuizConfig();
    return computeWebinarSchedule(conf.webinar_time, conf.webinar_date);
  });

  const studentId = getPersistedStudentId();
  const stateResult = (location.state as any)?.result || (location.state as any)?.devResult;
  const devResult = stateResult;

  const storedDomainSlug = typeof window !== 'undefined' && attemptId ? sessionStorage.getItem(`quiz_domain_slug_${attemptId}`) : null;
  const storedDomainName = typeof window !== 'undefined' && attemptId ? sessionStorage.getItem(`quiz_domain_name_${attemptId}`) : null;

  const targetDomainSlug =
    (location.state as any)?.domainSlug ||
    storedDomainSlug ||
    (stateResult as any)?.domain?.slug ||
    (stateResult as any)?.domain_slug ||
    (result as any)?.domain?.slug ||
    (result as any)?.domain_slug ||
    'ui-ux-design';

  const targetDomainId =
    (location.state as any)?.domainId ||
    (stateResult as any)?.domain_id ||
    (stateResult as any)?.domain?.id ||
    (result as any)?.domain_id ||
    (result as any)?.domain?.id ||
    '';

  const targetStudentId =
    (location.state as any)?.studentId ||
    studentId ||
    (stateResult as any)?.student_id ||
    (result as any)?.student_id ||
    'student-' + Date.now();

  // Prevent back navigation to quiz assessment & ensure fullscreen is exited
  useEffect(() => {
    try {
      if (document.fullscreenElement) {
        const doc = document as any;
        if (doc.exitFullscreen) {
          doc.exitFullscreen().catch(() => {});
        } else if (doc.webkitExitFullscreen) {
          doc.webkitExitFullscreen();
        } else if (doc.msExitFullscreen) {
          doc.msExitFullscreen();
        }
      }
    } catch {}

    window.history.pushState(null, '', window.location.href);

    const handlePopState = () => {
      window.history.pushState(null, '', window.location.href);
    };

    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, []);

  // Real-time schedule updater (re-computes every 1 second based on wall-clock time)
  useEffect(() => {
    const timer = setInterval(() => {
      setSchedule(computeWebinarSchedule(quizConfig.webinar_time, quizConfig.webinar_date));
    }, 1000);
    return () => clearInterval(timer);
  }, [quizConfig.webinar_time, quizConfig.webinar_date]);

  // Fetch & live-sync platform quiz & webinar configuration from Admin Portal (including tab focus)
  useEffect(() => {
    const syncConfig = () => {
      fetchQuizConfig()
        .then((conf) => {
          if (conf) {
            setQuizConfig(conf);
            setSchedule(computeWebinarSchedule(conf.webinar_time, conf.webinar_date));
          }
        })
        .catch((err) => console.warn('Quiz config sync notice:', err));
    };

    syncConfig();
    window.addEventListener('focus', syncConfig);
    window.addEventListener('storage', syncConfig);
    return () => {
      window.removeEventListener('focus', syncConfig);
      window.removeEventListener('storage', syncConfig);
    };
  }, []);

  useEffect(() => {
    const load = async () => {
      try {
        let loadedResult: QuizResult | null = null;

        if (stateResult) {
          loadedResult = stateResult as unknown as QuizResult;
          setResult(loadedResult);
        }

        if (isSupabaseConfigured && attemptId && !attemptId.startsWith('dev-')) {
          try {
            const data = await getQuizResult(attemptId);
            if (data) {
              loadedResult = data;
              setResult(data);
            }
          } catch (fetchErr) {
            console.warn('Could not fetch quiz result from Supabase:', fetchErr);
          }

          if (studentId) {
            try {
              await trackLeadActivity(studentId, 'result_viewed', 5, { attempt_id: attemptId });
            } catch {}
          }
        }

        if (!loadedResult) {
          const fallbackResult: any = {
            id: attemptId || 'res-' + Date.now(),
            attempt_id: attemptId || 'att-' + Date.now(),
            student_id: targetStudentId,
            domain_id: targetDomainId,
            total_questions: 30,
            correct_answers: 0,
            incorrect_answers: 0,
            unanswered: 0,
            score: 0,
            percentage: 0,
            is_passed: true,
            skill_level: 'Intermediate',
            strengths: ['Assessment Completed Successfully'],
            weak_areas: [],
            recommendations: [],
            calculated_at: new Date().toISOString(),
            created_at: new Date().toISOString(),
            domain: {
              name: (location.state as any)?.customDomainName || (targetDomainSlug ? targetDomainSlug.charAt(0).toUpperCase() + targetDomainSlug.slice(1) : 'Technical'),
              slug: targetDomainSlug,
            },
            attempt: {
              time_taken_seconds: (location.state as any)?.timeTakenSeconds || 600,
            },
          };
          loadedResult = fallbackResult;
          setResult(fallbackResult);
        }

        // Fetch student name
        const storedName = localStorage.getItem('student_name');
        if (storedName) {
          setStudentName(storedName);
        } else if (targetStudentId && isSupabaseConfigured && !targetStudentId.startsWith('student-')) {
          try {
            const { data: sData } = await supabase
              .from('students')
              .select('full_name')
              .eq('id', targetStudentId)
              .maybeSingle();
            if (sData?.full_name) {
              setStudentName(sData.full_name);
              localStorage.setItem('student_name', sData.full_name);
            }
          } catch {}
        }



        // Fetch bootcamp info for domain
        try {
          const bc = await getBootcampForDomain(targetDomainId);
          if (bc) setBootcamp(bc);
        } catch {}

      } catch (err) {
        console.error('Failed to load result:', err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [attemptId]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader2 className="w-10 h-10 text-brand-600 animate-spin mx-auto mb-4" />
          <p className="text-gray-700 font-semibold text-lg">Submitting your assessment...</p>
          <p className="text-gray-400 text-sm mt-1">Recording your responses securely</p>
        </div>
      </div>
    );
  }

  // If result is still somehow null, generate a safe fallback so the thank-you screen is always shown
  const activeResult: QuizResult = result || {
    id: attemptId || 'res-' + Date.now(),
    attempt_id: attemptId || 'att-' + Date.now(),
    student_id: targetStudentId,
    domain_id: targetDomainId,
    total_questions: 30,
    correct_answers: 0,
    incorrect_answers: 0,
    unanswered: 0,
    total_marks: 30,
    obtained_marks: 0,
    percentage: 0,
    skill_level: 'Intermediate',
    is_passed: true,
    pass_fail: 'PASSED',
    personalized_message: 'Thanks for submitting your assessment.',
    strengths: ['Assessment Completed'],
    weak_areas: [],
    recommendations: [],
    calculated_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
    domain: {
      name: (location.state as any)?.customDomainName || (targetDomainSlug ? targetDomainSlug.charAt(0).toUpperCase() + targetDomainSlug.slice(1) : 'Technical'),
      slug: targetDomainSlug,
    } as any,
    attempt: {
      time_taken_seconds: (location.state as any)?.timeTakenSeconds || 600,
    } as any,
  };

  const percentage = typeof activeResult.percentage === 'number' ? activeResult.percentage : parseFloat(String(activeResult.percentage || 0));
  const isPassed = typeof activeResult.is_passed === 'boolean' ? activeResult.is_passed : percentage >= (quizConfig.passing_percentage || 50);
  const passFail = isPassed ? 'PASSED' : 'FAILED';
  const skillLevel = (activeResult.skill_level || (percentage >= 85 ? 'Expert' : percentage >= 70 ? 'Advanced' : percentage >= 50 ? 'Intermediate' : percentage >= 30 ? 'Beginner' : 'Foundation')) as SkillLevel;
  
  const rawDomainName =
    (location.state as any)?.customDomainName ||
    (location.state as any)?.domainName ||
    storedDomainName ||
    (activeResult as any).domain?.name ||
    (devResult as any)?.domain_name ||
    (targetDomainSlug ? targetDomainSlug.replace(/-/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()) : 'Assessment');

  // Guard against stale Python default if targetDomainSlug is not Python
  const domainName = (targetDomainSlug && !targetDomainSlug.includes('python') && rawDomainName.toLowerCase().includes('python'))
    ? targetDomainSlug.replace(/-/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())
    : rawDomainName;

  const timeTaken = (activeResult as any).attempt?.time_taken_seconds || (location.state as any)?.timeTakenSeconds || (devResult as any)?.attempt?.time_taken_seconds || 600;


  const WHATSAPP_COMMUNITY_URL = quizConfig.whatsapp_community_url || 'https://chat.whatsapp.com/E3OZRJip3Gx1y0XXNmKXvo';
  const WEBINAR_URL = (quizConfig.webinar_url || '').trim();
  const SKILL_ASSESSMENT_URL = quizConfig.skill_assessment_url || 'https://script.google.com/macros/s/AKfycbx9AllwqUCMUYyGDoAMbjTEr4k0tL84STi_LPogc23RJfiUJNyhDEpbyRPHOwjXrK0/exec';

  const formatCountdown = (seconds: number) => {
    const safe = Math.max(0, Math.floor(seconds));
    const m = Math.floor(safe / 60);
    const s = safe % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const handleJoinWhatsApp = () => {
    try {
      if (targetStudentId) {
        trackLeadActivity(targetStudentId, 'whatsapp_community_joined', 10, {
          source: 'webinar_result_card',
        }).catch(() => {});
      }
    } catch {}

    // Non-blocking local leads update
    try {
      const rawLeads = localStorage.getItem('hadescore_local_leads');
      if (rawLeads) {
        const leads = JSON.parse(rawLeads);
        const found = leads.find((l: any) => l.student_id === targetStudentId);
        if (found) {
          found.has_registered_bootcamp = true;
          found.lead_score = Math.max(found.lead_score || 50, 85);
          found.lead_status = 'HOT';
          localStorage.setItem('hadescore_local_leads', JSON.stringify(leads));
        }
      }
    } catch {}
  };

  // Helper to ensure we ALWAYS retrieve the latest Admin-configured Webinar URL
  const getResolvedWebinarUrl = () => {
    const stored = getStoredQuizConfig();
    let url = (
      (quizConfig.webinar_url || '').trim() ||
      (stored.webinar_url || '').trim() ||
      (quizConfig.whatsapp_community_url || '').trim() ||
      (stored.whatsapp_community_url || '').trim() ||
      'https://chat.whatsapp.com/E3OZRJip3Gx1y0XXNmKXvo'
    );
    if (url && !/^https?:\/\//i.test(url)) {
      url = 'https://' + url;
    }
    return url;
  };

  const resolvedWebinarUrl = getResolvedWebinarUrl();

  const handleJoinWebinar = async (e?: React.MouseEvent) => {
    // Interactively transition UI to LIVE state immediately
    setHasJoinedWebinar(true);

    let targetUrl = getResolvedWebinarUrl();

    // If targetUrl is not yet the webinar URL, attempt immediate async refresh
    if (!quizConfig.webinar_url && !getStoredQuizConfig().webinar_url) {
      try {
        const conf = await fetchQuizConfig();
        if (conf && conf.webinar_url) {
          setQuizConfig(conf);
          let freshUrl = conf.webinar_url.trim();
          if (freshUrl && !/^https?:\/\//i.test(freshUrl)) freshUrl = 'https://' + freshUrl;
          targetUrl = freshUrl;
        }
      } catch {}
    }

    try {
      if (targetStudentId) {
        trackLeadActivity(targetStudentId, 'webinar_link_clicked', 15, {
          source: 'webinar_result_card',
          webinar_url: targetUrl,
        }).catch(() => {});
      }
    } catch {}

    toast({
      title: 'Connecting to Live Webinar',
      description: 'Redirecting to the official MNC live webinar session...',
    });

    // Ensure reliable navigation even if popups are blocked by the browser
    try {
      const opened = window.open(targetUrl, '_blank', 'noopener,noreferrer');
      if (!opened || opened.closed || typeof opened.closed === 'undefined') {
        window.location.href = targetUrl;
      }
    } catch {
      window.location.href = targetUrl;
    }
  };

  const isWebinarLive = hasJoinedWebinar || schedule.isLiveNow;
  const totalSecs = Math.max(0, schedule.secondsRemaining);
  const hours = Math.floor(totalSecs / 3600);
  const mins = Math.floor((totalSecs % 3600) / 60);
  const secs = totalSecs % 60;
  const formattedHours = String(hours).padStart(2, '0');
  const formattedMins = String(mins).padStart(2, '0');
  const formattedSecs = String(secs).padStart(2, '0');

  return (
    <div className="min-h-screen lg:h-screen lg:max-h-screen bg-[#F8FAFC] text-slate-800 p-2 sm:p-3 lg:p-3.5 relative lg:overflow-hidden flex flex-col justify-between items-center selection:bg-indigo-500 selection:text-white">
      {/* Subtle Background Glow Blobs */}
      <div className="absolute top-0 left-0 w-72 h-72 bg-blue-100/40 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2 pointer-events-none" />
      <div className="absolute top-1/3 right-0 w-72 h-72 bg-purple-100/30 rounded-full blur-3xl translate-x-1/2 pointer-events-none" />
      <div className="absolute bottom-6 left-10 w-64 h-64 bg-emerald-100/30 rounded-full blur-3xl pointer-events-none" />

      <main className="max-w-4xl lg:max-w-5xl w-full h-full flex flex-col justify-between gap-2 sm:gap-2.5 relative z-10 min-h-0 pb-14 sm:pb-0">

        {/* 1. TOP CONFIRMATION BANNER */}
        <div className="bg-[#F2FBF7] border border-[#A7F3D0] rounded-2xl px-4 py-2 sm:py-2.5 shadow-2xs flex items-center justify-center gap-3 sm:gap-4 shrink-0">
          <div className="relative flex items-center justify-center shrink-0 w-10 h-10 sm:w-11 sm:h-11">
            {/* Radiating burst dashes around checkmark */}
            <svg className="absolute inset-0 w-full h-full text-[#10B981] pointer-events-none" viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="9" y1="12" x2="14" y2="15" />
              <line x1="39" y1="12" x2="34" y2="15" />
              <line x1="7" y1="28" x2="12" y2="27" />
              <line x1="41" y1="28" x2="36" y2="27" />
            </svg>
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-[#00B074] flex items-center justify-center shadow-xs text-white relative z-10">
              <Check className="w-4 h-4 stroke-[3]" />
            </div>
          </div>

          {/* Thin vertical separator line */}
          <div className="w-px h-9 sm:h-10 bg-slate-200/90 shrink-0 self-center" />

          {/* Text block */}
          <div className="text-left">
            <h2 className="text-xs sm:text-sm font-bold text-slate-900 tracking-tight leading-tight">
              Thanks for submiting the quiz!
            </h2>
            <p className="text-[10px] sm:text-[11px] text-slate-600 font-medium leading-tight mt-0.5">
              Your response has been successfully recorded.
            </p>
            <p className="text-[9.5px] sm:text-[10.5px] text-slate-500 font-normal leading-tight mt-0.5">
              The results will be shared during the webinar. Join us to learn more!
            </p>
          </div>
        </div>

        {/* 2. HERO LIVE WEBINAR SHOWCASE BANNER */}
        <div className="bg-gradient-to-r from-[#041235] via-[#092265] to-[#04133A] rounded-2xl sm:rounded-3xl p-3.5 sm:p-5 lg:p-6 shadow-xl border border-blue-900/40 text-white relative overflow-hidden shrink-0">
          <div className="flex flex-col md:flex-row items-center justify-between gap-3 sm:gap-4 lg:gap-6 relative z-10">
            {/* Left Content Area */}
            <div className="space-y-2 sm:space-y-2.5 flex-1 w-full">
              {isWebinarLive ? (
                <div className="flex flex-wrap items-center gap-2">
                  <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-red-600 text-white text-[9px] sm:text-[10px] font-black shadow-md shadow-red-600/40 animate-pulse">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-80"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
                    </span>
                    <span>HAPPENING NOW</span>
                  </div>
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[9px] sm:text-[10px] font-semibold border border-emerald-400/30">
                    <Video className="w-3 h-3 text-emerald-300" />
                    <span>Webinar Room Open</span>
                  </div>
                </div>
              ) : (
                <div className="flex flex-wrap items-center gap-2">
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#1D4ED8] text-white text-[9px] sm:text-[10px] font-bold shadow-xs">
                    <Video className="w-3 h-3 fill-current" />
                    <span>Live Webinar</span>
                  </div>
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-teal-500/20 text-teal-300 text-[9px] sm:text-[10px] font-semibold border border-teal-400/30">
                    <Clock className="w-3 h-3 text-teal-300" />
                    <span>Starts at {schedule.formattedWebinarTime}</span>
                  </div>
                </div>
              )}

              <h1 className="text-xl sm:text-2xl lg:text-3xl font-black tracking-tight leading-tight text-white">
                Join Free Webinar by <br className="hidden sm:inline" />
                <span className="text-white">MNC Professionals</span>
              </h1>

              <p className="text-slate-200/90 text-[10px] sm:text-xs max-w-lg font-normal leading-relaxed">
                {isWebinarLive
                  ? `The webinar is LIVE now! Join MNC experts to learn insights and receive your quiz results.`
                  : hours > 0
                    ? `Webinar starts in ${hours} hr${hours > 1 ? 's' : ''} ${mins} mins. Join MNC experts to learn insights and receive your quiz results.`
                    : `Webinar starts in ${mins} minute${mins !== 1 ? 's' : ''}. Join MNC experts to learn insights and receive your quiz results.`
                }
              </p>

              {/* Actions Row: Dual Digital Countdown Pod & Join Webinar CTA */}
              <div className="pt-1 flex flex-wrap items-center gap-3 sm:gap-4">
                {isWebinarLive ? (
                  /* Interactive "Webinar is LIVE now !" Pod */
                  <a
                    href={resolvedWebinarUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={handleJoinWebinar}
                    className="group relative flex items-center gap-2.5 px-3.5 py-2 sm:px-4 sm:py-2 rounded-2xl bg-gradient-to-r from-red-950/90 via-[#2E0836]/90 to-[#0A1A4A]/90 border border-red-500/60 shadow-[0_0_20px_rgba(239,68,68,0.45)] hover:shadow-[0_0_30px_rgba(239,68,68,0.75)] hover:border-red-400 hover:scale-[1.03] transition-all duration-300 backdrop-blur-md cursor-pointer shrink-0 no-underline"
                    id="webinar-live-interactive-badge"
                    title="Webinar is Live! Click to join now"
                  >
                    {/* Radar Pulsing Live Indicator */}
                    <div className="relative flex items-center justify-center shrink-0">
                      <span className="animate-ping absolute inline-flex h-6 w-6 rounded-full bg-red-500/50"></span>
                      <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-gradient-to-br from-red-500 to-rose-600 flex items-center justify-center text-white shadow-[0_0_12px_rgba(239,68,68,0.8)]">
                        <Video className="w-3.5 h-3.5 sm:w-4 sm:h-4 fill-current animate-pulse" />
                      </div>
                    </div>

                    <div className="space-y-0.5">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs sm:text-sm lg:text-base font-black tracking-tight text-white drop-shadow-[0_0_10px_rgba(244,63,94,0.9)]">
                          Webinar is LIVE now !
                        </span>
                        <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[8px] sm:text-[9px] font-black uppercase tracking-wider bg-red-600 text-white shadow-xs animate-pulse">
                          LIVE
                        </span>
                      </div>
                      <p className="text-[8px] sm:text-[9px] text-red-200/90 font-medium flex items-center gap-1">
                        <span>Click here to enter the room</span>
                        <ArrowRight className="w-2.5 h-2.5 group-hover:translate-x-1 transition-transform" />
                      </p>
                    </div>
                  </a>
                ) : (
                  /* Digital Countdown Timer Pod flanked by cyan waves */
                  <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
                    {/* Left cyan wave arcs */}
                    <svg className="w-3 h-7 sm:w-3.5 sm:h-8 text-cyan-400/90 shrink-0" viewBox="0 0 14 30" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                      <path d="M11 3C5 7 2 15 2 22C2 25 3 27 5 29" />
                      <path d="M13 8C9 11 7 15 7 20C7 22 8 23 9 25" />
                    </svg>

                    {/* Timer Glass Pod */}
                    <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-2xl bg-[#06122E]/90 border border-cyan-400/50 shadow-[0_0_15px_rgba(6,182,212,0.35)] backdrop-blur-md">
                      {/* Cyan Circular Clock Badge */}
                      <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full border-2 border-cyan-400/80 bg-cyan-950/60 flex items-center justify-center text-cyan-300 shadow-[0_0_10px_rgba(34,211,238,0.5)] shrink-0">
                        <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-cyan-300" />
                      </div>

                      {/* Hours Digits Card (when > 0) */}
                      {hours > 0 && (
                        <div className="bg-[#0B1E48] rounded-xl px-2 sm:px-2.5 py-0.5 sm:py-1 flex flex-col items-center justify-center min-w-[42px] sm:min-w-[48px] border border-blue-900/60 shadow-inner">
                          <span className="text-base sm:text-lg font-black font-mono text-white leading-tight">
                            {formattedHours}
                          </span>
                          <span className="text-[7.5px] sm:text-[8px] font-bold text-slate-300 tracking-wider">
                            HOURS
                          </span>
                        </div>
                      )}

                      {/* Minutes Digits Card */}
                      <div className="bg-[#0B1E48] rounded-xl px-2 sm:px-2.5 py-0.5 sm:py-1 flex flex-col items-center justify-center min-w-[42px] sm:min-w-[48px] border border-blue-900/60 shadow-inner">
                        <span className="text-base sm:text-lg font-black font-mono text-white leading-tight">
                          {formattedMins}
                        </span>
                        <span className="text-[7.5px] sm:text-[8px] font-bold text-slate-300 tracking-wider">
                          MINUTES
                        </span>
                      </div>

                      {/* Seconds Digits Card */}
                      <div className="bg-[#0B1E48] rounded-xl px-2 sm:px-2.5 py-0.5 sm:py-1 flex flex-col items-center justify-center min-w-[42px] sm:min-w-[48px] border border-blue-900/60 shadow-inner">
                        <span className="text-base sm:text-lg font-black font-mono text-white leading-tight">
                          {formattedSecs}
                        </span>
                        <span className="text-[7.5px] sm:text-[8px] font-bold text-slate-300 tracking-wider">
                          SECONDS
                        </span>
                      </div>
                    </div>

                    {/* Right cyan wave arcs */}
                    <svg className="w-3 h-7 sm:w-3.5 sm:h-8 text-cyan-400/90 shrink-0" viewBox="0 0 14 30" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                      <path d="M3 3C9 7 12 15 12 22C12 25 11 27 9 29" />
                      <path d="M1 8C5 11 7 15 7 20C7 22 6 23 5 25" />
                    </svg>
                  </div>
                )}

                {/* Join Webinar Button */}
                <a
                  href={resolvedWebinarUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={handleJoinWebinar}
                  className={`inline-flex items-center justify-center gap-2.5 px-5 sm:px-6 py-2.5 rounded-full font-bold text-white text-xs sm:text-sm no-underline ${
                    isWebinarLive
                      ? 'bg-gradient-to-r from-red-600 via-[#D946EF] to-[#4F46E5] shadow-lg shadow-red-600/40 hover:shadow-red-500/60 animate-pulse hover:animate-none'
                      : 'bg-gradient-to-r from-[#D946EF] via-[#A855F7] to-[#4F46E5] shadow-md shadow-purple-900/40 hover:shadow-purple-600/50'
                  } hover:opacity-95 active:scale-98 transition-all duration-200 cursor-pointer border border-white/20 shrink-0`}
                  id="join-webinar-now-btn"
                  data-testid="join-webinar-now-btn"
                  aria-label="Join Webinar Now"
                >
                  <div className="w-5 h-5 rounded-full bg-white text-[#D946EF] flex items-center justify-center shrink-0 shadow-xs">
                    <Play className="w-2.5 h-2.5 fill-current ml-0.5" />
                  </div>
                  <span className="font-bold tracking-tight">
                    {isWebinarLive ? 'Join Live Webinar Now' : 'Join Webinar Now'}
                  </span>
                  <ArrowRight className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
                </a>
              </div>
            </div>

            {/* Right Visual Area: Modern Transparent PNG Webinar Illustration */}
            <div className="hidden md:flex shrink-0 justify-center items-center relative">
              <div className="relative w-[180px] lg:w-[215px] aspect-[459/506] flex items-center justify-center">
                <div className="absolute inset-0 bg-blue-500/15 rounded-full blur-2xl transform scale-90 pointer-events-none" />
                <img
                  src="/webinar-illustration.png"
                  alt="Live Webinar Interaction"
                  className="relative z-10 w-full h-full object-contain drop-shadow-[0_12px_24px_rgba(0,0,0,0.45)] hover:scale-105 transition-transform duration-300 pointer-events-none select-none"
                  loading="eager"
                />
              </div>
            </div>
          </div>
        </div>

        {/* 3. WHY JOIN THIS WEBINAR? SECTION */}
        <div className="space-y-1 sm:space-y-1.5 shrink-0">
          <div className="flex items-center gap-1.5">
            <span className="text-xs sm:text-sm">🎯</span>
            <h2 className="text-xs sm:text-sm font-black text-slate-900 tracking-tight">
              Why Join This Webinar?
            </h2>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-2.5">
            {/* Card 1 */}
            <div className="bg-[#F0F7FF] border border-[#BFDBFE] rounded-2xl p-2 sm:p-2.5 flex items-center gap-2.5 shadow-2xs">
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-[#2563EB] text-white flex items-center justify-center shrink-0">
                <Users className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </div>
              <div className="min-w-0">
                <div className="text-[11px] sm:text-xs font-bold text-slate-900 leading-tight">
                  Direct Interaction with MNC Leaders
                </div>
                <div className="text-[9px] sm:text-[10px] text-slate-500 mt-0.5 leading-tight line-clamp-2">
                  Ask questions, get real-time answers, and build your network.
                </div>
              </div>
            </div>

            {/* Card 2 */}
            <div className="bg-[#FAF5FF] border border-[#E9D5FF] rounded-2xl p-2 sm:p-2.5 flex items-center gap-2.5 shadow-2xs">
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-[#9333EA] text-white flex items-center justify-center shrink-0">
                <Briefcase className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </div>
              <div className="min-w-0">
                <div className="text-[11px] sm:text-xs font-bold text-slate-900 leading-tight">
                  Real-World Tech Case Studies
                </div>
                <div className="text-[9px] sm:text-[10px] text-slate-500 mt-0.5 leading-tight line-clamp-2">
                  Learn from actual industry projects and success stories.
                </div>
              </div>
            </div>

            {/* Card 3 */}
            <div className="bg-[#F0FDF4] border border-[#BBF7D0] rounded-2xl p-2 sm:p-2.5 flex items-center gap-2.5 shadow-2xs">
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-[#10B981] text-white flex items-center justify-center shrink-0">
                <GraduationCap className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </div>
              <div className="min-w-0">
                <div className="text-[11px] sm:text-xs font-bold text-slate-900 leading-tight">
                  Advanced Training Modules
                </div>
                <div className="text-[9px] sm:text-[10px] text-slate-500 mt-0.5 leading-tight line-clamp-2">
                  Get hands-on with industry-relevant skills and tools.
                </div>
              </div>
            </div>

            {/* Card 4 */}
            <div className="bg-[#FFFBEB] border border-[#FED7AA] rounded-2xl p-2 sm:p-2.5 flex items-center gap-2.5 shadow-2xs">
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-[#F59E0B] text-white flex items-center justify-center shrink-0">
                <TrendingUp className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </div>
              <div className="min-w-0">
                <div className="text-[11px] sm:text-xs font-bold text-slate-900 leading-tight">
                  High-Value Placement Guidance
                </div>
                <div className="text-[9px] sm:text-[10px] text-slate-500 mt-0.5 leading-tight line-clamp-2">
                  Personalized support to help you land your dream job.
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 4. WANT TO EARN FREE INTERNSHIPS? SECTION */}
        <div className="bg-[#F8FAFF] border border-[#E0E7FF] rounded-2xl sm:rounded-3xl p-2.5 sm:p-3 space-y-2 shrink-0">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <span className="text-xs sm:text-sm">🚀</span>
              <h2 className="text-xs sm:text-sm font-black text-slate-900 tracking-tight">
                Want to Earn Free Internships?
              </h2>
            </div>
            <span className="text-[9px] sm:text-[10px] font-bold text-purple-600 bg-purple-100/70 border border-purple-200/60 px-2.5 py-0.5 rounded-full uppercase tracking-wider">
              Free Internships Opportunity
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {/* Card 1 */}
            <div className="bg-white rounded-xl sm:rounded-2xl border border-slate-100 px-3 py-1.5 sm:py-2 flex items-center gap-2.5 shadow-2xs">
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-[#2563EB] text-white flex items-center justify-center shrink-0 shadow-xs">
                <FileText className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-bold text-slate-900 leading-tight">Skill Assessment Test</div>
                <div className="text-[9px] sm:text-[10px] text-slate-500 mt-0.5 leading-tight">Short domain-based technical evaluation</div>
              </div>
            </div>

            {/* Card 2 */}
            <div className="bg-white rounded-xl sm:rounded-2xl border border-slate-100 px-3 py-1.5 sm:py-2 flex items-center gap-2.5 shadow-2xs">
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-[#9333EA] text-white flex items-center justify-center shrink-0 shadow-xs">
                <Award className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-bold text-slate-900 leading-tight">Merit Certificate</div>
                <div className="text-[9px] sm:text-[10px] text-slate-500 mt-0.5 leading-tight">Awarded to qualifying participants</div>
              </div>
            </div>
          </div>

          <a
            href={SKILL_ASSESSMENT_URL}
            onClick={() => {
              if (targetStudentId) {
                trackLeadActivity(targetStudentId, 'skill_assessment_clicked', 5, {
                  url: SKILL_ASSESSMENT_URL,
                }).catch(() => {});
              }
            }}
            className="w-full py-2 sm:py-2.5 px-4 rounded-xl sm:rounded-2xl font-bold text-white text-xs sm:text-sm bg-gradient-to-r from-[#00B074] via-[#10B981] to-[#34D399] hover:opacity-95 shadow-md shadow-emerald-500/20 transition-all flex items-center justify-center gap-1.5 cursor-pointer border-0 no-underline"
            id="take-skill-assessment-btn"
            data-testid="take-skill-assessment-btn"
          >
            <span>🚀</span>
            <span>Take Skill Assessment Now</span>
            <ArrowRight className="w-3.5 h-3.5 ml-0.5" />
          </a>
        </div>

      </main>

      {/* Floating Instagram Symbol on bottom right */}
      <FloatingInstagramButton />
    </div>
  );
}

