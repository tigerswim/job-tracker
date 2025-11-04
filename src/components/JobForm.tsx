"use client";

import { useState, useEffect } from "react";
import { Briefcase, Building, MapPin, DollarSign, FileText, Target, ClipboardList, ExternalLink, X } from "lucide-react";
import { createJob, updateJob, Job } from "@/lib/jobs";
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'; // Changed this import

const BLANK = {
  company: "",
  job_title: "",
  status: "bookmarked" as const,
  salary: "",
  location: "",
  job_url: "",
  job_description: "",
  notes: "",
};

const statusOptions = [
  { 
    id: 'bookmarked', 
    title: 'Bookmarked',
    description: 'Review in more detail',
    color: 'text-slate-600',
    bg: 'bg-slate-50',
    border: 'border-slate-200'
  },
  { 
    id: 'interested', 
    title: 'Interested',
    description: 'Job looks promising',
    color: 'text-slate-600',
    bg: 'bg-slate-50',
    border: 'border-slate-200'
  },
  { 
    id: 'applied', 
    title: 'Applied',
    description: 'Application submitted',
    color: 'text-blue-600',
    bg: 'bg-blue-50',
    border: 'border-blue-200'
  },
  { 
    id: 'interviewing', 
    title: 'Interviewing',
    description: 'In interview process',
    color: 'text-blue-700',
    bg: 'bg-blue-100',
    border: 'border-blue-300'
  },
  { 
    id: 'offered', 
    title: 'Offered',
    description: 'Received job offer',
    color: 'text-blue-600',
    bg: 'bg-blue-50',
    border: 'border-blue-200'
  },
  { 
    id: 'onhold', 
    title: 'On Hold',
    description: 'Position on hold',
    color: 'text-slate-500',
    bg: 'bg-slate-100',
    border: 'border-slate-300'
  },
    { 
    id: 'withdrawn', 
    title: 'Withdrawn',
    description: 'Removed myself',
    color: 'text-slate-500',
    bg: 'bg-slate-100',
    border: 'border-slate-300'
  },
  { 
    id: 'rejected', 
    title: 'Rejected',
    description: 'Candidacy declined',
    color: 'text-slate-500',
    bg: 'bg-slate-50',
    border: 'border-slate-200'
  },
  { 
    id: 'noresponse', 
    title: 'No Response',
    description: 'Ghosted',
    color: 'text-slate-500',
    bg: 'bg-slate-50',
    border: 'border-slate-200'
  }
];

// Updated interface to match JobList expectations
interface JobFormProps {
  job?: Job | null;
  onJobAdded: (job: Job) => void;
  onCancel: () => void;
}

export default function JobForm({ job: editingJob, onJobAdded, onCancel }: JobFormProps) {
  const [form, setForm] = useState(BLANK);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset form when editing job changes
  useEffect(() => {
    if (editingJob) {
      setForm({
        company: editingJob.company,
        job_title: editingJob.job_title,
        status: editingJob.status,
        salary: editingJob.salary || "",
        location: editingJob.location || "",
        job_url: editingJob.job_url || "",
        job_description: editingJob.job_description || "",
        notes: editingJob.notes || "",
      });
    } else {
      setForm(BLANK);
    }
    setError(null);
  }, [editingJob]);

  const handleChange = (key: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setForm({ ...form, [key]: e.target.value });
    // Clear error when user starts typing
    if (error) setError(null);
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    console.log('=== JobForm handleSubmit started ===');
    console.log('Editing job:', editingJob?.id);
    console.log('Form data:', form);

    try {
      // Use the same Supabase client as jobs.ts
      const supabase = createClientComponentClient();
      
      console.log('Getting user authentication...');
      const { data: { user }, error: userError } = await supabase.auth.getUser();

      if (userError) {
        console.error('User authentication error:', userError);
        throw new Error(`Authentication failed: ${userError.message}`);
      }

      if (!user) {
        console.error('No authenticated user found');
        // Try getting session as backup
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        console.log('Session check:', { session: !!session, user: !!session?.user, error: sessionError });
        
        if (!session?.user) {
          throw new Error('No authenticated user');
        }
      }

      console.log('User authenticated successfully:', user?.id || 'from session');

      const payload = {
        ...form,
        salary: form.salary || null,
        location: form.location || null,
        job_url: form.job_url || null,
        job_description: form.job_description || null,
        notes: form.notes || null,
      };

      console.log('Calling job operation with payload:', payload);

      let result: Job | null = null;

      if (editingJob) {
        console.log('Updating existing job:', editingJob.id);
        result = await updateJob(editingJob.id, payload);
      } else {
        console.log('Creating new job');
        result = await createJob(payload);
      }

      if (!result) {
        throw new Error(editingJob ? 'Failed to update job' : 'Failed to create job');
      }

      console.log('Job operation successful:', result);
      onJobAdded(result);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      console.error('Error in JobForm handleSubmit:', errorMessage);
      console.error('Full error:', err);
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 pointer-events-none">
      {/* Backdrop - subtle, semi-transparent */}
      <div
        className="absolute inset-0 bg-black/20 pointer-events-auto"
        onClick={onCancel}
      />

      {/* Slide-in Panel */}
      <div className="fixed top-0 right-0 h-full w-full md:w-[700px] lg:w-[800px] bg-white shadow-2xl pointer-events-auto transform transition-transform duration-300 ease-out animate-slide-in-right overflow-hidden flex flex-col">
        {/* Header - Fixed at top */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-4 py-3 text-white flex-shrink-0">
          <div className="flex flex-col space-y-3">
            {/* Top row - Title and Close button */}
            <div className="flex justify-between items-start">
              <div className="flex items-center space-x-2 flex-1 min-w-0">
                <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Briefcase className="w-4 h-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="text-lg font-bold truncate">
                    {editingJob ? 'Edit Job Application' : 'New Job Application'}
                  </h2>
                  <p className="text-blue-100 text-xs truncate">
                    {editingJob ? 'Update job application details' : 'Track a new job opportunity'}
                  </p>
                </div>
              </div>
              <button
                onClick={onCancel}
                className="p-1.5 text-white/80 hover:text-white hover:bg-white/20 rounded-lg transition-all duration-200 flex-shrink-0 ml-2"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Bottom row - Action buttons */}
            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={onCancel}
                disabled={loading}
                className="px-3 py-2 text-sm text-white/80 hover:text-white hover:bg-white/20 rounded-lg transition-all duration-200 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                form="job-form"
                disabled={loading || !form.company.trim() || !form.job_title.trim()}
                className="flex-1 px-3 py-2 text-sm bg-white/20 hover:bg-white/30 text-white rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
              >
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>Saving...</span>
                  </>
                ) : (
                  <span>{editingJob ? "Update Job" : "Add Job"}</span>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Form Content - Scrollable */}
        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
          {/* Error Display */}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
              <div className="flex items-center">
                <span className="font-medium">Error:</span>
                <span className="ml-2">{error}</span>
              </div>
            </div>
          )}

          <form id="job-form" onSubmit={handleSubmit} className="space-y-6">
            {/* Company & Job Title Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="form-group">
                <label className="form-label flex items-center space-x-2">
                  <Building className="w-4 h-4 text-slate-500" />
                  <span>Company Name *</span>
                </label>
                <input
                  type="text"
                  required
                  value={form.company}
                  onChange={handleChange('company')}
                  className="input"
                  placeholder="e.g., Google, Microsoft, Acme Corp"
                />
              </div>

              <div className="form-group">
                <label className="form-label flex items-center space-x-2">
                  <Briefcase className="w-4 h-4 text-slate-500" />
                  <span>Job Title *</span>
                </label>
                <input
                  type="text"
                  required
                  value={form.job_title}
                  onChange={handleChange('job_title')}
                  className="input"
                  placeholder="e.g., Software Engineer, Product Manager"
                />
              </div>
            </div>

            {/* Status Selection */}
            <div className="form-group">
              <label className="form-label flex items-center space-x-2">
                <Target className="w-4 h-4 text-slate-500" />
                <span>Application Status</span>
              </label>
              <div className="grid grid-cols-3 md:grid-cols-3 gap-3">
                {statusOptions.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => setForm({ ...form, status: option.id as any })}
                    className={`p-4 rounded-lg border-2 text-left transition-all duration-200 ${
                      form.status === option.id
                        ? `${option.bg} ${option.border} ${option.color} border-opacity-100 shadow-sm transform scale-105`
                        : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <div className="font-semibold text-sm">{option.title}</div>
                    <div className="text-xs opacity-75 mt-1">{option.description}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Location & Salary Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="form-group">
                <label className="form-label flex items-center space-x-2">
                  <MapPin className="w-4 h-4 text-slate-500" />
                  <span>Location</span>
                </label>
                <input
                  type="text"
                  value={form.location}
                  onChange={handleChange('location')}
                  className="input"
                  placeholder="e.g., San Francisco, CA or Remote"
                />
              </div>

              <div className="form-group">
                <label className="form-label flex items-center space-x-2">
                  <DollarSign className="w-4 h-4 text-slate-500" />
                  <span>Salary Range</span>
                </label>
                <input
                  type="text"
                  value={form.salary}
                  onChange={handleChange('salary')}
                  className="input"
                  placeholder="e.g., $90,000 - $120,000 or $100k+"
                />
              </div>
            </div>

            {/* Job URL */}
            <div className="form-group">
              <label className="form-label flex items-center space-x-2">
                <ExternalLink className="w-4 h-4 text-slate-500" />
                <span>Job Posting URL</span>
              </label>
              <input
                type="url"
                value={form.job_url}
                onChange={handleChange('job_url')}
                className="input"
                placeholder="https://company.com/careers/job-posting or LinkedIn job link"
              />
              <p className="form-help">
                Link to the original job posting for easy reference
              </p>
            </div>

            {/* Job Description */}
            <div className="form-group">
              <label className="form-label flex items-center space-x-2">
                <ClipboardList className="w-4 h-4 text-slate-500" />
                <span>Job Description</span>
              </label>
              <textarea
                value={form.job_description}
                onChange={handleChange('job_description')}
                className="input min-h-[120px] resize-y"
                placeholder="Paste the job description, key requirements, or responsibilities..."
                rows={5}
              />
              <p className="form-help">
                Include the full job posting, requirements, or key details from the listing
              </p>
            </div>

            {/* Notes */}
            <div className="form-group">
              <label className="form-label flex items-center space-x-2">
                <FileText className="w-4 h-4 text-slate-500" />
                <span>Personal Notes</span>
              </label>
              <textarea
                value={form.notes}
                onChange={handleChange('notes')}
                className="input min-h-[100px] resize-y"
                placeholder="Add your thoughts, research notes, or application strategy..."
                rows={4}
              />
              <p className="form-help">
                Include your research, application strategy, or interview preparation notes
              </p>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}