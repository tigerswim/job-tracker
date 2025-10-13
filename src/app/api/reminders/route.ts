
// src/app/api/reminders/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";

// Helper function to get authenticated user
async function getAuthenticatedUser(request: NextRequest) {
  const cookieStore = await cookies();
  const supabase = createRouteHandlerClient({ cookies: () => cookieStore });
  const { data: { user }, error } = await supabase.auth.getUser();
  
  if (error) {
    console.error("Authentication error in API route:", error);
    return { user: null, supabase: null, error: error.message };
  }

  if (!user) {
    console.log("No authenticated user found in API route");
    return { user: null, supabase: null, error: "No authenticated user" };
  }
  
  console.log("User authenticated in API route:", user.id);
  return { user, supabase, error: null };
}

// GET /api/reminders - Fetch user's reminders with filtering and pagination
export async function GET(request: NextRequest) {
  try {
    console.log("GET /api/reminders - Starting fetch request");
    
    const { user, supabase, error: authError } = await getAuthenticatedUser(request);
    
    if (authError || !user || !supabase) {
      console.error("Auth failed:", authError);
      return NextResponse.json({ error: authError || "Unauthorized" }, { status: 401 });
    }

    console.log("Authenticated user:", user.id);
    
    const { searchParams } = new URL(request.url);

    // Extract query parameters
    const searchTerm = searchParams.get("search") || "";
    const status = searchParams.get("status") || "all";
    const contactId = searchParams.get("contact_id");
    const jobId = searchParams.get("job_id");
    const dateFrom = searchParams.get("date_from");
    const dateTo = searchParams.get("date_to");
    const limit = parseInt(searchParams.get("limit") || "50", 10);
    const offset = parseInt(searchParams.get("offset") || "0", 10);
    const sortBy = searchParams.get("sort_by") || "scheduled_time";
    const sortOrder = searchParams.get("sort_order") || "asc";

    console.log("Query params:", { searchTerm, status, contactId, jobId, limit, offset, sortBy, sortOrder });

    // Build the query with joins to get contact and job information
    let query = supabase
      .from("email_reminders")
      .select(`
        *,
        contacts:contact_id (
          name,
          email,
          company,
          job_title
        ),
        jobs:job_id (
          job_title,
          company,
          location
        )
      `)
      .eq("user_id", user.id);

    // Apply filters
    if (status !== "all") {
      query = query.eq("status", status);
    }

    if (contactId) {
      query = query.eq("contact_id", contactId);
    }

    if (jobId) {
      query = query.eq("job_id", jobId);
    }

    if (dateFrom) {
      query = query.gte("scheduled_time", dateFrom);
    }

    if (dateTo) {
      query = query.lte("scheduled_time", dateTo);
    }

    if (searchTerm) {
      query = query.or(`
        email_subject.ilike.%${searchTerm}%,
        user_message.ilike.%${searchTerm}%,
        contacts.name.ilike.%${searchTerm}%,
        contacts.company.ilike.%${searchTerm}%,
        jobs.job_title.ilike.%${searchTerm}%,
        jobs.company.ilike.%${searchTerm}%
      `);
    }

    // Apply sorting
    const ascending = sortOrder === "asc";
    query = query.order(sortBy, { ascending });

    // Apply pagination
    query = query.range(offset, offset + limit - 1);

    console.log("Executing reminders query...");
    const { data: reminders, error: fetchError } = await query;

    if (fetchError) {
      console.error("Database fetch error:", fetchError);
      return NextResponse.json({ error: "Failed to fetch reminders" }, { status: 500 });
    }

    console.log(`Found ${reminders?.length || 0} reminders`);

    // Transform the data to flatten the joined fields
    const transformedReminders = (reminders || []).map(reminder => ({
      ...reminder,
      contact_name: reminder.contacts?.name || null,
      contact_email: reminder.contacts?.email || null,
      contact_company: reminder.contacts?.company || null,
      contact_job_title: reminder.contacts?.job_title || null,
      job_title: reminder.jobs?.job_title || null,
      job_company: reminder.jobs?.company || null,
      job_location: reminder.jobs?.location || null,
      contacts: undefined, // Remove the nested object
      jobs: undefined, // Remove the nested object
    }));

    // Get total count for pagination
    const { count: totalCount, error: countError } = await supabase
      .from("email_reminders")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id);

    if (countError) {
      console.error("Count error:", countError);
      // Continue without exact count
    }

    const total = totalCount || transformedReminders.length;
    const hasMore = offset + limit < total;

    console.log(`Returning ${transformedReminders.length} reminders, total: ${total}, hasMore: ${hasMore}`);

    return NextResponse.json({
      reminders: transformedReminders,
      total,
      hasMore,
      offset,
      limit
    });

  } catch (error) {
    console.error("Exception in GET /api/reminders:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST /api/reminders - Create a new reminder
export async function POST(request: NextRequest) {
  try {
    console.log("POST /api/reminders - Starting create request");
    
    const { user, supabase, error: authError } = await getAuthenticatedUser(request);
    
    if (authError || !user || !supabase) {
      console.error("Auth failed:", authError);
      return NextResponse.json({ error: authError || "Unauthorized" }, { status: 401 });
    }

    console.log("Authenticated user:", user.id);
    
    const body = await request.json();

    console.log("Create reminder request:", body);

    // Validate required fields
    if (!body.scheduled_time || !body.email_subject || !body.user_message) {
      return NextResponse.json({ 
        error: "Missing required fields: scheduled_time, email_subject, user_message" 
      }, { status: 400 });
    }

    // Validate scheduled time
    const scheduledDate = new Date(body.scheduled_time);
    const now = new Date();
    const minDate = new Date(now.getTime() + (5 * 60 * 1000)); // 5 minutes from now
    const maxDate = new Date(now.getTime() + (12 * 30 * 24 * 60 * 60 * 1000)); // 12 months from now

    if (scheduledDate < minDate || scheduledDate > maxDate) {
      return NextResponse.json({ 
        error: "Scheduled time must be between 5 minutes and 12 months from now" 
      }, { status: 400 });
    }

    // Generate email body based on context
    let emailBody = "";
    
    if (body.contact_id) {
      const { data: contact } = await supabase
        .from("contacts")
        .select("name, email, company, job_title")
        .eq("id", body.contact_id)
        .eq("user_id", user.id)
        .single();

      if (contact) {
        emailBody = `Reminder to follow up with ${contact.name}${contact.company ? ` at ${contact.company}` : ""}`;
        if (contact.company) emailBody += ` at ${contact.company}`;
        if (contact.job_title) emailBody += ` (${contact.job_title})`;
        emailBody += ".\n\n";
      }
    }

    if (body.job_id) {
      const { data: job } = await supabase
        .from("jobs")
        .select("job_title, company, location")
        .eq("id", body.job_id)
        .eq("user_id", user.id)
        .single();

      if (job) {
        if (emailBody) emailBody += "Related to: ";
        emailBody += `${job.job_title} position at ${job.company}`;
        if (job.location) emailBody += ` (${job.location})`;
        emailBody += ".\n\n";
      }
    }

    emailBody += `Your message:\n${body.user_message}`;

    // Create the reminder
    const reminderData = {
      user_id: user.id,
      contact_id: body.contact_id || null,
      job_id: body.job_id || null,
      scheduled_time: body.scheduled_time,
      user_timezone: body.user_timezone || "UTC",
      email_subject: body.email_subject,
      email_body: emailBody,
      user_message: body.user_message,
      status: "pending"
    };

    console.log("Creating reminder with data:", reminderData);

    const { data: newReminder, error: createError } = await supabase
      .from("email_reminders")
      .insert(reminderData)
      .select(`
        *,
        contacts:contact_id (
          name,
          email,
          company,
          job_title
        ),
        jobs:job_id (
          job_title,
          company,
          location
        )
      `)
      .single();

    if (createError) {
      console.error("Error creating reminder:", createError);
      return NextResponse.json({ error: "Failed to create reminder" }, { status: 500 });
    }

    console.log("Successfully created reminder:", newReminder.id);

    // Transform the response
    const transformedReminder = {
      ...newReminder,
      contact_name: newReminder.contacts?.name || null,
      contact_email: newReminder.contacts?.email || null,
      contact_company: newReminder.contacts?.company || null,
      contact_job_title: newReminder.contacts?.job_title || null,
      job_title: newReminder.jobs?.job_title || null,
      job_company: newReminder.jobs?.company || null,
      job_location: newReminder.jobs?.location || null,
      contacts: undefined,
      jobs: undefined,
    };

    return NextResponse.json({ reminder: transformedReminder }, { status: 201 });

  } catch (error) {
    console.error("Exception in POST /api/reminders:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}


