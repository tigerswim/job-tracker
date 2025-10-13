// src/lib/csvUtils.ts - Enhanced with better empty field handling and validation + current_location
import { Job, Contact, Interaction } from './supabase'
import { fetchJobs } from './jobs'
import { getContacts } from './contacts'
import { getInteractions } from './interactions'
import { supabase } from './supabase'

// Date field mappings for different data types - Updated to match actual database schema
const DATE_FIELDS = {
  jobs: ['applied_date', 'date_added', 'created_at', 'updated_at'],
  contacts: ['created_at', 'updated_at'],
  interactions: ['date', 'created_at', 'updated_at']
}

// Enhanced CSV Download Functions with Flattened Fields
export async function downloadJobsCSV() {
  const jobs = await fetchJobs()
  const csvContent = convertToCSV(jobs, [
    'id', 'job_title', 'company', 'location', 'salary', 'job_url', 'status', 'applied_date', 'job_description', 'notes'
  ])
  downloadCSV(csvContent, 'jobs.csv')
}

// Function to check for duplicate jobs
async function checkJobDuplicates(newJobs: any[], userId: string): Promise<{
  toInsert: any[]
  duplicates: any[]
  duplicateDetails: Array<{job_title: string, company: string, status: string, reason: string}>
}> {
  const { data: existingJobs, error } = await supabase
    .from('jobs')
    .select('job_title, company, status')
    .eq('user_id', userId)

  if (error) {
    console.error('Error fetching existing jobs:', error)
    return { toInsert: newJobs, duplicates: [], duplicateDetails: [] }
  }

  const toInsert: any[] = []
  const duplicates: any[] = []
  const duplicateDetails: Array<{job_title: string, company: string, status: string, reason: string}> = []

  newJobs.forEach(newJob => {
    const isDuplicate = existingJobs?.some(existingJob => 
      existingJob.job_title.toLowerCase().trim() === newJob.job_title.toLowerCase().trim() &&
      existingJob.company.toLowerCase().trim() === newJob.company.toLowerCase().trim() &&
      existingJob.status.toLowerCase().trim() === newJob.status.toLowerCase().trim()
    )

    if (isDuplicate) {
      duplicates.push(newJob)
      duplicateDetails.push({
        job_title: newJob.job_title,
        company: newJob.company,
        status: newJob.status,
        reason: 'Same job title, company, and status already exists'
      })
    } else {
      toInsert.push(newJob)
    }
  })

  return { toInsert, duplicates, duplicateDetails }
}

// Function to check for duplicate contacts
async function checkContactDuplicates(newContacts: any[], userId: string): Promise<{
  toInsert: any[]
  duplicates: any[]
  duplicateDetails: Array<{name: string, current_role: string, reason: string}>
}> {
  const { data: existingContacts, error } = await supabase
    .from('contacts')
    .select('name, job_title, company')
    .eq('user_id', userId)

  if (error) {
    console.error('Error fetching existing contacts:', error)
    return { toInsert: newContacts, duplicates: [], duplicateDetails: [] }
  }

  const toInsert: any[] = []
  const duplicates: any[] = []
  const duplicateDetails: Array<{name: string, current_role: string, reason: string}> = []

  newContacts.forEach(newContact => {
    const newCurrentRole = newContact.job_title && newContact.company 
      ? `${newContact.job_title} at ${newContact.company}`
      : newContact.job_title || newContact.company || ''

    const isDuplicate = existingContacts?.some(existingContact => {
      const existingCurrentRole = existingContact.job_title && existingContact.company
        ? `${existingContact.job_title} at ${existingContact.company}`
        : existingContact.job_title || existingContact.company || ''

      return existingContact.name.toLowerCase().trim() === newContact.name.toLowerCase().trim() &&
             existingCurrentRole.toLowerCase().trim() === newCurrentRole.toLowerCase().trim()
    })

    if (isDuplicate) {
      duplicates.push(newContact)
      duplicateDetails.push({
        name: newContact.name,
        current_role: newCurrentRole,
        reason: 'Same name and current role already exists'
      })
    } else {
      toInsert.push(newContact)
    }
  })

  return { toInsert, duplicates, duplicateDetails }
}

// Function to check for duplicate interactions
async function checkInteractionDuplicates(newInteractions: any[], userId: string): Promise<{
  toInsert: any[]
  duplicates: any[]
  duplicateDetails: Array<{contact_id: string, date: string, type: string, reason: string}>
}> {
  const { data: existingInteractions, error } = await supabase
    .from('interactions')
    .select('contact_id, date, type')
    .eq('user_id', userId)

  if (error) {
    console.error('Error fetching existing interactions:', error)
    return { toInsert: newInteractions, duplicates: [], duplicateDetails: [] }
  }

  const toInsert: any[] = []
  const duplicates: any[] = []
  const duplicateDetails: Array<{contact_id: string, date: string, type: string, reason: string}> = []

  newInteractions.forEach(newInteraction => {
    const isDuplicate = existingInteractions?.some(existingInteraction => 
      existingInteraction.contact_id === newInteraction.contact_id &&
      existingInteraction.date === newInteraction.date &&
      existingInteraction.type.toLowerCase().trim() === newInteraction.type.toLowerCase().trim()
    )

    if (isDuplicate) {
      duplicates.push(newInteraction)
      duplicateDetails.push({
        contact_id: newInteraction.contact_id,
        date: newInteraction.date,
        type: newInteraction.type,
        reason: 'Same contact, date, and type already exists'
      })
    } else {
      toInsert.push(newInteraction)
    }
  })

  return { toInsert, duplicates, duplicateDetails }
}

// Export the duplicate checking functions
export { checkJobDuplicates, checkContactDuplicates, checkInteractionDuplicates }

export async function downloadContactsCSV() {
  const contacts = await getContacts()
  
  // Find the maximum number of experiences, education entries, and mutual connections
  const maxExperiences = Math.max(...contacts.map(c => c.experience?.length || 0), 0)
  const maxEducation = Math.max(...contacts.map(c => c.education?.length || 0), 0)
  const maxMutualConnections = Math.max(...contacts.map(c => c.mutual_connections?.length || 0), 0)
  
  // Create base fields - Updated to include current_location
  const baseFields = [
    'id', 'name', 'email', 'phone', 'current_location', 'company', 'job_title', 'linkedin_url', 'notes'
  ]
  
  // Add flattened experience fields
  const experienceFields: string[] = []
  for (let i = 0; i < maxExperiences; i++) {
    experienceFields.push(
      `experience_${i + 1}_company`,
      `experience_${i + 1}_title`,
      `experience_${i + 1}_start_date`,
      `experience_${i + 1}_end_date`,
      `experience_${i + 1}_is_current`,
      `experience_${i + 1}_description`
    )
  }
  
  // Add flattened education fields
  const educationFields: string[] = []
  for (let i = 0; i < maxEducation; i++) {
    educationFields.push(
      `education_${i + 1}_institution`,
      `education_${i + 1}_degree_and_field`,
      `education_${i + 1}_year`,
      `education_${i + 1}_notes`
    )
  }
  
  // Add flattened mutual connection fields
  const mutualConnectionFields: string[] = []
  for (let i = 0; i < maxMutualConnections; i++) {
    mutualConnectionFields.push(`mutual_connection_${i + 1}`)
  }
  
  const allFields = [...baseFields, ...experienceFields, ...educationFields, ...mutualConnectionFields]
  
  // Transform contacts to include flattened fields
  const flattenedContacts = contacts.map(contact => {
    const flattened: any = { ...contact }
    
    // Flatten experiences
    if (contact.experience) {
      contact.experience.forEach((exp, index) => {
        flattened[`experience_${index + 1}_company`] = exp.company
        flattened[`experience_${index + 1}_title`] = exp.title
        flattened[`experience_${index + 1}_start_date`] = exp.start_date
        flattened[`experience_${index + 1}_end_date`] = exp.end_date || ''
        flattened[`experience_${index + 1}_is_current`] = exp.is_current
        flattened[`experience_${index + 1}_description`] = exp.description || ''
      })
    }
    
    // Flatten education
    if (contact.education) {
      contact.education.forEach((edu, index) => {
        flattened[`education_${index + 1}_institution`] = edu.institution
        flattened[`education_${index + 1}_degree_and_field`] = edu.degree_and_field
        flattened[`education_${index + 1}_year`] = edu.year
        flattened[`education_${index + 1}_notes`] = edu.notes || ''
      })
    }
    
    // Flatten mutual connections
    if (contact.mutual_connections) {
      contact.mutual_connections.forEach((conn, index) => {
        flattened[`mutual_connection_${index + 1}`] = conn
      })
    }
    
    return flattened
  })
  
  const csvContent = convertToCSV(flattenedContacts, allFields)
  downloadCSV(csvContent, 'contacts.csv')
}

export async function downloadInteractionsCSV() {
  const interactions = await getInteractions()
  const csvContent = convertToCSV(interactions, [
    'id', 'contact_id', 'type', 'date', 'summary', 'notes'
  ])
  downloadCSV(csvContent, 'interactions.csv')
}

// Enhanced CSV Upload Functions with Better Empty Field Handling
export function parseCSVForDataType(csvText: string, dataType: 'jobs' | 'contacts' | 'interactions'): any[] {
  // Remove BOM character if present
  const cleanedCsvText = csvText.replace(/^\uFEFF/, '');
  
  // Parse the CSV properly handling quoted multi-line fields
  const parsedRows = parseCSVWithMultilineSupport(cleanedCsvText);
  
  if (parsedRows.length < 2) {
    console.warn('CSV has less than 2 lines (header + at least one data row)')
    return []
  }

  // Get headers and clean them
  const rawHeaders = parsedRows[0];
  const headers = rawHeaders.map(h => {
    // Clean header: remove quotes, trim, convert to lowercase
    let cleaned = h.trim().replace(/^["']|["']$/g, '').trim()
    return cleaned.toLowerCase()
  }).filter(h => h.length > 0) // Remove empty headers
  
  console.log(`Parsing ${dataType} CSV with ${headers.length} headers:`, headers)
  
  if (headers.length === 0) {
    console.error('No valid headers found')
    return []
  }

  const data: any[] = []
  const validStatuses = getValidStatusValues(dataType)

  // Process data rows (skip header row)
  for (let i = 1; i < parsedRows.length; i++) {
    const values = parsedRows[i];
    
    // Skip if row doesn't have any values
    if (values.length === 0 || values.every(v => !v || v.trim() === '')) {
      console.log(`Skipping empty row ${i + 1}`)
      continue
    }
    
    // Adjust array length to match headers
    if (values.length < headers.length) {
      while (values.length < headers.length) {
        values.push('')
      }
    } else if (values.length > headers.length) {
      values.splice(headers.length)
    }
    
    // Parse the row
    let row: any = {}
    let hasValidData = false
    let hasRequiredFields = false
    
    headers.forEach((header, index) => {
      let value = values[index] ? values[index].trim() : ''
      
      // Convert empty strings and null-like values to appropriate defaults
      if (value === '' || value === 'null' || value === 'NULL' || value === 'undefined') {
        // Handle required fields that can't be null
        if (header === 'status' && dataType === 'jobs') {
          value = 'Applied' // Default status for jobs
        } else if (header === 'type' && dataType === 'interactions') {
          value = 'other' // Default type for interactions
        } else {
          value = null
        }
      } else {
        hasValidData = true
        
        // Validate status field specifically
        if (header === 'status' && dataType === 'jobs') {
          const normalizedStatus = value.trim().toLowerCase()
          const validStatus = validStatuses.find(s => s.toLowerCase() === normalizedStatus)
          if (validStatus) {
            value = validStatus // Use the properly cased version
          } else {
            console.warn(`Row ${i + 1}: Invalid status "${value}". Setting to default "Bookmarked". Valid options: ${validStatuses.join(', ')}`)
            value = 'Bookmarked' // Set to default instead of null
          }
        }
        
        // Handle date fields
        if (isDateField(header, dataType) && value) {
          const convertedDate = convertDateToPostgreSQL(value)
          if (convertedDate) {
            value = convertedDate
            console.log(`Converted date in field "${header}": "${values[index]}" -> "${convertedDate}"`)
          } else {
            console.warn(`Could not convert date format for field "${header}": "${value}". Setting to null.`)
            value = null
          }
        }
        
        // Handle boolean fields
        if (typeof value === 'string') {
          const lowerValue = value.toLowerCase()
          if (lowerValue === 'true' || lowerValue === 'false') {
            value = lowerValue === 'true'
          }
        }
        
        // Check if this is a required field with valid data
        if (isRequiredField(header, dataType) && value && value !== null) {
          hasRequiredFields = true
        }
      }
      
      row[header] = value
    })
    
    // After parsing all fields, ensure required non-null fields have values
    if (dataType === 'jobs') {
      // Ensure status is never null for jobs
      if (!row.status || row.status === null) {
        row.status = 'Applied'
        console.log(`Row ${i + 1}: Setting missing status to default "Applied"`)
      }
    } else if (dataType === 'interactions') {
      // Ensure type is never null for interactions
      if (!row.type || row.type === null) {
        row.type = 'other'
        console.log(`Row ${i + 1}: Setting missing interaction type to default "other"`)
      }
    }

    // Enhanced validation: must have valid data AND required fields
    if (hasValidData && hasRequiredFields && isValidRowForDataType(row, dataType)) {
      // For contacts, reconstruct complex fields from flattened data
      if (dataType === 'contacts') {
        row = reconstructContactFromFlattenedData(row, headers)
      }
      
      // Clean up the row - remove any fields not expected for this data type
      row = sanitizeRowForDataType(row, dataType)
      
      data.push(row)
      console.log(`✅ Row ${i + 1} parsed successfully`)
    } else {
      console.log(`❌ Skipping row ${i + 1} - insufficient valid data for ${dataType}. HasValidData: ${hasValidData}, HasRequiredFields: ${hasRequiredFields}`)
      console.log('Row data:', Object.fromEntries(Object.entries(row).slice(0, 3))) // Log first 3 fields for debugging
    }
  }

  console.log(`Successfully parsed ${data.length} valid rows for ${dataType}`)
  return data
}

// NEW - Add this new function after parseCSVForDataType
function parseCSVWithMultilineSupport(csvText: string): string[][] {
  const rows: string[][] = []
  let currentRow: string[] = []
  let currentField = ''
  let inQuotes = false
  let i = 0

  while (i < csvText.length) {
    const char = csvText[i]
    const nextChar = i + 1 < csvText.length ? csvText[i + 1] : null

    if (char === '"') {
      if (inQuotes) {
        // Check if this is an escaped quote (doubled quote)
        if (nextChar === '"') {
          currentField += '"'
          i += 2 // Skip both quotes
          continue
        } else {
          // End of quoted field
          inQuotes = false
        }
      } else {
        // Start of quoted field
        inQuotes = true
      }
    } else if (char === ',' && !inQuotes) {
      // Field separator outside of quotes
      currentRow.push(currentField.trim())
      currentField = ''
    } else if ((char === '\n' || char === '\r') && !inQuotes) {
      // End of row outside of quotes
      currentRow.push(currentField.trim())
      
      // Only add non-empty rows
      if (currentRow.length > 0 && !currentRow.every(field => field === '')) {
        rows.push(currentRow)
      }
      
      currentRow = []
      currentField = ''
      
      // Handle \r\n line endings
      if (char === '\r' && nextChar === '\n') {
        i++ // Skip the \n
      }
    } else {
      // Regular character (including newlines inside quotes)
      currentField += char
    }
    
    i++
  }
  
  // Add the last field and row if we have data
  currentRow.push(currentField.trim())
  if (currentRow.length > 0 && !currentRow.every(field => field === '')) {
    rows.push(currentRow)
  }
  
  console.log(`Parsed CSV into ${rows.length} rows`)
  return rows
}

// Get valid status values for each data type
function getValidStatusValues(dataType: 'jobs' | 'contacts' | 'interactions'): string[] {
  switch (dataType) {
    case 'jobs':
      return [
        'Applied',
        'Interested', 
        'Interviewing',
        'Offer',
        'Rejected',
        'Bookmarked',
        'Withdrawn',
        'On Hold',
        'No Response'
      ]
    case 'interactions':
      return [
        'email',
        'phone', 
        'video_call',
        'linkedin',
        'meeting',
        'other'
      ]
    default:
      return []
  }
}

// Check if a field is required for the data type
function isRequiredField(fieldName: string, dataType: 'jobs' | 'contacts' | 'interactions'): boolean {
  const requiredFields = {
    jobs: ['job_title', 'company'],
    contacts: ['name', 'email'],
    interactions: ['contact_id', 'type']
  }
  
  const required = requiredFields[dataType] || []
  return required.includes(fieldName)
}

// Sanitize row data to only include expected fields for each data type
function sanitizeRowForDataType(row: any, dataType: 'jobs' | 'contacts' | 'interactions'): any {
  const allowedFields = {
    jobs: [
      'job_title', 'company', 'location', 'salary', 'job_url', 'status', 
      'applied_date', 'date_added', 'job_description', 'notes'
    ],
    contacts: [
      'name', 'email', 'phone', 'current_location', 'company', 'job_title', 'linkedin_url', 
      'notes', 'experience', 'education', 'mutual_connections'
    ],
    interactions: [
      'contact_id', 'type', 'date', 'summary', 'notes'
    ]
  }
  
  const allowed = allowedFields[dataType] || []
  const sanitized: any = {}
  
  // Only include allowed fields
  allowed.forEach(field => {
    if (row.hasOwnProperty(field)) {
      sanitized[field] = row[field]
    }
  })
  
  return sanitized
}

// More robust validation function
function isValidRowForDataType(row: any, dataType: 'jobs' | 'contacts' | 'interactions'): boolean {
  switch (dataType) {
    case 'jobs':
      // Jobs require at least job_title AND company (more strict validation)
      return !!(row.job_title && row.company)
    
    case 'contacts':
      // Contacts require at least name OR email (one meaningful identifier)
      return !!(row.name || row.email)
    
    case 'interactions':
      // Interactions require contact_id AND (type OR summary)
      return !!(row.contact_id && (row.type || row.summary))
    
    default:
      return true
  }
}

// Helper function to check if a field is a date field
function isDateField(fieldName: string, dataType: 'jobs' | 'contacts' | 'interactions'): boolean {
  if (!fieldName) return false

  const normalizedFieldName = fieldName.toLowerCase().trim()
  const dateFields = DATE_FIELDS[dataType] || []
  
  return dateFields.some(field => field.toLowerCase() === normalizedFieldName)
}

// Enhanced date conversion with better error handling
function convertDateToPostgreSQL(dateString: string): string | null {
  if (!dateString || dateString.trim() === '') {
    return null
  }

  const trimmedDate = dateString.trim()
  
  // If already in PostgreSQL format (YYYY-MM-DD or YYYY-MM-DD HH:MM:SS), validate and return
  if (/^\d{4}-\d{2}-\d{2}($|\s\d{2}:\d{2}:\d{2})/.test(trimmedDate)) {
    try {
      const testDate = new Date(trimmedDate)
      if (!isNaN(testDate.getTime())) {
        return trimmedDate
      }
    } catch (e) {
      // Fall through to other parsing methods
    }
  }

  // Try to parse various date formats
  let parsedDate: Date | null = null
  
  // Common date patterns to try (ordered by specificity and likelihood)
  const datePatterns = [
    // MM/DD/YYYY formats (American) - most common
    {
      regex: /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/,
      parser: (match: RegExpMatchArray) => {
        const month = parseInt(match[1])
        const day = parseInt(match[2])
        const year = parseInt(match[3])
        if (month >= 1 && month <= 12 && day >= 1 && day <= 31 && year >= 1900 && year <= 2100) {
          return new Date(year, month - 1, day)
        }
        return null
      }
    },
    // MM/DD/YY formats (American, 2-digit year)
    {
      regex: /^(\d{1,2})\/(\d{1,2})\/(\d{2})$/,
      parser: (match: RegExpMatchArray) => {
        const month = parseInt(match[1])
        const day = parseInt(match[2])
        let year = parseInt(match[3])
        
        // Convert 2-digit year to 4-digit (assuming 20xx for years 00-30, 19xx for 31-99)
        year = year <= 30 ? 2000 + year : 1900 + year
        
        if (month >= 1 && month <= 12 && day >= 1 && day <= 31 && year >= 1900 && year <= 2100) {
          return new Date(year, month - 1, day)
        }
        return null
      }
    },
    // DD/MM/YYYY formats (European) - only if day > 12 to avoid ambiguity
    {
      regex: /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/,
      parser: (match: RegExpMatchArray) => {
        const first = parseInt(match[1])
        const second = parseInt(match[2])
        const year = parseInt(match[3])
        
        // Only interpret as DD/MM if first number > 12 (definitely not a month)
        if (first > 12 && second >= 1 && second <= 12 && year >= 1900 && year <= 2100) {
          return new Date(year, second - 1, first)
        }
        return null
      }
    },
    // YYYY/MM/DD formats (ISO-like with slashes)
    {
      regex: /^(\d{4})\/(\d{1,2})\/(\d{1,2})$/,
      parser: (match: RegExpMatchArray) => {
        const year = parseInt(match[1])
        const month = parseInt(match[2])
        const day = parseInt(match[3])
        if (month >= 1 && month <= 12 && day >= 1 && day <= 31 && year >= 1900 && year <= 2100) {
          return new Date(year, month - 1, day)
        }
        return null
      }
    },
    // MM-DD-YYYY formats (with dashes)
    {
      regex: /^(\d{1,2})-(\d{1,2})-(\d{4})$/,
      parser: (match: RegExpMatchArray) => {
        const month = parseInt(match[1])
        const day = parseInt(match[2])
        const year = parseInt(match[3])
        if (month >= 1 && month <= 12 && day >= 1 && day <= 31 && year >= 1900 && year <= 2100) {
          return new Date(year, month - 1, day)
        }
        return null
      }
    },
    // YYYY-MM-DD formats (ISO standard)
    {
      regex: /^(\d{4})-(\d{1,2})-(\d{1,2})$/,
      parser: (match: RegExpMatchArray) => {
        const year = parseInt(match[1])
        const month = parseInt(match[2])
        const day = parseInt(match[3])
        if (month >= 1 && month <= 12 && day >= 1 && day <= 31 && year >= 1900 && year <= 2100) {
          return new Date(year, month - 1, day)
        }
        return null
      }
    },
    // MM.DD.YYYY formats (with dots)
    {
      regex: /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/,
      parser: (match: RegExpMatchArray) => {
        const month = parseInt(match[1])
        const day = parseInt(match[2])
        const year = parseInt(match[3])
        if (month >= 1 && month <= 12 && day >= 1 && day <= 31 && year >= 1900 && year <= 2100) {
          return new Date(year, month - 1, day)
        }
        return null
      }
    },
    // YYYY-MM formats (month only)
    {
      regex: /^(\d{4})-(\d{1,2})$/,
      parser: (match: RegExpMatchArray) => {
        const year = parseInt(match[1])
        const month = parseInt(match[2])
        if (month >= 1 && month <= 12 && year >= 1900 && year <= 2100) {
          return new Date(year, month - 1, 1)
        }
        return null
      }
    },
    // Month names formats like "Jan 2024", "January 2024"
    {
      regex: /^([A-Za-z]{3,9})\s+(\d{4})$/,
      parser: (match: RegExpMatchArray) => {
        const monthStr = match[1].toLowerCase()
        const year = parseInt(match[2])
        const monthIndex = getMonthIndex(monthStr)
        
        if (monthIndex !== -1 && year >= 1900 && year <= 2100) {
          return new Date(year, monthIndex, 1)
        }
        return null
      }
    },
    // ISO 8601 formats with time
    {
      regex: /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{3}))?(?:Z|[+-]\d{2}:\d{2})?$/,
      parser: (match: RegExpMatchArray) => {
        try {
          const date = new Date(match[0])
          return !isNaN(date.getTime()) ? date : null
        } catch {
          return null
        }
      }
    }
  ]

  // Try each pattern in order
  for (const pattern of datePatterns) {
    const match = trimmedDate.match(pattern.regex)
    if (match) {
      try {
        parsedDate = pattern.parser(match)
        if (parsedDate && !isNaN(parsedDate.getTime())) {
          break
        }
      } catch (e) {
        // Continue to next pattern
        continue
      }
    }
  }

  // Convert to PostgreSQL format (YYYY-MM-DD)
  if (parsedDate && !isNaN(parsedDate.getTime())) {
    const year = parsedDate.getFullYear()
    const month = (parsedDate.getMonth() + 1).toString().padStart(2, '0')
    const day = parsedDate.getDate().toString().padStart(2, '0')
    
    // Final validation - make sure the date makes sense
    if (year >= 1900 && year <= 2100) {
      return `${year}-${month}-${day}`
    }
  }

  return null
}

// Helper function to get month index from month name
function getMonthIndex(monthStr: string): number {
  const monthNames = [
    'january', 'february', 'march', 'april', 'may', 'june',
    'july', 'august', 'september', 'october', 'november', 'december'
  ]
  const shortMonthNames = [
    'jan', 'feb', 'mar', 'apr', 'may', 'jun',
    'jul', 'aug', 'sep', 'oct', 'nov', 'dec'
  ]
  
  const lowerMonth = monthStr.toLowerCase()
  let monthIndex = monthNames.indexOf(lowerMonth)
  if (monthIndex === -1) {
    monthIndex = shortMonthNames.indexOf(lowerMonth)
  }
  
  return monthIndex
}

// Helper function to reconstruct contact from flattened CSV data
function reconstructContactFromFlattenedData(row: any, headers: string[]) {
  const contact: any = { ...row }
  
  // Reconstruct experiences
  const experienceHeaders = headers.filter(h => h.startsWith('experience_'))
  const experienceNumbers = [...new Set(experienceHeaders.map(h => h.split('_')[1]))]
  
  if (experienceNumbers.length > 0) {
    contact.experience = experienceNumbers.map(num => {
      const exp: any = {
        id: `temp-${Date.now()}-${num}`,
        company: row[`experience_${num}_company`] || null,
        title: row[`experience_${num}_title`] || null,
        start_date: row[`experience_${num}_start_date`] || null,
        end_date: row[`experience_${num}_end_date`] || null,
        is_current: row[`experience_${num}_is_current`] === 'true' || row[`experience_${num}_is_current`] === true,
        description: row[`experience_${num}_description`] || null
      }
      
      // Remove empty experiences (only include if company or title exists)
      if (exp.company || exp.title) {
        return exp
      }
      return null
    }).filter(Boolean)
    
    // If no valid experiences, set to empty array
    if (contact.experience.length === 0) {
      contact.experience = []
    }
    
    // Clean up flattened fields
    experienceHeaders.forEach(header => delete contact[header])
  }
  
  // Reconstruct education
  const educationHeaders = headers.filter(h => h.startsWith('education_'))
  const educationNumbers = [...new Set(educationHeaders.map(h => h.split('_')[1]))]
  
  if (educationNumbers.length > 0) {
    contact.education = educationNumbers.map(num => {
      const edu: any = {
        id: `temp-${Date.now()}-${num}`,
        institution: row[`education_${num}_institution`] || null,
        degree_and_field: row[`education_${num}_degree_and_field`] || null,
        year: row[`education_${num}_year`] || null,
        notes: row[`education_${num}_notes`] || null
      }
      
      // Remove empty education entries
      if (edu.institution || edu.degree_and_field) {
        return edu
      }
      return null
    }).filter(Boolean)
    
    // If no valid education, set to empty array
    if (contact.education.length === 0) {
      contact.education = []
    }
    
    // Clean up flattened fields
    educationHeaders.forEach(header => delete contact[header])
  }
  
  // Reconstruct mutual connections
  const mutualConnectionHeaders = headers.filter(h => h.startsWith('mutual_connection_'))
  if (mutualConnectionHeaders.length > 0) {
    contact.mutual_connections = mutualConnectionHeaders
      .map(header => row[header])
      .filter(conn => conn && conn.trim() !== '')
    
    // Clean up flattened fields
    mutualConnectionHeaders.forEach(header => delete contact[header])
  }
  
  return contact
}

// Helper Functions
function convertToCSV(data: any[], fields: string[]): string {
  if (data.length === 0) return ''

  const headers = fields.join(',')
  const rows = data.map(item => {
    return fields.map(field => {
      const value = item[field] || ''
      return `"${String(value).replace(/"/g, '""')}"`
    }).join(',')
  })

  return [headers, ...rows].join('\n')
}

// Enhanced CSV line parsing with better quote handling
function parseCSVLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false
  let i = 0

  while (i < line.length) {
    const char = line[i]
    
    if (char === '"') {
      if (inQuotes) {
        // Check if this is an escaped quote (doubled quote)
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"'
          i += 2 // Skip both quotes
          continue
        } else {
          // End of quoted field
          inQuotes = false
        }
      } else {
        // Start of quoted field
        inQuotes = true
      }
    } else if (char === ',' && !inQuotes) {
      // Field separator outside of quotes
      result.push(current.trim())
      current = ''
    } else {
      // Regular character
      current += char
    }
    
    i++
  }
  
  // Add the last field
  result.push(current.trim())
  
  return result
}

function downloadCSV(content: string, filename: string) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  
  if (link.download !== undefined) {
    const url = URL.createObjectURL(blob)
    link.setAttribute('href', url)
    link.setAttribute('download', filename)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }
}

// Validation helper for date conversion results
export function validateDateConversions(data: any[], dataType: 'jobs' | 'contacts' | 'interactions'): {
  validCount: number
  invalidDates: Array<{row: number, field: string, originalValue: string}>
  totalRows: number
} {
  const dateFields = DATE_FIELDS[dataType] || []
  const invalidDates: Array<{row: number, field: string, originalValue: string}> = []
  let validCount = 0

  data.forEach((row, index) => {
    dateFields.forEach(field => {
      if (row[field]) {
        // Check if it's a valid PostgreSQL date format
        if (/^\d{4}-\d{2}-\d{2}($|\s\d{2}:\d{2}:\d{2})/.test(row[field])) {
          validCount++
        } else {
          invalidDates.push({
            row: index + 2, // +2 because we skip header row and index is 0-based
            field: field,
            originalValue: row[field]
          })
        }
      }
    })
  })

  return {
    validCount,
    invalidDates,
    totalRows: data.length
  }
}