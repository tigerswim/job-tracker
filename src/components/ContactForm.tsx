// src/components/ContactForm.tsx
"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { Contact, ExperienceEntry, EducationEntry } from "@/lib/supabase";
import { createContact, updateContact } from "@/lib/contacts";
import {
  X,
  User,
  Mail,
  Phone,
  Building,
  Briefcase,
  Linkedin,
  FileText,
  Users,
  Save,
  Plus,
  Minus,
  GraduationCap,
  Network,
  Calendar,
  MapPin,
} from "lucide-react";
import ContactJobLinks from "./ContactJobLinks";

interface ContactFormProps {
  contact?: Contact;
  onSuccess: () => void;
  onCancel: () => void;
  allContacts?: Contact[];
}

// Helper function to get month options
const getMonthOptions = () => {
  const months = [
    { value: "01", label: "Jan" },
    { value: "02", label: "Feb" },
    { value: "03", label: "Mar" },
    { value: "04", label: "Apr" },
    { value: "05", label: "May" },
    { value: "06", label: "Jun" },
    { value: "07", label: "Jul" },
    { value: "08", label: "Aug" },
    { value: "09", label: "Sep" },
    { value: "10", label: "Oct" },
    { value: "11", label: "Nov" },
    { value: "12", label: "Dec" },
  ];
  return months;
};

// Helper function to get year options
const getYearOptions = () => {
  const currentYear = new Date().getFullYear();
  const years = [];
  for (let year = 1970; year <= currentYear + 1; year++) {
    years.push({ value: year.toString(), label: year.toString() });
  }
  return years.reverse(); // Most recent years first
};

// Date helper functions
const parseDate = (
  dateString: string | undefined | null,
): { month: string; year: string } => {
  if (!dateString || typeof dateString !== "string") {
    return { month: "", year: "" };
  }

  // Handle partial dates like "2020-" or "-04"
  if (dateString.includes("-")) {
    const parts = dateString.split("-");
    return {
      year: parts[0] || "",
      month: parts[1] || "",
    };
  }

  return { month: "", year: "" };
};

const combineDate = (month: string, year: string): string => {
  // If both are empty, return empty
  if (!month && !year) return "";

  // If one is missing, still create a partial date string
  const paddedMonth = month ? month.padStart(2, "0") : "";
  const yearPart = year || "";

  // Return in YYYY-MM format, even if one part is empty
  if (yearPart && paddedMonth) {
    return `${yearPart}-${paddedMonth}`;
  } else if (yearPart) {
    return `${yearPart}-`;
  } else if (paddedMonth) {
    return `-${paddedMonth}`;
  }

  return "";
};

// Resizable text area component for form fields
const ResizableTextArea = ({
  value,
  onChange,
  placeholder,
  name,
  id,
  className = "",
  minHeight = 100,
  maxHeight = 400,
}: {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  placeholder?: string;
  name?: string;
  id?: string;
  className?: string;
  minHeight?: number;
  maxHeight?: number;
}) => {
  const [height, setHeight] = useState(minHeight);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      const startY = e.clientY;
      const startHeight = height;

      const handleMouseMove = (e: MouseEvent) => {
        const deltaY = e.clientY - startY;
        const newHeight = Math.max(
          minHeight,
          Math.min(maxHeight, startHeight + deltaY),
        );
        setHeight(newHeight);
      };

      const handleMouseUp = () => {
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
      };

      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    },
    [height, minHeight, maxHeight],
  );

  return (
    <div className={className}>
      <textarea
        ref={textareaRef}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        name={name}
        id={id}
        className="w-full p-3 text-sm text-slate-700 bg-white border border-slate-200 rounded-lg resize-y focus:outline-none"
        style={{
          height: `${height}px`,
          minHeight: `${minHeight}px`,
          maxHeight: `${maxHeight}px`,
        }}
      />
    </div>
  );
};

export default function ContactForm({
  contact,
  onSuccess,
  onCancel,
  allContacts,
}: ContactFormProps) {
  const [formData, setFormData] = useState({
    name: contact?.name || "",
    email: contact?.email || "",
    phone: contact?.phone || "",
    current_location: contact?.current_location || "",
    company: contact?.company || "",
    job_title: contact?.job_title || "",
    linkedin_url: contact?.linkedin_url || "",
    notes: contact?.notes || "",
  });

  const [experience, setExperience] = useState<ExperienceEntry[]>(
    contact?.experience || [],
  );

  const [education, setEducation] = useState<EducationEntry[]>(
    contact?.education || [],
  );

  const [mutualConnections, setMutualConnections] = useState<string[]>(
    contact?.mutual_connections || [],
  );

  const [newConnectionName, setNewConnectionName] = useState("");
  const [loading, setLoading] = useState(false);
  const [jobLinksKey, setJobLinksKey] = useState(0);

  const [connectionSuggestions, setConnectionSuggestions] = useState<string[]>(
    [],
  );
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(-1);

  // Debug function to log current state
  const debugLog = (message: string, data?: any) => {
    console.log(`[ContactForm Debug] ${message}`, data);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Filter out empty experience and education entries before saving
      const filteredExperience = experience.filter(
        (exp) =>
          exp.company.trim() ||
          exp.title.trim() ||
          exp.description.trim() ||
          exp.start_date ||
          exp.end_date,
      );

      const filteredEducation = education.filter(
        (edu) =>
          edu.institution.trim() ||
          edu.degree_and_field.trim() ||
          edu.notes?.trim() ||
          edu.year,
      );

      const contactData = {
        ...formData,
        experience: filteredExperience,
        education: filteredEducation,
        mutual_connections: mutualConnections,
      };

      debugLog("Submitting contact data:", contactData);

      let result;
      if (contact) {
        result = await updateContact(contact.id, contactData);
      } else {
        result = await createContact(contactData);
      }

      if (result) {
        onSuccess();
      } else {
        alert("Failed to save contact. Please check the console for details.");
      }
    } catch (error) {
      console.error("Error in form submission:", error);
      alert("An error occurred while saving the contact.");
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  // Experience handlers
  const addExperience = useCallback(() => {
    const newExp: ExperienceEntry = {
      id: `temp-${Date.now()}`,
      company: "",
      title: "",
      start_date: "",
      end_date: "",
      is_current: false,
      description: "",
    };
    setExperience((prev) => [...prev, newExp]);
    debugLog("Added new experience entry", newExp);
  }, []);

  const removeExperience = useCallback((index: number) => {
    setExperience((prev) => {
      const updated = prev.filter((_, i) => i !== index);
      debugLog(`Removed experience at index ${index}`, updated);
      return updated;
    });
  }, []);

  const updateExperience = useCallback(
    (index: number, field: keyof ExperienceEntry, value: string | boolean) => {
      setExperience((prev) => {
        const updated = prev.map((exp, i) =>
          i === index ? { ...exp, [field]: value } : exp,
        );
        debugLog(`Updated experience[${index}].${field} to:`, value);
        debugLog("Full updated experience array:", updated);
        return updated;
      });
    },
    [],
  );

  // Specific date update handlers for experience
  const updateExperienceDate = useCallback(
    (
      index: number,
      dateField: "start_date" | "end_date",
      dateType: "month" | "year",
      newValue: string,
    ) => {
      setExperience((prev) => {
        const updated = prev.map((exp, i) => {
          if (i !== index) return exp;

          const currentDate = parseDate(exp[dateField]);
          debugLog(`Current ${dateField} for exp[${index}]:`, currentDate);

          const updatedDate = {
            month: dateType === "month" ? newValue : currentDate.month,
            year: dateType === "year" ? newValue : currentDate.year,
          };

          const newDateString = combineDate(
            updatedDate.month,
            updatedDate.year,
          );
          debugLog(`New ${dateField} for exp[${index}]:`, newDateString);

          return { ...exp, [dateField]: newDateString };
        });

        debugLog("Updated experience array:", updated);
        return updated;
      });
    },
    [],
  );

  // Education handlers
  const addEducation = useCallback(() => {
    const newEdu: EducationEntry = {
      id: `temp-${Date.now()}`,
      institution: "",
      degree_and_field: "",
      year: "",
      notes: "",
    };
    setEducation((prev) => [...prev, newEdu]);
    debugLog("Added new education entry", newEdu);
  }, []);

  const removeEducation = useCallback((index: number) => {
    setEducation((prev) => {
      const updated = prev.filter((_, i) => i !== index);
      debugLog(`Removed education at index ${index}`, updated);
      return updated;
    });
  }, []);

  const updateEducation = useCallback(
    (index: number, field: keyof EducationEntry, value: string) => {
      setEducation((prev) => {
        const updated = prev.map((edu, i) =>
          i === index ? { ...edu, [field]: value } : edu,
        );
        debugLog(`Updated education[${index}].${field} to:`, value);
        return updated;
      });
    },
    [],
  );

  const updateEducationDate = useCallback(
    (index: number, dateType: "month" | "year", newValue: string) => {
      setEducation((prev) => {
        const updated = prev.map((edu, i) => {
          if (i !== index) return edu;

          const currentDate = parseDate(edu.year);
          debugLog(`Current year for edu[${index}]:`, currentDate);

          const updatedDate = {
            month: dateType === "month" ? newValue : currentDate.month,
            year: dateType === "year" ? newValue : currentDate.year,
          };

          const newDateString = combineDate(
            updatedDate.month,
            updatedDate.year,
          );
          debugLog(`New year for edu[${index}]:`, newDateString);

          return { ...edu, year: newDateString };
        });

        debugLog("Updated education array:", updated);
        return updated;
      });
    },
    [],
  );

  // Auto-suggestion functions
  const updateConnectionSuggestions = useCallback(
    (input: string) => {
      if (!input.trim() || input.length < 2) {
        setConnectionSuggestions([]);
        setShowSuggestions(false);
        return;
      }

      // Handle comma-separated input - get suggestions for the last name being typed
      let searchTerm = input.trim();
      if (input.includes(",")) {
        const names = input.split(",");
        searchTerm = names[names.length - 1].trim();

        // If the last part is too short, don't show suggestions
        if (searchTerm.length < 2) {
          setConnectionSuggestions([]);
          setShowSuggestions(false);
          return;
        }
      }

      const inputLower = searchTerm.toLowerCase();

      // Filter out the current contact and already added connections
      const currentContactName = contact?.name?.toLowerCase();
      const existingConnections = mutualConnections.map((name) =>
        name.toLowerCase(),
      );

      // Also filter out names already in the current input (for batch entry)
      const namesInInput = input.includes(",")
        ? input
            .split(",")
            .map((name) => name.trim().toLowerCase())
            .filter((name) => name)
        : [];

      const suggestions = allContacts
        .map((c) => c.name)
        .filter((name) => {
          const nameLower = name.toLowerCase();
          return (
            nameLower.includes(inputLower) &&
            nameLower !== currentContactName &&
            !existingConnections.includes(nameLower) &&
            !namesInInput.includes(nameLower)
          );
        })
        .slice(0, 5); // Limit to 5 suggestions

      setConnectionSuggestions(suggestions);
      setShowSuggestions(suggestions.length > 0);
      setSelectedSuggestionIndex(-1); // Reset selection when suggestions change
    },
    [allContacts, contact?.name, mutualConnections],
  );

  const selectSuggestion = useCallback(
    (suggestion: string) => {
      // Handle batch entry - replace the last name being typed with the suggestion
      if (newConnectionName.includes(",")) {
        const names = newConnectionName.split(",");
        names[names.length - 1] = suggestion;
        setNewConnectionName(names.join(", ").trim());
      } else {
        setNewConnectionName(suggestion);
      }
      setShowSuggestions(false);
      setConnectionSuggestions([]);
      setSelectedSuggestionIndex(-1);
    },
    [newConnectionName],
  );

  const handleConnectionInputChange = useCallback(
    (value: string) => {
      setNewConnectionName(value);
      updateConnectionSuggestions(value);
    },
    [updateConnectionSuggestions],
  );

  // Add effect to clear suggestions when mutualConnections change
  useEffect(() => {
    if (newConnectionName.length >= 2) {
      updateConnectionSuggestions(newConnectionName);
    }
  }, [mutualConnections, newConnectionName, updateConnectionSuggestions]);

  // Mutual connections handlers
  const addMutualConnection = () => {
    const inputValue = newConnectionName.trim();

    // Check if input contains commas (batch entry)
    if (inputValue.includes(",")) {
      const names = inputValue
        .split(",")
        .map((name) => name.trim())
        .filter((name) => name && !mutualConnections.includes(name));

      if (names.length > 0) {
        setMutualConnections([...mutualConnections, ...names]);
        setNewConnectionName("");
        setShowSuggestions(false);
        setConnectionSuggestions([]);
      }
    } else if (inputValue && !mutualConnections.includes(inputValue)) {
      setMutualConnections([...mutualConnections, inputValue]);
      setNewConnectionName("");
      setShowSuggestions(false);
      setConnectionSuggestions([]);
    }
  };

  const handleConnectionKeyDown = (e: React.KeyboardEvent) => {
    if (!showSuggestions || connectionSuggestions.length === 0) {
      if (e.key === "Enter") {
        e.preventDefault();
        addMutualConnection();
      }
      return;
    }

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setSelectedSuggestionIndex((prev) =>
          prev < connectionSuggestions.length - 1 ? prev + 1 : 0,
        );
        break;

      case "ArrowUp":
        e.preventDefault();
        setSelectedSuggestionIndex((prev) =>
          prev > 0 ? prev - 1 : connectionSuggestions.length - 1,
        );
        break;

      case "Enter":
        e.preventDefault();
        if (
          selectedSuggestionIndex >= 0 &&
          selectedSuggestionIndex < connectionSuggestions.length
        ) {
          selectSuggestion(connectionSuggestions[selectedSuggestionIndex]);
        } else if (connectionSuggestions.length > 0) {
          selectSuggestion(connectionSuggestions[0]);
        } else {
          addMutualConnection();
        }
        break;

      case "Escape":
        e.preventDefault();
        setShowSuggestions(false);
        setConnectionSuggestions([]);
        setSelectedSuggestionIndex(-1);
        break;
    }
  };

  const removeMutualConnection = (name: string) => {
    setMutualConnections(mutualConnections.filter((conn) => conn !== name));
  };

  const handleJobLinksChanged = () => {
    setJobLinksKey((prev) => prev + 1);
  };

  const monthOptions = getMonthOptions();
  const yearOptions = getYearOptions();

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-start justify-center p-4 z-50"
      style={{ paddingTop: "2rem" }}
    >
      <div className="bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden animate-scale-in">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-8 py-6 text-white">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
                <Users className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-xl font-bold">
                  {contact ? "Edit Contact" : "New Professional Contact"}
                </h2>
                <p className="text-blue-100 text-sm">
                  {contact
                    ? "Update contact information"
                    : "Add someone to your professional network"}
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={onCancel}
                className="px-4 py-2 text-white/80 hover:text-white hover:bg-white/20 rounded-lg transition-all duration-200"
              >
                Cancel
              </button>
              <button
                type="submit"
                form="contact-form"
                disabled={loading}
                className="px-4 py-2 bg-white/20 hover:bg-white/30 text-white rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
              >
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    <span>{contact ? "Update Contact" : "Save Contact"}</span>
                  </>
                )}
              </button>
              <button
                onClick={onCancel}
                className="p-2 text-white/80 hover:text-white hover:bg-white/20 rounded-lg transition-all duration-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Form Content */}
        <div className="p-8 overflow-y-auto max-h-[calc(90vh-120px)] custom-scrollbar">
          {/*
            AUTOMATION HELPER: This is the main contact entry form
            Field mapping:
            - Basic info: name, email, phone, location, linkedin_url, company, job_title
            - Experience: Multiple entries with company, title, start_date, end_date, is_current, description
            - Education: Multiple entries with institution, degree_and_field, year, notes
            - Mutual connections: Array of names
            - Notes: Free text field
          */}
          <form
            id="contact-form"
            onSubmit={handleSubmit}
            className="space-y-8"
            role="form"
            aria-label="Contact information form"
          >
            {/* Basic Information - COMET SECTION: Personal Information */}
            <section
              className="space-y-6"
              data-form-section="personal-info"
              data-linkedin-section="basic-info"
            >
              <div className="flex items-center space-x-2 text-slate-700 border-b border-slate-200 pb-2">
                <User className="w-5 h-5" />
                <h3 className="font-semibold">Personal Information</h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="form-group">
                  <label
                    className="form-label flex items-center space-x-2"
                    htmlFor="contact-name"
                  >
                    <User className="w-4 h-4 text-slate-500" />
                    <span>Full Name *</span>
                  </label>
                  <input
                    type="text"
                    id="contact-name"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    required
                    className="input"
                    placeholder="e.g., John Smith"
                    data-field="name"
                    data-linkedin-field="full-name"
                    data-accepts="First Last, First Middle Last"
                    aria-label="Contact's full name"
                  />
                </div>

                <div className="form-group">
                  <label
                    className="form-label flex items-center space-x-2"
                    htmlFor="contact-email"
                  >
                    <Mail className="w-4 h-4 text-slate-500" />
                    <span>Email Address</span>
                  </label>
                  <input
                    type="email"
                    id="contact-email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    className="input"
                    placeholder="john@company.com"
                    data-field="email"
                    data-linkedin-field="email"
                    data-accepts="user@domain.com"
                    aria-label="Contact's email address"
                  />
                </div>

                <div className="form-group">
                  <label
                    className="form-label flex items-center space-x-2"
                    htmlFor="contact-phone"
                  >
                    <Phone className="w-4 h-4 text-slate-500" />
                    <span>Phone Number</span>
                  </label>
                  <input
                    type="tel"
                    id="contact-phone"
                    name="phone"
                    value={formData.phone}
                    onChange={handleChange}
                    className="input"
                    placeholder="+1 (555) 123-4567"
                    data-field="phone"
                    data-linkedin-field="phone"
                    data-accepts="+1 (555) 123-4567, 555-123-4567, 5551234567"
                    aria-label="Contact's phone number"
                  />
                </div>

                <div className="form-group">
                  <label
                    className="form-label flex items-center space-x-2"
                    htmlFor="contact-location"
                  >
                    <MapPin className="w-4 h-4 text-slate-500" />
                    <span>Current Location</span>
                  </label>
                  <input
                    type="text"
                    id="contact-location"
                    name="current_location"
                    value={formData.current_location}
                    onChange={handleChange}
                    className="input"
                    placeholder="e.g., San Francisco, CA"
                    data-field="current_location"
                    data-linkedin-field="location"
                    data-accepts="City, State, City State, City, Country"
                    aria-label="Contact's current location"
                  />
                </div>

                <div className="form-group">
                  <label
                    className="form-label flex items-center space-x-2"
                    htmlFor="contact-linkedin"
                  >
                    <Linkedin className="w-4 h-4 text-slate-500" />
                    <span>LinkedIn Profile</span>
                  </label>
                  <input
                    type="url"
                    id="contact-linkedin"
                    name="linkedin_url"
                    value={formData.linkedin_url}
                    onChange={handleChange}
                    className="input"
                    placeholder="https://linkedin.com/in/johnsmith"
                    data-field="linkedin_url"
                    data-linkedin-field="profile-url"
                    data-accepts="https://linkedin.com/in/username, linkedin.com/in/username"
                    aria-label="Contact's LinkedIn profile URL"
                  />
                </div>
              </div>
            </section>

            {/* Professional Information - COMET SECTION: Current Role Information */}
            <section
              className="space-y-6"
              data-form-section="current-role"
              data-linkedin-section="current-position"
            >
              <div className="flex items-center space-x-2 text-slate-700 border-b border-slate-200 pb-2">
                <Building className="w-5 h-5" />
                <h3 className="font-semibold">Current Role</h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="form-group">
                  <label
                    className="form-label flex items-center space-x-2"
                    htmlFor="contact-company"
                  >
                    <Building className="w-4 h-4 text-slate-500" />
                    <span>Company</span>
                  </label>
                  <input
                    type="text"
                    id="contact-company"
                    name="company"
                    value={formData.company}
                    onChange={handleChange}
                    className="input"
                    placeholder="e.g., Google, Microsoft, Acme Corp"
                    data-field="company"
                    data-linkedin-field="current-company"
                    data-accepts="Company Name, Company Inc."
                    aria-label="Contact's current company"
                  />
                </div>

                <div className="form-group">
                  <label
                    className="form-label flex items-center space-x-2"
                    htmlFor="contact-job-title"
                  >
                    <Briefcase className="w-4 h-4 text-slate-500" />
                    <span>Job Title</span>
                  </label>
                  <input
                    type="text"
                    id="contact-job-title"
                    name="job_title"
                    value={formData.job_title}
                    onChange={handleChange}
                    className="input"
                    placeholder="e.g., Senior Software Engineer"
                    data-field="job_title"
                    data-linkedin-field="current-job-title"
                    data-accepts="Job Title, Position Title"
                    aria-label="Contact's current job title"
                  />
                </div>
              </div>
            </section>

            {/* Professional Background - COMET SECTION: Work Experience - Multiple entries expected */}
            <section
              className="space-y-6"
              data-form-section="work-experience"
              data-linkedin-section="experience"
            >
              <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                <div className="flex items-center space-x-2 text-slate-700">
                  <Briefcase className="w-5 h-5" />
                  <h3 className="font-semibold">Work Experience</h3>
                </div>
                <button
                  type="button"
                  onClick={addExperience}
                  className="btn-secondary text-sm flex items-center space-x-1"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add Role</span>
                </button>
              </div>

              {experience.map((exp, index) => {
                const startDate = parseDate(exp.start_date);
                const endDate = parseDate(exp.end_date);

                debugLog(`Rendering experience ${index}:`, {
                  exp,
                  startDate,
                  endDate,
                });

                return (
                  <fieldset
                    key={exp.id}
                    className="bg-slate-50 rounded-lg p-4 border border-slate-200 space-y-4"
                    data-section="experience"
                    data-section-index={index}
                    data-linkedin-section="work-experience"
                  >
                    <div className="flex justify-between items-start">
                      <legend className="font-medium text-slate-700">
                        Role {index + 1}
                      </legend>
                      <button
                        type="button"
                        onClick={() => removeExperience(index)}
                        className="text-red-500 hover:text-red-700 p-1"
                        aria-label={`Remove experience role ${index + 1}`}
                      >
                        <Minus className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="form-group">
                        <label
                          className="form-label"
                          htmlFor={`experience-${index}-company`}
                        >
                          Company
                        </label>
                        <input
                          type="text"
                          id={`experience-${index}-company`}
                          value={exp.company || ""}
                          onChange={(e) =>
                            updateExperience(index, "company", e.target.value)
                          }
                          className="input"
                          placeholder="Company name"
                          data-field="experience-company"
                          data-field-type="experience"
                          data-field-index={index}
                          data-linkedin-field="experience-company"
                          aria-label={`Company name for experience ${index + 1}`}
                        />
                      </div>

                      <div className="form-group">
                        <label
                          className="form-label"
                          htmlFor={`experience-${index}-title`}
                        >
                          Job Title
                        </label>
                        <input
                          type="text"
                          id={`experience-${index}-title`}
                          value={exp.title || ""}
                          onChange={(e) =>
                            updateExperience(index, "title", e.target.value)
                          }
                          className="input"
                          placeholder="Job title"
                          data-field="experience-title"
                          data-field-type="experience"
                          data-field-index={index}
                          data-linkedin-field="experience-job-title"
                          aria-label={`Job title for experience ${index + 1}`}
                        />
                      </div>

                      <div className="form-group">
                        <label className="form-label">Start Date</label>
                        <div
                          className="flex gap-2"
                          data-date-group="start-date"
                          data-field-index={index}
                        >
                          <select
                            id={`experience-${index}-start-month`}
                            value={startDate.month}
                            onChange={(e) => {
                              debugLog(
                                `Changing start month for exp[${index}] to:`,
                                e.target.value,
                              );
                              updateExperienceDate(
                                index,
                                "start_date",
                                "month",
                                e.target.value,
                              );
                            }}
                            className="input flex-1"
                            data-field="experience-start-month"
                            data-field-type="experience"
                            data-field-index={index}
                            data-date-type="month"
                            data-date-field="start"
                            data-linkedin-field="experience-start-month"
                            data-accepts="01-12, Jan-Dec, January-December"
                            aria-label={`Start month for experience ${index + 1}`}
                          >
                            <option value="">Select Month</option>
                            {monthOptions.map((month) => (
                              <option key={month.value} value={month.value}>
                                {month.label}
                              </option>
                            ))}
                          </select>
                          <select
                            id={`experience-${index}-start-year`}
                            value={startDate.year}
                            onChange={(e) => {
                              debugLog(
                                `Changing start year for exp[${index}] to:`,
                                e.target.value,
                              );
                              updateExperienceDate(
                                index,
                                "start_date",
                                "year",
                                e.target.value,
                              );
                            }}
                            className="input flex-1"
                            data-field="experience-start-year"
                            data-field-type="experience"
                            data-field-index={index}
                            data-date-type="year"
                            data-date-field="start"
                            data-linkedin-field="experience-start-year"
                            data-accepts="YYYY, 2020-2025"
                            aria-label={`Start year for experience ${index + 1}`}
                          >
                            <option value="">Select Year</option>
                            {yearOptions.map((year) => (
                              <option key={year.value} value={year.value}>
                                {year.label}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div className="form-group">
                        <div className="flex items-center justify-between mb-2">
                          <label className="form-label">End Date</label>
                          <label
                            className="flex items-center space-x-2 text-sm"
                            htmlFor={`experience-${index}-current`}
                          >
                            <input
                              type="checkbox"
                              id={`experience-${index}-current`}
                              checked={exp.is_current}
                              onChange={(e) => {
                                updateExperience(
                                  index,
                                  "is_current",
                                  e.target.checked,
                                );
                                if (e.target.checked) {
                                  updateExperience(index, "end_date", "");
                                }
                              }}
                              className="rounded"
                              data-field="experience-is-current"
                              data-field-type="experience"
                              data-field-index={index}
                              data-linkedin-field="experience-current-role"
                              data-accepts="true, false, present, current"
                              aria-label={`Mark experience ${index + 1} as current role`}
                            />
                            <span>Current role</span>
                          </label>
                        </div>
                        <div
                          className="flex gap-2"
                          data-date-group="end-date"
                          data-field-index={index}
                        >
                          <select
                            id={`experience-${index}-end-month`}
                            value={endDate.month}
                            onChange={(e) => {
                              debugLog(
                                `Changing end month for exp[${index}] to:`,
                                e.target.value,
                              );
                              updateExperienceDate(
                                index,
                                "end_date",
                                "month",
                                e.target.value,
                              );
                            }}
                            className="input flex-1"
                            disabled={exp.is_current}
                            data-field="experience-end-month"
                            data-field-type="experience"
                            data-field-index={index}
                            data-date-type="month"
                            data-date-field="end"
                            data-linkedin-field="experience-end-month"
                            data-accepts="01-12, Jan-Dec, January-December, Present"
                            aria-label={`End month for experience ${index + 1}`}
                          >
                            <option value="">Select Month</option>
                            {monthOptions.map((month) => (
                              <option key={month.value} value={month.value}>
                                {month.label}
                              </option>
                            ))}
                          </select>
                          <select
                            id={`experience-${index}-end-year`}
                            value={endDate.year}
                            onChange={(e) => {
                              debugLog(
                                `Changing end year for exp[${index}] to:`,
                                e.target.value,
                              );
                              updateExperienceDate(
                                index,
                                "end_date",
                                "year",
                                e.target.value,
                              );
                            }}
                            className="input flex-1"
                            disabled={exp.is_current}
                            data-field="experience-end-year"
                            data-field-type="experience"
                            data-field-index={index}
                            data-date-type="year"
                            data-date-field="end"
                            data-linkedin-field="experience-end-year"
                            data-accepts="YYYY, 2020-2025, Present"
                            aria-label={`End year for experience ${index + 1}`}
                          >
                            <option value="">Select Year</option>
                            {yearOptions.map((year) => (
                              <option key={year.value} value={year.value}>
                                {year.label}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>

                    <div className="form-group mt-3">
                      <label
                        className="form-label"
                        htmlFor={`experience-${index}-description`}
                      >
                        Description
                      </label>
                      <ResizableTextArea
                        id={`experience-${index}-description`}
                        value={exp.description || ""}
                        onChange={(e) =>
                          updateExperience(index, "description", e.target.value)
                        }
                        placeholder="Key responsibilities, achievements, technologies used..."
                        minHeight={80}
                        maxHeight={300}
                      />
                    </div>
                  </fieldset>
                );
              })}
            </section>

            {/* Education Section - COMET SECTION: Education - Multiple entries expected */}
            <section
              className="space-y-6"
              data-form-section="education"
              data-linkedin-section="education"
            >
              <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                <div className="flex items-center space-x-2 text-slate-700">
                  <GraduationCap className="w-5 h-5" />
                  <h3 className="font-semibold">Education</h3>
                </div>
                <button
                  type="button"
                  onClick={addEducation}
                  className="btn-secondary text-sm flex items-center space-x-1"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add Education</span>
                </button>
              </div>

              {education.map((edu, index) => {
                const eduDate = parseDate(edu.year);

                debugLog(`Rendering education ${index}:`, { edu, eduDate });

                return (
                  <fieldset
                    key={edu.id}
                    className="bg-slate-50 rounded-lg p-4 border border-slate-200 space-y-4"
                    data-section="education"
                    data-section-index={index}
                    data-linkedin-section="education"
                  >
                    <div className="flex justify-between items-start">
                      <legend className="font-medium text-slate-700">
                        Education {index + 1}
                      </legend>
                      <button
                        type="button"
                        onClick={() => removeEducation(index)}
                        className="text-red-500 hover:text-red-700 p-1"
                        aria-label={`Remove education ${index + 1}`}
                      >
                        <Minus className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="form-group">
                        <label
                          className="form-label"
                          htmlFor={`education-${index}-institution`}
                        >
                          Institution
                        </label>
                        <input
                          type="text"
                          id={`education-${index}-institution`}
                          value={edu.institution || ""}
                          onChange={(e) =>
                            updateEducation(
                              index,
                              "institution",
                              e.target.value,
                            )
                          }
                          className="input"
                          placeholder="University name"
                          data-field="education-institution"
                          data-field-type="education"
                          data-field-index={index}
                          data-linkedin-field="education-school"
                          aria-label={`Institution name for education ${index + 1}`}
                        />
                      </div>

                      <div className="form-group">
                        <label
                          className="form-label"
                          htmlFor={`education-${index}-degree`}
                        >
                          Degree & Field
                        </label>
                        <input
                          type="text"
                          id={`education-${index}-degree`}
                          value={edu.degree_and_field || ""}
                          onChange={(e) =>
                            updateEducation(
                              index,
                              "degree_and_field",
                              e.target.value,
                            )
                          }
                          className="input"
                          placeholder="e.g., Bachelor's in Computer Science"
                          data-field="education-degree"
                          data-field-type="education"
                          data-field-index={index}
                          data-linkedin-field="education-degree"
                          data-accepts="Bachelor's in [Field], Master's in [Field], PhD in [Field]"
                          aria-label={`Degree and field for education ${index + 1}`}
                        />
                      </div>

                      <div className="form-group md:col-span-2">
                        <label className="form-label">Graduation Date</label>
                        <div
                          className="flex gap-2 max-w-md"
                          data-date-group="graduation-date"
                          data-field-index={index}
                        >
                          <select
                            id={`education-${index}-month`}
                            value={eduDate.month}
                            onChange={(e) => {
                              debugLog(
                                `Changing education month for edu[${index}] to:`,
                                e.target.value,
                              );
                              updateEducationDate(
                                index,
                                "month",
                                e.target.value,
                              );
                            }}
                            className="input flex-1"
                            data-field="education-month"
                            data-field-type="education"
                            data-field-index={index}
                            data-date-type="month"
                            data-date-field="graduation"
                            data-linkedin-field="education-graduation-month"
                            data-accepts="01-12, Jan-Dec, January-December"
                            aria-label={`Graduation month for education ${index + 1}`}
                          >
                            <option value="">Select Month</option>
                            {monthOptions.map((month) => (
                              <option key={month.value} value={month.value}>
                                {month.label}
                              </option>
                            ))}
                          </select>
                          <select
                            id={`education-${index}-year`}
                            value={eduDate.year}
                            onChange={(e) => {
                              debugLog(
                                `Changing education year for edu[${index}] to:`,
                                e.target.value,
                              );
                              updateEducationDate(
                                index,
                                "year",
                                e.target.value,
                              );
                            }}
                            className="input flex-1"
                            data-field="education-year"
                            data-field-type="education"
                            data-field-index={index}
                            data-date-type="year"
                            data-date-field="graduation"
                            data-linkedin-field="education-graduation-year"
                            data-accepts="YYYY, 2000-2025"
                            aria-label={`Graduation year for education ${index + 1}`}
                          >
                            <option value="">Select Year</option>
                            {yearOptions.map((year) => (
                              <option key={year.value} value={year.value}>
                                {year.label}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>

                    <div className="form-group">
                      <label
                        className="form-label"
                        htmlFor={`education-${index}-notes`}
                      >
                        Notes
                      </label>
                      <input
                        type="text"
                        id={`education-${index}-notes`}
                        value={edu.notes || ""}
                        onChange={(e) =>
                          updateEducation(index, "notes", e.target.value)
                        }
                        className="input"
                        placeholder="GPA, honors, activities, relevant coursework..."
                        data-field="education-notes"
                        data-field-type="education"
                        data-field-index={index}
                        data-linkedin-field="education-notes"
                        aria-label={`Notes for education ${index + 1}`}
                      />
                    </div>
                  </fieldset>
                );
              })}
            </section>

            {/* Network Information - COMET SECTION: Mutual Connections - Array of names */}
            <section
              className="space-y-6"
              data-form-section="mutual-connections"
              data-linkedin-section="mutual-connections"
            >
              <div className="flex items-center space-x-2 text-slate-700 border-b border-slate-200 pb-2">
                <Network className="w-5 h-5" />
                <h3 className="font-semibold">Mutual Connections</h3>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="mutual-connection-input">
                  Add Mutual Connection
                </label>
                <div
                  className="relative"
                  data-section="mutual-connections"
                  data-linkedin-section="mutual-connections"
                >
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <input
                        type="text"
                        id="mutual-connection-input"
                        value={newConnectionName}
                        onChange={(e) =>
                          handleConnectionInputChange(e.target.value)
                        }
                        onKeyDown={handleConnectionKeyDown}
                        onBlur={() => {
                          // Delay hiding suggestions to allow click events
                          setTimeout(() => {
                            setShowSuggestions(false);
                            setSelectedSuggestionIndex(-1);
                          }, 200);
                        }}
                        onFocus={() => {
                          if (newConnectionName.length >= 2) {
                            updateConnectionSuggestions(newConnectionName);
                          }
                        }}
                        className="input w-full"
                        placeholder="Enter names (use commas for multiple: John Smith, Jane Doe, Bob Wilson)"
                        data-field="mutual-connection-input"
                        data-linkedin-field="mutual-connections"
                        data-accepts="First Last, Name1, Name2, Name3"
                        aria-label="Enter mutual connection names"
                      />

                      {/* Auto-suggestions dropdown */}
                      {showSuggestions && connectionSuggestions.length > 0 && (
                        <div className="absolute top-full left-0 right-0 z-10 bg-white border border-slate-200 rounded-lg shadow-lg mt-1 max-h-40 overflow-y-auto">
                          {connectionSuggestions.map((suggestion, index) => (
                            <button
                              key={index}
                              type="button"
                              onClick={() => selectSuggestion(suggestion)}
                              className={`w-full text-left px-3 py-2 text-sm transition-colors border-b border-slate-100 last:border-b-0 flex items-center space-x-2 ${
                                index === selectedSuggestionIndex
                                  ? "bg-blue-100 text-blue-800"
                                  : "hover:bg-blue-50 hover:text-blue-700"
                              }`}
                            >
                              <User className="w-3 h-3 text-slate-400" />
                              <span>{suggestion}</span>
                              <span className="ml-auto text-xs text-slate-400">
                                existing contact
                              </span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={addMutualConnection}
                      className="btn-secondary flex items-center space-x-1"
                      data-action="add-mutual-connection"
                      aria-label="Add mutual connection to list"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Add</span>
                    </button>
                  </div>

                  {newConnectionName.length >= 2 &&
                    connectionSuggestions.length === 0 &&
                    !newConnectionName.includes(",") && (
                      <p className="text-xs text-slate-500 mt-1">
                        No existing contacts found. Press Enter or click Add to
                        create new connection.
                      </p>
                    )}

                  {newConnectionName.includes(",") && (
                    <p className="text-xs text-blue-600 mt-1">
                      💡 Multiple names detected - will add{" "}
                      {
                        newConnectionName.split(",").filter((n) => n.trim())
                          .length
                      }{" "}
                      connections
                    </p>
                  )}
                </div>
              </div>

              {mutualConnections.length > 0 && (
                <div className="space-y-2">
                  <p className="form-label">Connected through:</p>
                  <div
                    className="flex flex-wrap gap-2"
                    data-section="mutual-connections-list"
                    data-linkedin-section="mutual-connections-display"
                  >
                    {mutualConnections.map((connection, index) => (
                      <span
                        key={index}
                        className="inline-flex items-center gap-1 px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-sm border border-blue-200"
                        data-connection-index={index}
                        data-connection-name={connection}
                      >
                        {connection}
                        <button
                          type="button"
                          onClick={() => removeMutualConnection(connection)}
                          className="hover:bg-blue-200 rounded-full p-0.5 transition-colors"
                          aria-label={`Remove ${connection} from mutual connections`}
                          data-action="remove-mutual-connection"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </section>

            {/* Notes - COMET SECTION: Notes and Additional Information */}
            <section
              className="space-y-4"
              data-form-section="notes"
              data-linkedin-section="additional-info"
            >
              <div className="flex items-center space-x-2 text-slate-700 border-b border-slate-200 pb-2">
                <FileText className="w-5 h-5" />
                <h3 className="font-semibold">Additional Information</h3>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="contact-notes">
                  Notes & Context
                </label>
                <ResizableTextArea
                  id="contact-notes"
                  name="notes"
                  value={formData.notes}
                  onChange={handleChange}
                  placeholder="Add context about how you met, shared connections, conversation topics, or other relevant details..."
                  minHeight={120}
                  maxHeight={400}
                />
                <p className="form-help">
                  Include meeting context, conversation highlights, or other
                  important notes
                </p>
              </div>
            </section>

            {/* Job Links Section - Only show when editing existing contact - COMET SECTION: Job Links (Edit Mode Only) */}
            {contact && (
              <section
                className="space-y-4"
                data-form-section="job-links"
                data-linkedin-section="job-associations"
              >
                <div className="flex items-center space-x-2 text-slate-700 border-b border-slate-200 pb-2">
                  <Briefcase className="w-5 h-5" />
                  <h3 className="font-semibold">Associated Job Applications</h3>
                </div>

                <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                  <ContactJobLinks
                    key={jobLinksKey}
                    contactId={contact.id}
                    allowRemove={true}
                    onLinksChanged={handleJobLinksChanged}
                  />
                </div>
              </section>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}
