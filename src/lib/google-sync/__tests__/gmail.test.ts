import { describe, it, expect } from 'vitest'
import { normalizeThread, isNoiseSender, isNoiseSubject } from '../gmail'

const identity = new Set(['me@gmail.com'])

// base64url of "Great to hear from you!"
const encodedBody = btoa('Great to hear from you!').replace(/\+/g, '-').replace(/\//g, '_')

const thread = {
  id: 'thr1',
  messages: [
    { headers: { From: 'me@gmail.com', To: 'them@x.com', Subject: 'Hi', Date: '2026-05-01T10:00:00Z' },
      payload: { mimeType: 'text/plain', body: { data: btoa('Hello there').replace(/\+/g, '-').replace(/\//g, '_') } } },
    { headers: { From: 'them@x.com', To: 'me@gmail.com', Subject: 'Re: Hi', Date: '2026-05-03T10:00:00Z' },
      payload: { mimeType: 'text/plain', body: { data: encodedBody } } },
  ],
}

describe('gmail', () => {
  it('collapses thread to one normalized interaction per counterparty', () => {
    const out = normalizeThread(thread, identity)
    expect(out).toHaveLength(1)
    expect(out[0].counterpartyEmail).toBe('them@x.com')
    expect(out[0].messageCount).toBe(2)
    expect(out[0].lastDirection).toBe('inbound')
    expect(out[0].lastMessageAt).toBe('2026-05-03T10:00:00.000Z')
    expect(out[0].externalId).toBe('thr1')
    expect(out[0].type).toBe('email')
    expect(out[0].notes).toContain('Great to hear from you!')
  })
  it('flags no-reply senders', () => {
    expect(isNoiseSender('no-reply@x.com')).toBe(true)
    expect(isNoiseSender('notifications@x.com')).toBe(true)
    expect(isNoiseSender('jane@x.com')).toBe(false)
  })

  // --- expanded sender noise ---
  it('flags ATS platform senders', () => {
    expect(isNoiseSender('apply@lever.co')).toBe(true)
    expect(isNoiseSender('no-reply@greenhouse.io')).toBe(true)
    expect(isNoiseSender('alerts@jobvite.com')).toBe(true)
    expect(isNoiseSender('noreply@smartrecruiters.com')).toBe(true)
    expect(isNoiseSender('recruiting@taleo.net')).toBe(true)
    expect(isNoiseSender('apply@icims.com')).toBe(true)
    expect(isNoiseSender('careers@workday.com')).toBe(true)
    expect(isNoiseSender('noreply@myworkday.com')).toBe(true)
  })
  it('flags newsletter platform senders', () => {
    expect(isNoiseSender('hello@substack.com')).toBe(true)
    expect(isNoiseSender('updates@mailchimp.com')).toBe(true)
    expect(isNoiseSender('bounce@sendgrid.net')).toBe(true)
    expect(isNoiseSender('digest@constantcontact.com')).toBe(true)
    expect(isNoiseSender('hello@klaviyo.com')).toBe(true)
    expect(isNoiseSender('newsletter@beehiiv.com')).toBe(true)
    expect(isNoiseSender('no-reply@campaign-archive.com')).toBe(true)
  })
  it('flags generic automated-mail senders', () => {
    expect(isNoiseSender('weekly@company.com')).toBe(true)
    expect(isNoiseSender('digest@company.com')).toBe(true)
    expect(isNoiseSender('newsletter@company.com')).toBe(true)
    expect(isNoiseSender('alerts@company.com')).toBe(true)
    expect(isNoiseSender('monthly@company.com')).toBe(true)
  })
  it('does not flag real senders', () => {
    expect(isNoiseSender('jane@lever.example.com')).toBe(false)
    expect(isNoiseSender('hiring-manager@acme.com')).toBe(false)
  })

  // --- subject noise ---
  it('suppresses threads with noisy subjects even from real-looking senders', () => {
    const noisyThread = {
      id: 'thr-noise',
      messages: [{
        headers: {
          From: 'news@acme.com', To: 'me@gmail.com',
          Subject: 'Weekly Digest: top stories this week',
          Date: '2026-05-01T10:00:00Z',
        },
        payload: { mimeType: 'text/plain', body: { data: btoa('content').replace(/\+/g,'-').replace(/\//g,'_') } },
      }],
    }
    expect(normalizeThread(noisyThread, identity)).toHaveLength(0)
  })
  it('suppresses job-alert subjects', () => {
    const t = {
      id: 'thr-jobalert',
      messages: [{
        headers: { From: 'jobs@linkedin.com', To: 'me@gmail.com', Subject: 'Job alert: 5 new senior engineer roles', Date: '2026-05-01T10:00:00Z' },
        payload: { mimeType: 'text/plain', body: { data: btoa('x').replace(/\+/g,'-').replace(/\//g,'_') } },
      }],
    }
    expect(normalizeThread(t, identity)).toHaveLength(0)
  })
  it('suppresses unsubscribe-containing subjects', () => {
    const t = {
      id: 'thr-unsub',
      messages: [{
        headers: { From: 'news@co.com', To: 'me@gmail.com', Subject: 'Click to unsubscribe from this list', Date: '2026-05-01T10:00:00Z' },
        payload: { mimeType: 'text/plain', body: { data: btoa('x').replace(/\+/g,'-').replace(/\//g,'_') } },
      }],
    }
    expect(normalizeThread(t, identity)).toHaveLength(0)
  })
  it('does not suppress legitimate subjects', () => {
    const t = {
      id: 'thr-legit',
      messages: [{
        headers: { From: 'alice@acme.com', To: 'me@gmail.com', Subject: 'Following up on our conversation', Date: '2026-05-01T10:00:00Z' },
        payload: { mimeType: 'text/plain', body: { data: btoa('Hi').replace(/\+/g,'-').replace(/\//g,'_') } },
      }],
    }
    expect(normalizeThread(t, identity)).toHaveLength(1)
  })
})
