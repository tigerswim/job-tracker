'use client'

import React from 'react'
import { X, Calendar, Clock, User, Briefcase, Mail, MessageSquare, AlertCircle, Check, MapPin } from 'lucide-react'
import { ReminderWithContext } from '@/lib/types/reminders'

interface ReminderDetailsModalProps {
  reminder: ReminderWithContext
  onClose: () => void
}

export default function ReminderDetailsModal({ reminder, onClose }: ReminderDetailsModalProps) {
  const formatDate = (dateString: string, timezone: string) => {
    try {
      const date = new Date(dateString)
      return new Intl.DateTimeFormat('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: timezone
      }).format(date)
    } catch (error) {
      return 'Invalid date'
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      case 'sent':
        return 'bg-green-100 text-green-800 border-green-200'
      case 'failed':
        return 'bg-red-100 text-red-800 border-red-200'
      case 'cancelled':
        return 'bg-gray-100 text-gray-800 border-gray-200'
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case 'pending':
        return 'Pending'
      case 'sent':
        return 'Sent'
      case 'failed':
        return 'Failed'
      case 'cancelled':
        return 'Cancelled'
      default:
        return status
    }
  }

  const isOverdue = () => {
    if (reminder.status !== 'pending') return false
    const now = new Date()
    const scheduledTime = new Date(reminder.scheduled_time)
    return scheduledTime < now
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">Reminder Details</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Status */}
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-500">Status</span>
            <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium border ${getStatusColor(reminder.status)}`}>
              {reminder.status === 'pending' && isOverdue() && (
                <AlertCircle className="w-4 h-4 mr-2" />
              )}
              {reminder.status === 'sent' && (
                <Check className="w-4 h-4 mr-2" />
              )}
              {getStatusText(reminder.status)}
            </span>
          </div>

          {/* Scheduled Time */}
          <div className="flex items-start space-x-3">
            <Calendar className="w-5 h-5 text-gray-400 mt-0.5" />
            <div>
              <span className="text-sm font-medium text-gray-500">Scheduled Time</span>
              <p className="text-gray-900">{formatDate(reminder.scheduled_time, reminder.user_timezone)}</p>
              <p className="text-sm text-gray-500">Timezone: {reminder.user_timezone}</p>
            </div>
          </div>

          {/* Contact Information */}
          {reminder.contact_name && (
            <div className="flex items-start space-x-3">
              <User className="w-5 h-5 text-gray-400 mt-0.5" />
              <div className="flex-1">
                <span className="text-sm font-medium text-gray-500">Contact</span>
                <p className="text-gray-900 font-medium">{reminder.contact_name}</p>
                {reminder.contact_email && (
                  <p className="text-gray-600">{reminder.contact_email}</p>
                )}
                {reminder.contact_company && (
                  <div className="flex items-center space-x-2 mt-1">
                    <Briefcase className="w-4 h-4 text-gray-400" />
                    <span className="text-gray-600">{reminder.contact_company}</span>
                    {reminder.contact_job_title && (
                      <span className="text-gray-500">• {reminder.contact_job_title}</span>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Job Information */}
          {reminder.job_title && (
            <div className="flex items-start space-x-3">
              <Briefcase className="w-5 h-5 text-gray-400 mt-0.5" />
              <div className="flex-1">
                <span className="text-sm font-medium text-gray-500">Job</span>
                <p className="text-gray-900 font-medium">{reminder.job_title}</p>
                <div className="flex items-center space-x-2 mt-1">
                  <span className="text-gray-600">{reminder.job_company}</span>
                  {reminder.job_location && (
                    <>
                      <span className="text-gray-400">•</span>
                      <div className="flex items-center space-x-1">
                        <MapPin className="w-3 h-3 text-gray-400" />
                        <span className="text-gray-600">{reminder.job_location}</span>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Email Subject */}
          <div className="flex items-start space-x-3">
            <Mail className="w-5 h-5 text-gray-400 mt-0.5" />
            <div className="flex-1">
              <span className="text-sm font-medium text-gray-500">Email Subject</span>
              <p className="text-gray-900">{reminder.email_subject}</p>
            </div>
          </div>

          {/* Message Content */}
          <div className="flex items-start space-x-3">
            <MessageSquare className="w-5 h-5 text-gray-400 mt-0.5" />
            <div className="flex-1">
              <span className="text-sm font-medium text-gray-500">Message</span>
              <div className="mt-2 p-3 bg-gray-50 rounded-md">
                <pre className="whitespace-pre-wrap text-gray-900 text-sm font-sans">{reminder.user_message}</pre>
              </div>
            </div>
          </div>

          {/* Timestamps */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-gray-200">
            <div>
              <span className="text-sm font-medium text-gray-500">Created</span>
              <p className="text-gray-900">{formatDate(reminder.created_at, reminder.user_timezone)}</p>
            </div>
            {reminder.sent_at && (
              <div>
                <span className="text-sm font-medium text-gray-500">Sent</span>
                <p className="text-gray-900">{formatDate(reminder.sent_at, reminder.user_timezone)}</p>
              </div>
            )}
          </div>

          {/* Error Message */}
          {reminder.error_message && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-md">
              <div className="flex items-center space-x-2">
                <AlertCircle className="w-5 h-5 text-red-400" />
                <span className="text-sm font-medium text-red-800">Error</span>
              </div>
              <p className="text-red-700 text-sm mt-1">{reminder.error_message}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end p-6 border-t border-gray-200">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}


