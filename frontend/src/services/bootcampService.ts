import supabase from '@/lib/supabase';
import type { Bootcamp, BootcampRegistration } from '@/types';

// ── Get active bootcamps ──────────────────────────────────────
export async function getBootcamps(): Promise<Bootcamp[]> {
  const { data, error } = await supabase
    .from('bootcamps')
    .select(`*, domain:domains(name, slug, icon, color)`)
    .eq('active', true)
    .in('status', ['upcoming', 'live'])
    .order('start_date', { ascending: true });

  if (error) throw error;
  return (data || []) as Bootcamp[];
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ── Get bootcamp by ID ────────────────────────────────────────
export async function getBootcampById(id: string): Promise<Bootcamp | null> {
  if (!id || !UUID_REGEX.test(id)) return null;
  try {
    const { data, error } = await supabase
      .from('bootcamps')
      .select(`*, domain:domains(name, slug, icon, color)`)
      .eq('id', id)
      .maybeSingle();

    if (error) return null;
    return data as Bootcamp | null;
  } catch {
    return null;
  }
}

// ── Get bootcamp by slug ──────────────────────────────────────
export async function getBootcampBySlug(slug: string): Promise<Bootcamp | null> {
  try {
    const { data, error } = await supabase
      .from('bootcamps')
      .select(`*, domain:domains(name, slug, icon, color)`)
      .eq('slug', slug)
      .maybeSingle();

    if (error) return null;
    return data as Bootcamp | null;
  } catch {
    return null;
  }
}

// ── Get bootcamp for a domain (used in result page CTA) ──────
export async function getBootcampForDomain(domainId?: string): Promise<Bootcamp | null> {
  const isValidUuid = domainId && UUID_REGEX.test(domainId);

  if (isValidUuid) {
    try {
      const { data, error } = await supabase
        .from('bootcamps')
        .select(`*, domain:domains(name, slug, icon, color)`)
        .eq('domain_id', domainId)
        .eq('active', true)
        .in('status', ['upcoming', 'live'])
        .order('start_date', { ascending: true })
        .limit(1)
        .maybeSingle();

      if (!error && data) {
        return data as Bootcamp;
      }
    } catch {}
  }

  // Fallback: get any upcoming bootcamp
  try {
    const { data: fallback, error: fallbackError } = await supabase
      .from('bootcamps')
      .select(`*, domain:domains(name, slug, icon, color)`)
      .eq('active', true)
      .in('status', ['upcoming', 'live'])
      .order('start_date', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (fallbackError) return null;
    return fallback as Bootcamp | null;
  } catch {
    return null;
  }
}

// ── Register for a bootcamp ───────────────────────────────────
export async function registerForBootcamp(
  bootcampId: string,
  studentId: string,
  quizResultId: string | null,
  preferredTiming: string,
  learningGoal: string,
  options?: {
    preferredBatch?: string;
    mode?: 'online' | 'offline';
    whatsappOptIn?: boolean;
  }
): Promise<BootcampRegistration> {
  // Check for existing registration
  const { data: existing } = await supabase
    .from('bootcamp_registrations')
    .select('id')
    .eq('bootcamp_id', bootcampId)
    .eq('student_id', studentId)
    .maybeSingle();

  if (existing) {
    throw new Error('You are already registered for this bootcamp.');
  }

  const timingValue = options?.preferredBatch
    ? `${options.preferredBatch} (${preferredTiming || 'Standard'})`
    : preferredTiming;

  const { data, error } = await supabase
    .from('bootcamp_registrations')
    .insert({
      bootcamp_id: bootcampId,
      student_id: studentId,
      quiz_result_id: quizResultId || null,
      preferred_timing: timingValue,
      learning_goal: learningGoal || 'Upskilling & Career Advancement',
      status: 'registered',
    })
    .select(`*, bootcamp:bootcamps(*)`)
    .single();

  if (error) throw error;

  // Update lead score & status: Bootcamp Registered -> HOT
  await updateLeadForBootcamp(studentId);

  // Log activity
  await supabase.from('lead_activities').insert({
    student_id: studentId,
    activity_type: 'bootcamp_registered',
    activity_data: {
      bootcamp_id: bootcampId,
      batch: options?.preferredBatch,
      mode: options?.mode || 'online',
    },
    score_change: 30,
  });

  return {
    ...(data as BootcampRegistration),
    preferred_batch: options?.preferredBatch,
    mode: options?.mode || 'online',
    whatsapp_opt_in: options?.whatsappOptIn ?? true,
  };
}

// ── Update lead on bootcamp registration ──────────────────────
async function updateLeadForBootcamp(studentId: string): Promise<void> {
  const { data: lead } = await supabase
    .from('leads')
    .select('lead_score, has_registered_bootcamp')
    .eq('student_id', studentId)
    .maybeSingle();

  if (!lead) return;

  const newScore = Math.min(100, (lead.lead_score || 0) + 30);
  const newStatus = newScore >= 70 ? 'HOT' : newScore >= 40 ? 'WARM' : 'NURTURE';

  await supabase
    .from('leads')
    .update({
      lead_score: newScore,
      lead_status: newStatus,
      has_registered_bootcamp: true,
      last_activity_at: new Date().toISOString(),
      qualification_reason: `${newStatus}: completed assessment and registered for bootcamp`,
    })
    .eq('student_id', studentId);
}

// ── Check if student is registered ───────────────────────────
export async function checkBootcampRegistration(
  bootcampId: string,
  studentId: string
): Promise<BootcampRegistration | null> {
  const { data, error } = await supabase
    .from('bootcamp_registrations')
    .select('*')
    .eq('bootcamp_id', bootcampId)
    .eq('student_id', studentId)
    .maybeSingle();

  if (error) throw error;
  return data as BootcampRegistration | null;
}

// ── Admin: All bootcamps ──────────────────────────────────────
export async function adminGetBootcamps(): Promise<Bootcamp[]> {
  const { data, error } = await supabase
    .from('bootcamps')
    .select(`*, domain:domains(name)`)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data || []) as Bootcamp[];
}

// ── Admin: Get bootcamp registrations ────────────────────────
export async function getBootcampRegistrations(bootcampId: string) {
  const { data, error } = await supabase
    .from('bootcamp_registrations')
    .select(`*, student:students(full_name, email, mobile, college)`)
    .eq('bootcamp_id', bootcampId)
    .order('registered_at', { ascending: false });

  if (error) throw error;
  return data || [];
}
